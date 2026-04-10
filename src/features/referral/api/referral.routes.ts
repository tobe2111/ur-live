/**
 * 친구 초대 공동구매 할인 API
 *
 * POST /api/referral/create        - 공동구매 그룹 생성
 * POST /api/referral/join/:code    - 그룹 참여
 * GET  /api/referral/:code         - 그룹 상세 조회
 * GET  /api/referral/my            - 내 그룹 목록
 * GET  /api/referral/product/:productId - 상품별 활성 그룹
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser, optionalAuth } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const referralRoutes = new Hono<{ Bindings: Env }>();

referralRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS referral_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        creator_user_id TEXT NOT NULL,
        creator_name TEXT,
        invite_code TEXT UNIQUE NOT NULL,
        target_count INTEGER NOT NULL DEFAULT 3,
        current_count INTEGER NOT NULL DEFAULT 1,
        discount_per_person INTEGER NOT NULL DEFAULT 0,
        discount_percent INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'achieved', 'expired', 'cancelled')),
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch {}
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS referral_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        joined_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(group_id, user_id)
      )
    `).run();
  } catch {}
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/referral/create — 그룹 생성
referralRoutes.post('/create', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const { product_id, target_count, discount_per_person, discount_percent } = await c.req.json<{
    product_id: number; target_count?: number; discount_per_person?: number; discount_percent?: number;
  }>();

  if (!product_id) return c.json({ success: false, error: '상품 ID 필요' }, 400);

  const product = await DB.prepare('SELECT id, name, price FROM products WHERE id = ? AND is_active = 1').bind(product_id).first();
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  const code = generateCode();
  const target = target_count || 3;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48시간

  const result = await DB.prepare(`
    INSERT INTO referral_groups (product_id, creator_user_id, creator_name, invite_code, target_count, discount_per_person, discount_percent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(product_id, user.id, user.name || '익명', code, target, discount_per_person || 0, discount_percent || 10, expiresAt).run();

  // 생성자도 멤버로 추가
  await DB.prepare('INSERT INTO referral_members (group_id, user_id, user_name) VALUES (?, ?, ?)')
    .bind(result.meta.last_row_id, user.id, user.name || '익명').run();

  return c.json({ success: true, data: { id: result.meta.last_row_id, invite_code: code, expires_at: expiresAt } }, 201);
});

// POST /api/referral/join/:code — 그룹 참여
referralRoutes.post('/join/:code', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const code = c.req.param('code');
  const group = await DB.prepare("SELECT * FROM referral_groups WHERE invite_code = ? AND status = 'open'")
    .bind(code).first<any>();

  if (!group) return c.json({ success: false, error: '유효하지 않은 초대 코드입니다' }, 404);
  if (new Date(group.expires_at) < new Date()) {
    await DB.prepare("UPDATE referral_groups SET status = 'expired' WHERE id = ?").bind(group.id).run();
    return c.json({ success: false, error: '초대가 만료되었습니다' }, 400);
  }

  const existing = await DB.prepare('SELECT id FROM referral_members WHERE group_id = ? AND user_id = ?')
    .bind(group.id, user.id).first();
  if (existing) return c.json({ success: false, error: '이미 참여 중입니다' }, 409);

  await DB.prepare('INSERT INTO referral_members (group_id, user_id, user_name) VALUES (?, ?, ?)')
    .bind(group.id, user.id, user.name || '익명').run();

  const newCount = group.current_count + 1;
  const newStatus = newCount >= group.target_count ? 'achieved' : 'open';
  await DB.prepare('UPDATE referral_groups SET current_count = ?, status = ? WHERE id = ?')
    .bind(newCount, newStatus, group.id).run();

  return c.json({ success: true, data: { current_count: newCount, target_count: group.target_count, achieved: newStatus === 'achieved' } });
});

// GET /api/referral/discount/:productId — 해당 상품에 대한 유저의 달성된 할인 조회
referralRoutes.get('/discount/:productId', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: true, data: null });

  const { DB } = c.env;
  await ensureTables(DB);

  const productId = c.req.param('productId');

  // 유저가 참여한 그룹 중 달성된 것 찾기
  const group = await DB.prepare(`
    SELECT g.id, g.discount_percent, g.discount_per_person, g.invite_code
    FROM referral_groups g
    JOIN referral_members m ON m.group_id = g.id
    WHERE g.product_id = ? AND m.user_id = ? AND g.status = 'achieved'
    ORDER BY g.created_at DESC LIMIT 1
  `).bind(productId, user.id).first<any>();

  if (!group) return c.json({ success: true, data: null });

  return c.json({ success: true, data: { discount_percent: group.discount_percent, group_id: group.id, invite_code: group.invite_code } });
});

// GET /api/referral/my — 내 그룹 목록 (MUST be before /:code)
referralRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const { results } = await DB.prepare(`
    SELECT g.*, p.name AS product_name, p.price AS product_price, p.image_url
    FROM referral_groups g
    JOIN referral_members m ON m.group_id = g.id
    LEFT JOIN products p ON p.id = g.product_id
    WHERE m.user_id = ?
    ORDER BY g.created_at DESC
  `).bind(user.id).all();

  return c.json({ success: true, data: results });
});

// GET /api/referral/product/:productId — 상품별 활성 그룹 (MUST be before /:code)
referralRoutes.get('/product/:productId', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const productId = c.req.param('productId');
  const { results } = await DB.prepare(`
    SELECT id, invite_code, target_count, current_count, discount_percent, discount_per_person, expires_at, creator_name
    FROM referral_groups
    WHERE product_id = ? AND status = 'open' AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 10
  `).bind(productId).all();

  return c.json({ success: true, data: results });
});

// GET /api/referral/:code — 그룹 상세 (catch-all, after specific routes)
referralRoutes.get('/:code', optionalAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const code = c.req.param('code');
  const group = await DB.prepare('SELECT * FROM referral_groups WHERE invite_code = ?').bind(code).first<any>();
  if (!group) return c.json({ success: false, error: '그룹을 찾을 수 없습니다' }, 404);

  const product = await DB.prepare('SELECT id, name, price, image_url FROM products WHERE id = ?').bind(group.product_id).first();
  const { results: members } = await DB.prepare('SELECT user_name, joined_at FROM referral_members WHERE group_id = ? ORDER BY joined_at')
    .bind(group.id).all();

  return c.json({ success: true, data: { ...group, product, members } });
});

export { referralRoutes };
