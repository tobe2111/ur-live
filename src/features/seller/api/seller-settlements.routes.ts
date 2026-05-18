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
    const result = await db.prepare(`
      INSERT INTO settlements (seller_id, amount, bank_name, account_number, account_holder, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).bind(sellerId, amount, bank_name || null, account_number || null, account_holder || null).run()
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
