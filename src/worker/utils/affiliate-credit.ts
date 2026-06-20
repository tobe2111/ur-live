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
import { adjustUserPoints } from './point-ledger'

// 🛡️ 2026-06-17 (대표 결정 — 1인 치킨게임): 추천 적립 기본 fallback 5% → 2%.
//   추천은 CAC(획득비)라 끄지 않고 낮춤. 어드민 platform_settings.affiliate_commission_rate 로 추가 조정/0 가능
//   (AdminPlatformSettingsPage 기본 표기 '2' 와 일치). 상품별 referral_enabled=0 으로 개별 OFF.
const DEFAULT_COMMISSION_RATE = 0.02

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

interface CommissionBreakdown {
  commission: number
  primaryProductId: number | null
  primaryProductName: string | null
  eligibleLines: number
}

/**
 * 🧾 주문 라인별 추천 커미션 계산 (멀티상품 정확 귀속).
 *   order_items 의 referral_enabled 라인만 각 상품 비율로 적립액 합산 (배송비/비대상 상품 제외).
 *   기존엔 첫 상품 비율 × 주문총액(배송비 포함) 이라 멀티상품 주문에서 과/미적립.
 *   order_items 부재(레거시/직접결제) 시 fallbackProductId 비율 × 주문총액으로 fallback.
 *   반환 null = 적립 대상 라인 0 (REFERRAL_DISABLED).
 */
async function computeOrderCommission(
  DB: D1Database,
  orderId: number,
  orderAmount: number,
  fallbackProductId: number | null | undefined,
  fallbackProductName: string | null | undefined,
): Promise<CommissionBreakdown | null> {
  let lines: { product_id: number | null; product_name: string | null; line_amount: number }[] = []
  try {
    const r = await DB.prepare(
      `SELECT product_id, product_name,
              COALESCE(subtotal, price * quantity, price, 0) AS line_amount
       FROM order_items WHERE order_id = ?`,
    ).bind(orderId).all<{ product_id: number | null; product_name: string | null; line_amount: number }>()
    lines = r.results ?? []
  } catch { /* order_items 없음 — fallback */ }

  if (lines.length > 0) {
    let commission = 0
    let eligibleLines = 0
    let primaryProductId: number | null = null
    let primaryProductName: string | null = null
    for (const ln of lines) {
      const pid = ln.product_id != null ? Number(ln.product_id) : null
      const rate = await resolveCommissionRate(DB, pid)
      if (rate == null) continue          // 이 상품은 추천 비대상 — skip
      const amt = Number(ln.line_amount) || 0
      if (amt <= 0) continue
      commission += Math.round(amt * rate)
      eligibleLines++
      if (primaryProductId == null) {
        primaryProductId = pid
        primaryProductName = ln.product_name ?? null
      }
    }
    if (eligibleLines === 0 || commission <= 0) return null
    return { commission, primaryProductId, primaryProductName, eligibleLines }
  }

  // Fallback — order_items 없음: 기존 단일 상품 비율 × 주문총액
  const rate = await resolveCommissionRate(DB, fallbackProductId != null ? Number(fallbackProductId) : null)
  if (rate == null) return null
  const commission = Math.round((Number(orderAmount) || 0) * rate)
  if (commission <= 0) return null
  return {
    commission,
    primaryProductId: fallbackProductId != null ? Number(fallbackProductId) : null,
    primaryProductName: fallbackProductName ?? null,
    eligibleLines: 1,
  }
}

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
    // 🧾 라인별 귀속 (멀티상품 정확) — order_items 의 referral_enabled 라인만 각 비율로 합산.
    const breakdown = await computeOrderCommission(DB, Number(order.id), orderAmount, productId, productName)
    if (!breakdown) return { ok: false, code: 'REFERRAL_DISABLED' }
    const commission = breakdown.commission
    const storeProductId = breakdown.primaryProductId
    const storeProductName = breakdown.primaryProductName

    // ⏳ 확정 유예(hold): status='holding' 으로만 기록 — 잔액(user_points)은 아직 미반영(= '적립 예정').
    //   확정(granted+잔액) 시점(대표 결정 2026-06-17 "예정→사용 시 확정"):
    //     • 교환권 주문 → 구매자가 매장에서 실제 사용(QR/PIN)한 시점 (matureAffiliateForOrder), 미사용 만료분은 cron.
    //     • 비교환권 주문(실물 등) → T+holdDays 경과(matureAffiliateEarnings cron).
    //   이유: 즉시 잔액 적립 시 buy→출금/사용→환불 어뷰즈에서 MAX(0,...) clamp 로 회수 불가(누수).
    //   hold 동안은 출금 가용액 SUM 에서도 제외(NOT IN ('refunded','holding')) → 출금 불가.
    // 🔐 멱등 = UNIQUE(referrer_id, order_id) + INSERT OR IGNORE (머니룰 #3) — 위 SELECT 는 빠른 경로,
    //   이 가드가 동시요청 race 를 원자적으로 차단(changes===0 = 이미 적립됨 → 잔액/알림 없이 멱등 반환).
    const ins = await DB.prepare(`
      INSERT OR IGNORE INTO affiliate_earnings (referrer_id, order_id, product_id, product_name, buyer_id, buyer_ip, order_amount, commission, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'holding')
    `).bind(
      String(referrerId), order.id, storeProductId, storeProductName,
      String(order.user_id), buyerIp || null, orderAmount, commission,
    ).run()
    if (((ins as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0) {
      return { ok: false, code: 'DUPLICATE' }
    }

    await DB.prepare(`
      INSERT INTO user_notifications (user_id, type, title, message, link, created_at)
      VALUES (?, 'affiliate_earning', ?, ?, '/u/me/earnings', datetime('now'))
    `).bind(String(referrerId), '🕒 적립 예정', `${commission.toLocaleString('ko-KR')}딜 적립 예정 (확정 시 알림드려요)`).run().catch(() => {})

    try {
      const { sendSystemPush } = await import('../../lib/system-push')
      await sendSystemPush(env as never, 'user', String(referrerId), {
        title: '🕒 적립 예정',
        body: `${commission.toLocaleString('ko-KR')}딜 적립 예정 (확정 시 알림)`,
        url: '/u/me/earnings',
        tag: `affiliate-${order.id}`,
      })
    } catch { /* push fail-soft */ }

    return { ok: true, commission }
  } catch {
    return { ok: false, code: 'ERROR' }
  }
}

const HOLD_DAYS_DEFAULT = 7

/**
 * 🔐 holding → granted 확정 + 잔액 적립 + 알림 (단일 SSOT — cron / 사용시 인라인 공용).
 *   claim-before-credit: CAS(meta.changes===1) 통과한 행만 적립 → 동시/중복 차단(머니룰 #1).
 *   반환: 적립된 금액(확정 실패/중복/0원이면 0).
 */
async function grantHoldingEarning(
  DB: D1Database,
  env: unknown,
  row: { id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null },
): Promise<number> {
  const claim = await DB.prepare(
    "UPDATE affiliate_earnings SET status = 'granted' WHERE id = ? AND COALESCE(status, 'pending') = 'holding'",
  ).bind(row.id).run().catch(() => null)
  if ((((claim as { meta?: { changes?: number } } | null)?.meta?.changes) ?? 0) !== 1) return 0
  const amt = Number(row.commission) || 0
  if (amt <= 0) return 0
  await adjustUserPoints(DB, {
    userId: String(row.referrer_id),
    delta: amt,
    type: 'affiliate_commission',
    description: row.product_name ? `핀 추천 적립 확정 (${String(row.product_name).slice(0, 80)})` : '핀 추천 적립 확정',
    orderId: row.order_id ?? undefined,
  })
  await DB.prepare(`
    INSERT INTO user_notifications (user_id, type, title, message, link, created_at)
    VALUES (?, 'affiliate_earning', ?, ?, '/u/me/earnings', datetime('now'))
  `).bind(String(row.referrer_id), '✅ 적립 확정!', `${amt.toLocaleString('ko-KR')}딜이 확정되었습니다`).run().catch(() => {})
  try {
    const { sendSystemPush } = await import('../../lib/system-push')
    await sendSystemPush(env as never, 'user', String(row.referrer_id), {
      title: '✅ 적립 확정!',
      body: `${amt.toLocaleString('ko-KR')}딜이 확정되었습니다`,
      url: '/u/me/earnings',
      tag: `affiliate-mature-${row.id}`,
    })
  } catch { /* push fail-soft */ }
  return amt
}

/**
 * 🆕 2026-06-17 (대표 결정 "둘 다 — 예정→사용 시 확정"): 교환권을 실제 사용(QR/PIN)한 시점에
 *   해당 주문의 holding 추천적립을 즉시 확정(granted)+잔액 적립. group-buy-voucher 사용 핸들러가 호출.
 *   멱등(CAS) — cron 안전망과 동시 실행돼도 한 번만 확정. 반환: 적립 금액 합.
 */
export async function matureAffiliateForOrder(DB: D1Database, env: unknown, orderId: number): Promise<number> {
  try {
    const due = await DB.prepare(`
      SELECT ae.id, ae.referrer_id, ae.commission, ae.order_id, ae.product_name
      FROM affiliate_earnings ae
      JOIN orders o ON o.id = ae.order_id
      WHERE ae.order_id = ? AND COALESCE(ae.status, 'pending') = 'holding'
        AND UPPER(COALESCE(o.status, '')) NOT IN ('REFUNDED', 'CANCELLED', 'FAILED')
    `).bind(orderId).all<{ id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null }>()
      .catch(() => ({ results: [] as { id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null }[] }))
    let credited = 0
    for (const row of due.results ?? []) credited += await grantHoldingEarning(DB, env, row)
    return credited
  } catch { return 0 }
}

/**
 * ⏳ 추천 적립 성숙 cron — 대표 결정(2026-06-17 "예정→사용 시 확정")으로 정책 분기:
 *   • 교환권 주문: 교환권이 실제 사용('used')/만료('expired' 또는 expires_at 경과)되면 확정.
 *     → 평소엔 사용 시점에 matureAffiliateForOrder 가 즉시 확정하고, 이 cron 은 누락분+만료분 안전망.
 *     (미사용·미만료 교환권은 계속 holding = '적립 예정' 유지 — 실제 써야 확정되는 정직 모델.)
 *   • 비교환권 주문(실물 배송 등 '사용' 이벤트 없음): 기존대로 T+holdDays 경과로 확정.
 *   claim-before-credit CAS + 주문 status 가드(REFUNDED/CANCELLED/FAILED 제외). policy: affiliate_hold_days.
 */
export async function matureAffiliateEarnings(
  DB: D1Database,
  env: unknown,
): Promise<{ matured: number; credited: number }> {
  let holdDays = HOLD_DAYS_DEFAULT
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'affiliate_hold_days'").first<{ value: string }>()
    const n = Number(row?.value)
    if (Number.isFinite(n) && n >= 0) holdDays = n
  } catch { /* default */ }

  let matured = 0
  let credited = 0
  try {
    const due = await DB.prepare(`
      SELECT ae.id, ae.referrer_id, ae.commission, ae.order_id, ae.product_name
      FROM affiliate_earnings ae
      JOIN orders o ON o.id = ae.order_id
      WHERE COALESCE(ae.status, 'pending') = 'holding'
        AND UPPER(COALESCE(o.status, '')) NOT IN ('REFUNDED', 'CANCELLED', 'FAILED')
        AND (
          EXISTS (
            SELECT 1 FROM vouchers v WHERE v.order_id = ae.order_id
              AND ( v.status IN ('used', 'expired')
                    OR (v.status = 'unused' AND v.expires_at IS NOT NULL AND v.expires_at < datetime('now')) )
          )
          OR (
            NOT EXISTS (SELECT 1 FROM vouchers v2 WHERE v2.order_id = ae.order_id)
            AND ae.created_at <= datetime('now', ?)
          )
        )
      LIMIT 500
    `).bind(`-${holdDays} days`).all<{ id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null }>()
      .catch(() => ({ results: [] as { id: number; referrer_id: string; commission: number; order_id: number | null; product_name: string | null }[] }))

    for (const row of due.results ?? []) {
      const amt = await grantHoldingEarning(DB, env, row)
      if (amt > 0) { matured++; credited += amt }
    }
  } catch { /* fail-soft */ }
  return { matured, credited }
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
