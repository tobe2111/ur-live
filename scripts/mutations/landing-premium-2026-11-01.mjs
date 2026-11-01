/**
 * 💎 랜딩 고급화(2026-11-01) — `landing-premium-2026-11-01.test.tsx` 가 실패할 수 있는지 확인하는 주입.
 */
const T = 'src/tests/unit/landing-premium-2026-11-01.test.tsx'
export default [
  {
    name: '💎 첫 화면이 실사진에서 옛 잉크 화면으로 돌아간다 (/influencer)',
    file: 'src/pages/CreatorsPage.tsx',
    find: '<PhotoHero photo="influencer">',
    replace: '<PhotoHero photo="about">',
    test: T,
    why: '세 페이지가 같은 화면을 나눠 쓰는 것과 그 페이지의 첫 화면이 사라지는 것은 다른 일인데, 빌드는 둘 다 초록이다.',
  },
  {
    name: '💎 첫 화면 사진이 lazy 로 늦게 뜬다',
    file: 'src/pages/landing/premium.tsx',
    find: "{...({ fetchpriority: 'high' } as Record<string, string>)}",
    replace: "loading=\"lazy\"",
    test: T,
    why: '첫 화면에서 가장 큰 그림이 늦게 오면 첫 인상이 잉크 바탕만 남는다. 에러는 0 이다.',
  },
  {
    name: '💎 화면 영상을 처음부터 다 받는다',
    file: 'src/pages/landing/premium.tsx',
    find: 'muted loop playsInline preload="none"',
    replace: 'muted loop playsInline preload="auto"',
    test: T,
    why: '보지도 않을 영상 200KB 를 랜딩을 연 모든 사장님 폰이 받는다.',
  },
  {
    name: '💎 바탕만 바뀌고 글자색은 안 바뀐다',
    file: 'src/pages/landing/premium.css',
    find: '  color: var(--tone-fg);\n  transition: background-color',
    replace: '  transition: background-color',
    test: T,
    why: '어두운 바탕으로 넘어가는 순간 검은 글자가 바탕에 묻힌다 — 글자를 읽는 중에 사라진다.',
  },
  {
    name: '💎 옅은 파랑을 다크에서 따로 안 정한다',
    file: 'src/pages/landing/premium.css',
    find: ".dark .ur-tone[data-tone-active='tint'] { --tone-bg: #16233D;",
    replace: ".dark .ur-tone[data-tone-active='tintx'] { --tone-bg: #16233D;",
    test: T,
    why: '다크 테마 글자(흰색)가 라이트 옅은 파랑 위에 앉으면 대비가 무너진다.',
  },
  {
    name: '💎 거대한 숫자를 화면 읽기 프로그램이 "구십 퍼센트" 두 번 읽는다',
    file: 'src/pages/landing/premium.tsx',
    find: '<p ref={ref} aria-hidden className="ur-giant select-none">',
    replace: '<p ref={ref} className="ur-giant select-none">',
    test: T,
    why: '숨은 설명과 그래픽 숫자를 둘 다 읽어 같은 말을 두 번 한다.',
  },
  {
    name: '💎 제목 글꼴이 본문 전체로 번진다',
    file: 'src/pages/landing/premium.css',
    find: '.ur-landing-type :is(h1, h2),\n',
    replace: '.ur-landing-type,\n',
    test: T,
    why: '본문까지 명조가 되면 작은 글자가 읽기 어려워지고, 기기 글꼴 결정(2026-10-15)을 조용히 뒤집는다.',
  },
  {
    name: '💎 동작 줄이기에서 바탕 전환이 안 꺼진다',
    file: 'src/pages/landing/premium.css',
    find: '  .ur-tone, .ur-share-bar > i { transition: none; }',
    replace: '  .ur-share-bar > i { transition: none; }',
    test: T,
    why: '움직임을 끈 사람에게도 화면 전체 색이 출렁인다.',
  },
]
