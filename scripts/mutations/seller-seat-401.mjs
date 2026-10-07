/**
 * 🧬 주입 — **매장 등록 직후 셀러 로그인으로 튕기던 것** (2026-10-07 대표 라이브 신고)
 *
 * 되돌리면 전부 **대표가 오늘 밟은 그 길**로 돌아간다. 라이브 콘솔 실측:
 *   `GET /api/seller/orders … 401` → 토스트 `(session_expired)` → `/seller/login` 하드 이동.
 * 세션은 멀쩡했고, 좌석 토큰은 방금 정상 발급된 것이었다.
 */
const GATE = 'src/worker/utils/seller-approval-gate.ts'
const ROUTES = 'src/features/seller/api/seller-orders.routes.ts'
const API = 'src/lib/api.ts'
const HOOK = 'src/pages/user-profile/seller-section/useSellerWork.ts'
const UI = 'src/pages/user-profile/SellerSection.tsx'
const T = 'src/tests/unit/seller-seat-401-redirect-2026-10-07.test.ts'

export default [
  {
    name: '좌석401 — 승인 전 매장을 다시 401 로 뭉갠다 (종전 동작)',
    file: GATE,
    find: "    return { ok: false, reason: 'not_approved', status: String(row.status ?? ''), sellerId: id }",
    replace: "    return { ok: false, reason: 'no_token' }",
    test: T,
    why:
      '정확히 종전 동작이다. 좌석은 멀쩡히 발급됐는데 "네가 누구인지 모르겠다" 고 답하므로 ' +
      '클라 인터셉터가 그걸 세션 만료로 읽어 **방금 받은 좌석 토큰을 지우고** 셀러 로그인으로 ' +
      '내던진다 — 대표가 오늘 본 화면이 이것이다.',
  },
  {
    name: '좌석401 — 승인 집합을 손으로 다시 적는다',
    file: GATE,
    find: '  const approved = isPayoutEligibleSellerStatus(row.status) && row.is_active !== 0',
    replace: "  const approved = ['approved', 'active'].includes(String(row.status)) && row.is_active !== 0",
    test: T,
    why:
      '값이 같아 보여도 SSOT 를 떠나는 순간 갈린다. 2026-09-20 당근 모델이 상태 집합을 ' +
      '`shared/seller-status.ts` 한 곳으로 모은 이유이고, `approved`/`active` 혼용은 ' +
      '2026-05-07 에 이미 사고가 났던 자리다.',
  },
  {
    name: '좌석401 — 라우트가 사유를 안 보고 전부 401 로 답한다',
    file: ROUTES,
    find: "  if (gate.reason === 'not_approved') {",
    replace: '  if (false) {',
    test: T,
    why:
      '게이트가 사유를 구분해 줘도 라우트가 안 쓰면 소용이 없다. 승인 대기가 다시 401 이 되어 ' +
      '인터셉터가 똑같이 오독한다.',
  },
  {
    name: '좌석401 — 인터셉터가 소비자 화면에서도 내던진다 (사고의 핵심)',
    file: API,
    find: '        if (onRoleSurface) {',
    replace: '        if (true) {',
    test: T,
    why:
      '이 한 줄이 사고의 전부였다. 소비자 화면(마이·`/store/new`)도 `/api/seller/*` 를 부르므로, ' +
      '그 401 하나로 셀러 세션이 죽었다고 단정하고 소비자를 셀러 로그인 화면에 내던진다. ' +
      '게다가 하드 내비게이션이라 호출부의 fail-soft(`.catch(() => null)`·`onSeatLost`·' +
      '`enterStoreSeat` 의 "자기 매장을 잃은 것처럼 느낀다" 처리)를 **전부 선점해 무력화**한다.',
  },
  {
    name: '좌석401 — 마이가 승인 대기를 실패로 뭉갠다',
    file: HOOK,
    find: "      if (isPending(oRes) || isPending(pRes)) { setPendingApproval(true); setFailed(false); setLoading(false); return }",
    replace: '      // (승인 대기를 구분하지 않음)',
    test: T,
    why:
      '튕김만 없애고 여기를 안 고치면 판매 구역이 **조용히 "불러오지 못했습니다"** 가 된다. ' +
      '사장님이 할 일은 기다리는 것뿐인데 자기가 뭘 잘못한 줄 안다.',
  },
  {
    name: '좌석401 — 화면이 승인 대기를 안 말한다',
    file: UI,
    find: '          {work.pendingApproval ? (',
    replace: '          {false ? (',
    test: T,
    why:
      '훅이 사유를 알아도 화면이 안 쓰면 사용자에겐 아무 차이가 없다. ' +
      '"승인 대기" 와 "못 불러왔다" 는 사장님이 할 행동이 다르다.',
  },
]
