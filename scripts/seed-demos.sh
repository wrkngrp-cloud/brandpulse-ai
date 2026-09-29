#!/usr/bin/env bash
#
# Seed the four demo accounts against a running deployment.
#
# Deploying the seed code does not change any data. The seeds are endpoints and
# the demo accounts keep whatever was written the last time they were run, so
# this is the step that makes demo changes live.
#
# Each account is wiped and rebuilt: the existing demo user is kept, its
# workspaces are deleted (cascading to every child table) and reseeded. The
# login stays the same. Safe to re-run.
#
# Usage:
#   ADMIN_SECRET=... ./scripts/seed-demos.sh https://your-deployment.vercel.app
#
set -uo pipefail

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "usage: ADMIN_SECRET=... $0 <base-url>" >&2
  exit 2
fi
if [[ -z "${ADMIN_SECRET:-}" ]]; then
  echo "ADMIN_SECRET is not set. The seed routes fail closed without it." >&2
  exit 2
fi

ACCOUNTS=(
  "Jara Foods (fmcg)|/api/admin/seed-demo"
  "PocketPay (fintech)|/api/admin/seed-demo/fintech"
  "Bridger CRM (b2b_saas)|/api/admin/seed-demo/saas"
  "Pinnacle Media (agency)|/api/admin/seed-demo/agency"
)

fail=0
for entry in "${ACCOUNTS[@]}"; do
  name="${entry%%|*}"
  path="${entry##*|}"
  printf '\n=== %s\n    POST %s\n' "$name" "$path"

  body=$(curl -sS -X POST \
    -H "x-seed-secret: ${ADMIN_SECRET}" \
    -H 'Content-Type: application/json' \
    --max-time 300 \
    -w '\n__STATUS__%{http_code}' \
    "${BASE}${path}" 2>&1)

  status="${body##*__STATUS__}"
  payload="${body%$'\n'__STATUS__*}"

  if [[ "$status" != "200" ]]; then
    echo "    HTTP $status"
    echo "    $(printf '%s' "$payload" | head -c 400)"
    fail=1
    continue
  fi

  # the seeds report their own failed writes; surface that rather than trusting 200
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$payload" | python3 -c '
import json,sys
try: d=json.load(sys.stdin)
except Exception: print("    could not parse response"); sys.exit(0)
w=d.get("writes") or {}
n=w.get("failedWrites",0)
success=d.get("success")
print(f"    success={success}  failedWrites={n}")
if n:
    for k,v in (w.get("byTable") or {}).items(): print(f"      {v:>4}  {k}")
    for s in (w.get("sample") or []): print(f"      {s}")
    sys.exit(3)
' || fail=1
  else
    printf '%s' "$payload" | head -c 300
  fi
done

echo
if [[ "$fail" -ne 0 ]]; then
  echo "One or more accounts reported failed writes. Nothing above is silent:"
  echo "the seeds count every rejected insert and name the table."
  exit 1
fi
echo "All four demo accounts seeded with no failed writes."
