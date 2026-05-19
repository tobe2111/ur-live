/**
 * Admin Side Banners Routes — PC 사이드 배너 관리 (Cookat 스타일)
 *
 * 🛡️ 2026-04-22 배치 141 (TD-006 부분): admin-management.routes.ts 에서 분리.
 * worker/index.ts 에서 adminApp.route('/', adminSideBannersRoutes) 으로 마운트.
 *
 * 엔드포인트:
 * - GET    /side-banners
 * - POST   /side-banners
 * - PUT    /side-banners/:id
 * - DELETE /side-banners/:id
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import type { D1Database } from '@cloudflare/workers-types';

export const adminSideBannersRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

async function ensureSideBannersTable(DB: D1Database) {
  if (_done_ensureSideBannersTable) return
  _done_ensureSideBannersTable = true
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS side_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        link_url TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch {
    // Table might already exist, ignore errors
  }
}

adminSideBannersRoutes.get('/side-banners', cors(), async (c) => {
  const { DB } = c.env;
  try {
    await ensureSideBannersTable(DB);
    const { results } = await DB.prepare(
      `SELECT id, title, image_url, link_url, is_active, sort_order, created_at
       FROM side_banners ORDER BY sort_order ASC, created_at DESC`
    ).all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSideBannersRoutes.post('/side-banners', cors(), async (c) => {
  const { DB } = c.env;
  try {
    await ensureSideBannersTable(DB);
    const body = await c.req.json<{ title: string; image_url: string; link_url?: string; is_active?: boolean; sort_order?: number }>();
    if (!body.title || !body.image_url) {
      return c.json({ success: false, error: '제목과 이미지 URL은 필수입니다.' }, 400);
    }
    const result = await DB.prepare(
      `INSERT INTO side_banners (title, image_url, link_url, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      body.title,
      body.image_url,
      body.link_url || null,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      body.sort_order ?? 0
    ).run();
    return c.json({ success: true, data: { id: result.meta.last_row_id, title: body.title } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSideBannersRoutes.put('/side-banners/:id', cors(), async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  try {
    await ensureSideBannersTable(DB);
    const existing = await DB.prepare('SELECT id FROM side_banners WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: '사이드 배너를 찾을 수 없습니다' }, 404);

    const body = await c.req.json<{ title?: string; image_url?: string; link_url?: string; is_active?: boolean; sort_order?: number }>();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (body.title !== undefined)     { fields.push('title = ?');     values.push(body.title); }
    if (body.image_url !== undefined) { fields.push('image_url = ?'); values.push(body.image_url); }
    if (body.link_url !== undefined)  { fields.push('link_url = ?');  values.push(body.link_url || null); }
    if (body.is_active !== undefined) { fields.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
    if (body.sort_order !== undefined){ fields.push('sort_order = ?');values.push(body.sort_order); }
    if (fields.length === 0) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
    values.push(parseInt(id));
    await DB.prepare(
      `UPDATE side_banners SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    return c.json({ success: true, data: { id } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSideBannersRoutes.delete('/side-banners/:id', cors(), async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  try {
    await ensureSideBannersTable(DB);
    const existing = await DB.prepare('SELECT id FROM side_banners WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: '사이드 배너를 찾을 수 없습니다' }, 404);
    await DB.prepare('DELETE FROM side_banners WHERE id = ?').bind(id).run();
    return c.json({ success: true, data: { id } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminSideBannersRoutes;


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureSideBannersTable = false
