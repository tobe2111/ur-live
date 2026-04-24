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
import { executeRun, executeQuery, queryFirst } from '@/worker/utils/database';
import { notifyUser } from '@/lib/notifications';

const referralRoutes = new Hono<{ Bindings: Env }>();

referralRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

export interface ReferralTier {
  count: number;
  discount: number;
}

/**
 * 티어 배열을 안전하게 파싱 (문자열 또는 배열 허용)
 */
function parseTiers(raw: unknown): ReferralTier[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t) => t && typeof t.count === 'number' && typeof t.discount === 'number')
      .map((t) => ({ count: Number(t.count), discount: Number(t.discount) }))
      .sort((a, b) => a.count - b.count);
  } catch {
    return [];
  }
}

/**
 * 현재 참여 인원수 기반으로 달성된 최고 티어를 반환
 */
function getUnlockedTier(tiers: ReferralTier[], currentCount: number): ReferralTier | null {
  if (!tiers.length) return null;
  let unlocked: ReferralTier | null = null;
  for (const tier of tiers) {
    if (currentCount >= tier.count) {
      if (!unlocked || tier.discount > unlocked.discount) unlocked = tier;
    }
  }
  return unlocked;
}

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
        tiers TEXT,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'achieved', 'expired', 'cancelled')),
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch {}
  // 마이그레이션: 기존 테이블에 tiers 컬럼 추가
  try { await DB.prepare("ALTER TABLE referral_groups ADD COLUMN tiers TEXT").run(); } catch {}
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

// 🛡️ 2026-04-22: Math.random → crypto.getRandomValues (guessable code 방어)
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
  return code;
}

// POST /api/referral/create — 그룹 생성 (티어 또는 단일 할인)
referralRoutes.post('/create', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const { product_id, target_count, discount_per_person, discount_percent, tiers } = await c.req.json<{
    product_id: number;
    target_count?: number;
    discount_per_person?: number;
    discount_percent?: number;
    tiers?: ReferralTier[];
  }>();

  if (!product_id) return c.json({ success: false, error: '상품 ID 필요' }, 400);

  const product = await queryFirst<{ id: number; name: string; price: number }>(
    DB,
    'SELECT id, name, price FROM products WHERE id = ? AND is_active = 1',
    [product_id],
  );
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48시간

  // 티어 우선, 없으면 단일 discount_percent 기반으로 폴백
  const parsedTiers = parseTiers(tiers);
  const hasTiers = parsedTiers.length > 0;
  const tiersJson = hasTiers ? JSON.stringify(parsedTiers) : null;

  // target_count: 티어가 있으면 최고 티어의 count, 없으면 입력값 또는 3
  const target = hasTiers
    ? parsedTiers[parsedTiers.length - 1].count
    : (target_count || 3);

  // 초기 discount_percent: 생성자 1명 기준 (생성자는 tier 조건 count=1 이상일 때만 적용)
  // 일반적으로 creator 혼자서는 티어를 달성하지 못함 → 0
  const initialDiscount = hasTiers
    ? (getUnlockedTier(parsedTiers, 1)?.discount ?? 0)
    : (discount_percent || 10);

  const result = await executeRun(
    DB,
    `INSERT INTO referral_groups (product_id, creator_user_id, creator_name, invite_code, target_count, discount_per_person, discount_percent, tiers, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [product_id, user.id, user.name || '익명', code, target, discount_per_person || 0, initialDiscount, tiersJson, expiresAt],
  );

  // 생성자도 멤버로 추가
  await executeRun(
    DB,
    'INSERT INTO referral_members (group_id, user_id, user_name) VALUES (?, ?, ?)',
    [result.meta.last_row_id, user.id, user.name || '익명'],
  );

  return c.json(
    {
      success: true,
      data: {
        id: result.meta.last_row_id,
        invite_code: code,
        expires_at: expiresAt,
        tiers: parsedTiers,
        discount_percent: initialDiscount,
      },
    },
    201,
  );
});

// POST /api/referral/join/:code — 그룹 참여 (티어 재계산)
referralRoutes.post('/join/:code', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const code = c.req.param('code');
  const group = await queryFirst<any>(
    DB,
    "SELECT id, product_id, creator_user_id, creator_name, invite_code, target_count, current_count, discount_per_person, discount_percent, tiers, status, expires_at, created_at FROM referral_groups WHERE invite_code = ? AND status = 'open'",
    [code],
  );

  if (!group) return c.json({ success: false, error: '유효하지 않은 초대 코드입니다' }, 404);
  if (new Date(group.expires_at) < new Date()) {
    await executeRun(DB, "UPDATE referral_groups SET status = 'expired' WHERE id = ?", [group.id]);
    return c.json({ success: false, error: '초대가 만료되었습니다' }, 400);
  }

  const existing = await queryFirst(
    DB,
    'SELECT id FROM referral_members WHERE group_id = ? AND user_id = ?',
    [group.id, user.id],
  );
  if (existing) return c.json({ success: false, error: '이미 참여 중입니다' }, 409);

  // ✅ SECURITY FIX (H6): Prevent socket-puppet group-buy abuse — reject if
  //    this user has already joined any group for the same product within
  //    the last 30 days. Without this guard a user can join many dummy
  //    groups and unlock higher discount tiers alone.
  const recent = await queryFirst<{ id: number }>(
    DB,
    `SELECT rg.id FROM referral_groups rg
     JOIN referral_members rgm ON rgm.group_id = rg.id
     WHERE rg.product_id = ? AND rgm.user_id = ? AND rg.created_at > datetime('now', '-30 days')
     LIMIT 1`,
    [group.product_id, user.id],
  );
  if (recent) {
    return c.json({ success: false, error: '이미 참여한 공구 상품입니다 (30일 이내)' }, 409);
  }

  await executeRun(
    DB,
    'INSERT INTO referral_members (group_id, user_id, user_name) VALUES (?, ?, ?)',
    [group.id, user.id, user.name || '익명'],
  );

  const newCount = group.current_count + 1;
  const tiers = parseTiers(group.tiers);
  const hasTiers = tiers.length > 0;

  // 현재 달성 티어 계산 → discount_percent 업데이트
  const previousUnlocked = hasTiers ? getUnlockedTier(tiers, group.current_count) : null;
  const unlocked = hasTiers ? getUnlockedTier(tiers, newCount) : null;
  const newDiscount = hasTiers
    ? (unlocked?.discount ?? 0)
    : group.discount_percent;

  // 달성 여부: 티어가 있으면 최고 티어 달성 시, 없으면 target_count 충족 시
  const topTierReached = hasTiers && newCount >= tiers[tiers.length - 1].count;
  const targetReached = !hasTiers && newCount >= group.target_count;
  const newStatus = topTierReached || targetReached ? 'achieved' : 'open';
  const wasOpen = group.status === 'open';
  const statusBecameAchieved = wasOpen && newStatus === 'achieved';

  await executeRun(
    DB,
    'UPDATE referral_groups SET current_count = ?, status = ?, discount_percent = ? WHERE id = ?',
    [newCount, newStatus, newDiscount, group.id],
  );

  // 알림 발송 (fire-and-forget) — 실패해도 응답에 영향 없음
  try {
    // 티어 마일스톤 달성 알림: 새로 해금된 티어가 있고 최종 목표는 아닐 때
    const tierNewlyUnlocked =
      hasTiers &&
      !statusBecameAchieved &&
      unlocked &&
      (!previousUnlocked || unlocked.count > previousUnlocked.count);

    if (statusBecameAchieved || tierNewlyUnlocked) {
      const product = await queryFirst<{ name: string }>(
        DB,
        'SELECT name FROM products WHERE id = ?',
        [group.product_id],
      );
      const productName = product?.name ?? '상품';

      const members = await executeQuery<{ user_id: string }>(
        DB,
        'SELECT user_id FROM referral_members WHERE group_id = ?',
        [group.id],
      );

      if (statusBecameAchieved) {
        const title = '🎁 공동구매 목표 달성!';
        const message = `"${productName}" 공동구매가 목표 인원에 도달했습니다! 지금 바로 결제하세요.`;
        const link = `/referral/${group.invite_code}`;
        for (const m of members) {
          notifyUser(DB, m.user_id, 'group_buy_achieved', title, message, link).catch(() => {});
        }
      } else if (tierNewlyUnlocked && unlocked) {
        const title = `🎯 ${unlocked.count}명 달성!`;
        const message = `지금 ${unlocked.discount}% 할인이 적용됐어요!`;
        const link = `/referral/${group.invite_code}`;
        for (const m of members) {
          notifyUser(DB, m.user_id, 'group_buy_tier_unlocked', title, message, link).catch(() => {});
        }
      }
    }
  } catch {
    // 알림 실패는 조용히 무시
  }

  return c.json({
    success: true,
    data: {
      current_count: newCount,
      target_count: group.target_count,
      achieved: newStatus === 'achieved',
      discount_percent: newDiscount,
      unlocked_tier: unlocked,
      tiers,
    },
  });
});

// GET /api/referral/discount/:productId — 해당 상품에 대한 유저의 최고 달성 할인 조회 (티어 반영)
referralRoutes.get('/discount/:productId', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: true, data: null });

  const { DB } = c.env;
  await ensureTables(DB);

  const productId = c.req.param('productId');

  // 유저가 참여한 모든 그룹 (open + achieved 모두 포함하여 티어 기반 할인 평가)
  const rows = await executeQuery<any>(
    DB,
    `SELECT g.id, g.discount_percent, g.discount_per_person, g.invite_code,
            g.tiers, g.current_count, g.status
     FROM referral_groups g
     JOIN referral_members m ON m.group_id = g.id
     WHERE g.product_id = ? AND m.user_id = ? AND g.status IN ('open', 'achieved')
     ORDER BY g.created_at DESC`,
    [productId, user.id],
  );

  if (!rows.length) return c.json({ success: true, data: null });

  // 각 그룹에서 실제 달성된 최고 할인을 계산 → 최대값 선택
  let best: { discount_percent: number; group_id: number; invite_code: string; unlocked_tier: ReferralTier | null } | null = null;
  for (const g of rows) {
    const tiers = parseTiers(g.tiers);
    const unlocked = tiers.length > 0 ? getUnlockedTier(tiers, g.current_count) : null;
    const effective = tiers.length > 0 ? (unlocked?.discount ?? 0) : (g.status === 'achieved' ? g.discount_percent : 0);
    if (effective > 0 && (!best || effective > best.discount_percent)) {
      best = {
        discount_percent: effective,
        group_id: g.id,
        invite_code: g.invite_code,
        unlocked_tier: unlocked,
      };
    }
  }

  if (!best) return c.json({ success: true, data: null });
  return c.json({ success: true, data: best });
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
  const rows = await executeQuery<any>(
    DB,
    `SELECT id, invite_code, target_count, current_count, discount_percent, discount_per_person, tiers, expires_at, creator_name
     FROM referral_groups
     WHERE product_id = ? AND status = 'open' AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 10`,
    [productId],
  );

  const enriched = rows.map((g) => {
    const tiers = parseTiers(g.tiers);
    return {
      ...g,
      tiers,
      unlocked_tier: tiers.length > 0 ? getUnlockedTier(tiers, g.current_count) : null,
    };
  });

  return c.json({ success: true, data: enriched });
});

// GET /api/referral/:code — 그룹 상세 (티어 정보 포함)
referralRoutes.get('/:code', optionalAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const code = c.req.param('code');
  const group = await queryFirst<any>(
    DB,
    'SELECT id, product_id, creator_user_id, creator_name, invite_code, target_count, current_count, discount_per_person, discount_percent, tiers, status, expires_at, created_at FROM referral_groups WHERE invite_code = ?',
    [code],
  );
  if (!group) return c.json({ success: false, error: '그룹을 찾을 수 없습니다' }, 404);

  const product = await queryFirst(
    DB,
    'SELECT id, name, price, image_url FROM products WHERE id = ?',
    [group.product_id],
  );
  const members = await executeQuery(
    DB,
    'SELECT user_name, joined_at FROM referral_members WHERE group_id = ? ORDER BY joined_at',
    [group.id],
  );

  const tiers = parseTiers(group.tiers);
  const unlockedTier = tiers.length > 0 ? getUnlockedTier(tiers, group.current_count) : null;
  // 다음 목표 티어 (아직 달성되지 않은 최소 count 티어)
  const nextTier = tiers.find((t) => group.current_count < t.count) ?? null;

  return c.json({
    success: true,
    data: {
      ...group,
      tiers,
      unlocked_tier: unlockedTier,
      next_tier: nextTier,
      product,
      members,
    },
  });
});

export { referralRoutes };
