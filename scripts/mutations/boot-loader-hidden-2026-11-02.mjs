/**
 * 🫥 2026-11-02 첫 진입 로딩 화면 숨김 — 시험: src/tests/unit/boot-loader-hidden-2026-11-02.test.tsx
 */
const T = 'src/tests/unit/boot-loader-hidden-2026-11-02.test.tsx'
export default [
  {
    name: '🫥 워커 정적 로더가 다시 보인다(유달이가 HTML 에서 뜬다)',
    file: 'src/worker/index.ts',
    find: 'justify-content:center;gap:20px;visibility:hidden">',
    replace: 'justify-content:center;gap:20px">',
    test: T,
    why: '대표 "아예 안 보이게".',
  },
  {
    name: '🫥 React 전체 화면 로더가 다시 보인다',
    file: 'src/components/brand/BrandLoader.tsx',
    find: "const hide = quiet || (fullScreen && !forceLight && !label) ? ' invisible' : ''",
    replace: "const hide = quiet ? ' invisible' : ''",
    test: T,
    why: '정적 로더만 숨기면 React 로 바뀌는 순간 유달이가 튄다.',
  },
  {
    name: '🫥 문구 있는 로더("결제 승인 중")까지 숨긴다',
    file: 'src/components/brand/BrandLoader.tsx',
    find: "const hide = quiet || (fullScreen && !forceLight && !label) ? ' invisible' : ''",
    replace: "const hide = quiet || fullScreen ? ' invisible' : ''",
    test: T,
    why: '결제 중에 빈 화면이면 멈춘 줄 안다.',
  },
]
