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
    name: '[깊은링크] ?tool= 에 외부 주소를 받는다 (되돌릴 때 열린 리다이렉트)',
    file: LIB,
    find: "  if (!raw.startsWith('/seller/') || raw.startsWith('//') || raw.includes('\\\\')) return null",
    replace: '  if (false) return null',
    test: TEST,
    why: '실패 시 window.location.replace 로 들어가는 값이다 — 검증이 없으면 남의 사이트로 보낼 수 있다.',
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
    name: '[깊은링크] 마이가 ?tool= 을 안 읽는다 (마이로 왔는데 화면이 안 열린다)',
    file: SECTION,
    find: "  useToolDeepLink({ ready: !loading && store != null, seated, open: (p, own) => { if (own === 'voucherNew') { setPageFrom(null); setTool('voucherNew'); return } void openPage(p, '') } })\n",
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
