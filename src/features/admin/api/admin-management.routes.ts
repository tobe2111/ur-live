/**
 * Admin Management API Routes
 *
 * Comprehensive endpoints for admin dashboard:
 * - GET  /sellers            - 모든 판매자 조회
 * - GET  /sellers/pending    - 승인 대기 중인 판매자 조회
 * - PATCH /sellers/:id/approve    - 판매자 승인
 * - PATCH /sellers/:id/reject     - 판매자 거부
 * - PATCH /sellers/:id/commission - 판매자 수수료율 변경
 * - PATCH /sellers/:id/permissions- 판매자 권한 변경
 * - GET  /orders             - 모든 주문 조회
 * - GET  /products           - 모든 상품 조회
 * - GET  /stats              - 대시보드 통계
 * - GET  /dashboard/stats    - 실시간 대시보드 통계
 * - GET  /settlement/stats   - 정산 통계
 * - GET  /settlement/records - 정산 기록
 * - DELETE /streams/:id      - 라이브 스트림 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { requireAdmin } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { sendAlimtalk, buildSampleApprovalMessage } from '../../alimtalk/aligo';
import { DEFAULT_COMMISSION_RATE } from '@/shared/constants';
import { KOREAN_NAMES, REVIEW_TEMPLATES } from './review-templates';

// v30 FIX: 에러 메시지 유출 방지. 프로덕션에서는 generic 메시지만 노출,
// 개발에서는 디버깅을 위해 원본 보존. SQL 오류/컬럼명이 클라이언트에 노출되던 문제 수정.
function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

interface SellerRow {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  business_name: string | null;
  business_number: string | null;
  status: string;
  created_at: string;
  commission_rate?: number;
  can_manipulate_stats?: number;
}

interface OrderRow {
  id: number;
  order_number: string;
  user_id: string;
  seller_id: number | null;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_address_detail: string | null;
  shipping_zipcode: string | null;
  courier: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  seller_name: string | null;
  items?: OrderItemRow[];
}

interface OrderItemRow {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  price: number;
  image_url: string | null;
}

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  image_url: string | null;
  is_active: number;
  product_type: string | null;
  category: string | null;
  seller_id: number | null;
  created_at: string;
  seller_name: string | null;
}

interface CountRow {
  count: number;
}

interface SalesRow {
  total: number;
}

interface SettlementOverviewRow {
  total_orders: number;
  total_sales: number;
  total_commission: number;
  total_seller_amount: number;
}

interface SettlementSellerRow {
  seller_id: number;
  seller_name: string | null;
  business_name: string | null;
  commission_rate: number;
  order_count: number;
  total_sales: number;
  commission_amount: number;
  seller_amount: number;
}

interface SettlementRecordRow {
  id: number;
  order_number: string;
  seller_id: number | null;
  seller_name: string | null;
  business_name: string | null;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  seller_amount: number;
  settlement_status: string;
  settled_at: string | null;
  created_at: string;
  user_name: string | null;
}

interface IdRow {
  id: number;
  status?: string;
  commission_rate?: number;
}

export const adminManagementRoutes = new Hono<{ Bindings: Env }>();

// 모든 admin 관리 엔드포인트는 admin 권한 필수
adminManagementRoutes.use('*', requireAdmin());

// ─── 판매자 관리 ──────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 146 (TD-006 부분): admin-sellers.routes.ts 로 이관.

// ─── 주문 관리 ──────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 149 (TD-006 부분): admin-orders.routes.ts 로 이관.

// ─── 상품 관리 ───────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 148 (TD-006 부분): admin-products.routes.ts 로 이관.
// (/products, /products/:id, /sample-requests 모두 포함)

// ─── 통계 ────────────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 144 (TD-006 부분): admin-stats.routes.ts 로 이관.

// ─── 정산 관리 ──────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 143 (TD-006 부분): admin-settlements.routes.ts 로 이관.
// worker/index.ts 에서 adminApp.route('/', adminSettlementsRoutes) 으로 마운트됨.

// ─── 라이브 스트림 관리 + Alimtalk ──────────────────────────────────────────
// 🛡️ 2026-04-22 배치 150 (TD-006 부분): admin-streams.routes.ts 로 이관.

// ─── 후원 정산 관리 ───────────────────────────────────────────────────────────

// GET /api/admin/donations/settlements - 전체 정산 신청 목록
adminManagementRoutes.get('/donations/settlements', cors(), async (c) => {
  const { DB } = c.env;
  const status = c.req.query('status') || '';
  try {
    let query = `
      SELECT ds.id, ds.seller_id, s.name AS seller_name, s.business_name,
             ds.total_amount, ds.commission_amount, ds.settlement_amount,
             ds.donation_count, ds.status, ds.requested_at, ds.settled_at,
             ds.admin_memo, ds.bank_info, ds.created_at
      FROM donation_settlements ds
      JOIN sellers s ON ds.seller_id = s.id
    `;
    const params: (string | number)[] = [];
    if (status) { query += ' WHERE ds.status = ?'; params.push(status); }
    query += ' ORDER BY ds.created_at DESC LIMIT 200';

    const { results } = await DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// GET /api/admin/donations/stats - 후원 통계
adminManagementRoutes.get('/donations/stats', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const [totalDonations, pendingSettlements, totalCommission] = await Promise.all([
      DB.prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total FROM donations WHERE status='DONE'`)
        .first<{ cnt: number; total: number }>().catch(() => ({ cnt: 0, total: 0 })),
      DB.prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(settlement_amount),0) AS total FROM donation_settlements WHERE status='REQUESTED'`)
        .first<{ cnt: number; total: number }>().catch(() => ({ cnt: 0, total: 0 })),
      DB.prepare(`SELECT COALESCE(SUM(commission_amount),0) AS total FROM donations WHERE status='DONE'`)
        .first<{ total: number }>().catch(() => ({ total: 0 })),
    ]);
    return c.json({
      success: true,
      data: {
        total_donations: totalDonations?.cnt ?? 0,
        total_amount: totalDonations?.total ?? 0,
        pending_settlements: pendingSettlements?.cnt ?? 0,
        pending_settlement_amount: pendingSettlements?.total ?? 0,
        total_commission: totalCommission?.total ?? 0,
      },
    });
  } catch {
    return c.json({ success: true, data: { total_donations: 0, total_amount: 0, pending_settlements: 0, pending_settlement_amount: 0, total_commission: 0 } });
  }
});

// ─── 사이드 배너 관리 ──────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 141 (TD-006 부분): admin-side-banners.routes.ts 로 이관.
// worker/index.ts 에서 adminApp.route('/', adminSideBannersRoutes) 으로 마운트됨.

// PATCH /api/admin/donations/settlements/:id - 정산 완료/거부
adminManagementRoutes.patch('/donations/settlements/:id', cors(), async (c) => {
  const { DB } = c.env;
  const settleId = c.req.param('id');
  try {
    const body = await c.req.json<{ action: 'done' | 'reject'; admin_memo?: string }>();
    if (!['done', 'reject'].includes(body.action)) {
      return c.json({ success: false, error: 'action은 done 또는 reject이어야 합니다' }, 400);
    }
    const existing = await DB.prepare(
      `SELECT id, status FROM donation_settlements WHERE id = ?`
    ).bind(settleId).first<{ id: number; status: string }>();
    if (!existing) return c.json({ success: false, error: '정산 신청을 찾을 수 없습니다' }, 404);
    if (existing.status !== 'REQUESTED') {
      return c.json({ success: false, error: `이미 처리된 정산입니다 (${existing.status})` }, 409);
    }
    const newStatus = body.action === 'done' ? 'DONE' : 'REJECTED';
    const settledAt = body.action === 'done' ? `datetime('now')` : 'NULL';
    await DB.prepare(`
      UPDATE donation_settlements
      SET status = ?, admin_memo = ?, settled_at = ${settledAt}, updated_at = datetime('now')
      WHERE id = ?
    `).bind(newStatus, body.admin_memo || null, settleId).run();
    return c.json({
      success: true,
      data: { id: settleId, status: newStatus },
      message: body.action === 'done' ? '정산이 완료 처리되었습니다.' : '정산이 거부되었습니다.',
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// 딜 충전 모니터링 API
// ══════════════════════════════════════════════════════════════════

// GET /api/admin/deals/stats - 딜 충전 통계 요약
adminManagementRoutes.get('/deals/stats', async (c) => {
  const { DB } = c.env;
  try {
    const totals = await DB.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_charged_amount,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(points_amount), 0) as total_points_issued,
        COUNT(DISTINCT user_id) as unique_users
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
    `).first();

    const today = await DB.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as amount,
        COALESCE(SUM(commission_amount), 0) as commission
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
        AND created_at >= date('now')
    `).first();

    const thisMonth = await DB.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as amount,
        COALESCE(SUM(commission_amount), 0) as commission
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
        AND created_at >= date('now', 'start of month')
    `).first();

    const donations = await DB.prepare(`
      SELECT
        COUNT(*) as total_donations,
        COALESCE(SUM(amount), 0) as total_donated
      FROM point_transactions
      WHERE type = 'donate'
    `).first();

    return c.json({
      success: true,
      data: {
        totals: totals ?? {},
        today: today ?? {},
        thisMonth: thisMonth ?? {},
        donations: donations ?? {},
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// GET /api/admin/deals/charges - 딜 충전 내역 (페이지네이션)
adminManagementRoutes.get('/deals/charges', async (c) => {
  const { DB } = c.env;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(10, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;
  const search = c.req.query('search') || '';

  try {
    let whereClause = "WHERE pt.type = 'charge' AND pt.payment_key IS NOT NULL";
    const binds: any[] = [];

    if (search) {
      whereClause += ' AND (pt.user_id LIKE ? OR pt.order_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      binds.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = await DB.prepare(
      `SELECT COUNT(*) as total FROM point_transactions pt LEFT JOIN users u ON CAST(pt.user_id AS TEXT) = CAST(u.id AS TEXT) ${whereClause}`
    ).bind(...binds).first<{ total: number }>();

    const { results } = await DB.prepare(`
      SELECT
        pt.id, pt.user_id, pt.amount, pt.commission_amount,
        pt.points_amount, pt.balance_after, pt.description,
        pt.payment_key, pt.order_id, pt.created_at,
        up.balance as current_balance,
        up.total_charged as user_total_charged,
        up.total_donated as user_total_donated,
        u.name as user_name,
        u.email as user_email,
        u.profile_image as user_profile_image
      FROM point_transactions pt
      LEFT JOIN user_points up ON pt.user_id = up.user_id
      LEFT JOIN users u ON CAST(pt.user_id AS TEXT) = CAST(u.id AS TEXT)
      ${whereClause}
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all();

    return c.json({
      success: true,
      data: results ?? [],
      pagination: {
        page,
        limit,
        total: countResult?.total ?? 0,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// GET /api/admin/deals/users - 딜 사용자별 요약
adminManagementRoutes.get('/deals/users', async (c) => {
  const { DB } = c.env;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(10, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;
  const sort = c.req.query('sort') || 'total_charged';
  const allowedSorts = ['total_charged', 'total_donated', 'balance', 'last_charged'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'total_charged';

  try {
    const countResult = await DB.prepare(
      'SELECT COUNT(*) as total FROM user_points WHERE total_charged > 0'
    ).first<{ total: number }>();

    const { results } = await DB.prepare(`
      SELECT
        up.user_id,
        up.balance,
        up.total_charged,
        up.total_donated,
        up.created_at as first_charge_date,
        up.updated_at as last_activity,
        (SELECT COUNT(*) FROM point_transactions WHERE user_id = up.user_id AND type = 'charge' AND payment_key IS NOT NULL) as charge_count,
        (SELECT MAX(created_at) FROM point_transactions WHERE user_id = up.user_id AND type = 'charge' AND payment_key IS NOT NULL) as last_charged,
        u.name as user_name,
        u.email as user_email,
        u.profile_image as user_profile_image
      FROM user_points up
      LEFT JOIN users u ON CAST(up.user_id AS TEXT) = CAST(u.id AS TEXT)
      WHERE up.total_charged > 0
      ORDER BY ${sortCol} DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return c.json({
      success: true,
      data: results ?? [],
      pagination: {
        page,
        limit,
        total: countResult?.total ?? 0,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 플랫폼 수수료 설정 ──────────────────────────────────────────────

adminManagementRoutes.get('/settings/commission', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    try {
      await DB.prepare(`CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_default', '5', '라이브 판매 수수료율 (%)')`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_donation', '15', '후원 수수료율 (%)')`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_meal_voucher', '5', '식사권 수수료율 (%)')`).run();
      // 기존 description 업데이트
      await DB.prepare(`UPDATE platform_settings SET description = '라이브 판매 수수료율 (%)', value = '5' WHERE key = 'commission_rate_default' AND (description LIKE '%후원%' OR description LIKE '%상품%' OR CAST(value AS INTEGER) = 15)`).run();
      await DB.prepare(`UPDATE platform_settings SET value = '5' WHERE key = 'commission_rate_meal_voucher' AND value = '10'`).run();
    } catch { /* exists */ }

    const { results } = await DB.prepare("SELECT * FROM platform_settings WHERE key LIKE 'commission_%' ORDER BY key").all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminManagementRoutes.put('/settings/commission', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { key, value } = await c.req.json<{ key: string; value: string }>();

    if (!key || value === undefined) return c.json({ success: false, error: '키와 값이 필요합니다' }, 400);
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);

    // 🛡️ 2026-04-22: key 화이트리스트 검증 + 이전 값 기록 (audit)
    // commission_rate_live 추가 (라이브 판매 5% 분기용)
    const ALLOWED_KEYS = ['commission_rate_default', 'commission_rate_donation', 'commission_rate_meal_voucher',
      'commission_rate_live',
      'review_reward_text', 'review_reward_image', 'review_reward_video',
      'affiliate_commission_rate'];
    if (!ALLOWED_KEYS.includes(key)) {
      return c.json({ success: false, error: `변경 불가능한 key: ${key}` }, 400);
    }

    const prevRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(key).first<{ value: string }>();
    const prevValue = prevRow?.value ?? null;

    await DB.prepare("UPDATE platform_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?").bind(value, key).run();

    // 감사 로그 — 어드민 대시보드에서 누가 언제 수수료/보상을 변경했는지 추적
    await writeAuditLog(c, {
      action: 'platform_settings.update',
      targetType: 'platform_setting',
      targetId: key,
      before: { value: prevValue },
      after: { value }
    });

    return c.json({ success: true, message: `${key} 값이 ${value}로 변경되었습니다` });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 리뷰 자동 생성 (어드민 전용) ──────────────────────────────────────
// 🛡️ 2026-04-22 배치 122 (TD-006 부분): KOREAN_NAMES / REVIEW_TEMPLATES 는
//   ./review-templates 파일로 분리 (이 파일 3571 → 3344 줄).

adminManagementRoutes.post('/reviews/generate', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { product_id, product_name, product_price, product_category, count, avg_rating, options, mode } = await c.req.json<{
      product_id: number; product_name?: string; product_price?: number; product_category?: string;
      count: number; avg_rating: number; options?: string[]; mode?: 'template' | 'ai';
    }>();

    if (!product_id || !count || count < 1 || count > 20000) {
      return c.json({ success: false, error: '상품 ID와 개수(1-20000)가 필요합니다' }, 400);
    }

    // 🛡️ 2026-04-22: 가짜 리뷰 생성은 중대한 관리 행위 → 감사 로그 필수
    await writeAuditLog(c, {
      action: 'generate_fake_reviews',
      targetType: 'product',
      targetId: String(product_id),
      after: { count, avg_rating: avg_rating ?? 4.5, mode: mode ?? 'template' },
    });

    // reviews 테이블 ensure
    try {
      await DB.prepare(`
        CREATE TABLE IF NOT EXISTS product_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          user_id TEXT,
          user_name TEXT NOT NULL,
          rating INTEGER NOT NULL,
          content TEXT,
          selected_option TEXT,
          is_generated INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch { /* exists */ }

    let generated = 0;
    const targetRating = avg_rating || 4.5;
    const now = Date.now();
    const BATCH_SIZE = 50;

    // ── AI 모드: Claude API로 자연스러운 리뷰 생성 ──
    if (mode === 'ai') {
      const apiKey = (c.env as any).ANTHROPIC_API_KEY;
      if (!apiKey) return c.json({ success: false, error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다. Cloudflare 환경변수에 추가해주세요.' }, 400);

      const aiCount = Math.min(count, 500); // AI는 최대 500개
      const batchSize = 50; // 한 번에 50개씩 생성 요청

      for (let batchStart = 0; batchStart < aiCount; batchStart += batchSize) {
        const batchCount = Math.min(batchSize, aiCount - batchStart);
        const ratingsForBatch = Array.from({ length: batchCount }, () =>
          Math.min(5, Math.max(1, Math.round(targetRating + (Math.random() - 0.5))))
        );

        try {
          const prompt = `한국 온라인 쇼핑몰의 상품 리뷰를 ${batchCount}개 작성해주세요.

상품 정보:
- 상품명: ${product_name || '상품'}
- 가격: ${product_price ? product_price.toLocaleString() + '원' : '미정'}
- 카테고리: ${product_category || '일반'}
${options?.length ? '- 옵션: ' + options.join(', ') : ''}

각 리뷰의 별점: ${ratingsForBatch.join(', ')}

규칙:
- 실제 구매자가 쓴 것처럼 자연스럽고 다양하게
- 1~3문장 길이, 구어체
- 별점 4-5점은 긍정, 3점은 보통, 1-2점은 부정
- 약 20%는 텍스트 없이 빈 문자열("")만 (별점만 매기는 사람)
- 이모지 가끔 사용 (30% 확률)
- 반복되는 표현 최소화

JSON 배열로만 응답. 각 항목: {"content": "리뷰 내용", "rating": 별점}
빈 리뷰는 {"content": "", "rating": 별점}`;

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            // 🛡️ 2026-04-22: 30s timeout — LLM 응답 느릴 때 worker hang 방어
            signal: AbortSignal.timeout(30_000),
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          const data: any = await res.json();
          const text = data?.content?.[0]?.text || '[]';

          // JSON 파싱 (```json 블록 제거) + 스키마 검증
          const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed: unknown = JSON.parse(jsonStr);
          if (!Array.isArray(parsed)) {
            throw new Error('Expected array response from Claude');
          }
          for (const r of parsed) {
            if (
              typeof r !== 'object' || r === null ||
              typeof (r as any).rating !== 'number' ||
              typeof (r as any).content !== 'string'
            ) {
              throw new Error('Invalid review schema');
            }
          }
          const reviews = parsed as { content: string; rating: number }[];

          const stmts = reviews.map((r) => {
            const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)];
            const maskedName = name[0] + '*' + name[name.length - 1];
            const daysAgo = Math.floor(Math.random() * 90);
            const reviewDate = new Date(now - daysAgo * 86400000).toISOString();
            const option = options?.length ? options[Math.floor(Math.random() * options.length)] : null;

            return DB.prepare(
              'INSERT INTO product_reviews (product_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
            ).bind(product_id, maskedName, r.rating, r.content || null, option, reviewDate);
          });

          await DB.batch(stmts);
          generated += stmts.length;
        } catch (e) {
          console.error('[AI Review] Batch error:', e);
        }
      }

      // 리뷰 수에 비례하여 sold_count 증가 (리뷰 1개당 2~3명 구매)
      const soldIncrement = generated * (2 + Math.round(Math.random()));
      try { await DB.prepare('UPDATE products SET sold_count = COALESCE(sold_count, 0) + ? WHERE id = ?').bind(soldIncrement, product_id).run() } catch {}

      return c.json({ success: true, data: { generated }, message: `AI로 ${generated}개 리뷰가 생성되었습니다` });
    }

    // ── 템플릿 모드 ──

    for (let batchStart = 0; batchStart < count; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
      const stmts = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const rating = Math.min(5, Math.max(1, Math.round(targetRating + (Math.random() - 0.5))));
        const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)];
        const maskedName = name[0] + '*' + name[name.length - 1];
        const content = REVIEW_TEMPLATES[Math.floor(Math.random() * REVIEW_TEMPLATES.length)] || null;
        const option = options && options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null;
        const daysAgo = Math.floor(Math.random() * 90);
        const reviewDate = new Date(now - daysAgo * 86400000).toISOString();

        stmts.push(
          DB.prepare(`INSERT INTO product_reviews (product_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`)
            .bind(product_id, maskedName, rating, content, option, reviewDate)
        );
      }

      try {
        await DB.batch(stmts);
        generated += stmts.length;
      } catch { /* partial batch fail */ }
    }

    // 리뷰 수에 비례하여 sold_count 증가 (리뷰 1개당 2~3명 구매)
    const soldIncrement = generated * (2 + Math.round(Math.random()));
    try { await DB.prepare('UPDATE products SET sold_count = COALESCE(sold_count, 0) + ? WHERE id = ?').bind(soldIncrement, product_id).run() } catch {}

    return c.json({ success: true, data: { generated, sold_increment: soldIncrement }, message: `${generated}개 리뷰 + ${soldIncrement}명 구매 수 반영` });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 리뷰 삭제 ──
// 🛡️ 2026-04-22 배치 140 BUG FIX: 이전 핸들러는 product_reviews 테이블 (존재 안 함) 을
//   삭제하는 잘못된 코드였고, 올바른 reviews 테이블 삭제 핸들러 (line ~3058) 를 shadow
//   했음. 제거 → 올바른 핸들러가 실행되도록.

// ── 리뷰 목록 (상품별) ──
adminManagementRoutes.get('/reviews/product/:productId', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const productId = c.req.param('productId');
    const { results } = await DB.prepare('SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 100').bind(productId).all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 생성된 리뷰 일괄 삭제 ──
adminManagementRoutes.delete('/reviews/generated/:productId', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const productId = c.req.param('productId');
    const result = await DB.prepare('DELETE FROM product_reviews WHERE product_id = ? AND is_generated = 1').bind(productId).run();
    return c.json({ success: true, message: `${result.meta.changes}개 생성 리뷰 삭제됨` });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 쿠폰 관리 ──
// 🛡️ 2026-04-22 배치 138 (TD-006 부분): admin-coupons.routes.ts 로 이관.
// 라우트는 worker/index.ts 에서 adminApp.route('/', adminCouponsRoutes) 으로 마운트됨.

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Audit Log Viewer
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditLogRow {
  id: number;
  admin_id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  before_value: string | null;
  after_value: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

adminManagementRoutes.get('/audit-logs', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
    const offset = (page - 1) * limit;
    const adminId = c.req.query('admin_id');
    const action = c.req.query('action');
    const targetType = c.req.query('target_type');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (adminId) { conditions.push('admin_id = ?'); params.push(adminId); }
    if (action) { conditions.push('action = ?'); params.push(action); }
    if (targetType) { conditions.push('target_type = ?'); params.push(targetType); }
    if (startDate) { conditions.push('created_at >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('created_at <= ?'); params.push(endDate); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM admin_audit_logs ${where}`, params
    );
    const total = countRows[0]?.count || 0;

    const logs = await executeQuery<AuditLogRow>(DB,
      `SELECT id, admin_id, admin_email, action, target_type, target_id,
              before_value, after_value, ip, user_agent, created_at
       FROM admin_audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return c.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Admin] audit-logs error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Revenue Analytics
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Analytics ───────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 152 (TD-006 부분): admin-analytics.routes.ts 로 이관.

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Admin Account Management
// ═══════════════════════════════════════════════════════════════════════════════

import { hashPassword, validatePasswordComplexity } from '@/lib/password';

// ─── 관리자 계정 CRUD ───────────────────────────────────────────
// 🛡️ 2026-04-22 배치 151 (TD-006 부분): admin-accounts.routes.ts 로 이관.

// ─── Review Moderation + Live Monitor ────────────────────────
// 🛡️ 2026-04-22 배치 153 (TD-006 부분): admin-moderation.routes.ts 로 이관.

// ─── User Management ─────────────────────────────────────────
// 🛡️ 2026-04-22 배치 154 (TD-006 부분): admin-users.routes.ts 로 이관.

export default adminManagementRoutes;
