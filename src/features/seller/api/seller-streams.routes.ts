/**
 * Seller Streams API Routes
 * 
 * Endpoints:
 * - GET /api/seller/streams - 셀러의 라이브 스트림 목록 조회
 * - GET /api/seller/streams/:id - 특정 스트림 상세 조회
 * - POST /api/seller/streams - 새 스트림 생성
 * - PUT /api/seller/streams/:id - 스트림 정보 수정
 * - DELETE /api/seller/streams/:id - 스트림 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { ALLOWED_ORIGINS } from '@/shared/constants';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

type StreamCreateRequest = {
  title: string;
  description?: string;
  thumbnail?: string;
  youtube_video_id?: string;
};

type StreamUpdateRequest = {
  title?: string;
  description?: string;
  thumbnail?: string;
  youtube_video_id?: string;
  status?: 'scheduled' | 'live' | 'ended';
};

export const sellerStreamsRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
sellerStreamsRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

/**
 * JWT 토큰에서 셀러 ID 추출
 */
async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authorization.substring(7);
    const payload = await verify(token, jwtSecret, 'HS256') as JWTPayload & { seller_id?: number };
    return payload.seller_id || null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * GET /api/seller/streams
 * 셀러의 모든 스트림 조회
 */
sellerStreamsRoutes.get('/', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: '로그인이 필요합니다'
      }, 401);
    }

    const db = c.env.DB;
    
    // Query parameters for filtering
    const status = c.req.query('status'); // 'scheduled', 'live', 'ended'
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = `
      SELECT
        id, seller_id, title, description,
        youtube_video_id, status,
        ended_at, created_at, updated_at
      FROM live_streams
      WHERE seller_id = ?
    `;
    const params: (string | number)[] = [sellerId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const streams = await db.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM live_streams WHERE seller_id = ?`;
    const countParams: (string | number)[] = [sellerId];
    
    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    return c.json({
      success: true,
      streams: streams.results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        has_more: (offset + limit) < (countResult?.total || 0)
      }
    });

  } catch (error: unknown) {
    console.error('Get seller streams error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to get streams'
    }, 500);
  }
});

/**
 * GET /api/seller/streams/:id
 * 특정 스트림 상세 조회
 */
sellerStreamsRoutes.get('/:id', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: '로그인이 필요합니다'
      }, 401);
    }

    const streamId = c.req.param('id');
    const db = c.env.DB;

    const stream = await db.prepare(`
      SELECT
        id, seller_id, title, description,
        youtube_video_id, status,
        ended_at, created_at, updated_at
      FROM live_streams
      WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first<Record<string, unknown>>();

    if (!stream) {
      return c.json({
        success: false,
        error: 'Stream not found'
      }, 404);
    }

    return c.json({
      success: true,
      stream
    });

  } catch (error: unknown) {
    console.error('Get stream error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to get stream'
    }, 500);
  }
});

/**
 * POST /api/seller/streams
 * 새 스트림 생성
 */
sellerStreamsRoutes.post('/', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: '로그인이 필요합니다'
      }, 401);
    }

    const body = await c.req.json<StreamCreateRequest>();
    const { title, description, thumbnail, youtube_video_id } = body;

    // 필수 필드 검증
    if (!title) {
      return c.json({
        success: false,
        error: 'Title is required'
      }, 400);
    }

    const db = c.env.DB;

    const result = await db.prepare(`
      INSERT INTO live_streams (
        seller_id, title, description, youtube_video_id,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'scheduled', datetime('now'), datetime('now'))
    `).bind(
      sellerId,
      title,
      description || null,
      youtube_video_id || ''
    ).run();

    if (!result.success) {
      throw new Error('Failed to create stream');
    }

    // 생성된 스트림 조회
    const newStream = await db.prepare(`
      SELECT
        id, seller_id, title, description,
        youtube_video_id, status,
        ended_at, created_at, updated_at
      FROM live_streams
      WHERE id = ?
    `).bind(result.meta.last_row_id).first<Record<string, unknown>>();

    return c.json({
      success: true,
      message: 'Stream created successfully',
      stream: newStream
    }, 201);

  } catch (error: unknown) {
    console.error('Create stream error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to create stream'
    }, 500);
  }
});

/**
 * PUT /api/seller/streams/:id
 * 스트림 정보 수정
 */
sellerStreamsRoutes.put('/:id', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: '로그인이 필요합니다'
      }, 401);
    }

    const streamId = c.req.param('id');
    const body = await c.req.json<StreamUpdateRequest>();
    
    const db = c.env.DB;

    // 스트림이 해당 셀러의 것인지 확인
    const stream = await db.prepare('SELECT id FROM live_streams WHERE id = ? AND seller_id = ?')
      .bind(streamId, sellerId).first<{ id: number }>();

    if (!stream) {
      return c.json({
        success: false,
        error: 'Stream not found'
      }, 404);
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    // 업데이트 가능한 필드들
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.youtube_video_id !== undefined) {
      updates.push('youtube_video_id = ?');
      values.push(body.youtube_video_id);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
      if (body.status === 'ended') {
        updates.push("ended_at = datetime('now')");
      }
    }

    if (updates.length === 0) {
      return c.json({
        success: false,
        error: 'No fields to update'
      }, 400);
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(streamId, sellerId);

    const result = await db.prepare(`
      UPDATE live_streams
      SET ${updates.join(', ')}
      WHERE id = ? AND seller_id = ?
    `).bind(...values).run();

    if (!result.success) {
      throw new Error('Failed to update stream');
    }

    // 업데이트된 스트림 조회
    const updatedStream = await db.prepare(`
      SELECT
        id, seller_id, title, description,
        youtube_video_id, status,
        ended_at, created_at, updated_at
      FROM live_streams
      WHERE id = ?
    `).bind(streamId).first<Record<string, unknown>>();

    return c.json({
      success: true,
      message: 'Stream updated successfully',
      stream: updatedStream
    });

  } catch (error: unknown) {
    console.error('Update stream error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to update stream'
    }, 500);
  }
});

/**
 * DELETE /api/seller/streams/:id
 * 스트림 삭제
 */
sellerStreamsRoutes.delete('/:id', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: '로그인이 필요합니다'
      }, 401);
    }

    const streamId = c.req.param('id');
    const db = c.env.DB;

    // 스트림이 해당 셀러의 것인지 확인
    const stream = await db.prepare('SELECT id FROM live_streams WHERE id = ? AND seller_id = ?')
      .bind(streamId, sellerId).first<{ id: number }>();

    if (!stream) {
      return c.json({
        success: false,
        error: 'Stream not found'
      }, 404);
    }

    const result = await db.prepare('DELETE FROM live_streams WHERE id = ? AND seller_id = ?')
      .bind(streamId, sellerId).run();

    if (!result.success) {
      throw new Error('Failed to delete stream');
    }

    return c.json({
      success: true,
      message: 'Stream deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Delete stream error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to delete stream'
    }, 500);
  }
});

// ============================================================
// Live Analytics Endpoints
// ============================================================

/**
 * GET /api/seller/streams/:id/analytics
 * 특정 라이브 스트림의 실시간 분석 데이터
 */
sellerStreamsRoutes.get('/:id/analytics', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    }

    const streamId = c.req.param('id');
    const db = c.env.DB;

    // Verify stream belongs to seller
    const stream = await db.prepare(
      'SELECT id, title, status, youtube_video_id, created_at, updated_at FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<any>();

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found' }, 404);
    }

    // Chat messages count (total + per-minute breakdown)
    const chatStats = await db.prepare(`
      SELECT
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_chatters,
        SUM(CASE WHEN is_seller = 1 THEN 1 ELSE 0 END) as seller_messages
      FROM chat_messages
      WHERE live_stream_id = ? AND is_deleted = 0
    `).bind(streamId).first<any>();

    // Chat messages per minute (for timeline chart)
    const chatTimeline = await db.prepare(`
      SELECT
        strftime('%H:%M', created_at) as minute,
        COUNT(*) as count
      FROM chat_messages
      WHERE live_stream_id = ? AND is_deleted = 0
      GROUP BY strftime('%Y-%m-%d %H:%M', created_at)
      ORDER BY created_at ASC
    `).bind(streamId).all();

    // Orders from this live stream
    const orderStats = await db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(DISTINCT user_id) as unique_buyers,
        COALESCE(AVG(total_amount), 0) as avg_order_value
      FROM orders
      WHERE live_stream_id = ? AND payment_status = 'approved'
    `).bind(streamId).first<any>();

    // Orders timeline (per minute)
    const ordersTimeline = await db.prepare(`
      SELECT
        strftime('%H:%M', created_at) as minute,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE live_stream_id = ? AND payment_status = 'approved'
      GROUP BY strftime('%Y-%m-%d %H:%M', created_at)
      ORDER BY created_at ASC
    `).bind(streamId).all();

    // Top products sold during this stream
    const topProducts = await db.prepare(`
      SELECT
        p.id, p.name, p.image_url,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.live_stream_id = ? AND o.payment_status = 'approved'
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT 10
    `).bind(streamId).all();

    // Donation stats for this stream
    const donationStats = await db.prepare(`
      SELECT
        COUNT(*) as total_donations,
        COALESCE(SUM(amount), 0) as total_donation_amount,
        COUNT(DISTINCT user_id) as unique_donors
      FROM donations
      WHERE live_stream_id = ? AND status = 'completed'
    `).bind(streamId).first<any>();

    // Viewer analytics from live_stream_views
    let viewStats: any = { total_views: 0, unique_viewers: 0, avg_watch_time: 0, total_watch_time: 0 };
    try {
      viewStats = await db.prepare(`
        SELECT
          COUNT(*) as total_views,
          COUNT(DISTINCT user_id) as unique_viewers,
          COALESCE(AVG(watch_duration), 0) as avg_watch_time,
          COALESCE(SUM(watch_duration), 0) as total_watch_time
        FROM live_stream_views
        WHERE live_stream_id = ?
      `).bind(streamId).first<any>();
    } catch {
      // Table may not exist yet
    }

    return c.json({
      success: true,
      data: {
        stream,
        views: viewStats,
        chat: {
          total_messages: chatStats?.total_messages || 0,
          unique_chatters: chatStats?.unique_chatters || 0,
          seller_messages: chatStats?.seller_messages || 0,
          timeline: chatTimeline.results || [],
        },
        orders: {
          total_orders: orderStats?.total_orders || 0,
          total_revenue: orderStats?.total_revenue || 0,
          unique_buyers: orderStats?.unique_buyers || 0,
          avg_order_value: Math.round(orderStats?.avg_order_value || 0),
          timeline: ordersTimeline.results || [],
        },
        top_products: topProducts.results || [],
        donations: {
          total_donations: donationStats?.total_donations || 0,
          total_amount: donationStats?.total_donation_amount || 0,
          unique_donors: donationStats?.unique_donors || 0,
        },
      },
    });
  } catch (error: unknown) {
    console.error('Stream analytics error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * GET /api/seller/streams/analytics/summary
 * 셀러의 전체 라이브 방송 분석 요약
 */
sellerStreamsRoutes.get('/analytics/summary', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    }

    const db = c.env.DB;
    const period = c.req.query('period') || '30d';
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    // All streams for this seller in the period
    const streams = await db.prepare(`
      SELECT
        ls.id, ls.title, ls.status, ls.youtube_video_id, ls.created_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.live_stream_id = ls.id AND cm.is_deleted = 0) as chat_count,
        (SELECT COUNT(*) FROM orders o WHERE o.live_stream_id = ls.id AND o.payment_status = 'approved') as order_count,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.live_stream_id = ls.id AND o.payment_status = 'approved') as revenue
      FROM live_streams ls
      WHERE ls.seller_id = ? AND ls.created_at >= datetime('now', '-' || ? || ' days')
      ORDER BY ls.created_at DESC
    `).bind(sellerId, days).all();

    // Aggregate stats
    const totalStats = await db.prepare(`
      SELECT
        COUNT(DISTINCT ls.id) as total_streams,
        (SELECT COUNT(*) FROM orders o WHERE o.seller_id = ? AND o.payment_status = 'approved' AND o.live_stream_id IS NOT NULL AND o.created_at >= datetime('now', '-' || ? || ' days')) as total_orders,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.seller_id = ? AND o.payment_status = 'approved' AND o.live_stream_id IS NOT NULL AND o.created_at >= datetime('now', '-' || ? || ' days')) as total_revenue,
        (SELECT COUNT(*) FROM chat_messages cm JOIN live_streams ls2 ON ls2.id = cm.live_stream_id WHERE ls2.seller_id = ? AND cm.is_deleted = 0 AND cm.created_at >= datetime('now', '-' || ? || ' days')) as total_chats
      FROM live_streams ls
      WHERE ls.seller_id = ? AND ls.created_at >= datetime('now', '-' || ? || ' days')
    `).bind(sellerId, days, sellerId, days, sellerId, days, sellerId, days).first<any>();

    return c.json({
      success: true,
      data: {
        period,
        stats: {
          total_streams: totalStats?.total_streams || 0,
          total_orders: totalStats?.total_orders || 0,
          total_revenue: totalStats?.total_revenue || 0,
          total_chats: totalStats?.total_chats || 0,
          avg_revenue_per_stream: totalStats?.total_streams > 0
            ? Math.round((totalStats?.total_revenue || 0) / totalStats.total_streams)
            : 0,
        },
        streams: streams.results || [],
      },
    });
  } catch (error: unknown) {
    console.error('Analytics summary error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// ── PUT /api/seller/streams/:id/product-display — 상품 표시 모드 변경 ──
sellerStreamsRoutes.put('/:id/product-display', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401);

    const streamId = c.req.param('id');
    const { mode } = await c.req.json<{ mode: 'current_only' | 'all' }>();

    if (!mode || !['current_only', 'all'].includes(mode)) {
      return c.json({ success: false, error: "mode는 'current_only' 또는 'all'이어야 합니다" }, 400);
    }

    // 소유권 확인
    const stream = await c.env.DB.prepare(
      'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first();

    if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

    await c.env.DB.prepare(
      "UPDATE live_streams SET product_display_mode = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(mode, streamId).run();

    return c.json({ success: true, data: { mode }, message: mode === 'all' ? '전체 상품이 표시됩니다' : '현재 상품만 표시됩니다' });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});
