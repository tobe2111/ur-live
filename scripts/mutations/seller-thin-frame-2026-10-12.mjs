/**
 * 🧱 셀러 대시보드 틀 얇게 (2026-10-12, 셀러 대시보드 제거 4단계) — 주입 매니페스트.
 *
 * 사이드바(PC)·하단 탭(폰)을 걷어내고 머리줄 하나 + 전체 메뉴 화면(`/seller/more`)으로 바꿨다.
 * 아래는 전부 **에러가 안 나는** 결함이다 — 메뉴로 가는 문이 사라지거나, 사라진 탭 자리만큼 바가 허공에 뜬다.
 */
const MOBILE_FIRST = 'src/tests/unit/seller-mobile-first-2026-09-14.test.ts'
const MOBILE_FIXES = 'src/tests/unit/seller-mobile-fixes-2026-09-15.test.ts'

export default [
  {
    name: '[얇은틀] 머리줄에서 전체 메뉴 링크가 빠진다',
    file: 'src/components/SellerLayout.tsx',
    find: '          <Link\n            to={SELLER_MENU_PATH}',
    replace: '          <Link\n            to="/seller"',
    test: MOBILE_FIRST,
    why: '사이드바·하단 탭이 사라진 뒤 메뉴로 가는 문은 이 링크 하나다 — 빠지면 마이가 없는 옛 계정은 다른 화면으로 갈 길이 없다.',
  },
  {
    name: '[얇은틀] 전체 메뉴 화면에서 대분류(홈·주문·이용권·정산)가 빠진다',
    file: 'src/pages/SellerMorePage.tsx',
    find: '            {mainTabs.map(({ key, path, label, icon: Icon }) => (',
    replace: '            {[].map(({ key, path, label, icon: Icon }: any) => (',
    test: MOBILE_FIRST,
    why: '하단 탭이 하던 일이다 — 빠지면 주문·정산으로 가는 길이 검색밖에 남지 않는다.',
  },
  {
    name: '[얇은틀] 하단 고정 바가 사라진 탭 높이만큼 다시 뜬다',
    file: 'src/components/seller-layout/SellerBottomBar.tsx',
    find: "          bottom: 'env(safe-area-inset-bottom)',",
    replace: "          bottom: 'calc(60px + env(safe-area-inset-bottom))',",
    test: MOBILE_FIXES,
    why: '탭이 없는데 60px 위에 뜨면 바 아래로 본문이 비쳐 보이고, 마이 시트 안에서도 그랬다.',
  },
]
