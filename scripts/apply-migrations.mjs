#!/usr/bin/env node
/**
 * Apply SQL migrations to the linked Supabase project over the Management API.
 *
 * The Supabase CLI pushes through port 5432 on the pooler, which times out on
 * input and output often enough to be a problem. This does the same job over
 * HTTPS: it reads supabase_migrations.schema_migrations to see what the project
 * already has, and runs the rest in filename order, each file in one
 * transaction, recording the version the same way the CLI does. So the two stay
 * interchangeable.
 *
 *   node scripts/apply-migrations.mjs                      plan only, changes nothing
 *   node scripts/apply-migrations.mjs --apply              apply every pending migration
 *   node scripts/apply-migrations.mjs --apply --only 20261014090000
 *   node scripts/apply-migrations.mjs --self-test          offline, no token needed
 *
 * Needs SUPABASE_ACCESS_TOKEN, plus the project ref from SUPABASE_PROJECT_REF,
 * NEXT_PUBLIC_SUPABASE_URL, supabase/.temp/project-ref, or --project-ref.
 * .env.local and .env are read if present.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const FILENAME = /^(\d{14})_([A-Za-z0-9_-]+)\.sql$/;
const MIGRATIONS_TABLE = 'supabase_migrations.schema_migrations';
// Overridable so the flow can be driven against a stub. Point it anywhere else
// and you are talking to that host, so leave it unset in normal use.
const API_BASE = (process.env.SUPABASE_API_URL || 'https://api.supabase.com').replace(/\/$/, '');

/* ------------------------------------------------------------------ args */

function parseArgs(argv) {
  const opts = { apply: false, only: null, selfTest: false, projectRef: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--self-test') opts.selfTest = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--only') opts.only = argv[++i] ?? null;
    else if (arg.startsWith('--only=')) opts.only = arg.slice('--only='.length);
    else if (arg === '--project-ref') opts.projectRef = argv[++i] ?? null;
    else if (arg.startsWith('--project-ref=')) opts.projectRef = arg.slice('--project-ref='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (opts.only !== null && !/^\d{14}$/.test(opts.only)) {
    throw new Error(`--only takes a 14-digit migration timestamp, got: ${opts.only}`);
  }
  return opts;
}

const USAGE = `Apply Supabase migrations over the Management API.

  node scripts/apply-migrations.mjs                   plan only, changes nothing
  node scripts/apply-migrations.mjs --apply           apply every pending migration
  node scripts/apply-migrations.mjs --apply --only <timestamp>
  node scripts/apply-migrations.mjs --self-test       offline, no token needed

Options
  --apply                 run the migrations instead of listing them
  --only <timestamp>      narrow to one migration, by its 14-digit prefix
  --project-ref <ref>     project ref, when the environment does not carry one
  --self-test             check this script against fixtures and the real
                          migrations directory, with no network and no token
`;

/* -------------------------------------------------------------- env, refs */

function loadEnvFiles(root = ROOT, files = ['.env.local', '.env']) {
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function parseEnv(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function refFromUrl(url) {
  if (!url) return null;
  const match = /^https?:\/\/([a-z0-9]{20})\.supabase\.(co|in|red)/i.exec(url.trim());
  return match ? match[1] : null;
}

function resolveProjectRef(explicit) {
  if (explicit) return explicit;
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const fromUrl =
    refFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) || refFromUrl(process.env.SUPABASE_URL);
  if (fromUrl) return fromUrl;
  const linked = join(ROOT, 'supabase', '.temp', 'project-ref');
  if (existsSync(linked)) {
    const value = readFileSync(linked, 'utf8').trim();
    if (value) return value;
  }
  return null;
}

/* ------------------------------------------------------- local migrations */

function readLocalMigrations(dir = MIGRATIONS_DIR) {
  if (!existsSync(dir)) throw new Error(`No migrations directory at ${dir}`);
  const migrations = [];
  const skipped = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.sql')) continue;
    const match = FILENAME.exec(file);
    if (!match) {
      skipped.push(file);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    migrations.push({ version: match[1], name: match[2], file, sql });
  }
  return { migrations, skipped };
}

/** Does this chunk hold anything the server would execute, or only comments? */
function hasCode(chunk) {
  return (
    chunk
      .replace(/\/\*[\s\S]*?(\*\/|$)/g, ' ')
      .replace(/--[^\n]*/g, ' ')
      .trim().length > 0
  );
}

/**
 * Split a migration into statements. Semicolons inside string literals,
 * dollar-quoted function bodies and comments are not statement boundaries,
 * which matters here because nine migrations define functions with $$ bodies.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    const rest = sql.slice(i);

    if (char === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (char === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (char === "'" || char === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === char && sql[j + 1] === char) j += 2;
        else if (sql[j] === char) break;
        else j += 1;
      }
      current += sql.slice(i, Math.min(j + 1, sql.length));
      i = j + 1;
      continue;
    }
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (char === ';') {
      if (hasCode(current)) statements.push(current.trim());
      current = '';
      i += 1;
      continue;
    }
    current += char;
    i += 1;
  }
  if (hasCode(current)) statements.push(current.trim());
  return statements;
}

function pendingMigrations(local, appliedVersions, only) {
  const applied = new Set(appliedVersions);
  let candidates = local.filter((m) => !applied.has(m.version));
  if (only) {
    const known = local.find((m) => m.version === only);
    if (!known) throw new Error(`No migration in supabase/migrations starts with ${only}`);
    candidates = candidates.filter((m) => m.version === only);
  }
  return candidates;
}

function unknownRemoteVersions(local, appliedVersions) {
  const known = new Set(local.map((m) => m.version));
  return appliedVersions.filter((v) => !known.has(v));
}

/* ------------------------------------------------------------- the server */

function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function recordVersionSql(migration) {
  const statements = splitStatements(migration.sql);
  const array = statements.length
    ? `array[${statements.map(quote).join(',')}]::text[]`
    : 'array[]::text[]';
  return `insert into ${MIGRATIONS_TABLE} (version, name, statements)
values (${quote(migration.version)}, ${quote(migration.name)}, ${array})
on conflict (version) do nothing`;
}

const ENSURE_TABLE_SQL = `create schema if not exists supabase_migrations;
create table if not exists ${MIGRATIONS_TABLE} (
  version text not null primary key,
  statements text[],
  name text
);
alter table ${MIGRATIONS_TABLE} add column if not exists statements text[];
alter table ${MIGRATIONS_TABLE} add column if not exists name text;`;

async function runQuery({ ref, token, sql }) {
  const url = `${API_BASE}/v1/projects/${ref}/database/query`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
  } catch (error) {
    const cause = error.cause?.message || error.message;
    throw new Error(
      `Could not reach ${new URL(API_BASE).host} (${cause}). Check the network, or whether this host is allowed from where you are running.`,
    );
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      (body && typeof body === 'object' && (body.message || body.error || body.msg)) ||
      (typeof body === 'string' && body) ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

async function fetchAppliedVersions(conn) {
  const rows = await runQuery({
    ...conn,
    sql: `select version from ${MIGRATIONS_TABLE} order by version`,
  });
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => String(row.version));
}

/** The project has never been pushed to, so neither the schema nor the table is there. */
function isMissingMigrationTable(message) {
  return /supabase_migrations|schema_migrations/.test(message) && /does not exist/i.test(message);
}

async function appliedVersionsOrEmpty(conn) {
  try {
    return { versions: await fetchAppliedVersions(conn), tracked: true };
  } catch (error) {
    if (isMissingMigrationTable(error.message)) return { versions: [], tracked: false };
    throw error;
  }
}

/* ----------------------------------------------------------------- output */

function describe(migration) {
  const statements = splitStatements(migration.sql).length;
  const lines = migration.sql.split('\n').length;
  return `${migration.file}  (${statements} statement${statements === 1 ? '' : 's'}, ${lines} lines)`;
}

async function plan(conn, opts) {
  const { migrations, skipped } = readLocalMigrations();
  const { versions, tracked } = await appliedVersionsOrEmpty(conn);
  const pending = pendingMigrations(migrations, versions, opts.only);
  const stray = unknownRemoteVersions(migrations, versions);

  console.log(`Project ${conn.ref}`);
  console.log(
    tracked
      ? `${migrations.length} local, ${versions.length} applied`
      : `${migrations.length} local, migration table not created yet`,
  );
  for (const file of skipped) console.log(`  skipped (name not YYYYMMDDHHMMSS_name.sql): ${file}`);
  for (const version of stray) console.log(`  on the project but not in git: ${version}`);

  if (!pending.length) {
    console.log(opts.only ? `\n${opts.only} is already applied.` : '\nNothing pending.');
    return 0;
  }
  console.log(`\nWould run ${pending.length}, in this order:`);
  for (const migration of pending) console.log(`  ${describe(migration)}`);
  console.log('\nPlan only. Nothing was changed. Add --apply to run it.');
  return 0;
}

async function apply(conn, opts) {
  const { migrations, skipped } = readLocalMigrations();
  const { versions, tracked } = await appliedVersionsOrEmpty(conn);
  const pending = pendingMigrations(migrations, versions, opts.only);

  console.log(`Project ${conn.ref}`);
  for (const file of skipped) console.log(`  skipped (name not YYYYMMDDHHMMSS_name.sql): ${file}`);
  if (!pending.length) {
    console.log(opts.only ? `${opts.only} is already applied. Nothing to do.` : 'Nothing pending.');
    return 0;
  }
  if (!tracked) {
    console.log('Creating supabase_migrations.schema_migrations.');
    await runQuery({ ...conn, sql: ENSURE_TABLE_SQL });
  }

  console.log(`Applying ${pending.length}.`);
  let done = 0;
  for (const migration of pending) {
    process.stdout.write(`  ${migration.file} ... `);
    const sql = `begin;\n${migration.sql.trim()}\n;\n${recordVersionSql(migration)};\ncommit;`;
    try {
      await runQuery({ ...conn, sql });
      done += 1;
      console.log('ok');
    } catch (error) {
      console.log('failed');
      console.error(`\n${migration.file} failed and was rolled back:\n  ${error.message}`);
      if (done) console.error(`\n${done} applied before it. The rest were not attempted.`);
      return 1;
    }
  }
  console.log(`\nApplied ${done}.`);
  return 0;
}

/* -------------------------------------------------------------- self test */

function selfTest() {
  const failures = [];
  const check = (name, fn) => {
    try {
      fn();
      console.log(`  ok    ${name}`);
    } catch (error) {
      failures.push(name);
      console.log(`  FAIL  ${name}: ${error.message}`);
    }
  };
  const eq = (actual, expected, label = '') => {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`${label}expected ${b}, got ${a}`);
  };

  console.log('Statement splitting');
  check('plain statements', () => {
    eq(splitStatements('select 1; select 2;'), ['select 1', 'select 2']);
  });
  check('trailing statement without a semicolon', () => {
    eq(splitStatements('select 1;\nselect 2'), ['select 1', 'select 2']);
  });
  check('semicolon inside a string literal', () => {
    eq(splitStatements("insert into t values ('a;b'); select 1;"), [
      "insert into t values ('a;b')",
      'select 1',
    ]);
  });
  check('doubled quote inside a string literal', () => {
    eq(splitStatements("select 'it''s; fine'; select 2;"), ["select 'it''s; fine'", 'select 2']);
  });
  check('semicolon inside a quoted identifier', () => {
    eq(splitStatements('select "od;d" from t; select 2;'), ['select "od;d" from t', 'select 2']);
  });
  check('dollar-quoted function body', () => {
    const sql = `create function f() returns int as $$
begin
  return 1;
end;
$$ language plpgsql;
select f();`;
    const out = splitStatements(sql);
    eq(out.length, 2, 'statement count: ');
    if (!out[0].includes('return 1;')) throw new Error('function body was cut at its semicolon');
  });
  check('tagged dollar quote', () => {
    const sql = `do $body$ begin perform 1; end $body$;\nselect 2;`;
    eq(splitStatements(sql).length, 2);
  });
  check('semicolon inside a line comment', () => {
    eq(splitStatements('select 1 -- ; not a boundary\n; select 2;').length, 2);
  });
  check('semicolon inside a block comment', () => {
    eq(splitStatements('/* ; */ select 1; select 2;').length, 2);
  });
  check('empty input', () => {
    eq(splitStatements('\n\n  \n'), []);
  });
  check('comments alone are not a statement', () => {
    eq(splitStatements('-- just a note\n/* and another */\n'), []);
  });

  console.log('Filenames');
  check('accepts the house format', () => {
    eq(FILENAME.test('20261014090000_add_table.sql'), true);
  });
  check('rejects a short timestamp', () => {
    eq(FILENAME.test('2026101409_add_table.sql'), false);
  });
  check('rejects a missing name', () => {
    eq(FILENAME.test('20261014090000.sql'), false);
  });

  console.log('Pending set');
  const fixture = [
    { version: '20260101000000', name: 'a', file: '20260101000000_a.sql', sql: 'select 1;' },
    { version: '20260202000000', name: 'b', file: '20260202000000_b.sql', sql: 'select 2;' },
    { version: '20260303000000', name: 'c', file: '20260303000000_c.sql', sql: 'select 3;' },
  ];
  check('pending excludes what the project has', () => {
    eq(
      pendingMigrations(fixture, ['20260101000000'], null).map((m) => m.version),
      ['20260202000000', '20260303000000'],
    );
  });
  check('--only narrows to one', () => {
    eq(
      pendingMigrations(fixture, [], '20260303000000').map((m) => m.version),
      ['20260303000000'],
    );
  });
  check('--only on an applied migration is empty, not an error', () => {
    eq(pendingMigrations(fixture, ['20260303000000'], '20260303000000'), []);
  });
  check('--only on an unknown timestamp throws', () => {
    try {
      pendingMigrations(fixture, [], '19990101000000');
    } catch {
      return;
    }
    throw new Error('it did not throw');
  });
  check('versions on the project but not in git are reported', () => {
    eq(unknownRemoteVersions(fixture, ['20260101000000', '20259999000000']), ['20259999000000']);
  });

  console.log('Project ref and env');
  check('ref from a project URL', () => {
    eq(refFromUrl('https://abcdefghijklmnopqrst.supabase.co'), 'abcdefghijklmnopqrst');
  });
  check('ref from a URL with a path', () => {
    eq(refFromUrl('https://abcdefghijklmnopqrst.supabase.co/rest/v1'), 'abcdefghijklmnopqrst');
  });
  check('no ref from a local URL', () => {
    eq(refFromUrl('http://127.0.0.1:54321'), null);
  });
  check('env parsing handles quotes, exports and comments', () => {
    eq(parseEnv('# c\nexport A="1"\nB=\'two\'\nC=three\n\nBAD\n'), {
      A: '1',
      B: 'two',
      C: 'three',
    });
  });

  console.log('Recorded SQL');
  check('quotes are escaped for the version row', () => {
    const sql = recordVersionSql({ version: '20260101000000', name: "o'name", sql: "select 'a';" });
    if (!sql.includes("'o''name'")) throw new Error('name was not escaped');
    if (!sql.includes("array['select ''a''']::text[]")) {
      throw new Error(`statements array was not escaped: ${sql}`);
    }
  });
  check('a migration with no statements records an empty array', () => {
    const sql = recordVersionSql({ version: '20260101000000', name: 'empty', sql: '-- nothing\n' });
    if (!sql.includes('array[]::text[]')) throw new Error(sql);
  });

  console.log('Missing migration table');
  check('a missing table reads as untracked', () => {
    eq(
      isMissingMigrationTable(
        'relation "supabase_migrations.schema_migrations" does not exist',
      ),
      true,
    );
  });
  check('a missing schema reads as untracked', () => {
    eq(isMissingMigrationTable('schema "supabase_migrations" does not exist'), true);
  });
  check('any other error does not', () => {
    eq(isMissingMigrationTable('column "brand_id" does not exist'), false);
    eq(isMissingMigrationTable('permission denied for schema supabase_migrations'), false);
  });

  console.log('The real supabase/migrations');
  const { migrations, skipped } = readLocalMigrations();
  check('every file is named YYYYMMDDHHMMSS_name.sql', () => {
    eq(skipped, []);
  });
  check('there is at least one migration', () => {
    if (!migrations.length) throw new Error('none found');
  });
  check('timestamps are unique', () => {
    const seen = new Map();
    const clashes = [];
    for (const migration of migrations) {
      if (seen.has(migration.version)) clashes.push(`${seen.get(migration.version)} / ${migration.file}`);
      else seen.set(migration.version, migration.file);
    }
    eq(clashes, []);
  });
  check('filename order matches timestamp order', () => {
    const versions = migrations.map((m) => m.version);
    eq(versions, [...versions].sort());
  });
  check('every migration holds at least one statement', () => {
    const empty = migrations.filter((m) => splitStatements(m.sql).length === 0).map((m) => m.file);
    eq(empty, []);
  });
  check('dollar-quoted bodies are closed', () => {
    const unbalanced = migrations
      .filter((m) => (m.sql.match(/\$\$/g) || []).length % 2 !== 0)
      .map((m) => m.file);
    eq(unbalanced, []);
  });
  check('no migration runs CREATE INDEX CONCURRENTLY, which cannot run in a transaction', () => {
    const bad = migrations.filter((m) => /concurrently/i.test(m.sql)).map((m) => m.file);
    eq(bad, []);
  });

  console.log(
    failures.length ? `\n${failures.length} failed:\n  ${failures.join('\n  ')}` : '\nAll checks passed.',
  );
  return failures.length ? 1 : 0;
}

/* ------------------------------------------------------------------- main */

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(`\n${USAGE}`);
    return 1;
  }
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (opts.selfTest) return selfTest();

  loadEnvFiles();
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = resolveProjectRef(opts.projectRef);
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN is not set. Run --self-test for the offline checks.');
    return 1;
  }
  if (!ref) {
    console.error(
      'No project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL, or pass --project-ref.',
    );
    return 1;
  }
  const conn = { ref, token };
  try {
    return opts.apply ? await apply(conn, opts) : await plan(conn, opts);
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

process.exitCode = await main();
