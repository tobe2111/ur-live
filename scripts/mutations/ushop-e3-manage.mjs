/**
 * 🔧 2026-09-28 (대표 확정 **e3** — "E3로 하고 /u/me/manage 신설해줘") 주입.
 *
 * 지키는 것 하나: **유어샵은 손님 화면 하나뿐이고, 고치는 일은 전부 `/u/me/manage` 에 있다.**
 * 아래 결함을 심으면 `ushop-e3-manage-2026-09-28.test.ts` / `ushop-a3-p1.test.ts` 가 빨간불이어야 한다.
 */
export default [
  {
    name: 'e3 — 관리 블록이 손님 화면으로 되돌아온다',
    file: 'src/pages/CuratorPage.tsx',
    find: "const SEARCH_MIN_PINS = 12",
    replace: "const SEARCH_MIN_PINS = 12\nimport OwnerEarningsStrip from './curator-page/OwnerEarningsStrip'",
    test: 'src/tests/unit/ushop-e3-manage-2026-09-28.test.ts',
    why:
      '종전 [유어샵 편집]이 손님 화면 위에 관리 chrome 다섯 덩어리를 덧칠해 주인/손님 화면이 갈렸다. ' +
      '하나라도 되돌아오면 그 갈림이 다시 시작된다 — e3 는 "손님 화면 하나" 가 전부다.',
  },
  {
    name: 'e3 — 헤더가 다시 주소 텍스트를 적는다',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: "  const hasSns =",
    replace: "  const shareHost = 'urdeal.kr'\n  const hasSns =",
    test: 'src/tests/unit/ushop-e3-manage-2026-09-28.test.ts',
    why:
      '대표: "링크를 적지 말고 그냥 공유하기 버튼 하나로 둬줘". 주소는 **읽으라고** 있는 게 아니라 ' +
      '**보내라고** 있는 것이라 [공유] 버튼이 대신한다. 텍스트가 돌아오면 그 결정이 무효가 된다.',
  },
  {
    name: 'e3 — 관리 화면이 로그인 없이 열린다',
    file: 'src/App.tsx',
    find: '<Route path="/u/me/manage" element={<ProtectedRoute requireUser>',
    replace: '<Route path="/u/me/manage" element={<>',
    test: 'src/tests/unit/ushop-e3-manage-2026-09-28.test.ts',
    why: '관리 화면은 남의 유어샵을 고치는 화면이 아니다. 보호가 빠지면 비로그인도 그 화면에 도달한다.',
  },
  {
    name: 'e3 — 관리 화면이 seller_token 으로 소유권을 판정한다',
    file: 'src/pages/UShopManagePage.tsx',
    find: "  const [reorder, setReorder] = useState(false)",
    replace: "  const [reorder, setReorder] = useState(false)\n  const owns = !!localStorage.getItem('seller_token')",
    test: 'src/tests/unit/ushop-e3-manage-2026-09-28.test.ts',
    why:
      '유어샵 소유권 = 로그인 소비자 유저(check-linkshop-ownership). seller_token 은 셀러 대시보드 ' +
      '접근용일 뿐이라, 그걸로 가르면 카카오로만 로그인한 주인이 자기 샵을 못 고친다(2026-07-07 실사고).',
  },
  {
    name: 'e3 — "주인 화면" 상태가 부활한다',
    file: 'src/pages/SellerPublicPage.tsx',
    find: "  // ── 인라인 편집 상태 ──",
    replace: "  const ownerView = isOwner\n  // ── 인라인 편집 상태 ──",
    test: 'src/tests/unit/ushop-a3-p1.test.ts',
    why:
      '사업자 유어샵만 편집 모드를 되살리면 두 유어샵이 갈린다 — 헤더가 하나뿐이라 반드시 드리프트한다 ' +
      '(2026-06-25 "헤더 1개로 통일" 이 나온 이유와 같다).',
  },
]
