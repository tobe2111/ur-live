/** 🧬 주입 — 유어쇼츠 목록 서버 첫 화면의 두 벌이 갈리거나 배선이 빠지면 가드가 잡는가. 가드: src/tests/unit/urshorts-first-screen-2026-11-09.test.tsx */
const T = 'src/tests/unit/urshorts-first-screen-2026-11-09.test.tsx'
export default [
  {
    name: '🎬 유어쇼츠 첫 화면 배선을 뺀다(첫 글자 2.0초로 회귀)',
    file: 'src/worker/index.ts',
    find: "else if (url.pathname === '/urshorts' && ssrPayload && shouldRenderMobileFirstScreen(c.req.header('user-agent'))) {",
    replace: "else if (false && url.pathname === '/urshorts' && ssrPayload) {",
    test: T,
    why: '라이브 실측(2026-11-09) 첫 글자 2.0초 — 로더만 보이다 앱이 켜져야 목록이 그려졌다.',
  },
  {
    name: '🎬 카드 사진 클래스가 React 와 갈린다',
    file: 'src/worker/utils/urshorts-first-screen.ts',
    find: "  img: 'h-full w-full object-cover',",
    replace: "  img: 'h-full w-full object-contain',",
    test: T,
    why: '두 벌이 갈리면 마운트 때 사진 칸이 바뀐다(에러 0).',
  },
  {
    name: '🎬 칩 줄 최소 개수 규칙을 무시하고 늘 그린다',
    file: 'src/worker/utils/urshorts-first-screen.ts',
    find: '  if (facets.length < MIN_FACETS_TO_SHOW) return \'\'',
    replace: '  if (facets.length < 1) return \'\'',
    test: T,
    why: '화면은 둘 미만이면 안 그린다 — 서버만 그리면 마운트 때 그 줄 높이만큼 격자가 올라간다.',
  },
  {
    name: '🎬 시드 첫 렌더에도 등장 애니메이션을 건다(이미 보이던 카드가 다시 커진다)',
    file: 'src/pages/UrShortsBrowsePage.tsx',
    find: "className={seeded ? undefined : 'ur-vc-in'}",
    replace: 'className="ur-vc-in"',
    test: T,
    why: '서버 첫 화면이 보여 준 카드 위에서 React 가 같은 카드를 .94→1 로 키우면 깜빡임으로 보인다.',
  },
]
