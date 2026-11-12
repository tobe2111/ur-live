/** 🧬 주입 — 재방문 즉시 표시 범위 확대(정확히 네 주소). 가드: src/tests/unit/shell-sw-policy-2026-11-09.test.ts ⑧ */
const T = 'src/tests/unit/shell-sw-policy-2026-11-09.test.ts'
const F = 'public/shell-sw.js'
export default [
  { name: 'SW확대 — 예외를 접두사로 넓힌다(/my- 전부 저장)', file: F, find: '  if (DENY_EXACT_EXCEPT.indexOf(pathname) >= 0) return false\n', replace: "  if (pathname.indexOf('/my-') === 0) return false\n", test: T, why: '주문내역·쿠폰함 같은 개인 화면까지 폰에 저장된다.' },
  { name: 'SW확대 — 이용권 탭 예외를 뺀다(결재로 연 화면이 다시 닫힌다)', file: F, find: "var DENY_EXACT_EXCEPT = ['/my-vouchers']", replace: 'var DENY_EXACT_EXCEPT = []', test: T, why: '매장에서 QR 띄우는 화면 — 2026-11-12 대표 결정.' },
  { name: 'SW확대 — 지도 허용을 뺀다', file: F, find: '  /^\\/map$/,\n', replace: '', test: T, why: '2026-11-12 대표 결정.' },
]
