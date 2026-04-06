/**
 * YouTube 구독자 늘리기 신청 API
 *
 * POST /api/youtube-growth/request  - 셀러: 구독자 늘리기 신청
 * GET  /api/youtube-growth/my       - 셀러: 내 신청 목록
 * GET  /api/youtube-growth/admin    - 어드민: 전체 신청 목록
 * PUT  /api/youtube-growth/:id      - 어드민: 상태 변경 (processing/completed/rejected)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

const youtubeGrowthRoutes = new Hono<{ Bindings: Env }>();
youtubeGrowthRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));

async function ensureTable(DB: D1Database) {
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS youtube_growth_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      channel_url TEXT NOT NULL,
      current_subscribers INTEGER DEFAULT 0,
      target_subscribers INTEGER NOT NULL DEFAULT 1000,
      status TEXT DEFAULT 'pending',
      admin_memo TEXT,
      requested_at DATETIME DEFAULT (datetime('now')),
      completed_at DATETIME
    )`).run();
  } catch { /* exists */ }
}

// POST /request — 셀러 신청
youtubeGrowthRoutes.post('/request', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const { channel_url, growth_count, current_subscribers, target_subscribers } = await c.req.json<{
    channel_url: string;
    growth_count?: number;
    current_subscribers?: number;
    target_subscribers?: number;
  }>();

  if (!channel_url) return c.json({ success: false, error: 'YouTube 채널 URL을 입력해주세요' }, 400);

  const count = growth_count || target_subscribers || 1000;
  if (count < 100) return c.json({ success: false, error: '최소 100명부터 신청 가능합니다' }, 400);

  // 셀러 ID 조회
  const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ? OR username = ?')
    .bind(user.id, user.id).first<{ id: number }>();
  if (!seller) return c.json({ success: false, error: '셀러 정보를 찾을 수 없습니다' }, 403);

  // 중복 신청 체크
  const existing = await DB.prepare(
    "SELECT id FROM youtube_growth_requests WHERE seller_id = ? AND status IN ('pending', 'processing')"
  ).bind(seller.id).first();
  if (existing) return c.json({ success: false, error: '이미 진행 중인 신청이 있습니다' }, 409);

  await DB.prepare(`INSERT INTO youtube_growth_requests (seller_id, channel_url, current_subscribers, target_subscribers)
    VALUES (?, ?, 0, ?)`).bind(seller.id, channel_url, count).run();

  // Notify admins
  createDashboardNotification(
    DB, 'admin', null, 'youtube_growth_request',
    'YouTube 구독자 늘리기 신청',
    `셀러 #${seller.id} - ${channel_url}`,
    '/admin/youtube-growth'
  ).catch(() => {});

  return c.json({ success: true, message: '구독자 늘리기 신청이 완료되었습니다. 관리자 확인 후 처리됩니다.' }, 201);
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
    'SELECT * FROM youtube_growth_requests WHERE seller_id = ? ORDER BY requested_at DESC'
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
    ).catch(() => {});
  }

  return c.json({ success: true, message: '상태가 변경되었습니다' });
});

export { youtubeGrowthRoutes };
