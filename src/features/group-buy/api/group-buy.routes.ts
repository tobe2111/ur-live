/**
 * 공동구매 & 이용권 바우처 API
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
import { formatKSTDate } from '@/utils/date' // 워커 TZ=UTC — 만료일 안내가 하루 이르던 것 교정
import { swallow } from '@/worker/utils/swallow'
import { resolveUserIdString } from '@/worker/utils/resolve-user-id'
import { grantGroupBuyReferralBonus } from './referral-bonus'
import { productDetailColsHealed, withColumnPruning } from '@/shared/db/product-columns'
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
  sendSellerVoucherSoldAlimtalk,
} from './helpers'
// 🛡️ 2026-05-21: 모든 voucher 카테고리에서 동작하려면 이용권 hardcode 제거 — getVoucherShortLabel 사용.
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'
// 🎟️ 2026-08-12 (소비자 공구 결제 결함 3건): 자기참여 판정·주문번호·가상계좌 가드 → gb-purchase-guards.ts
import { isSelfOwnedGroupBuy, resolveGbOrderNumber, guardAwaitingDeposit, issuedVoucherLabel } from './gb-purchase-guards'
import { findActiveDealPct } from '@/worker/utils/influencer-deal'

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
  // 🏁 2026-06-11 (사용자 신고 — 참여하기 버튼 느림): DDL 보장(ALTER ~17 + INDEX ~4)을 응답 경로에서
  //   분리. 컬럼/인덱스는 프로덕션 DB 에 이미 존재(멱등 no-op)인데 isolate 콜드마다 ~21 D1 왕복이
  //   버튼 클릭에 끼어들었음. curator /:handle 과 동일 패턴 — 신규 DB 는 repair-schema/cron 이 수렴.
  let _ddlDeferred = false
  try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(ensureTables(DB).catch(() => {})); _ddlDeferred = true } } catch { /* no ctx */ }
  if (!_ddlDeferred) await ensureTables(DB).catch(() => {})
  const productIdRaw = c.req.param('id')
  const productIdNum = Number(productIdRaw)
  if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const productId = productIdNum
  // 🔑 user_id 정규화(데이터 감사 1단계): 읽기·쓰기가 동일 DB users.id 를 쓰게 해 이중키 분열 차단.
  //   live(카카오 세션)=이미 숫자→무동작 / Firebase 유저만 교정. 실패 시 raw 폴백(결제 무중단).
  const userId = await resolveUserIdString(c.env.DB, user.id, user.isDbId)
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
  // 🛡️ 2026-05-16: ref = 소개 파트너 ID (?ref= 진입 또는 본문). 형식 검증.
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

  // 🎯 2026-07-01 (대표 "결제 최대 한도 갯수 1인 당" — 셀러가 등록 시 설정): product_supply_meta.max_per_person.
  //   미설정=무제한(추가 조회 0). 설정 시: 이번 qty + 유저 기존 미환불 이용권(unused/used) 누적 ≤ 한도.
  //   두 결제 흐름(toss/deal) 공통 사전검증. fail-open — 한도 조회 실패가 구매를 막지 않음(소프트 룰).
  try {
    const { getSupplyMeta } = await import('../../../worker/utils/product-supply-meta')
    const mppMeta = await getSupplyMeta(DB, [Number(productId)]).catch(() => null)
    const mppRaw = mppMeta?.get(Number(productId))?.max_per_person
    const maxPerPerson = mppRaw != null && Number.isFinite(Number(mppRaw)) && Number(mppRaw) > 0 ? Math.floor(Number(mppRaw)) : 0
    if (maxPerPerson > 0) {
      if (qty > maxPerPerson) {
        return c.json({ success: false, error: `1인당 최대 ${maxPerPerson}개까지 구매할 수 있습니다`, code: 'PER_PERSON_LIMIT' }, 400)
      }
      const ownedRow = await DB.prepare(
        "SELECT COUNT(*) AS n FROM vouchers WHERE product_id = ? AND user_id = ? AND status IN ('unused','used')"
      ).bind(productId, userId).first<{ n: number }>().catch(() => ({ n: 0 }))
      const owned = Number(ownedRow?.n ?? 0)
      if (owned + qty > maxPerPerson) {
        return c.json({ success: false, error: `1인당 최대 ${maxPerPerson}개 구매 가능 — 이미 ${owned}개 보유 중입니다`, code: 'PER_PERSON_LIMIT' }, 400)
      }
    }
    // 🗺️ 2026-07-02 (대표 "레벨이 올라가면 그 사람들에게만 보이는 이용권 구매 자격" — 카카오맵 리뷰
    //   게이미피케이션): product_supply_meta.min_review_level. 미설정=전체 공개(추가 조회 0).
    //   설정 시: 유저 동네 리뷰어 레벨(user_review_scores — 카카오맵 후기 승인으로 상승)이 그
    //   이상이어야 구매 가능. fail-open — 레벨 조회 실패가 구매를 막지 않음(소프트 게이트).
    const mrlRaw = mppMeta?.get(Number(productId))?.min_review_level
    const minReviewLevel = mrlRaw != null && Number.isFinite(Number(mrlRaw)) && Number(mrlRaw) > 1 ? Math.floor(Number(mrlRaw)) : 0
    if (minReviewLevel > 0) {
      const { getUserReviewLevelValue } = await import('../../../worker/utils/review-level')
      const myLevel = await getUserReviewLevelValue(DB, String(userId))
      if (myLevel < minReviewLevel) {
        return c.json({ success: false, error: `동네 리뷰어 Lv.${minReviewLevel} 전용 이용권입니다 (현재 Lv.${myLevel}) — 이용권 사용 후 카카오맵 후기 인증으로 레벨을 올릴 수 있어요`, code: 'REVIEW_LEVEL_REQUIRED' }, 403)
      }
    }
  } catch { /* fail-open */ }

  // 🎯 2026-07-04 (FCFS 당첨자 전용 결제 게이트 — fcfs-gate.ts): 추첨 상품은 당첨자만 구매.
  //   딜/토스 두 흐름 공통 사전검증(아래 toss 분기 이전). 비-FCFS 상품은 메타 1조회 후 통과.
  {
    const { checkFcfsPurchasable } = await import('../../../worker/utils/fcfs-gate')
    const fcfsGate = await checkFcfsPurchasable(DB, Number(productId), userId)
    if (!fcfsGate.ok) return c.json({ success: false, error: fcfsGate.error, code: fcfsGate.code }, 403)
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
    if (await isSelfOwnedGroupBuy(DB, product.seller_id, userId)) {
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
      `SELECT ${productDetailColsHealed('products')} FROM products WHERE id = ? AND is_active = 1 AND (category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher') OR deal_only = 1)`
    ).bind(productId).first<GroupBuyProductRow>()

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    // 💰 2026-08-31: **이용권 딜 결제 게이트** (기본 OFF).
    //
    //   위 상품 조회가 `voucher 카테고리 OR deal_only=1` 을 함께 매칭하기 때문에, 이 딜 경로는
    //   **원래부터 이용권도 받고 있었다** — 화면이 안 내놨을 뿐 직접 POST 하면 통했다.
    //   그래서 이 가드는 기능을 여는 스위치인 동시에 **그 열린 문을 닫는다.**
    //
    //   🔴 켜기 전 선행: `influencer_deal_bonus_pct` 를 0 으로. 보너스 20% 가 살아 있으면
    //   이용권 마진(5~10%)보다 보너스가 커서 **팔릴수록 유어딜이 건당 8~14원 적자**다.
    //   교환권(`deal_only=1`)은 소비자 마크업 20% 가 보너스를 상쇄해 괜찮았고, 이용권엔 그 상쇄가 없다.
    //   클라 `VOUCHER_DEAL_PAYMENT_ENABLED` 와 이중 게이트(GB_ENGINE_ENABLED 선례).
    if (product.deal_only !== 1) {
      const gate = await DB.prepare(
        "SELECT value FROM platform_settings WHERE key = 'voucher_deal_payment_enabled'"
      ).first<{ value: string }>().catch(() => null)
      if (gate?.value !== 'true') {
        return c.json({
          success: false,
          error: '이 상품은 카드로 결제해주세요.',
          code: 'DEAL_PAYMENT_NOT_ALLOWED',
        }, 400)
      }
    }

    // 🛡️ 2026-04-22: 셀러가 본인 공구에 자기 참여 차단 (목표 조작 방지)
    //   🔴 2026-08-12: sellers.id ↔ users.id 를 비교하던 네임스페이스 오류 수리 (gb-purchase-guards.ts).
    if (await isSelfOwnedGroupBuy(DB, product.seller_id, userId)) {
      return c.json({ success: false, error: '본인의 공동구매 상품에는 참여할 수 없습니다', code: 'SELF_PARTICIPATION_BLOCKED' }, 403)
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

    // 🛡️ 2026-07-11 (pre-launch audit R6 — 공구 /join 재고누수): 위 차감 '이후'의 조기 return
    //   (promo 검증 실패 / KT phone 미등록 / 딜 잔액 부족)이 복원 없이 빠지면 재고가 영구 누수
    //   (조기품절 — promo 오류 연타만으로 재고 소진 가능). 차감 이후 모든 조기 return 앞에서 호출.
    const restoreReservedStock = async () => {
      try {
        await DB.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(qty, productId).run()
      } catch (e) { console.error('[group-buy/join] early-return stock restore failed', e) }
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
      // 🛡️ 2026-07-11 R6: 아래 promo 검증 실패 return 은 전부 stock 차감 이후 — 복원 필수.
      if (!promo || !promo.is_active) {
        await restoreReservedStock()
        return c.json({ success: false, error: '코드 없음 또는 비활성', code: 'PROMO_INVALID' }, 400)
      }
      if (Number(promo.seller_id) !== Number(product.seller_id)) {
        await restoreReservedStock()
        return c.json({ success: false, error: '이 셀러의 코드가 아닙니다', code: 'PROMO_WRONG_SELLER' }, 400)
      }
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        await restoreReservedStock()
        return c.json({ success: false, error: '만료된 코드', code: 'PROMO_EXPIRED' }, 400)
      }
      if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
        await restoreReservedStock()
        return c.json({ success: false, error: '사용 한도 도달', code: 'PROMO_LIMIT' }, 400)
      }
      // audience 검증
      if (promo.audience === 'followers_only') {
        const isFollower = await DB.prepare(
          `SELECT 1 FROM seller_follows WHERE seller_id = ? AND user_id = ?`
        ).bind(promo.seller_id, userId).first().catch(() => null)
        if (!isFollower) {
          await restoreReservedStock()
          return c.json({ success: false, error: '단골 전용 코드 — 단골 등록 후 다시 시도', code: 'PROMO_FOLLOWERS_ONLY' }, 400)
        }
      } else if (promo.audience === 'new_users_only') {
        const hasOrder = await DB.prepare(
          `SELECT 1 FROM orders WHERE user_id = ? AND seller_id = ? AND status = 'PAID' LIMIT 1`
        ).bind(userId, promo.seller_id).first().catch(() => null)
        if (hasOrder) {
          await restoreReservedStock()
          return c.json({ success: false, error: '신규 고객 전용 코드', code: 'PROMO_NEW_ONLY' }, 400)
        }
      }
      // per-user-limit
      const userUses = await DB.prepare(
        `SELECT COUNT(*) AS cnt FROM promo_redemptions WHERE promo_id = ? AND user_id = ?`
      ).bind(promo.id, userId).first<{ cnt: number }>().catch(() => ({ cnt: 0 } as { cnt: number }))
      if ((userUses?.cnt ?? 0) >= promo.per_user_limit) {
        await restoreReservedStock()
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

    // 💸 2026-07-05 버킷: 이번 차감에서 무상으로 소진된 금액 (rollback 대칭 복원용)
    //   ensureDealBuckets 는 결제수단 무관 1회 — 아래 추천 보너스(무상 적립) 경로도 컬럼 필요.
    let freeUsedJoin = 0
    const { ensureDealBuckets } = await import('../../../worker/utils/point-buckets')
    await ensureDealBuckets(DB)

    // 🛡️ 2026-05-13 (운영 안정성 #2): 딜 차감 후 후속 INSERT (orders/items/vouchers/progress)
    //   실패 시 자동 환불. D1 은 trx 미지원 — 명시적 rollback 으로 처리.
    //   복구 대상: deal 차감 + stock 차감 (이미 위에서 atomic 처리됨 → 여기서 함께 복구).
    // 🛡️ 2026-07-11 R6: 정의를 딜 결제 블록 '앞'으로 hoist — 아래 원장 INSERT throw 경로도 커버.
    //   (호출은 여전히 딜 차감 '성공 이후' 경로에서만 — 미차감 상태에서 환급되는 일 없음)
    const rollbackDealAndStock = async () => {
      if (payment_method === 'deal') {
        try {
          // 💸 버킷 대칭: 방금 무상에서 차감된 만큼 무상으로 복원.
          await DB.prepare("UPDATE user_points SET balance = balance + ?, free_balance = COALESCE(free_balance, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
            .bind(totalAmount, freeUsedJoin, userId).run()
          await DB.prepare(
            `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id, free_delta)
             VALUES (?, 'refund', ?, 0, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?, ?)`
          ).bind(userId, totalAmount, totalAmount, userId, `공동구매 자동 환불 (주문 실패): ${product.name}`, orderNumber, freeUsedJoin).run()
        } catch (e) { console.error('[group-buy/join] deal rollback failed', e) }
      }
      // stock 도 복구 (R6: 조기 return 복원 헬퍼 재사용 — 동일 SQL)
      await restoreReservedStock()
    }

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
          // 🛡️ 2026-07-11 R6: stock 차감 이후 조기 return — 복원 (딜은 아직 미차감).
          await restoreReservedStock()
          return c.json({
            success: false,
            error: 'KT Alpha 기프티쇼 발송을 위해 전화번호 등록이 필요합니다',
            code: 'PHONE_REQUIRED',
          }, 400)
        }
      }

      // 🏁 2026-06-11 perf: 잔액 사전 SELECT 제거 — 차감 UPDATE 의 `balance >= ?` 가드가 단일 진실
      //   (원자성/가드 의미 동일, 행복경로 D1 1왕복 절약). 실패 시에만 잔액 조회해 메시지 구성.
      // 💸 2026-07-05 버킷: 무상 우선 차감 + free 사전 조회(원장 free_delta 기록용 — 잔액 정합은 원자 UPDATE 가 보장).
      const freeRowJoin = await DB.prepare('SELECT COALESCE(free_balance, 0) AS fb FROM user_points WHERE user_id = ?')
        .bind(userId).first<{ fb: number }>().catch(() => null)
      const deductResult = await DB.prepare('UPDATE user_points SET balance = balance - ?, free_balance = MAX(0, COALESCE(free_balance, 0) - ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND balance >= ?')
        .bind(totalAmount, totalAmount, userId, totalAmount).run()
      if (!deductResult.meta.changes) {
        const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
          .bind(userId).first<{ balance: number }>().catch(() => null)
        // 🛡️ 2026-07-11 R6: 딜 미차감(changes==0) — stock 만 복원 후 return.
        await restoreReservedStock()
        return c.json({ success: false, error: `딜이 부족합니다 (보유: ${wallet?.balance ?? 0}딜)`, code: 'INSUFFICIENT_POINTS' }, 400)
      }
      freeUsedJoin = Math.min(Math.max(0, Number(freeRowJoin?.fb ?? 0)), totalAmount)

      // 🛡️ 2026-07-11 R6: 이 원장 INSERT 는 아래 inner try '밖' — throw 시 deal+stock 이 복원
      //   없이 외부 catch 로 빠져 누수되던 갭. 실패 시 대칭 복원 후 rethrow(외부 catch 가 500 안내).
      try {
        await DB.prepare(
          `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id, free_delta)
           VALUES (?, 'donate', ?, 0, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?, ?)`
        ).bind(userId, totalAmount, totalAmount, userId, `공동구매: ${product.name}`, orderNumber, -freeUsedJoin).run()
      } catch (txnErr) {
        await rollbackDealAndStock()
        throw txnErr
      }
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
        // 🔒 2026-08-26: 조건을 `findActiveDealPct` SSOT 로 — 이용권 상세의 "내 링크로 팔리면 N%"
        //   배너가 **같은 함수**를 쓴다. 여기와 배너가 갈리면 화면은 "받는다"인데 정산은 0 이 된다.
        const dealPct = await findActiveDealPct(DB, Number(product.seller_id), referralInfluencerId)
        effectiveInfluencerPct = calcInfluencerCommissionPct(rates, {
          is_referred_by_this_influencer: isReferredByThis,
          referral_bonus_active: referralBonusActive,
          deal_commission_pct: dealPct,
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

    // 🧹 2026-06-18: orders.commission_rate/amount/seller_amount 를 실제 계산값으로 채움(컬럼 청소 —
    //   미설정 시 DB 기본값 10%/0 stale 잔존). 공구 정산은 이 컬럼을 안 읽음(표시 정합용, 돈 무관).
    //   commission_rate 컬럼은 퍼센트 단위(기본 10.0)라 fraction×100 저장. best-effort(실패해도 결제 불막음).
    if (newOrderId) {
      await DB.prepare('UPDATE orders SET commission_rate = ?, commission_amount = ?, seller_amount = ? WHERE id = ?')
        .bind(Math.round(commissionRate * 10000) / 100, commissionAmount, sellerAmount, newOrderId)
        .run().catch(swallow('group-buy:join:commission-cols'))
    }

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

    // 🛑 2026-08-31: 에이전시 매장영입 1% 폐지(대표 "1%짜리는 아예 없애줘") — 이 자리에 있던
    //   `creditOrderCommissions(..., { only: ['agency_intro'] })` 를 제거했다. 대행사는 채널
    //   요율(대행 5%)의 차액으로 보상받으므로 별도 % 를 얹지 않는다. 폐지 시점 실적립 0행.
    if (newOrderId) {
      c.executionCtx?.waitUntil((async () => {
        // 🎯 2026-07-04 FCFS: 당첨자 결제 완료 마킹(selected→paid, 멱등) — 예비 승계 판단 근거.
        try {
          const { markFcfsPaid } = await import('../../../worker/utils/fcfs-gate')
          await markFcfsPaid(DB, Number(productId), userId)
        } catch { /* fail-soft */ }
      })())
    }

    // 🛡️ 2026-05-16: 인플루언서 attribution + 사용자 referral 보너스 (4-account 확장)
    if (hasInfluencer) {
      // 사용자 보너스 즉시 적립 (active 든 차단이든 사용자에겐 약속한 보너스 지급)
      if (userBonusAmount > 0) {
        try {
          // 💸 2026-07-05 버킷: 추천 보너스 = 무상 딜 (free_balance 동시 증가 — 출금 제외·우선 차감)
          await DB.prepare(
            "UPDATE user_points SET balance = balance + ?, free_balance = COALESCE(free_balance, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
          ).bind(userBonusAmount, userBonusAmount, userId).run()
          await DB.prepare(
            `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id, free_delta)
             VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?, ?)`
          ).bind(userId, userBonusAmount, userBonusAmount, userId, `친구 추천 보너스 (${product.name})`, orderNumber, userBonusAmount).run()
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
          ).bind(referralInfluencerId, newOrderId ?? 0, productId, product.seller_id, influencerAmount, availableAt).run()
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
      const expiresAt = product.voucher_expiry || null // 2026-08-22 대표: 미설정 = 무기한(90일 강제 기본값 폐지)
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
          // 🛡️ 2026-06-10 (발급 감사 GAP#2): 사용자는 '발급 완료' 알림을 받았는데 기프티쇼 MMS 가
          //   안 간 상태 — 어드민이 로그를 뒤지기 전에 벨로 즉시 인지 → 발송추적에서 수동 재발송.
          try {
            const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
            await createDashboardNotification(DB, 'admin', null, 'kt_alpha_send_failed',
              '🎁 KT 기프티쇼 발송 실패 — 재발송 필요',
              `주문 #${newOrderId} / 사용자 ${userId} / ${msg.slice(0, 120)}`,
              '/admin/voucher-orders')
          } catch { /* best-effort */ }
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

    // 🏁 2026-06-11 (참여하기 느림 수술): 사장님 첫 바우처 안내(inline ALTER+SELECT+UPDATE+알림톡) — 응답 후 실행(waitUntil).
    //   블록 내용/순서/에러처리 불변 — 실행 시점만 이동. ctx 없으면(테스트) 기존처럼 동기 실행.
    {
      const _bg = async () => {
      // 🛡️ 2026-05-16: 매장 사장님에게 첫 voucher 안내 알림톡 (sellers.first_voucher_notified=0 일 때만)
      try {
        try { await DB.prepare("ALTER TABLE sellers ADD COLUMN first_voucher_notified INTEGER DEFAULT 0").run() } catch {}
        const seller = await DB.prepare(
          "SELECT phone, business_name, COALESCE(first_voucher_notified, 0) AS notified, store_owner_token FROM sellers WHERE id = ?"
        ).bind(product.seller_id).first<{ phone: string | null; business_name: string; notified: number; store_owner_token: string | null }>()
        if (seller && Number(seller.notified) === 0 && seller.phone) {
          const token = seller.store_owner_token || ''
          const statsUrl = `https://urdeal.kr/store/stats/${productId}${token ? `?t=${token}` : ''}`
          c.executionCtx.waitUntil(
            sendSellerFirstVoucherAlimtalk(
              c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
              seller.phone,
              { restaurantName: seller.business_name, productName: product.name, statsUrl },
            )
          )
          await DB.prepare("UPDATE sellers SET first_voucher_notified = 1 WHERE id = ?").bind(product.seller_id).run()
        } else if (seller?.phone) {
          // 📣 2026-07-05 (운영 감사 Q4): 2번째 판매부터 건별 판매 알림톡 — 기존엔 첫 1회 뒤로는
          //   대시보드 벨뿐이라 대시보드를 안 보는 사장님이 판매를 몰랐음. 같은 블록에서 분기해
          //   첫 판매(온보딩 상세)와 이중발송 불가(레이스 0).
          await sendSellerVoucherSoldAlimtalk(
            c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
            seller.phone,
            { restaurantName: seller.business_name, productName: product.name, qty, amount: Number(totalAmount) || 0 },
          )
        }
      } catch { /* graceful */ }
      }
      let _deferred = false
      try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_bg()); _deferred = true } } catch { /* no ctx */ }
      if (!_deferred) await _bg()
    }

      // 🏁 2026-06-12 (전 플로우 감사): 셀러 '판매 발생' 벨 알림(기존엔 첫 1회 알림톡뿐) +
      //   초대 1,000딜 첫구매 보상(호출자 0 이던 약속 미이행 마감). 응답 후 실행 — 머니 경로 무변경.
      {
        const _saleFx = async () => {
          try {
            const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
            if (product.seller_id) {
              await createDashboardNotification(
                DB, 'seller', String(product.seller_id), 'voucher_sold',
                '🎟️ 이용권 판매', `${product.name} ×${qty} — ₩${Number(totalAmount).toLocaleString('ko-KR')}`,
                '/seller/group-buy',
              ).catch(() => {})
            }
          } catch { /* fail-soft */ }
          try {
            const { grantInviteRewardForFirstPurchase } = await import('../../../worker/utils/invite-reward')
            await grantInviteRewardForFirstPurchase(DB, String(userId))
          } catch { /* fail-soft */ }
          // 🏙️ 2026-07-05 상권 방문 리워드: 캠페인 상권 매장 상품 첫 구매 → 무상 딜 (멱등·캡·fail-soft).
          try {
            const { grantVisitRewardOnPurchase } = await import('../../../worker/utils/visit-reward')
            await grantVisitRewardOnPurchase(DB, { userId: String(userId), productId: Number(productId), orderRef: orderNumber })
          } catch { /* fail-soft */ }
          // 📡 2026-07-05 유입 소스 첫 구매 스냅샷 (랜딩→가입→첫구매 퍼널 완결, 멱등·fail-soft).
          try {
            const { markAcquisitionFirstPurchase } = await import('../../../worker/utils/acquisition')
            await markAcquisitionFirstPurchase(DB, String(userId), orderNumber)
          } catch { /* fail-soft */ }
        }
        let _saleDeferred = false
        try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_saleFx()); _saleDeferred = true } } catch { /* no ctx */ }
        if (!_saleDeferred) await _saleFx()
      }

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

    // 🛡️ 2026-06-16 (치명 버그 fix — 교환권 발급 500 + 자동환불): milestone_notified_* 컬럼이 prod D1 에
    //   없으면(스키마 드리프트 — repair-schema/production-schema 누락) 이 SELECT 가 throw → 딜 차감 후
    //   rollback(자동환불) → "참여 중 오류" 500. 모든 딜 결제 교환권 발급이 차단됨.
    //   핵심 컬럼만으로 fallback (마일스톤 푸시 알림만 skip — 비핵심) → 발급은 정상 진행. repair-schema 에 컬럼 보강도 함께.
    const updated = await DB.prepare('SELECT group_buy_current, group_buy_target, group_buy_status, milestone_notified_50, milestone_notified_80, milestone_notified_lastone FROM products WHERE id = ?')
      .bind(productId).first<Pick<GroupBuyProductRow, 'group_buy_current' | 'group_buy_target' | 'group_buy_status' | 'milestone_notified_50' | 'milestone_notified_80' | 'milestone_notified_lastone'>>()
      .catch(() => DB.prepare('SELECT group_buy_current, group_buy_target, group_buy_status FROM products WHERE id = ?')
        .bind(productId).first<Pick<GroupBuyProductRow, 'group_buy_current' | 'group_buy_target' | 'group_buy_status' | 'milestone_notified_50' | 'milestone_notified_80' | 'milestone_notified_lastone'>>()
        .catch(() => null))

    // 🏁 2026-06-11 (참여하기 느림 수술): 마일스톤 푸시(관심유저 N명 순차 외부호출) — 응답 후 실행(waitUntil).
    //   블록 내용/순서/에러처리 불변 — 실행 시점만 이동. ctx 없으면(테스트) 기존처럼 동기 실행.
    {
      const _bg = async () => {
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
      }
      let _deferred = false
      try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_bg()); _deferred = true } } catch { /* no ctx */ }
      if (!_deferred) await _bg()
    }

    // 🏁 2026-06-11 (참여하기 느림 수술): 공구 성공 참여자 전원 알림(INSERT+푸시 ×M명) — 응답 후 실행(waitUntil).
    //   블록 내용/순서/에러처리 불변 — 실행 시점만 이동. ctx 없으면(테스트) 기존처럼 동기 실행.
    {
      const _bg = async () => {
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
      }
      let _deferred = false
      try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_bg()); _deferred = true } } catch { /* no ctx */ }
      if (!_deferred) await _bg()
    }

    // 바우처 코드 조회
    const vouchers = await DB.prepare(
      'SELECT code, expires_at FROM vouchers WHERE order_id = ? AND user_id = ?'
    ).bind(newOrderId, userId).all<{ code: string; expires_at: string }>()

    // 💸 추천 보너스(양쪽 0.5%) — 잔액·원장·중복방지가 한 세트라 모듈로 분리(2026-08-02).
    //   원장 행이 곧 중복 방지 키다 — 상세는 referral-bonus.ts 상단 참조.
    await grantGroupBuyReferralBonus({
      DB,
      refRaw: c.req.header('X-Affiliate-Ref') || '',
      userId,
      totalAmount,
      productName: product.name,
      orderNumber,
    })

    // 🏁 2026-06-11 (참여하기 느림 수술): 이메일 영수증(Resend 외부 HTTP) — 응답 후 실행(waitUntil).
    //   블록 내용/순서/에러처리 불변 — 실행 시점만 이동. ctx 없으면(테스트) 기존처럼 동기 실행.
    {
      const _bg = async () => {
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
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:monospace;font-size:13px;color:#6b7280;font-weight:700;">${v.code}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${v.expires_at ? formatKSTDate(v.expires_at) + ' 까지' : '-'}</td>
          </tr>`).join('')
        // 🔔 2026-07-01: 셀러/유저 제어 문자열(상품명·매장명·닉네임) 이메일 HTML 이스케이프(인젝션 방지).
        const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;">
            <div style="text-align:center;padding:20px 0;border-bottom:1px solid #e5e7eb;">
              <h1 style="margin:0;font-size:22px;color:#111827;">🎫 공동구매 참여 영수증</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">유어딜 (urdeal.kr)</p>
            </div>
            <div style="padding:20px 0;">
              <p style="margin:0 0 12px;font-size:15px;color:#111827;">${esc(userRow?.display_name || '고객')}님, 공동구매 참여를 확인했어요!</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
                <tr><td style="padding:6px 0;color:#6b7280;width:120px;">주문번호</td><td style="padding:6px 0;font-family:monospace;color:#111827;">${orderNumber}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">상품명</td><td style="padding:6px 0;color:#111827;">${esc(product.name)}</td></tr>
                ${product.restaurant_name ? `<tr><td style="padding:6px 0;color:#6b7280;">매장</td><td style="padding:6px 0;color:#111827;">${esc(product.restaurant_name)}</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6b7280;">수량</td><td style="padding:6px 0;color:#111827;">${qty}장</td></tr>
                ${appliedDiscountPct > 0 ? `<tr><td style="padding:6px 0;color:#6b7280;">🎉 티어 할인</td><td style="padding:6px 0;color:#6b7280;font-weight:700;">-${appliedDiscountPct}% 적용</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6b7280;">결제 금액</td><td style="padding:6px 0;color:#111827;font-weight:700;">${totalAmount.toLocaleString('ko-KR')}딜</td></tr>
              </table>
              <h3 style="margin:20px 0 8px;font-size:15px;color:#111827;">발급된 바우처 코드</h3>
              <table style="width:100%;border-collapse:collapse;">
                <thead><tr><th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;text-align:left;color:#6b7280;">코드</th><th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;text-align:left;color:#6b7280;">만료일</th></tr></thead>
                <tbody>${voucherList}</tbody>
              </table>
              <div style="margin:24px 0;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                <p style="margin:0;font-size:13px;color:#991b1b;">💡 매장 방문 시 위 코드를 보여주세요. QR 코드는 <a href="https://urdeal.kr/my-vouchers" style="color:#6b7280;text-decoration:none;font-weight:700;">내 바우처</a> 페이지에서 확인 가능합니다.</p>
              </div>
              <p style="margin:16px 0 0;text-align:center;">
                <a href="https://urdeal.kr/my-vouchers" style="display:inline-block;padding:12px 24px;background:#6b7280;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">내 바우처 보기</a>
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
      }
      let _deferred = false
      try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_bg()); _deferred = true } } catch { /* no ctx */ }
      if (!_deferred) await _bg()
    }

    return c.json({
      success: true,
      data: {
        order_number: orderNumber,
        order_id: newOrderId, // 🧭 2026-06-10: 클라 affiliate /track 용 (additive)
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
  // 🔑 user_id 정규화(데이터 감사 1단계) — /join 과 동일(이중키 분열 차단, 카카오=무동작, Firebase 교정).
  const userId = await resolveUserIdString(c.env.DB, user.id, user.isDbId)

  const body = await c.req.json<{ paymentKey?: string; orderId?: string; amount?: number; productId?: number; qty?: number; promoCode?: string; ref?: string }>().catch(() => ({} as { paymentKey?: string; orderId?: string; amount?: number; productId?: number; qty?: number; promoCode?: string; ref?: string }))
  const { paymentKey, orderId, amount, productId, qty: rawQty } = body
  if (!paymentKey || !orderId || !amount || !productId) {
    return c.json({ success: false, error: '결제 정보가 올바르지 않습니다' }, 400)
  }
  const qty = Math.max(1, Math.min(100, Math.floor(Number(rawQty ?? 1))))
  if (!Number.isFinite(qty)) return c.json({ success: false, error: '잘못된 수량' }, 400)

  const { DB } = c.env
  // 1. 상품 재검증 (Toss 결제 도중 마감/품절 등 상태 변경 가능).
  // 🧱 2026-06-26 서비스 분리: confirm-toss 재검증도 /join(category 격리)과 대칭으로 도매 원본 제외.
  const product = await DB.prepare(
    "SELECT id, name, price, group_buy_status, group_buy_deadline, seller_id, voucher_expiry, category, group_buy_tiers, referral_disabled, deal_only FROM products WHERE id = ? AND is_active = 1 AND NOT (COALESCE(is_supply_product, 0) = 1 AND COALESCE(supply_source_id, 0) = 0)"
  ).bind(productId).first<{ id: number; name: string; price: number; group_buy_status: string; group_buy_deadline: string | null; seller_id: number; voucher_expiry: string | null; category: string; group_buy_tiers: string | null; referral_disabled: number | null; deal_only: number | null }>()
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
  // 🎯 2026-07-01 (한도 race 차단): /join 사전검증 후 결제창 사이에 다른 탭 구매로 한도를 채우는
  //   우회 가능 → **과금 전**(confirmTossPayment 이전) 재검증. 초과면 400 — 승인 안 된 결제는
  //   Toss 측에서 자동 만료(환불 불필요, AMOUNT_MISMATCH 와 동일 패턴). fail-open(조회 실패 무시).
  try {
    const { getSupplyMeta } = await import('../../../worker/utils/product-supply-meta')
    const mppMeta = await getSupplyMeta(DB, [Number(productId)]).catch(() => null)
    const mppRaw = mppMeta?.get(Number(productId))?.max_per_person
    const maxPerPerson = mppRaw != null && Number.isFinite(Number(mppRaw)) && Number(mppRaw) > 0 ? Math.floor(Number(mppRaw)) : 0
    if (maxPerPerson > 0) {
      const ownedRow = await DB.prepare(
        "SELECT COUNT(*) AS n FROM vouchers WHERE product_id = ? AND user_id = ? AND status IN ('unused','used')"
      ).bind(productId, userId).first<{ n: number }>().catch(() => ({ n: 0 }))
      if (Number(ownedRow?.n ?? 0) + qty > maxPerPerson) {
        return c.json({ success: false, error: `1인당 최대 ${maxPerPerson}개까지 구매할 수 있습니다`, code: 'PER_PERSON_LIMIT' }, 400)
      }
    }
    // 🗺️ 2026-07-02 (레벨 게이트 race 차단): /join 사전검증과 대칭 — **과금 전** 재검증.
    //   초과면 403 — 승인 안 된 결제는 Toss 측 자동 만료(환불 불필요, PER_PERSON_LIMIT 동일 패턴).
    const mrlRaw = mppMeta?.get(Number(productId))?.min_review_level
    const minReviewLevel = mrlRaw != null && Number.isFinite(Number(mrlRaw)) && Number(mrlRaw) > 1 ? Math.floor(Number(mrlRaw)) : 0
    if (minReviewLevel > 0) {
      const { getUserReviewLevelValue } = await import('../../../worker/utils/review-level')
      const myLevel = await getUserReviewLevelValue(DB, String(userId))
      if (myLevel < minReviewLevel) {
        return c.json({ success: false, error: `동네 리뷰어 Lv.${minReviewLevel} 전용 이용권입니다 (현재 Lv.${myLevel})`, code: 'REVIEW_LEVEL_REQUIRED' }, 403)
      }
    }
  } catch { /* fail-open */ }

  // 🎯 2026-07-04 (FCFS 게이트 — 과금 직전 재검증): /join 사전검증과 결제창 사이 우회 방지.
  //   승인 전 400 이므로 Toss 측 자동 만료(환불 불필요) — 한도 재검증과 동일 패턴.
  {
    const { checkFcfsPurchasable } = await import('../../../worker/utils/fcfs-gate')
    const fcfsGate = await checkFcfsPurchasable(DB, Number(productId), userId)
    if (!fcfsGate.ok) return c.json({ success: false, error: fcfsGate.error, code: fcfsGate.code }, 403)
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
  // 🏦 2026-08-12: 주문번호 = **토스가 아는 값**(웹훅이 이 값으로 주문을 찾는다). 이 아래 전부 이 값을 쓴다.
  const orderNumber = resolveGbOrderNumber(tossResult.data?.orderId, orderId, userId)
  // 🏦 가상계좌(WAITING_FOR_DEPOSIT)는 **입금 전** — 발급 금지 + 자동 취소. 카드/간편결제는 이 분기 무접촉.
  const vaBlock = await guardAwaitingDeposit(c.env, tossResult.data,
    { paymentKey, orderNumber, userId, productId: Number(productId), sellerId: Number(product.seller_id) || null, amount: expectedAmount })
  if (vaBlock) return c.json({ success: false, error: vaBlock.error, code: vaBlock.code }, 400)

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

  // 🛡️ 2026-05-31 M1: 카드 경로 재고 원자적 예약 (딜 /join 과 정합 — oversell 차단).
  //   딜 경로(line 218)는 stock 차감하는데 카드 경로는 안 해 동시결제 시 재고 초과 발급 가능했음.
  //   결제는 이미 완료(confirmTossPayment) 상태라 재고 부족 시 cancelTossPayment 자동 환불.
  const reserveStock = await DB.prepare(
    'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?'
  ).bind(qty, productId, qty).run().catch(() => null)
  if (!reserveStock?.meta?.changes) {
    try {
      const { cancelTossPayment } = await import('../../../worker/utils/toss-gateway')
      await cancelTossPayment({ env: c.env as unknown as { TOSS_SECRET_KEY?: string }, paymentKey, cancelReason: '재고 부족 자동 환불', idempotencyKey: `gb-card-oversold-${paymentKey}` })
    } catch (e) { if (import.meta.env?.DEV) console.warn('[confirm-toss oversold refund]', e) }
    return c.json({ success: false, error: '재고가 부족하여 결제가 자동 취소되었습니다', code: 'OUT_OF_STOCK' }, 409)
  }

  // 4. orders INSERT + voucher 발급 — 딜 경로(group-buy /join)의 검증된 패턴 복제.
  //    C1: RETURNING id 로 정수 order_id 획득 후 vouchers.order_id 에 바인드 (이전: order_number 문자열
  //        저장 → refund JOIN(v.order_id=o.id) 전부 실패 → 카드 환불 영구 불가).
  //    C2: applied_price + expires_at 저장 (이전: 누락 → 무한 만료 안 됨 + 정산 fallback 불일치).
  //    C3 (2026-05-31): 딜 경로와 동일하게 order_items + ledger + donations(정산기록) 기록 →
  //          ledger 정합성 검증 + commission 집계에 카드 결제건도 잡힘.
  //          (인플루언서 attribution 도 아래 applyGroupBuyReferral 공유 헬퍼로 딜 경로와 동일 처리됨
  //           — 2026-05-31 구현 완료. influencer_attributions INSERT + influencer_balances 적립.)
  //   🔴 2026-08-12: orderNumber 는 위에서 **토스 orderId** 로 확정됐다(웹훅 연결). 여기서 새로 만들지 않는다.
  const expiresAt = product.voucher_expiry || null // 2026-08-22 대표: 미설정 = 무기한(90일 강제 기본값 폐지)
  try {
    const orderInsert = await DB.prepare(`
      INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method, payment_key, idempotency_key)
      VALUES (?, ?, ?, ?, 0, 0, ?, 'KRW', 'PAID', 'toss', ?, ?)
      RETURNING id
    `).bind(orderNumber, userId, product.seller_id, expectedAmount, expectedAmount, paymentKey, paymentKey).first<{ id: number }>()
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

    // 🏁 2026-06-12 (전 플로우 감사): 카드 경로도 셀러 벨 + 초대 1,000딜 — 딜 경로와 동형 (응답 후).
    {
      const _saleFx = async () => {
        try {
          const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
          if (product.seller_id) {
            await createDashboardNotification(
              DB, 'seller', String(product.seller_id), 'voucher_sold',
              '🎟️ 이용권 판매(카드)', `${product.name} ×${qty} — ₩${Number(expectedAmount).toLocaleString('ko-KR')}`,
              '/seller/group-buy',
            ).catch(() => {})
          }
        } catch { /* fail-soft */ }
        try {
          const { grantInviteRewardForFirstPurchase } = await import('../../../worker/utils/invite-reward')
          await grantInviteRewardForFirstPurchase(DB, String(userId))
        } catch { /* fail-soft */ }
        // 🏙️ 2026-07-05 상권 방문 리워드: 카드 확정 경로도 딜 /join 과 대칭 배선 (멱등이라 중복 지급 0).
        try {
          const { grantVisitRewardOnPurchase } = await import('../../../worker/utils/visit-reward')
          await grantVisitRewardOnPurchase(DB, { userId: String(userId), productId: Number(productId), orderRef: orderNumber })
        } catch { /* fail-soft */ }
        // 📡 2026-07-05 유입 소스 첫 구매 스냅샷 (멱등·fail-soft).
        try {
          const { markAcquisitionFirstPurchase } = await import('../../../worker/utils/acquisition')
          await markAcquisitionFirstPurchase(DB, String(userId), orderNumber)
        } catch { /* fail-soft */ }
        // 🔔 2026-06-26 (소비자 감사 C): 카드 결제 buyer 무통보(딜 /join 은 알림톡 발송) 비대칭 보강.
        //   ① 발급 인앱 기록 ② 알림톡. 🏷️ 2026-08-12: '교환권' 고정 문구라 카드로 산 이용권에도 그게 떴다(셀러 알림은 '이용권') → issuedVoucherLabel.
        try {
          await DB.prepare(
            `INSERT INTO user_notifications (user_id, type, title, message, link)
             VALUES (?, 'voucher_issued', ?, ?, ?)`
          ).bind(String(userId), `🎟️ ${issuedVoucherLabel(product)}이 발급됐어요`, `${product.name} ×${qty} — 보관함에서 확인하세요`, '/my-vouchers').run().catch(() => {})
        } catch { /* ignore */ }
        try {
          const userRow = await DB.prepare("SELECT phone FROM users WHERE id = ?").bind(userId).first<{ phone: string | null }>()
          if (userRow?.phone) {
            await sendBuyerVoucherIssuedAlimtalk(
              c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
              userRow.phone,
              { productName: product.name, restaurantName: (product as { restaurant_name?: string }).restaurant_name, qty, expiresAt, categoryLabel: getVoucherShortLabel(product.category) },
            )
          }
        } catch { /* graceful */ }
      }
      let _saleDeferred = false
      try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_saleFx()); _saleDeferred = true } } catch { /* no ctx */ }
      if (!_saleDeferred) await _saleFx()
    }

    // 🛑 2026-08-31: 에이전시 매장영입 1% 폐지 — 딜 경로와 동일하게 적립 호출을 제거했다(위 주석 참조).
    c.executionCtx?.waitUntil((async () => {
      // 🎯 2026-07-04 FCFS: 당첨자 결제 완료 마킹(selected→paid, 멱등).
      try {
        const { markFcfsPaid } = await import('../../../worker/utils/fcfs-gate')
        await markFcfsPaid(DB, Number(productId), userId)
      } catch { /* fail-soft */ }
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
      orderId: newOrderId,
      userId,
      productReferralDisabled: Number(product.referral_disabled) === 1,
    })
    const sellerAmount = expectedAmount - commissionAmount - influencerAmount - userBonusAmount
    // 🧹 2026-06-18: orders.commission_rate/amount/seller_amount 실제값 채움(컬럼 청소 — stale 10%/0 방지).
    //   퍼센트 단위라 fraction×100. 정산 미사용(표시 정합용). best-effort.
    if (newOrderId) {
      await DB.prepare('UPDATE orders SET commission_rate = ?, commission_amount = ?, seller_amount = ? WHERE id = ?')
        .bind(Math.round(commissionRate * 10000) / 100, commissionAmount, sellerAmount, newOrderId)
        .run().catch(swallow('group-buy:confirm-toss:commission-cols'))
    }
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
      data: { order_number: orderNumber, order_id: newOrderId, qty, amount: expectedAmount },
    })
  } catch (err) {
    // 🛡️ 2026-05-31 M1: 주문 미생성 → 예약했던 재고 롤백(예약은 try 진입 전 차감됨).
    //   UNIQUE 충돌(race 패자)도 롤백 — 승자 주문이 canonical 이라 패자 차감분은 되돌려야 정합.
    await DB.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(qty, productId).run().catch(() => null)
    // 🛡️ 2026-05-31: 동시 confirm-toss 경쟁(race) — idempotency_key(=paymentKey) UNIQUE 인덱스(0118)
    //   충돌이면 이미 다른 요청이 발급 완료한 것 → 그 주문 재조회 후 멱등 성공 반환(voucher 2배 발급 차단).
    if (String(err).includes('UNIQUE')) {
      const existing = await DB.prepare(
        "SELECT id, order_number FROM orders WHERE payment_key = ? LIMIT 1"
      ).bind(paymentKey).first<{ id: number; order_number: string }>().catch(() => null)
      if (existing) {
        const issued = await DB.prepare("SELECT COUNT(*) AS n FROM vouchers WHERE order_id = ?")
          .bind(existing.id).first<{ n: number }>().catch(() => null)
        return c.json({
          success: true,
          data: { order_number: existing.order_number, qty: issued?.n ?? qty, amount: expectedAmount, idempotent: true },
        })
      }
    }
    // 결제는 성공했으나 INSERT 실패 — 🛡️ 2026-06-10 (발급 감사 GAP#1): 수동 개입 대기 대신
    //   자동 환불 시도(SSOT cancelTossPayment, 멱등키). 성공=미회수 0 / 실패=어드민 긴급 벨.
    console.error('[group-buy:confirm-toss] post-payment INSERT failed', err)
    let autoRefunded = false
    try {
      const { cancelTossPayment } = await import('../../../worker/utils/toss-gateway')
      await cancelTossPayment({ env: c.env as unknown as { TOSS_SECRET_KEY?: string }, paymentKey, cancelReason: '바우처 발급 실패 자동 환불', idempotencyKey: `gb-card-issue-fail-${paymentKey}` })
      autoRefunded = true
    } catch (cancelErr) {
      console.error('[group-buy:confirm-toss] 자동 환불도 실패 — 수동 개입 필요', cancelErr)
      try {
        const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
        await createDashboardNotification(c.env.DB, 'admin', null, 'payment_orphan',
          '🚨 결제됨+발급실패+자동환불실패 — 수동 환불 필요',
          `paymentKey=${paymentKey} / 상품 ${productId} / 금액 ${expectedAmount}`,
          '/admin/orders')
      } catch { /* best-effort */ }
    }
    return c.json({
      success: false,
      error: autoRefunded
        ? '일시적인 오류로 발급에 실패해 결제를 자동 취소했습니다. 잠시 후 다시 시도해주세요.'
        : '결제는 완료됐으나 발급에 실패했습니다. 환불 처리를 위해 고객센터로 문의해주세요.',
      code: autoRefunded ? 'ISSUE_FAILED_REFUNDED' : 'POST_PAYMENT_FAILURE',
      data: { paymentKey, orderId },
    }, 500)
  }
})

// 외부 import 호환을 위해 helpers 의 generateStoreOwnerToken / sendStoreOwnerAlimtalk re-export
export { generateStoreOwnerToken, sendStoreOwnerAlimtalk } from './helpers'

export { groupBuyRoutes }
