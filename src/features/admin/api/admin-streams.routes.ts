/**
 * Admin Streams + Alimtalk Routes — 라이브 스트림 + 알림톡 관리
 *
 * 🛡️ 2026-04-22 배치 150 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - POST   /streams/replay         — 다시보기 영상 생성
 * - GET    /streams                — 전체 스트림 목록
 * - PUT    /streams/:id            — 스트림 수정
 * - DELETE /streams/:id            — 스트림 삭제
 * - GET    /alimtalk/pricing       — 패키지 목록
 * - POST   /alimtalk/pricing       — 새 패키지
 * - PUT    /alimtalk/pricing/:id   — 패키지 수정
 * - GET    /alimtalk/accounts      — 셀러별 크레딧 현황
 * - GET    /alimtalk/statistics    — 발송 통계
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery } from '@/worker/utils/database';
import type { D1Database } from '@cloudflare/workers-types';

export const adminStreamsRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface IdRow { id: number }

// ─── 라이브 스트림 관리 ──────────────────────────────────────────

adminStreamsRoutes.post('/streams/replay', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const { seller_id, title, description, youtube_url, product_ids } = await c.req.json<{
      seller_id: number; title: string; description?: string; youtube_url: string; product_ids?: number[];
    }>();

    if (!seller_id || !title || !youtube_url) {
      return c.json({ success: false, error: '셀러, 제목, YouTube URL은 필수입니다' }, 400);
    }

    // 🛡️ 2026-04-29 보안 audit (TD-016 HIGH): 입력 검증 — 길이/배열 크기/null-byte.
    if (typeof title !== 'string' || title.length === 0 || title.length > 200) {
      return c.json({ success: false, error: '제목은 1~200자여야 합니다' }, 400);
    }
    if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 5000)) {
      return c.json({ success: false, error: '설명은 5000자 이내여야 합니다' }, 400);
    }
    if (typeof youtube_url !== 'string' || youtube_url.length > 500 || /[\n\r\0]/.test(youtube_url)) {
      return c.json({ success: false, error: '유효하지 않은 YouTube URL' }, 400);
    }
    if (product_ids !== undefined && (!Array.isArray(product_ids) || product_ids.length > 50)) {
      return c.json({ success: false, error: '상품은 최대 50개까지 연결 가능합니다' }, 400);
    }

    let videoId = youtube_url;
    const urlMatch = youtube_url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) videoId = urlMatch[1];

    const seller = await DB.prepare('SELECT id, name FROM sellers WHERE id = ?').bind(seller_id).first();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);

    const result = await DB.prepare(`
      INSERT INTO live_streams (seller_id, title, description, youtube_video_id, status, ended_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ended', datetime('now'), datetime('now'), datetime('now'))
    `).bind(seller_id, title, description || null, videoId).run();

    const streamId = result.meta.last_row_id;

    if (product_ids && product_ids.length > 0) {
      try {
        await DB.prepare(`CREATE TABLE IF NOT EXISTS stream_products (id INTEGER PRIMARY KEY AUTOINCREMENT, stream_id INTEGER NOT NULL, product_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(stream_id, product_id))`).run();
      } catch {}

      await DB.batch(product_ids.map(pid =>
        DB.prepare('INSERT OR IGNORE INTO stream_products (stream_id, product_id) VALUES (?, ?)').bind(streamId, pid)
      ));
    }

    return c.json({ success: true, data: { id: streamId, youtube_video_id: videoId } }, 201);
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.get('/streams', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const status = c.req.query('status') || '';
    let sql = `SELECT ls.*, s.name AS seller_name FROM live_streams ls LEFT JOIN sellers s ON s.id = ls.seller_id`;
    const params: unknown[] = [];
    if (status) { sql += ' WHERE ls.status = ?'; params.push(status); }
    sql += ' ORDER BY ls.created_at DESC LIMIT 100';
    const { results } = await DB.prepare(sql).bind(...params).all();
    return c.json({ success: true, data: results || [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.put('/streams/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const id = c.req.param('id');
    const body = await c.req.json<{ title?: string; description?: string; youtube_video_id?: string; status?: string; product_ids?: number[] }>();

    const updates: string[] = [];
    const vals: unknown[] = [];
    if (body.title) { updates.push('title = ?'); vals.push(body.title); }
    if (body.description !== undefined) { updates.push('description = ?'); vals.push(body.description); }
    if (body.youtube_video_id) { updates.push('youtube_video_id = ?'); vals.push(body.youtube_video_id); }
    if (body.status) { updates.push('status = ?'); vals.push(body.status); if (body.status === 'ended') updates.push("ended_at = datetime('now')"); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      vals.push(id);
      await DB.prepare(`UPDATE live_streams SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
    }

    if (body.product_ids) {
      await DB.prepare('DELETE FROM stream_products WHERE stream_id = ?').bind(id).run();
      if (body.product_ids.length > 0) {
        await DB.batch(body.product_ids.map(pid =>
          DB.prepare('INSERT OR IGNORE INTO stream_products (stream_id, product_id) VALUES (?, ?)').bind(id, pid)
        ));
      }
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.delete('/streams/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const streamId = c.req.param('id');
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM live_streams WHERE id=?', [streamId]);
    if (rows.length === 0) return c.json({ success: false, error: '라이브 스트림을 찾을 수 없습니다' }, 404);
    // 🛡️ 2026-05-07: HARD DELETE → SOFT DELETE.
    //   라이브 방송은 매출/통계/시청자 이력과 연결됨. 영구 보존 필수.
    //   status='deleted' 로 표시 + ended_at 자동 — 통계 카운트에서 제외.
    try { await executeQuery(DB, `ALTER TABLE live_streams ADD COLUMN deleted_at DATETIME`, []); } catch { /* exists */ }
    await executeQuery(DB,
      `UPDATE live_streams SET status = 'deleted', ended_at = COALESCE(ended_at, datetime('now')),
       deleted_at = datetime('now') WHERE id = ?`,
      [streamId]
    );
    return c.json({ success: true, data: { id: streamId, soft_deleted: true } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── Alimtalk 관리 ──────────────────────────────────────────────

async function ensureAlimtalkPackagesTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS alimtalk_packages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        label      TEXT    NOT NULL,
        credits    INTEGER NOT NULL,
        price      INTEGER NOT NULL,
        is_active  INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    const count = await DB.prepare('SELECT COUNT(*) as c FROM alimtalk_packages').first<{ c: number }>();
    if (!count || count.c === 0) {
      await DB.prepare(`
        INSERT INTO alimtalk_packages (label, credits, price, is_active, sort_order) VALUES
          ('100건',   100,   900,   1, 1),
          ('500건',   500,   4500,  1, 2),
          ('1,000건', 1000,  9000,  1, 3),
          ('3,000건', 3000,  27000, 1, 4),
          ('5,000건', 5000,  45000, 1, 5)
      `).run();
    }
  } catch { /* table exists */ }
}

adminStreamsRoutes.get('/alimtalk/pricing', cors(), async (c) => {
  const { DB } = c.env;
  try {
    await ensureAlimtalkPackagesTable(DB);
    const { results } = await DB.prepare(
      `SELECT id, label, credits, price, is_active, sort_order, created_at, updated_at
       FROM alimtalk_packages ORDER BY sort_order ASC`
    ).all().catch(() => ({ results: [] }));
    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

adminStreamsRoutes.put('/alimtalk/pricing/:id', cors(), async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  try {
    const body = await c.req.json<{
      label?: string; credits?: number; price?: number;
      is_active?: boolean; sort_order?: number;
    }>();
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (body.label !== undefined)      { fields.push('label = ?');      values.push(body.label); }
    if (body.credits !== undefined)    { fields.push('credits = ?');    values.push(body.credits); }
    if (body.price !== undefined)      { fields.push('price = ?');      values.push(body.price); }
    if (body.is_active !== undefined)  { fields.push('is_active = ?');  values.push(body.is_active ? 1 : 0); }
    if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }
    if (fields.length === 0) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
    fields.push("updated_at = datetime('now')");
    values.push(parseInt(id));
    await DB.prepare(
      `UPDATE alimtalk_packages SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    return c.json({ success: true, message: '패키지가 업데이트되었습니다' });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.post('/alimtalk/pricing', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const body = await c.req.json<{ label: string; credits: number; price: number; sort_order?: number }>();
    if (!body.label || !body.credits || !body.price) {
      return c.json({ success: false, error: '필수 항목 누락 (label, credits, price)' }, 400);
    }
    const result = await DB.prepare(
      `INSERT INTO alimtalk_packages (label, credits, price, is_active, sort_order)
       VALUES (?, ?, ?, 1, ?)`
    ).bind(body.label, body.credits, body.price, body.sort_order ?? 99).run();
    return c.json({ success: true, data: { id: result.meta.last_row_id } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.get('/alimtalk/accounts', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const { results } = await DB.prepare(`
      SELECT s.id, s.name AS seller_name, s.email,
             COALESCE(sc.balance, 0) AS balance,
             sc.updated_at
      FROM sellers s
      LEFT JOIN seller_credits sc ON sc.seller_id = s.id
      WHERE s.status = 'approved'
      ORDER BY sc.balance DESC, s.name ASC
    `).all().catch(() => ({ results: [] }));
    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

adminStreamsRoutes.get('/alimtalk/statistics', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const [totalSent, totalBalance, activeAccounts] = await Promise.all([
      DB.prepare('SELECT COUNT(*) AS cnt FROM alimtalk_logs WHERE success = 1')
        .first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
      DB.prepare('SELECT COALESCE(SUM(balance), 0) AS total FROM seller_credits')
        .first<{ total: number }>().catch(() => ({ total: 0 })),
      DB.prepare('SELECT COUNT(*) AS cnt FROM seller_credits WHERE balance > 0')
        .first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
    ]);
    return c.json({
      success: true,
      data: {
        total_sent: totalSent?.cnt ?? 0,
        total_cost: (totalSent?.cnt ?? 0) * 9,
        active_accounts: activeAccounts?.cnt ?? 0,
        total_balance: totalBalance?.total ?? 0,
      },
    });
  } catch {
    return c.json({ success: true, data: { total_sent: 0, total_cost: 0, active_accounts: 0, total_balance: 0 } });
  }
});

export default adminStreamsRoutes;
