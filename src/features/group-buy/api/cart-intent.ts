/**
 * 🧾 장바구니 결제 의사(intent) — "이 주문번호로 무엇을 사기로 했나" 를 **서버가 기억한다** (2026-09-15)
 *
 * ## 왜 필요한가 — URL 로 품목을 돌려받으면 안 된다
 * 토스 결제는 [init → 토스 화면 → success URL 로 복귀 → confirm] 이라 중간에 **브라우저를 거친다.**
 * 품목 목록을 success URL 에 실어 보내면 그건 곧 **사용자가 고칠 수 있는 값**이다.
 *
 * 금액 검증만으로는 이 구멍이 안 닫힌다. 확인해 보면:
 *   - 부분결제 게이트 OFF(기본)이면 `expectedAmount === chargedAmount` 를 강제하므로 **총액은 못 바꾼다.**
 *   - 그런데 **총액이 같은 다른 상품으로 바꿔치기**는 통과한다 — 1만원 A 를 결제하고 복귀 URL 에서
 *     1만원 B 를 주장하면 B 가 발급된다. 우리 돈이 새지는 않지만 **A 매장은 판 적 없는 매출을,
 *     B 매장은 판 줄 모르는 매출을** 갖게 된다(정산·클레임이 곧바로 어긋난다).
 *
 * ⇒ 품목은 **결제 시작 시점에 서버가 적어 두고**, 확정 때 그 기록만 읽는다. 복귀 URL 은
 *   `paymentKey·orderId·amount` 만 나른다(단일 구매와 같은 모양). 클라가 보낸 품목은 **안 쓴다.**
 *
 * ## 수명
 * 주문번호(토스 `orderId`) 1개 = 행 1개. 확정되면 `consumed_at` 을 찍어 재사용을 막고,
 * 버려진 행(결제 포기)은 정리 cron 이 24시간 뒤 지운다 — 없어도 해가 없어서 best-effort 다.
 *
 * ⚠️ 이 표는 **장바구니 그 자체가 아니다**(그건 `cart_items`). 결제 한 건의 스냅샷이고,
 *    그래서 장바구니를 나중에 비워도 진행 중인 결제는 안 깨진다.
 */
import type { CartLineInput } from './cart-lines'

const _ensured = new WeakSet<object>()

async function ensureIntentTable(DB: D1Database) {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS gb_cart_intents (
      order_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      consumed_at DATETIME
    )`).run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_gb_cart_intents_created ON gb_cart_intents(created_at)').run()
  } catch { /* 권한/경합 — 아래 쿼리가 실패하면 그때 막힌다 */ }
}

/** 결제 시작 시점의 품목을 적어 둔다. 같은 주문번호 재사용은 덮어쓰지 않는다(멱등). */
export async function saveCartIntent(
  DB: D1Database, orderId: string, userId: string, items: CartLineInput[], totalAmount: number,
): Promise<boolean> {
  await ensureIntentTable(DB)
  const r = await DB.prepare(
    'INSERT OR IGNORE INTO gb_cart_intents (order_id, user_id, items_json, total_amount) VALUES (?, ?, ?, ?)',
  ).bind(orderId, String(userId), JSON.stringify(items), Math.round(totalAmount)).run().catch(() => null)
  return !!r?.meta?.changes
}

export type CartIntent = { items: CartLineInput[]; totalAmount: number }

/**
 * 확정 시점에 읽는다. **주인이 아니면 안 준다** — 남의 주문번호로 남의 장바구니를 확정하지 못하게.
 *
 * ⚠️ `consumed_at` 은 여기서 찍지 않는다. 확정이 중간에 실패해 자동 환불로 끝나면 사용자가
 *    다시 시도할 수 있어야 하고, **이중 발급은 `orders.payment_key` 멱등 가드가 이미 막는다**
 *    (그쪽이 진짜 관문이다 — 여기서 또 막으면 재시도만 못 하게 된다).
 */
export async function loadCartIntent(DB: D1Database, orderId: string, userId: string): Promise<CartIntent | null> {
  await ensureIntentTable(DB)
  const row = await DB.prepare(
    'SELECT items_json, total_amount FROM gb_cart_intents WHERE order_id = ? AND user_id = ? LIMIT 1',
  ).bind(orderId, String(userId)).first<{ items_json: string; total_amount: number }>().catch(() => null)
  if (!row) return null
  try {
    const items = JSON.parse(row.items_json) as CartLineInput[]
    if (!Array.isArray(items) || items.length === 0) return null
    return { items, totalAmount: Number(row.total_amount) }
  } catch { return null }
}

/** 발급까지 끝난 뒤 표시만 남긴다(감사용). 실패해도 결제에는 영향 없다. */
export async function markCartIntentConsumed(DB: D1Database, orderId: string): Promise<void> {
  await DB.prepare("UPDATE gb_cart_intents SET consumed_at = datetime('now') WHERE order_id = ? AND consumed_at IS NULL")
    .bind(orderId).run().catch(() => null)
}

/** 버려진 의사 정리 — 정리 cron 에서 부른다. 없어도 해가 없다(용량만 먹는다). */
export async function purgeStaleCartIntents(DB: D1Database): Promise<number> {
  const r = await DB.prepare("DELETE FROM gb_cart_intents WHERE created_at < datetime('now', '-1 day')")
    .run().catch(() => null)
  return Number(r?.meta?.changes ?? 0)
}
