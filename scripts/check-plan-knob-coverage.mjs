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
 *
 * 🔧 **2026-08-03 판정 축 교정 — 파일-지역에서 프로그램-전역으로.**
 *   첫 판은 사용처를 **선언한 파일 안에서만** 셌다. 그래서 정상적인 리팩토링 하나가 오탐을 만들었다:
 *   `influencer-maintenance.ts` 가 600줄 캡에 닿아 회전 정책을 `rescan-rotation.ts` 로 빼자,
 *   선언(모듈)과 선택(호출부)이 갈리면서 **멀쩡히 배선된 `RESCAN_DEADLINE_MS_PAID` 가 고아로 신고**됐다.
 *   *"아무도 고르지 않는가"* 는 파일이 아니라 **프로그램 전체** 질문이다 — 스캔 범위 전체에서 센다.
 *   ⚠️ 그래도 **범위 밖(다른 디렉터리)에서만 쓰이는 경우는 여전히 고아로 본다.** 이 파이프라인의
 *   요금제 축은 `DIRS` 안에서 닫혀 있어야 하고, 밖으로 나갔다면 그 자체가 봐야 할 사실이다.
 *
 * 🩸 **그 교정의 첫 판은 헛돌았다(같은 날, 주입으로 발각).** "이름이 이 파일에 있고 + 이 파일이
 *   요금제 판정을 한다"로 봤더니, 실제 선택부를 지워도 **`import` 줄에 이름이 남고** 그 파일의
 *   *다른* `envPlanValue(` 가 조건을 채워 **초록**이 떴다. 텍스트 존재는 구조의 증거가 아니다.
 *   ⇒ 판정을 **"선택 문맥 안에 그 이름이 있는가"** 로 좁혔다. 선택 문맥은 두 형태다:
 *      ① 선택자 호출의 인자 목록 — `envPlanValue(raw, 무료, 유료, env)` (괄호 균형 스캔, 다중행 OK)
 *      ② 요금제 삼항 — `paidPlan(env) ? X_PAID : X_DEFAULT` · `plan === 'paid' ? … `
 *   ②를 빼면 **멀쩡히 배선된 상수 4건**(`ALARM_INTERVAL_MS_PAID` 등)이 오탐으로 뜬다 — 실제로 그랬다.
 *   `import` 줄은 어느 쪽에도 안 들어가므로 **이름만 남은 잔재는 구조적으로 배제**된다.
 */
/** 요금제 조건이 걸린 줄 — 삼항 선택 형태를 잡는다. */
const PLAN_PREDICATE = /(paidPlan\s*\(|isPaid|resolvePlan\s*\(|===\s*'paid'|===\s*"paid")/
const SELECTOR_NAMES = /\b(envPlanValue|paidPlan|resolvePlan|isPaid)\s*\(/g
/** 선택자 호출들의 **인자 텍스트만** 모은다 — import·주석·무관한 언급을 구조적으로 배제. */
function selectorArgs(src) {
  const out = []
  for (const m of src.matchAll(SELECTOR_NAMES)) {
    let i = m.index + m[0].length, depth = 1
    const start = i
    while (i < src.length && depth > 0) {
      const c = src[i]
      if (c === '(') depth++
      else if (c === ')') depth--
      i++
    }
    out.push(src.slice(start, i - 1))
  }
  return out.join('\n')
}
const orphanPaid = new Map()   // 정의는 있는데 아무도 고르지 않는 _PAID 상수
/** 스캔 범위 전체를 한 번만 읽어 둔다(파일 경계를 넘는 선택을 보기 위해). */
const allSrc = files.map((rel) => [rel, strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'))])
/** 선택 문맥 = ① 선택자 인자 ∪ ② 요금제 조건이 걸린 줄. `import` 줄은 둘 다 아니다. */
const selectionContext = allSrc
  .map(([, src]) => [
    selectorArgs(src),
    src.split('\n').filter((l) => PLAN_PREDICATE.test(l)).join('\n'),
  ].join('\n'))
  .join('\n')
const allSelectorArgs = selectionContext
for (const [rel, src] of allSrc) {
  for (const m of src.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*_PAID)\b/g)) {
    const name = m[1]
    if (!new RegExp(`\\b${name}\\b`).test(allSelectorArgs)) orphanPaid.set(name, rel)
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
