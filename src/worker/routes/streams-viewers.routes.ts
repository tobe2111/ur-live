// ============================================================
// Streams Viewers Routes
// GET  /:id/viewer-count           — 시청자 수 조회
// PUT  /:id/viewer-count           — 시청자 수 수동 설정 (셀러/어드민 전용)
// POST /:id/viewer/join            — 시청자 입장 / heartbeat
// POST /:id/viewer/leave           — 시청자 퇴장
// POST /:id/fake-cart-notification — 가짜 장바구니 알림 (데모)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { verify } from 'hono/jwt';
import { logError } from '../utils/logger';

export const streamsViewersRouter = new Hono<{ Bindings: Env }>();

// ── GET /:id/viewer-count ─────────────────────────────────────────────────────
// 2026-04-23 배치 164: 실제 활성 세션 기반 집계로 교체 (P1 분석 정확도)
//   이전: live_streams.viewer_count / current_viewers 컬럼값 단순 조회 → 누적만 되고
//         leave 시 감소 없음, heartbeat 중복 집계로 허수.
//   개선: live_stream_views 의 최근 120초 heartbeat 세션 수 = 현재 시청자.
//         peak_viewers, manual_viewer_count 도 함께 반환.
streamsViewersRouter.get('/:id/viewer-count', async (c) => {
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
    logError('streams.viewers.count.error', { error: (err as Error)?.message });
    return c.json({ success: false, error: 'Failed to fetch viewer count' }, 500);
  }
});

// ── PUT /:id/viewer-count (셀러 수동 설정 — 인증 필수) ────────────────────────
streamsViewersRouter.put('/:id/viewer-count', async (c) => {
  // 🛡️ 인증 체크 — 미인증 시 시청자 수 조작 가능
  const auth = c.req.header('Authorization');
  if (!auth) return c.json({ success: false, error: 'Unauthorized' }, 401);
  try {
    const payload = await verify(auth.replace('Bearer ', ''), c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
    if (!['seller', 'admin'].includes(String(payload.type ?? ''))) {
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

// ── POST /:id/viewer/join ─────────────────────────────────────────────────────
// 2026-04-23 배치 164: 세션 기반 중복 제거 + peak_viewers 집계 (P1 분석 정확도)
//   이전: 매 heartbeat 마다 current_viewers +1 → 1명이 30초마다 계속 증가하는 허수.
//   개선: X-Session-ID 헤더로 unique 식별. 신규 세션만 카운트 증가 + peak 갱신.
//         기존 세션의 heartbeat 는 last_heartbeat 만 갱신.
streamsViewersRouter.post('/:id/viewer/join', async (c) => {
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
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verify(authHeader.slice(7), c.env.JWT_SECRET, 'HS256') as { id?: number | string };
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
          .catch(() => {});
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
          .catch(() => {});
      } catch { /* ignore */ }
    }

    return c.json({ success: true, data: { new_session: isNewSession } });
  } catch (err: unknown) {
    logError('streams.viewers.join.error', { error: (err as Error)?.message });
    return c.json({ success: false, error: 'Failed to join stream' }, 500);
  }
});

// ── POST /:id/viewer/leave ────────────────────────────────────────────────────
// 2026-04-23 배치 164: 페이지 언로드 시 sendBeacon 으로 호출 (P1 분석 정확도)
//   watch_duration 계산 + current_viewers 즉시 반영.
streamsViewersRouter.post('/:id/viewer/leave', async (c) => {
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
      .catch(() => {});

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
        .catch(() => {});
    } catch { /* ignore */ }

    return c.json({ success: true });
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error('[Streams] Viewer leave error:', err);
    return c.json({ success: false, error: 'Failed to leave stream' }, 500);
  }
});

// ── POST /:id/fake-cart-notification ──────────────────────────────────────────
// 라이브 방송 중 가짜 장바구니 추가 알림 (LivePage에서 데모 목적 사용)
streamsViewersRouter.post('/:id/fake-cart-notification', async (c) => {
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
