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
import { swallow } from '../utils/swallow';

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

      // 🛡️ 2026-05-07: 연습 모드 ([연습] prefix) 시청자 피드 미노출
      //   sellerId 필터가 없는 공용 피드에만 적용 — 셀러 본인 조회는 그대로
      if (!sellerId) {
        conditions.push("(ls.title NOT LIKE '[연습]%' OR ls.title IS NULL)");
      }

      if (status) {
        conditions.push('ls.status = ?');
        params.push(status);
      }
      if (sellerId) {
        conditions.push('ls.seller_id = ?');
        params.push(sellerId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 🛡️ 2026-05-05: 셀러 등급별 exposure_weight 반영 — diamond=4×, gold=2.5×, silver=1.5×, bronze=1×, new=0.7×
      // status priority 가 1순위, 그 다음 가중치 × recency.
      // 🛡️ 2026-05-06: migration 0244 (sellers.tier/exposure_weight) 미적용 환경 fallback.
      const buildQuery = (withTier: boolean) => `
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
          ${withTier ? 's.tier             AS seller_tier,' : "NULL              AS seller_tier,"}
          ${withTier ? 'COALESCE(s.exposure_weight, 1.0) AS exposure_weight,' : '1.0               AS exposure_weight,'}
          ${withTier ? 'COALESCE(s.base_shipping_fee, s.shipping_fee, 3000) AS seller_shipping_fee,' : '3000              AS seller_shipping_fee,'}
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
          ${withTier
            ? `(COALESCE(s.exposure_weight, 1.0) *
                (1.0 / (1 + (julianday('now') - julianday(ls.created_at)) * 0.5))
              ) DESC,`
            : ''}
          ls.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);

      let rows: D1Result<Record<string, unknown>>;
      try {
        rows = await db
          .prepare(buildQuery(true))
          .bind(...params)
          .all();
      } catch (e) {
        // sellers.tier / exposure_weight 컬럼 미존재 (migration 0244 미적용) 시 fallback
        console.warn('[Streams] tier columns missing, falling back:', e instanceof Error ? e.message : e);
        rows = await db
          .prepare(buildQuery(false))
          .bind(...params)
          .all();
      }

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
        seller_shipping_fee: (r as any).seller_shipping_fee ?? 3000,
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

// ── GET /api/streams/:id/product-timestamps ──────────────────────────────────
// 🛡️ 2026-05-07: Replay chapter 마커 — 시청자가 상품별 점프 가능
streamsRouter.get('/:id/product-timestamps', async (c) => {
  try {
    const streamId = c.req.param('id')
    const rows = await c.env.DB.prepare(`
      SELECT spt.product_id, spt.offset_sec, spt.created_at, p.name, p.image_url, p.price
      FROM stream_product_timestamps spt
      LEFT JOIN products p ON spt.product_id = p.id
      WHERE spt.stream_id = ?
      ORDER BY spt.offset_sec ASC
    `).bind(streamId).all<{ product_id: number; offset_sec: number; created_at: string; name: string; image_url: string | null; price: number }>()
    return c.json({ success: true, data: rows.results || [] })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── POST /api/streams/:id/current-product ─────────────────────────────────────
// 현재 방송 상품 변경 (판매자 JWT 필요)
streamsRouter.post('/:id/current-product', async (c) => {
  // 🛡️ 2026-04-27 (보안 패치): 비인증 사용자가 임의 라이브의 current_product_id 변경 가능했음.
  // 셀러 인증 + 라이브 소유 검증 필수.
  const auth = c.req.header('Authorization');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);
  let userId: number | null = null;
  let userType: string | null = null;
  try {
    const { verify } = await import('hono/jwt');
    const payload = await verify(auth.replace('Bearer ', ''), c.env.JWT_SECRET, 'HS256') as any;
    if (!['seller', 'admin'].includes(payload.type)) {
      return c.json({ success: false, error: 'Seller or admin only' }, 403);
    }
    userId = Number(payload.sub);
    userType = String(payload.type);
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }

  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');
    const { productId } = await c.req.json<{ productId: number }>();

    // 라이브 소유 검증 (admin 은 모든 라이브 가능)
    if (userType === 'seller') {
      const owner = await db.prepare(
        'SELECT seller_id FROM live_streams WHERE id = ?'
      ).bind(streamId).first<{ seller_id: number }>();
      if (!owner) return c.json({ success: false, error: 'live not found' }, 404);
      if (Number(owner.seller_id) !== Number(userId)) {
        return c.json({ success: false, error: 'forbidden — not your live' }, 403);
      }
    }

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
// 2026-04-23 배치 164: 실제 활성 세션 기반 집계로 교체 (P1 분석 정확도)
//   이전: live_streams.viewer_count / current_viewers 컬럼값 단순 조회 → 누적만 되고
//         leave 시 감소 없음, heartbeat 중복 집계로 허수.
//   개선: live_stream_views 의 최근 120초 heartbeat 세션 수 = 현재 시청자.
//         peak_viewers, manual_viewer_count 도 함께 반환.
streamsRouter.get('/:id/viewer-count', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    let live = 0;
    let peak = 0;
    let manual: number | null = null;

    try {
      const row = await db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM live_stream_views
              WHERE live_stream_id = ?
                AND last_heartbeat IS NOT NULL
                AND last_heartbeat > datetime('now', '-120 seconds')
                AND left_at IS NULL) as live_count,
             ls.peak_viewers, ls.manual_viewer_count
           FROM live_streams ls WHERE ls.id = ?`
        )
        .bind(streamId, streamId)
        .first<{ live_count: number; peak_viewers: number | null; manual_viewer_count: number | null }>();
      live = Number(row?.live_count ?? 0);
      peak = Number(row?.peak_viewers ?? 0);
      manual = row?.manual_viewer_count ?? null;
    } catch {
      // Fallback: 컬럼 누락 환경 대응
      try {
        const r = await db
          .prepare('SELECT current_viewers FROM live_streams WHERE id = ?')
          .bind(streamId)
          .first<{ current_viewers: number }>();
        live = Number(r?.current_viewers ?? 0);
      } catch { /* ignore */ }
    }

    const display = manual !== null ? manual : live;
    return c.json({
      success: true,
      data: {
        viewer_count: display,
        live_viewers: live,
        peak_viewers: peak,
        manual_viewer_count: manual,
      },
    });
  } catch (err: unknown) {
    console.error('[Streams] Viewer count error:', err);
    return c.json({ success: false, error: 'Failed to fetch viewer count' }, 500);
  }
});

// ── PUT /api/streams/:id/viewer-count (셀러 수동 설정 — 인증 필수) ────────────
streamsRouter.put('/:id/viewer-count', async (c) => {
  // 🛡️ 인증 체크 — 미인증 시 시청자 수 조작 가능
  const auth = c.req.header('Authorization');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);
  try {
    const { verify } = await import('hono/jwt');
    const payload = await verify(auth.replace('Bearer ', ''), c.env.JWT_SECRET, 'HS256') as any;
    if (!['seller', 'admin'].includes(payload.type)) {
      return c.json({ success: false, error: 'Seller or admin only' }, 403);
    }
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }

  try {
    const streamId = c.req.param('id');
    const { manual_count } = await c.req.json<{ manual_count: number | null }>();

    if (manual_count !== null) {
      // 🛡️ 2026-04-22: 조작 방지 상한 + 증분 제한
      // 이전: 셀러가 999999 같은 허위 수치 설정 가능 (스폰서 사기, 지표 조작)
      // 수정: 0 ~ 100만 범위, 이전 값 대비 최대 +500 증가만 허용
      if (!Number.isFinite(manual_count) || manual_count < 0 || manual_count > 1_000_000) {
        return c.json({ success: false, error: 'manual_count 는 0~1,000,000' }, 400);
      }
      const current = await c.env.DB.prepare(
        'SELECT current_viewers FROM live_streams WHERE id = ?'
      ).bind(streamId).first<{ current_viewers: number }>();
      const prev = Number(current?.current_viewers ?? 0);
      const delta = manual_count - prev;
      // 한 번에 +500 이상 증가 차단 (점진적 증가만 허용)
      if (delta > 500) {
        return c.json({
          success: false,
          error: `한 번에 500 이상 증가 불가 (이전: ${prev}, 요청: ${manual_count})`,
          code: 'VIEWER_COUNT_DELTA_EXCEEDED',
        }, 400);
      }
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
// 2026-04-23 배치 164: 세션 기반 중복 제거 + peak_viewers 집계 (P1 분석 정확도)
//   이전: 매 heartbeat 마다 current_viewers +1 → 1명이 30초마다 계속 증가하는 허수.
//   개선: X-Session-ID 헤더로 unique 식별. 신규 세션만 카운트 증가 + peak 갱신.
//         기존 세션의 heartbeat 는 last_heartbeat 만 갱신.
streamsRouter.post('/:id/viewer/join', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');
    const sessionId = c.req.header('X-Session-ID') || c.req.header('x-session-id');
    if (!sessionId || sessionId.length < 8 || sessionId.length > 128) {
      return c.json({ success: false, error: 'X-Session-ID header required' }, 400);
    }

    // 인증 사용자는 user_id 도 기록 (unique_viewers 정확도 향상)
    let userId: string | null = null;
    try {
      const auth = c.req.header('Authorization');
      if (auth?.startsWith('Bearer ')) {
        const { verify } = await import('hono/jwt');
        const payload = await verify(auth.slice(7), c.env.JWT_SECRET, 'HS256') as { id?: number | string };
        if (payload?.id !== undefined) userId = String(payload.id);
      }
    } catch { /* anonymous view */ }

    // 1) INSERT OR IGNORE → meta.changes 로 신규 여부 판단
    //    UNIQUE(live_stream_id, session_id) 인덱스 덕분에 같은 세션은 무시됨.
    let isNewSession = false;
    try {
      const ins = await db
        .prepare(
          `INSERT OR IGNORE INTO live_stream_views
             (live_stream_id, user_id, session_id, joined_at, last_heartbeat)
           VALUES (?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(streamId, userId, sessionId)
        .run();
      isNewSession = (ins.meta?.changes ?? 0) > 0;
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Streams] lsv insert failed:', e);
    }

    // 2) heartbeat 갱신 (신규든 기존이든)
    try {
      await db
        .prepare(
          `UPDATE live_stream_views
           SET last_heartbeat = datetime('now'),
               left_at = NULL,
               user_id = COALESCE(user_id, ?)
           WHERE live_stream_id = ? AND session_id = ?`
        )
        .bind(userId, streamId, sessionId)
        .run();
    } catch { /* ignore */ }

    // 활성 세션 수 재계산 → current_viewers + peak_viewers 업데이트 (신규 세션일 때만)
    if (isNewSession) {
      try {
        const row = await db
          .prepare(
            `SELECT COUNT(*) as live FROM live_stream_views
             WHERE live_stream_id = ?
               AND last_heartbeat > datetime('now', '-120 seconds')
               AND left_at IS NULL`
          )
          .bind(streamId)
          .first<{ live: number }>();
        const liveNow = Number(row?.live ?? 0);
        await db
          .prepare(
            `UPDATE live_streams
             SET current_viewers = ?,
                 peak_viewers = MAX(COALESCE(peak_viewers, 0), ?),
                 total_viewers = COALESCE(total_viewers, 0) + 1,
                 updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(liveNow, liveNow, streamId)
          .run()
          .catch(swallow('streams:viewer-bump'));
      } catch { /* non-fatal */ }
    } else {
      // heartbeat: current_viewers 만 주기적으로 재동기화 (TTL 만료된 세션 반영)
      try {
        const row = await db
          .prepare(
            `SELECT COUNT(*) as live FROM live_stream_views
             WHERE live_stream_id = ?
               AND last_heartbeat > datetime('now', '-120 seconds')
               AND left_at IS NULL`
          )
          .bind(streamId)
          .first<{ live: number }>();
        await db
          .prepare(
            `UPDATE live_streams SET current_viewers = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .bind(Number(row?.live ?? 0), streamId)
          .run()
          .catch(swallow('streams:current-viewers-resync-join'));
      } catch { /* ignore */ }
    }

    return c.json({ success: true, data: { new_session: isNewSession } });
  } catch (err: unknown) {
    console.error('[Streams] Viewer join error:', err);
    return c.json({ success: false, error: 'Failed to join stream' }, 500);
  }
});

// ── POST /api/streams/:id/viewer/leave ────────────────────────────────────────
// 2026-04-23 배치 164: 페이지 언로드 시 sendBeacon 으로 호출 (P1 분석 정확도)
//   watch_duration 계산 + current_viewers 즉시 반영.
streamsRouter.post('/:id/viewer/leave', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');
    // sendBeacon 은 커스텀 헤더 불가 → query string fallback 지원
    const sessionId =
      c.req.header('X-Session-ID') ||
      c.req.header('x-session-id') ||
      c.req.query('s');
    if (!sessionId) return c.json({ success: true }); // noop — beacon 은 best-effort

    await db
      .prepare(
        `UPDATE live_stream_views
         SET left_at = datetime('now'),
             watch_duration = CAST((julianday(datetime('now')) - julianday(joined_at)) * 86400 AS INTEGER)
         WHERE live_stream_id = ? AND session_id = ? AND left_at IS NULL`
      )
      .bind(streamId, sessionId)
      .run()
      .catch(swallow('streams:viewer-leave'));

    // current_viewers 즉시 재동기화
    try {
      const row = await db
        .prepare(
          `SELECT COUNT(*) as live FROM live_stream_views
           WHERE live_stream_id = ?
             AND last_heartbeat > datetime('now', '-120 seconds')
             AND left_at IS NULL`
        )
        .bind(streamId)
        .first<{ live: number }>();
      await db
        .prepare(
          `UPDATE live_streams SET current_viewers = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .bind(Number(row?.live ?? 0), streamId)
        .run()
        .catch(swallow('streams:current-viewers-resync-leave'));
    } catch { /* ignore */ }

    return c.json({ success: true });
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error('[Streams] Viewer leave error:', err);
    return c.json({ success: false, error: 'Failed to leave stream' }, 500);
  }
});

// ── POST /api/streams/:id/restock-notify ──────────────────────────────────────
// 품절 상품 재입고 알림 신청 (로그인 사용자)
streamsRouter.post('/:id/restock-notify', async (c) => {
  try {
    const streamId = parseInt(c.req.param('id'))
    const authHeader = c.req.header('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    let userId: number | null = null
    if (token && c.env.JWT_SECRET) {
      try {
        const { verify, decode } = await import('hono/jwt')
        const isValid = await verify(token, c.env.JWT_SECRET, 'HS256').catch(() => null)
        if (isValid) {
          const decoded = decode(token)
          userId = (decoded.payload as Record<string, unknown>)?.userId as number ?? null
        }
      } catch { /* invalid token */ }
    }
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

    const { product_id } = await c.req.json<{ product_id: number }>()
    if (!product_id) return c.json({ success: false, error: 'product_id 필요' }, 400)

    // user_notifications 테이블에 재입고 알림 신청 기록 (type = restock_requested)
    // 중복 방지: 동일 user+product 조합이 이미 있으면 skip
    try { await c.env.DB.prepare("ALTER TABLE user_notifications ADD COLUMN metadata TEXT").run() } catch {}
    const existing = await c.env.DB.prepare(
      "SELECT id FROM user_notifications WHERE user_id = ? AND type = 'restock_requested' AND link = ?"
    ).bind(String(userId), `/products/${product_id}`).first()
    if (existing) return c.json({ success: true, already: true })

    await c.env.DB.prepare(
      "INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, 'restock_requested', ?, ?, ?)"
    ).bind(String(userId), '재입고 알림 신청', `상품 ${product_id} 재입고 시 알림을 드립니다.`, `/products/${product_id}`).run()

    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: 'Failed' }, 500)
  }
})

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
