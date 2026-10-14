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
    file: U, find: '      if (samples.length < MIN_SAMPLES) { thin++; continue }', replace: '', test: TEST,
    why: '표본 3개로 경보를 낸다.',
  },
  {
    name: '[vitals-slo] 데이터센터 표본을 화면으로 센다',
    file: U, find: "      if (page.startsWith('colo:')) continue", replace: '', test: TEST,
    why: '`colo:ICN` 같은 지역 표본이 화면 경보로 뜬다.',
  },
  {
    name: '[vitals-slo] 위반이 있어도 알림을 안 낸다',
    file: C, find: '  if (findings.length) {', replace: '  if (false) {', test: TEST,
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
]
