/** 🏠 2026-11-03 홈 맨 위(로고 줄·위치 줄) 서버 첫 화면 — 시험: src/tests/unit/home-top-row-ssr-2026-11-03.test.tsx */
const T = 'src/tests/unit/home-top-row-ssr-2026-11-03.test.tsx'
export default [
  {
    name: '🏠 서버 첫 화면 로고 줄이 다시 빈 상자',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '    `<a href="/" aria-label="홈" class="shrink-0 flex items-center">${HOME_TOP_LOGO}</a>` +',
    replace: '',
    test: T,
    why: '대표 "윗부분 … 로고 … 되게 느려 처음에" — 앱 부팅 뒤에야 로고가 떴다.',
  },
  {
    name: '🏠 서버 첫 화면 동네 이름이 다시 공백',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '<span class="${HOME_FS_CLASS.locLabel}">${escText(locLabel)}</span>',
    replace: '<span class="${HOME_FS_CLASS.locLabel}">&nbsp;</span>',
    test: T,
    why: "'동탄5동' 이 앱 부팅 뒤에야 떴다.",
  },
  {
    name: '🏠 화면이 동네 이름을 쿠키로 안 남김(다음 첫 화면이 늘 전국)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '    try { document.cookie = homeLocLabelCookie(topLocLabel) } catch { /* 쿠키 막힘 — 서버는 \'전국\' */ }',
    replace: '    void topLocLabel',
    test: T,
    why: '쿠키가 없으면 서버는 늘 전국을 그리고 화면이 바꾼다.',
  },
]
