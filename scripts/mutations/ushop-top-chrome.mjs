/**
 * 🔧 2026-09-28 (대표 확정 **상단 1안**) 주입 — 유어샵 모바일 상단.
 *
 * 지키는 것 넷: **SNS 가 전용 줄을 안 쓴다 · 공유/관리 버튼은 남는다 ·
 * 칩이 정렬과 줄을 나눠 쓴다 · 빈 진열대 판정은 칩 부품이 혼자 한다.**
 * 아래 결함을 심으면 `ushop-top-chrome-2026-09-28.test.ts` 가 빨간불이어야 한다.
 */
export default [
  {
    name: '상단1안 — SNS 를 다시 자기 줄로 내린다',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: '            {snsLinks}\n',
    replace: '',
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      'SNS 를 버튼 그룹에서 빼면 아이콘이 화면에서 사라지거나(또는 옛 전용 줄이 부활해) ' +
      '36px + 여백이 통째로 돌아온다. 라이브 실측으로 첫 상품 y 가 185 → 287 로 되돌아가는 자리다.',
  },
  {
    name: '상단1안 — 관리 버튼을 없앤다',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: "            {canEdit && (\n              <Link to=\"/u/me/manage\"",
    replace: "            {false && (\n              <Link to=\"/u/me/manage\"",
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '대표가 시안을 보고 **직접 짚은 항목**이다(*"편집? 관리 버튼 들어가야 해"*). ' +
      '줄을 줄이려다 버튼을 없애면 주인이 자기 샵을 고칠 길이 사라진다 — 그 화면이 유일한 편집 경로다.',
  },
  {
    name: '상단1안 — 칩이 다시 자기 줄을 소유한다',
    file: 'src/pages/curator-page/PinCategoryChips.tsx',
    find: 'className="flex-1 min-w-0 flex gap-2 overflow-x-auto scrollbar-hide"',
    replace: 'className="max-w-3xl mx-auto px-4 pt-3 flex gap-2 overflow-x-auto scrollbar-hide"',
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '부품이 바깥 여백을 도로 가져가면 호출부의 병합 줄 안에서 두 번 패딩이 걸리고, ' +
      '정렬과 한 줄을 나눠 쓰던 구조가 조용히 깨진다(화면은 뜨는데 줄만 두꺼워진다).',
  },
  {
    name: '상단1안 — 호출부에 칩 개수 게이트를 되살린다',
    file: 'src/pages/CuratorPage.tsx',
    find: '                  <PinCategoryChips pins={pins} value={cat} onChange={setCat} />',
    replace: '                  {pins.length > 6 && <PinCategoryChips pins={pins} value={cat} onChange={setCat} />}',
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '게이트가 부품과 호출부 두 곳에 있으면 언젠가 갈린다. 2026-09-28 에 없앤 `CHIPS_MIN_PINS = 7` 이 ' +
      '바로 그 형태였고, 라이브 최다 핀이 5개라 **그 게이트는 한 번도 열린 적이 없었다**.',
  },
  {
    name: '상단1안 — 정렬만 든 줄을 다시 만든다',
    file: 'src/pages/CuratorPage.tsx',
    find: '                  <div className="ml-auto shrink-0">\n                    <SortMenu value={sort} options={SORT_OPTIONS} onChange={setSort} />',
    replace: '                  <div className="ml-auto shrink-0">\n                    <SortMenu value={sort} options={SORT_OPTIONS} onChange={setSort} />\n                    <SortMenu value={sort} options={SORT_OPTIONS} onChange={setSort} />',
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '정렬이 두 자리에 그려지면 옛 32px 줄이 되살아난 것과 같다. 개수로 고정해 둔다 — ' +
      '"버튼 하나를 위해 줄 하나" 가 이 작업이 없앤 바로 그 낭비다.',
  },
  {
    name: '상단1안 — 빈 줄 접기(empty:hidden)를 뺀다',
    file: 'src/pages/CuratorPage.tsx',
    find: 'flex items-center gap-2 empty:hidden',
    replace: 'flex items-center gap-2',
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why: '칩도 정렬도 없는 날(미래에 정렬이 조건부가 되면) 빈 줄의 여백만 남는다.',
  },
  {
    name: '상단1안 — PC 에도 모바일 브랜드 바를 그린다 (상단 바 두 번)',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: '<div className="lg:hidden flex items-center px-4 pt-3">',
    replace: '<div className="flex items-center px-4 pt-3">',
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '1440px 실측: 화면 맨 위 전역 네비(`urdeal.` + 검색·찜·장바구니)가 있는데 좌측 프로필 카드 ' +
      '**안에서** 같은 말을 또 한다. 모바일용으로 만든 줄이 PC 에 새는 전형이다.',
  },
  {
    name: '상단1안 — PC 에서도 문구를 흐르게 한다 (300px 칸에서 양끝 잘림)',
    file: 'src/pages/curator-page/HeaderMarquee.tsx',
    find: '<div className="lg:hidden animate-marquee py-2">',
    replace: '<div className="animate-marquee py-1.5">',
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      'PC 유어샵 헤더는 좌측 **300px** 칸에 들어간다(a3/P1). 거기서 흐르면 `지? … 배고프다 뭐` 로 ' +
      '시작·끝난다 — 흐르는 이유는 폰의 좁은 폭인데 이 칸은 더 좁아서 흐름이 문제를 키운다.',
  },
  {
    name: '상단1안 — PC 에서 문구를 통째로 숨긴다 (주인이 쓴 글이 사라진다)',
    file: 'src/pages/curator-page/HeaderMarquee.tsx',
    find: '<p className="hidden lg:block px-3 py-2 text-[12px] font-bold tracking-wide leading-snug">',
    replace: '<p className="hidden px-3 py-1.5 text-[12px] font-bold tracking-wide leading-snug">',
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '잘리는 걸 고치겠다고 `lg:hidden` 만 걸면 PC 방문자에게 주인의 공지가 **통째로 사라진다.** ' +
      '고치는 것과 없애는 것은 다르다.',
  },
]
