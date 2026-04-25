/**
 * Seller Streams CRUD Routes
 *
 * - GET /   — 셀러의 스트림 목록 조회
 * - GET /:id — 특정 스트림 상세 조회
 * - POST /  — 새 스트림 생성
 * - PUT /:id — 스트림 정보 수정
 * - DELETE /:id — 스트림 삭제
 */

import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { cacheInvalidate } from '@/worker/utils/cache';
import { getSellerIdFromToken } from './seller-streams-helpers';
import { logError } from '@/worker/utils/logger';

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

export const sellerStreamsCrudRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /
 * 셀러의 모든 스트림 조회
 */
sellerStreamsCrudRoutes.get('/', async (c) => {
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
    logError('seller.streams.list.error', { error: (error as Error)?.message });
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to get streams'
    }, 500);
  }
});

/**
 * GET /:id
 * 특정 스트림 상세 조회
 */
sellerStreamsCrudRoutes.get('/:id', async (c) => {
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
    logError('seller.streams.detail.error', { error: (error as Error)?.message });
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to get stream'
    }, 500);
  }
});

/**
 * POST /
 * 새 스트림 생성
 */
sellerStreamsCrudRoutes.post('/', async (c) => {
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
      ).catch(() => {});
    } catch {}

    // suppress unused variable warning
    void thumbnail;

    return c.json({
      success: true,
      message: 'Stream created successfully',
      stream: newStream
    }, 201);

  } catch (error: unknown) {
    logError('seller.streams.create.error', { error: (error as Error)?.message });
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to create stream'
    }, 500);
  }
});

/**
 * PUT /:id
 * 스트림 정보 수정
 */
sellerStreamsCrudRoutes.put('/:id', async (c) => {
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

    // Invalidate cached stream detail (list entries expire within 30s TTL)
    await cacheInvalidate(c.env.SESSION_KV, `stream:${streamId}`);

    // ── 방송 시작 시 구독자에게 알림 발송 ──
    if (body.status === 'live') {
      try {
        // 1. 인앱 알림 + 알림톡 발송 (비동기)
        const notifyUrl = new URL(c.req.url);
        notifyUrl.pathname = `/api/broadcast-notify/send/${streamId}`;
        c.executionCtx?.waitUntil?.(
          fetch(notifyUrl.toString(), { method: 'POST', signal: AbortSignal.timeout(5_000) }).catch(() => {})
        );

        // 2. 카카오톡 메시지 발송 (구독자 중 카카오 토큰 보유자, 무료)
        c.executionCtx?.waitUntil?.(
          (async () => {
            try {
              const { sendKakaoMessageToSubscribers, sendKakaoToFollowers } = await import('../../../lib/notifications');
              const streamRow = await db.prepare('SELECT title FROM live_streams WHERE id = ?').bind(streamId).first<{ title: string }>();
              const seller = await db.prepare('SELECT name FROM sellers WHERE id = ?').bind(sellerId).first<{ name: string }>();
              const sellerName = seller?.name || '셀러';
              const streamTitle = streamRow?.title || '';
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
    logError('seller.streams.update.error', { error: (error as Error)?.message });
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to update stream'
    }, 500);
  }
});

/**
 * DELETE /:id
 * 스트림 삭제
 */
sellerStreamsCrudRoutes.delete('/:id', async (c) => {
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
    logError('seller.streams.delete.error', { error: (error as Error)?.message });
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to delete stream'
    }, 500);
  }
});
