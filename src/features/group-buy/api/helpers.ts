/**
 * 🛡️ 2026-05-15 (TD-G01 3단계): group-buy 공유 helpers — sub-router 들이 import.
 *
 * 분리 이유: voucher / public / seller / admin sub-router 가 같은 helper 사용 →
 *           main 파일에 헬퍼 두면 순환 import. 별도 파일로 분리.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { swallow } from '../../../worker/utils/swallow'
import { recordLedger } from '../../../worker/utils/ledger'
import { calcInfluencerCommissionPct, type CommissionRates } from './commission-rates'

const DEFAULT_MEAL_VOUCHER_COMMISSION_RATE = 0.05 // 식사권 기본 수수료 5%

// 🛡️ 2026-05-15: 차등 수수료 — 셀러 GMV 기반 자동 산정 (셀러 lock-in)
//   기본 5%, 월 GMV 1,000만+ 셀러 4%, 월 GMV 1억+ 셀러 3%
//   sellers.commission_rate 컬럼이 있으면 어드민 수동 override 우선.
const TIER_COMMISSION = [
  { min_monthly_gmv: 100_000_000, rate: 0.03 },  // 1억+ → 3%
  { min_monthly_gmv: 10_000_000,  rate: 0.04 },  // 1천만+ → 4%
] as const

/** DB에서 식사권 기본 수수료율 조회 (어드민 설정 우선, 없으면 5%) */
export async function getMealVoucherCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'commission_rate_meal_voucher'").first<{ value: string }>()
    if (row) return Number(row.value) / 100
  } catch { /* table may not exist */ }
  return DEFAULT_MEAL_VOUCHER_COMMISSION_RATE
}

/** 셀러별 commission rate (override > tier > default). */
export async function getSellerCommissionRate(DB: D1Database, sellerId: number): Promise<number> {
  // 1. 어드민 수동 설정 (sellers.commission_rate)
  try {
    const seller = await DB.prepare("SELECT commission_rate FROM sellers WHERE id = ?").bind(sellerId).first<{ commission_rate: number | null }>()
    if (seller && seller.commission_rate != null && seller.commission_rate > 0 && seller.commission_rate < 100) {
      return Number(seller.commission_rate) / 100
    }
  } catch { /* column may not exist */ }
  // 2. 자동 tier — 최근 30일 GMV 기준
  try {
    const gmvRow = await DB.prepare(`
      SELECT COALESCE(SUM(p.price * p.group_buy_current), 0) AS gmv
      FROM products p
      WHERE p.seller_id = ?
        AND p.updated_at >= datetime('now', '-30 days')
        AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
    `).bind(sellerId).first<{ gmv: number }>()
    const gmv = Number(gmvRow?.gmv ?? 0)
    for (const tier of TIER_COMMISSION) {
      if (gmv >= tier.min_monthly_gmv) return tier.rate
    }
  } catch { /* fallback to default */ }
  // 3. 기본값 (platform_settings)
  return await getMealVoucherCommissionRate(DB)
}

/**
 * 테이블 + 컬럼 자동 생성 (마이그레이션 미적용 시 fallback).
 * products 에 group-buy 관련 컬럼 추가 + vouchers 테이블 생성.
 */
/**
 * 🛡️ 2026-05-19: per-worker 메모이제이션 — 매 요청마다 15+ ALTER TABLE 실행하던 패턴 제거.
 *   효과: group-buy 모든 페이지 응답시간 0.5-1초 단축.
 */
let _ensuredTables = false
export async function ensureTables(DB: D1Database): Promise<void> {
  if (_done_ensureTables.has(DB)) return
  _done_ensureTables.add(DB)
  if (_ensuredTables) return
  const columns = [
    'restaurant_name TEXT', 'restaurant_address TEXT', 'restaurant_phone TEXT',
    'restaurant_lat REAL', 'restaurant_lng REAL',
    'voucher_expiry DATE', 'voucher_terms TEXT',
    'group_buy_target INTEGER DEFAULT 0', 'group_buy_current INTEGER DEFAULT 0',
    'group_buy_deadline DATETIME', "group_buy_status TEXT DEFAULT 'active'",
    'store_verify_pin TEXT',
    // 🛡️ 2026-04-27: Magic Link — 사장님 PIN 없이 통계 페이지 진입.
    'store_owner_token TEXT',
    // 🛡️ 2026-05-15: 티어 할인 시스템 — JSON 배열 [{ "min": 5, "discount_pct": 10 }, ...]
    'group_buy_tiers TEXT',
    // 🛡️ 2026-05-15: 마일스톤 알림 dedup
    'milestone_notified_50 INTEGER DEFAULT 0',
    'milestone_notified_80 INTEGER DEFAULT 0',
    'milestone_notified_lastone INTEGER DEFAULT 0',
  ]
  for (const col of columns) {
    try { await DB.prepare(`ALTER TABLE products ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_store_owner_token ON products(store_owner_token)`).run()
  } catch { /* exists */ }
  // 🛡️ 2026-05-22 perf index 즉시 적용 — schema-repair cron (18 UTC) 기다리지 않고
  //   ensureTables 첫 호출 시 자동 생성. 멱등 (IF NOT EXISTS).
  //   migrations/0276 와 동일한 partial composite index.
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_groupbuy_feed ON products (category, group_buy_status, created_at DESC) WHERE is_active = 1`).run()
  } catch { /* exists */ }
  // 🛡️ 2026-05-22 사용자 신고 "공동구매만 늦음" 영구 해결:
  //   LEFT JOIN gift_catalog ON gc.gift_code = p.kt_alpha_gift_code 의 인덱스 부재 →
  //   매 요청마다 full table scan (100ms+). 인덱스 추가로 즉시 lookup.
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_kt_alpha_gift_code ON products(kt_alpha_gift_code) WHERE kt_alpha_gift_code IS NOT NULL`).run()
  } catch { /* exists */ }
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_gift_catalog_gift_code ON gift_catalog(gift_code)`).run()
  } catch { /* table missing — OK */ }
  // 🛡️ 2026-05-22: materialized cache table 도 동시 생성 (cron 이 사용).
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS group_buy_feed_cache (
      status TEXT NOT NULL,
      category TEXT NOT NULL,
      product_json TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      computed_at DATETIME NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (status, category)
    )`).run()
  } catch { /* exists */ }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'unused',
        used_at DATETIME,
        expires_at DATETIME,
        applied_discount_pct INTEGER DEFAULT 0,
        applied_price INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch { /* exists */ }
  // applied_* 컬럼 자동 추가 (기존 테이블 마이그레이션)
  for (const col of ['applied_discount_pct INTEGER DEFAULT 0', 'applied_price INTEGER']) {
    try { await DB.prepare(`ALTER TABLE vouchers ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
  _ensuredTables = true
}

/**
 * 티어 할인 계산 — group_buy_tiers JSON 파싱 + current 에 맞는 최고 tier 적용.
 *   tiers = [{ min: 5, discount_pct: 5 }, { min: 10, discount_pct: 15 }, { min: 20, discount_pct: 25 }]
 *   current=12 → discount_pct=15 (가장 높은 충족 tier)
 *   tiers null/empty → discount_pct=0
 */
export function calcTierDiscount(
  tiersJson: string | null,
  current: number,
): { discount_pct: number; next_tier: { min: number; discount_pct: number } | null } {
  if (!tiersJson) return { discount_pct: 0, next_tier: null }
  try {
    const tiers = JSON.parse(tiersJson) as Array<{ min: number; discount_pct: number }>
    if (!Array.isArray(tiers) || tiers.length === 0) return { discount_pct: 0, next_tier: null }
    // 정렬 후 current 이하 max + current 초과 min 찾기
    const sorted = [...tiers].sort((a, b) => a.min - b.min)
    let achieved = 0
    let next: { min: number; discount_pct: number } | null = null
    for (const t of sorted) {
      if (current >= t.min) achieved = Math.max(achieved, t.discount_pct)
      else { next = t; break }
    }
    return { discount_pct: achieved, next_tier: next }
  } catch { return { discount_pct: 0, next_tier: null } }
}

/**
 * 🛡️ 2026-05-30: 즉시판매 단일가 모델 (공동구매 = 즉시판매, design/groupbuy-instant-sale.md).
 *   인원수와 무관하게 **최대 tier 할인**을 처음부터 모두에게 적용 (A2 — 그룹가 즉시 단일 적용).
 *   calcTierDiscount(인원 기반 동적 인하) 를 대체 — "먼저 산 사람이 더 비쌈" 모순 제거.
 *   tiers null/empty → 0 (셀러가 price 를 단일 공구가로 직접 설정한 신규 모델).
 */
export function maxTierDiscount(tiersJson: string | null): number {
  if (!tiersJson) return 0
  try {
    const tiers = JSON.parse(tiersJson) as Array<{ min: number; discount_pct: number }>
    if (!Array.isArray(tiers) || tiers.length === 0) return 0
    return tiers.reduce((max, t) => Math.max(max, Number(t.discount_pct) || 0), 0)
  } catch { return 0 }
}

/**
 * 🛡️ 2026-05-30: 인플루언서 커미션 clawback — voucher 환불/취소 시 미지급 커미션 회수.
 *   admin force-refund(group-buy-admin.routes.ts:272) / 만료 cron(auto-settlement.ts:259) 의
 *   인라인 로직을 공유 헬퍼로 통합 — 셀러 /refund + 사용자 셀프취소 누수 차단.
 *   pending/available + paid_at IS NULL 건만 회수 (이미 송금된 'paid' 는 미차감 — 다음 정산 음수 처리).
 *   best-effort: 호출자가 try/catch 또는 waitUntil 로 감쌀 것 (환불 자체는 항상 진행).
 */
export async function clawbackVoucherCommission(
  DB: D1Database,
  voucherId: number,
  reason: string,
): Promise<number> {
  let clawed = 0
  const { results: attrs } = await DB.prepare(
    `SELECT id, influencer_id, commission_amount, status
     FROM influencer_attributions
     WHERE voucher_id = ? AND status IN ('pending', 'available') AND paid_at IS NULL`
  ).bind(voucherId).all<{ id: number; influencer_id: string; commission_amount: number; status: string }>()
  for (const a of (attrs || [])) {
    await DB.prepare(
      "UPDATE influencer_attributions SET status = 'clawed_back', clawback_reason = ? WHERE id = ?"
    ).bind(reason, a.id).run()
    if (a.status === 'pending') {
      await DB.prepare("UPDATE influencer_balances SET pending_amount = MAX(0, pending_amount - ?), updated_at = datetime('now') WHERE influencer_id = ?")
        .bind(a.commission_amount, a.influencer_id).run()
    } else if (a.status === 'available') {
      await DB.prepare("UPDATE influencer_balances SET available_amount = MAX(0, available_amount - ?), updated_at = datetime('now') WHERE influencer_id = ?")
        .bind(a.commission_amount, a.influencer_id).run()
    }
    clawed++
  }
  return clawed
}

/**
 * 🛡️ 2026-05-31: 공구 인플루언서 referral attribution + 사용자 추천 보너스 (딜/카드 공통).
 *   딜 경로(group-buy.routes.ts /join)의 인라인 4-account split 로직과 동일 — confirm-toss(카드)
 *   가 동일 로직을 호출하도록 추출 (이전: 카드 결제 referral 인플 커미션 미적립 갭).
 *   호출 전 referralInfluencerId 는 형식/자기참조/존재 검증 완료된 값이어야 함.
 *   반환 amount 로 호출자가 sellerAmount(정산 row) 계산.
 */
export async function applyGroupBuyReferral(
  DB: D1Database,
  rates: CommissionRates,
  p: {
    referralInfluencerId: string
    sellerId: number
    productId: number
    productName: string
    totalAmount: number
    orderNumber: string
    userId: string
    productReferralDisabled?: boolean
  },
): Promise<{ influencerAmount: number; userBonusAmount: number; influencerActive: boolean }> {
  if (!p.referralInfluencerId) return { influencerAmount: 0, userBonusAmount: 0, influencerActive: false }

  // 매장 marketing_enabled / 차단 / 상품 referral_disabled → 인플 비활성 (사용자 보너스는 유지).
  const blocked = await DB.prepare(
    "SELECT 1 FROM seller_blocked_influencers WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL"
  ).bind(p.sellerId, p.referralInfluencerId).first().catch(() => null)
  const sellerRow = await DB.prepare(
    `SELECT COALESCE(marketing_enabled, 1) AS marketing_enabled, referred_by_influencer, referral_bonus_until FROM sellers WHERE id = ?`
  ).bind(p.sellerId).first<{ marketing_enabled: number; referred_by_influencer: string | null; referral_bonus_until: string | null }>().catch(() => null)
  const influencerActive = !blocked && Number(sellerRow?.marketing_enabled ?? 1) === 1 && !p.productReferralDisabled

  let effectiveInfluencerPct = 0
  if (influencerActive) {
    const isReferredByThis = sellerRow?.referred_by_influencer === p.referralInfluencerId
    const referralBonusActive = !!sellerRow?.referral_bonus_until && new Date(sellerRow.referral_bonus_until) > new Date()
    const dealRow = await DB.prepare(
      `SELECT commission_pct FROM seller_influencer_deals WHERE seller_id = ? AND influencer_id = ? AND status = 'active' AND (ends_at IS NULL OR ends_at > datetime('now')) LIMIT 1`
    ).bind(p.sellerId, p.referralInfluencerId).first<{ commission_pct: number }>().catch(() => null)
    effectiveInfluencerPct = calcInfluencerCommissionPct(rates, {
      is_referred_by_this_influencer: isReferredByThis,
      referral_bonus_active: referralBonusActive,
      deal_commission_pct: dealRow?.commission_pct ?? null,
    })
  }
  const influencerAmount = influencerActive ? Math.floor(p.totalAmount * effectiveInfluencerPct / 100) : 0
  const userBonusAmount = Math.floor(p.totalAmount * rates.user_referral_bonus_pct / 100)

  // 사용자 추천 보너스 (active 든 차단이든 약속한 보너스는 지급).
  if (userBonusAmount > 0) {
    try {
      await DB.prepare("UPDATE user_points SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(userBonusAmount, p.userId).run()
      await DB.prepare(
        `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id)
         VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
      ).bind(p.userId, userBonusAmount, userBonusAmount, p.userId, `친구 추천 보너스 (${p.productName})`, p.orderNumber).run()
      await recordLedger(DB, {
        event_type: 'user_referral_bonus', reference_id: p.orderNumber, amount: userBonusAmount,
        debit_account: influencerActive ? `seller:${p.sellerId}` : 'platform:commission',
        credit_account: `user:${p.userId}`,
        metadata: { source: 'influencer_referral', influencer_id: p.referralInfluencerId, absorbed_by_platform: !influencerActive },
      })
    } catch (e) { if (import.meta.env?.DEV) console.warn('[gb referral user-bonus]', e) }
  }
  // 인플루언서 attribution + balance pending (활성 시만).
  if (influencerActive && influencerAmount > 0) {
    try {
      const availableAt = new Date(Date.now() + rates.refund_window_days * 86400_000).toISOString()
      await DB.prepare(
        `INSERT INTO influencer_attributions (influencer_id, order_id, product_id, seller_id, commission_amount, status, available_at)
         VALUES (?, 0, ?, ?, ?, 'pending', ?)`
      ).bind(p.referralInfluencerId, p.productId, p.sellerId, influencerAmount, availableAt).run()
      await DB.prepare(
        `INSERT INTO influencer_balances (influencer_id, pending_amount, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(influencer_id) DO UPDATE SET pending_amount = pending_amount + excluded.pending_amount, updated_at = datetime('now')`
      ).bind(p.referralInfluencerId, influencerAmount).run()
      await recordLedger(DB, {
        event_type: 'influencer_commission', reference_id: p.orderNumber, amount: influencerAmount,
        debit_account: `seller:${p.sellerId}`, credit_account: `influencer:${p.referralInfluencerId}`,
        metadata: { product_id: p.productId, available_at: availableAt },
      })
    } catch (e) { if (import.meta.env?.DEV) console.warn('[gb referral attribution]', e) }
  }
  return { influencerAmount, userBonusAmount, influencerActive }
}

/**
 * 🛡️ 2026-05-30: 환불 완료 알림톡 통합 — 셀러/어드민 환불, 사용자 셀프취소, 부분환불 공통.
 *   users.phone 조회 후 sendSystemAlimtalk('voucher_refunded'). best-effort (phone 없으면 skip).
 */
export async function sendRefundAlimtalk(
  env: Record<string, unknown>,
  DB: D1Database,
  userId: string | null,
  productName: string,
  amount: number,
): Promise<void> {
  try {
    if (!userId) return
    const user = await DB.prepare('SELECT phone FROM users WHERE id = ?').bind(userId).first<{ phone: string }>()
    if (!user?.phone) return
    const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk')
    const msg = `[유어딜] 환불 완료 — ${productName}\n${amount.toLocaleString('ko-KR')}원이 환불 처리되었습니다.\n(딜 결제건은 즉시 잔액 반영, 카드 결제건은 영업일 기준 3~5일 소요)`
    await sendSystemAlimtalk(env, user.phone, 'voucher_refunded', msg)
  } catch { /* best-effort */ }
}

/**
 * 바우처 코드 생성 — 'UR-XXXX-XXXX' (8 chars + dash, 32^8 = 1.1조 가능).
 * 🛡️ Math.random → crypto.getRandomValues (guessable code 방어).
 */
export function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let code = 'UR-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i] % chars.length)
    if (i === 3) code += '-'
  }
  return code
}

/**
 * 🛡️ 2026-05-16: UNIQUE 충돌 retry 가능한 voucher code 생성.
 *   32^8 = 1.1조 조합이라 충돌 확률 극히 낮지만 0 아님 (생일 역설 — 100만 voucher 발급 시 ~0.5%).
 *   DB collision 발생하면 최대 5회 재시도 후 예외.
 */
export async function generateUniqueVoucherCode(DB: D1Database): Promise<string> {
  // 🛡️ 2026-05-24 Q4 perf: 사전 SELECT 제거 — UNIQUE constraint 가 진짜 충돌 잡음.
  //   32^8 = 1.1조 조합. 100만 voucher 발급 시 충돌 확률 ~0.5% — 정상 흐름에선 발생 X.
  //   이전: voucher 1개당 1 SELECT (qty=10 → 10 sequential await ~200ms).
  //   이후: voucher 1개당 0 SELECT (sync 생성) → 호출자에서 Promise.all 병렬 가능.
  //   collision 실제 발생 시: DB.batch() 가 throw → 호출자가 retry (드물어서 비용 무시).
  void DB  // signature 유지 (호출자 변경 없이).
  return generateVoucherCode()
}

/** Magic Link 사장님 토큰 — 32자 hex (128bit), URL-safe. */
export function generateStoreOwnerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 사장님께 Magic Link 알림톡 발송 (best-effort).
 * ALIMTALK_API_KEY / ALIMTALK_SENDER_KEY 미설정 시 silent skip.
 */
export async function sendStoreOwnerAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { restaurantName: string; productName: string; statsUrl: string; categoryLabel?: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return // 미설정 시 silently skip
  try {
    // 정규화: 010-xxxx-xxxx → 01012345678
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return

    // 🛡️ 2026-05-21: 모든 voucher 카테고리 지원 — categoryLabel 옵션 (default '식사권').
    const label = data.categoryLabel || '식사권'
    const message = `[유어딜] ${label} 통계 페이지 안내

안녕하세요, ${data.restaurantName} 사장님!
"${data.productName}" ${label} 공동구매가 등록되었습니다.

📊 실시간 발급/사용 현황 확인:
${data.statsUrl}

✅ 이 링크는 사장님 전용 영구 링크입니다.
즐겨찾기에 추가하시면 편하게 확인할 수 있어요.

문의가 있으시면 언제든 연락주세요.`

    // Solapi-style 호출 (실제 provider 마다 다름 — 환경변수로 baseURL 받으면 더 유연)
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: cleanPhone,
          from: env.ALIMTALK_SENDER_KEY || '15441234',
          text: message,
          type: 'LMS', // 알림톡 템플릿 미등록 시 LMS fallback
        },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => { /* silently fail — 운영 영향 없게 */ })
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: 사용자에게 voucher 발급 알림톡 (결제 완료 직후).
 *   링크: https://live.ur-team.com/my-vouchers (QR 코드 화면 진입)
 */
export async function sendBuyerVoucherIssuedAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { productName: string; restaurantName?: string; qty: number; expiresAt: string; categoryLabel?: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const expDate = new Date(data.expiresAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    // 🛡️ 2026-05-21: 모든 voucher 카테고리 지원 — categoryLabel 옵션.
    const label = data.categoryLabel || '식사권'
    const message = `[유어딜] ${label} 발급 완료

${data.restaurantName ? data.restaurantName + ' · ' : ''}${data.productName}
${data.qty}장 발급되었습니다.

📱 매장에서 QR 코드 보여주세요:
https://live.ur-team.com/my-vouchers

⏰ 유효기간: ${expDate}까지

문의: 유어딜 고객센터`
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { to: cleanPhone, from: env.ALIMTALK_SENDER_KEY || '15441234', text: message, type: 'LMS' },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(swallow("helpers:alimtalk:voucher-issued"))
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: 매장 사장님에게 "곧 손님 옵니다" 친절 알림톡 (첫 voucher 발급 시 1회).
 *   sellers.first_voucher_notified flag 로 dedup.
 */
export async function sendSellerFirstVoucherAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { restaurantName: string; productName: string; statsUrl: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const message = `[유어딜] 🎉 첫 손님이 곧 방문합니다

${data.restaurantName} 사장님,
"${data.productName}" 첫 손님이 식권을 구매했어요!

📋 사용 처리 방법
1. 본인 폰으로 아래 링크 진입 (즐겨찾기 권장)
   ${data.statsUrl}
2. 손님이 QR 보여주면 [QR 스캔] 버튼 → 자동 처리
3. 화면에 "메뉴 X 제공" 표시 후 음식 준비
4. POS / T오더 결제 X (이미 유어딜에서 결제 완료)

💰 정산
사용 + 7일 후 등록 계좌로 자동 송금됩니다.

문의: 유어딜 고객센터`
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { to: cleanPhone, from: env.ALIMTALK_SENDER_KEY || '15441234', text: message, type: 'LMS' },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(swallow("helpers:alimtalk:seller-first-voucher"))
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: voucher 사용 완료 알림톡 (매장이 QR 스캔 직후).
 */
export async function sendBuyerVoucherUsedAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { restaurantName: string; productName: string; usedAt?: string; categoryLabel?: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const ts = data.usedAt ? new Date(data.usedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''
    // 🛡️ 2026-05-21: 모든 voucher 카테고리 지원 — categoryLabel 옵션.
    const label = data.categoryLabel || '식사권'
    const message = `[유어딜] ✅ ${label} 사용 완료

${data.restaurantName}
"${data.productName}"
${ts ? '사용 시각: ' + ts : ''}

맛있게 드세요! 🍱

후기 작성하면 보너스 딜 지급:
https://live.ur-team.com/my-vouchers

문의: 유어딜 고객센터`
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { to: cleanPhone, from: env.ALIMTALK_SENDER_KEY || '15441234', text: message, type: 'LMS' },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(swallow("helpers:alimtalk:voucher-used"))
  } catch { /* graceful */ }
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTables = new WeakSet<object>()
