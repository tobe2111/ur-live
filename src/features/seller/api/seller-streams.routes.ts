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

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

type StreamCreateRequest = {
  title: string;
  description?: string;
  thumbnail?: string;
  stream_url?: string;
  youtube_video_id?: string;
  scheduled_at?: string;
};

type StreamUpdateRequest = {
  title?: string;
  description?: string;
  thumbnail?: string;
  stream_url?: string;
  youtube_video_id?: string;
  status?: 'scheduled' | 'live' | 'ended';
  scheduled_at?: string;
};

export const sellerStreamsRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
sellerStreamsRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
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
        id, seller_id, title, description, thumbnail, stream_url, youtube_video_id,
        status, scheduled_at, started_at, ended_at, viewer_count, created_at, updated_at
      FROM live_streams
      WHERE seller_id = ?
    `;
    const params: any[] = [sellerId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const streams = await db.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM live_streams WHERE seller_id = ?`;
    const countParams: any[] = [sellerId];
    
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

  } catch (error: any) {
    console.error('Get seller streams error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get streams'
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
        id, seller_id, title, description, thumbnail, stream_url, youtube_video_id,
        status, scheduled_at, started_at, ended_at, viewer_count, created_at, updated_at
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

  } catch (error: any) {
    console.error('Get stream error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get stream'
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
    const { title, description, thumbnail, stream_url, youtube_video_id, scheduled_at } = body;

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
        seller_id, title, description, thumbnail, stream_url, youtube_video_id,
        status, scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, datetime('now'), datetime('now'))
    `).bind(
      sellerId,
      title,
      description || null,
      thumbnail || null,
      stream_url || null,
      youtube_video_id || null,
      scheduled_at || null
    ).run();

    if (!result.success) {
      throw new Error('Failed to create stream');
    }

    // 생성된 스트림 조회
    const newStream = await db.prepare(`
      SELECT
        id, seller_id, title, description, thumbnail, stream_url, youtube_video_id,
        status, scheduled_at, started_at, ended_at, viewer_count, created_at, updated_at
      FROM live_streams
      WHERE id = ?
    `).bind(result.meta.last_row_id).first<Record<string, unknown>>();

    return c.json({
      success: true,
      message: 'Stream created successfully',
      stream: newStream
    }, 201);

  } catch (error: any) {
    console.error('Create stream error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to create stream'
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
    const values: any[] = [];

    // 업데이트 가능한 필드들
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.thumbnail !== undefined) {
      updates.push('thumbnail = ?');
      values.push(body.thumbnail);
    }
    if (body.stream_url !== undefined) {
      updates.push('stream_url = ?');
      values.push(body.stream_url);
    }
    if (body.youtube_video_id !== undefined) {
      updates.push('youtube_video_id = ?');
      values.push(body.youtube_video_id);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
      
      // 상태에 따라 타임스탬프 업데이트
      if (body.status === 'live') {
        updates.push('started_at = datetime(\'now\')');
      } else if (body.status === 'ended') {
        updates.push('ended_at = datetime(\'now\')');
      }
    }
    if (body.scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      values.push(body.scheduled_at);
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
        id, seller_id, title, description, thumbnail, stream_url, youtube_video_id,
        status, scheduled_at, started_at, ended_at, viewer_count, created_at, updated_at
      FROM live_streams
      WHERE id = ?
    `).bind(streamId).first<Record<string, unknown>>();

    return c.json({
      success: true,
      message: 'Stream updated successfully',
      stream: updatedStream
    });

  } catch (error: any) {
    console.error('Update stream error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to update stream'
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

  } catch (error: any) {
    console.error('Delete stream error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to delete stream'
    }, 500);
  }
});
