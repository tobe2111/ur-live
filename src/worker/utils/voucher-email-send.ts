/**
 * ✉️ 이용권 발급 이메일 보내기 (2026-11-17 — 외국인 해외 간편결제 손님용).
 *
 * 내용은 `shared/voucher-email.ts`(순수 함수)가 만들고, 여기서는 주문 → 이용권·상품·손님 이메일을 읽어 보낸다.
 * 🔒 **기본 꺼짐** — `platform_settings.voucher_email_enabled = 'true'` 일 때만 보낸다(발송은 결재 C 등급).
 *   지금 이 함수를 부르는 결제 레일은 없다. 해외 간편결제(페이팔) 레일이 생기면 승인 직후 이걸 부른다.
 * 멱등: 같은 주문에 두 번 보내지 않는다 — 주문 단위 표 `order_voucher_email`(INSERT OR IGNORE 선점), 첫 호출 때 만든다.
 */
import { buildVoucherIssuedEmail } from '../../shared/voucher-email'
import { sendSystemEmail } from '../../lib/system-email'

type D1 = D1Database

const tableReady = new WeakSet<object>()
async function ensureTable(DB: D1): Promise<void> {
  if (tableReady.has(DB as object)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS order_voucher_email (
    order_id INTEGER PRIMARY KEY, sent_at TEXT NOT NULL DEFAULT (datetime('now')), lang TEXT, ok INTEGER NOT NULL DEFAULT 0)`).run()
  tableReady.add(DB as object)
}

export async function voucherEmailEnabled(DB: D1): Promise<boolean> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'voucher_email_enabled' LIMIT 1")
    .first<{ value: string }>().catch(() => null)
  return String(row?.value || '').trim().toLowerCase() === 'true'
}

export type VoucherEmailResult = { sent: boolean; reason?: 'disabled' | 'no_order' | 'no_email' | 'no_vouchers' | 'already' | 'send_failed' }

/**
 * @param lang 손님이 결제한 화면 언어(en·ja·zh·ko …). 모르면 영어로 간다.
 * @param toOverride 손님 계정 이메일 대신 결제 때 받은 이메일로 보낼 때.
 */
export async function sendVoucherIssuedEmail(
  env: { DB: D1 } & Record<string, unknown>,
  orderId: number,
  opts: { lang?: string | null; toOverride?: string | null; origin?: string } = {},
): Promise<VoucherEmailResult> {
  const DB = env.DB
  if (!(await voucherEmailEnabled(DB))) return { sent: false, reason: 'disabled' }
  const order = await DB.prepare('SELECT o.id, o.user_id, u.email, u.name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?')
    .bind(orderId).first<{ id: number; user_id: number | null; email: string | null; name: string | null }>().catch(() => null)
  if (!order) return { sent: false, reason: 'no_order' }
  const to = String(opts.toOverride || order.email || '').trim()
  if (!to) return { sent: false, reason: 'no_email' }
  const { results } = await DB.prepare(
    `SELECT v.code, v.expires_at, p.name AS product_name, p.restaurant_name, p.restaurant_address, p.restaurant_phone
       FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.order_id = ? ORDER BY v.id`)
    .bind(orderId).all<{ code: string; expires_at: string | null; product_name: string; restaurant_name: string | null; restaurant_address: string | null; restaurant_phone: string | null }>()
    .catch(() => ({ results: [] as never[] }))
  const rows = results || []
  if (!rows.length) return { sent: false, reason: 'no_vouchers' }

  await ensureTable(DB)
  // 선점(멱등) — 이미 보냈거나 보내는 중이면 끝.
  const claim = await DB.prepare('INSERT OR IGNORE INTO order_voucher_email (order_id, lang, ok) VALUES (?, ?, 0)')
    .bind(orderId, String(opts.lang || '')).run().catch(() => null)
  if (!claim?.meta?.changes) return { sent: false, reason: 'already' }

  const first = rows[0]
  const mail = buildVoucherIssuedEmail({
    lang: opts.lang, buyerName: order.name, productName: first.product_name,
    storeName: first.restaurant_name || first.product_name, storeAddress: first.restaurant_address, storePhone: first.restaurant_phone,
    codes: rows.map((r) => r.code), expiresAt: first.expires_at, origin: opts.origin,
  })
  const r = await sendSystemEmail(env, to, { subject: mail.subject, html: mail.html }, { ignorePreference: true })
  if (!r.success) {
    // 다음 시도가 가능하게 선점을 푼다(조용히 삼키지 않는다 — 결과로 돌려준다).
    await DB.prepare('DELETE FROM order_voucher_email WHERE order_id = ? AND ok = 0').bind(orderId).run().catch(() => null)
    return { sent: false, reason: 'send_failed' }
  }
  await DB.prepare('UPDATE order_voucher_email SET ok = 1 WHERE order_id = ?').bind(orderId).run().catch(() => null)
  return { sent: true }
}
