#!/usr/bin/env node
/**
 * Run the demo generators and check every row they actually produce.
 *
 * validate-seeds.mjs reads the source. That works for literals and stops at
 * anything computed, which is most of the shared generators. This runs them
 * against a fake client that records each insert, then checks every key of
 * every row against the schema parsed from the migrations. No guessing, and
 * no database.
 *
 *   node scripts/check-demo-rows.mjs
 */
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()

/* ── schema ──────────────────────────────────────────────────────────────── */
function matchBracket(s, start) {
  const open = s[start]
  const close = open === '{' ? '}' : open === '[' ? ']' : ')'
  let depth = 0, i = start, str = null
  while (i < s.length) {
    const c = s[i]
    if (str) { if (c === '\\') { i += 2; continue } if (c === str) str = null; i++; continue }
    if (c === '"' || c === "'" || c === '`') { str = c; i++; continue }
    if (c === open) depth++
    else if (c === close) { depth--; if (depth === 0) return i + 1 }
    i++
  }
  return -1
}
function walk(dir, out = []) {
  let e; try { e = readdirSync(dir) } catch { return out }
  for (const n of e) { const p = join(dir, n); statSync(p).isDirectory() ? walk(p, out) : out.push(p) }
  return out
}

const schema = new Map()
const add = (t, cols) => { if (!schema.has(t)) schema.set(t, new Set()); for (const c of cols) schema.get(t).add(c) }
let sql = walk(join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
  .map(f => readFileSync(f, 'utf8')).join('\n').replace(/--[^\n]*/g, '')

const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(/gi
let m
while ((m = createRe.exec(sql))) {
  const open = sql.indexOf('(', m.index + m[0].length - 1)
  const end = matchBracket(sql, open)
  if (end < 0) continue
  const cols = []
  for (const raw of sql.slice(open + 1, end - 1).split('\n')) {
    const s = raw.trim()
    if (!s || /^(primary\s+key|unique|foreign\s+key|constraint|check|exclude|like)\b/i.test(s)) continue
    const cm = /^([a-z0-9_]+)\s/i.exec(s)
    if (cm) cols.push(cm[1])
  }
  add(m[1], cols)
}
const alterRe = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s+([\s\S]*?);/gi
while ((m = alterRe.exec(sql))) {
  const addRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi
  let a; while ((a = addRe.exec(m[2]))) add(m[1], [a[1]])
}

/* ── compile the demo lib to plain JS ────────────────────────────────────── */
const out = mkdtempSync(join(tmpdir(), 'demolib-'))
try {
  // Only module-pack's own graph. Files that import through the '@/' alias
  // (bhi-series) cannot be compiled standalone; the project type-check covers
  // those, and validate-seeds checks their row literals.
  const GRAPH = ['module-pack.ts', 'modules.ts', 'digital-performance.ts', 'seasonality.ts']
    .map(f => join(ROOT, 'src/lib/demo', f))
  execFileSync('npx', ['tsc',
    ...GRAPH,
    '--outDir', out, '--module', 'nodenext', '--moduleResolution', 'nodenext',
    '--target', 'es2022', '--skipLibCheck', '--types', 'node',
  ], { stdio: 'pipe' })
} catch (e) {
  const msg = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
  if (!/error TS/.test(msg)) throw e
  console.error(msg.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
}
// emitted files land under the source tree shape; find module-pack
const emitted = walk(out).filter(f => f.endsWith('module-pack.js'))[0]
if (!emitted) { console.error('module-pack.js not emitted'); process.exit(1) }

/* ── fake client that records inserts ────────────────────────────────────── */
const captured = []
function fakeSb() {
  return {
    from(table) {
      const builder = {
        insert(rows) {
          captured.push({ table, rows: Array.isArray(rows) ? rows : [rows] })
          const res = { data: { id: '00000000-0000-4000-8000-0000000000aa' }, error: null }
          const thenable = {
            select: () => ({ single: () => Promise.resolve(res) }),
            then: (f, r) => Promise.resolve(res).then(f, r),
          }
          return thenable
        },
      }
      return builder
    },
  }
}

const { seedModulePack } = await import(pathToFileURL(emitted).href)

const CONFIGS = [
  { name: 'Jara Foods (fmcg)',      brandType: 'fmcg' },
  { name: 'PocketPay (fintech)',    brandType: 'fintech' },
  { name: 'Bridger CRM (b2b_saas)', brandType: 'b2b_saas' },
  { name: 'Pinnacle Media (agency)',brandType: 'agency' },
]

for (const cfg of CONFIGS) {
  await seedModulePack(fakeSb(), {
    brandId: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
    brandName: cfg.name, brandType: cfg.brandType,
    competitors: ['Comp A', 'Comp B', 'Comp C'],
    campaignIds: ['33333333-3333-4333-8333-333333333333'],
    aiQuestions: ['q1', 'q2', 'q3', 'q4', 'q5'],
    aiMentionFrom: 0.3, aiMentionTo: 0.6,
    mmmChannels: { meta: [0.5, 1_000_000], radio: [0.5, 500_000] },
    mmmOutcomes: 1000, mmmSummary: 'summary', mmmRecommendations: ['a'],
    base: new Date('2026-09-19T00:00:00Z'),
  })
}

rmSync(out, { recursive: true, force: true })

/* ── check every captured row ────────────────────────────────────────────── */
const bad = []
const perTable = new Map()
for (const { table, rows } of captured) {
  perTable.set(table, (perTable.get(table) ?? 0) + rows.length)
  if (!schema.has(table)) { bad.push(`table '${table}' does not exist`); continue }
  const cols = schema.get(table)
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue
    for (const k of Object.keys(row)) {
      if (!cols.has(k)) bad.push(`${table}.${k}`)
    }
  }
}

console.log(`ran seedModulePack for ${CONFIGS.length} verticals`)
console.log(`captured ${captured.length} inserts, ${[...perTable.values()].reduce((a, b) => a + b, 0)} rows\n`)
for (const [t, n] of [...perTable].sort()) console.log(`  ${String(n).padStart(5)}  ${t}`)

const uniq = [...new Set(bad)]
if (uniq.length) {
  console.log(`\nBAD KEYS (${uniq.length})`)
  for (const b of uniq) console.log('  ' + b)
  process.exit(1)
}
console.log('\nPASS: every generated row matches the schema')
