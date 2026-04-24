/**
 * 유저 공동구매 — Browse Routes (읽기 전용)
 *
 * GET /detail/:code  — 공동구매 상세 + 멤버 목록
 * GET /list          — 활성 공동구매 목록 (페이지네이션)
 * GET /my            — 내 공동구매 (생성 + 참여)
 * GET /popular       — 50명 이상 그룹 (공개)
 */

import { Hono } from 'hono';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { executeRun, executeQuery, queryFirst } from '@/worker/utils/database';
import { ensureTables } from './community-group-buy-helpers';

const communityGroupBuyBrowseRoutes = new Hono<{ Bindings: Env }>();

// ── GET /detail/:code — 공동구매 상세 + 멤버 목록 ─────────────────────
communityGroupBuyBrowseRoutes.get('/detail/:code', async (c) => {
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
communityGroupBuyBrowseRoutes.get('/list', async (c) => {
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
communityGroupBuyBrowseRoutes.get('/my', requireAuth(), async (c) => {
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

// ── GET /popular — 50명 이상 그룹 (공개 목록) ───────────────────────────
// SECURITY (MED-3): 공개 엔드포인트이므로 PII(주소, 전화, 생성자 id) 제외
communityGroupBuyBrowseRoutes.get('/popular', async (c) => {
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

export { communityGroupBuyBrowseRoutes };
