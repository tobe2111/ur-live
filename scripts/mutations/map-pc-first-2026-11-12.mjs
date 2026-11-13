/** 🧬 주입 — 지도 PC 서버 첫 화면. 가드: src/tests/unit/map-first-screen-2026-11-09.test.tsx */
const T = 'src/tests/unit/map-first-screen-2026-11-09.test.tsx'
const M = 'src/worker/utils/map-first-screen.ts'
export default [
  { name: '지도PC — 지도 네비에 딜 카테고리를 그린다(앱은 숨긴다)', file: M, find: 'pcTopNavBlockHtml(pcPath, { hideDealCats: true })', replace: 'pcTopNavBlockHtml(pcPath)', test: T, why: '앱 /map 은 hideDealCats — 마운트 때 메뉴 글자가 바뀐다.' },
  { name: '지도PC — 패널 클래스가 앱과 갈림', file: M, find: "panelGrid: 'grid grid-cols-7 gap-1'", replace: "panelGrid: 'grid grid-cols-6 gap-1'", test: T, why: '칸 수가 다르면 칩이 다른 줄에 선다.' },
  { name: '지도PC — PC 에 첫 화면 CSS 를 안 넣는다(교환권 상세 CLS 1.0 클래스)', file: 'src/worker/utils/css-first-boot.ts', find: "|| pathname === '/stays' || pathname === '/map' ||", replace: "|| pathname === '/stays' ||", test: T, why: '그리는 곳엔 CSS 도.' },
]
