/**
 * 유저 공동구매 (Community Group Buy) API
 *
 * POST   /api/community-group-buy/create          - 공동구매 생성 (딜 보증금 차감)
 * POST   /api/community-group-buy/join/:code       - 초대코드로 참여
 * GET    /api/community-group-buy/detail/:code     - 공동구매 상세 + 멤버 목록
 * GET    /api/community-group-buy/list             - 활성 공동구매 목록 (페이지네이션)
 * GET    /api/community-group-buy/my               - 내 공동구매 (생성 + 참여)
 * PATCH  /api/community-group-buy/:id/confirm      - 식당/어드민 딜 확정
 * POST   /api/community-group-buy/:id/refund       - 보증금 환불 (실패/만료)
 * PATCH  /api/community-group-buy/:id/status       - 어드민 상태 변경
 * GET    /api/community-group-buy/popular           - 50명 이상 그룹 (어드민 대시보드)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { executeRun, executeQuery, queryFirst } from '@/worker/utils/database';

const communityGroupBuyRoutes = new Hono<{ Bindings: Env }>();

communityGroupBuyRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

// ── 테이블 자동 생성 + 마이그레이션 ───────────────────────────────────
async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS community_group_buys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_user_id TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        restaurant_name TEXT NOT NULL,
        restaurant_address TEXT,
        restaurant_phone TEXT,
        restaurant_lat TEXT,
        restaurant_lng TEXT,
        proposed_price INTEGER NOT NULL,
        deposit_per_person INTEGER NOT NULL DEFAULT 5000,
        target_count INTEGER NOT NULL DEFAULT 10,
        current_count INTEGER DEFAULT 0,
        total_deposited INTEGER DEFAULT 0,
        status TEXT DEFAULT 'proposed' CHECK(status IN ('proposed','negotiating','confirmed','achieved','failed','refunded')),
        invite_code TEXT UNIQUE,
        confirmed_price INTEGER,
        confirmed_discount_percent INTEGER,
        restaurant_seller_id INTEGER,
        expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* already exists */ }

  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS community_group_buy_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_buy_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        deposit_amount INTEGER NOT NULL,
        status TEXT DEFAULT 'deposited' CHECK(status IN ('deposited','refunded','paid')),
        joined_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (group_buy_id) REFERENCES community_group_buys(id)
      )
    `).run();
  } catch { /* already exists */ }

  // 마이그레이션: 나중에 추가될 수 있는 컬럼
  try { await DB.prepare("ALTER TABLE community_group_buys ADD COLUMN confirmed_price INTEGER").run(); } catch {}
  try { await DB.prepare("ALTER TABLE community_group_buys ADD COLUMN confirmed_discount_percent INTEGER").run(); } catch {}
  try { await DB.prepare("ALTER TABLE community_group_buys ADD COLUMN restaurant_seller_id INTEGER").run(); } catch {}
}

// ── 초대 코드 생성 ────────────────────────────────────────────────────
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── POST /create — 공동구매 생성 ──────────────────────────────────────
communityGroupBuyRoutes.post('/create', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const body = await c.req.json<{
    restaurant_name: string;
    restaurant_address?: string;
    restaurant_phone?: string;
    restaurant_lat?: string;
    restaurant_lng?: string;
    proposed_price: number;
    deposit_per_person?: number;
    target_count?: number;
  }>();

  if (!body.restaurant_name || !body.proposed_price) {
    return c.json({ success: false, error: '식당 이름과 제안 가격은 필수입니다' }, 400);
  }

  const depositPerPerson = body.deposit_per_person || 5000;
  const targetCount = body.target_count || 10;
  const inviteCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const userId = String(user.id);

  // 딜 포인트 차감 (보증금)
  const deductResult = await executeRun(
    DB,
    'UPDATE users SET deal_balance = deal_balance - ? WHERE id = ? AND deal_balance >= ?',
    [depositPerPerson, userId, depositPerPerson],
  );

  if (!deductResult.meta.changes) {
    return c.json({ success: false, error: `딜이 부족합니다 (보증금: ${depositPerPerson}딜)`, code: 'INSUFFICIENT_BALANCE' }, 400);
  }

  // 공동구매 생성
  const result = await executeRun(
    DB,
    `INSERT INTO community_group_buys
      (creator_user_id, creator_name, restaurant_name, restaurant_address, restaurant_phone,
       restaurant_lat, restaurant_lng, proposed_price, deposit_per_person, target_count,
       current_count, total_deposited, invite_code, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      userId,
      user.name || '익명',
      body.restaurant_name,
      body.restaurant_address || null,
      body.restaurant_phone || null,
      body.restaurant_lat || null,
      body.restaurant_lng || null,
      body.proposed_price,
      depositPerPerson,
      targetCount,
      depositPerPerson,
      inviteCode,
      expiresAt,
    ],
  );

  const groupBuyId = result.meta.last_row_id;

  // 생성자를 첫 번째 멤버로 추가
  await executeRun(
    DB,
    `INSERT INTO community_group_buy_members (group_buy_id, user_id, user_name, deposit_amount)
     VALUES (?, ?, ?, ?)`,
    [groupBuyId, userId, user.name || '익명', depositPerPerson],
  );

  return c.json({
    success: true,
    data: {
      id: groupBuyId,
      invite_code: inviteCode,
      expires_at: expiresAt,
      deposit_per_person: depositPerPerson,
      target_count: targetCount,
    },
  }, 201);
});

// ── POST /join/:code — 초대코드로 참여 ────────────────────────────────
communityGroupBuyRoutes.post('/join/:code', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const code = c.req.param('code');
  const userId = String(user.id);

  // 공동구매 조회
  const group = await queryFirst<any>(
    DB,
    "SELECT * FROM community_group_buys WHERE invite_code = ?",
    [code],
  );

  if (!group) return c.json({ success: false, error: '유효하지 않은 초대 코드입니다' }, 404);

  // 상태 확인
  if (group.status !== 'proposed' && group.status !== 'confirmed') {
    return c.json({ success: false, error: '참여할 수 없는 상태입니다' }, 400);
  }

  // 만료 확인
  if (group.expires_at && new Date(group.expires_at) < new Date()) {
    await executeRun(DB, "UPDATE community_group_buys SET status = 'failed', updated_at = datetime('now') WHERE id = ?", [group.id]);
    return c.json({ success: false, error: '공동구매가 만료되었습니다' }, 400);
  }

  // 중복 참여 확인
  const existing = await queryFirst(
    DB,
    'SELECT id FROM community_group_buy_members WHERE group_buy_id = ? AND user_id = ?',
    [group.id, userId],
  );
  if (existing) return c.json({ success: false, error: '이미 참여 중입니다' }, 409);

  const depositAmount = group.deposit_per_person;

  // 딜 포인트 차감
  const deductResult = await executeRun(
    DB,
    'UPDATE users SET deal_balance = deal_balance - ? WHERE id = ? AND deal_balance >= ?',
    [depositAmount, userId, depositAmount],
  );

  if (!deductResult.meta.changes) {
    return c.json({ success: false, error: `딜이 부족합니다 (보증금: ${depositAmount}딜)`, code: 'INSUFFICIENT_BALANCE' }, 400);
  }

  // 멤버 추가
  await executeRun(
    DB,
    `INSERT INTO community_group_buy_members (group_buy_id, user_id, user_name, deposit_amount)
     VALUES (?, ?, ?, ?)`,
    [group.id, userId, user.name || '익명', depositAmount],
  );

  // current_count, total_deposited 증가
  const newCount = group.current_count + 1;
  const newTotalDeposited = group.total_deposited + depositAmount;

  // 목표 인원 달성 + proposed 상태면 자동으로 negotiating으로 전환
  let newStatus = group.status;
  if (newCount >= group.target_count && group.status === 'proposed') {
    newStatus = 'negotiating';
  }

  await executeRun(
    DB,
    `UPDATE community_group_buys
     SET current_count = ?, total_deposited = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [newCount, newTotalDeposited, newStatus, group.id],
  );

  // 멤버 목록 조회
  const members = await executeQuery<any>(
    DB,
    'SELECT user_name, deposit_amount, status, joined_at FROM community_group_buy_members WHERE group_buy_id = ? ORDER BY joined_at',
    [group.id],
  );

  return c.json({
    success: true,
    data: {
      id: group.id,
      invite_code: group.invite_code,
      restaurant_name: group.restaurant_name,
      current_count: newCount,
      target_count: group.target_count,
      total_deposited: newTotalDeposited,
      status: newStatus,
      members,
    },
  });
});

// ── GET /detail/:code — 공동구매 상세 + 멤버 목록 ─────────────────────
communityGroupBuyRoutes.get('/detail/:code', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const code = c.req.param('code');

  const group = await queryFirst<any>(
    DB,
    'SELECT * FROM community_group_buys WHERE invite_code = ?',
    [code],
  );

  if (!group) return c.json({ success: false, error: '공동구매를 찾을 수 없습니다' }, 404);

  const members = await executeQuery<any>(
    DB,
    'SELECT user_name, deposit_amount, status, joined_at FROM community_group_buy_members WHERE group_buy_id = ? ORDER BY joined_at',
    [group.id],
  );

  return c.json({
    success: true,
    data: {
      ...group,
      members,
    },
  });
});

// ── GET /list — 활성 공동구매 목록 (페이지네이션) ──────────────────────
communityGroupBuyRoutes.get('/list', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const status = c.req.query('status') || 'proposed';
  const sort = c.req.query('sort') || 'newest';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  let orderBy = 'created_at DESC';
  if (sort === 'popular') orderBy = 'current_count DESC';
  else if (sort === 'deadline') orderBy = 'expires_at ASC';

  // 만료된 proposed 공동구매 자동 실패 처리
  try {
    await executeRun(
      DB,
      `UPDATE community_group_buys
       SET status = 'failed', updated_at = datetime('now')
       WHERE status = 'proposed' AND expires_at IS NOT NULL AND expires_at < datetime('now')`,
      [],
    );
  } catch { /* ignore */ }

  const total = await queryFirst<{ cnt: number }>(
    DB,
    `SELECT COUNT(*) as cnt FROM community_group_buys WHERE status = ?`,
    [status],
  );

  const groups = await executeQuery<any>(
    DB,
    `SELECT * FROM community_group_buys
     WHERE status = ?
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [status, limit, offset],
  );

  return c.json({
    success: true,
    data: groups,
    pagination: {
      page,
      limit,
      total: total?.cnt || 0,
      totalPages: Math.ceil((total?.cnt || 0) / limit),
    },
  });
});

// ── GET /my — 내 공동구매 (생성 + 참여) ───────────────────────────────
communityGroupBuyRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);

  // 내가 생성한 공동구매
  const created = await executeQuery<any>(
    DB,
    `SELECT * FROM community_group_buys WHERE creator_user_id = ? ORDER BY created_at DESC`,
    [userId],
  );

  // 내가 참여한 공동구매 (생성자 제외, 중복 방지)
  const joined = await executeQuery<any>(
    DB,
    `SELECT g.*, m.deposit_amount as my_deposit, m.status as my_status, m.joined_at as my_joined_at
     FROM community_group_buys g
     JOIN community_group_buy_members m ON m.group_buy_id = g.id
     WHERE m.user_id = ? AND g.creator_user_id != ?
     ORDER BY m.joined_at DESC`,
    [userId, userId],
  );

  return c.json({
    success: true,
    data: {
      created,
      joined,
    },
  });
});

// ── PATCH /:id/confirm — 식당/어드민 딜 확정 (Phase 2) ────────────────
communityGroupBuyRoutes.patch('/:id/confirm', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const groupId = c.req.param('id');

  const group = await queryFirst<any>(
    DB,
    'SELECT * FROM community_group_buys WHERE id = ?',
    [groupId],
  );

  if (!group) return c.json({ success: false, error: '공동구매를 찾을 수 없습니다' }, 404);

  // 권한 확인: 어드민이거나 restaurant_seller_id가 본인인 경우만 허용
  const isAdmin = user.type === 'admin' || user.role === 'admin';
  const isSeller = group.restaurant_seller_id && String(group.restaurant_seller_id) === String(user.id);

  if (!isAdmin && !isSeller) {
    return c.json({ success: false, error: '권한이 없습니다' }, 403);
  }

  const { confirmed_price, confirmed_discount_percent } = await c.req.json<{
    confirmed_price: number;
    confirmed_discount_percent: number;
  }>();

  if (!confirmed_price || confirmed_discount_percent == null) {
    return c.json({ success: false, error: '확정 가격과 할인율은 필수입니다' }, 400);
  }

  await executeRun(
    DB,
    `UPDATE community_group_buys
     SET status = 'confirmed', confirmed_price = ?, confirmed_discount_percent = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [confirmed_price, confirmed_discount_percent, group.id],
  );

  return c.json({
    success: true,
    data: {
      id: group.id,
      status: 'confirmed',
      confirmed_price,
      confirmed_discount_percent,
    },
  });
});

// ── POST /:id/refund — 보증금 환불 (실패/만료) ────────────────────────
communityGroupBuyRoutes.post('/:id/refund', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const groupId = c.req.param('id');

  const group = await queryFirst<any>(
    DB,
    'SELECT * FROM community_group_buys WHERE id = ?',
    [groupId],
  );

  if (!group) return c.json({ success: false, error: '공동구매를 찾을 수 없습니다' }, 404);

  // 환불 가능 상태 확인: failed 또는 생성자/어드민이 요청
  const isAdmin = user.type === 'admin' || user.role === 'admin';
  const isCreator = String(group.creator_user_id) === String(user.id);

  if (!isAdmin && !isCreator) {
    return c.json({ success: false, error: '생성자 또는 어드민만 환불할 수 있습니다' }, 403);
  }

  if (group.status === 'refunded') {
    return c.json({ success: false, error: '이미 환불 처리되었습니다' }, 400);
  }

  if (group.status === 'achieved') {
    return c.json({ success: false, error: '달성된 공동구매는 환불할 수 없습니다' }, 400);
  }

  // 모든 deposited 상태 멤버에게 보증금 환불
  const members = await executeQuery<any>(
    DB,
    "SELECT * FROM community_group_buy_members WHERE group_buy_id = ? AND status = 'deposited'",
    [group.id],
  );

  let refundCount = 0;
  for (const member of members) {
    // 딜 포인트 환불
    await executeRun(
      DB,
      'UPDATE users SET deal_balance = deal_balance + ? WHERE id = ?',
      [member.deposit_amount, member.user_id],
    );

    // 멤버 상태 변경
    await executeRun(
      DB,
      "UPDATE community_group_buy_members SET status = 'refunded' WHERE id = ?",
      [member.id],
    );

    refundCount++;
  }

  // 공동구매 상태를 refunded로 변경
  await executeRun(
    DB,
    "UPDATE community_group_buys SET status = 'refunded', updated_at = datetime('now') WHERE id = ?",
    [group.id],
  );

  return c.json({
    success: true,
    data: {
      refunded_count: refundCount,
      total_refunded: members.reduce((sum: number, m: any) => sum + m.deposit_amount, 0),
    },
    message: `${refundCount}명에게 보증금이 환불되었습니다.`,
  });
});

// ── PATCH /:id/status — 어드민 상태 변경 ──────────────────────────────
communityGroupBuyRoutes.patch('/:id/status', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  // 어드민 권한 확인
  const isAdmin = user.type === 'admin' || user.role === 'admin';
  if (!isAdmin) {
    return c.json({ success: false, error: '어드민만 상태를 변경할 수 있습니다' }, 403);
  }

  const { DB } = c.env;
  await ensureTables(DB);

  const groupId = c.req.param('id');
  const { status } = await c.req.json<{ status: string }>();

  const validStatuses = ['proposed', 'negotiating', 'confirmed', 'achieved', 'failed', 'refunded'];
  if (!status || !validStatuses.includes(status)) {
    return c.json({ success: false, error: `유효하지 않은 상태입니다. 가능한 값: ${validStatuses.join(', ')}` }, 400);
  }

  const group = await queryFirst<any>(
    DB,
    'SELECT * FROM community_group_buys WHERE id = ?',
    [groupId],
  );

  if (!group) return c.json({ success: false, error: '공동구매를 찾을 수 없습니다' }, 404);

  await executeRun(
    DB,
    "UPDATE community_group_buys SET status = ?, updated_at = datetime('now') WHERE id = ?",
    [status, group.id],
  );

  return c.json({
    success: true,
    data: {
      id: group.id,
      previous_status: group.status,
      new_status: status,
    },
  });
});

// ── GET /popular — 50명 이상 그룹 (어드민 대시보드 Phase 2) ───────────
communityGroupBuyRoutes.get('/popular', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const groups = await executeQuery<any>(
    DB,
    `SELECT * FROM community_group_buys
     WHERE current_count >= 50
     ORDER BY current_count DESC
     LIMIT 50`,
    [],
  );

  return c.json({
    success: true,
    data: groups,
  });
});

export { communityGroupBuyRoutes };
