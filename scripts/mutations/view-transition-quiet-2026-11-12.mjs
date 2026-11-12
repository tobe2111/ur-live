/** 🧬 주입 — 화면 전환 거절 처리. 가드: src/tests/unit/view-transition-quiet-2026-11-12.test.ts */
const T = 'src/tests/unit/view-transition-quiet-2026-11-12.test.ts'
export default [
  { name: '전환거절 — ready 거절을 안 받는다', file: 'src/lib/vt-quiet.ts', find: '  vt.ready?.catch(swallow)\n', replace: '', test: T, why: '2026-11-12 Sentry JAVASCRIPT-REACT-37 — ready 거절이 unhandledrejection 으로 보고됐다.' },
  { name: '전환거절 — 카드→상세 전환이 감싸기를 뺀다', file: 'src/lib/deal-view-transition.ts', find: 'const vt = quietVt(doc.startViewTransition!(async () => {', replace: 'const vt = (doc.startViewTransition!(async () => {', test: T, why: '숙소 상세에서 실제로 난 자리.' },
  { name: '전환거절 — 지도 알약이 감싸기를 뺀다', file: 'src/pages/mobile-home/MapPill.tsx', find: "quietVt(doc.startViewTransition(() => { flushSync", replace: "(doc.startViewTransition(() => { flushSync", test: T, why: '같은 클래스.' },
]
