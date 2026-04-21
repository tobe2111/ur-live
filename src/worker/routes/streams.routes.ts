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
import { cacheGet, cacheInvalidate, buildCacheKey } from '../utils/cache';

interface StreamListRow {
  id: number;
  title: string;
  description: string | null;
  youtube_video_id: string | null;
  status: string;
  thumbnail_url: string | null;
  viewer_count: number | null;
  scheduled_at: string | null;
  ended_at: string | null;
  seller_id: number;
  created_at: string;
  updated_at: string;
  seller_name: string | null;
  seller_image: string | null;
  current_product_id: number | null;
  current_product_name: string | null;
  current_product_price: number | null;
  current_product_original_price: number | null;
  current_product_discount_rate: number | null;
  current_product_image: string | null;
  current_product_image_url: string | null;
  current_product_stock_quantity: number | null;
  current_product_description: string | null;
}

interface StreamDetailRow {
  id: number;
  title: string;
  description: string | null;
  youtube_video_id: string | null;
  status: string;
  thumbnail_url: string | null;
  viewer_count: number | null;
  scheduled_at: string | null;
  ended_at: string | null;
  seller_id: number;
  current_product_id: number | null;
  created_at: string;
  updated_at: string;
  seller_name: string | null;
  seller_image: string | null;
  current_product_name: string | null;
  current_product_price: number | null;
  current_product_image: string | null;
}

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  discount_rate: number | null;
  image_url: string | null;
  thumbnail_url: string | null;
  stock: number | null;
  stock_quantity: number | null;
  category: string | null;
  seller_id: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export const streamsRouter = new Hono<{ Bindings: Env }>();

// ── GET /api/streams ──────────────────────────────────────────────────────────
// 공개 스트림 목록 조회 (status 필터: live, scheduled, ended)
streamsRouter.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const status = c.req.query('status');
    const sellerId = c.req.query('seller_id');
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Short-TTL cache — streams are hot but must feel near-real-time.
    // Don't cache seller-scoped queries (too much cardinality, cooler path).
    const cacheable = !sellerId;
    const cacheKey = buildCacheKey('streams', {
      status: status ?? 'all',
      limit,
      offset,
    });

    const computeListPayload = async () => {
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (status) {
        conditions.push('ls.status = ?');
        params.push(status);
      }
      if (sellerId) {
        conditions.push('ls.seller_id = ?');
        params.push(sellerId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT
          ls.id,
          ls.title,
          ls.description,
          ls.youtube_video_id,
          ls.status,
          ls.seller_id,
          ls.created_at,
          ls.updated_at,
          ls.scheduled_at,
          ls.seller_instagram,
          ls.seller_youtube,
          s.name             AS seller_name,
          cp.id              AS current_product_id,
          cp.name            AS current_product_name,
          cp.price           AS current_product_price,
          cp.original_price  AS current_product_original_price,
          cp.discount_rate   AS current_product_discount_rate,
          cp.image_url       AS current_product_image_url,
          cp.stock           AS current_product_stock,
          cp.description     AS current_product_description
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

      const streams = ((rows.results as unknown as StreamListRow[]) || []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        youtube_video_id: r.youtube_video_id,
        status: r.status,
        thumbnail_url: r.thumbnail_url,
        viewer_count: r.viewer_count ?? 0,
        scheduled_at: r.scheduled_at,
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
              original_price: r.current_product_original_price,
              discount_rate: r.current_product_discount_rate,
              thumbnail_url: r.current_product_image,
              image_url: r.current_product_image_url || r.current_product_image,
              stock_quantity: r.current_product_stock_quantity,
              description: r.current_product_description,
            }
          : null,
      }));

      return {
        data: streams,
        pagination: {
          total: countRow?.total ?? 0,
          limit,
          offset,
          has_more: offset + limit < (countRow?.total ?? 0),
        },
      };
    };

    const payload = cacheable
      ? await cacheGet(c.env.SESSION_KV, cacheKey, computeListPayload, {
          ttl: 30,
          staleWhileRevalidate: 30,
        })
      : await computeListPayload();

    return c.json({ success: true, ...payload });
  } catch (err: unknown) {
    console.error('[Streams] List error:', err);
    // ✅ Security: only expose raw error details in DEV — never leak stack
    //    traces / SQL fragments to clients in production.
    const isDev = (() => {
      try { return !!import.meta.env?.DEV; } catch { return false; }
    })();
    const body: Record<string, unknown> = {
      success: false,
      error: '스트림 목록을 불러오지 못했습니다.',
    };
    if (isDev) {
      body.details = err instanceof Error ? err.message : String(err);
      body.stack = err instanceof Error ? err.stack : undefined;
    }
    return c.json(body, 500);
  }
});

// ── GET /api/streams/:id ──────────────────────────────────────────────────────
streamsRouter.get('/:id', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    const stream = await cacheGet(
      c.env.SESSION_KV,
      `stream:${streamId}`,
      async () => {
        const row = await db
          .prepare(
            `SELECT
              ls.*,
              s.name       AS seller_name,
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
          .first<StreamDetailRow>();

        if (!row) return null;
        return {
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
      },
      { ttl: 30, staleWhileRevalidate: 30 }
    );

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found' }, 404);
    }

    return c.json({ success: true, data: stream });
  } catch (err: unknown) {
    console.error('[Streams] Detail error:', err);
    return c.json({ success: false, error: 'Failed to fetch stream' }, 500);
  }
});

// ── GET /api/streams/:id/products ─────────────────────────────────────────────
streamsRouter.get('/:id/products', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    // ✅ products 테이블에서 live_stream_id로 조회
    const rows = await db
      .prepare(`
        SELECT
          id, name, description, price, original_price, discount_rate,
          image_url, stock,
          category, seller_id, is_active, created_at, updated_at
        FROM products
        WHERE live_stream_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `)
      .bind(streamId)
      .all();

    let products = rows.results || [];

    // ✅ live_stream_id로 연결된 상품이 없으면 current_product_id 상품을 fallback으로 반환
    if (products.length === 0) {
      const stream = await db
        .prepare('SELECT current_product_id FROM live_streams WHERE id = ?')
        .bind(streamId)
        .first<{ current_product_id: number | null }>();

      if (stream?.current_product_id) {
        const fallbackProduct = await db
          .prepare(`
            SELECT
              id, name, description, price, original_price, discount_rate,
              image_url, stock,
              category, seller_id, is_active, created_at, updated_at
            FROM products WHERE id = ?
          `)
          .bind(stream.current_product_id)
          .first<ProductRow>();

        if (fallbackProduct) {
          products = [fallbackProduct as unknown as Record<string, unknown>];
        }
      }
    }

    return c.json({
      success: true,
      data: products
    });
  } catch (err: unknown) {
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
  } catch (err: unknown) {
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

    // Invalidate cached stream detail (list entries will expire naturally within TTL)
    await cacheInvalidate(c.env.SESSION_KV, `stream:${streamId}`);

    return c.json({ success: true, message: 'Current product updated' });
  } catch (err: unknown) {
    console.error('[Streams] Set current product error:', err);
    return c.json({ success: false, error: 'Failed to update current product' }, 500);
  }
});

// ── GET /api/streams/:id/viewer-count ─────────────────────────────────────────
streamsRouter.get('/:id/viewer-count', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    // viewer_count 컬럼이 없을 수 있으므로 안전하게 조회
    let viewerCount = 0;
    try {
      const row = await db
        .prepare('SELECT viewer_count FROM live_streams WHERE id = ?')
        .bind(streamId)
        .first<{ viewer_count: number }>();
      viewerCount = row?.viewer_count ?? 0;
    } catch {
      // viewer_count 컬럼 없음 — 0 반환
    }

    return c.json({ success: true, data: { viewer_count: viewerCount } });
  } catch (err: unknown) {
    console.error('[Streams] Viewer count error:', err);
    return c.json({ success: false, error: 'Failed to fetch viewer count' }, 500);
  }
});

// ── PUT /api/streams/:id/viewer-count (셀러 수동 설정) ────────────────────────
streamsRouter.put('/:id/viewer-count', async (c) => {
  try {
    const streamId = c.req.param('id');
    const { manual_count } = await c.req.json<{ manual_count: number | null }>();

    if (manual_count !== null) {
      await c.env.DB.prepare(
        "UPDATE live_streams SET current_viewers = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(manual_count, streamId).run();
    }

    return c.json({ success: true });
  } catch (err: unknown) {
    return c.json({ success: false, error: 'Failed to update viewer count' }, 500);
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
         SET current_viewers = COALESCE(current_viewers, 0) + 1,
             updated_at   = datetime('now')
         WHERE id = ?`
      )
      .bind(streamId)
      .run()
      .catch(() => {});

    return c.json({ success: true });
  } catch (err: unknown) {
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
  } catch (err: unknown) {
    return c.json({ success: false, error: 'Failed to send notification' }, 500);
  }
});
