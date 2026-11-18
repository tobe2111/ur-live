/**
 * 🧾 2026-11-18 인플루언서 현금 지급의 원천징수 장부 — 대표 승인 "원천징수 기록·기본값".
 *   종전: 지급 경로(`marketing/payouts.ts`)가 원천징수를 **계산만** 하고 어디에도 안 남겼다. 어드민 원천징수 요약·지급명세서는
 *   `tax_withholding_log` 만 읽으므로 인플루언서 지급이 빠졌다(지급 실적 0 이라 아직 손실 없음 — 첫 지급 전에).
 *   ⚠️ 그 표에 넣지 않는 이유: `seller_id` 칸을 셀러 표와 JOIN 하는 화면이 5곳이라, 인플루언서 user id 가 같은 번호의
 *   셀러에게 잘못 붙는다. 그래서 같은 모양의 **별도 표**에 적고, 월 합계(admin-tax)만 두 표를 더한다.
 */
export interface InfluencerWithholdingRow {
  influencerId: string
  gross: number
  withholdingPct: number
  withholding: number
  net: number
  sourceId: string
}

const _ensured = new WeakSet<object>()
async function ensureTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS influencer_withholding_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    influencer_id TEXT NOT NULL,
    payout_year INTEGER NOT NULL,
    payout_month INTEGER NOT NULL,
    gross_amount INTEGER NOT NULL,
    withholding_rate REAL NOT NULL,
    withholding_amount INTEGER NOT NULL,
    net_amount INTEGER NOT NULL,
    source_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_withholding_source ON influencer_withholding_log(source_id)').run().catch(() => null)
}

/** 한 건 기록 — 멱등(같은 source_id 는 한 번만). 실패해도 지급을 막지 않는다(호출부가 로그만). */
export async function logInfluencerWithholding(DB: D1Database, r: InfluencerWithholdingRow, now = new Date()): Promise<boolean> {
  await ensureTable(DB)
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const res = await DB.prepare(
    `INSERT OR IGNORE INTO influencer_withholding_log
       (influencer_id, payout_year, payout_month, gross_amount, withholding_rate, withholding_amount, net_amount, source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(r.influencerId, kst.getUTCFullYear(), kst.getUTCMonth() + 1, r.gross, r.withholdingPct, r.withholding, r.net, r.sourceId).run()
  return Number(res.meta?.changes ?? 0) > 0
}
