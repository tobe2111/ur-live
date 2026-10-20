/**
 * 🪑 셀러 목록 시드 가드의 되돌려-검증 (2026-10-01).
 * 가드: src/tests/unit/seller-list-fixtures-2026-10-01.test.ts
 *
 * 지키는 것: 시드가 **화면이 실제로 부르는 GET 경로**를 덮는다 · 응답이 full/empty 두 상태를 낸다 ·
 *   픽스처가 **얇지 않다**(긴 이름 · 큰 금액 · 빈 필드 · 실패 로그) · 하네스가 그걸 **배선해 쓴다**.
 */
const SEED = 'scripts/preview-seeds/seller-lists.mjs'
const HARNESS = 'scripts/visual-preview.mjs'
const TEST = 'src/tests/unit/seller-list-fixtures-2026-10-01.test.ts'

export default [
  {
    name: '🪑 시드가 정산 화면의 주 숫자(payouts)를 다시 빠뜨린다',
    file: SEED,
    find: "    '/api/seller/payouts': () =>",
    replace: "    '/api/seller/payouts_DISABLED': () =>",
    test: TEST,
    why: '이것이 2차 실패 그대로다 — 그 경로가 빠지면 정산 화면이 "아직 내역이 없습니다" · 미지급 0 으로 측정되고 "🟢 깨끗" 이 나온다.',
  },
  {
    name: '🪑 픽스처가 다시 얇아진다 (긴 이름 제거 → 말줄임 경계를 못 본다)',
    file: SEED,
    find: "shipping_name: '박하늘별님구름햇님보다사랑스러우리'",
    replace: "shipping_name: '박'",
    test: TEST,
    why: '짧은 값만 넣으면 어떤 폭으로 돌려도 늘 통과하는 그림이 나온다 — 하네스가 경계를 안 보여 주면 없는 것과 같다.',
  },
  {
    name: '🪑 픽스처에서 빈 필드가 사라진다 (COALESCE 폴백 경로 미측정)',
    file: SEED,
    find: "    user_name: null, user_email: null,            // ← 빈 필드(COALESCE 폴백 경로)",
    replace: "    user_name: '김', user_email: 'a@b.c',",
    test: TEST,
    why: '빈 필드가 없으면 서버 폴백(COALESCE)이 그리는 화면을 한 번도 안 보게 된다.',
  },
  {
    name: '🪑 실패 로그가 사라진다 (오류 배지 폭을 못 본다)',
    file: SEED,
    find: 'order_id: 10233, success: 0,',
    replace: 'order_id: 10233, success: 1,',
    test: TEST,
    why: '알림톡 화면에서 폭이 가장 위험한 것이 실패 사유 줄이다 — 성공만 넣으면 그 줄이 안 뜬다.',
  },
  {
    name: '🪑 하네스가 시드를 안 쓴다 (모듈만 있고 배선이 끊긴다)',
    file: HARNESS,
    find: '          const hit = sellerListResponse(p, SELLER_LISTS)',
    replace: '          const hit = null',
    test: TEST,
    why: '배선이 끊기면 모듈이 멀쩡해도 측정은 그대로 빈 화면이다 — 2026-09-30 1차 실패의 정확한 모양.',
  },
  {
    name: '🪑 좌석 토큰이 평문으로 돌아간다 (시트가 안 열려 또 빈 화면)',
    file: HARNESS,
    find: '  if (STORES_N > 0 || SELLER_LISTS) {',
    replace: '  if (STORES_N > 0) {',
    test: TEST,
    why: '`--seller-lists` 단독으로 돌릴 때 좌석이 안 잡히면 화면이 로그인/좌석 선택에서 멈춘다.',
  },
]
