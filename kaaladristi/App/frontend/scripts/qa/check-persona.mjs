// check-persona.mjs — guards constants/personaConfig.ts (no vitest in this repo).
//
//   node scripts/qa/check-persona.mjs
//
// 1. Every one of the 27 (acts_on × hold_horizon × concede_level) combinations
//    derives a persona, and the documented rule holds: horizon wins unless
//    BOTH modulators agree against it.
// 2. Skip paths (partial / empty answers) still land on a persona.
// 3. Every preset id in PERSONA_SCANNERS / ACTS_ON_PRESETS / INTRO_PRESET is a
//    real `id:` in services/scanEngine.ts SCAN_PRESETS.
// 4. Every PERSONA_TEMPLATE id is a real template id in frameworkTemplates.ts.
// 5. The DB CHECK constraints in migration 204 list exactly the same vocabulary.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { transformSync } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = rel => readFileSync(path.join(root, rel), 'utf8')

const src = read('src/constants/personaConfig.ts')
const { code } = transformSync(src, { loader: 'ts', format: 'esm' })
const cfg = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

const fails = []
const ok = (cond, msg) => { if (!cond) fails.push(msg) }

// ── 1. full table ────────────────────────────────────────────────────────────
const H = { days: 'intensity', weeks: 'swing', months: 'investor' }
const A = { confirmed: 'investor', early: 'swing', extreme: 'intensity' }
const C = { tight: 'intensity', swing_low: 'swing', structure: 'investor' }
let n = 0
for (const acts_on of cfg.ACTS_ON_IDS) for (const hold_horizon of cfg.HOLD_HORIZON_IDS) for (const concede_level of cfg.CONCEDE_LEVEL_IDS) {
  n++
  const got = cfg.derivePersona({ acts_on, hold_horizon, concede_level })
  ok(cfg.PERSONA_IDS.includes(got), `no persona for ${acts_on}/${hold_horizon}/${concede_level}`)
  const expect = (A[acts_on] === C[concede_level] && A[acts_on] !== H[hold_horizon]) ? A[acts_on] : H[hold_horizon]
  ok(got === expect, `${acts_on}/${hold_horizon}/${concede_level}: got ${got}, rule says ${expect}`)
  const line = cfg.readingLine({ acts_on, hold_horizon, concede_level })
  ok(line.toLowerCase().includes(cfg.PERSONAS[got].label.toLowerCase()), `reading line misses persona: "${line}"`)
}
ok(n === 27, `expected 27 combinations, walked ${n}`)

// ── 2. skip paths ────────────────────────────────────────────────────────────
ok(cfg.derivePersona({}) === cfg.DEFAULT_PERSONA, 'empty answers must give DEFAULT_PERSONA')
ok(cfg.derivePersona({ hold_horizon: 'days' }) === 'intensity', 'horizon alone decides')
ok(cfg.derivePersona({ acts_on: 'extreme' }) === 'intensity', 'one modulator alone decides')
ok(cfg.derivePersona({ acts_on: 'extreme', concede_level: 'structure' }) === cfg.DEFAULT_PERSONA, 'split modulators, no horizon → default')
ok(cfg.readingLine({}).length > 0, 'empty reading line')
ok(cfg.readingLine({ acts_on: 'early', hold_horizon: 'weeks', concede_level: 'swing_low' }, 'investor').toLowerCase().includes('you chose'), 'override must say "you chose"')
ok(!cfg.isPersonaComplete({ acts_on: 'early' }) && cfg.isPersonaComplete({ acts_on: 'early', hold_horizon: 'weeks', concede_level: 'tight' }), 'isPersonaComplete')

// ── 3. preset ids exist ──────────────────────────────────────────────────────
const presetIds = new Set([...read('src/services/scanEngine.ts').matchAll(/\{\s*id:\s*'([a-z0-9_]+)'/g)].map(m => m[1]))
ok(presetIds.size > 10, 'could not parse SCAN_PRESETS ids')
const used = new Set([...Object.values(cfg.PERSONA_SCANNERS).flat(), ...Object.values(cfg.ACTS_ON_PRESETS), cfg.INTRO_PRESET])
for (const id of used) ok(presetIds.has(id), `preset id '${id}' is not in SCAN_PRESETS`)
for (const p of cfg.PERSONA_IDS) ok(cfg.PERSONA_SCANNERS[p].length === 4, `${p} must map to exactly 4 scanners`)

// ── 4. template ids exist ────────────────────────────────────────────────────
const templateIds = new Set([...read('src/constants/frameworkTemplates.ts').matchAll(/^\s*id:\s*'(vani_[a-z_]+)'/gm)].map(m => m[1]))
for (const [p, t] of Object.entries(cfg.PERSONA_TEMPLATE)) ok(templateIds.has(t), `${p} → template '${t}' not in frameworkTemplates.ts`)

// ── 5. DB CHECK vocabulary matches ───────────────────────────────────────────
// The Docker image only carries App/frontend (nginx/Dockerfile copies that
// directory alone), so the migration is absent there; the comparison runs in
// a full checkout (local, CI) and is skipped — reported, not failed — in the
// image build.
const migPath = path.join(root, '../DBscripts/km_migration_204_profile_persona.sql')
const mig = existsSync(migPath) ? readFileSync(migPath, 'utf8') : null
const dbList = col => {
  if (mig == null) return null
  const m = mig.match(new RegExp(`${col}\\s+TEXT\\s*\\n?\\s*CHECK \\(${col} IN \\(([^)]*)\\)`))
  return m ? m[1].split(',').map(s => s.trim().replace(/'/g, '')).sort().join(',') : null
}
const same = (col, ids) => ok(dbList(col) === [...ids].sort().join(','), `migration 204 CHECK for ${col} (${dbList(col)}) ≠ personaConfig (${[...ids].sort().join(',')})`)
if (mig != null) { same('persona', cfg.PERSONA_IDS); same('acts_on', cfg.ACTS_ON_IDS); same('hold_horizon', cfg.HOLD_HORIZON_IDS); same('concede_level', cfg.CONCEDE_LEVEL_IDS) }

if (fails.length) { console.error('check-persona: FAIL\n  ' + fails.join('\n  ')); process.exit(1) }
console.log(`check-persona: ok · 27 combinations · ${used.size} preset ids · ${Object.keys(cfg.PERSONA_TEMPLATE).length} templates · ${mig != null ? 'DB vocabulary in sync' : 'DB vocabulary check skipped (migration file not in this build context)'}`)
