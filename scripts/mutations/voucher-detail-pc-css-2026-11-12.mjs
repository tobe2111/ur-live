/** 🧬 주입 — 교환권 상세 PC 첫 화면 CSS. 가드: src/tests/unit/css-first-boot-2026-10-12.test.ts */
export default [
  { name: '교환권상세PC — 첫 화면 CSS 를 다시 안 넣는다(CLS 1.0)', file: 'src/worker/utils/css-first-boot.ts', find: "|| /^\\/vouchers\\/\\d+\\/?$/.test(pathname) || pathname === '/vouchers' || pathname === '/stays' ||", replace: "|| pathname === '/vouchers' || pathname === '/stays' ||", test: 'src/tests/unit/css-first-boot-2026-10-12.test.ts', why: '2026-11-12 배포 뒤 실측 — 네비가 숨었다가 나타나 본문 전체가 밀렸다(CLS 1.0).' },
]
