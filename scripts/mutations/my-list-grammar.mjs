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
    // 🔵 2026-09-29(안 C) — 되돌리려는 사고: 행이 다시 두꺼워지는 것. 빌드도 화면도 안 깨지고
    //   목적지도 그대로인데, 첫 화면에 들어오는 줄이 13 → 7 로 줄어든다(실측).
    name: '🔵 평면 행이 다시 두꺼워진다 (첫 화면 줄 수가 반으로 준다)',
    file: 'src/pages/user-profile/list-grammar.tsx',
    // 🔁 2026-09-30 재조준: 행 기하가 `ROW_GEOM_CLS` 로 분리됐다(설정 줄이 같은 치수를 쓰려고).
    //   지키려던 불변식(*행이 다시 두꺼워지지 않는다*)은 그대로 — 앵커만 새 상수로.
    find: "export const ROW_GEOM_CLS = 'w-full flex items-center gap-3 px-4 min-h-[48px] py-2 text-left'",
    replace: "export const ROW_GEOM_CLS = 'w-full flex items-center gap-3 px-4 min-h-[56px] py-3 text-left'",
    test: TEST,
    why: '안 C 의 이득은 전부 밀도에서 나온다 — 행이 70px 이던 시절 폰 한 화면에 손님 줄이 0개였다.',
  },
  {
    name: '🔵 오른쪽 값이 다시 제목 아래 설명 줄이 된다',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: '        <span className="min-w-0 text-[13px] text-gray-500 dark:text-gray-400 truncate">{hint}</span>',
    replace: '        <span className="block text-[13px] text-gray-500 dark:text-gray-400">{hint}</span>',
    test: TEST,
    why: '설명이 줄 아래로 내려가면 행이 두 줄이 되고, 그게 정확히 09-28 이전 문법이다.',
  },
  {
    name: '🧾 손님 목록이 다시 제 손으로 줄을 그린다 (문법 두 벌)',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: '          <ListRow\n',
    replace: '          <button type="button" className="text-[13px]" />\n          <ListRow\n',
    test: TEST,
    why: '이 파일이 제 버튼을 그리기 시작하면 그 순간 판매 쪽과 문법이 갈린다 — 09-28 이전 상태로 되돌아가는 길이다.',
  },
  {
    // 🔁 2026-09-29 재조준(안 C): 손님 쪽에는 그룹도 판도 없다 — **판이 곧 "파는 쪽" 표시자**라
    //   손님 목록이 판 위에 올라가는 순간 그 표시가 무의미해진다. 그게 지금 지킬 불변식이다.
    name: '🧾 손님 목록이 다시 판 위에 올라간다 (판이 파는 쪽 표시자인데 둘이 된다)',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: '    <div className="ur-content-medium lg:px-4">',
    replace: '    <div className="ur-content-medium lg:px-4 rounded-2xl bg-surface shadow-lift">',
    test: TEST,
    why: '판이 파는 쪽 표시자가 됐다(안 C). 손님 쪽에도 판이 서면 화면이 무엇이 파는 쪽인지 말을 못 한다.',
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
    find: '      {count != null ? (',
    replace: '      {(count ?? 0) >= 0 ? (',
    test: TEST,
    why: '`undefined` 는 "아직 모른다" 이고 0 은 "없다" 다. 섞으면 조회 실패가 "0장" 이라는 거짓말이 된다.',
  },
  {
    name: '🧾 바로가기 목록이 테두리 판으로 되돌아간다',
    file: 'src/pages/user-profile/RoleCtaGrid.tsx',
    find: '      <div>\n        {dashboardItems.map(Row)}',
    replace: '      <div className="rounded-2xl bg-surface border border-line overflow-hidden">\n        {dashboardItems.map(Row)}',
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
