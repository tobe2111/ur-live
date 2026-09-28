/**
 * 🧾 마이 목록 문법 한 벌 (2026-09-28, 대표 *"페이지 디자인 및 UI 퀄리티가 너무 허술해"*) — 주입 매니페스트.
 * 가드: src/tests/unit/my-list-grammar-2026-09-28.test.ts · src/tests/unit/account-pc-pane.test.ts
 *
 * 되돌리려는 사고는 하나다 — **같은 화면의 목록이 또 제 문법을 갖는 것.**
 * 09-28 실측에서 마이 한 화면에 목록이 셋이었고 셋 다 달랐다(라벨 위치·판 개수·글자 크기·테두리).
 * 에러가 안 나고 테스트도 안 깨지는 종류라, 되돌아가는 것을 막을 방법은 주입뿐이다.
 */
const TEST = 'src/tests/unit/my-list-grammar-2026-09-28.test.ts'
const PC = 'src/tests/unit/account-pc-pane.test.ts'

export default [
  {
    name: '🧾 손님 목록이 다시 제 손으로 줄을 그린다 (문법 두 벌)',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: '              <ListRow\n',
    replace: '              <button type="button" className="text-[13px]" />\n              <ListRow\n',
    test: TEST,
    why: '이 파일이 제 버튼을 그리기 시작하면 그 순간 판매 쪽과 문법이 갈린다 — 09-28 이전 상태로 되돌아가는 길이다.',
  },
  {
    name: '🧾 그룹 라벨이 판 **안**으로 들어간다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: '          <GroupLabel>{g.label}</GroupLabel>\n          <ListPlate>\n',
    replace: '          <ListPlate>\n            <GroupLabel>{g.label}</GroupLabel>\n',
    test: TEST,
    why: '라벨이 판 안으로 들어가면 훑을 단위가 사라진다(종전 13행 한 덩어리가 정확히 그 모양이었다).',
  },
  {
    name: '🧾 판 클래스가 판매 쪽과 갈린다',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: "export const LIST_PLATE_CLS = 'rounded-2xl bg-surface shadow-lift overflow-hidden'",
    replace: "export const LIST_PLATE_CLS = 'rounded-xl bg-surface border border-line overflow-hidden'",
    test: TEST,
    why: '한쪽 판만 바뀌면 두 구역이 조용히 달라진다. 테두리는 표면 규칙 ①(카드 테두리 0) 위반이기도 하다.',
  },
  {
    name: '🔢 0 이 다시 굵은 잉크가 된다 ("당신은 0" 이라고 알리는 화면)',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: "            count > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'",
    replace: "            'text-gray-900 dark:text-white'",
    test: TEST,
    why: '0 을 강조하면 화면이 없는 것을 알린다 — 09-01 잔액 슬래브에서 이미 값을 치른 판단이다.',
  },
  {
    name: '🔢 모르는 값을 0 으로 그린다',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: '      {count != null && (',
    replace: '      {(count ?? 0) >= 0 && (',
    test: TEST,
    why: '`undefined` 는 "아직 모른다" 이고 0 은 "없다" 다. 섞으면 조회 실패가 "0장" 이라는 거짓말이 된다.',
  },
  {
    name: '🧾 바로가기 목록이 테두리 판으로 되돌아간다',
    file: 'src/pages/user-profile/RoleCtaGrid.tsx',
    find: '          <ListPlate>{dashboardItems.map(Row)}</ListPlate>',
    replace: '          <div className="rounded-2xl bg-surface border border-line overflow-hidden">{dashboardItems.map(Row)}</div>',
    test: TEST,
    why: '이 파일이 09-28 이전에 갖고 있던 세 번째 문법이다(테두리 판). 규칙 ① 위반이고 옆 목록과 갈린다.',
  },
  {
    name: '🧭 PC 좌측 내비가 살아난다 (같은 목적지가 두 번)',
    file: 'src/pages/UserProfilePage.tsx',
    find: '      <div className="ur-account-pc">\n        <div className="ur-account-pane min-w-0">',
    replace: '      <div className="ur-account-pc">\n        <AccountSideNav />\n        <div className="ur-account-pane min-w-0">',
    test: PC,
    why: '09-02 에 고친 "같은 항목을 두 번" 이 되살아나는 경로다(내비 7항목 중 넷이 우측 열과 중복이었다).\n'
      + '🩸 첫 판은 이 자리를 **주석**(`{/* AccountSideNav */}`)으로 심었는데 가드가 통과했다 — 그 시험은\n'
      + '   주석을 걷어낸 소스를 보므로 당연한 일이고, **주석은 렌더되지 않으니 결함도 아니다.**\n'
      + '   ⇒ 가드를 고치는 대신 주입을 바로잡았다(렌더를 되살리는 것으로).\n'
      + '⚠️ 주입이 못 건드리는 것: `AccountSideNav.tsx` 파일 자체의 부활(러너는 파일을 새로 못 만든다).\n'
      + '   그 절반은 시험의 `existsSync` 가 본다. 그리고 **다른 이름의** 같은 내비는 둘 다 못 잡는다.',
  },
  {
    name: '🧭 PC 우측 칸에 같은 목적지가 두 번 생긴다',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    // 🔁 2026-09-28 재조준: 아이콘이 lucide `Heart` → 유어딜 `HeartIcon` 으로 바뀌어 앵커만 옮겼다.
    //    불변식("같은 목적지가 두 번 나오지 않는다")은 그대로다.
    find: "    { Icon: HeartIcon, label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), path: '/wishlist', count: counts.wish ?? undefined },",
    replace: "    { Icon: HeartIcon, label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), path: '/wishlist', count: counts.wish ?? undefined },\n    { Icon: HeartIcon, label: '이용권 또', path: '/my-vouchers' },",
    test: PC,
    why: '한 화면에 같은 곳으로 가는 문이 둘이면 사람이 "둘이 다른 것" 이라고 읽는다 — 좌측 내비를 걷어낸 이유가 그것이다.',
  },
]
