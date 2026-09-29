"""
Format an X /2/tweets response for scripts/check-post-metrics.sh.

Reads the API response on stdin and a newline-separated "id=original-url" map
from URL_MAP, and prints a metrics table followed by bodies ready to paste into
POST /api/influencers/:id/posts.

views is printed as "creator only" rather than 0 when X withholds it, which it
does for every post the authenticating account does not own.
"""

import json
import os
import sys

COLUMNS = (
    ("post", 22, "<"),
    ("likes", 9, ">"),
    ("replies", 9, ">"),
    ("shares", 9, ">"),
    ("saves", 9, ">"),
    ("views", 14, ">"),
)


def cell(value, width, align):
    text = f"{value:,}" if isinstance(value, int) else str(value)
    return f"{text:{align}{width}}"


def main():
    url_map = dict(
        line.split("=", 1)
        for line in os.environ.get("URL_MAP", "").splitlines()
        if "=" in line
    )

    try:
        doc = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        print("Could not parse the X response.")
        return 1

    rows = doc.get("data") or []
    errors = doc.get("errors") or []

    if rows:
        header = "".join(cell(name, width, align) for name, width, align in COLUMNS)
        print(header)
        print("-" * len(header))

    bodies = []
    for post in rows:
        metrics_in = post.get("public_metrics") or {}
        post_id = post.get("id", "?")

        likes = metrics_in.get("like_count")
        replies = metrics_in.get("reply_count")
        # Reposts and quotes are both amplification, so they add up to shares.
        shares = (metrics_in.get("retweet_count") or 0) + (metrics_in.get("quote_count") or 0)
        saves = metrics_in.get("bookmark_count")
        # Returned only for the authenticating account's own posts.
        views = metrics_in.get("impression_count")

        print(
            cell(post_id, 22, "<")
            + cell(likes if likes is not None else "-", 9, ">")
            + cell(replies if replies is not None else "-", 9, ">")
            + cell(shares, 9, ">")
            + cell(saves if saves is not None else "-", 9, ">")
            + cell(views if views is not None else "creator only", 14, ">")
        )

        metrics, sources = {}, {}
        for key, value in (
            ("likes", likes),
            ("comments", replies),
            ("shares", shares),
            ("saves", saves),
            ("views", views),
        ):
            if isinstance(value, int):
                metrics[key] = value
                sources[key] = "pulled"

        bodies.append({
            "post_url": url_map.get(post_id, f"https://x.com/i/status/{post_id}"),
            **metrics,
            "metric_sources": sources,
        })

    if errors:
        if rows:
            print()
        for err in errors:
            ref = err.get("resource_id") or err.get("value") or "?"
            print(f"  not readable: {ref}  ({err.get('title', 'unknown reason')})")
        print("  A post can be missing because it was deleted, made private or age-restricted.")

    if bodies:
        print()
        print("Paste-ready body for POST /api/influencers/:id/posts")
        print("(add campaign_id, and reach only if the creator gave you the figure):")
        print()
        for body in bodies:
            print(json.dumps(body, indent=2))

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:
        # Piping into head or less closes the pipe early; that is not a failure.
        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        sys.exit(0)
