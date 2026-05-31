/**
 * 공동구매 & 식사권 바우처 API
 *
 * GET  /api/group-buy/products       - 공동구매 상품 목록
 * GET  /api/group-buy/products/:id   - 공동구매 상품 상세
 * POST /api/group-buy/join/:id       - 공동구매 참여 (주문+딜 결제)
 * GET  /api/vouchers/my              - 내 바우처 목록
 * POST /api/vouchers/:code/use       - 바우처 사용 처리
 */

import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { auditLog } from '@/worker/middleware/audit-log'
import { recordLedger } from '@/worker/utils/ledger'
import { swallow } from '@/worker/utils/swallow'
import { getCommissionRates, calcInfluencerCommissionPct } from './commission-rates'
import type { Env } from '@/worker/types/env'
import type { GroupBuyProductRow } from '@/shared/db/group-buy-types'
// 🛡️ 2026-05-15 (TD-G01 3단계): helper / sub-router 분리.
import {
  ensureTables,
  maxTierDiscount,
  generateVoucherCode,
  generateUniqueVoucherCode,
  getSellerCommissionRate,
  applyGroupBuyReferral,
  sendBuyerVoucherIssuedAlimtalk,
  sendSellerFirstVoucherAlimtalk,
} from './helpers'
// 🛡️ 2026-05-21: 모든 voucher 카테고리에서 동작하려면 식사권 hardcode 제거 — getVoucherShortLabel 사용.
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'

const groupBuyRoutes = new Hono<{ Bindings: Env }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// 🛡️ 2026-05-15 (TD-G01 3단계): helper 함수 + 상수는 ./helpers.ts 로 이동.
//   getMealVoucherCommissionRate / getSellerCommissionRate / ensureTables /
//   calcTierDiscount / generateVoucherCode / generateStoreOwnerToken / sendStoreOwnerAlimtalk

// 🛡️ 2026-05-15 (TD-G01 3단계): 공개 endpoints 는 group-buy-public.routes.ts 로 분리.
//   GET /products / /products/:id / /live-ticker / /products/:id/participants
//   GET /commission-rate / /my / /verify/:code

// ── POST /api/group-buy/join/:id — 공동구매 참여 ────────────────────
// 🛡️ 2026-05-15: rate limit 5/min per user — 동시 클릭 / 자동화 방어 (재고 + voucher 중복 발급 위험)
groupBuyRoutes.post('/join/:id', rateLimit({ action: 'group_buy_join', max: 5, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const { DB } = c.env
  await ensureTables(DB)
  const productIdRaw = c.req.param('id')
  const productIdNum = Number(productIdRaw)
  if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const productId = productIdNum
  const userId = String(user.id)
  const body = await c.req.json<{
    quantity?: number; payment_method?: 'deal' | 'toss'; promo_code?: string; ref?: string; idempotency_key?: string
  }>().catch(() => ({ quantity: 1, payment_method: 'deal' as const, promo_code: undefined as string | undefined, ref: undefined as string | undefined, idempotency_key: undefined as string | undefined }))
  const { quantity, payment_method, promo_code, ref, idempotency_key } = body

  // 🛡️ 2026-05-23 idempotency — 중복 클릭 / 네트워크 retry 시 중복 발급 영구 차단.
  //   client 가 unique idempotency_key 보내고, server 가 같은 key 의 기존 order 있으면 그 결과 반환.
  //   key 미지정 시 일반 흐름 (rate limit 만 보호).
  if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.length > 8 && idempotency_key.length <= 128) {
    try {
      const existing = await c.env.DB.prepare(
        `SELECT id, order_number, total_amount FROM orders WHERE idempotency_key = ? AND user_id = ? LIMIT 1`
      ).bind(idempotency_key, userId).first<{ id: number; order_number: string; total_amount: number }>()
      if (existing) {
        const vouchers = await c.env.DB.prepare(
          `SELECT code, expires_at FROM vouchers WHERE order_id = ? ORDER BY id`
        ).bind(existing.id).all<{ code: string; expires_at: string }>()
        return c.json({
          success: true,
          idempotent: true,
          order_number: existing.order_number,
          total_amount: existing.total_amount,
          vouchers: vouchers.results || [],
          message: '이미 처리된 교환입니다. 같은 교환권이 반환되었습니다.',
        })
      }
    } catch { /* idempotency 검사 실패 — 일반 흐름 진행 */ }
  }
  // 🛡️ 2026-05-16: ref = 인플루언서 ID (?ref= 진입 또는 본문). 형식 검증.
  // 🛡️ 2026-05-21 Phase D-3: 자기 자신 attribution 차단 (셀러가 본인 링크로 매출 인플레이션).
  const refRaw = ref ? String(ref).trim() : ''
  let referralInfluencerId = refRaw && /^[a-zA-Z0-9_\-:]{1,64}$/.test(refRaw) ? refRaw : ''
  if (referralInfluencerId && String(referralInfluencerId) === String(userId)) {
    referralInfluencerId = ''  // 자기 자신 → silent ignore (에러 안 띄움)
  }
  // 존재 검증 — 가짜 ID (?seller=999999) 차단. sellers 또는 users 둘 다 허용.
  if (referralInfluencerId) {
    try {
      const exists = await DB.prepare(
        "SELECT 1 FROM sellers WHERE id = ? UNION ALL SELECT 1 FROM users WHERE id = ? LIMIT 1",
      ).bind(referralInfluencerId, referralInfluencerId).first()
      if (!exists) referralInfluencerId = ''
    } catch { /* graceful — DB 미정상 시 attribution 무시 */ }
  }
  const qty = Number(quantity ?? 1)
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1 || qty > 100) {
    return c.json({ success: false, error: '수량은 1~100 사이의 정수여야 합니다' }, 400)
  }
  if (payment_method !== undefined && payment_method !== 'deal' && payment_method !== 'toss') {
    return c.json({ success: false, error: '잘못된 결제 수단입니다' }, 400)
  }

  // 🛡️ 2026-05-22 v2 — toss 결제 진짜 흐름 활성 (이전 fake-PAID 보안 버그 영구 해결):
  //   payment_method='toss' 흐름:
  //     1) /join 은 server-side 검증 (재고/카테고리/마감/seller_id) 만 수행
  //     2) wallet 차감 X, orders INSERT 도 X (PENDING row 만들면 결제 안 끝났을 때 cleanup 부담)
  //     3) Toss init params 반환 → 클라이언트가 SDK 로 결제 redirect
  //     4) success URL → POST /api/group-buy/confirm-toss (별도 endpoint) → confirmTossPayment + voucher 발급
  //   장점: 검증/결제/voucher 발급 모두 atomic. 실패 시 부분 상태 X.
  if (payment_method === 'toss') {
    // 사전 검증만 (실제 결제는 confirm-toss endpoint 가 처리).
    // 토스 init params 반환 — 클라이언트가 이를 SDK 에 전달.
    const { decideTossFlow, generateTossOrderId } = await import('../../../worker/utils/toss-gateway')
    const tossKey = (c.env as { TOSS_CLIENT_KEY?: string }).TOSS_CLIENT_KEY || ''
    const { flow, flowReason } = decideTossFlow(tossKey)
    if (flow === 'invalid') {
      return c.json({
        success: false,
        error: '결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.',
        code: 'PAYMENT_KEY_INVALID',
        _debug: flowReason,
      }, 503)
    }

    // 상품 검증 (재고/마감/카테고리) — deal 흐름의 검증 로직 일부 재사용.
    // 🛡️ 2026-05-23: deal_only=1 도 매칭 (VouchersPage 필터 정합) — voucher category 없어도 deal-only 면 교환 가능.
    const product = await DB.prepare(
      "SELECT id, name, price, group_buy_status, group_buy_deadline, voucher_expiry, seller_id, group_buy_tiers FROM products WHERE id = ? AND is_active = 1 AND (category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher') OR deal_only = 1)"
    ).bind(productId).first<{ id: number; name: string; price: number; group_buy_status: string; group_buy_deadline: string | null; voucher_expiry: string | null; seller_id: number; group_buy_tiers: string | null }>()
    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    if (product.seller_id && Number(product.seller_id) === Number(userId)) {
      return c.json({ success: false, error: '본인의 공동구매 상품에는 참여할 수 없습니다', code: 'SELF_PARTICIPATION_BLOCKED' }, 403)
    }
    if (product.group_buy_deadline && new Date(product.group_buy_deadline) < new Date()) {
      return c.json({ success: false, error: '공동구매가 마감되었습니다' }, 400)
    }
    if (product.group_buy_status === 'expired' || product.group_buy_status === 'cancelled') {
      return c.json({ success: false, error: '종료된 공동구매입니다' }, 400)
    }

    // 🛡️ 2026-05-31: 즉시판매 단일가(A2) — 카드 경로도 딜과 동일하게 최대 tier 할인 적용.
    //   이전: product.price 정가 → 카드 구매자가 딜 구매자보다 비싸게 결제하는 불일치.
    const tierDiscountPct = maxTierDiscount(product.group_buy_tiers)
    const totalAmount = Math.round(product.price * (1 - tierDiscountPct / 100)) * qty
    const orderId = generateTossOrderId('GB', userId)
    return c.json({
      success: true,
      data: {
        orderId,
        amount: totalAmount,
        orderName: `공구: ${product.name} × ${qty}`,
        clientKey: tossKey,
        flow,
        // 클라이언트 metadata — confirm 시 다시 전송.
        productId,
        qty,
        promoCode: promo_code ? String(promo_code).trim().toUpperCase() : null,
        ref: referralInfluencerId || null,
      },
    })
  }
  // 🛡️ 2026-05-15: promo_code 형식 검증 (실제 검증은 아래 적용 직전)
  const promoCodeNormalized = promo_code ? String(promo_code).trim().toUpperCase() : ''
  if (promoCodeNormalized && !/^[A-Z0-9]{4,20}$/.test(promoCodeNormalized)) {
    return c.json({ success: false, error: '잘못된 promo 코드 형식' }, 400)
  }

  try {
    // 🛡️ 2026-05-21: 모든 voucher 카테고리 지원 (식사/뷰티/건강/펫/액티비티/숙소/기타).
    //   이전엔 'meal_voucher' hardcode 였음 → 다른 카테고리 결제 막힘 (404 발생).
    //   영구 fix: VOUCHER_CATEGORIES 통합 + 헬퍼와 동일 IN 절 사용.
    // 🛡️ 2026-05-23: deal_only=1 도 매칭 (위 query 와 동일 룰).
    const product = await DB.prepare(
      "SELECT * FROM products WHERE id = ? AND is_active = 1 AND (category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher') OR deal_only = 1)"
    ).bind(productId).first<GroupBuyProductRow>()

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    // 🛡️ 2026-04-22: 셀러가 본인 공구에 자기 참여 차단 (목표 조작 방지)
    if (product.seller_id && Number(product.seller_id) === Number(userId)) {
      return c.json({
        success: false,
        error: '본인의 공동구매 상품에는 참여할 수 없습니다',
        code: 'SELF_PARTICIPATION_BLOCKED'
      }, 403)
    }

    // 공동구매 마감 확인 (마감 시간이 참여보다 먼저 체크되도록)
    if (product.group_buy_deadline && new Date(product.group_buy_deadline) < new Date()) {
      return c.json({ success: false, error: '공동구매가 마감되었습니다' }, 400)
    }

    // 🛡️ 2026-05-15: 이미 종료/취소된 공구 차단 (status 가드)
    if (product.group_buy_status === 'expired' || product.group_buy_status === 'cancelled') {
      return c.json({ success: false, error: '종료된 공동구매입니다' }, 400)
    }

    // 🛡️ 2026-05-15: voucher 만료일 가드 — 공구 마감 전에 voucher 가 먼저 만료되면 무용지물
    if (product.voucher_expiry && product.group_buy_deadline) {
      if (new Date(product.voucher_expiry) <= new Date(product.group_buy_deadline)) {
        return c.json({ success: false, error: '바우처 만료일이 공구 마감 전이라 발급할 수 없습니다. 셀러에게 문의해주세요.' }, 400)
      }
    }

    // ✅ BUG #26 FIX: Atomic stock reservation. Previous SELECT-then-UPDATE
    // pattern allowed two concurrent joiners to both pass the stock check and
    // then oversell via unconditional decrement.
    const reserveStock = await DB.prepare(
      'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?'
    ).bind(qty, productId, qty).run()
    if (!reserveStock.meta.changes) {
      return c.json({ success: false, error: '재고가 부족합니다' }, 409)
    }

    // 🛡️ 2026-05-30: 즉시판매 단일가 모델 (A2) — 인원 무관 최대 tier 할인을 모두에게 즉시 적용.
    //   AS-IS(calcTierDiscount, 인원 늘수록 깎임) 는 "먼저 산 사람이 더 비쌈" 모순 → 제거.
    //   design/groupbuy-instant-sale.md 참조. 공구가 = price × (1 - maxTier). promo 는 그대로 cascade.
    const tierDiscountPct = maxTierDiscount(product.group_buy_tiers)

    // 🛡️ 2026-05-15: Promo 코드 추가 할인 — 셀러 자체 발급, audience/한도/만료 검증.
    //   여기서 검증 + 즉시 used_count 증가 (race 방어). 차감 후 정상 응답 못 받으면 외부 catch 가 rollback.
    let promoDiscountPct = 0
    let appliedPromoId: number | null = null
    if (promoCodeNormalized) {
      const promo = await DB.prepare(
        `SELECT id, seller_id, discount_pct, audience, max_uses, per_user_limit, used_count, expires_at, is_active
         FROM promo_codes WHERE code = ?`
      ).bind(promoCodeNormalized).first<{
        id: number; seller_id: number; discount_pct: number; audience: string;
        max_uses: number; per_user_limit: number; used_count: number; expires_at: string | null; is_active: number
      }>().catch(() => null)
      if (!promo || !promo.is_active) {
        return c.json({ success: false, error: '코드 없음 또는 비활성', code: 'PROMO_INVALID' }, 400)
      }
      if (Number(promo.seller_id) !== Number(product.seller_id)) {
        return c.json({ success: false, error: '이 셀러의 코드가 아닙니다', code: 'PROMO_WRONG_SELLER' }, 400)
      }
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        return c.json({ success: false, error: '만료된 코드', code: 'PROMO_EXPIRED' }, 400)
      }
      if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
        return c.json({ success: false, error: '사용 한도 도달', code: 'PROMO_LIMIT' }, 400)
      }
      // audience 검증
      if (promo.audience === 'followers_only') {
        const isFollower = await DB.prepare(
          `SELECT 1 FROM seller_follows WHERE seller_id = ? AND user_id = ?`
        ).bind(promo.seller_id, userId).first().catch(() => null)
        if (!isFollower) return c.json({ success: false, error: '단골 전용 코드 — 단골 등록 후 다시 시도', code: 'PROMO_FOLLOWERS_ONLY' }, 400)
      } else if (promo.audience === 'new_users_only') {
        const hasOrder = await DB.prepare(
          `SELECT 1 FROM orders WHERE user_id = ? AND seller_id = ? AND status = 'PAID' LIMIT 1`
        ).bind(userId, promo.seller_id).first().catch(() => null)
        if (hasOrder) return c.json({ success: false, error: '신규 고객 전용 코드', code: 'PROMO_NEW_ONLY' }, 400)
      }
      // per-user-limit
      const userUses = await DB.prepare(
        `SELECT COUNT(*) AS cnt FROM promo_redemptions WHERE promo_id = ? AND user_id = ?`
      ).bind(promo.id, userId).first<{ cnt: number }>().catch(() => ({ cnt: 0 } as { cnt: number }))
      if ((userUses?.cnt ?? 0) >= promo.per_user_limit) {
        return c.json({ success: false, error: `1인당 ${promo.per_user_limit}회 한도 도달`, code: 'PROMO_USER_LIMIT' }, 400)
      }
      // 적용 결정 — 차감은 voucher 발급 직전 (atomic)
      promoDiscountPct = promo.discount_pct
      appliedPromoId = promo.id
    }

    // 🛡️ 두 할인 합산은 곱셈 적용 (cascade): 가격 × (1 - tier) × (1 - promo)
    //   예: tier 10% + promo 20% → 1 × 0.9 × 0.8 = 0.72 → 28% 할인 효과
    //   덧셈 적용 (1 - 0.10 - 0.20 = 0.70) 보다 약간 적게 — 셀러 마진 보호
    const appliedDiscountPct = Math.round(100 - (1 - tierDiscountPct / 100) * (1 - promoDiscountPct / 100) * 100)
    const unitPrice = Math.round(product.price * (1 - appliedDiscountPct / 100))
    const totalAmount = unitPrice * qty
    const orderNumber = `GB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    // 딜 결제
    if (payment_method === 'deal') {
      // 🛡️ 2026-05-24: KT Alpha 상품 (kt_alpha_gift_code 보유) 인데 사용자 phone 없으면
      //   백그라운드 발송이 silent skip → 사용자가 voucher 못 받음 (큰 사고).
      //   여기서 미리 차단 → 클라이언트가 phone 입력 모달 띄움 → 다시 시도.
      if ((product as { kt_alpha_gift_code?: string }).kt_alpha_gift_code) {
        const userRow = await DB.prepare('SELECT phone FROM users WHERE id = ?')
          .bind(userId).first<{ phone: string | null }>().catch(() => null)
        const phone = String(userRow?.phone || '').replace(/\D/g, '')
        if (!/^01\d{8,9}$/.test(phone)) {
          return c.json({
            success: false,
            error: 'KT Alpha 기프티쇼 발송을 위해 전화번호 등록이 필요합니다',
            code: 'PHONE_REQUIRED',
          }, 400)
        }
      }

      const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
        .bind(userId).first<{ balance: number }>()

      if (!wallet || wallet.balance < totalAmount) {
        return c.json({ success: false, error: `딜이 부족합니다 (보유: ${wallet?.balance ?? 0}딜)`, code: 'INSUFFICIENT_POINTS' }, 400)
      }

      // 딜 차감 (atomic: balance >= totalAmount 조건으로 race condition 방지)
      const deductResult = await DB.prepare('UPDATE user_points SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND balance >= ?')
        .bind(totalAmount, userId, totalAmount).run()
      if (!deductResult.meta.changes) {
        return c.json({ success: false, error: '딜이 부족합니다 (동시 결제 충돌)', code: 'INSUFFICIENT_POINTS' }, 400)
      }

      await DB.prepare(
        `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
         VALUES (?, 'donate', ?, 0, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
      ).bind(userId, totalAmount, totalAmount, userId, `공동구매: ${product.name}`, orderNumber).run()
    }

    // 🛡️ 2026-05-13 (운영 안정성 #2): 딜 차감 후 후속 INSERT (orders/items/vouchers/progress)
    //   실패 시 자동 환불. D1 은 trx 미지원 — 명시적 rollback 으로 처리.
    //   복구 대상: deal 차감 + stock 차감 (이미 위에서 atomic 처리됨 → 여기서 함께 복구).
    const rollbackDealAndStock = async () => {
      if (payment_method === 'deal') {
        try {
          await DB.prepare("UPDATE user_points SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
            .bind(totalAmount, userId).run()
          await DB.prepare(
            `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
             VALUES (?, 'refund', ?, 0, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
          ).bind(userId, totalAmount, totalAmount, userId, `공동구매 자동 환불 (주문 실패): ${product.name}`, orderNumber).run()
        } catch (e) { console.error('[group-buy/join] deal rollback failed', e) }
      }
      // stock 도 복구
      try {
        await DB.prepare("UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(qty, productId).run()
      } catch (e) { console.error('[group-buy/join] stock rollback failed', e) }
    }

    try {

    // 🛡️ 2026-05-15: 셀러 차등 수수료 — GMV 기반 자동 (1천만+ 4%, 1억+ 3%) / 어드민 override 우선
    // 🛡️ 2026-05-24 Q4 perf: getSellerCommissionRate + getCommissionRates 병렬 (이전: 직렬 2 awaits ~30-60ms 절약).
    const [commissionRate, rates] = await Promise.all([
      getSellerCommissionRate(DB, Number(product.seller_id)),
      getCommissionRates(DB),
    ])
    const commissionAmount = Math.round(totalAmount * commissionRate)

    // 🛡️ 2026-05-16: 인플루언서 referral 정산 4-account split.
    //   1) 매장 marketing_enabled = 0 → 인플 commission 0 (사용자 보너스는 우리가 떠안음)
    //   2) seller_blocked_influencers 에 매핑 있음 → 동일
    //   3) products.referral_disabled = 1 → 동일
    //   4) 모두 통과 → 정상 인플 + 사용자 보너스 지급
    let hasInfluencer = false
    let influencerActive = false
    let effectiveInfluencerPct = 0  // 영입 보너스 + deal 적용 후 최종 %
    if (referralInfluencerId) {
      hasInfluencer = true  // ?ref= 자체는 있음 (사용자 보너스 트리거)
      const blocked = await DB.prepare(
        "SELECT 1 FROM seller_blocked_influencers WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL"
      ).bind(product.seller_id, referralInfluencerId).first().catch(() => null)
      const sellerRow = await DB.prepare(
        `SELECT COALESCE(marketing_enabled, 1) AS marketing_enabled,
                referred_by_influencer, referral_bonus_until
         FROM sellers WHERE id = ?`
      ).bind(product.seller_id).first<{ marketing_enabled: number; referred_by_influencer: string | null; referral_bonus_until: string | null }>().catch(() => null)
      const productReferralDisabled = Number((product as { referral_disabled?: number }).referral_disabled) === 1
      influencerActive = !blocked && Number(sellerRow?.marketing_enabled ?? 1) === 1 && !productReferralDisabled

      if (influencerActive) {
        // 🛡️ 2026-05-16: 영입 보너스 + 협업 deal cap 종합 계산
        const isReferredByThis = sellerRow?.referred_by_influencer === referralInfluencerId
        const referralBonusActive = !!sellerRow?.referral_bonus_until && new Date(sellerRow.referral_bonus_until) > new Date()
        const dealRow = await DB.prepare(
          `SELECT commission_pct FROM seller_influencer_deals
           WHERE seller_id = ? AND influencer_id = ? AND status = 'active'
             AND (ends_at IS NULL OR ends_at > datetime('now'))
           LIMIT 1`
        ).bind(product.seller_id, referralInfluencerId).first<{ commission_pct: number }>().catch(() => null)
        effectiveInfluencerPct = calcInfluencerCommissionPct(rates, {
          is_referred_by_this_influencer: isReferredByThis,
          referral_bonus_active: referralBonusActive,
          deal_commission_pct: dealRow?.commission_pct ?? null,
        })
      }
    }
    const influencerAmount = influencerActive ? Math.floor(totalAmount * effectiveInfluencerPct / 100) : 0
    const userBonusAmount = hasInfluencer ? Math.floor(totalAmount * rates.user_referral_bonus_pct / 100) : 0
    // sellerAmount = 총액 - 셀러 commission (유어딜) - 인플 - 사용자 보너스
    //   (에이전시 commission 은 셀러 수수료에 이미 포함된 경로로 처리 — agencies 별도 routing)
    const sellerAmount = totalAmount - commissionAmount - influencerAmount - userBonusAmount

    // 주문 생성 (idempotency_key 저장 — 중복 발급 영구 차단)
    // 🛡️ 2026-05-24 Q4 perf: INSERT ... RETURNING id 로 즉시 id 획득 (이전: INSERT 후 SELECT 별도 — 1 await 절약 ~20-50ms).
    const orderInsert = await DB.prepare(`
      INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method, idempotency_key)
      VALUES (?, ?, ?, ?, 0, 0, ?, 'KRW', 'PAID', ?, ?)
      RETURNING id
    `).bind(orderNumber, userId, product.seller_id, totalAmount, totalAmount, payment_method === 'deal' ? 'deal_points' : 'toss', idempotency_key || null).first<{ id: number }>()
    const newOrderId = orderInsert?.id ?? null

    // 🛡️ 2026-05-15: Double-entry ledger 기록 (정합성 검증 가능)
    try {
      await recordLedger(DB, {
        event_type: 'group_buy_join',
        reference_id: orderNumber,
        amount: totalAmount,
        debit_account: `user:${userId}`,                  // 유저 wallet 차감
        credit_account: `seller:${product.seller_id}`,    // 셀러 receivable 증가
        fee_amount: commissionAmount,
        fee_account: 'platform:commission',
        metadata: { product_id: productId, qty, applied_discount_pct: appliedDiscountPct },
      })
    } catch (e) { if (import.meta.env?.DEV) console.warn('[gb ledger]', e) }

    // 🛡️ 2026-05-31: 에이전시 입점 매장 commission — 공구 딜 결제도 적립 (이전: payment.routes 카드만
    //   호출 → 공구는 누락). UNIQUE(order_id,type) 멱등 + introduced_by_agency_id 없으면 noop.
    if (newOrderId) {
      c.executionCtx?.waitUntil((async () => {
        try {
          const { creditAgencyStoreIntroCommission } = await import('../../../worker/utils/agency-store-intro-commission')
          await creditAgencyStoreIntroCommission(DB, { id: newOrderId, seller_id: Number(product.seller_id), total_amount: totalAmount })
        } catch (e) { if (import.meta.env?.DEV) console.warn('[gb agency intro]', e) }
      })())
    }

    // 🛡️ 2026-05-16: 인플루언서 attribution + 사용자 referral 보너스 (4-account 확장)
    if (hasInfluencer) {
      // 사용자 보너스 즉시 적립 (active 든 차단이든 사용자에겐 약속한 보너스 지급)
      if (userBonusAmount > 0) {
        try {
          await DB.prepare(
            "UPDATE user_points SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
          ).bind(userBonusAmount, userId).run()
          await DB.prepare(
            `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id)
             VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
          ).bind(userId, userBonusAmount, userBonusAmount, userId, `친구 추천 보너스 (${product.name})`, orderNumber).run()
          await recordLedger(DB, {
            event_type: 'user_referral_bonus',
            reference_id: orderNumber,
            amount: userBonusAmount,
            debit_account: influencerActive ? `seller:${product.seller_id}` : 'platform:commission',  // 인플 활성 시 셀러 receivable 에서, 차단 시 유어딜이 떠안음
            credit_account: `user:${userId}`,
            metadata: { source: 'influencer_referral', influencer_id: referralInfluencerId, absorbed_by_platform: !influencerActive },
          })
        } catch (e) { if (import.meta.env?.DEV) console.warn('[gb user-bonus ledger]', e) }
      }
      // 인플루언서 attribution + balance pending (활성 시만)
      if (influencerActive && influencerAmount > 0) {
        try {
          // attribution row
          const refundWindowMs = rates.refund_window_days * 86400_000
          const availableAt = new Date(Date.now() + refundWindowMs).toISOString()
          await DB.prepare(
            `INSERT INTO influencer_attributions (influencer_id, order_id, product_id, seller_id, commission_amount, status, available_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`
          ).bind(referralInfluencerId, 0, productId, product.seller_id, influencerAmount, availableAt).run()
          // balance pending 증가 (UPSERT)
          await DB.prepare(
            `INSERT INTO influencer_balances (influencer_id, pending_amount, updated_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(influencer_id) DO UPDATE SET pending_amount = pending_amount + excluded.pending_amount, updated_at = datetime('now')`
          ).bind(referralInfluencerId, influencerAmount).run()
          // ledger entry — 셀러 receivable 차감 → 인플 balance
          await recordLedger(DB, {
            event_type: 'influencer_commission',
            reference_id: orderNumber,
            amount: influencerAmount,
            debit_account: `seller:${product.seller_id}`,
            credit_account: `influencer:${referralInfluencerId}`,
            metadata: { product_id: productId, available_at: availableAt },
          })
        } catch (e) { if (import.meta.env?.DEV) console.warn('[gb influencer attribution]', e) }
      }
    }

    // 정산 기록 (셀러 수령액 = 총액 - 10% 수수료)
    try {
      await DB.prepare(`
        INSERT INTO donations (live_stream_id, seller_id, donor_user_id, donor_name, amount,
          commission_amount, credit_amount, commission_rate, order_id, payment_status, message)
        VALUES (0, ?, ?, '공동구매', ?, ?, ?, ?, ?, 'completed', ?)
      `).bind(
        product.seller_id, userId,
        totalAmount, commissionAmount, sellerAmount, commissionRate,
        orderNumber, `${getVoucherShortLabel(product.category)} 공동구매: ${product.name}`
      ).run()
    } catch { /* donations 테이블 없으면 무시 */ }

    // 🛡️ 2026-05-24 Q4 perf: newOrderId 직접 사용 (INSERT RETURNING 으로 위에서 받음).
    //   이전: 별도 SELECT — 1 await 추가 (~20-50ms 절약).
    if (newOrderId) {
      // 🛡️ 2026-05-23: D1 batch() 로 voucher 일괄 INSERT — 부분 발급 영구 차단.
      //   이전 for-loop sequential INSERT: 중간 실패 시 일부만 발급 (부정합).
      //   이후 batch: 모두 성공 or 모두 실패 (Atomic).
      // 🛡️ 2026-05-24 Q4 perf:
      //   1) 코드 생성을 Promise.all 병렬 (이전: sequential await SELECT — qty=N 일 때 N awaits).
      //   2) order_items + vouchers INSERT 를 단일 DB.batch() 로 통합 (이전: 2 awaits).
      const expiresAt = product.voucher_expiry || new Date(Date.now() + 90 * 86400000).toISOString()
      const codes = await Promise.all(
        Array.from({ length: qty }, () => generateUniqueVoucherCode(DB))
      )
      const lastExpiresAt = expiresAt
      const orderItemStmt = DB.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(newOrderId, productId, product.name, product.price, product.price, qty, totalAmount)
      const voucherStmts = codes.map(code =>
        DB.prepare(`
          INSERT INTO vouchers (order_id, product_id, user_id, code, expires_at, applied_discount_pct, applied_price)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(newOrderId, productId, userId, code, expiresAt, appliedDiscountPct, unitPrice)
      )
      // order_items + vouchers 같은 batch — atomic + 1 round-trip.
      await DB.batch([orderItemStmt, ...voucherStmts])

      // 🛡️ 2026-05-23: KT Alpha (기프티쇼) 자동 발송 — products.kt_alpha_gift_code +
      //   auto_voucher_send=1 인 상품만. 딜 결제 흐름에서 사용자 폰으로 실제 MMS 발송.
      //   fail-soft — 발송 실패해도 voucher INSERT 는 보존 (admin 이 재발송 가능).
      //
      // 🛡️ 2026-05-25 영구 fix: 사용자 신고 (Order #85 (HOT)아메리카노) — frontend_errors 0건,
      //   voucher_orders 0건 = waitUntil 측 silent fail.
      //   해결: trigger 시점 frontend_errors 기록 + waitUntil 실패도 잡기 + fallback await.
      try {
        // trigger 진입 기록 (autoSend 함수 안 실행돼도 여기는 기록됨)
        await DB.prepare(
          `INSERT INTO frontend_errors (message, type, url, user_id, created_at)
           VALUES (?, 'kt_alpha_trigger', '/api/group-buy/join', ?, datetime('now'))`,
        ).bind(`KT Alpha auto-send trigger — order ${newOrderId}, user ${userId}`, String(userId))
          .run().catch(() => null)

        const { autoSendKtAlphaVouchersForOrders } = await import('../../../worker/utils/kt-alpha-auto-send')

        // 🛡️ shipping_phone null 하드코딩 제거 — autoSend 안에서 users.phone fallback 동작하지만
        //    명시적 보완: 여기서도 phone 사전 조회해서 전달 (race condition 회피).
        const ph = await DB.prepare("SELECT phone FROM users WHERE id = ? LIMIT 1")
          .bind(userId).first<{ phone: string | null }>().catch(() => null)
        const phoneArg = ph?.phone || null

        // c.executionCtx.waitUntil — production worker 에서 정상 동작. 없으면 (test/edge) await fallback.
        const runAutoSend = autoSendKtAlphaVouchersForOrders(
          c.env as unknown as Parameters<typeof autoSendKtAlphaVouchersForOrders>[0],
          [{ id: newOrderId, user_id: userId, shipping_phone: phoneArg }],
          userId,
        ).catch(async (e) => {
          const msg = (e as Error)?.message?.slice(0, 300) || String(e)
          console.error('[group-buy/join] kt-alpha auto-send failed:', msg)
          await DB.prepare(
            `INSERT INTO frontend_errors (message, type, url, user_id, created_at)
             VALUES (?, 'kt_alpha_send_throw', '/api/group-buy/join', ?, datetime('now'))`,
          ).bind(`KT Alpha auto-send throw (order ${newOrderId}): ${msg}`, String(userId))
            .run().catch(() => null)
        })

        // waitUntil 시도 — 실패 시 await fallback (응답 +1-2s 이지만 발급 보장).
        const ctxRef = (c as { executionCtx?: { waitUntil?: (p: Promise<unknown>) => void } }).executionCtx
        if (ctxRef && typeof ctxRef.waitUntil === 'function') {
          try { ctxRef.waitUntil(runAutoSend) } catch (waitErr) {
            await DB.prepare(
              `INSERT INTO frontend_errors (message, type, url, user_id, created_at)
               VALUES (?, 'kt_alpha_waituntil_fail', '/api/group-buy/join', ?, datetime('now'))`,
            ).bind(`waitUntil threw (order ${newOrderId}): ${(waitErr as Error)?.message?.slice(0, 200)}`, String(userId))
              .run().catch(() => null)
            await runAutoSend  // fallback 동기 await
          }
        } else {
          // executionCtx 미존재 — 동기 await (test/edge)
          await runAutoSend
        }
      } catch (e) {
        const msg = (e as Error)?.message?.slice(0, 300) || String(e)
        console.error('[group-buy/join] kt-alpha trigger setup failed:', msg)
        await DB.prepare(
          `INSERT INTO frontend_errors (message, type, url, user_id, created_at)
           VALUES (?, 'kt_alpha_setup_fail', '/api/group-buy/join', ?, datetime('now'))`,
        ).bind(`KT Alpha trigger setup failed (order ${newOrderId}): ${msg}`, String(userId))
          .run().catch(() => null)
      }

      // 🛡️ 2026-05-16: 사용자 phone 으로 voucher 발급 알림톡 (fire-and-forget)
      try {
        const userRow = await DB.prepare("SELECT phone FROM users WHERE id = ?").bind(userId).first<{ phone: string | null }>()
        if (userRow?.phone) {
          c.executionCtx.waitUntil(
            sendBuyerVoucherIssuedAlimtalk(
              c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
              userRow.phone,
              { productName: product.name, restaurantName: (product as { restaurant_name?: string }).restaurant_name, qty, expiresAt: lastExpiresAt, categoryLabel: getVoucherShortLabel(product.category) },
            )
          )
        }
      } catch { /* graceful */ }

      // 🛡️ 2026-05-16: 매장 사장님에게 첫 voucher 안내 알림톡 (sellers.first_voucher_notified=0 일 때만)
      try {
        try { await DB.prepare("ALTER TABLE sellers ADD COLUMN first_voucher_notified INTEGER DEFAULT 0").run() } catch {}
        const seller = await DB.prepare(
          "SELECT phone, business_name, COALESCE(first_voucher_notified, 0) AS notified, store_owner_token FROM sellers WHERE id = ?"
        ).bind(product.seller_id).first<{ phone: string | null; business_name: string; notified: number; store_owner_token: string | null }>()
        if (seller && Number(seller.notified) === 0 && seller.phone) {
          const token = seller.store_owner_token || ''
          const statsUrl = `https://live.ur-team.com/store/stats/${productId}${token ? `?t=${token}` : ''}`
          c.executionCtx.waitUntil(
            sendSellerFirstVoucherAlimtalk(
              c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
              seller.phone,
              { restaurantName: seller.business_name, productName: product.name, statsUrl },
            )
          )
          await DB.prepare("UPDATE sellers SET first_voucher_notified = 1 WHERE id = ?").bind(product.seller_id).run()
        }
      } catch { /* graceful */ }

      // 🛡️ 2026-05-15: Promo 코드 사용 기록 + used_count atomic increment
      //   redemptions UNIQUE(promo_id, user_id, order_number) → 같은 주문 중복 차단
      //   used_count 는 max_uses 미만 일 때만 증가 (race 방어)
      if (appliedPromoId) {
        try {
          await DB.prepare(
            `INSERT INTO promo_redemptions (promo_id, user_id, order_number, product_id, discount_amount)
             VALUES (?, ?, ?, ?, ?)`
          ).bind(appliedPromoId, userId, orderNumber, productId, totalAmount * promoDiscountPct / 100).run()
          // used_count atomic increment (max_uses=0 무제한 or 미만 시)
          await DB.prepare(`
            UPDATE promo_codes SET used_count = used_count + 1
            WHERE id = ? AND (max_uses = 0 OR used_count < max_uses)
          `).bind(appliedPromoId).run()
        } catch (e) { if (import.meta.env?.DEV) console.warn('[promo redemption record]', e) }
      }
    }

    // ✅ BUG #26 FIX: Stock was already decremented atomically above — only
    // bump the group-buy counter here to avoid double-subtracting.
    // ✅ CONCURRENCY: atomic increment + target/achievement transition done in
    //    a single UPDATE so two concurrent joiners cannot both read the same
    //    group_buy_current and skip the achieved transition.
    await DB.prepare(`
      UPDATE products
         SET group_buy_current = group_buy_current + ?,
             group_buy_status = CASE
               WHEN group_buy_target > 0 AND (group_buy_current + ?) >= group_buy_target THEN 'achieved'
               ELSE group_buy_status
             END,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `).bind(qty, qty, productId).run()

    const updated = await DB.prepare('SELECT group_buy_current, group_buy_target, group_buy_status, milestone_notified_50, milestone_notified_80, milestone_notified_lastone FROM products WHERE id = ?')
      .bind(productId).first<Pick<GroupBuyProductRow, 'group_buy_current' | 'group_buy_target' | 'group_buy_status' | 'milestone_notified_50' | 'milestone_notified_80' | 'milestone_notified_lastone'>>()

    // 🛡️ 2026-05-15: 마일스톤 알림 (50%, 80%, 1명 남음) — atomic CAS dedup
    //   진행 중 공구의 전환율을 높이기 위한 hot notification. push 만 (이메일 X — 너무 잦음).
    try {
      const tgt = Number(updated?.group_buy_target ?? 0)
      const cur = Number(updated?.group_buy_current ?? 0)
      if (tgt > 0 && updated?.group_buy_status === 'active') {
        const pct = (cur / tgt) * 100
        const remaining = tgt - cur

        const milestones: Array<{ flag: 'lastone' | '80' | '50'; condition: boolean; title: string; body: string }> = []
        if (remaining === 1 && !updated.milestone_notified_lastone) {
          milestones.push({ flag: 'lastone', condition: true, title: '🔥 1명만 더 모이면 공구 성공!', body: `${product.name} — 마지막 한 자리, 지금 참여하세요` })
        } else if (pct >= 80 && !updated.milestone_notified_80) {
          milestones.push({ flag: '80', condition: true, title: '🎯 공구 80% 달성!', body: `${product.name} — ${remaining}자리 남았어요` })
        } else if (pct >= 50 && !updated.milestone_notified_50) {
          milestones.push({ flag: '50', condition: true, title: '✨ 공구 절반 달성!', body: `${product.name} — ${remaining}자리 더 모이면 성공` })
        }

        for (const m of milestones) {
          // CAS: flag 컬럼이 0 일 때만 1로 set (멱등)
          const colName = `milestone_notified_${m.flag}`
          const cas = await DB.prepare(`UPDATE products SET ${colName} = 1 WHERE id = ? AND ${colName} = 0`).bind(productId).run().catch(() => ({ meta: { changes: 0 } }))
          if ((cas.meta?.changes ?? 0) === 0) continue

          // 관심 유저 알림 (interest_list 등록자) — 참여자 본인은 제외
          try {
            // 🛡️ 2026-05-15: 마일스톤 알림 대상 = interest_list (찜) + seller_follows (단골 notify_group_buy=1)
            //   본인 참여자 + 셀러는 제외 (이미 받음 / 본인 매장)
            const { results: interested } = await DB.prepare(
              `SELECT DISTINCT user_id FROM (
                SELECT user_id FROM interest_list WHERE product_id = ? AND user_id IS NOT NULL AND user_id != ?
                UNION
                SELECT user_id FROM seller_follows WHERE seller_id = ? AND notify_group_buy = 1 AND user_id != ?
              )`
            ).bind(productId, userId, product.seller_id, userId)
              .all<{ user_id: string }>()
              .catch(() => ({ results: [] as { user_id: string }[] }))
            const { sendSystemPush } = await import('../../../lib/system-push')
            for (const u of interested ?? []) {
              try {
                await sendSystemPush(c.env, 'user', u.user_id, {
                  title: m.title, body: m.body,
                  url: `/group-buy/${productId}`, tag: `gb-milestone-${productId}-${m.flag}`,
                })
              } catch { /* ignore */ }
            }
          } catch { /* table may not exist */ }
        }
      }
    } catch (e) { console.error('[group-buy milestone notify]', e) }

    // 🛡️ 공구 성공 시 모든 참여자에게 푸시 + dashboard notification (best-effort)
    //   updated.group_buy_status === 'achieved' 이며, 직전 UPDATE 가 처음으로 트랜지션 시켰을 때만 발송하도록
    //   product.group_buy_status (사전 상태) 와 비교하여 중복 발송 방지.
    try {
      if (updated?.group_buy_status === 'achieved' && product.group_buy_status !== 'achieved') {
        const { results: participants } = await DB.prepare(
          `SELECT DISTINCT o.user_id FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           WHERE oi.product_id = ? AND o.user_id IS NOT NULL`
        ).bind(productId).all<{ user_id: string }>()
        const { sendSystemPush } = await import('../../../lib/system-push')
        for (const p of participants ?? []) {
          try {
            await DB.prepare(
              `INSERT INTO user_notifications (user_id, type, title, message, link)
               VALUES (?, 'group_buy_achieved', ?, ?, ?)`
            ).bind(p.user_id, '🎉 공구 성공!', `${product.name} 곧 ${getVoucherShortLabel(product.category)}이 발급됩니다`, `/group-buy/${productId}`).run()
          } catch { /* ignore */ }
          try {
            await sendSystemPush(c.env, 'user', p.user_id, {
              title: '🎉 공구 성공!',
              body: `${product.name} 곧 ${getVoucherShortLabel(product.category)}이 발급됩니다`,
              url: `/group-buy/${productId}`,
              tag: `gb-achieved-${productId}`,
            })
          } catch { /* ignore */ }
        }
      }
    } catch (e) { console.error('[group-buy achieved notify]', e) }

    // 바우처 코드 조회
    const vouchers = await DB.prepare(
      'SELECT code, expires_at FROM vouchers WHERE order_id = ? AND user_id = ?'
    ).bind(newOrderId, userId).all<{ code: string; expires_at: string }>()

    // 🛡️ 2026-05-15: Referral 추적 — affiliate_ref 헤더로 추천인 식별 시
    //   양쪽 0.5% 보너스 딜 (네트워크 효과 vs 마진 보호 균형).
    //   ✨ first-time-only: 같은 (ref, joiner) 조합은 1회만 보상 — point_transactions 에서 dedup.
    //   본인 self-refer 차단.
    try {
      const refRaw = c.req.header('X-Affiliate-Ref') || ''
      const refUserId = refRaw && /^\d+$/.test(refRaw) ? refRaw : null
      if (refUserId && refUserId !== String(userId)) {
        const refExists = await DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(refUserId).first().catch(() => null)
        if (refExists) {
          // first-time check — 같은 추천 조합 이미 보상 받았는지 확인
          const alreadyRewarded = await DB.prepare(
            `SELECT 1 FROM point_transactions
             WHERE type = 'referral_bonus'
               AND user_id = ?
               AND description LIKE '%' || ? || '%'
             LIMIT 1`
          ).bind(userId, `from:${refUserId}`).first().catch(() => null)

          if (!alreadyRewarded) {
            // 🛡️ 2026-05-22 정책 중앙화 — COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT
            const { COMMISSION_DEFAULTS } = await import('../../../shared/constants/policy')
            const bonus = Math.round(totalAmount * COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT / 100)
            if (bonus > 0) {
              // 🛡️ 2026-05-22: swallow() — 추천 보너스 실패 시 description 으로 추적 가능 (silent 금지).
              await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?").bind(bonus, refUserId).run().catch(swallow('group-buy:referral-bonus:referrer-balance'))
              await DB.prepare(
                `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id)
                 VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
              ).bind(refUserId, bonus, bonus, refUserId, `공구 추천 보상 (to:${userId}): ${product.name}`, orderNumber).run().catch(swallow('group-buy:referral-bonus:referrer-tx'))
              await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?").bind(bonus, userId).run().catch(swallow('group-buy:referral-bonus:invitee-balance'))
              await DB.prepare(
                `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id)
                 VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
              ).bind(userId, bonus, bonus, userId, `친구 추천 가입 보상 (from:${refUserId}): ${product.name}`, orderNumber).run().catch(swallow('group-buy:referral-bonus:invitee-tx'))
            }
          }
        }
      }
    } catch (e) { if (import.meta.env?.DEV) console.warn('[group-buy referral]', e) }

    // 🛡️ 2026-05-15: 이메일 영수증 — voucher 코드 첨부, best-effort (실패해도 join 성공).
    //   유저 email 조회 → Resend 발송 → 실패 시 silent (push 알림이 백업).
    try {
      const userRow = await DB.prepare("SELECT email, display_name FROM users WHERE id = ?")
        .bind(userId).first<{ email: string | null; display_name: string | null }>().catch(() => null)
      const userEmail = userRow?.email
      if (userEmail && (c.env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY) {
        // 🛡️ 2026-05-15: sendSystemEmail 사용 — 실패 시 email_failures 큐 자동 적재 → cron 재시도
        const { sendSystemEmail } = await import('../../../lib/system-email')
        const voucherList = (vouchers.results ?? []).map(v => `
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:monospace;font-size:13px;color:#ec4899;font-weight:700;">${v.code}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${v.expires_at ? new Date(v.expires_at).toLocaleDateString('ko-KR') + ' 까지' : '-'}</td>
          </tr>`).join('')
        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;">
            <div style="text-align:center;padding:20px 0;border-bottom:1px solid #e5e7eb;">
              <h1 style="margin:0;font-size:22px;color:#111827;">🎫 공동구매 참여 영수증</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">유어딜 (live.ur-team.com)</p>
            </div>
            <div style="padding:20px 0;">
              <p style="margin:0 0 12px;font-size:15px;color:#111827;">${userRow?.display_name || '고객'}님, 공동구매 참여를 확인했어요!</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
                <tr><td style="padding:6px 0;color:#6b7280;width:120px;">주문번호</td><td style="padding:6px 0;font-family:monospace;color:#111827;">${orderNumber}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">상품명</td><td style="padding:6px 0;color:#111827;">${product.name}</td></tr>
                ${product.restaurant_name ? `<tr><td style="padding:6px 0;color:#6b7280;">매장</td><td style="padding:6px 0;color:#111827;">${product.restaurant_name}</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6b7280;">수량</td><td style="padding:6px 0;color:#111827;">${qty}장</td></tr>
                ${appliedDiscountPct > 0 ? `<tr><td style="padding:6px 0;color:#6b7280;">🎉 티어 할인</td><td style="padding:6px 0;color:#ec4899;font-weight:700;">-${appliedDiscountPct}% 적용</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6b7280;">결제 금액</td><td style="padding:6px 0;color:#111827;font-weight:700;">${totalAmount.toLocaleString('ko-KR')}딜</td></tr>
              </table>
              <h3 style="margin:20px 0 8px;font-size:15px;color:#111827;">발급된 바우처 코드</h3>
              <table style="width:100%;border-collapse:collapse;">
                <thead><tr><th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;text-align:left;color:#6b7280;">코드</th><th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;text-align:left;color:#6b7280;">만료일</th></tr></thead>
                <tbody>${voucherList}</tbody>
              </table>
              <div style="margin:24px 0;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                <p style="margin:0;font-size:13px;color:#991b1b;">💡 매장 방문 시 위 코드를 보여주세요. QR 코드는 <a href="https://live.ur-team.com/my-vouchers" style="color:#ec4899;text-decoration:none;font-weight:700;">내 바우처</a> 페이지에서 확인 가능합니다.</p>
              </div>
              <p style="margin:16px 0 0;text-align:center;">
                <a href="https://live.ur-team.com/my-vouchers" style="display:inline-block;padding:12px 24px;background:#ec4899;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">내 바우처 보기</a>
              </p>
            </div>
            <div style="padding:16px 0;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af;">
              <p style="margin:0;">© 2026 리스터코퍼레이션. 문의: jiwon@ur-team.com</p>
            </div>
          </div>`
        await sendSystemEmail(c.env, userEmail, {
          subject: `[유어딜] 공구 참여 완료 — ${product.name} (${qty}장)`,
          html,
        }).catch((e) => { if (import.meta.env?.DEV) console.warn('[group-buy email]', e) })
      }
    } catch (e) { if (import.meta.env?.DEV) console.warn('[group-buy email outer]', e) }

    return c.json({
      success: true,
      data: {
        order_number: orderNumber,
        amount: totalAmount,
        unit_price: unitPrice,
        applied_discount_pct: appliedDiscountPct,
        tier_discount_pct: tierDiscountPct,
        promo_discount_pct: promoDiscountPct,
        promo_code: appliedPromoId ? promoCodeNormalized : null,
        commission: commissionAmount,
        seller_amount: sellerAmount,
        commission_rate: commissionRate,
        vouchers: vouchers.results ?? [],
        group_buy_current: (updated?.group_buy_current ?? 0),
        group_buy_target: updated?.group_buy_target ?? 0,
        // 🛡️ A2 단일가 모델: 동적 next_tier 없음 (최대 tier 즉시 적용). 항상 null.
        next_tier: null,
      },
      message: appliedDiscountPct > 0
        ? `공동구매 참여 완료! 티어 할인 ${appliedDiscountPct}% 적용 + 바우처 ${qty}장 발급`
        : `공동구매 참여 완료! 바우처 ${qty}장이 발급되었습니다.`,
    })
    } catch (innerErr) {
      // 🛡️ 2026-05-13 (운영 안정성 #2): 딜 차감 후 후속 INSERT 실패 시 자동 환불 + stock 복구
      console.error('[group-buy/join] post-deduction failure, rolling back', innerErr)
      await rollbackDealAndStock()
      throw innerErr  // 외부 catch 가 사용자에게 안내
    }
  } catch (err) {
    console.error('[group-buy] Error:', err)
    return c.json({ success: false, error: '공동구매 참여 중 오류가 발생했습니다. 차감된 딜은 자동 환불되었습니다.' }, 500)
  }
})

// 🛡️ 2026-05-15 (TD-G01 분리):
//   - /my, /verify/:code        → group-buy-public.routes.ts
//   - /refund/:productId        → group-buy-seller.routes.ts (registerSellerEndpoints)

// 🛡️ 2026-05-15 (TD-G01 3단계):
//   /:code/use, /commission-rate, /store-stats/:productId, /voucher/:code/partial-refund
//   → group-buy-voucher.routes.ts (registerVoucherEndpoints) + group-buy-public.routes.ts

// 🛡️ 2026-05-15 (TD-G01 2단계): seller-voucher-stats / voucher-logs 는 group-buy-seller.routes.ts 로 분리.

// 🛡️ 2026-05-15 (TD-G01 3단계):
//   /store-stats/:productId  → group-buy-voucher.routes.ts (registerVoucherEndpoints)
//   generateStoreOwnerToken / sendStoreOwnerAlimtalk → ./helpers.ts

// 🛡️ 2026-05-15 (TD-G01): 어드민 endpoints 는 sub-router 로 분리 (group-buy-admin.routes.ts).
//   - GET  /admin/analytics
//   - GET  /admin/list
//   - POST /admin/force-refund/:productId
// → main 파일 끝에서 groupBuyRoutes.route('/admin', groupBuyAdminRoutes) 마운트

// ──────────────────────────────────────────────────────────────────
// 🛡️ 2026-05-15 (TD-G01): sub-router 마운트 + register 패턴 (path 보존)
// ──────────────────────────────────────────────────────────────────
import { groupBuyAdminRoutes } from './group-buy-admin.routes'
import { registerSellerEndpoints } from './group-buy-seller.routes'
import { registerPublicEndpoints } from './group-buy-public.routes'
import { registerVoucherEndpoints } from './group-buy-voucher.routes'

groupBuyRoutes.route('/admin', groupBuyAdminRoutes)        // /admin/list, /admin/analytics, /admin/force-refund
registerSellerEndpoints(groupBuyRoutes)                    // /refund/:productId, /seller-voucher-stats, /voucher-logs
registerPublicEndpoints(groupBuyRoutes)                    // /products, /products/:id, /live-ticker, /participants, /commission-rate, /my, /verify/:code
registerVoucherEndpoints(groupBuyRoutes)                   // /:code/use, /voucher/:code/partial-refund, /store-stats/:productId

// 🛡️ 2026-05-22: 공구 토스 결제 confirm endpoint — Toss SDK success URL 에서 호출.
//   body: { paymentKey, orderId, amount, productId, qty, promoCode?, ref? }
//   처리: confirmTossPayment → /join 의 deal 흐름 후처리 재사용 (voucher 발급 + attribution + ledger).
groupBuyRoutes.post('/confirm-toss', rateLimit({ action: 'group_buy_confirm_toss', max: 10, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const userId = String(user.id)

  const body = await c.req.json<{ paymentKey?: string; orderId?: string; amount?: number; productId?: number; qty?: number; promoCode?: string; ref?: string }>().catch(() => ({} as { paymentKey?: string; orderId?: string; amount?: number; productId?: number; qty?: number; promoCode?: string; ref?: string }))
  const { paymentKey, orderId, amount, productId, qty: rawQty } = body
  if (!paymentKey || !orderId || !amount || !productId) {
    return c.json({ success: false, error: '결제 정보가 올바르지 않습니다' }, 400)
  }
  const qty = Math.max(1, Math.min(100, Math.floor(Number(rawQty ?? 1))))
  if (!Number.isFinite(qty)) return c.json({ success: false, error: '잘못된 수량' }, 400)

  const { DB } = c.env
  // 1. 상품 재검증 (Toss 결제 도중 마감/품절 등 상태 변경 가능).
  const product = await DB.prepare(
    "SELECT id, name, price, group_buy_status, group_buy_deadline, seller_id, voucher_expiry, category, group_buy_tiers, referral_disabled FROM products WHERE id = ? AND is_active = 1"
  ).bind(productId).first<{ id: number; name: string; price: number; group_buy_status: string; group_buy_deadline: string | null; seller_id: number; voucher_expiry: string | null; category: string; group_buy_tiers: string | null; referral_disabled: number | null }>()
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

  // 🛡️ 2026-05-31: 카드 결제 referral 추출 (딜 /join 과 동일 검증) — 인플 attribution 용.
  const refRaw = body.ref ? String(body.ref).trim() : ''
  let referralInfluencerId = refRaw && /^[a-zA-Z0-9_\-:]{1,64}$/.test(refRaw) ? refRaw : ''
  if (referralInfluencerId && referralInfluencerId === userId) referralInfluencerId = ''
  if (referralInfluencerId) {
    const exists = await DB.prepare(
      "SELECT 1 FROM sellers WHERE id = ? UNION ALL SELECT 1 FROM users WHERE id = ? LIMIT 1"
    ).bind(referralInfluencerId, referralInfluencerId).first().catch(() => null)
    if (!exists) referralInfluencerId = ''
  }
  // amount 재검증 (defense-in-depth — 클라 amount 신뢰 X).
  // 🛡️ 2026-05-31: 즉시판매 단일가(A2) — 카드도 최대 tier 할인 적용 (딜 경로와 일치). toss-init 와 동일 계산.
  const tierDiscountPct = maxTierDiscount(product.group_buy_tiers)
  const unitPrice = Math.round(product.price * (1 - tierDiscountPct / 100))
  const expectedAmount = unitPrice * qty
  if (Number(amount) !== expectedAmount) {
    return c.json({ success: false, error: '결제 금액이 일치하지 않습니다', code: 'AMOUNT_MISMATCH' }, 400)
  }

  // 2. Toss confirm — gateway helper 사용.
  const { confirmTossPayment } = await import('../../../worker/utils/toss-gateway')
  const tossResult = await confirmTossPayment({
    env: c.env as { TOSS_SECRET_KEY?: string },
    paymentKey,
    orderId,
    amount: expectedAmount,
  })
  if (!tossResult.ok) {
    return c.json({ success: false, error: tossResult.message, code: tossResult.code },
      tossResult.status === 'CIRCUIT_OPEN' ? 503 : 400)
  }

  // 3. 멱등성 가드 (C3, 2026-05-30): 같은 paymentKey 로 이미 발급된 주문이 있으면 재발급 금지.
  //    confirmTossPayment 는 paymentKey 기준 멱등이라 success URL 새로고침/재시도 시 ok 재반환 →
  //    가드 없으면 voucher 2배 발급 + group_buy_current 2배 증가. 딜 경로(idempotency_key)와 동일 보호.
  const existingOrder = await DB.prepare(
    "SELECT id, order_number FROM orders WHERE payment_key = ? LIMIT 1"
  ).bind(paymentKey).first<{ id: number; order_number: string }>().catch(() => null)
  if (existingOrder) {
    const issued = await DB.prepare("SELECT COUNT(*) AS n FROM vouchers WHERE order_id = ?")
      .bind(existingOrder.id).first<{ n: number }>().catch(() => null)
    return c.json({
      success: true,
      data: { order_number: existingOrder.order_number, qty: issued?.n ?? qty, amount: expectedAmount, idempotent: true },
    })
  }

  // 4. orders INSERT + voucher 발급 — 딜 경로(group-buy /join)의 검증된 패턴 복제.
  //    C1: RETURNING id 로 정수 order_id 획득 후 vouchers.order_id 에 바인드 (이전: order_number 문자열
  //        저장 → refund JOIN(v.order_id=o.id) 전부 실패 → 카드 환불 영구 불가).
  //    C2: applied_price + expires_at 저장 (이전: 누락 → 무한 만료 안 됨 + 정산 fallback 불일치).
  //    C3 (2026-05-31): 딜 경로와 동일하게 order_items + ledger + donations(정산기록) 기록 →
  //          ledger 정합성 검증 + commission 집계에 카드 결제건도 잡힘.
  //          (인플루언서 attribution 은 카드 경로 referral edge-case — 후속 부채로 잔존.)
  const orderNumber = `GB-${userId}-${Date.now()}`
  const expiresAt = product.voucher_expiry || new Date(Date.now() + 90 * 86400000).toISOString()
  try {
    const orderInsert = await DB.prepare(`
      INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method, payment_key)
      VALUES (?, ?, ?, ?, 0, 0, ?, 'KRW', 'PAID', 'toss', ?)
      RETURNING id
    `).bind(orderNumber, userId, product.seller_id, expectedAmount, expectedAmount, paymentKey).first<{ id: number }>()
    const newOrderId = orderInsert?.id ?? null
    if (!newOrderId) throw new Error('order insert returned no id')

    // voucher 발급 (qty) — order_id=정수(C1) + applied_price/expires_at(C2). batch = atomic (부분발급 차단).
    //   order_items 도 같은 batch (딜 경로와 정합 — 주문 상세 표시 + 정산 근거).
    const codes = await Promise.all(Array.from({ length: qty }, () => generateUniqueVoucherCode(DB)))
    const orderItemStmt = DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, price, quantity, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(newOrderId, productId, product.name, unitPrice, unitPrice, qty, expectedAmount)
    const voucherStmts = codes.map(code =>
      DB.prepare(`
        INSERT INTO vouchers (order_id, product_id, user_id, code, expires_at, applied_discount_pct, applied_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(newOrderId, productId, userId, code, expiresAt, tierDiscountPct, unitPrice)
    )
    await DB.batch([orderItemStmt, ...voucherStmts])

    // 공구 진행 카운터 +qty (atomic).
    await DB.prepare(`UPDATE products SET group_buy_current = COALESCE(group_buy_current, 0) + ? WHERE id = ?`)
      .bind(qty, productId).run().catch(swallow('group-buy:confirm-toss:counter'))

    // 🛡️ 2026-05-31: 에이전시 입점 매장 commission — 카드 결제도 적립 (딜 경로와 동일). UNIQUE 멱등.
    c.executionCtx?.waitUntil((async () => {
      try {
        const { creditAgencyStoreIntroCommission } = await import('../../../worker/utils/agency-store-intro-commission')
        await creditAgencyStoreIntroCommission(DB, { id: newOrderId, seller_id: Number(product.seller_id), total_amount: expectedAmount })
      } catch (e) { if (import.meta.env?.DEV) console.warn('[confirm-toss agency intro]', e) }
    })())

    // 🛡️ 2026-05-31: 정산 정합 — 딜 경로(group-buy /join)와 동일하게 ledger + donations + 인플 attribution.
    //   셀러 차등 수수료 + 인플 referral 4-account split → ledger(group_buy_join) + donations(정산 row).
    const [commissionRate, rates] = await Promise.all([
      getSellerCommissionRate(DB, Number(product.seller_id)),
      getCommissionRates(DB),
    ])
    const commissionAmount = Math.round(expectedAmount * commissionRate)
    // 카드 결제 인플루언서 referral attribution + 사용자 추천 보너스 (딜 경로와 동일 — 공유 헬퍼).
    const { influencerAmount, userBonusAmount } = await applyGroupBuyReferral(DB, rates, {
      referralInfluencerId,
      sellerId: Number(product.seller_id),
      productId,
      productName: product.name,
      totalAmount: expectedAmount,
      orderNumber,
      userId,
      productReferralDisabled: Number(product.referral_disabled) === 1,
    })
    const sellerAmount = expectedAmount - commissionAmount - influencerAmount - userBonusAmount
    try {
      await recordLedger(DB, {
        event_type: 'group_buy_join',
        reference_id: orderNumber,
        amount: expectedAmount,
        debit_account: `user:${userId}`,
        credit_account: `seller:${product.seller_id}`,
        fee_amount: commissionAmount,
        fee_account: 'platform:commission',
        metadata: { product_id: productId, qty, applied_discount_pct: tierDiscountPct, payment_method: 'toss' },
      })
    } catch (e) { if (import.meta.env?.DEV) console.warn('[confirm-toss ledger]', e) }
    try {
      await DB.prepare(`
        INSERT INTO donations (live_stream_id, seller_id, donor_user_id, donor_name, amount,
          commission_amount, credit_amount, commission_rate, order_id, payment_status, message)
        VALUES (0, ?, ?, '공동구매', ?, ?, ?, ?, ?, 'completed', ?)
      `).bind(
        product.seller_id, userId,
        expectedAmount, commissionAmount, sellerAmount, commissionRate,
        orderNumber, `${getVoucherShortLabel(product.category)} 공동구매(카드): ${product.name}`
      ).run()
    } catch { /* donations 테이블 없으면 무시 */ }

    return c.json({
      success: true,
      data: { order_number: orderNumber, qty, amount: expectedAmount },
    })
  } catch (err) {
    // 결제는 성공했으나 INSERT 실패 — admin 알림 + 사용자에게 친절한 안내.
    console.error('[group-buy:confirm-toss] post-payment INSERT failed', err)
    return c.json({
      success: false,
      error: '결제는 완료됐으나 voucher 발급에 실패했습니다. 고객센터에 문의해주세요.',
      code: 'POST_PAYMENT_FAILURE',
      data: { paymentKey, orderId },
    }, 500)
  }
})

// 외부 import 호환을 위해 helpers 의 generateStoreOwnerToken / sendStoreOwnerAlimtalk re-export
export { generateStoreOwnerToken, sendStoreOwnerAlimtalk } from './helpers'

export { groupBuyRoutes }
