/**
 * 🏁 2026-06-12 (전 플로우 감사 🔴): 큐레이터/추천 적립 코어 — affiliate.routes.ts /track 에서 추출.
 *
 * 배경: 물리상품(쇼핑 체크아웃) 경로는 order.routes 가 내부 fetch('/api/affiliate/track') 를
 * 쏘는데 ① 인증 헤더가 없어 항상 401 ② 호출 시점 주문이 PENDING 이라 상태검사에도 차단 —
 * 이중 사망으로 **적립이 0** 이었음. 해결: 주문 생성 시 의도를 order_referrer_intents 에 저장,
 * 결제 확정(/confirm)에서 이 헬퍼를 직접 호출(서버 신뢰 문맥 — 구매자=주문 소유자 자명).
 *
 * 검증 로직은 /track 과 1:1 동일(자기추천/셀프구매 fraud 기록, 멱등, IP 어뷰즈, 상품별
 * referral_enabled/rate, user_points 적립, 알림+푸시). /track 라우트도 이 헬퍼를 호출하도록
 * 리팩토링 — 단일 SSOT.
 */
import { ensureUserPointsTable } from './ensure-tables'

const DEFAULT_COMMISSION_RATE = 0.05

/** /track 의 resolveCommissionRate 와 1:1 동일 (SSOT 이동 — routes 가 이걸 import). */
export async function resolveCommissionRate(
  DB: D1Database,
  productId: number | null | undefined,
): Promise<number | null> {
  if (productId) {
    try {
      const row = await DB.prepare(
        'SELECT referral_enabled, referral_commission_rate FROM products WHERE id = ?'
      ).bind(productId).first<{ referral_enabled: number | null; referral_commission_rate: number | null }>()
      if (!row) return null
      if (Number(row.referral_enabled) !== 1) return null
      if (row.referral_commission_rate != null && Number.isFinite(row.referral_commission_rate)) {
        return Math.max(0, Math.min(1, Number(row.referral_commission_rate)))
      }
    } catch { /* 컬럼 미존재 → platform default fallback */ }
  }
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'affiliate_commission_rate'").first<{ value: string }>()
    if (row?.value) return parseFloat(row.value) / 100
  } catch { /* */ }
  return DEFAULT_COMMISSION_RATE
}

export interface AffiliateCreditInput {
  referrerId: string
  orderId: number
  productId?: number | null
  productName?: string | null
  buyerIp?: string | null
}

export type AffiliateCreditResult =
  | { ok: true; commission: number }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_PAID' | 'SELF_REFERRAL' | 'SELF_PURCHASE' | 'DUPLICATE' | 'IP_ABUSE' | 'REFERRAL_DISABLED' | 'ERROR' }

export async function creditAffiliateForOrder(
  DB: D1Database,
  env: unknown,
  input: AffiliateCreditInput,
): Promise<AffiliateCreditResult> {
  const { referrerId, orderId, productId, productName, buyerIp } = input
  try {
    const order = await DB.prepare(
      'SELECT id, user_id, total_amount, status FROM orders WHERE id = ?'
    ).bind(orderId).first<{ id: number; user_id: string | number; total_amount: number; status: string }>()
    if (!order) return { ok: false, code: 'NOT_FOUND' }

    const orderStatus = (order.status || '').toUpperCase()
    if (!['DONE', 'PAID'].includes(orderStatus)) return { ok: false, code: 'NOT_PAID' }

    if (String(referrerId) === String(order.user_id)) {
      await DB.prepare(
        `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
         VALUES ('self_referral', ?, 'order', ?, ?, 'high')`
      ).bind(String(referrerId), String(order.id), JSON.stringify({ buyer_id: order.user_id })).run().catch(() => {})
      return { ok: false, code: 'SELF_REFERRAL' }
    }

    try {
      const sellerOwner = await DB.prepare(
        `SELECT s.user_id FROM orders o JOIN sellers s ON o.seller_id = s.id WHERE o.id = ? LIMIT 1`
      ).bind(order.id).first<{ user_id: string }>()
      if (sellerOwner?.user_id && String(sellerOwner.user_id) === String(order.user_id)) {
        await DB.prepare(
          `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
           VALUES ('self_purchase', ?, 'order', ?, ?, 'high')`
        ).bind(String(order.user_id), String(order.id), JSON.stringify({ sellerOwner, referrer_id: referrerId })).run().catch(() => {})
        return { ok: false, code: 'SELF_PURCHASE' }
      }
    } catch { /* */ }

    const existing = await DB.prepare(
      'SELECT id FROM affiliate_earnings WHERE referrer_id = ? AND order_id = ?'
    ).bind(String(referrerId), order.id).first()
    if (existing) return { ok: false, code: 'DUPLICATE' }

    if (buyerIp) {
      const recentFromIp = await DB.prepare(`
        SELECT COUNT(*) AS cnt FROM affiliate_earnings
        WHERE referrer_id = ? AND buyer_ip = ? AND created_at > datetime('now', '-24 hours')
      `).bind(String(referrerId), buyerIp).first<{ cnt: number }>()
      if (recentFromIp && recentFromIp.cnt >= 3) return { ok: false, code: 'IP_ABUSE' }
    }

    const orderAmount = Number(order.total_amount) || 0
    const rate = await resolveCommissionRate(DB, productId ? Number(productId) : null)
    if (rate == null) return { ok: false, code: 'REFERRAL_DISABLED' }
    const commission = Math.round(orderAmount * rate)

    await DB.prepare(`
      INSERT INTO affiliate_earnings (referrer_id, order_id, product_id, product_name, buyer_id, buyer_ip, order_amount, commission)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      String(referrerId), order.id, productId || null, productName || null,
      String(order.user_id), buyerIp || null, orderAmount, commission,
    ).run()

    try {
      await ensureUserPointsTable(DB)
      await DB.prepare(`
        INSERT INTO user_points (user_id, balance, total_charged)
        VALUES (?, ?, 0)
        ON CONFLICT(user_id) DO UPDATE SET
          balance = balance + excluded.balance,
          updated_at = datetime('now')
      `).bind(String(referrerId), commission).run()
    } catch { /* user_points 실패해도 earnings 기록은 보존 — cron 재집계 가능 */ }

    await DB.prepare(`
      INSERT INTO user_notifications (user_id, type, title, message, link, created_at)
      VALUES (?, 'affiliate_earning', ?, ?, '/u/me/earnings', datetime('now'))
    `).bind(String(referrerId), '💰 핀으로 적립!', `${commission}딜이 적립되었습니다`).run().catch(() => {})

    try {
      const { sendSystemPush } = await import('../../lib/system-push')
      await sendSystemPush(env as never, 'user', String(referrerId), {
        title: '💰 핀으로 적립!',
        body: `${commission.toLocaleString('ko-KR')}딜이 적립되었습니다`,
        url: '/u/me/earnings',
        tag: `affiliate-${order.id}`,
      })
    } catch { /* push fail-soft */ }

    return { ok: true, commission }
  } catch {
    return { ok: false, code: 'ERROR' }
  }
}

/** 주문 생성 시 추천 의도 저장 (결제 확정 시 creditAffiliateForOrder 가 소비). */
const _done_intents = new WeakSet<D1Database>()
export async function ensureReferrerIntentsTable(DB: D1Database): Promise<void> {
  if (_done_intents.has(DB)) return
  _done_intents.add(DB)
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS order_referrer_intents (
      order_id INTEGER PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      buyer_ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run().catch(() => {})
}

export async function saveReferrerIntent(
  DB: D1Database,
  intent: { orderId: number; referrerId: string; productId?: number | null; productName?: string | null; buyerIp?: string | null },
): Promise<void> {
  try {
    await ensureReferrerIntentsTable(DB)
    await DB.prepare(
      'INSERT OR IGNORE INTO order_referrer_intents (order_id, referrer_id, product_id, product_name, buyer_ip) VALUES (?, ?, ?, ?, ?)'
    ).bind(intent.orderId, String(intent.referrerId), intent.productId || null, intent.productName || null, intent.buyerIp || null).run()
  } catch { /* fail-soft */ }
}

/** /confirm 확정 직후 호출 — 저장된 의도가 있으면 적립 (멱등). */
export async function creditAffiliateFromIntent(DB: D1Database, env: unknown, orderId: number): Promise<void> {
  try {
    await ensureReferrerIntentsTable(DB)
    const intent = await DB.prepare(
      'SELECT referrer_id, product_id, product_name, buyer_ip FROM order_referrer_intents WHERE order_id = ?'
    ).bind(orderId).first<{ referrer_id: string; product_id: number | null; product_name: string | null; buyer_ip: string | null }>()
    if (!intent?.referrer_id) return
    await creditAffiliateForOrder(DB, env, {
      referrerId: intent.referrer_id,
      orderId,
      productId: intent.product_id,
      productName: intent.product_name,
      buyerIp: intent.buyer_ip,
    })
  } catch { /* fail-soft */ }
}
