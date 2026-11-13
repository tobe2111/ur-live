/** 🧬 주입 — 숙소 상세 PC 첫 화면(네비 + CSS). 가드: src/tests/unit/stay-detail-ssr-first-screen-2026-10-12.test.ts */
const T = 'src/tests/unit/stay-detail-ssr-first-screen-2026-10-12.test.ts'
export default [
  { name: '숙소상세PC — 상단 네비를 다시 안 그린다', file: 'src/worker/utils/stay-detail-ssr-body.ts', find: "(pcPath ? pcTopNavBlockHtml(pcPath) : '') +", replace: '', test: T, why: '2026-11-13 PC 실측 CLS 1.0 의 한 원인(앱 네비 114px).' },
  { name: '숙소상세PC — PC 에 첫 화면 CSS 를 다시 안 넣는다', file: 'src/worker/utils/css-first-boot.ts', find: '|| /^\\/(?:vouchers|stays)\\/\\d+\\/?$/.test(pathname) ||', replace: '|| /^\\/vouchers\\/\\d+\\/?$/.test(pathname) ||', test: T, why: 'CSS 가 없으면 lg:hidden 폰 본문이 PC 에 보였다가 사라진다(CLS 1.0).' },
]
