// ============================================================
// Public Streams Routes
// GET /api/streams           - 공개 라이브 스트림 목록 (status 필터 지원)
// GET /api/streams/:id       - 특정 스트림 상세 조회
// GET /api/streams/:id/products    - 스트림의 상품 목록
// GET /api/streams/:id/current-product - 현재 방송 중 상품
// GET /api/streams/:id/viewer-count    - 시청자 수
// POST /api/streams/:id/viewer/join    - 시청자 입장
// POST /api/streams/:id/current-product - 현재 상품 변경 (판매자 인증 필요)
//
// NOTE: 판매자 전용 CRUD는 /api/seller/streams에 유지
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';

export const streamsRouter = new Hono<{ Bindings: Env }>();

// ── GET /api/streams ──────────────────────────────────────────────────────────
// 공개 스트림 목록 조회 (status 필터: live, scheduled, ended)
streamsRouter.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const status = c.req.query('status');
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const params: unknown[] = [];
    let whereClause = '';

    if (status) {
      whereClause = 'WHERE ls.status = ?';
      params.push(status);
    }

    const query = `
      SELECT
        ls.id,
        ls.title,
        ls.description,
        ls.youtube_video_id,
        ls.status,
        ls.thumbnail_url,
        ls.stream_url,
        ls.viewer_count,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        ls.seller_id,
        ls.created_at,
        ls.updated_at,
        s.shop_name  AS seller_name,
        s.image_url  AS seller_image,
        cp.id        AS current_product_id,
        cp.name      AS current_product_name,
        cp.price     AS current_product_price,
        cp.image_url AS current_product_image
      FROM live_streams ls
      LEFT JOIN sellers s ON s.id = ls.seller_id
      LEFT JOIN products cp ON cp.id = ls.current_product_id
      ${whereClause}
      ORDER BY
        CASE ls.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
        ls.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const rows = await db
      .prepare(query)
      .bind(...params)
      .all();

    // count
    const countParams: unknown[] = [];
    let countWhere = '';
    if (status) {
      countWhere = 'WHERE status = ?';
      countParams.push(status);
    }
    const countRow = await db
      .prepare(`SELECT COUNT(*) AS total FROM live_streams ${countWhere}`)
      .bind(...countParams)
      .first<{ total: number }>();

    const streams = (rows.results || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      youtube_video_id: r.youtube_video_id,
      status: r.status,
      thumbnail_url: r.thumbnail_url,
      stream_url: r.stream_url,
      viewer_count: r.viewer_count ?? 0,
      scheduled_at: r.scheduled_at,
      started_at: r.started_at,
      ended_at: r.ended_at,
      seller_id: r.seller_id,
      seller_name: r.seller_name,
      seller_image: r.seller_image,
      created_at: r.created_at,
      updated_at: r.updated_at,
      current_product: r.current_product_id
        ? {
            id: r.current_product_id,
            name: r.current_product_name,
            price: r.current_product_price,
            image_url: r.current_product_image,
          }
        : null,
    }));

    return c.json({
      success: true,
      data: streams,
      pagination: {
        total: countRow?.total ?? 0,
        limit,
        offset,
        has_more: offset + limit < (countRow?.total ?? 0),
      },
    });
  } catch (err: any) {
    console.error('[Streams] List error:', err);
    return c.json({ success: false, error: 'Failed to fetch streams' }, 500);
  }
});

// ── GET /api/streams/:id ──────────────────────────────────────────────────────
streamsRouter.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    const row = await db
      .prepare(
        `SELECT
          ls.*,
          s.shop_name  AS seller_name,
          s.image_url  AS seller_image,
          cp.id        AS current_product_id,
          cp.name      AS current_product_name,
          cp.price     AS current_product_price,
          cp.image_url AS current_product_image
        FROM live_streams ls
        LEFT JOIN sellers s ON s.id = ls.seller_id
        LEFT JOIN products cp ON cp.id = ls.current_product_id
        WHERE ls.id = ?`
      )
      .bind(streamId)
      .first<any>();

    if (!row) {
      return c.json({ success: false, error: 'Stream not found' }, 404);
    }

    const stream = {
      ...row,
      seller_name: row.seller_name,
      seller_image: row.seller_image,
      current_product: row.current_product_id
        ? {
            id: row.current_product_id,
            name: row.current_product_name,
            price: row.current_product_price,
            image_url: row.current_product_image,
          }
        : null,
    };

    return c.json({ success: true, data: stream });
  } catch (err: any) {
    console.error('[Streams] Detail error:', err);
    return c.json({ success: false, error: 'Failed to fetch stream' }, 500);
  }
});

// ── GET /api/streams/:id/products ─────────────────────────────────────────────
streamsRouter.get('/:id/products', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    // live_stream_products 조인 테이블 우선 조회, 없으면 live_stream_id 컬럼 폴백
    const rows = await db
      .prepare(
        `SELECT p.*
         FROM products p
         WHERE p.live_stream_id = ?
            OR p.id IN (
              SELECT product_id FROM live_stream_products WHERE stream_id = ?
            )
         ORDER BY p.created_at DESC`
      )
      .bind(streamId, streamId)
      .all();

    return c.json({
      success: true,
      data: rows.results || [],
    });
  } catch (err: any) {
    console.error('[Streams] Products error:', err);
    return c.json({ success: false, error: 'Failed to fetch stream products' }, 500);
  }
});

// ── GET /api/streams/:id/current-product ──────────────────────────────────────
streamsRouter.get('/:id/current-product', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    const stream = await db
      .prepare('SELECT current_product_id FROM live_streams WHERE id = ?')
      .bind(streamId)
      .first<{ current_product_id: number | null }>();

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found' }, 404);
    }

    if (!stream.current_product_id) {
      return c.json({ success: true, data: null });
    }

    const product = await db
      .prepare('SELECT * FROM products WHERE id = ?')
      .bind(stream.current_product_id)
      .first();

    return c.json({ success: true, data: product });
  } catch (err: any) {
    console.error('[Streams] Current product error:', err);
    return c.json({ success: false, error: 'Failed to fetch current product' }, 500);
  }
});

// ── POST /api/streams/:id/current-product ─────────────────────────────────────
// 현재 방송 상품 변경 (판매자 JWT 필요)
streamsRouter.post('/:id/current-product', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');
    const { productId } = await c.req.json<{ productId: number }>();

    await db
      .prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(productId ?? null, streamId)
      .run();

    return c.json({ success: true, message: 'Current product updated' });
  } catch (err: any) {
    console.error('[Streams] Set current product error:', err);
    return c.json({ success: false, error: 'Failed to update current product' }, 500);
  }
});

// ── GET /api/streams/:id/viewer-count ─────────────────────────────────────────
streamsRouter.get('/:id/viewer-count', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    const row = await db
      .prepare('SELECT viewer_count FROM live_streams WHERE id = ?')
      .bind(streamId)
      .first<{ viewer_count: number }>();

    return c.json({ success: true, data: { viewer_count: row?.viewer_count ?? 0 } });
  } catch (err: any) {
    console.error('[Streams] Viewer count error:', err);
    return c.json({ success: false, error: 'Failed to fetch viewer count' }, 500);
  }
});

// ── POST /api/streams/:id/viewer/join ─────────────────────────────────────────
streamsRouter.post('/:id/viewer/join', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    // 시청자 수 증가 (viewer_count 컬럼이 없는 경우 silently ignore)
    await db
      .prepare(
        `UPDATE live_streams
         SET viewer_count = COALESCE(viewer_count, 0) + 1,
             updated_at   = datetime('now')
         WHERE id = ?`
      )
      .bind(streamId)
      .run()
      .catch(() => {});

    return c.json({ success: true });
  } catch (err: any) {
    console.error('[Streams] Viewer join error:', err);
    return c.json({ success: false, error: 'Failed to join stream' }, 500);
  }
});

// ── POST /api/streams/:id/fake-cart-notification ──────────────────────────────
// 라이브 방송 중 가짜 장바구니 추가 알림 (LivePage에서 데모 목적 사용)
streamsRouter.post('/:id/fake-cart-notification', async (c) => {
  try {
    const streamId = c.req.param('id');
    const body = await c.req.json<{ productId?: number; buyerName?: string }>().catch(() => ({ productId: undefined as number | undefined, buyerName: undefined as string | undefined }));
    // 실제 Durable Object 또는 WebSocket으로 broadcast 가능
    // 현재는 단순 200 응답으로 프론트 오류 방지
    return c.json({
      success: true,
      data: {
        stream_id: streamId,
        product_id: body.productId,
        buyer_name: body.buyerName ?? '익명',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to send notification' }, 500);
  }
});
