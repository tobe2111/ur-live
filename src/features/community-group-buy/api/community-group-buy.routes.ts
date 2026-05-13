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
import { executeRun, executeQuery, queryFirst } from '@/worker/utils/database';
import { ensureUserPointsTable } from '@/worker/utils/ensure-tables';
import { rateLimit } from '@/worker/middleware/rate-limit';

const communityGroupBuyRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// ── 테이블 자동 생성 + 마이그레이션 ───────────────────────────────────
async function ensureRefundTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS community_group_buy_refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        refunded_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(group_id, user_id)
      )
    `).run();
  } catch { /* exists */ }
}

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
// 🛡️ 2026-04-22: Math.random → crypto.getRandomValues (guessable code 방어)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
  return code;
}

// ── POST /create — 공동구매 생성 ──────────────────────────────────────
communityGroupBuyRoutes.post('/create', rateLimit({ action: 'group_buy_create', max: 5, windowSec: 300 }), requireAuth(), async (c) => {
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

  if (typeof body.restaurant_name !== 'string' || body.restaurant_name.length > 200) {
    return c.json({ success: false, error: '식당 이름은 200자 이하로 입력해주세요' }, 400);
  }
  if (!Number.isFinite(body.proposed_price) || body.proposed_price <= 0 || body.proposed_price >= 1_000_000_000) {
    return c.json({ success: false, error: '제안 가격은 1원 이상 10억원 미만이어야 합니다' }, 400);
  }
  if (body.deposit_per_person !== undefined && (!Number.isFinite(body.deposit_per_person) || body.deposit_per_person < 0 || body.deposit_per_person > 1_000_000)) {
    return c.json({ success: false, error: '보증금은 0~1,000,000딜 사이여야 합니다' }, 400);
  }
  if (body.target_count !== undefined && (!Number.isFinite(body.target_count) || body.target_count < 2 || body.target_count > 10_000)) {
    return c.json({ success: false, error: '목표 인원은 2~10,000명 사이여야 합니다' }, 400);
  }

  const depositPerPerson = body.deposit_per_person || 5000;
  const targetCount = body.target_count || 10;
  const inviteCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const userId = String(user.id);

  // 딜 포인트 차감 (보증금) — user_points 테이블 사용 (production에는 users.deal_balance 없음)
  await ensureUserPointsTable(DB);

  const deductResult = await executeRun(
    DB,
    "UPDATE user_points SET balance = balance - ?, total_donated = total_donated + ?, updated_at = datetime('now') WHERE user_id = ? AND balance >= ?",
    [depositPerPerson, depositPerPerson, userId, depositPerPerson],
  );

  if (!deductResult.meta.changes) {
    return c.json({ success: false, error: `딜이 부족합니다 (보증금: ${depositPerPerson}딜)`, code: 'INSUFFICIENT_BALANCE' }, 400);
  }

  // Best-effort sync to legacy users.deal_balance (may not exist in prod)
  try {
    await executeRun(
      DB,
      'UPDATE users SET deal_balance = COALESCE(deal_balance, 0) - ? WHERE id = ?',
      [depositPerPerson, userId],
    );
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[deal_balance]', e);
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
communityGroupBuyRoutes.post('/join/:code', rateLimit({ action: 'group_buy_join', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const code = c.req.param('code');
  if (!code || typeof code !== 'string' || code.length < 4 || code.length > 32 || !/^[A-Za-z0-9]+$/.test(code)) {
    return c.json({ success: false, error: '잘못된 초대 코드입니다' }, 400);
  }
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

  // 🛡️ target 초과 참여 차단 (negotiating/achieved 진입 후 race-window 방어)
  if (group.target_count && group.current_count >= group.target_count) {
    return c.json({ success: false, error: '모집이 마감되었습니다' }, 409);
  }

  const depositAmount = group.deposit_per_person;

  // 딜 포인트 차감 — user_points 테이블 사용
  await ensureUserPointsTable(DB);

  const deductResult = await executeRun(
    DB,
    "UPDATE user_points SET balance = balance - ?, total_donated = total_donated + ?, updated_at = datetime('now') WHERE user_id = ? AND balance >= ?",
    [depositAmount, depositAmount, userId, depositAmount],
  );

  if (!deductResult.meta.changes) {
    return c.json({ success: false, error: `딜이 부족합니다 (보증금: ${depositAmount}딜)`, code: 'INSUFFICIENT_BALANCE' }, 400);
  }

  // Best-effort sync to legacy users.deal_balance
  try {
    await executeRun(
      DB,
      'UPDATE users SET deal_balance = COALESCE(deal_balance, 0) - ? WHERE id = ?',
      [depositAmount, userId],
    );
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[deal_balance]', e);
  }

  // 멤버 추가
  await executeRun(
    DB,
    `INSERT INTO community_group_buy_members (group_buy_id, user_id, user_name, deposit_amount)
     VALUES (?, ?, ?, ?)`,
    [group.id, userId, user.name || '익명', depositAmount],
  );

  // ✅ CONCURRENCY: 단일 UPDATE 로 원자 증가 + 목표 달성 시 status 전이.
  //    이전엔 read-modify-write 라 두 참여자가 동시에 가입하면 같은 current_count
  //    를 읽어 negotiating 전이가 누락될 수 있었음.
  await executeRun(
    DB,
    `UPDATE community_group_buys
       SET current_count = current_count + 1,
           total_deposited = total_deposited + ?,
           status = CASE
             WHEN status = 'proposed' AND (current_count + 1) >= target_count THEN 'negotiating'
             ELSE status
           END,
           updated_at = datetime('now')
     WHERE id = ?`,
    [depositAmount, group.id],
  );

  // UPDATE 후의 최신 값으로 응답 (race-condition-free)
  const refreshed = await queryFirst<{ current_count: number; total_deposited: number; status: string }>(
    DB,
    'SELECT current_count, total_deposited, status FROM community_group_buys WHERE id = ?',
    [group.id],
  );
  const newCount = refreshed?.current_count ?? (group.current_count + 1);
  const newTotalDeposited = refreshed?.total_deposited ?? (group.total_deposited + depositAmount);
  const newStatus = refreshed?.status ?? group.status;

  // 50명 도달 시 모든 에이전시에 알림 전송
  if (newCount === 50) {
    try {
      // agency_notifications 테이블 보장
      try {
        await DB.prepare(`
          CREATE TABLE IF NOT EXISTS agency_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agency_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT,
            link TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      } catch { /* already exists */ }

      const agencies = await executeQuery<{ id: number }>(
        DB,
        "SELECT id FROM agencies WHERE status = 'active'",
        [],
      );

      for (const agency of agencies) {
        await executeRun(
          DB,
          `INSERT INTO agency_notifications (agency_id, type, title, message, created_at)
           VALUES (?, 'demand_alert', ?, ?, datetime('now'))`,
          [
            agency.id,
            '\uD83D\uDD25 인기 맛집 공구 알림',
            `"${group.restaurant_name}" 공구에 50명 이상 모였습니다! 식당 컨택을 검토해주세요.`,
          ],
        );
      }
    } catch { /* notification failure should not break the join */ }
  }

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
  if (!code || typeof code !== 'string' || code.length < 4 || code.length > 32 || !/^[A-Za-z0-9]+$/.test(code)) {
    return c.json({ success: false, error: '잘못된 초대 코드입니다' }, 400);
  }

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

  const groupIdRaw = c.req.param('id');
  const groupIdNum = Number(groupIdRaw);
  if (!Number.isFinite(groupIdNum) || groupIdNum <= 0 || !Number.isInteger(groupIdNum)) {
    return c.json({ success: false, error: '잘못된 공동구매 ID 입니다' }, 400);
  }

  const group = await queryFirst<any>(
    DB,
    'SELECT * FROM community_group_buys WHERE id = ?',
    [groupIdNum],
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
  }>().catch(() => ({ confirmed_price: 0, confirmed_discount_percent: 0 }));

  // 🛡️ 입력 검증: 확정 가격 1원~10억, 할인율 0~100
  if (!Number.isFinite(confirmed_price) || confirmed_price <= 0 || confirmed_price >= 1_000_000_000) {
    return c.json({ success: false, error: '확정 가격은 1원 이상 10억원 미만이어야 합니다' }, 400);
  }
  if (!Number.isFinite(confirmed_discount_percent) || confirmed_discount_percent < 0 || confirmed_discount_percent > 100) {
    return c.json({ success: false, error: '할인율은 0~100 사이여야 합니다' }, 400);
  }

  // 🛡️ CAS: 이미 confirmed/achieved/refunded/failed 상태면 재확정 차단
  const confirmRes = await executeRun(
    DB,
    `UPDATE community_group_buys
     SET status = 'confirmed', confirmed_price = ?, confirmed_discount_percent = ?, updated_at = datetime('now')
     WHERE id = ? AND status IN ('proposed','negotiating')`,
    [confirmed_price, confirmed_discount_percent, group.id],
  );
  if (!confirmRes.meta?.changes) {
    return c.json({ success: false, error: '확정할 수 없는 상태입니다' }, 409);
  }

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

  const groupIdRaw = c.req.param('id');
  const groupIdNum = Number(groupIdRaw);
  if (!Number.isFinite(groupIdNum) || groupIdNum <= 0 || !Number.isInteger(groupIdNum)) {
    return c.json({ success: false, error: '잘못된 공동구매 ID 입니다' }, 400);
  }

  const group = await queryFirst<any>(
    DB,
    'SELECT * FROM community_group_buys WHERE id = ?',
    [groupIdNum],
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

  if (group.status === 'confirmed' && !isAdmin) {
    return c.json({ success: false, error: '식당이 확정한 공동구매는 어드민만 환불할 수 있습니다' }, 403);
  }

  // 모든 deposited 상태 멤버에게 보증금 환불
  const members = await executeQuery<any>(
    DB,
    "SELECT * FROM community_group_buy_members WHERE group_buy_id = ? AND status = 'deposited'",
    [group.id],
  );

  // user_points 테이블 보장
  await ensureUserPointsTable(DB);

  // SECURITY (HIGH-6): 환불 idempotency 테이블 보장
  await ensureRefundTable(DB);

  let refundCount = 0;
  for (const member of members) {
    // SECURITY (HIGH-6): 동일 group_id + user_id 중복 환불 방지
    const alreadyRefunded = await queryFirst<{ id: number }>(
      DB,
      'SELECT id FROM community_group_buy_refunds WHERE group_id = ? AND user_id = ?',
      [group.id, member.user_id],
    );
    if (alreadyRefunded) continue; // 이미 환불 처리됨

    // 딜 포인트 환불 — user_points UPSERT
    try {
      const existingPts = await queryFirst<{ balance: number }>(
        DB,
        'SELECT balance FROM user_points WHERE user_id = ?',
        [member.user_id],
      );
      if (existingPts) {
        await executeRun(
          DB,
          "UPDATE user_points SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?",
          [member.deposit_amount, member.user_id],
        );
      } else {
        await executeRun(
          DB,
          'INSERT INTO user_points (user_id, balance, total_charged) VALUES (?, ?, ?)',
          [member.user_id, member.deposit_amount, member.deposit_amount],
        );
      }
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('[user_points refund]', e);
    }

    // Best-effort sync to legacy users.deal_balance
    try {
      await executeRun(
        DB,
        'UPDATE users SET deal_balance = COALESCE(deal_balance, 0) + ? WHERE id = ?',
        [member.deposit_amount, member.user_id],
      );
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('[deal_balance]', e);
    }

    // 멤버 상태 변경
    await executeRun(
      DB,
      "UPDATE community_group_buy_members SET status = 'refunded' WHERE id = ?",
      [member.id],
    );

    // SECURITY (HIGH-6): idempotency 기록 (UNIQUE 제약으로 중복 삽입 방지)
    try {
      await executeRun(
        DB,
        "INSERT OR IGNORE INTO community_group_buy_refunds (group_id, user_id, amount, refunded_at) VALUES (?, ?, ?, datetime('now'))",
        [group.id, member.user_id, member.deposit_amount],
      );
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('[refund-idempotency]', e);
    }

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

  const groupIdRaw = c.req.param('id');
  const groupIdNum = Number(groupIdRaw);
  if (!Number.isFinite(groupIdNum) || groupIdNum <= 0 || !Number.isInteger(groupIdNum)) {
    return c.json({ success: false, error: '잘못된 공동구매 ID 입니다' }, 400);
  }
  const { status } = await c.req.json<{ status: string }>().catch(() => ({ status: '' }));

  const validStatuses = ['proposed', 'negotiating', 'confirmed', 'achieved', 'failed', 'refunded'];
  if (!status || !validStatuses.includes(status)) {
    return c.json({ success: false, error: `유효하지 않은 상태입니다. 가능한 값: ${validStatuses.join(', ')}` }, 400);
  }

  const group = await queryFirst<any>(
    DB,
    'SELECT * FROM community_group_buys WHERE id = ?',
    [groupIdNum],
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

// ── GET /popular — 50명 이상 그룹 (공개 목록) ───────────────────────────
// SECURITY (MED-3): 공개 엔드포인트이므로 PII(주소, 전화, 생성자 id) 제외
communityGroupBuyRoutes.get('/popular', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const groups = await executeQuery<any>(
    DB,
    `SELECT id, restaurant_name, proposed_price, confirmed_price,
            confirmed_discount_percent, deposit_per_person, target_count,
            current_count, status, invite_code, expires_at, created_at
     FROM community_group_buys
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

// 🛡️ 2026-05-13 (공구 UX Phase C): 에이전시 ↔ 식당 협상 메시지 채널
//   기존: "협상 시작" 버튼이 상태만 변경하고 실제 소통 도구 없음.
//   현재: messages 테이블 + 양방향 endpoint.
//   인증:
//     - 어드민 (admin token)
//     - 에이전시 (agency token)
//     - 공구 생성자 (creator_user_id = current user)
//     - 식당 (restaurant_seller_id 가 본인이거나, 향후 magic-link token 도 가능)
async function ensureMessagesTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS community_group_buy_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        sender_type TEXT NOT NULL CHECK(sender_type IN ('agency','restaurant','user','admin','system')),
        sender_id TEXT,
        sender_name TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cgb_messages_group ON community_group_buy_messages(group_id, created_at DESC)`).run()
  } catch { /* exists */ }
}

function canAccessGroupMessages(
  user: { id?: string | number; type?: string; role?: string } | null,
  group: { creator_user_id?: string; restaurant_seller_id?: string | number | null }
): { canRead: boolean; senderType: 'agency' | 'restaurant' | 'user' | 'admin' | null } {
  if (!user) return { canRead: false, senderType: null }
  if (user.type === 'admin' || user.role === 'admin') return { canRead: true, senderType: 'admin' }
  if (user.type === 'agency' || user.role === 'agency') return { canRead: true, senderType: 'agency' }
  if (user.type === 'seller' && group.restaurant_seller_id && String(group.restaurant_seller_id) === String(user.id)) {
    return { canRead: true, senderType: 'restaurant' }
  }
  if (group.creator_user_id && String(group.creator_user_id) === String(user.id)) {
    return { canRead: true, senderType: 'user' }
  }
  return { canRead: false, senderType: null }
}

// GET /:id/messages — 협상 스레드 조회
communityGroupBuyRoutes.get('/:id/messages', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const groupId = Number(c.req.param('id'))
  if (!Number.isFinite(groupId) || groupId <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  const { DB } = c.env
  await ensureMessagesTable(DB)

  const group = await queryFirst<{ id: number; creator_user_id: string; restaurant_seller_id: string | null }>(
    DB,
    'SELECT id, creator_user_id, restaurant_seller_id FROM community_group_buys WHERE id = ?',
    [groupId]
  )
  if (!group) return c.json({ success: false, error: '공동구매를 찾을 수 없습니다' }, 404)

  const userAsAny = user as unknown as { id: string | number; type?: string; role?: string }
  const { canRead } = canAccessGroupMessages(userAsAny, group)
  if (!canRead) return c.json({ success: false, error: '접근 권한 없음' }, 403)

  const messages = await executeQuery<{
    id: number; sender_type: string; sender_name: string | null; message: string; created_at: string
  }>(DB, `
    SELECT id, sender_type, sender_name, message, created_at
    FROM community_group_buy_messages
    WHERE group_id = ?
    ORDER BY created_at ASC
    LIMIT 200
  `, [groupId])

  return c.json({ success: true, data: messages })
})

// POST /:id/messages — 메시지 전송
communityGroupBuyRoutes.post('/:id/messages',
  rateLimit({ action: 'group_buy_message', max: 30, windowSec: 60 }),
  requireAuth(),
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
    const groupId = Number(c.req.param('id'))
    if (!Number.isFinite(groupId) || groupId <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

    const { message } = await c.req.json<{ message?: string }>().catch(() => ({ message: undefined }))
    if (!message || typeof message !== 'string') return c.json({ success: false, error: '메시지를 입력해주세요' }, 400)
    const clean = message.trim().replace(/<[^>]+>/g, '').slice(0, 1000)
    if (!clean) return c.json({ success: false, error: '메시지가 비어있습니다' }, 400)

    const { DB } = c.env
    await ensureMessagesTable(DB)

    const group = await queryFirst<{ id: number; creator_user_id: string; restaurant_seller_id: string | null; restaurant_name: string }>(
      DB,
      'SELECT id, creator_user_id, restaurant_seller_id, restaurant_name FROM community_group_buys WHERE id = ?',
      [groupId]
    )
    if (!group) return c.json({ success: false, error: '공동구매를 찾을 수 없습니다' }, 404)

    const userAsAny = user as unknown as { id: string | number; type?: string; role?: string; name?: string }
    const { canRead, senderType } = canAccessGroupMessages(userAsAny, group)
    if (!canRead || !senderType) return c.json({ success: false, error: '메시지 전송 권한 없음' }, 403)

    const senderName = userAsAny.name || (
      senderType === 'agency' ? '에이전시' :
      senderType === 'restaurant' ? '식당' :
      senderType === 'admin' ? '운영자' : '제안자'
    )

    await executeRun(DB, `
      INSERT INTO community_group_buy_messages (group_id, sender_type, sender_id, sender_name, message)
      VALUES (?, ?, ?, ?, ?)
    `, [groupId, senderType, String(userAsAny.id), senderName, clean])

    // 상대방에게 알림 (best-effort)
    try {
      // 발신자 외 모든 stakeholder 에게 알림
      const recipients: Array<{ user_id: string; user_type: string }> = []
      if (senderType !== 'user' && group.creator_user_id) {
        recipients.push({ user_id: group.creator_user_id, user_type: 'user' })
      }
      if (senderType !== 'restaurant' && group.restaurant_seller_id) {
        recipients.push({ user_id: String(group.restaurant_seller_id), user_type: 'seller' })
      }
      for (const r of recipients) {
        await DB.prepare(`
          INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
          VALUES (?, ?, 'group_buy_message', ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          r.user_id,
          r.user_type,
          `${senderName} 메시지`,
          clean.slice(0, 100) + (clean.length > 100 ? '...' : ''),
          `/community-group-buy/${groupId}/messages`
        ).run().catch(() => { /* notifications 없으면 skip */ })
      }
    } catch { /* ignore */ }

    return c.json({ success: true, message: '메시지 전송 완료' })
  }
)

export { communityGroupBuyRoutes };
