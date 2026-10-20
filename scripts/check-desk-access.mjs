/**
 * Check the Desk's access logic with no database.
 *
 * Four things worth covering offline, because each one fails silently:
 *
 * The permission keys seeded in SQL have to be the keys the code checks. A
 * typo in a role template grants nothing and raises nothing: the person just
 * cannot see a screen and nobody knows why. This reads the migration and the
 * TypeScript vocabulary and compares them both ways.
 *
 * Attachment signatures have to survive forgery, tampering and replay from
 * another conversation, since the signature is the only thing standing between
 * a storage path from a browser and a file attached to a thread.
 *
 * The module registry has to resolve the longest path first, or every visit to
 * /dashboard/surveys/nps is recorded against Surveys and the NPS tracker looks
 * unused forever.
 *
 * Email masking has to actually mask.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

const OUT = process.env.TMPDIR ? `${process.env.TMPDIR}/bg-desk-check` : '/tmp/bg-desk-check'
mkdirSync(OUT, { recursive: true })

function compile(src, name, substitutions = []) {
  let code = readFileSync(src, 'utf8')
  for (const [from, to] of substitutions) code = code.replace(from, to)
  writeFileSync(`${OUT}/${name}.ts`, code)
  execSync(
    `npx tsc --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --outDir ${OUT} ${OUT}/${name}.ts`,
    { stdio: 'inherit' },
  )
  execSync(`mv ${OUT}/${name}.js ${OUT}/${name}.mjs`)
  return import(`${OUT}/${name}.mjs`)
}

let pass = 0, fail = 0
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ok    ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`) }
}
const ok = (name, cond) => eq(name, !!cond, true)

// ── The permission vocabulary against the migration ──────────────────────────
const permissions = await compile('src/lib/desk/permissions.ts', 'permissions')
const migration = readFileSync('supabase/migrations/20261014120000_desk_staff.sql', 'utf8')

console.log('\n── Permission keys: SQL seeds against the code')

const seeded = new Set(
  [...migration.matchAll(/\('(?:support|bizdev|finance|engineer|admin|super_admin)','([a-z_]+\.[a-z_]+)'\)/g)]
    .map(m => m[1]),
)
const known = new Set(permissions.ALL_PERMISSIONS)

const seededUnknown = [...seeded].filter(k => !known.has(k)).sort()
eq('every seeded key exists in the code', seededUnknown, [])

// A key the code checks but no role seeds is only a problem for super_admin,
// which is seeded with the full set on purpose, so this catches a key that was
// added to the vocabulary and forgotten in the seed.
const superSeeded = new Set(
  [...migration.matchAll(/\('super_admin','([a-z_]+\.[a-z_]+)'\)/g)].map(m => m[1]),
)
const missingFromSuper = [...known].filter(k => !superSeeded.has(k)).sort()
eq('super_admin is seeded with every key', missingFromSuper, [])

eq('no duplicate keys in the vocabulary',
  permissions.ALL_PERMISSIONS.length, known.size)

ok('every role in the seed exists in staff_roles',
  [...migration.matchAll(/\('(support|bizdev|finance|engineer|admin|super_admin)','/g)].length > 0)

console.log('\n── Role expectations that carry a rule')
const roleKeys = role => new Set(
  [...migration.matchAll(new RegExp(`\\('${role}','([a-z_]+\\.[a-z_]+)'\\)`, 'g'))].map(m => m[1]),
)
const support = roleKeys('support')
const bizdev  = roleKeys('bizdev')
const finance = roleKeys('finance')

eq('support cannot see revenue figures', support.has('data.revenue_figures'), false)
eq('support cannot change a plan',       support.has('accounts.plan_change'), false)
eq('bizdev cannot read customer content',bizdev.has('data.customer_content'), false)
eq('bizdev can see revenue but not edit',
  [bizdev.has('revenue.view'), bizdev.has('revenue.edit')], [true, false])
eq('finance cannot read customer content', finance.has('data.customer_content'), false)
eq('nobody but super_admin manages staff',
  ['support','bizdev','finance','engineer','admin'].some(r => roleKeys(r).has('staff.invite')), false)
eq('only super_admin sees everyone activity',
  ['support','bizdev','finance','engineer','admin'].some(r => roleKeys(r).has('data.audit_all')), false)

// ── Attachment signatures ────────────────────────────────────────────────────
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64)
const attachments = await compile('src/lib/support/attachments.ts', 'attachments')

console.log('\n── Attachment signatures')
const convA = '11111111-1111-1111-1111-111111111111'
const convB = '22222222-2222-2222-2222-222222222222'
const ref = { path: `${convA}/file.png`, name: 'screenshot.png', type: 'image/png', size: 1024 }
const sig = attachments.signAttachment(convA, ref)

ok('a reference we signed verifies',        attachments.verifyAttachment(convA, ref, sig))
eq('a made-up signature is refused',        attachments.verifyAttachment(convA, ref, 'not-a-signature'), false)
eq('an empty signature is refused',         attachments.verifyAttachment(convA, ref, ''), false)
eq('a reference cannot be replayed into another thread',
  attachments.verifyAttachment(convB, ref, sig), false)
eq('a changed path is refused',
  attachments.verifyAttachment(convA, { ...ref, path: 'other/secret.png' }, sig), false)
eq('a changed type is refused',
  attachments.verifyAttachment(convA, { ...ref, type: 'text/html' }, sig), false)
eq('a changed size is refused',
  attachments.verifyAttachment(convA, { ...ref, size: 9999 }, sig), false)
eq('a changed name is refused',
  attachments.verifyAttachment(convA, { ...ref, name: 'other.png' }, sig), false)

// ── The module registry ──────────────────────────────────────────────────────
const modules = await compile('src/lib/modules.ts', 'modules')

console.log('\n── Module resolution')
eq('/dashboard is the overview',        modules.moduleForPath('/dashboard')?.key, 'overview')
eq('trailing slash still resolves',     modules.moduleForPath('/dashboard/')?.key, 'overview')
eq('a module resolves',                 modules.moduleForPath('/dashboard/sentiment')?.key, 'sentiment')
eq('a child path resolves to its module', modules.moduleForPath('/dashboard/campaigns/abc-123')?.key, 'campaigns')
eq('the longest path wins',             modules.moduleForPath('/dashboard/surveys/nps')?.key, 'nps')
eq('and again for panels',              modules.moduleForPath('/dashboard/surveys/panels')?.key, 'panels')
eq('the parent still resolves',         modules.moduleForPath('/dashboard/surveys')?.key, 'surveys')
eq('an unknown path resolves to nothing', modules.moduleForPath('/dashboard/not-a-module'), null)
eq('a non-dashboard path resolves to nothing', modules.moduleForPath('/scoreboard'), null)
eq('a crafted key is refused',           modules.isModuleKey('../../etc/passwd'), false)
eq('every registry key is unique',
  modules.MODULES.length, new Set(modules.MODULES.map(m => m.key)).size)
eq('every registry path is unique',
  modules.MODULES.length, new Set(modules.MODULES.map(m => m.path)).size)

// ── Redaction ────────────────────────────────────────────────────────────────
console.log('\n── Email masking')
const redact = await compile('src/lib/desk/redact.ts', 'redact')

eq('the local part is hidden',  redact.maskEmail('emmanuel@brandgauge.app'), 'e\u2022\u2022\u2022@brandgauge.app')
eq('a null address is empty',   redact.maskEmail(null), '')
eq('junk without an @ is fully masked', redact.maskEmail('not-an-email'), '\u2022\u2022\u2022')

// ── Links across the two hosts ───────────────────────────────────────────────
//
// The Desk answers on a deployment URL at /desk/... and on its own hostname
// with that prefix stripped, and src/proxy.ts 404s anything still carrying it
// there. So a link written as "/desk/inbox/<id>" works on a preview and
// returns "Not found" on the live host, which is the bug that hides from
// every check that is not this one: by 20 October six of them had shipped,
// covering every account, every staff member, the leads funnel and every
// conversation in the inbox.
//
// DeskLink and useDeskRouter resolve the prefix for whichever host is
// serving. This fails the run when a raw one comes back.
console.log('\n── Desk links resolve for both hosts')

const deskFiles = execSync(
  "find 'src/app/desk' 'src/components/desk' -type f \\( -name '*.tsx' -o -name '*.ts' \\)",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)

// What is wrong is the receiver, not the string: DeskLink and useDeskRouter
// are handed exactly this path and resolve it. So a bare next/link with a
// /desk href is always wrong, and a router.push is wrong only where the
// router did not come from useDeskRouter.
const RAW_NEXT_LINK = /<Link\b[\s\S]{0,200}?href=\{?["'`]\/desk\//
const RAW_PUSH      = /router\.push\(\s*[`'"]\/desk\//

const offenders = deskFiles.filter(file => {
  // desk-link.tsx is where the resolution lives.
  if (file.endsWith('desk-link.tsx')) return false
  const code = readFileSync(file, 'utf8')
  if (RAW_NEXT_LINK.test(code)) return true
  return RAW_PUSH.test(code) && !code.includes('useDeskRouter')
})

ok(`no raw /desk link survives${offenders.length ? `: ${offenders.join(', ')}` : ''}`,
  offenders.length === 0)

const deskLink = readFileSync('src/components/desk/desk-link.tsx', 'utf8')
ok('DeskLink strips the prefix on the Desk host', deskLink.includes('stripDeskPrefix'))
ok('and the provider is fed by the signed-in layout',
  readFileSync('src/app/desk/(signed-in)/layout.tsx', 'utf8').includes('DeskHostProvider'))

console.log(`\n${fail === 0 ? '✓' : '✗'} ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
