/**
 * Admin Moderation Routes — 리뷰 관리 + 라이브 모니터
 *
 * 🛡️ 2026-04-22 배치 153 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트 (리뷰 관리):
 * - GET    /reviews/list          — 리뷰 목록 (페이지네이션 + 필터)
 * - PATCH  /reviews/:id/visibility — 리뷰 숨김/표시
 * - DELETE /reviews/:id           — 리뷰 삭제
 * - GET    /reviews/stats         — 리뷰 통계
 *
 * 엔드포인트 (라이브 모니터):
 * - GET    /live-monitor          — 진행중 라이브 목록
 * - PATCH  /live-monitor/:id/end  — 라이브 강제 종료
 * - GET    /live-monitor/history  — 종료된 라이브 이력
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { writeAuditLog } from '@/worker/middleware/admin-security';

export const adminModerationRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface CountRow { count: number }
interface ReviewRow {
  id: number;
  product_id: number;
  user_id: string;
  user_name: string | null;
  rating: number;
  content: string | null;
  image_urls: string | null;
  is_visible: number;
  created_at: string;
  product_name?: string;
}
interface ReviewStatsRow {
  total: number; avg_rating: number; hidden_count: number;
  rating_1: number; rating_2: number; rating_3: number; rating_4: number; rating_5: number;
}
interface LiveStreamRow {
  id: number; seller_id: number; seller_name: string | null;
  title: string | null; status: string;
  youtube_video_id: string | null; viewer_count: number;
  current_product_id: number | null; current_product_name: string | null;
  created_at: string;
}
interface StreamHistoryRow {
  id: number; seller_id: number; seller_name: string | null;
  title: string | null; status: string;
  youtube_video_id: string | null; viewer_count: number;
  peak_viewers: number | null;
  created_at: string; ended_at: string | null;
  duration_minutes: number | null;
}

// ─── 리뷰 관리 ─────────────────────────────────────────────────

adminModerationRoutes.get('/reviews/list', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
    const offset = (page - 1) * limit;
    const status = c.req.query('status') || 'all';
    const productId = c.req.query('product_id');
    const rating = c.req.query('rating');
    const sort = c.req.query('sort') || 'newest';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status === 'visible') { conditions.push('r.is_visible = 1'); }
    else if (status === 'hidden') { conditions.push('r.is_visible = 0'); }

    if (productId) { conditions.push('r.product_id = ?'); params.push(productId); }
    if (rating) { conditions.push('r.rating = ?'); params.push(parseInt(rating)); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy: string;
    switch (sort) {
      case 'oldest': orderBy = 'r.created_at ASC'; break;
      case 'rating_high': orderBy = 'r.rating DESC, r.created_at DESC'; break;
      case 'rating_low': orderBy = 'r.rating ASC, r.created_at DESC'; break;
      default: orderBy = 'r.created_at DESC';
    }

    const countRows = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM reviews r ${where}`, params
    );
    const total = countRows[0]?.count || 0;

    const reviews = await executeQuery<ReviewRow>(DB,
      `SELECT r.id, r.product_id, r.user_id, r.user_name, r.rating, r.content,
              r.image_urls, r.is_visible, r.created_at,
              p.name as product_name
       FROM reviews r
       LEFT JOIN products p ON p.id = r.product_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return c.json({
      success: true,
      data: reviews,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] reviews/list error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminModerationRoutes.patch('/reviews/:id/visibility', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const reviewId = c.req.param('id');
    const { is_visible } = await c.req.json<{ is_visible: 0 | 1 }>();

    if (![0, 1].includes(is_visible)) {
      return c.json({ success: false, error: 'is_visible must be 0 or 1' }, 400);
    }

    const rows = await executeQuery<{ id: number; is_visible: number }>(DB,
      `SELECT id, is_visible FROM reviews WHERE id = ?`, [reviewId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '리뷰를 찾을 수 없습니다' }, 404);
    }

    await executeRun(DB, `UPDATE reviews SET is_visible = ? WHERE id = ?`, [is_visible, reviewId]);

    await writeAuditLog(c, {
      action: is_visible ? 'show_review' : 'hide_review',
      targetType: 'review',
      targetId: reviewId,
      before: { is_visible: rows[0].is_visible },
      after: { is_visible }
    });

    return c.json({ success: true, message: is_visible ? '리뷰가 표시되었습니다' : '리뷰가 숨겨졌습니다' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] review visibility error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminModerationRoutes.delete('/reviews/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const reviewId = c.req.param('id');

    const rows = await executeQuery<ReviewRow>(DB,
      `SELECT id, product_id, user_id, user_name, rating, content, image_urls, is_visible, created_at
       FROM reviews WHERE id = ?`, [reviewId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '리뷰를 찾을 수 없습니다' }, 404);
    }

    await executeRun(DB, `DELETE FROM reviews WHERE id = ?`, [reviewId]);

    await writeAuditLog(c, {
      action: 'delete_review',
      targetType: 'review',
      targetId: reviewId,
      before: { product_id: rows[0].product_id, user_id: rows[0].user_id, rating: rows[0].rating, content: rows[0].content }
    });

    return c.json({ success: true, message: '리뷰가 삭제되었습니다' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] delete review error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminModerationRoutes.get('/reviews/stats', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    const stats = await executeQuery<ReviewStatsRow>(DB,
      `SELECT
        COUNT(*) as total,
        COALESCE(AVG(rating), 0) as avg_rating,
        SUM(CASE WHEN is_visible = 0 THEN 1 ELSE 0 END) as hidden_count,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5
       FROM reviews`
    );

    return c.json({ success: true, data: stats[0] || { total: 0, avg_rating: 0, hidden_count: 0, rating_1: 0, rating_2: 0, rating_3: 0, rating_4: 0, rating_5: 0 } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] reviews/stats error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── 라이브 모니터 ─────────────────────────────────────────────

adminModerationRoutes.get('/live-monitor', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    const streams = await executeQuery<LiveStreamRow>(DB,
      `SELECT ls.id, ls.seller_id,
              s.name as seller_name,
              ls.title, ls.status,
              ls.youtube_video_id,
              COALESCE(ls.viewer_count, 0) as viewer_count,
              ls.current_product_id,
              p.name as current_product_name,
              ls.created_at
       FROM live_streams ls
       LEFT JOIN sellers s ON s.id = ls.seller_id
       LEFT JOIN products p ON p.id = ls.current_product_id
       WHERE ls.status = 'live'
       ORDER BY ls.created_at DESC`
    );

    return c.json({ success: true, data: streams });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] live-monitor error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminModerationRoutes.patch('/live-monitor/:id/end', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const streamId = c.req.param('id');

    const rows = await executeQuery<{ id: number; status: string; seller_id: number }>(DB,
      `SELECT id, status, seller_id FROM live_streams WHERE id = ?`, [streamId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);
    }
    if (rows[0].status === 'ended') {
      return c.json({ success: false, error: '이미 종료된 스트림입니다' }, 400);
    }

    await executeRun(DB,
      `UPDATE live_streams SET status = 'ended', ended_at = datetime('now') WHERE id = ?`,
      [streamId]
    );

    await writeAuditLog(c, {
      action: 'force_end_stream',
      targetType: 'live_stream',
      targetId: streamId,
      before: { status: rows[0].status },
      after: { status: 'ended' }
    });

    return c.json({ success: true, message: '스트림이 강제 종료되었습니다' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] live-monitor end error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminModerationRoutes.get('/live-monitor/history', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const days = Math.min(90, Math.max(1, parseInt(c.req.query('days') || '7')));

    const streams = await executeQuery<StreamHistoryRow>(DB,
      `SELECT ls.id, ls.seller_id,
              s.name as seller_name,
              ls.title, ls.status,
              ls.youtube_video_id,
              COALESCE(ls.viewer_count, 0) as viewer_count,
              ls.peak_viewers,
              ls.created_at,
              ls.ended_at,
              CASE
                WHEN ls.ended_at IS NOT NULL
                THEN CAST((julianday(ls.ended_at) - julianday(ls.created_at)) * 24 * 60 AS INTEGER)
                ELSE NULL
              END as duration_minutes
       FROM live_streams ls
       LEFT JOIN sellers s ON s.id = ls.seller_id
       WHERE ls.status = 'ended'
         AND ls.created_at >= datetime('now', '-' || ? || ' days')
       ORDER BY ls.created_at DESC`,
      [days]
    );

    return c.json({ success: true, data: streams });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] live-monitor/history error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminModerationRoutes;
