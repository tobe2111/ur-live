/**
 * 유저 공동구매 — Actions Routes (상태 변경 / 결제)
 *
 * POST  /create       — 공동구매 생성 (딜 보증금 차감)
 * POST  /join/:code   — 초대코드로 참여
 * PATCH /:id/confirm  — 식당/어드민 딜 확정
 * POST  /:id/refund   — 보증금 환불 (실패/만료)
 * PATCH /:id/status   — 어드민 상태 변경
 */

import { Hono } from 'hono';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { executeRun, executeQuery, queryFirst } from '@/worker/utils/database';
import { ensureUserPointsTable } from '@/worker/utils/ensure-tables';
import { ensureTables, ensureRefundTable, generateInviteCode } from './community-group-buy-helpers';

const communityGroupBuyActionsRoutes = new Hono<{ Bindings: Env }>();

// ── POST /create — 공동구매 생성 ──────────────────────────────────────
communityGroupBuyActionsRoutes.post('/create', requireAuth(), async (c) => {
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
communityGroupBuyActionsRoutes.post('/join/:code', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const code = c.req.param('code');
  const userId = String(user.id);

  // 공동구매 조회
  const group = await queryFirst<any>(
    DB,
    "SELECT id, creator_user_id, creator_name, restaurant_name, restaurant_address, restaurant_phone, restaurant_lat, restaurant_lng, proposed_price, deposit_per_person, target_count, current_count, total_deposited, status, invite_code, confirmed_price, confirmed_discount_percent, restaurant_seller_id, expires_at, created_at FROM community_group_buys WHERE invite_code = ?",
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
            '🔥 인기 맛집 공구 알림',
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

// ── PATCH /:id/confirm — 식당/어드민 딜 확정 (Phase 2) ────────────────
communityGroupBuyActionsRoutes.patch('/:id/confirm', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const groupId = c.req.param('id');

  const group = await queryFirst<any>(
    DB,
    'SELECT id, creator_user_id, creator_name, restaurant_name, restaurant_address, restaurant_phone, restaurant_lat, restaurant_lng, proposed_price, deposit_per_person, target_count, current_count, total_deposited, status, invite_code, confirmed_price, confirmed_discount_percent, restaurant_seller_id, expires_at, created_at FROM community_group_buys WHERE id = ?',
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
communityGroupBuyActionsRoutes.post('/:id/refund', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const groupId = c.req.param('id');

  const group = await queryFirst<any>(
    DB,
    'SELECT id, creator_user_id, creator_name, restaurant_name, restaurant_address, restaurant_phone, restaurant_lat, restaurant_lng, proposed_price, deposit_per_person, target_count, current_count, total_deposited, status, invite_code, confirmed_price, confirmed_discount_percent, restaurant_seller_id, expires_at, created_at FROM community_group_buys WHERE id = ?',
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
    "SELECT id, group_buy_id, user_id, user_name, deposit_amount, status, joined_at FROM community_group_buy_members WHERE group_buy_id = ? AND status = 'deposited'",
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
communityGroupBuyActionsRoutes.patch('/:id/status', requireAuth(), async (c) => {
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
    'SELECT id, creator_user_id, creator_name, restaurant_name, restaurant_address, restaurant_phone, restaurant_lat, restaurant_lng, proposed_price, deposit_per_person, target_count, current_count, total_deposited, status, invite_code, confirmed_price, confirmed_discount_percent, restaurant_seller_id, expires_at, created_at FROM community_group_buys WHERE id = ?',
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

export { communityGroupBuyActionsRoutes };
