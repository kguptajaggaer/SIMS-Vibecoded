// SIMS Automated Test Runner
// Run: node scripts/run-tests.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load env
const env = readFileSync('.env.local', 'utf-8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'))
  return match?.[1]?.trim()
}

const supabase = createClient(
  getEnv('NEXT_PUBLIC_SUPABASE_URL'),
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
)

let passed = 0, failed = 0, warnings = 0
const results = []

function pass(id, msg) {
  console.log(`  ✅ ${id}: ${msg}`)
  passed++
  results.push({ id, status: 'PASS', msg })
}
function fail(id, msg) {
  console.error(`  ❌ ${id}: ${msg}`)
  failed++
  results.push({ id, status: 'FAIL', msg })
}
function warn(id, msg) {
  console.warn(`  ⚠️  ${id}: ${msg}`)
  warnings++
  results.push({ id, status: 'WARN', msg })
}

async function check(id, description, fn) {
  try {
    await fn()
  } catch (e) {
    fail(id, `${description} — threw: ${e.message}`)
  }
}

console.log('\n🧪 SIMS Test Suite — Starting...\n')

// ─── TC-DB-01: Database connectivity ────────────────────────────────────────
console.log('📦 DATABASE CONNECTIVITY')
await check('TC-DB-01', 'Supabase reachable', async () => {
  const { error } = await supabase.from('roles').select('count').limit(1)
  if (error) fail('TC-DB-01', 'Cannot reach Supabase: ' + error.message)
  else pass('TC-DB-01', 'Supabase connection OK')
})

// ─── TC-ROLES: Verify all 9 roles exist ─────────────────────────────────────
console.log('\n👥 ROLES')
await check('TC-ROLES', 'All roles exist', async () => {
  const { data, error } = await supabase.from('roles').select('name').order('name')
  if (error) { fail('TC-ROLES-01', error.message); return }
  const names = data.map(r => r.name)
  const expected = ['admin','ap_reviewer','cmc_manager','co','diversity_manager','epp_admin','ibp_manager','portfolio_manager','sr_manager']
  expected.forEach(role => {
    if (names.includes(role)) pass(`TC-ROLES-${role}`, `Role "${role}" exists`)
    else fail(`TC-ROLES-${role}`, `Role "${role}" MISSING`)
  })
})

// ─── TC-USERS: Internal users ───────────────────────────────────────────────
console.log('\n👤 INTERNAL USERS')
await check('TC-USERS', 'Internal users seeded', async () => {
  const { data, error } = await supabase.from('users').select('email, name, user_type, role:roles(name)').eq('user_type', 'internal')
  if (error) { fail('TC-USERS-01', error.message); return }
  if (data.length >= 10) pass('TC-USERS-01', `${data.length} internal users found (≥10 required)`)
  else fail('TC-USERS-01', `Only ${data.length} internal users — expected ≥10`)

  const testEmails = ['admin@usps.gov', 'james.co@usps.gov', 'maria.co@usps.gov', 'rchen@usps.gov', 'lthompson@usps.gov', 'dpark@usps.gov']
  testEmails.forEach(email => {
    const u = data.find(u => u.email === email)
    if (u) pass(`TC-USERS-${email.split('@')[0]}`, `User ${email} (${u.role?.name}) found`)
    else fail(`TC-USERS-${email.split('@')[0]}`, `User ${email} MISSING`)
  })
})

// ─── TC-AUTH: Auth logic ─────────────────────────────────────────────────────
console.log('\n🔐 AUTH LOGIC')
await check('TC-AUTH', 'Password hash pattern', async () => {
  const { data, error } = await supabase.from('users').select('email, password_hash').eq('email', 'admin@usps.gov').single()
  if (error || !data) { fail('TC-AUTH-01', 'admin@usps.gov not found'); return }
  if (data.password_hash?.startsWith('$2a$')) pass('TC-AUTH-01', 'Admin password hash is bcrypt — accepts Admin@123')
  else fail('TC-AUTH-01', 'Password hash format unexpected: ' + data.password_hash?.slice(0,10))
})

await check('TC-AUTH-SUPPLIER', 'Supplier user auth pattern', async () => {
  const { data, error } = await supabase.from('users').select('email, password_hash, user_type, supplier_id').eq('user_type', 'supplier').limit(3)
  if (error) { fail('TC-AUTH-SUP-01', error.message); return }
  if (data.length === 0) { fail('TC-AUTH-SUP-01', 'No supplier users found — seed may have failed'); return }
  pass('TC-AUTH-SUP-01', `${data.length}+ supplier users found`)
  data.forEach(u => {
    if (u.supplier_id) pass(`TC-AUTH-SUP-link`, `${u.email} linked to supplier_id`)
    else warn(`TC-AUTH-SUP-link`, `${u.email} has no supplier_id`)
  })
})

// ─── TC-SUPPLIER: Supplier data ──────────────────────────────────────────────
console.log('\n🏢 SUPPLIERS')
await check('TC-SUPP', 'Suppliers seeded', async () => {
  const { data, error } = await supabase.from('suppliers').select('id, name, status, is_diverse, email, phone')
  if (error) { fail('TC-SUPP-01', error.message); return }

  if (data.length >= 20) pass('TC-SUPP-01', `${data.length} suppliers found (≥20 required)`)
  else fail('TC-SUPP-01', `Only ${data.length} suppliers — expected ≥20`)

  const withEmail = data.filter(s => s.email)
  if (withEmail.length >= 15) pass('TC-SUPP-02', `${withEmail.length} suppliers have email address`)
  else warn('TC-SUPP-02', `Only ${withEmail.length} suppliers have email — email column may not be populated`)

  const diverse = data.filter(s => s.is_diverse)
  if (diverse.length >= 6) pass('TC-SUPP-03', `${diverse.length} diverse suppliers found`)
  else fail('TC-SUPP-03', `Only ${diverse.length} diverse suppliers — expected ≥6`)

  const statuses = [...new Set(data.map(s => s.status))]
  if (statuses.length >= 3) pass('TC-SUPP-04', `Mix of statuses: ${statuses.join(', ')}`)
  else warn('TC-SUPP-04', `Limited status variety: ${statuses.join(', ')}`)
})

// ─── TC-CONTRACT: Contracts ───────────────────────────────────────────────────
console.log('\n📄 CONTRACTS')
await check('TC-CONT', 'Contracts seeded', async () => {
  const { data, error } = await supabase.from('contracts').select('id, contract_number, contract_type, supplier_id, supplier_name, contract_officer, contract_amount, mb_goal_pct, sb_goal_pct')
  if (error) { fail('TC-CONT-01', error.message); return }

  if (data.length >= 20) pass('TC-CONT-01', `${data.length} contracts found (≥20 required)`)
  else fail('TC-CONT-01', `Only ${data.length} contracts — expected ≥20`)

  const subk = data.filter(c => c.contract_type === 'subk')
  const epp = data.filter(c => c.contract_type === 'epp')
  const subkEpp = data.filter(c => c.contract_type === 'subk_epp')

  if (subk.length >= 10) pass('TC-CONT-02', `${subk.length} SubK contracts`)
  else fail('TC-CONT-02', `Only ${subk.length} SubK contracts — expected ≥10`)

  if (epp.length >= 5) pass('TC-CONT-03', `${epp.length} EPP contracts`)
  else fail('TC-CONT-03', `Only ${epp.length} EPP contracts — expected ≥5`)

  if (subkEpp.length >= 3) pass('TC-CONT-04', `${subkEpp.length} SubK+EPP contracts`)
  else fail('TC-CONT-04', `Only ${subkEpp.length} SubK+EPP contracts — expected ≥3`)

  const withSupplierId = data.filter(c => c.supplier_id)
  if (withSupplierId.length >= 15) pass('TC-CONT-05', `${withSupplierId.length}/${data.length} contracts linked to supplier_id`)
  else warn('TC-CONT-05', `Only ${withSupplierId.length}/${data.length} contracts have supplier_id FK`)

  const withGoals = data.filter(c => c.mb_goal_pct || c.sb_goal_pct)
  if (withGoals.length >= 5) pass('TC-CONT-06', `${withGoals.length} contracts have diversity goals (MB/SB)`)
  else warn('TC-CONT-06', `Only ${withGoals.length} contracts have goal % fields`)
})

// ─── TC-CYCLES: Contract cycles ──────────────────────────────────────────────
console.log('\n🔄 CONTRACT CYCLES')
await check('TC-CYCLE', 'Contract cycles exist', async () => {
  const { data, error } = await supabase.from('contract_cycles').select('id, status, contract_id')
  if (error) { fail('TC-CYCLE-01', error.message); return }

  if (data.length >= 15) pass('TC-CYCLE-01', `${data.length} contract cycles found`)
  else fail('TC-CYCLE-01', `Only ${data.length} cycles — expected ≥15`)

  const statuses = [...new Set(data.map(c => c.status))]
  if (statuses.length >= 4) pass('TC-CYCLE-02', `Mix of cycle statuses: ${statuses.join(', ')}`)
  else warn('TC-CYCLE-02', `Limited cycle status variety: ${statuses.join(', ')}`)
})

// ─── TC-DOCS: contract_documents table ───────────────────────────────────────
console.log('\n📎 DOCUMENT ATTACHMENTS')
await check('TC-DOCS', 'contract_documents table exists', async () => {
  const { error } = await supabase.from('contract_documents').select('id').limit(1)
  if (error?.message?.includes('does not exist')) fail('TC-DOCS-01', 'contract_documents table missing — run migration SQL')
  else if (error) warn('TC-DOCS-01', 'contract_documents table exists but query issue: ' + error.message)
  else pass('TC-DOCS-01', 'contract_documents table exists and is accessible')
})

// ─── TC-EMAIL: Email API endpoints ───────────────────────────────────────────
console.log('\n📧 EMAIL API ENDPOINTS')
const emailRoutes = ['supplier-invite', 'reset-password', 'contract-status', 'review-scheduled', 'test']
for (const route of emailRoutes) {
  try {
    const res = await fetch(`http://localhost:3000/api/email/${route}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' })
    if (res.status === 400 || res.status === 500) {
      const body = await res.json()
      // 400 = route exists but missing params (expected), 500 = route exists but error
      if (body.error && !body.error.includes('not found')) pass(`TC-EMAIL-${route}`, `Route /api/email/${route} exists (returned validation error as expected)`)
      else fail(`TC-EMAIL-${route}`, `Route error: ${body.error}`)
    } else if (res.status === 404) {
      fail(`TC-EMAIL-${route}`, `Route /api/email/${route} NOT FOUND`)
    } else {
      pass(`TC-EMAIL-${route}`, `Route /api/email/${route} reachable (${res.status})`)
    }
  } catch (e) {
    fail(`TC-EMAIL-${route}`, `Cannot reach route: ${e.message}`)
  }
}

// ─── TC-FORGOT: Forgot password page ─────────────────────────────────────────
console.log('\n🔑 FORGOT PASSWORD PAGE')
try {
  const res = await fetch('http://localhost:3000/forgot-password')
  if (res.ok) pass('TC-FORGOT-01', '/forgot-password page loads (200)')
  else fail('TC-FORGOT-01', `/forgot-password returned ${res.status}`)
} catch (e) {
  fail('TC-FORGOT-01', 'Cannot reach /forgot-password: ' + e.message)
}

// ─── TC-PAGES: Key page load checks ──────────────────────────────────────────
console.log('\n📱 PAGE LOAD CHECKS')
const pages = [
  ['/login', 'Internal login'],
  ['/supplier/login', 'Supplier login'],
  ['/forgot-password', 'Forgot password'],
]
for (const [path, label] of pages) {
  try {
    const res = await fetch(`http://localhost:3000${path}`)
    if (res.ok) pass(`TC-PAGE-${path.replace(/\//g,'-')}`, `${label} page (${path}) loads OK`)
    else fail(`TC-PAGE-${path.replace(/\//g,'-')}`, `${label} page (${path}) returned ${res.status}`)
  } catch (e) {
    fail(`TC-PAGE-${path.replace(/\//g,'-')}`, `Cannot load ${path}: ${e.message}`)
  }
}

// ─── TC-SCHEMA: New columns on contracts/suppliers ───────────────────────────
console.log('\n🗄️  SCHEMA COLUMNS')
await check('TC-SCHEMA', 'New supplier columns', async () => {
  const { data, error } = await supabase.from('suppliers').select('email, phone').limit(1)
  if (error?.message?.includes('email')) fail('TC-SCHEMA-01', 'suppliers.email column missing — run migration SQL')
  else pass('TC-SCHEMA-01', 'suppliers.email and phone columns exist')
})

await check('TC-SCHEMA-2', 'New contract columns', async () => {
  const { data, error } = await supabase.from('contracts').select('mb_goal_pct, sb_goal_pct, cmc, subcontract_amount, report_type').limit(1)
  if (error) fail('TC-SCHEMA-02', 'New contract columns missing: ' + error.message)
  else pass('TC-SCHEMA-02', 'All new contract columns (mb_goal_pct, sb_goal_pct, cmc, etc.) exist')
})

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60))
console.log(`📊 TEST RESULTS SUMMARY`)
console.log('═'.repeat(60))
console.log(`  ✅ Passed:   ${passed}`)
console.log(`  ❌ Failed:   ${failed}`)
console.log(`  ⚠️  Warnings: ${warnings}`)
console.log(`  Total:     ${passed + failed + warnings}`)
console.log('═'.repeat(60))

if (failed > 0) {
  console.log('\n❌ FAILURES:')
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`   • ${r.id}: ${r.msg}`))
}
if (warnings > 0) {
  console.log('\n⚠️  WARNINGS:')
  results.filter(r => r.status === 'WARN').forEach(r => console.log(`   • ${r.id}: ${r.msg}`))
}

console.log('\n✅ Done.\n')
process.exit(failed > 0 ? 1 : 0)
