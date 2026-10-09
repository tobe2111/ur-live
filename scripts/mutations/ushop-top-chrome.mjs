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
    // 🩸 2026-10-09 재조준: 그 줄이 **삼항**이 됐다(방문자에게도 자리를 `invisible` 로 비워 둔다 —
    //   `CuratorHeader` 의 🪑). 결함은 그대로 "주인이 관리 버튼을 못 본다" 이고 앵커만 옮긴다.
    find: "            {canEdit ? (\n              <Link to=\"/u/me/manage\"",
    replace: "            {false ? (\n              <Link to=\"/u/me/manage\"",
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '대표가 시안을 보고 **직접 짚은 항목**이다(*"편집? 관리 버튼 들어가야 해"*). ' +
      '줄을 줄이려다 버튼을 없애면 주인이 자기 샵을 고칠 길이 사라진다 — 그 화면이 유일한 편집 경로다.',
  },
  {
    name: '상단1안 — 칩이 다시 자기 줄을 소유한다',
    file: 'src/pages/curator-page/PinCategoryChips.tsx',
    find: 'className="flex-1 min-w-0 flex overflow-x-auto scrollbar-hide"',
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
  /*
   * 🩸 2026-09-29 (대표 *"배고프다 뭐먹지?는 아예 빼기"*) — 이 자리에 있던 두 주입은
   *   `HeaderMarquee.tsx` 의 `lg:` 분기를 깨뜨려 **PC 에서 흐르는가 / PC 에서 사라지는가**를 봤다.
   *   그 부품이 삭제돼 앵커가 없어졌다(`check-stale-mutation-anchors` 가 잡았다).
   *   ⇒ **지우지 않고 재조준한다.** 지켜야 할 것이 "PC 에서 잘 흐르는가" 에서
   *     **"조용히 되살아나지 않는가"** 로 뒤집혔을 뿐이고, 되살아나는 길은 둘이다.
   *   ⚠️ 두 길을 **따로** 심는다 — `ushop-console-refresh.mjs` 의 두 주입은 각각
   *     `animate-marquee`·`흐르는 문구` 를 앵커하므로 아래 둘(`HeaderMarquee` 이름 ·
   *     `headlineVal` 상태)은 그 어느 것도 대신 검증하지 않는다.
   */
  {
    name: '상단1안 — 마퀴 부품을 import 만 되살린다 (렌더 없이 조용히)',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: "import { snsUrl } from '@/utils/sns-url'",
    replace: "import { snsUrl } from '@/utils/sns-url'\nimport HeaderMarquee from './HeaderMarquee'",
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '부활은 보통 렌더가 아니라 **참조**로 시작한다 — 파일을 되살려 import 해 두고 렌더는 다음 커밋에 ' +
      '붙이는 식이다. 그 순간을 못 보면 가드는 "마퀴가 없다" 를 이름이 아니라 애니메이션 클래스로만 ' +
      '지키게 되고, 부품이 클래스를 바꿔 돌아오면 통째로 샌다.',
  },
  {
    name: '상단1안 — 표시 자리 없이 편집 상태만 되살린다 (headlineVal)',
    file: 'src/pages/ushop-manage/ShopInfoCards.tsx',
    find: '  const [handleVal, setHandleVal] = useState(curator.handle)',
    replace:
      '  const [handleVal, setHandleVal] = useState(curator.handle)\n' +
      "  const [headlineVal, setHeadlineVal] = useState('')",
    test: 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts',
    why:
      '라벨 문구(`흐르는 문구`)만 안 쓰고 상태·저장 배선을 되살리면 주인이 **아무도 못 보는 값**을 ' +
      '계속 저장한다. 에러도 안 나고 빌드도 통과한다 — 이 레포가 반복해 당한 "실패가 아니라 조용한 부재".',
  },
]
