/**
 * 🔬 유어딜 예약분 = 계정 실측 (2026-10-06) — 주입 매니페스트.
 *
 * 대표 하드 제약은 **초과 $0**("$5 이상을 넘으면 절대 안돼" · *"유어딜 사용자 많아지는 것도 감안"*).
 * 이 조가 막는 실패는 전부 **조용하다** — 에러도 빨간불도 없이 청구서로만 드러난다.
 *
 * 가드: src/tests/unit/ads-account-usage-reserve.test.ts
 *       src/tests/unit/ads-read-budget.test.ts (DO 배선)
 */
const TEST = 'src/tests/unit/ads-account-usage-reserve.test.ts'
const ACCT = 'src/worker-ads/account-usage.ts'
const BUDGET = 'src/worker-ads/read-budget.ts'

export default [
  {
    name: '🔬 실측을 못 읽을 때 예약분 0 으로 간다 (fail-open — 유어애즈가 본진 몫까지 먹는다)',
    file: ACCT,
    find: '  if (!acct || acct.month !== utcMonth(nowMs)) return fallback',
    replace: '  if (!acct || acct.month !== utcMonth(nowMs)) return 0',
    test: TEST,
    why: '못 읽었을 때 "예약분 없음"으로 가면 유어애즈가 포함분을 통째로 계획하고 본진 쓰기가 과금 구간으로 넘어간다 — 대표가 절대 안 된다고 못 박은 그 청구서다. 틀릴 때 손해 보는 쪽은 유어애즈여야 한다.',
  },
  {
    name: '🔬 낡은 실측을 그대로 믿는다 (신선도 검사 제거)',
    file: ACCT,
    find: '  if (!(Number(acct.at) > 0) || nowMs - Number(acct.at) > ACCT_STALE_MS) return fallback',
    replace: '  if (!(Number(acct.at) > 0)) return fallback',
    test: TEST,
    why: '예약분은 *추정*이다. 레인이 전부 멈춰 갱신이 끊긴 뒤에도 옛 MTD 로 추정하면, 그 사이 자란 본진을 못 보고 유어애즈가 그 몫을 먹는다.',
  },
  {
    name: '🔬 성장 여유를 없앤다 (유어딜이 커지는 중인데 지금 크기로만 예약)',
    file: ACCT,
    find: 'export const ACCT_GROWTH_FACTOR = 1.3',
    replace: 'export const ACCT_GROWTH_FACTOR = 1',
    test: TEST,
    why: '대표 지시가 *"유어딜 사용자 많아지는 것도 감안해야하고"* 였다. 이 계수가 1 이면 예약분이 **오늘 크기**에 딱 붙고, 그 상태가 바로 10/6 에 발견된 결함(옛 상수가 실측의 91.6%)이다.',
  },
  {
    name: '🔬 예약분 바닥을 없앤다 (월초 몇 시간 동안 본진 몫이 0)',
    file: ACCT,
    find: 'export const ACCT_MIN_RESERVE = 2_000_000',
    replace: 'export const ACCT_MIN_RESERVE = 0',
    test: TEST,
    why: '월초엔 MTD 가 거의 0 이라 추정도 0 에 가깝다. 바닥이 없으면 1일 새벽에 유어애즈가 포함분 전부를 자기 몫으로 계획한다.',
  },
  {
    name: '🔬 유어애즈 DB 목록에 본진 DB 를 섞는다 (본진 쓰기가 유어애즈 것으로 집계된다)',
    file: ACCT,
    find: "  '0e9a8f82-32fb-4584-878c-cdaec6c0aff0',   // ADS_COMPANY_DB — ad_company_leads",
    replace: "  '0e9a8f82-32fb-4584-878c-cdaec6c0aff0',   // ADS_COMPANY_DB — ad_company_leads\n  'd9530ba6-7a26-4c02-9295-3ce5aef112a3',",
    test: TEST,
    why: '본진 DB 를 유어애즈로 세면 `other`(= 예약분 원천)가 0 이 되어 유어딜 몫이 바닥값으로 떨어진다. 반대로 유어애즈 DB 를 빠뜨리면 유어애즈가 스스로를 굶는다 — 어느 쪽이든 조용하다.',
  },
  {
    name: '🔬 지출을 원장 자기보고만 센다 (보고 안 된 쓰기로 예산을 속일 수 있다)',
    file: BUDGET,
    find: '  const derived = monthlyDerivedWriteBudget(Math.max(self, seen), nowMs,',
    replace: '  const derived = monthlyDerivedWriteBudget(self, nowMs,',
    test: TEST,
    why: '원장은 *레인이 보고한 것만* 센다(이 파일이 스스로 적어 둔 사각지대). CF 실측과 큰 쪽을 쓰지 않으면 레인 밖 쓰기가 월 예산에서 통째로 빠진다.',
  },
  {
    name: '🔬 보고(mleft)와 집행(역산)이 다른 예약분을 쓴다',
    file: BUDGET,
    find: '    monthLeft: Math.max(0, MONTHLY_WRITE_ALLOWANCE - reserve - MONTHLY_SAFETY_BUFFER - writtenMonth),',
    replace: '    monthLeft: Math.max(0, MONTHLY_WRITE_ALLOWANCE - URDEAL_MONTHLY_RESERVE - MONTHLY_SAFETY_BUFFER - writtenMonth),',
    test: TEST,
    why: '하트비트가 *"아직 이만큼 남았다"* 고 읽는 값과 실제 집행이 갈리면, 운영자는 여유가 있다고 보면서 시스템은 버퍼를 태운다. 2026-10-06 주입 러너가 정확히 이 구멍을 잡았다(그때는 버퍼였다).',
  },
  {
    name: '🔬 실측 갱신을 게이트의 읽기 경로에서도 돌린다 (모든 레인 진입에 CF API 지연)',
    file: BUDGET,
    find: '    if (refresh && nowMs - (next.acctAt || 0) >= ACCT_RETRY_MS) {',
    replace: '    if (refresh) {',
    test: TEST,
    why: '간격 가드를 없애면 **모든 보고**가 CF API 를 부른다. 회차마다 수백 ms 가 붙고 그 비용은 유어애즈 처리량에서 나간다 — 느려지기만 하고 아무도 원인을 못 찾는다.',
  },
  {
    name: '🔬 갱신 실패를 기록하지 않는다 (재시도 폭풍)',
    file: BUDGET,
    find: '      next.acctAt = nowMs',
    replace: '      // next.acctAt = nowMs',
    test: TEST,
    why: '실패를 안 적으면 다음 보고가 또 부르고, CF 가 계속 실패하는 동안 **모든 회차**가 그 왕복을 기다린다.',
  },
  {
    name: '🔬 갱신 실패가 옛 실측을 지운다 (예약분이 상수로 떨어진다)',
    file: BUDGET,
    find: '      if (got) next.acct = got',
    replace: '      next.acct = got || undefined',
    test: TEST,
    why: 'CF 가 한 번 500 을 주면 실측이 사라지고 예약분이 폴백(4.4배)으로 떨어져 수집이 조용히 깎인다 — 원인은 어디에도 안 남는다.',
  },
  {
    name: '🔬 실측이 날 경계에서 버려진다 (매일 자정에 예약분이 상수로 떨어진다)',
    file: BUDGET,
    find: '    ...(prev?.acct ? { acct: prev.acct } : {}), ...(prev?.acctAt ? { acctAt: prev.acctAt } : {}),',
    replace: '',
    test: TEST,
    why: '실측은 *월* 추정값이라 하루 경계와 무관하다. 버리면 매일 UTC 자정에 폴백으로 떨어지고 다음 갱신(최대 1시간)까지 유어애즈 몫이 공짜로 줄어든다.',
  },
  {
    name: '🔬 DO 가 실측 갱신기를 주입하지 않는다 (예약분이 영원히 상수)',
    file: 'src/worker-ads/lane-alarm.ts',
    find: '        (at) => fetchAccountUsage(this.env, at)))',
    replace: '        undefined))',
    test: 'src/tests/unit/ads-read-budget.test.ts',
    why: '갱신기가 안 들어가면 실측이 **한 번도 안 생긴다** — 코드는 전부 있고 시험도 초록인데 라이브는 2026-10-06 이전과 똑같이 상수로 돈다. 이 레포가 반복해 당한 "실패가 아니라 조용한 부재" 그대로다.',
  },
]
