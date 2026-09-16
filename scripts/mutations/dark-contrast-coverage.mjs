/**
 * 🕯️ 주입 — dark-contrast 가드 **커버리지** (2026-09-16 등록)
 * 가드: src/tests/unit/dark-contrast-coverage-2026-09-16.test.ts
 *
 * 이 가드가 막는 것은 "대비가 나쁘다"가 아니라 **"안 보고 있다"** 이다. 브라우저 가드는
 * 주기 워크플로에서만 돌아 PR 이 못 보고, 목록이 낡아도 늘 초록이다. 아래 넷은 전부
 * **에러 없이 커버리지만 사라지는** 방향이다.
 */
const TEST = 'src/tests/unit/dark-contrast-coverage-2026-09-16.test.ts'
const GUARD = 'scripts/check-dark-contrast.mjs'

export default [
  {
    name: '[다크대비] 살아 있는 카드결제 화면(/pay/widget)을 목록에서 뺀다',
    file: GUARD,
    find: "    route: '/pay/widget?orderId=GB-1-1700000000000",
    replace: "    route: '/REMOVED-pay-widget?orderId=GB-1-1700000000000",
    test: TEST,
    why: '2026-09-16 이전의 실제 상태다 — 이용권을 카드로 사는 유일한 화면이 몇 달간 검사 밖이었고 아무 신호도 없었다.',
  },
  {
    name: '[다크대비] 경로별 "안 그려짐 = 실패" 검사를 무력화',
    file: GUARD,
    find: 'const EMPTY_ROUTES = perRoute.filter((r) => r.n < 5)',
    replace: 'const EMPTY_ROUTES = perRoute.filter((r) => r.n < 0)',
    test: TEST,
    why: '조건만 0 으로 바꾸면 한 경로가 통째로 안 그려져도 초록이다. 합계 하한은 다른 41개가 채운다.',
  },
  {
    name: '[다크대비] 경로별 판정이 종료하지 않고 로그만 찍는다',
    file: GUARD,
    find: "  console.log('   필수 쿼리 누락으로 조기 return · 기능이 꺼져(FEATURE_STATUS) 빈 화면.')\n  process.exit(1)",
    replace: "  console.log('   필수 쿼리 누락으로 조기 return · 기능이 꺼져(FEATURE_STATUS) 빈 화면.')",
    test: TEST,
    why: '빨간 글씨를 찍고 exit 0 으로 끝나면 CI 는 통과다 — 가장 눈에 안 띄는 무력화.',
  },
  {
    name: '[다크대비] 전체 측정 하한(헛도는 측정기 차단)을 없앤다',
    file: GUARD,
    find: 'if (measured < 200) {',
    replace: 'if (measured < 0) {',
    test: TEST,
    why: '렌더가 통째로 깨지면 findings 도 0 이라 초록불이 된다 — 이 레포가 반복해 당한 "측정할 수 없어서 통과".',
  },
  {
    name: '[다크대비] 장바구니 API 스텁을 떼어 빈 화면만 재게 한다',
    file: 'scripts/check-dark-contrast.mjs',
    find: "  { route: '/cart', name: '장바구니', auth: 'user', fill: true, api: CART_API },",
    replace: "  { route: '/cart', name: '장바구니', auth: 'user', fill: true },",
    test: TEST,
    why: '2026-09-16 이전의 실제 상태다 — 목록엔 있는데 그려지는 건 "장바구니가 비어있습니다" 네 글자였다.',
  },
  {
    name: '[다크대비] 결제완료 쿼리를 떼어 에러 카드만 재게 한다',
    file: 'scripts/check-dark-contrast.mjs',
    find: "    route: '/payment/success?paymentKey=tviva_guard_20260916",
    replace: "    route: '/payment/success?noKey=tviva_guard_20260916",
    test: TEST,
    why: 'paymentKey 가 없으면 스텁이 있어도 "결제 승인 실패"로 조기 이탈한다 — 영수증·금액을 못 잰다.',
  },
  {
    name: '[다크대비] 인터셉터가 스텁 표를 안 읽는다 (선언만 남고 배선 소멸)',
    file: 'scripts/check-dark-contrast.mjs',
    find: '    const body = R.api && R.api[p]',
    replace: '    const body = null',
    test: TEST,
    why: '가장 조용한 무력화 — 표는 그대로 있어 사람이 읽으면 "스텁 있음"으로 보이는데 화면은 도로 빈 상태다.',
  },
]
