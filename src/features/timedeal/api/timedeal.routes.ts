/**
 * 타임딜 룰렛 API
 *
 * POST /api/timedeal/create          - 타임딜 생성 (셀러)
 * GET  /api/timedeal/stream/:streamId - 현재 활성 타임딜
 * POST /api/timedeal/:id/claim       - 타임딜 클레임 (시청자)
 * GET  /api/timedeal/:id             - 타임딜 상세
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { executeRun, queryFirst } from '@/worker/utils/database';

const timedealRoutes = new Hono<{ Bindings: Env }>();

timedealRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS time_deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        original_price INTEGER NOT NULL,
        deal_price INTEGER NOT NULL,
        discount_percent INTEGER NOT NULL,
        max_claims INTEGER NOT NULL DEFAULT 10,
        claimed_count INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 30,
        is_group_buy INTEGER DEFAULT 0,
        target_participants INTEGER,
        bonus_discount_percent INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'sold_out', 'achieved')),
        triggered_at DATETIME DEFAULT (datetime('now')),
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch {}
  // 마이그레이션: 기존 테이블에 공동구매 컬럼 추가
  for (const sql of [
    "ALTER TABLE time_deals ADD COLUMN is_group_buy INTEGER DEFAULT 0",
    "ALTER TABLE time_deals ADD COLUMN target_participants INTEGER",
    "ALTER TABLE time_deals ADD COLUMN bonus_discount_percent INTEGER DEFAULT 0",
  ]) {
    try { await DB.prepare(sql).run(); } catch {}
  }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS time_deal_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deal_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(deal_id, user_id)
      )
    `).run();
  } catch {}
}

// POST /api/timedeal/create — 셀러가 타임딜 / 라이브 공동구매 트리거
timedealRoutes.post('/create', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const {
    stream_id,
    product_id,
    discount_percent,
    max_claims,
    duration_seconds,
    is_group_buy,
    target_participants,
    bonus_discount_percent,
  } = await c.req.json<{
    stream_id: number;
    product_id: number;
    discount_percent: number;
    max_claims?: number;
    duration_seconds?: number;
    is_group_buy?: boolean | number;
    target_participants?: number;
    bonus_discount_percent?: number;
  }>();

  if (!stream_id || !product_id || !discount_percent) return c.json({ success: false, error: '필수 항목 누락' }, 400);

  const product = await queryFirst<{ name: string; price: number; seller_id: number }>(
    DB,
    'SELECT name, price, seller_id FROM products WHERE id = ?',
    [product_id],
  );
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  const dur = duration_seconds || 30;
  const expiresAt = new Date(Date.now() + dur * 1000).toISOString();
  const dealPrice = Math.round(product.price * (100 - discount_percent) / 100);

  // 공동구매 모드인 경우 target_participants 필수
  const groupBuyFlag = is_group_buy ? 1 : 0;
  if (groupBuyFlag && (!target_participants || target_participants < 1)) {
    return c.json({ success: false, error: '공동구매는 목표 참여자 수가 필요합니다' }, 400);
  }

  const result = await executeRun(
    DB,
    `INSERT INTO time_deals (
        stream_id, seller_id, product_id, product_name, original_price, deal_price,
        discount_percent, max_claims, duration_seconds,
        is_group_buy, target_participants, bonus_discount_percent, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      stream_id,
      product.seller_id,
      product_id,
      product.name,
      product.price,
      dealPrice,
      discount_percent,
      max_claims || 10,
      dur,
      groupBuyFlag,
      groupBuyFlag ? target_participants : null,
      bonus_discount_percent || 0,
      expiresAt,
    ],
  );

  const dealId = result.meta.last_row_id;

  // Broadcast flash_sale event to all viewers via Durable Object (non-fatal)
  try {
    if (c.env.LIVE_STREAM) {
      const flashSaleMessage = {
        type: 'flash_sale',
        data: {
          deal_id: dealId,
          product_id: product_id,
          product_name: product.name,
          original_price: product.price,
          deal_price: dealPrice,
          discount_percent: discount_percent,
          max_claims: max_claims || 10,
          claimed_count: 0,
          duration_seconds: dur,
          expires_at: expiresAt,
        },
        timestamp: Date.now(),
      };
      const doId = c.env.LIVE_STREAM.idFromName(String(stream_id));
      const stub = c.env.LIVE_STREAM.get(doId);
      await stub.fetch('https://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': '1', 'X-Auth-User-Type': 'seller' },
        body: JSON.stringify(flashSaleMessage),
      });
    }
  } catch (e) {
    if (import.meta.env.DEV) console.error('[TimeDeal] DO broadcast failed:', e);
  }

  return c.json(
    {
      success: true,
      data: {
        id: dealId,
        deal_price: dealPrice,
        expires_at: expiresAt,
        is_group_buy: !!groupBuyFlag,
        target_participants: groupBuyFlag ? target_participants : null,
        bonus_discount_percent: bonus_discount_percent || 0,
      },
    },
    201,
  );
});

// GET /api/timedeal/stream/:streamId — 현재 활성 타임딜 + 공동구매 진행 정보
timedealRoutes.get('/stream/:streamId', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const streamId = c.req.param('streamId');
  const deal = await queryFirst<any>(
    DB,
    "SELECT id, stream_id, seller_id, product_id, product_name, original_price, deal_price, discount_percent, max_claims, claimed_count, duration_seconds, is_group_buy, target_participants, bonus_discount_percent, status, triggered_at, expires_at, created_at FROM time_deals WHERE stream_id = ? AND status IN ('active', 'achieved') ORDER BY id DESC LIMIT 1",
    [streamId],
  );

  if (!deal) return c.json({ success: true, data: null });

  // 시간 만료 / 수량 소진 시 상태 업데이트 (achieved 상태는 유지)
  if (deal.status === 'active' && (new Date(deal.expires_at) < new Date() || deal.claimed_count >= deal.max_claims)) {
    const newStatus = deal.claimed_count >= deal.max_claims ? 'sold_out' : 'ended';
    await executeRun(DB, "UPDATE time_deals SET status = ? WHERE id = ?", [newStatus, deal.id]);
    deal.status = newStatus;
  }

  // 공동구매 진행 정보 계산
  const isGroupBuy = !!deal.is_group_buy;
  const target = deal.target_participants || 0;
  const current = deal.claimed_count || 0;
  const targetReached = isGroupBuy && target > 0 && current >= target;
  const bonus = deal.bonus_discount_percent || 0;
  const effectiveDiscount = targetReached ? deal.discount_percent + bonus : deal.discount_percent;
  const effectivePrice = Math.round(deal.original_price * (100 - effectiveDiscount) / 100);

  const groupBuyInfo = isGroupBuy
    ? {
        is_group_buy: true,
        target_participants: target,
        current_participants: current,
        progress_percent: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
        target_reached: targetReached,
        bonus_discount_percent: bonus,
        effective_discount_percent: effectiveDiscount,
        effective_price: effectivePrice,
        remaining: Math.max(0, target - current),
      }
    : { is_group_buy: false };

  return c.json({ success: true, data: { ...deal, ...groupBuyInfo } });
});

// POST /api/timedeal/:id/claim — 타임딜 / 공동구매 클레임
timedealRoutes.post('/:id/claim', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const dealId = Number(c.req.param('id'));
  const deal = await queryFirst<any>(
    DB,
    "SELECT id, stream_id, seller_id, product_id, product_name, original_price, deal_price, discount_percent, max_claims, claimed_count, duration_seconds, is_group_buy, target_participants, bonus_discount_percent, status, triggered_at, expires_at, created_at FROM time_deals WHERE id = ? AND status IN ('active', 'achieved')",
    [dealId],
  );

  if (!deal) return c.json({ success: false, error: '타임딜이 종료되었습니다' }, 404);
  if (new Date(deal.expires_at) < new Date()) {
    // 공동구매 목표 달성 상태는 유지 (이미 achieved면 만료되어도 남김)
    if (deal.status === 'active') {
      await executeRun(DB, "UPDATE time_deals SET status = 'ended' WHERE id = ?", [dealId]);
    }
    return c.json({ success: false, error: '시간이 초과되었습니다' }, 400);
  }
  if (deal.claimed_count >= deal.max_claims) {
    await executeRun(DB, "UPDATE time_deals SET status = 'sold_out' WHERE id = ?", [dealId]);
    return c.json({ success: false, error: '수량이 소진되었습니다' }, 400);
  }

  // 중복 체크
  const existing = await queryFirst(
    DB,
    'SELECT id FROM time_deal_claims WHERE deal_id = ? AND user_id = ?',
    [dealId, user.id],
  );
  if (existing) return c.json({ success: false, error: '이미 참여하셨습니다' }, 409);

  await executeRun(DB, 'INSERT INTO time_deal_claims (deal_id, user_id) VALUES (?, ?)', [dealId, user.id]);
  await executeRun(DB, 'UPDATE time_deals SET claimed_count = claimed_count + 1 WHERE id = ?', [dealId]);

  // 공동구매: 목표 달성 여부 평가 → status='achieved' 및 효과 할인율 계산
  const newCount = (deal.claimed_count || 0) + 1;
  const isGroupBuy = !!deal.is_group_buy;
  const target = deal.target_participants || 0;
  const justAchieved =
    isGroupBuy &&
    target > 0 &&
    newCount >= target &&
    deal.status !== 'achieved';

  if (justAchieved) {
    await executeRun(DB, "UPDATE time_deals SET status = 'achieved' WHERE id = ?", [dealId]);
  }

  const targetReached = isGroupBuy && target > 0 && newCount >= target;
  const bonus = deal.bonus_discount_percent || 0;
  const effectiveDiscount = targetReached ? deal.discount_percent + bonus : deal.discount_percent;
  const effectivePrice = Math.round(deal.original_price * (100 - effectiveDiscount) / 100);

  // 장바구니에 실제 적용 가격으로 자동 추가
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1, price_snapshot INTEGER, option_id INTEGER, option_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, product_id, option_value)
    )`).run().catch(() => {});

    await executeRun(
      DB,
      `INSERT OR REPLACE INTO cart_items (user_id, product_id, quantity, price_snapshot, created_at)
       VALUES (?, ?, 1, ?, datetime('now'))`,
      [user.id, deal.product_id, effectivePrice],
    );
  } catch {}

  return c.json({
    success: true,
    data: {
      deal_price: effectivePrice,
      original_deal_price: deal.deal_price,
      product_id: deal.product_id,
      added_to_cart: true,
      is_group_buy: isGroupBuy,
      current_participants: newCount,
      target_participants: isGroupBuy ? target : null,
      target_reached: targetReached,
      just_achieved: justAchieved,
      effective_discount_percent: effectiveDiscount,
      bonus_discount_percent: bonus,
    },
  });
});

// GET /api/timedeal/:id
timedealRoutes.get('/:id', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);
  const deal = await DB.prepare('SELECT id, stream_id, seller_id, product_id, product_name, original_price, deal_price, discount_percent, max_claims, claimed_count, duration_seconds, is_group_buy, target_participants, bonus_discount_percent, status, triggered_at, expires_at, created_at FROM time_deals WHERE id = ?').bind(c.req.param('id')).first<any>();
  if (!deal) return c.json({ success: false, error: '타임딜을 찾을 수 없습니다' }, 404);
  return c.json({ success: true, data: deal });
});

export { timedealRoutes };
