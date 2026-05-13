/**
 * YouTube 구독자 늘리기 API
 *
 * GET  /api/youtube-growth/packages       - 패키지 목록
 * POST /api/youtube-growth/request        - 셀러: 결제 시작 (토스)
 * POST /api/youtube-growth/confirm        - 셀러: 결제 확인
 * GET  /api/youtube-growth/my             - 셀러: 내 신청 목록
 * GET  /api/youtube-growth/admin          - 어드민: 전체 목록
 * PUT  /api/youtube-growth/:id            - 어드민: 상태 변경
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS, TOSS_PAYMENT_URL } from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { withCircuitBreaker } from '@/worker/utils/circuit-breaker';
import { swallow } from '@/worker/utils/swallow';
const youtubeGrowthRoutes = new Hono<{ Bindings: Env }>();
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// SECURITY (HIGH-5): admin-only 엔드포인트는 adminApp 내부 마운트용 별도 라우터로 분리
// adminApp에서 requireAdmin + IP whitelist + audit log 자동 적용됨
const youtubeGrowthAdminRoutes = new Hono<{ Bindings: Env }>();
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

const GROWTH_PACKAGES = [
  { subscribers: 100,   price: 20000,   label: '100명 / 20,000원' },
  { subscribers: 500,   price: 45000,   label: '500명 / 45,000원' },
  { subscribers: 1000,  price: 95000,   label: '1,000명 / 95,000원' },
  { subscribers: 5000,  price: 450000,  label: '5,000명 / 450,000원' },
  { subscribers: 10000, price: 850000,  label: '10,000명 / 850,000원' },
];

async function ensureTable(DB: D1Database) {
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS youtube_growth_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      channel_url TEXT NOT NULL,
      current_subscribers INTEGER DEFAULT 0,
      target_subscribers INTEGER NOT NULL DEFAULT 1000,
      price INTEGER NOT NULL DEFAULT 0,
      order_id TEXT,
      payment_key TEXT,
      payment_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'pending',
      admin_memo TEXT,
      requested_at DATETIME DEFAULT (datetime('now')),
      completed_at DATETIME
    )`).run();
  } catch { /* exists */ }

  // 기존 테이블에 컬럼 추가 (마이그레이션)
  for (const col of [
    "ALTER TABLE youtube_growth_requests ADD COLUMN price INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE youtube_growth_requests ADD COLUMN order_id TEXT",
    "ALTER TABLE youtube_growth_requests ADD COLUMN payment_key TEXT",
    "ALTER TABLE youtube_growth_requests ADD COLUMN payment_status TEXT DEFAULT 'pending'",
  ]) {
    try { await DB.prepare(col).run(); } catch { /* already exists */ }
  }
}

// GET /packages — 패키지 목록
youtubeGrowthRoutes.get('/packages', (c) => {
  return c.json({ success: true, data: GROWTH_PACKAGES });
});

// POST /request — 결제 시작
youtubeGrowthRoutes.post('/request', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const { channel_url, subscribers } = await c.req.json<{
    channel_url: string;
    subscribers: number;
  }>();

  if (!channel_url) return c.json({ success: false, error: 'YouTube 채널 URL을 입력해주세요' }, 400);

  const pkg = GROWTH_PACKAGES.find(p => p.subscribers === subscribers);
  if (!pkg) return c.json({ success: false, error: '유효하지 않은 패키지입니다' }, 400);

  // 셀러 ID 조회
  const seller = await DB.prepare('SELECT id, name FROM sellers WHERE id = ? OR username = ?')
    .bind(user.id, user.id).first<{ id: number; name: string }>();
  if (!seller) return c.json({ success: false, error: '셀러 정보를 찾을 수 없습니다' }, 403);

  // 중복 신청 체크 (결제 완료된 것 중)
  const existing = await DB.prepare(
    "SELECT id FROM youtube_growth_requests WHERE seller_id = ? AND status IN ('pending', 'processing') AND payment_status = 'paid'"
  ).bind(seller.id).first();
  if (existing) return c.json({ success: false, error: '이미 진행 중인 신청이 있습니다' }, 409);

  const orderId = `YTG-${seller.id}-${Date.now()}`;

  // pending 레코드 생성
  await DB.prepare(`
    INSERT INTO youtube_growth_requests (seller_id, channel_url, target_subscribers, price, order_id, payment_status, status)
    VALUES (?, ?, ?, ?, ?, 'pending', 'pending')
  `).bind(seller.id, channel_url, pkg.subscribers, pkg.price, orderId).run();

  return c.json({
    success: true,
    data: {
      orderId,
      amount: pkg.price,
      subscribers: pkg.subscribers,
      orderName: `YouTube 구독자 ${Number(pkg.subscribers ?? 0).toLocaleString('ko-KR')}명 늘리기`,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// POST /confirm — 토스 결제 확인
youtubeGrowthRoutes.post('/confirm', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { paymentKey, orderId, amount } = await c.req.json<{
    paymentKey: string;
    orderId: string;
    amount: number;
  }>();

  if (!paymentKey || !orderId || !amount) {
    return c.json({ success: false, error: '필수 항목 누락' }, 400);
  }

  const { DB } = c.env;

  // 셀러 조회
  const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ? OR username = ?')
    .bind(user.id, user.id).first<{ id: number }>();
  if (!seller) return c.json({ success: false, error: '셀러 정보를 찾을 수 없습니다' }, 403);

  // pending 레코드 확인
  const pending = await DB.prepare(
    "SELECT id, price, target_subscribers FROM youtube_growth_requests WHERE order_id = ? AND seller_id = ? AND payment_status = 'pending'"
  ).bind(orderId, seller.id).first<{ id: number; price: number; target_subscribers: number }>();

  if (!pending) return c.json({ success: false, error: '신청 정보를 찾을 수 없습니다' }, 404);
  if (pending.price !== amount) return c.json({ success: false, error: '금액이 일치하지 않습니다' }, 400);

  // 토스 결제 승인
  let tossRes: Response;
  try {
    tossRes = await withCircuitBreaker(
      { name: 'toss-confirm', maxFailures: 10, resetTimeoutMs: 60_000 },
      () => fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(c.env.TOSS_SECRET_KEY + ':')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': paymentKey,
        },
        // 🛡️ Defense-in-depth: send DB-verified pending.price (equal to client amount above)
        body: JSON.stringify({ paymentKey, orderId, amount: pending.price }),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  } catch {
    return c.json({ success: false, error: 'Toss 결제 시스템이 일시 중단됐습니다. 잠시 후 다시 시도해주세요.', code: 'CIRCUIT_OPEN' }, 503);
  }

  if (!tossRes.ok) {
    const err = await tossRes.json<{ message?: string; code?: string }>();
    if (err.code !== 'ALREADY_PROCESSED_PAYMENT') {
      return c.json({ success: false, error: err.message ?? '결제 승인 실패' }, 400);
    }
  }

  // 결제 완료 처리
  await DB.prepare(
    "UPDATE youtube_growth_requests SET payment_key = ?, payment_status = 'paid' WHERE id = ?"
  ).bind(paymentKey, pending.id).run();

  // 어드민 알림
  createDashboardNotification(
    DB, 'admin', null, 'youtube_growth_request',
    'YouTube 구독자 늘리기 결제 완료',
    `${Number(pending.target_subscribers ?? 0).toLocaleString('ko-KR')}명 / ${Number(amount ?? 0).toLocaleString('ko-KR')}원`,
    '/admin/youtube-growth'
  ).catch(swallow('youtube-growth:api:youtube-growth'));

  return c.json({
    success: true,
    data: {
      subscribers: pending.target_subscribers,
      amount: pending.price,
    },
    message: `YouTube 구독자 ${Number(pending.target_subscribers ?? 0).toLocaleString('ko-KR')}명 늘리기가 신청되었습니다.`,
  });
});

// GET /my — 셀러 내 신청 목록
youtubeGrowthRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ? OR username = ?')
    .bind(user.id, user.id).first<{ id: number }>();
  if (!seller) return c.json({ success: true, data: [] });

  const { results } = await DB.prepare(
    "SELECT * FROM youtube_growth_requests WHERE seller_id = ? AND payment_status = 'paid' ORDER BY requested_at DESC"
  ).bind(seller.id).all();

  return c.json({ success: true, data: results ?? [] });
});

// GET /admin — 어드민 전체 목록
youtubeGrowthRoutes.get('/admin', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  await ensureTable(DB);

  const { results } = await DB.prepare(`
    SELECT r.*, s.name as seller_name, s.business_name
    FROM youtube_growth_requests r
    LEFT JOIN sellers s ON r.seller_id = s.id
    WHERE r.payment_status = 'paid'
    ORDER BY r.requested_at DESC
  `).all();

  return c.json({ success: true, data: results ?? [] });
});

// PUT /:id — 어드민 상태 변경
youtubeGrowthRoutes.put('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const id = c.req.param('id');
  const { status, admin_memo } = await c.req.json<{ status: string; admin_memo?: string }>();

  const updates: string[] = ['status = ?'];
  const params: (string | null)[] = [status];

  if (admin_memo !== undefined) { updates.push('admin_memo = ?'); params.push(admin_memo); }
  if (status === 'completed') updates.push("completed_at = datetime('now')");

  params.push(id!);
  await DB.prepare(`UPDATE youtube_growth_requests SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  // Notify the seller about status change
  const request = await DB.prepare('SELECT seller_id FROM youtube_growth_requests WHERE id = ?').bind(id).first<{ seller_id: number }>();
  if (request) {
    const statusLabels: Record<string, string> = { processing: '처리 중', completed: '완료', rejected: '거절' };
    createDashboardNotification(
      DB, 'seller', String(request.seller_id), 'youtube_growth_update',
      'YouTube 구독자 늘리기 상태 변경',
      `상태: ${statusLabels[status] || status}`,
      '/seller/youtube-growth'
    ).catch(swallow('youtube-growth:api:youtube-growth'));
  }

  return c.json({ success: true, message: '상태가 변경되었습니다' });
});

// ──────────────────────────────────────────────────────────────────────
// Admin-only routes (mounted under adminApp for IP whitelist + audit log)
// ──────────────────────────────────────────────────────────────────────

// GET /admin/youtube-growth — 어드민 전체 목록
youtubeGrowthAdminRoutes.get('/', async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  const { results } = await DB.prepare(`
    SELECT r.*, s.name as seller_name, s.business_name
    FROM youtube_growth_requests r
    LEFT JOIN sellers s ON r.seller_id = s.id
    WHERE r.payment_status = 'paid'
    ORDER BY r.requested_at DESC
  `).all();

  return c.json({ success: true, data: results ?? [] });
});

// PUT /admin/youtube-growth/:id — 어드민 상태 변경
youtubeGrowthAdminRoutes.put('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  const { status, admin_memo } = await c.req.json<{ status: string; admin_memo?: string }>();

  const updates: string[] = ['status = ?'];
  const params: (string | null)[] = [status];

  if (admin_memo !== undefined) { updates.push('admin_memo = ?'); params.push(admin_memo); }
  if (status === 'completed') updates.push("completed_at = datetime('now')");

  params.push(id!);
  await DB.prepare(`UPDATE youtube_growth_requests SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  const request = await DB.prepare('SELECT seller_id FROM youtube_growth_requests WHERE id = ?').bind(id).first<{ seller_id: number }>();
  if (request) {
    const statusLabels: Record<string, string> = { processing: '처리 중', completed: '완료', rejected: '거절' };
    createDashboardNotification(
      DB, 'seller', String(request.seller_id), 'youtube_growth_update',
      'YouTube 구독자 늘리기 상태 변경',
      `상태: ${statusLabels[status] || status}`,
      '/seller/youtube-growth'
    ).catch(swallow('youtube-growth:api:youtube-growth'));
  }

  return c.json({ success: true, message: '상태가 변경되었습니다' });
});

export { youtubeGrowthRoutes, youtubeGrowthAdminRoutes };
