/**
 * 💸 동네공구 보증금 환불 멱등 기록 표 — 라우트(수동 환불)와 cron(만료 자동 환불)이 **같은 함수**로 만든다.
 *
 * 🩸 2026-11-24: 이 표를 만드는 코드가 라우트에만 있었다. cron 은 표를 만들지 않고
 *   `NOT EXISTS (SELECT 1 FROM community_group_buy_refunds …)` 로 읽어서, 라이브에 표가 없는 동안
 *   그 쿼리가 터졌고 `.catch(() => ({ results: [] }))` 가 삼켜 **자동 환불이 한 번도 돌지 않았다**
 *   (실측: 실패 그룹의 deposited 보증금 5,000딜이 묶여 있었다). 가드 `community-refund-table-2026-11-24.test.ts`.
 */
const _done = new WeakSet<object>()

export async function ensureCommunityRefundTable(DB: D1Database): Promise<void> {
  if (_done.has(DB)) return
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS community_group_buy_refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      refunded_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    )
  `).run()
  _done.add(DB)
}
