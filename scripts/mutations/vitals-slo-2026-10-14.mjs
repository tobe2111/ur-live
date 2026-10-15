/**
 * 📈 실사용 성능 SLO 일일 감시 (2026-10-14) — 주입 매니페스트.
 * 가드: src/tests/unit/vitals-slo-2026-10-14.test.ts
 */
const TEST = 'src/tests/unit/vitals-slo-2026-10-14.test.ts'
const U = 'src/worker/utils/vitals-slo.ts'
const C = 'src/worker/cron/vitals-slo.ts'

export default [
  {
    name: '[vitals-slo] 기준 초과를 위반으로 안 친다',
    file: U, find: '      if (v > slo) {', replace: '      if (false) {', test: TEST,
    why: '교환권 CLS 0.14 같은 실사용 위반이 다시 사람 눈에만 걸린다.',
  },
  {
    name: '[vitals-slo] 절대 변화 하한 없이 회귀로 친다',
    file: U, find: ' && v - base >= MIN_DELTA[metric]) {', replace: ') {', test: TEST,
    why: '작은 흔들림마다 알림이 와서 아무도 안 보게 된다.',
  },
  {
    name: '[vitals-slo] 표본 부족을 판정한다',
    file: U, find: '      if (pageSamples.length < MIN_SAMPLES) { thin++; continue }', replace: '', test: TEST,
    why: '표본 3개로 경보를 낸다.',
  },
  {
    name: '[vitals-slo] 데이터센터 표본을 화면으로 센다',
    file: U, find: "      if (page.startsWith('colo:')) continue", replace: '', test: TEST,
    why: '`colo:ICN` 같은 지역 표본이 화면 경보로 뜬다.',
  },
  {
    name: '[vitals-slo] 위반이 있어도 알림을 안 낸다',
    file: C, find: '  const alarm = findings.length > 0 || judged === 0', replace: '  const alarm = false', test: TEST,
    why: '판정은 하는데 아무에게도 안 알린다 — 지금까지와 같다.',
  },
  {
    name: '[vitals-slo] KV 가 없으면 이상 없음으로 기록한다',
    file: C, find: "  if (!kv) return 'skip: ANALYTICS_KV", replace: "  if (!kv) return 'ok: ANALYTICS_KV", test: TEST,
    why: '관측이 안 되는 것을 정상으로 읽는다.',
  },
  {
    name: '[vitals-slo] 슬롯에서 빠진다',
    file: 'src/worker/scheduled.ts', find: "('vitals-slo', async () => {", replace: "('vitals-slo-off', async () => {", test: TEST,
    why: '감시가 안 돈다(배선만 남는다).',
  },
  // 🪟 2026-10-15 — 창 전환으로 생긴 불변식
  {
    name: '[vitals-slo] 창을 하루로 되돌린다',
    file: U, find: 'export const WINDOW_DAYS = 7', replace: 'export const WINDOW_DAYS = 1', test: TEST,
    why: '현 트래픽에서 하루로는 판정이 0건이다 — 감시가 다시 침묵한다(라이브에서 실제로 그랬다).',
  },
  {
    name: '[vitals-slo] 창을 늘려 둔감하게 만든다',
    file: U, find: 'export const WINDOW_DAYS = 7', replace: 'export const WINDOW_DAYS = 30', test: TEST,
    why: '창이 길면 회귀가 희석돼 보이지 않는다 — 둔감한 감시는 침묵과 같다.',
  },
  {
    name: '[vitals-slo] 창을 모을 때 표본을 안 이어 붙인다',
    file: U, find: '.push(...samples)', replace: '.push(samples.length)', test: TEST,
    why: '표본 대신 개수를 쌓아 p75 가 완전히 다른 숫자가 된다(그래도 판정은 계속 돌아간다).',
  },
  {
    name: '[vitals-slo] 판정 0건을 조용히 넘긴다',
    file: C, find: '  const alarm = findings.length > 0 || judged === 0', replace: '  const alarm = findings.length > 0', test: TEST,
    why: '감시가 판정을 못 하는 상태와 이상 없는 상태가 구분되지 않는다 — 이 PR 이 고친 바로 그 결함.',
  },
  {
    name: "[vitals-slo] '수집 멎음' 과 '표본 부족' 을 한 메시지로 묶는다",
    file: C, find: '  const blindReason = samples === 0', replace: '  const blindReason = false', test: TEST,
    why: '표본이 모였는데도 "수집이 멎었다" 고 적어 멀쩡한 수집기를 찾아보게 된다(실제로 그랬다).',
  },
  {
    name: '[vitals-slo] 얇은 기준선으로 회귀를 판정한다',
    file: U, find: '      const base = prior.length >= MIN_SAMPLES ? (p75(prior) as number) : null',
    replace: '      const base = prior.length >= 1 ? (p75(prior) as number) : null', test: TEST,
    why: '표본 한 개짜리 기준선과 비교해 회귀 경보가 잡음이 된다.',
  },
  {
    name: '[vitals-slo] 기준선을 판정 창과 같은 창에서 읽는다',
    file: C, find: 'readWindow(kv, nowMs, 1 + WINDOW_DAYS)', replace: 'readWindow(kv, nowMs, 1)', test: TEST,
    why: '자기 자신과 비교하므로 회귀가 **구조적으로** 절대 안 잡힌다(에러는 0).',
  },
]
