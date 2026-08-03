#!/usr/bin/env node
/**
 * 🎛️ **처리량 노브가 요금제를 아는지 — 기계가 강제한다** (2026-08-02).
 *
 * ## 왜 (하루에 같은 결함을 세 번 만났다)
 * 플랫폼 천장 → 보강 벽시계 → DO 알람·레인 예산. 전부 *"이 상수가 요금제를 모른다"* 였고
 * 전부 **사람이 발견**해서 고쳤다. 발견에 의존하면 다음 노브도 놓친다 — 그리고 놓치면
 * **유료로 바꿔도 그 축은 안 오른다**(에러가 없어 아무도 모른다).
 *
 * ## 두 가지를 강제한다
 *   R1. `src/worker-ads` · `src/features/marketing/api` 의 숫자 env 노브(`ADS_*`)는
 *       **전부 `plan-knobs.ts` 등기부에 분류**돼 있어야 한다.
 *   R2. `cf` 로 분류한 노브는 **요금제 인지 리졸버를 거쳐야** 한다
 *       (raw `parseInt(env.X …) || N` 이면 요금제가 닿지 않는다 — 오늘 세 번 겪은 그 모양).
 *
 * ## ⚠️ 왜 "전부 cf 로 만들기"가 아닌가
 * 외부 API 쿼터(YouTube 유닛·카카오 일 한도)를 요금제에 묶으면 **유료 전환이 곧 장애**가 된다:
 * Workers 예산은 늘었는데 그쪽이 403 을 주기 시작하고 그 레인은 그날 내내 죽는다.
 * 그래서 등기부가 *분류와 이유*를 요구한다 — 이 가드는 그 판단을 대신하지 않는다.
 *
 * ⚠️ **못 잡는 것**: 분류가 *틀린* 경우(외부 쿼터를 `cf` 로 적음). 그건 문자열로 판정 불가다
 *   — 등기부의 `why` 를 사람이 읽고 판단해야 한다. 이 가드는 *빠뜨림*만 막는다.
 *
 * 예외: 등기부에 `shape`/`external` 로 등재하면 R2 는 면제된다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
const DIRS = ['src/worker-ads', 'src/features/marketing/api']
const REGISTRY = path.join(ROOT, 'src/worker-ads/plan-knobs.ts')

if (!fs.existsSync(REGISTRY)) {
  console.error('❌ plan-knobs: 등기부(src/worker-ads/plan-knobs.ts)가 없다 — 코드가 옮겨갔다(통과가 아니라 실패).')
  process.exit(1)
}
const reg = fs.readFileSync(REGISTRY, 'utf8')
/** 등기부에서 {env, cls} 를 뽑는다. */
const registered = new Map()
for (const m of reg.matchAll(/\{\s*env:\s*'([A-Z0-9_]+)'\s*,\s*cls:\s*'(cf|external|shape)'/g)) {
  registered.set(m[1], m[2])
}
if (registered.size < 10) {
  console.error(`❌ plan-knobs: 등기부에서 ${registered.size}개만 읽혔다 — 파서가 깨졌다(측정 0 = 실패).`)
  process.exit(1)
}

/** 주석을 걷어낸다 — 설명 문장 속 코드가 판정을 뒤집는 사고를 이 레포가 이미 겪었다. */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

const files = []
for (const d of DIRS) {
  const abs = path.join(ROOT, d)
  if (!fs.existsSync(abs)) { console.error(`❌ plan-knobs: ${d} 없음 — 경로가 낡았다.`); process.exit(1) }
  for (const f of fs.readdirSync(abs)) if (f.endsWith('.ts')) files.push(path.join(d, f))
}
if (files.length < 20) { console.error(`❌ plan-knobs: 검사 대상 ${files.length}개 — 너무 적다(측정 0 = 실패).`); process.exit(1) }

const missing = new Map()   // env → 처음 발견 파일
const unwired = new Map()   // cf 인데 raw parseInt 로 읽는 곳
let seen = 0

for (const rel of files) {
  if (rel.endsWith('plan-knobs.ts')) continue
  const src = strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
  // 🔎 **두 형태를 모두 본다.**
  //   ⚠️ 첫 판은 raw `parseInt` 만 봤다 → **배선하는 순간 스캐너 눈에서 사라져**, 등기부에서 그 줄을
  //     지워도 통과했다(주입 검증에서 exit=0 으로 드러났다). 즉 R1 이 헛돌았다.
  //     리졸버를 거치는 노브도 **여전히 노브**다 — 분류가 사라지면 다음 세션이 근거를 잃는다.
  const RAW = /(?:parseInt|Number)\(\s*(?:String\()?\s*(?:env|e|envx)\.(ADS_[A-Z0-9_]+)/g
  const RESOLVED = /(?:envLaneBudget|resolveInterval|resolveRunsPerHour|platformSubreqCap|resolveEnrichDeadlineMs)\(\s*(?:env|e|envx)\.(ADS_[A-Z0-9_]+)/g
  for (const [re, isRaw] of [[RAW, true], [RESOLVED, false]]) {
    for (const m of src.matchAll(re)) {
      const name = m[1]
      seen++
      if (!registered.has(name)) { if (!missing.has(name)) missing.set(name, rel); continue }
      // `cf` 인데 **raw 로 읽으면** 요금제가 닿지 않는다. 리졸버 경유는 정상.
      if (isRaw && registered.get(name) === 'cf') { if (!unwired.has(name)) unwired.set(name, rel) }
    }
  }
}
if (seen === 0) { console.error('❌ plan-knobs: 숫자 노브를 하나도 못 찾았다 — 파서가 깨졌다(측정 0 = 실패).'); process.exit(1) }
let bad = false
if (missing.size) {
  bad = true
  console.error(`\n❌ plan-knobs: 등기부에 없는 숫자 노브 ${missing.size}건\n`)
  for (const [n, f] of missing) console.error(`   + ${n}   (${f})`)
  console.error(`
   ⇒ \`src/worker-ads/plan-knobs.ts\` 의 PLAN_KNOBS 에 **분류와 이유**를 적어라:
      cf       = Cloudflare 자원(서브리퀘스트·CPU·D1) → 요금제와 함께 오른다
      external = 외부 API 쿼터(YouTube 유닛·카카오/네이버 일 한도) → 🔴 올리면 그날 쿼터를 태운다
      shape    = 예산이 아니라 데이터 모양/의미 → 성능과 무관
   ⚠️ 추측하지 말고 **그 숫자가 무엇을 소비하는지** 코드에서 확인하고 적을 것.
`)
}
if (unwired.size) {
  bad = true
  console.error(`\n❌ plan-knobs: \`cf\` 인데 raw parseInt 로 읽는 노브 ${unwired.size}건 — 요금제가 닿지 않는다\n`)
  for (const [n, f] of unwired) console.error(`   ! ${n}   (${f})`)
  console.error(`
   ⇒ 요금제 인지 리졸버를 거쳐라: envLaneBudget(raw, 기본값, env) / envSubreqCap(env) /
      envEnrichDeadlineMs(env) / resolveInterval(raw, env) / resolveRunsPerHour(raw, env)
   상수만 요금제 인지형으로 만들면 부족하다 — **읽는 코드가 요금제를 함께 받아야** 한다
   (이 레포가 2026-08-02 하루에 세 번 만난 결함).
`)
}
/**
 * R3. **하드코딩 요금제 쌍(`X` / `X_PAID`)도 실제로 선택돼야 한다** (2026-08-03 신설).
 *
 * ## 왜 이걸 따로 봐야 하나 — 등기부의 사각지대
 * R1·R2 는 **env 노브(`ADS_*`)만** 본다. 그런데 이 파이프라인의 요금제 축 절반은 env 가 아니라
 * **파일 안 상수 쌍**이다: `RUN_DEADLINE_MS` / `RUN_DEADLINE_MS_PAID`,
 * `ALARM_INTERVAL_MS_DEFAULT` / `…_PAID`, `SUBREQ_PLATFORM_CAP_DEFAULT` / `…_PAID`.
 * 그것들은 **등기부에 뜨지도, R2 에 걸리지도 않는다.**
 *
 * 오늘 전수 확인에서 다행히 전부 배선돼 있었지만, 그건 **강제가 아니라 성실함**이었다.
 * `_PAID` 상수를 만들어 놓고 선택부를 안 붙이면 **유료로 바꿔도 그 축은 안 오른다** —
 * 이 레포가 하루에 세 번 만난 바로 그 모양이 env 밖에서 재현되는 것이다(에러 없음).
 *
 * ⚠️ **못 잡는 것**: `_PAID` 짝이 **아예 없는** CF-bound 상수. 이름만으로는 그게 CPU 에 묶인
 *   상수인지 데이터 모양인지 알 수 없다 — 사람이 판단해야 한다(등기부의 `why` 와 같은 이유).
 */
const PLAN_SELECTORS = /(envPlanValue|paidPlan|resolvePlan|isPaid)\s*\(/
const orphanPaid = new Map()   // 정의는 있는데 아무도 고르지 않는 _PAID 상수
for (const rel of files) {
  const src = strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
  for (const m of src.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*_PAID)\b/g)) {
    const name = m[1]
    // 정의 줄을 뺀 나머지에서 이 이름이 쓰이는가 + 그 파일이 요금제 판정을 하는가.
    const usedElsewhere = new RegExp(`\\b${name}\\b`, 'g')
    const hits = [...src.matchAll(usedElsewhere)].length
    if (hits <= 1 || !PLAN_SELECTORS.test(src)) orphanPaid.set(name, rel)
  }
}
if (orphanPaid.size) {
  bad = true
  console.error(`\n❌ plan-knobs: 아무도 고르지 않는 \`_PAID\` 상수 ${orphanPaid.size}건 — 유료로 바꿔도 그 축은 안 오른다\n`)
  for (const [n, f] of orphanPaid) console.error(`   ! ${n}   (${f})`)
  console.error(`
   ⇒ 요금제 판정을 거쳐 고르게 하라: envPlanValue(raw, 무료값, 유료값, env)
   상수를 만드는 것과 **그 상수가 선택되는 것**은 다른 일이다 — 후자가 빠지면 에러 없이 조용히 무료 동작.
`)
}
if (bad) process.exit(STRICT ? 1 : 0)
console.log(`✅ plan-knobs: 숫자 노브 ${registered.size}개 전부 분류됨 · cf 배선 누락 0 (검사 ${files.length}파일)`)
