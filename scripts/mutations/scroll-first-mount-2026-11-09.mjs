/**
 * 🧬 주입 — 첫 화면을 내려 보던 사람을 앱이 맨 위로 끌어올리지 않는가 (2026-11-09)
 *    가드: src/tests/unit/scroll-first-mount-2026-11-09.test.tsx
 */
const T = 'src/tests/unit/scroll-first-mount-2026-11-09.test.tsx'
export default [
  {
    name: '첫마운트스크롤 — 하드로드 첫 마운트에 다시 맨 위로 올린다',
    file: 'src/components/ScrollToTop.tsx',
    find: "if (!(firstMount && navType === 'POP')) window.scrollTo(",
    replace: 'if (true) window.scrollTo(',
    test: T,
    why: '서버 첫 화면을 내려 보던 사람이 앱이 넘겨받는 순간 맨 위로 튕긴다(2026-11-09 대표 신고).',
  },
]
