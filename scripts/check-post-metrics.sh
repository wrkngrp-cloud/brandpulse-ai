#!/usr/bin/env bash
#
# Read real X post metrics, or probe the credentials.
#
# Two modes:
#
#   ./scripts/check-post-metrics.sh
#       Credential probe. Confirms each platform credential actually serves
#       post reads. A credit balance on the X dashboard is not proof: the app
#       also has to be permitted to read, and a depleted balance answers 402.
#
#   ./scripts/check-post-metrics.sh <post-url-or-id> [more...]
#       Reads the posts you name. Accepts full status URLs or bare numeric ids,
#       batches them into one API call (X allows 100 ids per request), prints a
#       table, and emits a body you can paste straight into
#       POST /api/influencers/:id/posts.
#
# Both modes spend X credit, about half a cent per post read.
#
# Usage:
#   TWITTER_BEARER_TOKEN=... ./scripts/check-post-metrics.sh
#   TWITTER_BEARER_TOKEN=... ./scripts/check-post-metrics.sh https://x.com/a/status/123 456
#   YOUTUBE_API_KEY=...      ./scripts/check-post-metrics.sh   # probe mode only
#
# views/impressions are deliberately absent for other people's posts. X returns
# impression_count only to a post's own author, through a user-context token,
# and an influencer's post is not BrandGauge's account. This prints "creator
# only" for that field rather than a zero that would read as a measurement.
set -uo pipefail

X_API='https://api.x.com/2/tweets'

# Accepts https://x.com/user/status/123, twitter.com equivalents, or a bare id.
extract_id() {
  case "$1" in
    *[!0-9]*)
      printf '%s' "$1" | sed -nE 's#.*(twitter|x)\.com/[^/]+/status(es)?/([0-9]+).*#\3#p'
      ;;
    *) printf '%s' "$1" ;;
  esac
}

x_get() {
  curl -sS -w '\n__STATUS__%{http_code}' \
    -H "Authorization: Bearer ${TWITTER_BEARER_TOKEN}" \
    --max-time 30 \
    "${X_API}?ids=$1&tweet.fields=public_metrics" 2>&1
}

# Turns an HTTP status into a one-line diagnosis. Every branch here is a case
# the post tracker also handles on screen.
explain_x_status() {
  case "$1" in
    402) echo "FAIL  402 Payment Required: X credits are depleted. Top up, and enable auto-recharge so this does not happen mid-campaign." ;;
    401|403) echo "FAIL  $1: the app is not permitted to read posts. Check its access level." ;;
    429) echo "WARN  429 rate limited. The credential works; retry later." ;;
    *)   echo "FAIL  HTTP $1" ;;
  esac
}

# ── read mode ─────────────────────────────────────────────────────────────────

if [[ $# -gt 0 ]]; then
  if [[ -z "${TWITTER_BEARER_TOKEN:-}" ]]; then
    echo "TWITTER_BEARER_TOKEN is not set. X reads fail closed without it." >&2
    exit 2
  fi

  ids=()
  declare -a originals=()
  for arg in "$@"; do
    id=$(extract_id "$arg")
    if [[ -z "$id" ]]; then
      echo "skipping, not a post URL or id: $arg" >&2
      continue
    fi
    ids+=("$id")
    originals+=("$id=$arg")
  done

  if [[ ${#ids[@]} -eq 0 ]]; then
    echo "Nothing to look up." >&2
    exit 2
  fi
  if [[ ${#ids[@]} -gt 100 ]]; then
    echo "X accepts 100 ids per request; you passed ${#ids[@]}." >&2
    exit 2
  fi

  joined=$(IFS=,; printf '%s' "${ids[*]}")
  echo "Reading ${#ids[@]} post(s) in one call, about \$$(awk "BEGIN{printf \"%.3f\", ${#ids[@]}*0.005}") of credit."
  echo

  body=$(x_get "$joined")
  status="${body##*__STATUS__}"
  payload="${body%$'\n'__STATUS__*}"

  if [[ "$status" != "200" ]]; then
    echo "$(explain_x_status "$status")"
    printf '%s\n' "$(printf '%s' "$payload" | head -c 500)"
    exit 1
  fi

  # Exported, not prefixed: a prefix would bind to printf, not to the python
  # on the far side of the pipe.
  URL_MAP=$(printf '%s\n' "${originals[@]}")
  export URL_MAP
  printf '%s' "$payload" | python3 "$(dirname "$0")/lib/format-x-metrics.py" || exit 1

  exit 0
fi

# ── probe mode ────────────────────────────────────────────────────────────────

fail=0
checked=0

echo "=== X: GET /2/tweets public_metrics"
if [[ -z "${TWITTER_BEARER_TOKEN:-}" ]]; then
  echo "    SKIP  TWITTER_BEARER_TOKEN not set"
else
  # Post id 20 is the first post on the platform, so it will not disappear.
  checked=$((checked + 1))
  body=$(x_get 20)
  status="${body##*__STATUS__}"
  payload="${body%$'\n'__STATUS__*}"
  if [[ "$status" == "200" ]]; then
    echo "    OK    reads are live"
    printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)"
  else
    echo "    $(explain_x_status "$status")"
    printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)"
    [[ "$status" == "429" ]] || fail=1
  fi
fi

echo
echo "=== YouTube: videos.list statistics"
if [[ -z "${YOUTUBE_API_KEY:-}" ]]; then
  echo "    SKIP  YOUTUBE_API_KEY not set (the app reads a per-brand key from youtube_api_configs)"
else
  checked=$((checked + 1))
  body=$(curl -sS -w '\n__STATUS__%{http_code}' --max-time 30 \
    "https://www.googleapis.com/youtube/v3/videos?part=statistics&id=dQw4w9WgXcQ&key=${YOUTUBE_API_KEY}" 2>&1)
  status="${body##*__STATUS__}"
  payload="${body%$'\n'__STATUS__*}"
  if [[ "$status" == "200" ]]; then
    echo "    OK    reads are live"
    printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)"
  else
    echo "    FAIL  HTTP $status"
    printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)"
    fail=1
  fi
fi

echo
echo "=== Instagram"
echo "    Not checkable from a script: business_discovery needs a brand's own"
echo "    connected Instagram Business account token out of social_connections."
echo "    Verify by pasting a creator's post link into the post tracker."

echo
if [[ "$checked" -eq 0 ]]; then
  echo "Nothing was checked: no credentials were set, so this run proves nothing."
  echo "Set TWITTER_BEARER_TOKEN (and optionally YOUTUBE_API_KEY) and run it again."
  exit 2
fi
if [[ "$fail" -ne 0 ]]; then
  echo "At least one credential cannot read posts. The tracker degrades to manual"
  echo "entry for that platform and says so on screen, so this is not fatal."
  exit 1
fi
echo "Checked credentials can read posts."
