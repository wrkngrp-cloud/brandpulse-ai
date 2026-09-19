#!/usr/bin/env node
/**
 * Validate every demo-seed insert against the real schema, with no database.
 *
 * Postgres rejects the WHOLE insert when a column does not exist, so a single
 * wrong key silently removes a row and everything chained to it. The seeds
 * mostly discard the error (`const { data } = await sb.from(...)`), so a broken
 * seed still reports success. This script is the check that catches that.
 *
 * Reads:  supabase/migrations/*.sql   -> tables and columns
 * Checks: src/app/api/demo/**, src/app/api/admin/seed-demo/**, src/lib/demo/**
 *
 * Usage: node scripts/validate-seeds.mjs        (exit 1 on any finding)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

/* ── helpers ─────────────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/** Blank out // and /* *​/ comments, preserving offsets and string literals. */
function stripComments(s) {
  let out = '', i = 0, str = null
  while (i < s.length) {
    const c = s[i]
    if (str) {
      out += c
      if (c === '\\') { out += s[i + 1] ?? ''; i += 2; continue }
      if (c === str) str = null
      i++; continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; out += c; i++; continue }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') { out += ' '; i++ } continue }
    if (c === '/' && s[i + 1] === '*') {
      let j = s.indexOf('*/', i + 2); j = j < 0 ? s.length : j + 2
      for (let k = i; k < j; k++) out += s[k] === '\n' ? '\n' : ' '
      i = j; continue
    }
    out += c; i++
  }
  return out
}

/** index just past the bracket matching the one at `start` */
function matchBracket(s, start) {
  const open = s[start]
  const close = open === '{' ? '}' : open === '[' ? ']' : ')'
  let depth = 0, i = start, str = null
  while (i < s.length) {
    const c = s[i]
    if (str) {
      if (c === '\\') { i += 2; continue }
      if (c === str) str = null
      i++; continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; i++; continue }
    if (c === open) depth++
    else if (c === close) { depth--; if (depth === 0) return i + 1 }
    i++
  }
  return -1
}

/** top-level `key:` names inside an object-literal body */
function topLevelKeys(body) {
  const keys = []
  let depth = 0, i = 0, str = null, expectKey = true
  while (i < body.length) {
    const c = body[i]
    if (str) {
      if (c === '\\') { i += 2; continue }
      if (c === str) str = null
      i++; continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; i++; continue }
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue }
    if (c === ')' || c === ']' || c === '}') { depth--; i++; continue }
    if (depth === 0) {
      if (expectKey) {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(body.slice(i))
        if (m) { keys.push(m[1]); i += m[0].length; expectKey = false; continue }
      }
      if (c === ',') expectKey = true
    }
    i++
  }
  return keys
}

/**
 * Object-literal bodies returned by an arrow inside a .map(...) argument list,
 * i.e. the `{ ... }` of `x => ({ ... })`. These are rows too, and missing them
 * hid real column errors in the seeds.
 */
function arrowObjectBodies(argSrc) {
  const bodies = []
  const arrowRe = /=>\s*\(\s*\{/g
  let m
  while ((m = arrowRe.exec(argSrc))) {
    const brace = argSrc.indexOf('{', m.index + m[0].length - 1)
    const end = matchBracket(argSrc, brace)
    if (end > 0) bodies.push(argSrc.slice(brace + 1, end - 1))
  }
  return bodies
}



/** The initializer expression starting at `start`, to the end of that statement. */
function initializerSource(src, start) {
  let i = start, depth = 0, str = null
  while (i < src.length) {
    const c = src[i]
    if (str) {
      if (c === '\\') { i += 2; continue }
      if (c === str) str = null
      i++; continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; i++; continue }
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue }
    if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break
      depth--; i++; continue
    }
    if (depth === 0 && (c === ';' || c === '\n')) {
      // a newline ends it only when the expression is already balanced
      if (c === ';') break
      const rest = src.slice(i + 1, i + 40).trimStart()
      if (/^(const|let|var|await|return|for|if|\}|\/\/)/.test(rest)) break
    }
    i++
  }
  return src.slice(start, i)
}

/**
 * Row literals assigned to `v` anywhere in the file: array literals, pushes,
 * and arrow bodies from .map/.flatMap/Array.from. Used when the simple
 * declaration forms do not match.
 */
function scanRowLiterals(src, v, _rel) {
  const out = []
  const declRe = new RegExp(`(?:const|let|var)\\s+${v}\\b[^=\\n]*=\\s*`, 'g')
  let d
  while ((d = declRe.exec(src))) {
    // Bound the scan to this initializer only. A fixed character window bleeds
    // into the next statement and attributes its rows to the wrong table,
    // which is exactly how tv_channels was reported with tv_schedules columns.
    const start = d.index + d[0].length
    const init = initializerSource(src, start)
    if (!init) continue
    for (const b of arrowObjectBodies(init)) out.push(b)
    if (init.trimStart().startsWith('[')) {
      const ob = src.indexOf('[', start)
      const end = matchBracket(src, ob)
      if (end > 0) for (const o of objectsInArray(src.slice(ob + 1, end - 1))) out.push(o)
    }
  }
  const pushRe = new RegExp(`\\b${v}\\.push\\(`, 'g')
  let p
  while ((p = pushRe.exec(src))) {
    let j = p.index + p[0].length
    while (j < src.length && /\s/.test(src[j])) j++
    if (src[j] === '{') {
      const end = matchBracket(src, j)
      if (end > 0) out.push(src.slice(j + 1, end - 1))
    }
  }
  return out
}

/** every top-level object literal inside an array-literal body */
function objectsInArray(body) {
  const objs = []
  let depth = 0, i = 0, str = null
  while (i < body.length) {
    const c = body[i]
    if (str) {
      if (c === '\\') { i += 2; continue }
      if (c === str) str = null
      i++; continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; i++; continue }
    if (c === '{' && depth === 0) {
      const end = matchBracket(body, i)
      if (end < 0) break
      objs.push(body.slice(i + 1, end - 1)); i = end; continue
    }
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    i++
  }
  return objs
}

/* ── 1. schema from migrations ───────────────────────────────────────────── */

const schema = new Map()
const add = (t, cols) => {
  if (!schema.has(t)) schema.set(t, new Set())
  for (const c of cols) schema.get(t).add(c)
}

const migDir = join(ROOT, 'supabase/migrations')
const migFiles = walk(migDir).filter(f => f.endsWith('.sql')).sort()
let sql = migFiles.map(f => readFileSync(f, 'utf8')).join('\n')
sql = sql.replace(/--[^\n]*/g, '')

const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(/gi
let m
while ((m = createRe.exec(sql))) {
  const open = sql.indexOf('(', m.index + m[0].length - 1)
  const end = matchBracket(sql, open)
  if (end < 0) continue
  const cols = []
  for (const raw of sql.slice(open + 1, end - 1).split('\n')) {
    const s = raw.trim()
    if (!s) continue
    if (/^(primary\s+key|unique|foreign\s+key|constraint|check|exclude|like)\b/i.test(s)) continue
    const cm = /^([a-z0-9_]+)\s/i.exec(s)
    if (cm) cols.push(cm[1])
  }
  add(m[1], cols)
}
// ALTER TABLE t ADD COLUMN a ..., ADD COLUMN b ...;  (one or many per statement)
const alterRe = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s+([\s\S]*?);/gi
while ((m = alterRe.exec(sql))) {
  const table = m[1]
  const addRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi
  let a
  while ((a = addRe.exec(m[2]))) add(table, [a[1]])
}

/* ── 2. scan the seed routes ─────────────────────────────────────────────── */

const seedFiles = [
  ...walk(join(ROOT, 'src/app/api/demo')),
  ...walk(join(ROOT, 'src/app/api/admin/seed-demo')),
  // the shared generators write rows too, so they need the same check
  ...walk(join(ROOT, 'src/lib/demo')),
].filter(f => f.endsWith('.ts')).sort()

const badTables = [], badCols = [], unresolved = []

for (const file of seedFiles) {
  const raw = readFileSync(file, 'utf8')
  const src = stripComments(raw)
  const rel = relative(ROOT, file)
  const lineOf = idx => src.slice(0, idx).split('\n').length

  const callRe = /\.from\(\s*'([a-z0-9_]+)'\s*\)\s*\.\s*(insert|upsert)\s*\(/g
  let c
  while ((c = callRe.exec(src))) {
    const table = c[1], line = lineOf(c.index)
    if (!schema.has(table)) { badTables.push({ rel, line, table }); continue }
    const cols = schema.get(table)
    const check = body => {
      for (const k of topLevelKeys(body)) {
        if (!cols.has(k)) badCols.push({ rel, line, table, key: k })
      }
    }

    let i = c.index + c[0].length
    while (i < src.length && /\s/.test(src[i])) i++

    if (src[i] === '{') {
      const end = matchBracket(src, i)
      if (end > 0) check(src.slice(i + 1, end - 1))
    } else if (src[i] === '[') {
      const end = matchBracket(src, i)
      if (end > 0) for (const o of objectsInArray(src.slice(i + 1, end - 1))) check(o)
    } else {
      // .insert(xs.map(x => ({ ... }))) — the arrow returns the row literal
      const inlineMap = /^[A-Za-z_$][A-Za-z0-9_$.\[\]]*\s*\.\s*map\s*\(/.exec(src.slice(i))
      if (inlineMap) {
        const open = src.indexOf('(', i + inlineMap[0].length - 1)
        const end = matchBracket(src, open)
        if (end > 0) {
          for (const body of arrowObjectBodies(src.slice(open + 1, end - 1))) check(body)
          continue
        }
      }

      // .insert(someVariable): resolve the variable in-file
      const vm = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/.exec(src.slice(i))
      if (!vm) {
        // Any other expression: Array.from(...), a chained .map, a spread.
        // Take the whole argument list and check every `=> ({ ... })` in it.
        const argEnd = matchBracket(src, i - 1 >= 0 && src[i - 1] === '(' ? i - 1 : src.lastIndexOf('(', i))
        if (argEnd > 0) {
          const arg = src.slice(src.lastIndexOf('(', i) + 1, argEnd - 1)
          const bodies = arrowObjectBodies(arg)
          if (bodies.length) { for (const b of bodies) check(b); continue }
        }
        unresolved.push({ rel, line, table, what: 'expression' }); continue
      }
      const v = vm[1]
      let found = false
      // const v = xs.map(x => ({ ... }))
      const mapDeclRe = new RegExp(`(?:const|let|var)\\s+${v}\\b[^=]*=\\s*[A-Za-z_$][A-Za-z0-9_$.\\[\\]]*\\s*\\.\\s*map\\s*\\(`, 'g')
      let md
      while ((md = mapDeclRe.exec(src))) {
        const open = src.lastIndexOf('(', md.index + md[0].length - 1)
        const end = matchBracket(src, open)
        if (end > 0) {
          for (const body of arrowObjectBodies(src.slice(open + 1, end - 1))) { check(body); found = true }
        }
      }
      // const v = [ ... ]
      const declRe = new RegExp(`(?:const|let|var)\\s+${v}\\b[^=]*=\\s*\\[`, 'g')
      let d
      while ((d = declRe.exec(src))) {
        const ob = src.indexOf('[', d.index + d[0].length - 1)
        const end = matchBracket(src, ob)
        if (end > 0) { for (const o of objectsInArray(src.slice(ob + 1, end - 1))) check(o); found = true }
      }
      // v.push({ ... })
      const pushRe = new RegExp(`\\b${v}\\.push\\(`, 'g')
      let p
      while ((p = pushRe.exec(src))) {
        let j = p.index + p[0].length
        while (j < src.length && /\s/.test(src[j])) j++
        if (src[j] === '{') {
          const end = matchBracket(src, j)
          if (end > 0) { check(src.slice(j + 1, end - 1)); found = true }
        }
      }
      if (!found) {
        // last resort: scan the whole enclosing statement for row literals
        const stmtEnd = src.indexOf('\n', c.index)
        const scanned = scanRowLiterals(src, v, rel)
        if (scanned.length) { for (const b of scanned) check(b); found = true }
        void stmtEnd
      }
      if (!found) unresolved.push({ rel, line, table, what: `variable '${v}'` })
    }
  }
}

/* ── 3. report ───────────────────────────────────────────────────────────── */

const uniq = (arr, key) => {
  const seen = new Set(), out = []
  for (const x of arr) { const k = key(x); if (!seen.has(k)) { seen.add(k); out.push(x) } }
  return out
}

console.log(`schema: ${schema.size} tables from ${migFiles.length} migrations`)
console.log(`seeds:  ${seedFiles.length} route files\n`)

const t = uniq(badTables, x => `${x.rel}|${x.table}`)
console.log(`UNKNOWN TABLES (${t.length})`)
for (const x of t) console.log(`  ${x.rel}:${x.line}  ${x.table}`)

const cc = uniq(badCols, x => `${x.rel}|${x.table}|${x.key}`)
console.log(`\nUNKNOWN COLUMNS (${cc.length})`)
let lastT = ''
for (const x of cc.sort((a, b) => (a.rel + a.table).localeCompare(b.rel + b.table))) {
  const tag = `${x.rel} -> ${x.table}`
  if (tag !== lastT) { console.log(`  ${tag}`); lastT = tag }
  console.log(`      .${x.key}   (line ${x.line})`)
}

const u = uniq(unresolved, x => `${x.rel}|${x.table}|${x.what}`)
console.log(`\nNOT STATICALLY RESOLVED (${u.length})`)
for (const x of u) console.log(`  ${x.rel}:${x.line}  ${x.table}  <- ${x.what}`)

const fail = t.length + cc.length
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${t.length} unknown tables, ${cc.length} unknown columns`)
process.exit(fail === 0 ? 0 : 1)
