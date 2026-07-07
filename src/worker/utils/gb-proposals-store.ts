/**
 * 🎟️ 공구 제안(양방향) 스토어 — 2026-07-06 공구 엔진 §2-B
 *   인플루언서→매장 / 매장→인플루언서 제안을 한 테이블(gb_proposals)에 담고 상대방이 승인.
 *   승인 시 gb-session-store.saveGbSession 으로 공구 open(proposerId=인플루언서). 컬럼 예산 동결(전용 테이블).
 */
const _ensured = new WeakSet<object>()

export async function ensureGbProposalsTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS gb_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      seller_id INTEGER,
      influencer_id TEXT NOT NULL,
      proposed_by TEXT NOT NULL,
      deadline DATETIME,
      price INTEGER,
      promo_pct REAL,
      target INTEGER,
      message TEXT,
      status TEXT DEFAULT 'proposed',
      response_note TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      responded_at DATETIME
    )`).run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_gb_proposals_seller ON gb_proposals(seller_id, status)").run().catch(() => {})
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_gb_proposals_inf ON gb_proposals(influencer_id, status)").run().catch(() => {})
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_gb_proposals_product ON gb_proposals(product_id, status)").run().catch(() => {})
  } catch { /* 이미 존재 / best-effort */ }
}

export type GbProposalDirection = 'influencer' | 'seller'
export type GbProposalStatus = 'proposed' | 'approved' | 'rejected' | 'withdrawn'

export interface GbProposalRow {
  id: number
  product_id: number
  seller_id: number | null
  influencer_id: string
  proposed_by: GbProposalDirection
  deadline: string | null
  price: number | null
  promo_pct: number | null
  target: number | null
  message: string | null
  status: GbProposalStatus
  response_note: string | null
  created_at: string
  responded_at: string | null
}
