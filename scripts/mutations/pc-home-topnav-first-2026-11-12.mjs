/** 🧬 주입 — PC 홈 상단 네비 서버 렌더. 가드: src/tests/unit/pc-home-topnav-first-2026-11-12.test.ts */
const T = 'src/tests/unit/pc-home-topnav-first-2026-11-12.test.ts'
const W = 'src/worker/utils/pc-home-first-screen.ts'
export default [
  { name: '상단네비 — 첫 화면이 빈 줄로 돌아감', file: W, find: '${navRow1}</div>', replace: '</div>', test: T, why: '2026-11-12 대표 캡처 — 맨 위 줄이 비어 있다.' },
  { name: '상단네비 — 생활이 /?category= 로 감', file: W, find: "key === 'home_voucher' ? '/life'", replace: "key === 'never' ? '/life'", test: T, why: '앱은 생활을 /life 로 보낸다.' },
  { name: '상단네비 — 아이콘 자리 빠짐(글자가 16px 튐)', file: W, find: '<span class="w-4 h-4" aria-hidden="true"></span>', replace: '', test: T, why: '앱 항목은 아이콘 16px + gap 8 뒤에 글자.' },
  { name: '상단네비 — 클래스가 앱과 갈림', file: 'src/shared/pc-topnav-first.ts', find: "row2Nav: 'h-11 flex", replace: "row2Nav: 'h-12 flex", test: T, why: '두 벌이 갈리면 헤더 교체 때 줄 높이가 튄다.' },
]
