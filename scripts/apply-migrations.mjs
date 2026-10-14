#!/usr/bin/env node
/**
 * Apply pending Supabase migrations over HTTPS.
 *
 * `supabase db push` opens a raw Postgres connection to the pooler on 5432 or
 * 6543. A Claude Code cloud session has no raw TCP egress — only HTTPS through
 * an agent proxy — so `db push` cannot work from there however the network
 * policy is set. The Management API's query endpoint runs the same SQL over
 * 443, which can.
 *
 * This is a companion to `supabase db push`, not a replacement for it. On your
 * own machine, keep using the CLI. Use this when the CLI cannot reach the
 * database.
 *
 * It reads and writes the same ledger the CLI uses,
 * `supabase_migrations.schema_migrations`, so the two stay in agreement: a
 * migration applied here shows as applied to `supabase migration list`, and
 * one applied by the CLI is skipped here.
 *
 *   node scripts/apply-migrations.mjs                    # plan only, changes nothing
 *   node scripts/apply-migrations.mjs --apply            # apply every pending migration
 *   node scripts/apply-migrations.mjs --apply --only 20261014090000
 *   node scripts/apply-migrations.mjs --project <ref>    # when the account has several
 *   node scripts/apply-migrations.mjs --self-test        # offline checks, no token needed
 *
 * Needs SUPABASE_ACCESS_TOKEN. The token is never printed, never logged and
 * never written to disk.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const API = 'https://api.supabase.com'
const MIGRATIONS_DIR = 'supabase/migrations'

/* ── Pure helpers. Exported so --self-test can exercise them with no network,
      and so a future script can reuse the diff. ─────────────────────────── */

/** `20261014090000_free_tools.sql` → { version, name }. The CLI's own split:
 *  everything before the first underscore is the version. */
export function parseMigrationName(filename) {
  const match = /^(\d{14})_(.+)\.sql$/.exec(filename)
  if (!match) return null
  return { version: match[1], name: match[2] }
}

export function localMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({ file: f, ...(parseMigrationName(f) ?? {}) }))
    .filter(m => m.version)
    .sort((a, b) => a.version.localeCompare(b.version))
}

/** What is on disk and not in the remote ledger, in the order it must run. */
export function pendingMigrations(local, appliedVersions) {
  const applied = new Set(appliedVersions)
  return local.filter(m => !applied.has(m.version))
}

/**
 * A migration's SQL plus the ledger insert, as one string.
 *
 * Postgres runs a multi-statement simple query in one implicit transaction, so
 * sending these together means the ledger row and the schema change commit or
 * fail as a unit. Recording the row in a second request would leave a window
 * where the migration is applied and unrecorded, and the next run would try to
 * apply it again — which `create policy` would not survive.
 *
 * A file carrying its own BEGIN/COMMIT would break that, so one is refused
 * rather than silently half-applied.
 */
export function buildStatement(migration, sql) {
  if (hasTransactionControl(sql)) {
    throw new Error(
      `${migration.file} contains its own BEGIN or COMMIT. This script wraps each migration ` +
      `in one implicit transaction with its ledger row, and an explicit one would split that. ` +
      `Remove the transaction control, or apply this file with the CLI.`,
    )
  }
  const version = quote(migration.version)
  const name    = quote(migration.name)
  const body    = quote(sql)
  return `${sql.trimEnd().replace(/;?\s*$/, ';')}

insert into supabase_migrations.schema_migrations (version, name, statements)
values (${version}, ${name}, array[${body}])
on conflict (version) do nothing;`
}

/**
 * Does this file open its own transaction?
 *
 * The naive check — `begin` at the start of a line — is wrong, and wrongly
 * rejected eight migrations in this repo on the first run. Every PL/pgSQL
 * function body is `begin ... end`, and those live inside dollar quotes where
 * they are part of a string, not statements.
 *
 * So dollar-quoted bodies and comments come out first, and what is left has to
 * look like real transaction control: the bare keyword followed by a
 * semicolon, or followed by TRANSACTION, WORK or ISOLATION. A plain `begin`
 * with nothing after it is not valid SQL at statement level anyway.
 */
export function hasTransactionControl(sql) {
  /* Order matters. Dollar quotes first, because a function body holds both
     quotes and double dashes. Comments next, so an apostrophe in `-- don't`
     cannot open a string. Then ordinary string literals, so a row whose text
     happens to read "begin; commit;" is not mistaken for the real thing. */
  const bare = stripDollarQuoted(sql)
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, " '' ")
  return /(^|;)\s*(begin|start\s+transaction|commit|rollback)\s*(;|$|\s+(transaction|work|isolation)\b)/i.test(bare)
}

/** Everything between a dollar-quote and its matching close, removed. Handles
 *  tagged quotes ($fn$ ... $fn$) as well as the bare $$ ... $$ form. */
export function stripDollarQuoted(sql) {
  let out = ''
  let i = 0
  while (i < sql.length) {
    const open = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))
    if (!open) { out += sql.slice(i); break }
    const start = i + open.index
    out += sql.slice(i, start)
    const close = sql.indexOf(open[0], start + open[0].length)
    // An unterminated dollar quote is a broken file; leave the rest alone and
    // let Postgres be the one to complain about it.
    if (close === -1) { out += sql.slice(start); break }
    out += ' '
    i = close + open[0].length
  }
  return out
}

/** Single-quoted SQL literal. Dollar quoting would be prettier, but these files
 *  contain $$ function bodies, so doubling the quote is the safe one. */
function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

/* ── The API ──────────────────────────────────────────────────────────────── */

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let parsed = null
  try { parsed = text ? JSON.parse(text) : null } catch { /* not JSON */ }

  if (!res.ok) {
    const message = parsed?.message ?? parsed?.error ?? text.slice(0, 500) ?? ''
    // 401 is the one worth naming precisely: it is almost always a token that
    // is missing, expired, or scoped to a different account.
    const hint = res.status === 401
      ? ' — the access token was rejected. Check SUPABASE_ACCESS_TOKEN belongs to the account that owns this project.'
      : ''
    throw new Error(`${method} ${path} → ${res.status}${hint}\n${message}`)
  }
  return parsed
}

const runSql = (token, ref, query) =>
  api(`/v1/projects/${ref}/database/query`, { token, method: 'POST', body: { query } })

async function resolveProject(token, wanted) {
  const projects = await api('/v1/projects', { token })
  if (!Array.isArray(projects) || !projects.length) {
    throw new Error('That token can see no projects.')
  }
  if (wanted) {
    const match = projects.find(p => p.id === wanted || p.name === wanted)
    if (!match) {
      throw new Error(`No project matched "${wanted}". Visible: ${projects.map(p => `${p.name} (${p.id})`).join(', ')}`)
    }
    return match
  }
  if (projects.length === 1) return projects[0]
  throw new Error(
    `This token can see ${projects.length} projects, so pass --project <ref>:\n` +
    projects.map(p => `  ${p.id}  ${p.name}  ${p.region ?? ''}`).join('\n'),
  )
}

/** The CLI creates this ledger on its first push. Creating it here means a
 *  project that has only ever been migrated by hand still works. */
async function ensureLedger(token, ref) {
  await runSql(token, ref, `
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version    text primary key,
      statements text[],
      name       text
    );
  `)
}

async function appliedVersions(token, ref) {
  const rows = await runSql(token, ref,
    'select version from supabase_migrations.schema_migrations order by version;')
  return (rows ?? []).map(r => r.version)
}

/* ── The command ──────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = { apply: false, only: null, project: null, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--self-test') args.selfTest = true
    else if (a === '--help' || a === '-h') args.help = true
    else if (a === '--only') args.only = argv[++i]
    else if (a === '--project') args.project = argv[++i]
    else if (a.startsWith('--only=')) args.only = a.slice(7)
    else if (a.startsWith('--project=')) args.project = a.slice(10)
    else throw new Error(`Unknown argument: ${a}`)
  }
  return args
}

const HELP = `
Apply pending Supabase migrations over HTTPS, for environments where
\`supabase db push\` cannot open a Postgres connection.

  node scripts/apply-migrations.mjs                 plan only, changes nothing
  node scripts/apply-migrations.mjs --apply         apply every pending migration
  node scripts/apply-migrations.mjs --apply --only 20261014090000
  node scripts/apply-migrations.mjs --project <ref>
  node scripts/apply-migrations.mjs --self-test     offline checks, no token needed

Reads SUPABASE_ACCESS_TOKEN. Optionally SUPABASE_PROJECT_REF instead of --project.
Writes the same ledger as the CLI, so the two agree.
`.trim()

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(HELP); return 0 }
  if (args.selfTest) return selfTest()

  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN is not set.\n')
    console.error('In a Claude Code cloud session: add it in the environment settings')
    console.error('(cloud environment menu in the title bar, then Edit), and start a new')
    console.error('session — environment variables are injected when the container starts.')
    return 1
  }

  const local = localMigrations()
  console.log(`${local.length} migrations on disk.`)

  const project = await resolveProject(token, args.project ?? process.env.SUPABASE_PROJECT_REF ?? null)
  console.log(`Project: ${project.name} (${project.id})${project.region ? ` · ${project.region}` : ''}`)

  await ensureLedger(token, project.id)
  const applied = await appliedVersions(token, project.id)
  console.log(`${applied.length} already applied remotely.`)

  let pending = pendingMigrations(local, applied)
  if (args.only) {
    pending = pending.filter(m => m.version === args.only || m.file === args.only)
    if (!pending.length) {
      console.log(`\nNothing pending matches "${args.only}". It may already be applied.`)
      return 0
    }
  }

  if (!pending.length) {
    console.log('\nNothing pending. The database matches the migrations directory.')
    return 0
  }

  console.log(`\n${pending.length} pending:\n`)
  for (const m of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, m.file), 'utf8')
    const statements = sql.split(';').filter(s => s.trim() && !/^\s*--/.test(s)).length
    console.log(`  ${m.version}  ${m.name}  (${(sql.length / 1024).toFixed(1)}KB, ~${statements} statements)`)
  }

  if (!args.apply) {
    console.log('\nPlan only. Nothing was changed. Re-run with --apply to apply these.')
    return 0
  }

  console.log('\nApplying. Each migration commits with its ledger row, or neither lands.\n')
  for (const m of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, m.file), 'utf8')
    process.stdout.write(`  ${m.version} ${m.name} ... `)
    try {
      await runSql(token, project.id, buildStatement(m, sql))
      console.log('applied')
    } catch (err) {
      console.log('FAILED')
      console.error(`\n${err.message}\n`)
      // Stop rather than carry on: a later migration almost always depends on
      // an earlier one, and a half-applied set is worse than a stopped one.
      console.error(`Stopped. ${m.file} was not applied, and nothing after it was attempted.`)
      return 1
    }
  }

  console.log('\nDone. Run `supabase migration list` from a machine with CLI access to confirm.')
  return 0
}

/* ── Offline checks ───────────────────────────────────────────────────────── */

function selfTest() {
  let pass = 0, fail = 0
  const eq = (name, got, want) => {
    const g = JSON.stringify(got), w = JSON.stringify(want)
    if (g === w) { pass++; console.log(`  ok    ${name}`) }
    else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`) }
  }
  const throws = (name, fn, pattern) => {
    try { fn(); fail++; console.log(`  FAIL  ${name} (did not throw)`) }
    catch (err) {
      if (pattern.test(err.message)) { pass++; console.log(`  ok    ${name}`) }
      else { fail++; console.log(`  FAIL  ${name}\n        threw: ${err.message}`) }
    }
  }

  console.log('\n── filename parsing')
  eq('timestamped name', parseMigrationName('20261014090000_free_tools.sql'),
     { version: '20261014090000', name: 'free_tools' })
  eq('underscores in the name', parseMigrationName('20261014110000_fix_notifications_rls.sql'),
     { version: '20261014110000', name: 'fix_notifications_rls' })
  eq('no timestamp', parseMigrationName('seed.sql'), null)
  eq('short timestamp', parseMigrationName('2026_thing.sql'), null)

  console.log('\n── the pending diff')
  const local = [
    { file: 'a.sql', version: '20260101000000', name: 'a' },
    { file: 'b.sql', version: '20260102000000', name: 'b' },
    { file: 'c.sql', version: '20260103000000', name: 'c' },
  ]
  eq('nothing applied', pendingMigrations(local, []).map(m => m.version),
     ['20260101000000', '20260102000000', '20260103000000'])
  eq('some applied', pendingMigrations(local, ['20260101000000']).map(m => m.version),
     ['20260102000000', '20260103000000'])
  eq('all applied', pendingMigrations(local, local.map(m => m.version)), [])
  eq('a remote version we do not have on disk is ignored',
     pendingMigrations(local, ['20260101000000', '20259999999999']).map(m => m.version),
     ['20260102000000', '20260103000000'])

  console.log('\n── the statement it builds')
  const m = { file: 'x.sql', version: '20260101000000', name: 'thing' }
  const built = buildStatement(m, "create table t (id int);\ncomment on table t is 'it''s fine';")
  eq('the SQL is included', built.includes('create table t (id int)'), true)
  eq('the ledger row is in the same statement', built.includes('supabase_migrations.schema_migrations'), true)
  eq('version is quoted', built.includes("'20260101000000'"), true)
  eq('a re-run would not duplicate the ledger row', built.includes('on conflict (version) do nothing'), true)
  eq("the file's own quotes survive", built.includes("it''s fine"), true)
  throws('a file with its own BEGIN is refused',
         () => buildStatement(m, 'begin;\ncreate table t (id int);\ncommit;'), /its own BEGIN/)
  throws('and START TRANSACTION too',
         () => buildStatement(m, 'start transaction;\nselect 1;'), /its own BEGIN or COMMIT/)
  throws('and a trailing COMMIT',
         () => buildStatement(m, 'create table t (id int);\ncommit;'), /its own BEGIN or COMMIT/)

  console.log('\n── a plpgsql body is not transaction control')
  // The first version of this check rejected eight real migrations, because
  // every trigger function in this repo is `begin ... end` inside $$.
  const PLPGSQL = `create or replace function touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;`
  eq('a $$ body does not trip the guard', hasTransactionControl(PLPGSQL), false)
  eq('a tagged body does not either', hasTransactionControl(
     'create function f() returns void language plpgsql as $fn$ begin perform 1; end $fn$;'), false)
  eq('"begin" inside a string does not either', hasTransactionControl(
     "insert into t (note) values ('begin; commit;');"), false)
  eq('a real one still does', hasTransactionControl('begin;\nselect 1;\ncommit;'), true)
  eq('and one after another statement', hasTransactionControl('select 1; begin transaction;'), true)
  eq('dollar quotes are stripped', stripDollarQuoted('a $$ hidden $$ b').replace(/\s+/g, ' '), 'a b')
  eq('an unterminated one is left alone', stripDollarQuoted('a $$ dangling').startsWith('a $$'), true)

  console.log('\n── the real migrations directory')
  const real = localMigrations()
  eq('every file parses', real.every(x => x.version && x.name), true)
  eq('versions are unique', new Set(real.map(x => x.version)).size, real.length)
  eq('sorted by version', real.map(x => x.version),
     [...real.map(x => x.version)].sort((a, b) => a.localeCompare(b)))
  let buildable = 0
  for (const x of real) {
    try { buildStatement(x, readFileSync(join(MIGRATIONS_DIR, x.file), 'utf8')); buildable++ }
    catch (err) { console.log(`  note  ${x.file} cannot be applied by this script: ${err.message.split('.')[0]}`) }
  }
  eq('every migration on disk is applicable by this script', buildable, real.length)

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} checks passed, ${fail} failed\n`)
  return fail === 0 ? 0 : 1
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(`\n${err.message}\n`)
    process.exit(1)
  })
