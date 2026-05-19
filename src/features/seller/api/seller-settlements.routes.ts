/**
 * 🛡️ 2026-04-28 TD-006 (split): Seller Settlements + Dashboard Stats (7 endpoints)
 *
 * 원본: seller-management.routes.ts (476-664).
 *
 * - GET  /settlements                — 정산 신청 목록
 * - POST /settlements/request        — 정산 신청
 * - GET  /settlements/stats          — 정산 통계
 * - GET  /settlements/summary        — 정산 요약
 * - GET  /dashboard/stats            — 대시보드 통계
 * - GET  /settlements/:id/download   — 정산서 다운로드
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import { getSellerIdFromToken, type SellerJWTPayload } from '@/lib/seller-shared'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { swallow } from '@/worker/utils/swallow'

type Bindings = { DB: D1Database; JWT_SECRET: string }
interface SettlementStatsRow {
  total_settled: number
  pending_amount: number
  total_requests: number
}
interface SettlementRow {
  id: number
  seller_id: number
  amount: number
  status: string
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  created_at: string
}

export const sellerSettlementsRoutes = new Hono<{ Bindings: Bindings }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.
sellerSettlementsRoutes.get('/settlements', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const limit = Math.max(1, Math.min(200, parseInt(c.req.query('limit') || '20') || 20));
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0') || 0);
    const rows = await db.prepare(
      `SELECT id, seller_id, amount, bank_name, account_number, account_holder,
              status, admin_memo, created_at, updated_at
       FROM settlements WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(sellerId, limit, offset).all().catch(() => ({ results: [] }));
    const count = await db.prepare('SELECT COUNT(*) as total FROM settlements WHERE seller_id = ?')
      .bind(sellerId).first<{ total: number }>().catch(() => ({ total: 0 }));
    return c.json({ success: true, data: rows.results, total: count?.total ?? 0 });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

sellerSettlementsRoutes.post('/settlements/request', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);

    // 🛡️ 민감 액션 — 최근 15분 내 PIN 인증 필수
    const { isPinVerified } = await import('./seller-pin.routes');
    const pinOk = await isPinVerified(c.req.header('Cookie'), sellerId, c.env.JWT_SECRET);
    if (!pinOk) {
      return c.json({
        success: false,
        error: 'PIN 인증이 필요합니다',
        code: 'PIN_REQUIRED',
      }, 412);
    }

    // 🛡️ 2026-05-18: 사업자 등록 게이트 — 현금 정산은 verified 셀러만.
    //   비검증 셀러는 별도 'voucher' / 'deal' 메서드 사용 (구현은 phase 2).
    //   defensive: business_registration_status 컬럼 없을 시 (migration 0257 미적용) 게이트 OFF.
    const bizRow = await db.prepare(
      'SELECT business_registration_status FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ business_registration_status: string | null }>().catch(() => null);
    if (bizRow && bizRow.business_registration_status && bizRow.business_registration_status !== 'verified' && bizRow.business_registration_status !== 'exempt') {
      return c.json({
        success: false,
        error: '사업자등록증 검증이 필요합니다',
        code: 'BUSINESS_REGISTRATION_REQUIRED',
        status: bizRow.business_registration_status,
        hint: '사업자등록증을 등록하시면 현금 정산이 가능합니다. 또는 상품권/포인트로 수령할 수 있습니다.',
      }, 412);
    }

    const { amount, bank_name, account_number, account_holder } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ success: false, error: '정산 금액이 올바르지 않습니다' }, 400);
    // 🛡️ 2026-05-18: NOT NULL period_start/period_end — 신청 시점의 전월 1일 ~ 말일 (관행).
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodStart = prevMonth.toISOString().slice(0, 10);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    const result = await db.prepare(`
      INSERT INTO settlements (seller_id, amount, period_start, period_end, bank_name, account_number, account_holder, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).bind(sellerId, amount, periodStart, periodEnd, bank_name || null, account_number || null, account_holder || null).run()
      .catch(() => null);
    if (!result) return c.json({ success: false, error: '정산 신청 실패 (settlements 테이블 없음)' }, 500);
    // 1. 정산 신청 → 어드민 알림
    createDashboardNotification(db, 'admin', null, 'settlement_request', '정산 신청', `셀러 #${sellerId}`, '/admin/settlement').catch(swallow('seller:api:seller-management'));
    return c.json({ success: true, message: '정산 신청이 완료되었습니다', id: result.meta.last_row_id });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 🛡️ 2026-05-18: 정산 방식 옵션 조회 — UI 에서 사업자 검증 상태에 따라 선택 가능 옵션 분기.
sellerSettlementsRoutes.get('/settlement-options', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);

    // 셀러 사업자 상태 + 정산 잔액 조회.
    const seller = await db.prepare(
      `SELECT id, business_registration_status, business_registration_image_url,
              business_registration_reject_reason, preferred_settlement_method, business_number
         FROM sellers WHERE id = ?`
    ).bind(sellerId).first<{
      id: number;
      business_registration_status: string | null;
      business_registration_image_url: string | null;
      business_registration_reject_reason: string | null;
      preferred_settlement_method: string | null;
      business_number: string | null;
    }>().catch(() => null);

    const bizStatus = seller?.business_registration_status || 'pending';
    const canReceiveCash = bizStatus === 'verified' || bizStatus === 'exempt';

    // 정산 잔액 — settlements 테이블에서 status='approved' 합산.
    const balanceRow = await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as available_amount
         FROM settlements WHERE seller_id = ? AND status = 'approved'`
    ).bind(sellerId).first<{ available_amount: number }>().catch(() => ({ available_amount: 0 }));

    return c.json({
      success: true,
      data: {
        business_registration: {
          status: bizStatus,
          image_url: seller?.business_registration_image_url || null,
          reject_reason: seller?.business_registration_reject_reason || null,
          business_number: seller?.business_number || null,
        },
        preferred_method: seller?.preferred_settlement_method || 'auto',
        available_amount: balanceRow?.available_amount || 0,
        methods: {
          cash: {
            available: canReceiveCash,
            label: '현금 (계좌 입금)',
            description: canReceiveCash
              ? '사업자등록 완료 — 신청 후 영업일 D+7 입금'
              : '사업자등록 검증 후 가능합니다',
            withholding_rate: 0,
          },
          voucher: {
            available: true,
            label: '모바일 상품권 (기프티쇼)',
            description: '즉시 발송 · 사업자 미등록 시 8.8% 원천징수 후 발송',
            withholding_rate: canReceiveCash ? 0 : 8.8,
            note: '추후 KT Alpha 통합 후 활성화',
          },
          deal: {
            available: true,
            label: '딜 포인트 (플랫폼 내 사용)',
            description: canReceiveCash
              ? '플랫폼 내 사용 + 환급 가능 (8.8% 원천징수)'
              : '플랫폼 내 사용만 가능 (현금화 불가)',
            withholding_rate: canReceiveCash ? 8.8 : 0,
            redeemable: canReceiveCash,
          },
        },
      },
    });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 🛡️ 2026-05-18: 딜 잔액 조회 — gated (환급 불가) vs redeemable (환급 가능) 분리.
sellerSettlementsRoutes.get('/deal-balance', async (c) => {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한 필요' }, 403);

    const row = await c.env.DB.prepare(
      'SELECT gated_deal_amount, redeemable_deal_amount FROM seller_deal_balances WHERE seller_id = ?'
    ).bind(sellerId).first<{ gated_deal_amount: number; redeemable_deal_amount: number }>().catch(() => null);

    // 사업자 등록 검증 상태도 같이.
    const seller = await c.env.DB.prepare(
      'SELECT business_registration_status FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ business_registration_status: string | null }>().catch(() => null);
    const bizVerified = seller?.business_registration_status === 'verified' || seller?.business_registration_status === 'exempt';

    return c.json({
      success: true,
      data: {
        gated_deal_amount: row?.gated_deal_amount || 0,
        redeemable_deal_amount: row?.redeemable_deal_amount || 0,
        total: (row?.gated_deal_amount || 0) + (row?.redeemable_deal_amount || 0),
        business_verified: bizVerified,
        withdrawable: bizVerified ? (row?.redeemable_deal_amount || 0) : 0,
        notice: bizVerified
          ? '환급 시 8.8% 원천징수 후 계좌 입금'
          : '사업자등록 미검증 — 환급 불가 (플랫폼 내 사용만 가능)',
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 🛡️ 2026-05-19: 비사업자 셀러용 — 적립금을 기프티쇼 상품권으로 받기.
//   사업자 등록 X 인 셀러가 적립금 (gated_deal_amount) 을 voucher 로 교환.
//   markup_pct (어드민 설정) 적용 — 우리 마진 확보.
//
//   흐름:
//     1. 셀러가 voucher 선택 (gift_code + qty + 수신 phone) → POST /voucher-redeem
//     2. 우리 시스템: voucher_orders INSERT (status='pending')
//     3. KT Alpha sendCoupon 0204 호출
//     4. 성공 → voucher_orders status='sent' + 셀러 적립금 차감
//     5. 실패 → status='failed' + 셀러 알림
sellerSettlementsRoutes.get('/voucher-catalog', async (c) => {
  // 셀러 측 — voucher 선택용 카탈로그 (active 만).
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const token = authorization.substring(7)
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload
    const sellerId = payload.seller_id
    if (!sellerId) return c.json({ success: false, error: '셀러 권한 필요' }, 403)

    const q = c.req.query('q') || ''
    const limit = Math.min(60, Number(c.req.query('limit')) || 30)
    let sql = `SELECT gift_code, name, brand_name, brand_icon_url,
                      sale_price, real_price, discount_rate,
                      image_url_small, image_url_large,
                      valid_period_type, valid_period_days,
                      goods_type_detail
                 FROM gift_catalog
                WHERE is_active = 1 AND goods_state = 'SALE'`
    const params: unknown[] = []
    if (q) { sql += ' AND (name LIKE ? OR search_keywords LIKE ? OR brand_name LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
    sql += ' ORDER BY popular ASC, sale_price ASC LIMIT ?'
    params.push(limit)
    const rows = await c.env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>().catch(() => ({ results: [] }))

    // markup_pct + 셀러 본인 휴대폰 (모달 pre-fill 용) 같이 전달.
    const settings = await c.env.DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'kt_alpha_markup_pct'"
    ).first<{ value: string }>().catch(() => null)
    const markupPct = Number(settings?.value) || 5

    const seller = await c.env.DB.prepare(
      'SELECT phone FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ phone: string | null }>()
    const sellerPhone = String(seller?.phone || '').replace(/\D/g, '')

    return c.json({
      success: true,
      data: {
        items: rows.results || [],
        markup_pct: markupPct,
        seller_phone: sellerPhone,
        // KT Alpha 가이드라인 — UI 에 표시할 핵심 약관 (frontend hardcode 방지).
        terms: {
          validity_days: 30,
          refund_allowed: false,
          b2b_only: true,
          source: 'KT Alpha (기프티쇼) B2B API',
        },
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-19: 상품권 발송 요청 (비사업자 셀러용 voucher redeem).
sellerSettlementsRoutes.post('/voucher-redeem', async (c) => {
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const token = authorization.substring(7)
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload
    const sellerId = payload.seller_id
    if (!sellerId) return c.json({ success: false, error: '셀러 권한 필요' }, 403)

    type Body = {
      gift_code?: string; qty?: number; phone?: string; mms_title?: string; mms_msg?: string;
      // 🛡️ 2026-05-19: KT Alpha 비즈 API 가이드라인 — B2B 정산 동의 명시 강제.
      terms_accepted_expiry?: boolean   // 30일 유효기간 / 환불 불가 동의
      terms_accepted_b2b?: boolean      // 본인 명의 휴대폰 / B2B 정산 동의
    }
    const body = await c.req.json<Body>().catch(() => ({} as Body))
    const giftCode = String(body?.gift_code || '').trim()
    const qty = Math.max(1, Math.min(10, Number(body?.qty) || 1))
    const phone = String(body?.phone || '').trim().replace(/\D/g, '')
    if (!giftCode) return c.json({ success: false, error: 'gift_code 필요' }, 400)
    if (!/^01\d{8,9}$/.test(phone)) return c.json({ success: false, error: '올바른 수신 휴대폰 번호 필요' }, 400)

    // 🛡️ KT Alpha 가이드라인: 발송 전 두 가지 동의 강제 (감사 추적 가능).
    if (!body?.terms_accepted_expiry || !body?.terms_accepted_b2b) {
      return c.json({
        success: false,
        error: '발송 전 약관 동의 필요 (30일 유효기간 + B2B 본인 발송)',
        code: 'TERMS_NOT_ACCEPTED',
      }, 400)
    }

    // 1. 상품 조회 + 가격 계산.
    const gift = await c.env.DB.prepare(
      `SELECT gift_code, name, real_price, sale_price, image_url_small, is_active, goods_state
         FROM gift_catalog WHERE gift_code = ?`
    ).bind(giftCode).first<{
      gift_code: string; name: string; real_price: number; sale_price: number;
      image_url_small: string | null; is_active: number; goods_state: string;
    }>()
    if (!gift) return c.json({ success: false, error: '상품 없음 (catalog sync 후 시도)' }, 404)
    if (!gift.is_active || gift.goods_state !== 'SALE') {
      return c.json({ success: false, error: '판매 중지된 상품' }, 400)
    }

    // 2. markup_pct 가져오기 + 최종 차감액 계산.
    const settings = await c.env.DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key IN ('kt_alpha_markup_pct', 'kt_alpha_user_id', 'kt_alpha_callback_no')"
    ).all<{ key: string; value: string }>().catch(() => ({ results: [] }))
    const settingsMap: Record<string, string> = {}
    for (const r of (settings.results || [])) settingsMap[r.key] = r.value

    const markupPct = Number(settingsMap.kt_alpha_markup_pct) || 5
    const ktUserId = settingsMap.kt_alpha_user_id
    const callbackNo = settingsMap.kt_alpha_callback_no
    if (!ktUserId || !callbackNo) {
      return c.json({ success: false, error: 'KT Alpha 운영자 설정 미완료 — 어드민 문의' }, 503)
    }

    // 셀러 차감액 = real_price (KT Alpha 공급가) × (1 + markup_pct/100) × qty.
    const unitDeduct = Math.floor(gift.real_price * (1 + markupPct / 100))
    const totalDeduct = unitDeduct * qty

    // 3. 셀러 잔액 확인 — 사업자 검증 상태에 따라 gated 또는 redeemable.
    //    🛡️ 추가: 본인 명의 휴대폰 검증 (KT Alpha 가이드라인 — 타인 발송 차단).
    const seller = await c.env.DB.prepare(
      'SELECT business_registration_status, phone FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ business_registration_status: string | null; phone: string | null }>()
    const verified = seller?.business_registration_status === 'verified' || seller?.business_registration_status === 'exempt'

    // 본인 명의 휴대폰 검증 — 회원가입 시 등록한 phone 과 발송 대상 phone 일치 필수.
    //   - 자릿수만 비교 (하이픈 등 무시).
    //   - sellers.phone 미등록 시 → 셀러 설정에서 먼저 등록하라고 안내.
    const sellerPhone = String(seller?.phone || '').replace(/\D/g, '')
    if (!sellerPhone) {
      return c.json({
        success: false,
        error: '셀러 본인 휴대폰 미등록 — 셀러 설정에서 본인 인증 휴대폰 먼저 등록 필요',
        code: 'SELLER_PHONE_NOT_SET',
      }, 412)
    }
    if (sellerPhone !== phone) {
      return c.json({
        success: false,
        error: '본인 명의 휴대폰으로만 발송 가능 (KT Alpha B2B 정산 정책)',
        code: 'PHONE_MISMATCH',
        seller_phone_masked: sellerPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1-****-$2'),
      }, 403)
    }
    const balCol = verified ? 'redeemable_deal_amount' : 'gated_deal_amount'

    const bal = await c.env.DB.prepare(
      `SELECT ${balCol} as amount FROM seller_deal_balances WHERE seller_id = ?`
    ).bind(sellerId).first<{ amount: number }>().catch(() => null)
    const available = bal?.amount || 0
    if (totalDeduct > available) {
      return c.json({
        success: false,
        error: `잔액 부족 (필요 ${totalDeduct.toLocaleString()}딜, 보유 ${available.toLocaleString()}딜)`,
      }, 400)
    }

    // 4. voucher_orders INSERT (status='pending').
    const trId = `ur-vr-${sellerId}-${Date.now()}`
    const orderResult = await c.env.DB.prepare(
      `INSERT INTO voucher_orders (
         seller_id, source, goods_code, goods_name, goods_image_url,
         unit_price, quantity, total_amount, recipient_phone,
         withholding_amount, net_amount, status, external_order_id
       ) VALUES (?, 'kt_alpha', ?, ?, ?, ?, ?, ?, ?, 0, ?, 'processing', ?)`
    ).bind(
      sellerId, gift.gift_code, gift.name, gift.image_url_small,
      unitDeduct, qty, totalDeduct, phone, totalDeduct, trId,
    ).run().catch((e: Error) => { throw new Error(`voucher_orders INSERT 실패: ${e.message}`) })

    const voucherOrderId = Number(orderResult.meta.last_row_id)

    // 5. KT Alpha sendCoupon 0204 호출.
    try {
      const { sendCoupon } = await import('@/worker/utils/giftishow-api')
      const env = c.env as unknown as { KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }

      // qty 만큼 반복 (KT Alpha 는 1건씩 발송).
      let lastOrderNo: string | undefined
      for (let i = 0; i < qty; i++) {
        const subTrId = qty === 1 ? trId : `${trId}-${i + 1}`
        const result = await sendCoupon(env, {
          goodsCode: gift.gift_code,
          phoneNo: phone,
          callbackNo,
          mmsTitle: body?.mms_title?.slice(0, 30) || `[유어딜] ${gift.name}`,
          mmsMsg: body?.mms_msg?.slice(0, 200) || `${gift.name} 상품권이 도착했습니다. 매장에서 사용해주세요.`,
          trId: subTrId,
          userId: ktUserId,
          orderNo: `vr-${voucherOrderId}-${i + 1}`,
          gubun: 'N',
        })
        lastOrderNo = result.orderNo
      }

      // 6. 성공 — status='sent' + 셀러 잔액 차감.
      await c.env.DB.prepare(
        `UPDATE voucher_orders SET status = 'sent', external_order_id = ?, sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      ).bind(lastOrderNo || trId, voucherOrderId).run()

      // 잔액 차감.
      await c.env.DB.prepare(
        `UPDATE seller_deal_balances SET ${balCol} = ${balCol} - ?, updated_at = datetime('now') WHERE seller_id = ?`
      ).bind(totalDeduct, sellerId).run()

      // 이력 INSERT.
      await c.env.DB.prepare(
        `INSERT INTO seller_deal_transactions (seller_id, amount, bucket, type, reference_id, memo, created_at)
         VALUES (?, ?, ?, 'voucher_redeem', ?, ?, datetime('now'))`
      ).bind(
        sellerId, -totalDeduct, verified ? 'redeemable' : 'gated',
        String(voucherOrderId),
        `${gift.name} × ${qty} → ${phone}`,
      ).run().catch(() => { /* noop */ })

      return c.json({
        success: true,
        data: {
          voucher_order_id: voucherOrderId,
          gift_code: gift.gift_code,
          gift_name: gift.name,
          qty,
          unit_deduct: unitDeduct,
          total_deduct: totalDeduct,
          markup_pct: markupPct,
          recipient_phone: phone,
          external_order_no: lastOrderNo,
        },
      })
    } catch (err) {
      // KT Alpha 호출 실패 — voucher_orders 실패 처리.
      const errMsg = (err as Error).message.slice(0, 500)
      await c.env.DB.prepare(
        `UPDATE voucher_orders SET status = 'failed', failure_reason = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(errMsg, voucherOrderId).run()
      return c.json({ success: false, error: `발송 실패: ${errMsg}` }, 502)
    }
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-19: 셀러 본인 voucher 발송 이력.
sellerSettlementsRoutes.get('/voucher-orders', async (c) => {
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const token = authorization.substring(7)
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload
    const sellerId = payload.seller_id
    if (!sellerId) return c.json({ success: false, error: '셀러 권한 필요' }, 403)

    const rows = await c.env.DB.prepare(
      `SELECT id, goods_code, goods_name, goods_image_url, unit_price, quantity, total_amount,
              recipient_phone, status, external_order_id, failure_reason,
              sent_at, created_at
         FROM voucher_orders WHERE seller_id = ?
        ORDER BY created_at DESC LIMIT 100`
    ).bind(sellerId).all<Record<string, unknown>>().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

sellerSettlementsRoutes.post('/deal-withdraw', async (c) => {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한 필요' }, 403);

    // 사업자 검증 필수.
    const seller = await c.env.DB.prepare(
      'SELECT business_registration_status FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ business_registration_status: string | null }>().catch(() => null);
    const bizVerified = seller?.business_registration_status === 'verified' || seller?.business_registration_status === 'exempt';
    if (!bizVerified) {
      return c.json({
        success: false,
        error: '사업자등록증 검증 후 환급 가능합니다',
        code: 'BUSINESS_REGISTRATION_REQUIRED',
      }, 412);
    }

    // PIN 인증 (settlement/request 와 동일 패턴).
    const { isPinVerified } = await import('./seller-pin.routes');
    const pinOk = await isPinVerified(c.req.header('Cookie'), sellerId, c.env.JWT_SECRET);
    if (!pinOk) {
      return c.json({ success: false, error: 'PIN 인증 필요', code: 'PIN_REQUIRED' }, 412);
    }

    const body = await c.req.json<{ amount?: number; bank_name?: string; account_number?: string; account_holder?: string }>().catch(() => ({} as { amount?: number; bank_name?: string; account_number?: string; account_holder?: string }));
    const amount = Math.floor(Number(body?.amount) || 0);
    if (!amount || amount < 10_000) {
      return c.json({ success: false, error: '최소 환급 금액은 10,000 딜입니다' }, 400);
    }

    // 잔액 확인.
    const balance = await c.env.DB.prepare(
      'SELECT redeemable_deal_amount FROM seller_deal_balances WHERE seller_id = ?'
    ).bind(sellerId).first<{ redeemable_deal_amount: number }>().catch(() => null);
    const available = balance?.redeemable_deal_amount || 0;
    if (amount > available) {
      return c.json({ success: false, error: `환급 가능 잔액 부족 (보유: ${available.toLocaleString()})` }, 400);
    }

    // 잔액 차감 + 거래 이력.
    await c.env.DB.prepare(
      `UPDATE seller_deal_balances
          SET redeemable_deal_amount = redeemable_deal_amount - ?,
              updated_at = datetime('now')
        WHERE seller_id = ?`
    ).bind(amount, sellerId).run();

    const txResult = await c.env.DB.prepare(
      `INSERT INTO seller_deal_transactions (seller_id, amount, bucket, type, memo, created_at)
       VALUES (?, ?, 'redeemable', 'cash_withdraw', ?, datetime('now'))`
    ).bind(
      sellerId, -amount,
      `환급 신청 ${amount.toLocaleString()}원 → ${body?.bank_name || ''} ${body?.account_number || ''}`,
    ).run().catch(() => null);

    // 원천징수 + 지급조서.
    const { withholdAndLog } = await import('@/worker/utils/tax-withholding');
    const wh = await withholdAndLog(c.env as { DB: D1Database }, {
      sellerId,
      grossAmount: amount,
      sourceType: 'deal_redeem',
      sourceId: txResult ? String(txResult.meta.last_row_id) : undefined,
    });

    // settlements 테이블에도 row 생성 (어드민이 송금 처리).
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodStart = prevMonth.toISOString().slice(0, 10);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    await c.env.DB.prepare(`
      INSERT INTO settlements (seller_id, amount, period_start, period_end, bank_name, account_number, account_holder, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).bind(
      sellerId, wh.net_amount, periodStart, periodEnd,
      body?.bank_name || null, body?.account_number || null, body?.account_holder || null,
    ).run().catch(() => null);

    return c.json({
      success: true,
      data: {
        gross_amount: wh.gross_amount,
        withholding_amount: wh.withholding_amount,
        net_amount: wh.net_amount,
        ytd_gross_amount: wh.ytd_gross_amount,
        reportable: wh.reportable,
        message: wh.reportable
          ? `${wh.net_amount.toLocaleString()}원 입금 예정 (원천징수 ${wh.withholding_amount.toLocaleString()}원 차감) — 연 누계 300만 초과: 종합소득세 합산 신고 의무`
          : `${wh.net_amount.toLocaleString()}원 입금 예정 (원천징수 ${wh.withholding_amount.toLocaleString()}원 차감)`,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 🛡️ 2026-05-18: 셀러 본인 원천징수 현황 (마이페이지 — 연 누계 300만 임계 인지).
sellerSettlementsRoutes.get('/tax-summary', async (c) => {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한 필요' }, 403);

    const year = Number(c.req.query('year')) || new Date().getFullYear();
    const { getSellerTaxSummary } = await import('@/worker/utils/tax-withholding');
    const summary = await getSellerTaxSummary(c.env as { DB: D1Database }, sellerId, year);

    // 월별 분포 (참고).
    const monthly = await c.env.DB.prepare(
      `SELECT payout_month, SUM(gross_amount) as gross, SUM(withholding_amount) as withheld
         FROM tax_withholding_log
        WHERE seller_id = ? AND payout_year = ?
        GROUP BY payout_month ORDER BY payout_month`
    ).bind(sellerId, year).all<{ payout_month: number; gross: number; withheld: number }>()
      .catch(() => ({ results: [] }));

    return c.json({ success: true, data: { ...summary, monthly: monthly.results || [] } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 🛡️ 2026-05-18: 사업자등록증 이미지 업로드 (URL 만 받음 — 실제 업로드는 R2 별도 endpoint).
//   상태는 'pending' 으로 변경 → 어드민 검증 대기.
sellerSettlementsRoutes.post('/business-registration/submit', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);

    const body = await c.req.json<{ image_url?: string; business_number?: string }>().catch(() => ({} as { image_url?: string; business_number?: string }));
    const imageUrl = String(body?.image_url || '').trim();
    const businessNumber = String(body?.business_number || '').trim();

    if (!imageUrl) return c.json({ success: false, error: '이미지 URL 이 필요합니다' }, 400);
    // image_url 은 R2 / Cloudflare Images URL 만 허용 (XSS/SSRF 방어).
    if (!/^https?:\/\//.test(imageUrl)) return c.json({ success: false, error: '올바른 URL 형식이 아닙니다' }, 400);
    if (imageUrl.length > 2000) return c.json({ success: false, error: 'URL 이 너무 깁니다' }, 400);
    // 사업자번호 형식 — 한국 표준 10자리 (선택 입력).
    if (businessNumber && !/^\d{3}-?\d{2}-?\d{5}$|^\d{10}$/.test(businessNumber.replace(/[^\d-]/g, ''))) {
      return c.json({ success: false, error: '사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)' }, 400);
    }

    // status 'pending' 으로 재설정 (재신청 케이스 — 거부된 셀러도 다시 제출 가능).
    await db.prepare(
      `UPDATE sellers
          SET business_registration_image_url = ?,
              business_registration_status = 'pending',
              business_registration_reject_reason = NULL,
              business_number = COALESCE(NULLIF(?, ''), business_number),
              updated_at = datetime('now')
        WHERE id = ?`
    ).bind(imageUrl, businessNumber, sellerId).run();

    // 어드민 알림.
    createDashboardNotification(db, 'admin', null, 'business_registration_submitted',
      '사업자등록 검증 요청', `셀러 #${sellerId}`, '/admin/sellers').catch(swallow('seller:biz-reg:submit'));

    return c.json({ success: true, message: '제출되었습니다. 어드민 검증 후 알려드립니다.' });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

sellerSettlementsRoutes.get('/settlements/stats', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const stats = await db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_settled,
        SUM(CASE WHEN status = 'pending'   THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'approved'  THEN amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN status = 'paid'      THEN amount ELSE 0 END) as paid_amount,
        COUNT(CASE WHEN status = 'pending'  THEN 1 END) as total_pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as total_approved,
        COUNT(CASE WHEN status = 'paid'     THEN 1 END) as total_paid,
        COUNT(*) as total_requests
      FROM settlements WHERE seller_id = ?
    `).bind(sellerId).first<SettlementStatsRow>().catch(() => null);
    const defaultStats = { total_settled: 0, pending_amount: 0, approved_amount: 0, paid_amount: 0, total_pending: 0, total_approved: 0, total_paid: 0, total_requests: 0 };
    return c.json({ success: true, data: stats ? { ...defaultStats, ...stats } : defaultStats });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/settlements/summary ─────────────────────────────────────
// 셀러 정산 요약: 미정산 금액, 마지막 정산, 누적 정산
sellerSettlementsRoutes.get('/settlements/summary', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 401);

  try {
    const { getSellerSettlementSummary } = await import('../../../lib/settlement-automation');
    const summary = await getSellerSettlementSummary(db, sellerId);
    return c.json({ success: true, data: summary });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/dashboard/stats ─────────────────────────────────────────
// 셀러 대시보드 요약 통계 (SellerDashboardPage에서 호출)
sellerSettlementsRoutes.get('/dashboard/stats', async (c) => {
  const { DB } = c.env;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [orderStats, productStats, streamStats] = await Promise.all([
      DB.prepare(`
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(total_amount), 0) as total_revenue
        FROM orders WHERE seller_id = ? AND DATE(created_at) = ?
      `).bind(sellerId, today).first<{ total_orders: number; total_revenue: number }>(),
      DB.prepare(`
        SELECT COUNT(*) as total_products,
               SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products
        FROM products WHERE seller_id = ?
      `).bind(sellerId).first<{ total_products: number; active_products: number }>(),
      DB.prepare(`
        SELECT COUNT(*) as total_streams,
               SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) as live_streams
        FROM live_streams WHERE seller_id = ?
      `).bind(sellerId).first<{ total_streams: number; live_streams: number }>(),
    ]);

    return c.json({
      success: true,
      data: {
        today_orders: orderStats?.total_orders ?? 0,
        today_revenue: orderStats?.total_revenue ?? 0,
        total_products: productStats?.total_products ?? 0,
        active_products: productStats?.active_products ?? 0,
        total_streams: streamStats?.total_streams ?? 0,
        live_streams: streamStats?.live_streams ?? 0,
      },
    });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/settlements/:id/download ─────────────────────────────────
// 정산 내역서 다운로드 (CSV/JSON)
sellerSettlementsRoutes.get('/settlements/:id/download', async (c) => {
  const { DB } = c.env;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const settlementId = c.req.param('id');
  try {
    const settlement = await DB.prepare(
      `SELECT * FROM settlements WHERE id = ? AND seller_id = ?`
    ).bind(settlementId, sellerId).first<SettlementRow>();

    if (!settlement) return c.json({ success: false, error: '정산 내역을 찾을 수 없습니다' }, 404);

    // v34 CRITICAL FIX: 계좌번호 마스킹 (끝 4자리만 노출)
    // CSV 파일이 이메일/메신저로 공유되어도 plaintext 유출 방지
    const maskAccount = (acc: string | null | undefined): string => {
      if (!acc) return '';
      const s = String(acc);
      if (s.length <= 4) return '****';
      return '*'.repeat(Math.max(4, s.length - 4)) + s.slice(-4);
    };

    // CSV 형태로 반환
    const csv = [
      '정산ID,판매자ID,금액,상태,은행,계좌번호(마스킹),신청일',
      `${settlement.id},${settlement.seller_id},${settlement.amount},${settlement.status},${settlement.bank_name ?? ''},${maskAccount(settlement.account_number)},${settlement.created_at}`,
    ].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="settlement-${settlementId}.csv"`,
      },
    });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
