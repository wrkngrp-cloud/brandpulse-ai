#!/usr/bin/env bash
# Apply every migration to a scratch Postgres and exercise the Desk's SQL.
#
# Needs a local postgres (any 15+) and nothing else: no Supabase project, no
# network, no credentials. It builds a throwaway cluster, stands up a
# Supabase-shaped shim (the auth and storage schemas, auth.uid(), the API
# roles), applies supabase/migrations in order, then runs the assertions in
# scripts/desk-sql/01-access-checks.sql.
#
# This is the half of the Desk that npm run desk:check cannot reach: RLS,
# function precedence, security-definer grants and triggers.
set -euo pipefail

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}"
[ -n "$PGBIN" ] && [ -x "$PGBIN/initdb" ] || { echo "No local postgres found. Set PGBIN to its bin directory."; exit 2; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${DESK_SQL_DIR:-/var/tmp/bg-desk-sql}"
PORT="${DESK_SQL_PORT:-55433}"

# initdb refuses to run as root, so the cluster is owned by the postgres user
# where there is one. In a container running as root that is how this works.
OWNER="$(id -u)"
if [ "$OWNER" = "0" ]; then
  id postgres >/dev/null 2>&1 || { echo "Running as root and there is no postgres user to own the cluster."; exit 2; }
  AS_PG=(su postgres -s /bin/bash -c)
else
  AS_PG=(bash -c)
fi

cleanup() {
  "${AS_PG[@]}" "$PGBIN/pg_ctl -D $DIR/data -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$DIR"
}
trap cleanup EXIT

rm -rf "$DIR"; mkdir -p "$DIR"
[ "$OWNER" = "0" ] && chown postgres:postgres "$DIR"

echo "── building a scratch cluster"
"${AS_PG[@]}" "$PGBIN/initdb -D $DIR/data -U postgres --auth=trust" >/dev/null
"${AS_PG[@]}" "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/pg.log start" >/dev/null
sleep 2

PSQL="psql -h $DIR -p $PORT -U postgres -d postgres -q"

echo "── standing up the Supabase shim"
$PSQL -v ON_ERROR_STOP=1 -f "$ROOT/scripts/desk-sql/00-supabase-shim.sql" >/dev/null 2>&1

echo "── applying migrations"
# 20260615000002 alters `influencers`, which is created eight days later in
# 20260623000000, so the set does not replay from empty. It is skipped here and
# recorded in docs/internal-tool-plan.md rather than silently passed over.
skipped=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  case "$(basename "$f")" in
    20260615000002_influencer_profiles.sql) skipped=$((skipped+1)); continue ;;
  esac
  if ! out=$($PSQL -v ON_ERROR_STOP=1 -f "$f" 2>&1); then
    echo "   migration failed: $(basename "$f")"
    echo "$out" | grep -E "ERROR" | head -3
    exit 1
  fi
done
echo "   applied, $skipped skipped"

echo "── checking"
out=$($PSQL -f "$ROOT/scripts/desk-sql/01-access-checks.sql" 2>&1)
echo "$out" | grep -E "^──|NOTICE" | sed 's/^psql:[^ ]* //' || true

# Every assertion is name|got|want. A line whose got and want differ is a fail.
pass=0; fail=0
while IFS= read -r line; do
  case "$line" in *"|"*) : ;; *) continue ;; esac
  got="$(printf '%s' "$line" | awk -F'|' '{print $2}')"
  want="$(printf '%s' "$line" | awk -F'|' '{print $3}')"
  [ -z "$want" ] && continue
  if [ "$got" = "$want" ]; then pass=$((pass+1)); else
    fail=$((fail+1)); echo "   FAIL  $line"
  fi
done <<< "$out"

if echo "$out" | grep -q "FAIL:"; then
  fail=$((fail+$(echo "$out" | grep -c "FAIL:")))
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "✓ $pass SQL assertions passed"
else
  echo "✗ $pass passed, $fail failed"
  exit 1
fi
