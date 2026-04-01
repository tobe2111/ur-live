/**
 * 홈페이지 섹션 관리 API
 *
 * 공개:
 *   GET /api/sections              - 활성 섹션 + 상품 목록 (메인페이지용)
 *
 * 어드민:
 *   GET    /api/sections/admin      - 전체 섹션 목록 (비활성 포함)
 *   POST   /api/sections            - 섹션 생성
 *   PUT    /api/sections/:id        - 섹션 수정
 *   DELETE /api/sections/:id        - 섹션 삭제
 *   POST   /api/sections/:id/products - 섹션에 상품 추가/교체
 *   DELETE /api/sections/:id/products/:productId - 섹션에서 상품 제거
 *   POST   /api/sections/reorder    - 섹션 순서 변경
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const sectionsRoutes = new Hono<{ Bindings: Env }>();

sectionsRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));

async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS homepage_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subtitle TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        layout TEXT DEFAULT 'grid3' CHECK (layout IN ('grid3', 'grid2', 'scroll')),
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* exists */ }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS section_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (section_id) REFERENCES homepage_sections(id) ON DELETE CASCADE,
        UNIQUE(section_id, product_id)
      )
    `).run();
  } catch { /* exists */ }
}

// GET /api/sections — 메인페이지용 (활성 섹션 + 상품)
sectionsRoutes.get('/', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const { results: sections } = await DB.prepare(
    'SELECT id, title, subtitle, layout FROM homepage_sections WHERE is_active = 1 ORDER BY sort_order ASC'
  ).all();

  const result = [];
  for (const section of (sections ?? [])) {
    const s = section as Record<string, unknown>;
    const { results: products } = await DB.prepare(`
      SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.discount_rate, p.stock
      FROM section_products sp
      JOIN products p ON sp.product_id = p.id AND p.is_active = 1
      WHERE sp.section_id = ?
      ORDER BY sp.sort_order ASC
      LIMIT 12
    `).bind(s.id).all();

    result.push({
      ...s,
      products: products ?? [],
    });
  }

  return c.json({ success: true, data: result });
});

// GET /api/sections/admin — 어드민용 전체 목록
sectionsRoutes.get('/admin', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  await ensureTables(DB);

  const { results: sections } = await DB.prepare(
    'SELECT * FROM homepage_sections ORDER BY sort_order ASC'
  ).all();

  const result = [];
  for (const section of (sections ?? [])) {
    const s = section as Record<string, unknown>;
    const { results: products } = await DB.prepare(`
      SELECT sp.id as sp_id, sp.sort_order, p.id, p.name, p.price, p.image_url
      FROM section_products sp
      JOIN products p ON sp.product_id = p.id
      WHERE sp.section_id = ?
      ORDER BY sp.sort_order ASC
    `).bind(s.id).all();

    result.push({ ...s, products: products ?? [] });
  }

  return c.json({ success: true, data: result });
});

// POST /api/sections — 섹션 생성
sectionsRoutes.post('/', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  await ensureTables(DB);
  const { title, subtitle, layout } = await c.req.json<{ title: string; subtitle?: string; layout?: string }>();

  if (!title) return c.json({ success: false, error: '섹션 제목은 필수입니다' }, 400);

  const maxOrder = await DB.prepare('SELECT MAX(sort_order) as max_order FROM homepage_sections').first<{ max_order: number }>();

  await DB.prepare(
    'INSERT INTO homepage_sections (title, subtitle, layout, sort_order) VALUES (?, ?, ?, ?)'
  ).bind(title, subtitle ?? null, layout ?? 'grid3', (maxOrder?.max_order ?? 0) + 1).run();

  return c.json({ success: true, message: '섹션이 생성되었습니다' }, 201);
});

// PUT /api/sections/:id — 섹션 수정
sectionsRoutes.put('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const sectionId = c.req.param('id');
  const { title, subtitle, layout, is_active } = await c.req.json<{
    title?: string; subtitle?: string; layout?: string; is_active?: number;
  }>();

  const updates: string[] = ['updated_at = datetime(\'now\')'];
  const params: (string | number)[] = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (subtitle !== undefined) { updates.push('subtitle = ?'); params.push(subtitle); }
  if (layout !== undefined) { updates.push('layout = ?'); params.push(layout); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

  params.push(sectionId);
  await DB.prepare(`UPDATE homepage_sections SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  return c.json({ success: true, message: '섹션이 수정되었습니다' });
});

// DELETE /api/sections/:id — 섹션 삭제
sectionsRoutes.delete('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const sectionId = c.req.param('id');

  await DB.prepare('DELETE FROM section_products WHERE section_id = ?').bind(sectionId).run();
  await DB.prepare('DELETE FROM homepage_sections WHERE id = ?').bind(sectionId).run();

  return c.json({ success: true, message: '섹션이 삭제되었습니다' });
});

// POST /api/sections/:id/products — 섹션에 상품 추가 (배열)
sectionsRoutes.post('/:id/products', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const sectionId = c.req.param('id');
  const { product_ids } = await c.req.json<{ product_ids: number[] }>();

  if (!product_ids?.length) return c.json({ success: false, error: '상품 ID를 입력해주세요' }, 400);

  // 기존 상품 제거 후 재삽입
  await DB.prepare('DELETE FROM section_products WHERE section_id = ?').bind(sectionId).run();

  for (let i = 0; i < product_ids.length; i++) {
    await DB.prepare(
      'INSERT OR IGNORE INTO section_products (section_id, product_id, sort_order) VALUES (?, ?, ?)'
    ).bind(sectionId, product_ids[i], i).run();
  }

  return c.json({ success: true, message: `${product_ids.length}개 상품이 설정되었습니다` });
});

// DELETE /api/sections/:id/products/:productId — 상품 제거
sectionsRoutes.delete('/:id/products/:productId', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  await DB.prepare('DELETE FROM section_products WHERE section_id = ? AND product_id = ?')
    .bind(c.req.param('id'), c.req.param('productId')).run();

  return c.json({ success: true, message: '상품이 제거되었습니다' });
});

// POST /api/sections/reorder — 순서 변경
sectionsRoutes.post('/reorder', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const { section_ids } = await c.req.json<{ section_ids: number[] }>();

  for (let i = 0; i < section_ids.length; i++) {
    await DB.prepare('UPDATE homepage_sections SET sort_order = ? WHERE id = ?')
      .bind(i, section_ids[i]).run();
  }

  return c.json({ success: true, message: '순서가 변경되었습니다' });
});

export { sectionsRoutes };
