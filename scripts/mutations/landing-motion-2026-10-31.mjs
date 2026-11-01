/**
 * 🎬 랜딩 움직임 키트 — 되돌려-검증 주입 (2026-10-31).
 * 규칙은 `src/tests/unit/landing-motion-2026-10-31.test.tsx` 머리말에 있다.
 */
const T = 'src/tests/unit/landing-motion-2026-10-31.test.tsx'

export default [
  {
    name: '🎬 첫 화면 요소까지 숨긴다 (깜빡임 · JS 늦으면 빈 화면)',
    file: 'src/pages/landing/motion.tsx',
    find: `    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) return // 이미 보인다 — 건드리지 않는다\n`,
    replace: ``,
    test: T,
    why: '처음부터 보이는 히어로·제목이 opacity 0 으로 시작해 깜빡이고, 스크립트가 늦으면 그 자리가 빈 채로 남는다.',
  },
  {
    name: '🎬 동작 줄이기를 무시하고 숨긴다',
    file: 'src/pages/landing/motion.tsx',
    find: `    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return\n    const r = el.getBoundingClientRect()`,
    replace: `    if (!el || typeof IntersectionObserver === 'undefined') return\n    const r = el.getBoundingClientRect()`,
    test: T,
    why: '어지럼증 때문에 동작 줄이기를 켠 사람에게 움직임을 강요한다(접근성).',
  },
  {
    name: '🎬 흐르는 줄이 동작 줄이기에서 안 꺼진다',
    file: 'src/pages/landing/motion.css',
    find: `  .ur-float, .ur-float-late, .ur-marquee, .ur-scanline { animation: none; }\n`,
    replace: `  .ur-float, .ur-float-late, .ur-scanline { animation: none; }\n`,
    test: T,
    why: '계속 흐르는 화면은 동작 줄이기를 켠 사람에게 가장 괴로운 움직임이다.',
  },
  {
    name: '🎬 떠 있는 폰이 top 으로 움직인다 (밀림)',
    file: 'src/pages/landing/motion.css',
    find: `  50% { transform: translate3d(0, -12px, 0); }`,
    replace: `  50% { top: -12px; }`,
    test: T,
    why: 'top·margin 을 움직이면 매 프레임 레이아웃을 다시 계산하고 주변이 같이 밀린다.',
  },
  {
    name: '🎬 /influencer 가 키트를 빼고 따로 움직인다',
    file: 'src/pages/CreatorsPage.tsx',
    find: `        <ScrollProgress />\n`,
    replace: ``,
    test: T,
    why: '세 랜딩 중 하나만 다르게 움직이면 서로 다른 회사 페이지처럼 읽힌다.',
  },
  {
    name: '🎬 /about 이 점 찍은 가로 타임라인으로 돌아간다',
    file: 'src/pages/AboutServicePage.tsx',
    find: `              <StickyStory steps={STEPS} shotUrl={SHOT} />`,
    replace: `              <ol />`,
    test: T,
    why: '점 네 개짜리 가로 타임라인은 가장 흔한 AI 랜딩 그림이다(대표가 지적한 그 티).',
  },
]
