/** 🧬 주입 — 피드 캐시 확인 시각 (2026-11-18) · 가드: src/tests/unit/d1-read-diet.test.ts */
const T = 'src/tests/unit/d1-read-diet.test.ts'
export default [
  { name: 'feedchecked: 다시 24행을 고쳐 쓴다', file: 'src/worker/cron/group-buy-feed-cache.ts',
    find: `      const t = await DB.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, datetime('now'))").bind(FEED_CHECKED_KEY).run()`,
    replace: `      const t = await DB.prepare("UPDATE group_buy_feed_cache SET computed_at = datetime('now')").run()`, test: T,
    why: '목록이 그대로인데 5분마다 24행을 다시 써 메인 쓰기의 13% 를 쓴다.' },
  { name: 'feedchecked: 소비자가 확인 시각을 안 본다', file: 'src/features/group-buy/api/feed-cache-age.ts',
    find: '  return chkAge < age ? chkAge : age', replace: '  return age', test: T,
    why: '10분 뒤부터 캐시를 버리고 매 요청 실시간 쿼리로 떨어진다(홈 피드 느려짐).' },
]
