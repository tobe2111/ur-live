// ============================================================
// Streams Browse Routes
// GET /  — 공개 스트림 목록
// GET /:id — 특정 스트림 상세
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { cacheGet, buildCacheKey } from '../utils/cache';

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

export const streamsBrowseRouter = new Hono<{ Bindings: Env }>();

// ── GET / ────────────────────────────────────────────────────────────────────
// 공개 스트림 목록 조회 (status 필터: live, scheduled, ended)
streamsBrowseRouter.get('/', async (c) => {
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

// ── GET /:id ─────────────────────────────────────────────────────────────────
streamsBrowseRouter.get('/:id', async (c) => {
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
