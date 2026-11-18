/** 🧬 주입 — 셀러 등급제 철거 (2026-11-18) · 가드: src/tests/unit/seller-tier-teardown-2026-11-18.test.ts */
const T = 'src/tests/unit/seller-tier-teardown-2026-11-18.test.ts'
export default [
  { name: 'tierteardown: 예약 작업이 수수료를 다시 덮어쓴다', file: 'src/worker/cron/cache-prewarm.ts',
    find: 'const HOT_PATHS: readonly string[] = [\n',
    replace: "async function _x(DB: D1Database) { await DB.prepare(`UPDATE sellers SET commission_rate = 5 WHERE id = 1`).run() }\nvoid _x\nconst HOT_PATHS: readonly string[] = [\n", test: T,
    why: '어드민이 바꾼 셀러 수수료가 예약 작업에 의해 되돌아간다(철거 전 매주 그랬다).' },
  { name: 'tierteardown: 홈 묶음 예열이 돌아온다', file: 'src/worker/cron/cache-prewarm.ts',
    find: 'const HOT_PATHS: readonly string[] = [\n', replace: "const HOT_PATHS: readonly string[] = [\n  '/api/home/bundle',\n", test: T,
    why: '아무도 안 받는 응답을 5분마다 만들어 하루 수백만 행을 읽는다.' },
  { name: 'tierteardown: 옛 등급 링크가 404', file: 'src/routes/seller.routes.tsx',
    find: '      <Route path="/seller/tier" element={<SellerHomeGone />} />\n', replace: '', test: T,
    why: '알림·북마크의 옛 등급 링크가 빈 화면으로 떨어진다.' },
  { name: 'tierteardown: 빈 주간 슬롯을 지운다', file: 'src/worker/scheduled.ts',
    find: "ctx.waitUntil(slotCron('45 0 * * 1')('weekly-tier-batch',", replace: "ctx.waitUntil(slotCron('45 0 * * 1')('weekly-x',", test: T,
    why: '옛 하트비트가 약 8주 동안 늦음으로 빨갛게 남아 경보 채널을 덮는다.' },
]
