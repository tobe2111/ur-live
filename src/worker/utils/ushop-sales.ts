/**
 * 🛍️ 유어샵을 거쳐 팔린 수 — 2026-10-15 대표 *"바꾸자"*.
 *
 * 유어샵 머리의 **누적 구매**는 원래 "진열한 상품들의 전체 판매 수 합"(`products.sold_count`)이었다.
 *   그건 그 상품이 어디서 팔렸든 세므로, 유어샵 주인이 만든 판매가 아니다. 대표가 *이 유어샵을 거쳐
 *   팔린 수*로 바꾸라고 정했다.
 *
 * 왜 새 기록이 필요한가: 유어샵 링크(`/u/:handle/p/:id` → `?aff=<주인 users.id>`)로 산 구매는
 *   결제 경로에 `referralInfluencerId` 로 도착하지만, 그게 **남는 곳**은 커미션이 실제로 붙을 때의
 *   `influencer_attributions` 뿐이다(소개 커미션이 꺼져 있거나 매장이 막았으면 아무 데도 안 남는다).
 *   그래서 커미션과 무관하게 "이 주문은 이 유어샵을 거쳤다" 만 적는 표를 둔다 — **돈은 한 푼도 안 움직인다.**
 *
 * 규율:
 *   - 기록은 fail-soft(실패해도 결제는 그대로). 멱등 = PK(order_id, product_id) + INSERT OR IGNORE.
 *   - 귀속은 **유어샵 주인(handle 이 있는 users 행)** 일 때만 — 셀러 id(`?seller=`)는 유어샵이 아니다.
 *   - 자기 유어샵에서 자기가 산 것은 세지 않는다(결제 경로가 이미 자기귀속을 걸러 내지만 한 번 더).
 *   - 셀 때는 취소·환불·실패 주문을 뺀다(기록을 지우지 않는다 — 상태로 거른다).
 */

const ensured = new WeakSet<D1Database>()

export async function ensureUShopSalesTable(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  ensured.add(DB)
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS ushop_sales (
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      curator_user_id INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (order_id, product_id)
    )`,
  ).run().catch(() => {})
  await DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ushop_sales_curator ON ushop_sales(curator_user_id)`,
  ).run().catch(() => {})
}

/** 셀 때 빼는 주문 상태 — 돈이 돌아갔거나 결제가 안 된 주문. */
export const USHOP_SALES_EXCLUDED_STATUSES = ['CANCELLED', 'REFUNDED', 'FAILED', 'PARTIAL_REFUNDED'] as const

/** 유어샵 링크의 ref 가 가리키는 유어샵 주인 id — 아니면 null. 순수 형식 판정(DB 조회 전). */
export function ushopRefUserId(ref: unknown, buyerId: unknown): number | null {
  const s = String(ref ?? '').trim()
  if (!/^\d{1,12}$/.test(s)) return null
  const id = Number(s)
  if (!Number.isSafeInteger(id) || id <= 0) return null
  if (String(buyerId ?? '') === s) return null
  return id
}

/**
 * 이 주문이 유어샵을 거쳤으면 기록한다. 절대 throw 하지 않는다.
 *   items 는 이 주문에 담긴 상품과 수량(장바구니는 여러 줄).
 */
export async function recordUShopSale(
  DB: D1Database,
  p: { orderId: number | null | undefined; ref: unknown; buyerId: unknown; items: ReadonlyArray<{ productId: number; qty: number }> },
): Promise<void> {
  try {
    const curatorId = ushopRefUserId(p.ref, p.buyerId)
    const orderId = Number(p.orderId)
    if (!curatorId || !Number.isSafeInteger(orderId) || orderId <= 0 || !p.items.length) return
    // 유어샵 주인만 — handle 이 있는 유저. (같은 숫자가 셀러 id 일 수도 있어 형식만으로는 못 가른다.)
    const owner = await DB.prepare(
      `SELECT 1 FROM users WHERE id = ? AND handle IS NOT NULL AND handle != '' LIMIT 1`,
    ).bind(curatorId).first().catch(() => null)
    if (!owner) return
    await ensureUShopSalesTable(DB)
    const stmts = p.items
      .filter(i => Number.isSafeInteger(Number(i.productId)) && Number(i.qty) > 0)
      .map(i => DB.prepare(
        `INSERT OR IGNORE INTO ushop_sales (order_id, product_id, curator_user_id, qty) VALUES (?, ?, ?, ?)`,
      ).bind(orderId, Number(i.productId), curatorId, Math.floor(Number(i.qty))))
    if (stmts.length) await DB.batch(stmts)
  } catch { /* fail-soft — 결제는 이미 끝났다 */ }
}

/** 이 유어샵을 거쳐 팔린 수(수량 합). 표가 없거나 실패하면 0. */
export async function countUShopSales(DB: D1Database, curatorUserId: number): Promise<number> {
  try {
    const placeholders = USHOP_SALES_EXCLUDED_STATUSES.map(() => '?').join(', ')
    const row = await DB.prepare(
      `SELECT COALESCE(SUM(s.qty), 0) AS n
         FROM ushop_sales s
         JOIN orders o ON o.id = s.order_id
        WHERE s.curator_user_id = ?
          AND UPPER(COALESCE(o.status, '')) NOT IN (${placeholders})`,
    ).bind(curatorUserId, ...USHOP_SALES_EXCLUDED_STATUSES).first<{ n: number }>()
    const n = Number(row?.n)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}
