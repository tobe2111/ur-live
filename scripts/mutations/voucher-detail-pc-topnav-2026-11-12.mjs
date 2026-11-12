/** 🧬 주입 — 교환권 상세 PC 상단 네비. 가드: src/tests/unit/voucher-detail-pc-topnav-2026-11-12.test.ts */
const T = 'src/tests/unit/voucher-detail-pc-topnav-2026-11-12.test.ts'
export default [
  { name: '교환권상세PC — 네비 자리를 다시 안 그린다(CLS 0.33)', file: 'src/worker/utils/voucher-detail-ssr-body.ts', find: "(pcPath ? pcTopNavBlockHtml(pcPath) : '') +", replace: '', test: T, why: '2026-11-12 PC 실측 — 본문 전체가 114px 내려갔다.' },
  { name: '교환권상세PC — 켜짐 규칙이 접두사만 본다(/vouchersX 도 켜짐)', file: 'src/worker/utils/pc-topnav-first-screen.ts', find: "return cur === path || cur.startsWith(path + '/')", replace: 'return cur.startsWith(path)', test: T, why: '앱 isActivePath 와 같은 규칙이어야 켜짐 점이 안 튄다.' },
]
