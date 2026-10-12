/**
 * 🚪 셀러 대시보드 제거 3단계 — 깊은 링크로 온 카카오 사장님을 마이 + 시트로 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-deep-link-to-my-2026-10-12.test.tsx
 *
 * 전부 **에러가 안 나는 결함**이다 — 무한 왕복은 화면이 깜빡이기만 하고, 빠진 배선은 그냥 옛 대시보드가 뜬다.
 */
const TEST = 'src/tests/unit/seller-deep-link-to-my-2026-10-12.test.tsx'
const LIB = 'src/lib/seller-deep-link.ts'
const HOOK = 'src/pages/user-profile/seller-section/useToolDeepLink.ts'
const LAYOUT = 'src/components/SellerLayout.tsx'
const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const PROFILE = 'src/pages/UserProfilePage.tsx'

export default [
  {
    name: '[깊은링크] dash=1 을 무시한다 (마이 ↔ 대시보드 무한 왕복)',
    file: LIB,
    find: "  if (q.get(DASH_PARAM) === '1') return null\n",
    replace: '\n',
    test: TEST,
    why: '마이가 못 열어 되돌린 주소를 껍데기가 또 마이로 보내면 화면이 끝없이 오간다.',
  },
  {
    name: '[깊은링크] 마이에서 일부러 전체화면으로 보낸 것까지 되돌린다 (큰 폼이 시트로 끌려 들어간다)',
    file: LIB,
    find: '  if (q.get(FROM_MY_PARAM) === FROM_MY_VALUE || shouldOfferMyReturn()) return null\n',
    replace: '\n',
    test: TEST,
    why: '등록 폼은 전체화면이 설계다 — 저장 후 목록으로 가는 순간 마이로 튕기면 일이 끊긴다.',
  },
  {
    name: '[깊은링크] 쿼리를 버린다 (알림톡 링크의 필터가 사라진다)',
    file: LIB,
    find: "  const target = pathname + (search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : '')",
    replace: '  const target = pathname',
    test: TEST,
    why: '?status=PAID 같은 필터가 빠지면 엉뚱한 목록이 열린다 — 에러는 없다.',
  },
  {
    name: '[깊은링크] ?tool= 에 외부 주소를 받는다 (되돌릴 때 열린 리다이렉트)',
    file: LIB,
    find: "  if (!raw.startsWith('/seller/') || raw.startsWith('//') || raw.includes('\\\\')) return null",
    replace: '  if (false) return null',
    test: TEST,
    why: '실패 시 window.location.replace 로 들어가는 값이다 — 검증이 없으면 남의 사이트로 보낼 수 있다.',
  },
  {
    name: '[깊은링크] 좌석이 안 맞아도 연다 (마이를 여는 것만으로 남의 가게 화면)',
    file: HOOK,
    find: '    if (!seated) { window.location.replace(dashboardFallback(path)); return }',
    replace: '',
    test: TEST,
    why: '시트의 화면은 좌석 토큰으로 스코프된다 — 안 맞는 채로 열면 다른 가게 것을 보게 된다.',
  },
  {
    name: '[깊은링크] 판매 구역이 못 뜨는 경우를 안 받는다 (아무 화면도 없는 마이에 떨어진다)',
    file: HOOK,
    find: '    if (!failed && storeCount > 0) return\n',
    replace: '    return\n',
    test: TEST,
    why: '가게 목록이 실패하면 판매 구역이 마운트조차 안 된다 — 그 경우를 아무도 안 받으면 링크가 죽는다.',
  },
  {
    name: '[깊은링크] 껍데기가 마이로 안 보낸다 (옛 대시보드가 그대로 뜬다)',
    file: LAYOUT,
    find: '  if (toMy) return <Navigate to={toMy} replace />',
    replace: '',
    test: TEST,
    why: '깊은 링크가 대시보드로 가는 주된 길이다 — 이 줄이 없으면 3단계가 통째로 없던 일이 된다.',
  },
  {
    name: '[깊은링크] 마이가 ?tool= 을 안 읽는다 (마이로 왔는데 화면이 안 열린다)',
    file: SECTION,
    find: "  useToolDeepLink({ ready: !loading && store != null, seated, open: (p) => { void openPage(p, '') } })\n",
    replace: '\n',
    test: TEST,
    why: '보내는 쪽만 있고 받는 쪽이 없으면 사장님은 아무것도 없는 마이를 보게 된다.',
  },
  {
    name: '[깊은링크] 페이지 폴백이 빠진다',
    file: PROFILE,
    find: '  useToolDeepLinkFallback({ loading: sellerSeats.loading, failed: sellerSeats.failed, storeCount: sellerSeats.stores.length })\n',
    replace: '\n',
    test: TEST,
    why: '판매 구역이 못 뜨는 경우의 유일한 받는 손이다.',
  },
]
