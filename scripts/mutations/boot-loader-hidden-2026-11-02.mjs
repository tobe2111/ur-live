/**
 * 🫥 2026-11-02 첫 진입 로딩 화면 "섞기"(0.5초 안이면 안 보임) — 시험: src/tests/unit/boot-loader-hidden-2026-11-02.test.tsx
 */
const T = 'src/tests/unit/boot-loader-hidden-2026-11-02.test.tsx'
export default [
  {
    name: '🫥 워커 정적 로더가 바로 보인다(빠른 로딩에도 막대가 번쩍)',
    file: 'src/worker/index.ts',
    find: "brandLoaderMarkup(4, true) + '</div>';",
    replace: "brandLoaderMarkup(4) + '</div>';",
    test: T,
    why: '대표 "섞기" — 0.5초 안에 뜨면 아무것도 안 보여야 한다.',
  },
  {
    name: '🫥 React 전체 화면 로더가 바로 보인다',
    file: 'src/components/brand/BrandLoader.tsx',
    find: 'const shy = quiet || (fullScreen && !forceLight && !label)',
    replace: 'const shy = quiet',
    test: T,
    why: '정적 로더만 숨기면 React 로 바뀌는 순간 막대가 튄다.',
  },
  {
    name: '🫥 문구 있는 로더("결제 승인 중")까지 숨긴다',
    file: 'src/components/brand/BrandLoader.tsx',
    find: 'const shy = quiet || (fullScreen && !forceLight && !label)',
    replace: 'const shy = quiet || fullScreen',
    test: T,
    why: '결제 중에 0.5초 빈 화면이면 멈춘 줄 안다.',
  },
  {
    name: '🫥 동작 줄이기 사용자에겐 로더가 영영 안 나타난다',
    file: 'src/shared/brand-loader-markup.ts',
    find: '.ur-ldr-shy{animation-duration:.01s}',
    replace: '.ur-ldr-shy{animation:none}',
    test: T,
    why: 'animation:none 이면 opacity:0 에 머문다 — 느린 회선에서 빈 화면만 남는다.',
  },
]
