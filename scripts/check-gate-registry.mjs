#!/usr/bin/env node
/**
 * 🎛️ **게이트를 만들었으면 게이트 표에 등재해야 한다.**
 *
 * ## 왜 (2026-09-07 — 이 레포가 같은 구멍을 세 번째로 밟은 뒤)
 * `ops-gate-reachable` 은 *"게이트를 만들었으면 켤 화면도 있어야 한다"* 를 강제한다.
 * 그런데 그 시험은 **`OPS_GATES` 에 등재된 것만** 본다. 등재를 빠뜨리면 검사 대상이 아니다.
 *
 * 그래서 `affiliate_program_enabled`(담기 적립의 **주 스위치**)가 한 달 넘게 손잡이 없이 남았다 —
 * 읽는 곳 둘, 쓰는 화면 0. 켜려면 D1 을 직접 고쳐야 했고, 그렇게 켜면 `'True'`/`'1'` 같은
 * 오타값이 저장돼도 read-site 의 `=== 'true'` 가 **조용히 OFF 로 읽는다**.
 *
 * ⇒ **등재가 곧 검사 범위다.** 이 가드는 그 앞단을 막는다: 등재 자체를 강제한다.
 * 실제로 처음 돌렸을 때 미등재 게이트 **5개**를 찾아냈다(settlement_skip_ledgered ·
 * outreach_auto_send · promo_bar_enabled · invite_reward_enabled · multi_tier_enabled).
 *
 * ## 무엇을 잡나 — "strict-true 게이트"
 * `platform_settings` 에서 읽어 **`=== 'true'` / `!== 'true'`** 로 판정하는 키.
 * 이 형태가 위험한 이유는 두 가지다:
 *   ① 사람이 켜고 꺼야 하는 스위치다(값이 아니라 결정이다).
 *   ② 오타값이 예외를 내지 않고 **조용히 꺼진 쪽**으로 떨어진다.
 * 그런 키는 전부 `OPS_GATES` 에 있어야 한다.
 *
 * ## 판정을 어떻게 좁혔나 (오탐을 실제로 셋 잡았다)
 *   · 주석 줄은 비운다 — 설명문의 `=== 'true'` 에 걸려 `platform_fee_pct` 가 오탐이었다.
 *   · `ENV_NAME === 'true'` 형태(대문자)는 env 게이트다 — Cloudflare 소관이라 제외.
 *     이걸 안 걸러 `ads_notice_stats` 가 오탐이었다.
 *   · `key IN (...)` 다중 읽기는 **비교되는 좌변이 그 키 이름일 때만** 그 키로 친다.
 *     같은 줄에 이름이 스치기만 해도 치면 `promo_bar_text` 가 오탐이 된다(실제로 났다).
 *
 * ## ⚠️ 이 가드가 못 막는 것
 *   · `=== 'owner'` 같은 enum 게이트(`promo_funding_source`)와 `!== 'false'` 형태(킬스위치).
 *     그 둘은 표현이 제각각이라 기계로 좁히면 오탐이 난다 — `ops-gate-reachable` 이 등재된
 *     것들에 대해 계속 지킨다.
 *   · 등재는 됐는데 `turn_on_when` 이 거짓말인 경우.
 *   · **읽는 코드가 아예 없는** 게이트(env 전용, 대시보드 소관).
 *
 * 예외: 정말 등재하면 안 되는 키는 `GATE_REGISTRY_EXEMPT` 에 사유와 함께 넣는다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const GATES_FILE = 'src/features/admin/api/admin-system-monitoring.routes.ts'

/** 등재 면제 — 키: 사유. 사유 없이 넣지 말 것(그러면 이 가드가 무의미해진다). */
const GATE_REGISTRY_EXEMPT = {
  // (지금은 비어 있다. 면제가 필요하면 왜 사람이 켤 스위치가 아닌지 여기에 적는다.)
}

const TRUE_CMP = /[!=]==\s*'true'/
const ENV_CMP = /[A-Z][A-Z0-9_]{3,}\s*[!=]==\s*'true'/

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'tests' || e.name === 'generated') continue
      walk(p, out)
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

/** 주석 줄을 비운다(줄 번호는 보존). */
function codeLines(file) {
  return readFileSync(file, 'utf8').split('\n').map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l))
}

/** 소스 전체에서 strict-true 게이트 키를 찾는다 → Map<key, 'file:line'> */
export function findStrictTrueGates(root = ROOT) {
  const found = new Map()
  for (const file of walk(path.join(root, 'src'))) {
    const lines = codeLines(file)
    const whole = lines.join('\n')
    if (!whole.includes('platform_settings')) continue

    const single = new Set()
    const multi = new Set()
    for (const m of whole.matchAll(/platform_settings[\s\S]{0,120}?key\s*=\s*'([^']+)'/g)) single.add(m[1])
    for (const m of whole.matchAll(/key\s+IN\s*\(([^)]*)\)/g)) for (const k of m[1].matchAll(/'([^']+)'/g)) multi.add(k[1])

    const cmp = []
    lines.forEach((l, i) => { if (TRUE_CMP.test(l) && !ENV_CMP.test(l)) cmp.push(i) })
    const rel = path.relative(root, file).replace(/\\/g, '/')

    // ① 단일 키 읽기 — 키 리터럴 근처(뒤 8줄)에 비교가 있으면 그 키의 게이트.
    for (const k of single) {
      const at = lines.findIndex((l) => l.includes(`'${k}'`))
      if (at >= 0 && cmp.some((c) => c >= at - 2 && c <= at + 8)) found.set(k, `${rel}:${at + 1}`)
    }
    // ② IN(...) 다중 읽기 — **좌변이 그 키 이름일 때만**.
    for (const k of multi) {
      if (found.has(k)) continue
      const own = new RegExp(`${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\\]]?\\s*\\)?\\s*[!=]==\\s*'true'`)
      const at = cmp.find((c) => own.test(lines[c]))
      if (at !== undefined) found.set(k, `${rel}:${at + 1}`)
    }
  }
  return found
}

/** OPS_GATES 에 등재된 키 집합. */
export function readRegisteredGates(root = ROOT) {
  const src = readFileSync(path.join(root, GATES_FILE), 'utf8')
  const arr = src.match(/OPS_GATES[^=]*=\s*\[([\s\S]*?)\n\]/)
  if (!arr) throw new Error(`${GATES_FILE} 에서 OPS_GATES 배열을 못 찾았다 — 구조가 바뀌었다`)
  return new Set([...arr[1].matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]))
}

export function auditGateRegistry(root = ROOT) {
  const gates = findStrictTrueGates(root)
  const registered = readRegisteredGates(root)
  const missing = [...gates].filter(([k]) => !registered.has(k) && !(k in GATE_REGISTRY_EXEMPT))
  return { total: gates.size, missing, gates }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const strict = process.argv.includes('-s') || process.env.STRICT_GATE_REGISTRY === '1'
  let r
  try { r = auditGateRegistry() } catch (e) { console.error(`❌ gate-registry: ${e.message}`); process.exit(1) }

  // 🛡️ 측정 0 = 통과가 아니라 실패 — 스캐너가 조용히 아무것도 안 보는 것을 막는다.
  if (r.total < 5) {
    console.error(`❌ gate-registry: strict-true 게이트를 ${r.total}개만 찾았다 — 스캐너가 눈이 멀었다(경로/패턴 변경 의심)`)
    process.exit(1)
  }
  if (r.missing.length === 0) {
    console.log(`✅ gate-registry: strict-true 게이트 ${r.total}개 전부 OPS_GATES 등재됨`)
    process.exit(0)
  }
  console.log(`${strict ? '❌' : '⚠️'} gate-registry: OPS_GATES 미등재 게이트 ${r.missing.length}개`)
  for (const [k, where] of r.missing) console.log(`   · ${k}  ←  ${where}`)
  console.log('   → src/features/admin/api/admin-system-monitoring.routes.ts 의 OPS_GATES 에 등재할 것.')
  console.log('     켜지 않기로 한 축이면 turn_on_when 에 "켜지 않는다" 를 적으면 화면은 면제된다.')
  process.exit(strict ? 1 : 0)
}
