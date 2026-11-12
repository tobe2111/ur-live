/** 🧬 주입 — 숙소 목록 PC 서버 첫 화면. 가드: src/tests/unit/stays-first-screen-2026-10-19.test.ts */
const T = 'src/tests/unit/stays-first-screen-2026-10-19.test.ts'
export default [
  { name: '숙소PC — 상단 네비를 안 그린다(앱 네비가 끼며 본문을 민다)', file: 'src/worker/utils/stays-first-screen.ts', find: "${pcPath ? pcTopNavBlockHtml(pcPath) : ''}", replace: '', test: T, why: '2026-11-12 — 교환권 상세가 같은 이유로 CLS 0.33.' },
  { name: '숙소PC — PC 에 첫 화면 CSS 를 안 넣는다(CLS 1.0 클래스)', file: 'src/worker/utils/css-first-boot.ts', find: "|| pathname === '/vouchers' || pathname === '/stays' ||", replace: "|| pathname === '/vouchers' ||", test: T, why: '그리는 곳엔 CSS 도 — 안 넣으면 hidden md:block 네비가 숨었다 나타난다.' },
]
