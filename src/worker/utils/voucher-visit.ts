/**
 * 🚪 2026-07-13 (데이터 감사 2단계 — 대표 승인): 이용권 "방문(사용처리)" 통합 이벤트.
 *
 * 배경: 이용권 사용은 `vouchers.status='used'` 상태 플립(되돌리기 가능·store_id 없음)이고,
 *   부가 로그가 경로별로 조각남(`voucher_use_logs`=user_id 없음, `voucher_redemptions`=GPS만).
 *   → "누가(user) 어느 매장(seller)에서 언제(ts) 사용했나"를 한 행으로 잇는 이벤트가 없었음.
 *   district_coupons(redeemed_store_id/redeemed_at/user_id) 모델을 이용권에 이식.
 *
 * 설계:
 *  - append-only 성격의 사용처리 이벤트(3경로 공통: pin / seller_scan / self).
 *  - `voucher_id` PK → **멱등**(INSERT OR IGNORE, 한 이용권 1회). cancel-redeem(오스캔 60초 정정)은 삭제.
 *  - user_id 는 vouchers.user_id 와 **같은 값**을 저장(조인 정합 — 이용권↔방문↔유저 단일 키).
 *  - 완결고리(유입→방문→결제→재방문)의 '방문' 노드. 별도 사이드테이블(vouchers 핫테이블 미변경).
 */
const _ensuredVisit = new WeakSet<object>()
export async function ensureVoucherVisitsTable(DB: D1Database) {
  if (_ensuredVisit.has(DB)) return
  _ensuredVisit.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS voucher_visits (
      voucher_id INTEGER PRIMARY KEY,
      user_id TEXT,
      seller_id INTEGER,
      product_id INTEGER,
      amount INTEGER,
      path TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    // 재방문 분석용 조인 인덱스(유저별 시계열 / 매장별).
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_voucher_visits_user ON voucher_visits(user_id, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_voucher_visits_seller ON voucher_visits(seller_id, created_at DESC)`).run()
  } catch { /* ignore */ }
}

export interface VoucherVisitInput {
  voucher_id: number
  user_id: string | number | null | undefined
  seller_id: number | null | undefined
  product_id?: number | null
  amount?: number | null
  path: 'pin' | 'seller_scan' | 'self'
}

/**
 * 사용처리 방문 이벤트 기록(베스트에포트·멱등). voucher_id 중복이면 no-op(INSERT OR IGNORE).
 * user_id 는 vouchers.user_id 와 동일 값을 넘길 것(조인 키 정합).
 */
export async function recordVoucherVisit(DB: D1Database, v: VoucherVisitInput): Promise<void> {
  if (!Number.isFinite(Number(v.voucher_id))) return
  try {
    await ensureVoucherVisitsTable(DB)
    await DB.prepare(
      `INSERT OR IGNORE INTO voucher_visits (voucher_id, user_id, seller_id, product_id, amount, path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      Number(v.voucher_id),
      v.user_id != null ? String(v.user_id) : null,
      v.seller_id != null ? Number(v.seller_id) : null,
      v.product_id != null ? Number(v.product_id) : null,
      v.amount != null && Number.isFinite(Number(v.amount)) ? Number(v.amount) : null,
      v.path,
    ).run()
  } catch { /* best-effort — 방문 로깅 실패가 사용처리를 막지 않음 */ }
}

/** cancel-redeem(오스캔 정정) 시 방문 이벤트도 되돌림 — 실제 방문 아니었으므로 삭제(베스트에포트). */
export async function removeVoucherVisit(DB: D1Database, voucherId: number): Promise<void> {
  if (!Number.isFinite(Number(voucherId))) return
  try {
    await DB.prepare('DELETE FROM voucher_visits WHERE voucher_id = ?').bind(Number(voucherId)).run()
  } catch { /* best-effort */ }
}
