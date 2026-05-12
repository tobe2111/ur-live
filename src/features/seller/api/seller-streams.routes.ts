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
import type { KVNamespace } from '@cloudflare/workers-types';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { cacheInvalidate } from '@/worker/utils/cache';

import { swallow } from '@/worker/utils/swallow';
type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  SESSION_KV?: KVNamespace;
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
    const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '10')), 100);
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0'));

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
        youtube_video_id, youtube_broadcast_id, youtube_live_chat_id,
        rtmp_url, rtmp_key, youtube_embed_url,
        thumbnail_url, current_product_id, status,
        scheduled_at, ended_at, created_at, updated_at
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

    // 🛡️ 2026-04-22: YouTube video_id 형식 검증 (11자 영숫자)
    // 이전: 임의 문자열 허용 → 악성 ID 삽입, 타 셀러 영상 도용 가능
    // 수정: YouTube 표준 형식 [a-zA-Z0-9_-]{11} 만 허용
    if (youtube_video_id && !/^[a-zA-Z0-9_-]{11}$/.test(youtube_video_id)) {
      return c.json({
        success: false,
        error: 'YouTube video ID 형식이 올바르지 않습니다 (11자 영숫자)'
      }, 400);
    }
    if (title.length > 200) {
      return c.json({ success: false, error: '제목은 200자 이하여야 합니다' }, 400);
    }
    if (description && description.length > 2000) {
      return c.json({ success: false, error: '설명은 2000자 이하여야 합니다' }, 400);
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

    // 팔로워에게 방송 예고 알림
    try {
      const { notifyFollowers } = await import('../../../lib/notifications');
      notifyFollowers(db, sellerId, 'stream_scheduled',
        `📺 새 라이브 예고!`,
        `${title}`,
        `/live/${result.meta.last_row_id}`
      ).catch(swallow('seller:api:seller-streams'));
    } catch {}

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
    // 🛡️ 2026-05-11 P1-#6: 라이브 자동 캡처 thumbnail 갱신 지원
    if (body.thumbnail !== undefined) {
      updates.push('thumbnail_url = ?');
      values.push(body.thumbnail);
      updates.push('custom_thumbnail_url = ?');
      values.push(body.thumbnail);
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

    // Invalidate cached stream detail (list entries expire within 30s TTL)
    await cacheInvalidate(c.env.SESSION_KV, `stream:${streamId}`);

    // ── 방송 시작 시 구독자에게 알림 발송 ──
    if (body.status === 'live') {
      try {
        // 1. 인앱 알림 + 알림톡 발송 (비동기)
        const notifyUrl = new URL(c.req.url);
        notifyUrl.pathname = `/api/broadcast-notify/send/${streamId}`;
        c.executionCtx?.waitUntil?.(
          fetch(notifyUrl.toString(), { method: 'POST' }).catch(swallow('seller:api:seller-streams'))
        );

        // 2. 카카오톡 메시지 발송 (구독자 중 카카오 토큰 보유자, 무료)
        c.executionCtx?.waitUntil?.(
          (async () => {
            try {
              const { sendKakaoMessageToSubscribers, sendKakaoToFollowers } = await import('../../../lib/notifications');
              const stream = await db.prepare('SELECT title FROM live_streams WHERE id = ?').bind(streamId).first<{ title: string }>();
              const seller = await db.prepare('SELECT name FROM sellers WHERE id = ?').bind(sellerId).first<{ name: string }>();
              const sellerName = seller?.name || '셀러';
              const streamTitle = stream?.title || '';
              // 구독자에게 카카오 메시지
              await sendKakaoMessageToSubscribers(db, Number(streamId), streamTitle, sellerName);
              // 팔로워에게도 카카오 메시지
              await sendKakaoToFollowers(db, Number(sellerId), `🔴 ${sellerName} 라이브 시작!`, streamTitle, `/live/${streamId}`, '시청하기');
            } catch {}
          })()
        );
      } catch {}
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

    // 🛡️ 2026-05-07: HARD DELETE → SOFT DELETE.
    //   매출/시청자 이력 보존 필수. 셀러도 자기 방송 hard-delete 금지.
    try { await db.prepare(`ALTER TABLE live_streams ADD COLUMN deleted_at DATETIME`).run(); } catch { /* exists */ }
    const result = await db.prepare(
      `UPDATE live_streams SET status = 'deleted', ended_at = COALESCE(ended_at, datetime('now')),
       deleted_at = datetime('now') WHERE id = ? AND seller_id = ?`
    ).bind(streamId, sellerId).run();

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

    // Chat messages count
    let chatStats: any = { total_messages: 0, unique_chatters: 0, seller_messages: 0 };
    let chatTimeline: any = { results: [] };
    try {
      chatStats = await db.prepare(`
        SELECT COUNT(*) as total_messages FROM chat_messages WHERE live_stream_id = ?
      `).bind(streamId).first() || chatStats;
    } catch { /* table may not exist */ }

    // Orders from this live stream
    let orderStats: any = { total_orders: 0, total_revenue: 0, unique_buyers: 0, avg_order_value: 0 };
    let ordersTimeline: any = { results: [] };
    try {
      orderStats = await db.prepare(`
        SELECT
          COUNT(*) as total_orders,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COUNT(DISTINCT user_id) as unique_buyers,
          COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders
        WHERE seller_id = ? AND status IN ('paid', 'shipped', 'delivered')
      `).bind(sellerId).first() || orderStats;
    } catch { /* columns may differ */ }

    // Top products
    let topProducts: any = { results: [] };
    try {
      topProducts = await db.prepare(`
        SELECT p.id, p.name, p.image_url, COALESCE(p.sold_count, 0) as total_sold
        FROM products p WHERE p.seller_id = ?
        ORDER BY p.sold_count DESC LIMIT 10
      `).bind(sellerId).all();
    } catch { /* ignore */ }

    // Donation stats
    let donationStats: any = { total_donations: 0, total_donation_amount: 0, unique_donors: 0 };
    try {
      donationStats = await db.prepare(`
        SELECT
          COUNT(*) as total_donations,
          COALESCE(SUM(amount), 0) as total_donation_amount,
          COUNT(DISTINCT donor_user_id) as unique_donors
        FROM donations
        WHERE live_stream_id = ? AND payment_status = 'completed'
      `).bind(streamId).first() || donationStats;
    } catch { /* table/column may differ */ }

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
        (SELECT COUNT(*) FROM orders o WHERE o.live_stream_id = ls.id AND o.status IN ('PAID','DONE')) as order_count,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.live_stream_id = ls.id AND o.status IN ('PAID','DONE')) as revenue
      FROM live_streams ls
      WHERE ls.seller_id = ? AND ls.created_at >= datetime('now', '-' || ? || ' days')
      ORDER BY ls.created_at DESC
    `).bind(sellerId, days).all();

    // Aggregate stats
    const totalStats = await db.prepare(`
      SELECT
        COUNT(DISTINCT ls.id) as total_streams,
        (SELECT COUNT(*) FROM orders o WHERE o.seller_id = ? AND o.status IN ('PAID','DONE') AND o.live_stream_id IS NOT NULL AND o.created_at >= datetime('now', '-' || ? || ' days')) as total_orders,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.seller_id = ? AND o.status IN ('PAID','DONE') AND o.live_stream_id IS NOT NULL AND o.created_at >= datetime('now', '-' || ? || ' days')) as total_revenue,
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

    await cacheInvalidate(c.env.SESSION_KV, `stream:${streamId}`);

    return c.json({ success: true, data: { mode }, message: mode === 'all' ? '전체 상품이 표시됩니다' : '현재 상품만 표시됩니다' });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// ── POST /api/seller/streams/:id/heartbeat — 송출 중 활성 신호 (30분 자동종료 방지) ──
sellerStreamsRoutes.post('/:id/heartbeat', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401);

    const streamId = c.req.param('id');

    const result = await c.env.DB.prepare(
      "UPDATE live_streams SET updated_at = datetime('now') WHERE id = ? AND seller_id = ? AND status = 'live'"
    ).bind(streamId, sellerId).run();

    if (!result.meta.changes) {
      return c.json({ success: false, error: '활성 라이브 아님 또는 권한 없음' }, 404);
    }

    return c.json({ success: true });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// ── POST /api/seller/streams/:id/change-product — 실시간 상품 변경 ──
sellerStreamsRoutes.post('/:id/change-product', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401);

    const streamId = c.req.param('id');
    const { productId } = await c.req.json<{ productId: number }>();

    const stream = await c.env.DB.prepare(
      'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first();

    if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

    // 🛡️ 2026-04-22: 연결할 상품이 본인 상품인지 검증 (다른 셀러 상품 도용 방지)
    if (productId) {
      const product = await c.env.DB.prepare(
        'SELECT seller_id FROM products WHERE id = ?'
      ).bind(productId).first<{ seller_id: number }>();
      if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
      if (product.seller_id !== sellerId) {
        return c.json({ success: false, error: '본인 상품만 연결 가능합니다' }, 403);
      }
    }

    await c.env.DB.prepare(
      "UPDATE live_streams SET current_product_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(productId ?? null, streamId).run();

    // 🛡️ 2026-05-07: 상품 변경 타임스탬프 기록 → Replay chapter 마커 + 시청자 점프
    if (productId) {
      try {
        await c.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS stream_product_timestamps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stream_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            offset_sec INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run()
        const startedRow = await c.env.DB.prepare(
          'SELECT created_at FROM live_streams WHERE id = ?'
        ).bind(streamId).first<{ created_at: string }>()
        const startedMs = startedRow?.created_at ? new Date(startedRow.created_at.replace(' ', 'T') + 'Z').getTime() : Date.now()
        const offsetSec = Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
        await c.env.DB.prepare(`
          INSERT INTO stream_product_timestamps (stream_id, product_id, offset_sec) VALUES (?, ?, ?)
        `).bind(streamId, productId, offsetSec).run()
      } catch (err) {
        if (import.meta.env?.DEV) console.warn('[ProductTimestamp] Skip:', err)
      }
    }

    await cacheInvalidate(c.env.SESSION_KV, `stream:${streamId}`);

    return c.json({ success: true, message: '상품이 변경되었습니다' });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * GET /api/seller/streams/:id/live-stats
 * 라이브 진행 중 실시간 통계 (시청자/채팅/주문/매출)
 */
sellerStreamsRoutes.get('/:id/live-stats', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

    const streamId = c.req.param('id');
    const db = c.env.DB;

    const stream = await db.prepare(
      'SELECT id, current_viewers FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ id: number; current_viewers?: number }>();
    if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404);

    let chatCount = 0;
    try {
      const r = await db.prepare(
        'SELECT COUNT(*) as c FROM chat_messages WHERE live_stream_id = ?'
      ).bind(streamId).first<{ c: number }>();
      chatCount = r?.c || 0;
    } catch { /* table may not exist */ }

    let orderCount = 0;
    let revenue = 0;
    try {
      const r = await db.prepare(`
        SELECT COUNT(*) as c, COALESCE(SUM(total_amount), 0) as r
        FROM orders
        WHERE live_stream_id = ? AND status IN ('PAID','DONE','SHIPPING','DELIVERED')
      `).bind(streamId).first<{ c: number; r: number }>();
      orderCount = r?.c || 0;
      revenue = r?.r || 0;
    } catch { /* columns may differ */ }

    return c.json({
      success: true,
      data: {
        viewer_count: stream.current_viewers || 0,
        chat_count: chatCount,
        order_count: orderCount,
        revenue,
      }
    });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});
