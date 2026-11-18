/** 🧬 주입 — 교환권 카테고리 캐시 (2026-11-18) · 가드: src/tests/unit/voucher-categories-cache-2026-11-18.test.ts */
const T = 'src/tests/unit/voucher-categories-cache-2026-11-18.test.ts'
export default [
  { name: 'vcatcache: 동기화가 캐시를 안 비운다', file: 'src/worker/cron/kt-alpha-catalog-sync.ts',
    find: '  if (synced > 0) await (env as unknown', replace: '  if (false) await (env as unknown', test: T,
    why: '새 교환권이 들어와도 카테고리 목록이 최대 6시간 옛것으로 보인다.' },
  { name: 'vcatcache: 수명이 5분으로 돌아간다', file: 'src/worker/routes/public-utility.routes.ts',
    find: '{ expirationTtl: VOUCHER_CATEGORIES_KV_TTL_S }', replace: '{ expirationTtl: 300 }', test: T,
    why: '하루 150번 다시 계산하고 KV 쓰기 한도의 29% 를 쓴다.' },
]
