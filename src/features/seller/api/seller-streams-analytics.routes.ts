/**
 * Seller Streams Analytics Routes
 *
 * - GET /:id/analytics    — 특정 스트림 실시간 분석 데이터
 * - GET /analytics/summary — 셀러 전체 라이브 방송 분석 요약
 * - GET /:id/live-stats   — 라이브 진행 중 실시간 통계
 */

import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { getSellerIdFromToken } from './seller-streams-helpers';
import { logError } from '@/worker/utils/logger';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  SESSION_KV?: KVNamespace;
};

export const sellerStreamsAnalyticsRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /analytics/summary
 * 셀러의 전체 라이브 방송 분석 요약
 *
 * NOTE: This route MUST be registered before /:id/analytics so that
 * the literal path segment "analytics" is not treated as an :id param.
 */
sellerStreamsAnalyticsRoutes.get('/analytics/summary', async (c) => {
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
    logError('seller.streams.analytics.summary.error', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * GET /:id/analytics
 * 특정 라이브 스트림의 실시간 분석 데이터
 */
sellerStreamsAnalyticsRoutes.get('/:id/analytics', async (c) => {
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
    const chatTimeline: any = { results: [] };
    try {
      chatStats = await db.prepare(`
        SELECT COUNT(*) as total_messages FROM chat_messages WHERE live_stream_id = ?
      `).bind(streamId).first() || chatStats;
    } catch { /* table may not exist */ }

    // Orders from this live stream
    let orderStats: any = { total_orders: 0, total_revenue: 0, unique_buyers: 0, avg_order_value: 0 };
    const ordersTimeline: any = { results: [] };
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
    logError('seller.streams.analytics.detail.error', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * GET /:id/live-stats
 * 라이브 진행 중 실시간 통계 (시청자/채팅/주문/매출)
 */
sellerStreamsAnalyticsRoutes.get('/:id/live-stats', async (c) => {
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
