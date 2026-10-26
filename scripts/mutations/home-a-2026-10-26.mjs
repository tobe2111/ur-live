/**
 * 🏠 2026-10-26 모바일 홈 안 A(그루폰식) — 검색창 · 카테고리 원 · 섹션 가로 줄.
 *   화면과 워커 첫 화면이 같은 상수(`shared/home-chrome`)를 쓰고, 자리표시자와 진짜 섹션이 같은 모양이어야 한다.
 */
export default [
  {
    name: '🏠 안A — 섹션 자리표시자만 옛 2열 격자로 남는다(응답 순간 모양이 바뀌며 아래가 밀린다)',
    file: 'src/components/home/HomeSections.tsx',
    find: '              <div className={HOME_SECTION_RAIL}>\n                {[0, 1, 2, 3].map((i) => <DealCardPlaceholder key={i} />)}',
    replace: '              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-6">\n                {[0, 1, 2, 3].map((i) => <DealCardPlaceholder key={i} />)}',
    test: 'src/tests/unit/home-tablet-breakpoint.test.ts',
    why: '자리표시자와 진짜 섹션의 모양이 다르면 섹션 응답이 오는 순간 줄 높이가 바뀌어 아래 피드가 통째로 밀린다.',
  },
  {
    name: '🏠 안A — 워커가 유어쇼츠 원을 카테고리 스크롤 안에 넣는다(화면은 밖)',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '<nav aria-label="카테고리" class="${HOME_CATS.nav}">${cats}</nav>${shorts}</div>',
    replace: '<nav aria-label="카테고리" class="${HOME_CATS.nav}">${cats}${shorts}</nav></div>',
    test: 'src/tests/unit/home-ssr-first-screen-2026-10-08.test.tsx',
    why: '서버가 그린 첫 화면과 마운트한 화면의 원 배치가 다르면 마운트 때 유어쇼츠 원이 튄다.',
  },
  {
    name: '🏠 안A — 워커가 섹션을 옛 격자로 그린다(화면은 가로 줄)',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '  rail: HOME_SECTION_RAIL,',
    replace: "  rail: 'grid grid-cols-2 gap-x-3 gap-y-6',",
    test: 'src/tests/unit/home-ssr-first-screen-2026-10-08.test.tsx',
    why: '첫 화면이 2열이고 마운트가 가로 줄이면 첫 카드 넷이 마운트 순간 한 줄로 바뀌며 화면 전체가 튄다.',
  },
]
