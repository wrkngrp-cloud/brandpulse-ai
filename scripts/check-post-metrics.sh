#!/usr/bin/env bash
#
# Confirm each platform credential actually serves post reads, before trusting
# the autofill in the influencer post tracker.
#
# The X dashboard showing a credit balance is not proof that reads work: the
# app also has to be allowed to read, and a depleted balance answers 402. This
# spends about one cent of X credit and nothing else.
#
# Usage:
#   TWITTER_BEARER_TOKEN=... ./scripts/check-post-metrics.sh
#   YOUTUBE_API_KEY=...      ./scripts/check-post-metrics.sh   # optional
#
set -uo pipefail

fail=0

echo "=== X: GET /2/tweets public_metrics"
if [[ -z "${TWITTER_BEARER_TOKEN:-}" ]]; then
  echo "    SKIP  TWITTER_BEARER_TOKEN not set"
else
  # A long-lived, well-known public post.
  body=$(curl -sS -w '\n__STATUS__%{http_code}' \
    -H "Authorization: Bearer ${TWITTER_BEARER_TOKEN}" \
    'https://api.x.com/2/tweets?ids=20&tweet.fields=public_metrics' 2>&1)
  status="${body##*__STATUS__}"
  payload="${body%$'\n'__STATUS__*}"
  case "$status" in
    200) echo "    OK    reads are live"
         printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)" ;;
    402) echo "    FAIL  402 Payment Required: credits depleted. Top up, and enable auto-recharge."; fail=1 ;;
    401|403) echo "    FAIL  $status: the app is not permitted to read posts."; fail=1
         printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)" ;;
    429) echo "    WARN  429 rate limited. The credential works; retry later." ;;
    *)   echo "    FAIL  HTTP $status"; printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)"; fail=1 ;;
  esac
fi

echo
echo "=== YouTube: videos.list statistics"
if [[ -z "${YOUTUBE_API_KEY:-}" ]]; then
  echo "    SKIP  YOUTUBE_API_KEY not set (the app reads a per-brand key from youtube_api_configs)"
else
  body=$(curl -sS -w '\n__STATUS__%{http_code}' \
    "https://www.googleapis.com/youtube/v3/videos?part=statistics&id=dQw4w9WgXcQ&key=${YOUTUBE_API_KEY}" 2>&1)
  status="${body##*__STATUS__}"
  payload="${body%$'\n'__STATUS__*}"
  if [[ "$status" == "200" ]]; then
    echo "    OK    reads are live"
    printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)"
  else
    echo "    FAIL  HTTP $status"; printf '    %s\n' "$(printf '%s' "$payload" | head -c 300)"; fail=1
  fi
fi

echo
echo "=== Instagram"
echo "    Not checkable from a script: business_discovery needs a brand's own"
echo "    connected Instagram Business account token out of social_connections."
echo "    Verify by pasting a creator's post link into the post tracker."

echo
if [[ "$fail" -ne 0 ]]; then
  echo "At least one credential cannot read posts. The tracker degrades to manual"
  echo "entry for that platform and says so on screen, so this is not fatal."
  exit 1
fi
echo "Checked credentials can read posts."
