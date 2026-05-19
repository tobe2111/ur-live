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
import { executeRun, queryFirst } from '@/worker/utils/database';

import { swallow } from '@/worker/utils/swallow';
const timedealRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// 🛡️ 2026-05-19: per-worker 메모이제이션.
let _timedealTablesEnsured = false
async function ensureTables(DB: D1Database) {
  if (_done_ensureTables.has(DB)) return
  _done_ensureTables.add(DB)
  if (_timedealTablesEnsured) return
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
  _timedealTablesEnsured = true
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

  // 🛡️ 입력 검증: 양수 정수 + 합리적 범위
  const streamIdNum = Number(stream_id);
  const productIdNum = Number(product_id);
  const discountNum = Number(discount_percent);
  if (!Number.isInteger(streamIdNum) || streamIdNum < 1) {
    return c.json({ success: false, error: '유효하지 않은 stream_id' }, 400);
  }
  if (!Number.isInteger(productIdNum) || productIdNum < 1) {
    return c.json({ success: false, error: '유효하지 않은 product_id' }, 400);
  }
  if (!Number.isFinite(discountNum) || discountNum < 1 || discountNum > 99) {
    return c.json({ success: false, error: '할인율은 1~99 사이여야 합니다' }, 400);
  }
  const maxClaimsNum = max_claims == null ? 10 : Number(max_claims);
  if (!Number.isInteger(maxClaimsNum) || maxClaimsNum < 1 || maxClaimsNum > 100000) {
    return c.json({ success: false, error: 'max_claims 1~100000' }, 400);
  }
  const durNum = duration_seconds == null ? 30 : Number(duration_seconds);
  if (!Number.isInteger(durNum) || durNum < 5 || durNum > 86400) {
    return c.json({ success: false, error: 'duration_seconds 5~86400' }, 400);
  }
  const bonusNum = bonus_discount_percent == null ? 0 : Number(bonus_discount_percent);
  if (!Number.isFinite(bonusNum) || bonusNum < 0 || bonusNum > 99) {
    return c.json({ success: false, error: 'bonus_discount_percent 0~99' }, 400);
  }

  const product = await queryFirst<{ name: string; price: number; seller_id: number }>(
    DB,
    'SELECT name, price, seller_id FROM products WHERE id = ?',
    [productIdNum],
  );
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  // 🛡️ 권한 검증 (IDOR): 호출자가 product.seller_id 의 셀러 본인이어야 함.
  // user.id 는 auth context 의 셀러 id (셀러 로그인 시) 또는 일반 user id. 둘 다 비교.
  const callerId = String(user.id);
  if (String(product.seller_id) !== callerId) {
    return c.json({ success: false, error: '본인 상품만 타임딜 생성 가능' }, 403);
  }

  // 스트림 소유권 확인 (다른 셀러 방송에 타임딜 끼워넣기 방지)
  const stream = await queryFirst<{ seller_id: number }>(
    DB,
    'SELECT seller_id FROM live_streams WHERE id = ?',
    [streamIdNum],
  );
  if (!stream) return c.json({ success: false, error: '방송을 찾을 수 없습니다' }, 404);
  if (String(stream.seller_id) !== callerId) {
    return c.json({ success: false, error: '본인 방송에만 타임딜 생성 가능' }, 403);
  }

  const dur = durNum;
  const expiresAt = new Date(Date.now() + dur * 1000).toISOString();
  const dealPrice = Math.round(product.price * (100 - discountNum) / 100);

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
      streamIdNum,
      product.seller_id,
      productIdNum,
      product.name,
      product.price,
      dealPrice,
      discountNum,
      maxClaimsNum,
      dur,
      groupBuyFlag,
      groupBuyFlag ? target_participants : null,
      bonusNum,
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
          product_id: productIdNum,
          product_name: product.name,
          original_price: product.price,
          deal_price: dealPrice,
          discount_percent: discountNum,
          max_claims: maxClaimsNum,
          claimed_count: 0,
          duration_seconds: dur,
          expires_at: expiresAt,
        },
        timestamp: Date.now(),
      };
      const doId = c.env.LIVE_STREAM.idFromName(String(streamIdNum));
      const stub = c.env.LIVE_STREAM.get(doId);
      await stub.fetch(new Request('https://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': '1', 'X-Auth-User-Type': 'seller' },
        body: JSON.stringify(flashSaleMessage),
      }) as any);
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
        bonus_discount_percent: bonusNum,
      },
    },
    201,
  );
});

// GET /api/timedeal/stream/:streamId — 현재 활성 타임딜 + 공동구매 진행 정보
timedealRoutes.get('/stream/:streamId', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  // 🛡️ 입력 검증: 양수 정수만 허용
  const streamId = Number(c.req.param('streamId'));
  if (!Number.isInteger(streamId) || streamId < 1) {
    return c.json({ success: false, error: '유효하지 않은 streamId' }, 400);
  }
  const deal = await queryFirst<any>(
    DB,
    "SELECT * FROM time_deals WHERE stream_id = ? AND status IN ('active', 'achieved') ORDER BY id DESC LIMIT 1",
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

  // 🛡️ 입력 검증: 양수 정수만 허용
  const dealId = Number(c.req.param('id'));
  if (!Number.isInteger(dealId) || dealId < 1) {
    return c.json({ success: false, error: '유효하지 않은 deal id' }, 400);
  }
  const deal = await queryFirst<any>(
    DB,
    "SELECT * FROM time_deals WHERE id = ? AND status IN ('active', 'achieved')",
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

  // ✅ CONCURRENCY: UNIQUE(deal_id, user_id) prevents double-claim. Use try/catch
  //   on INSERT instead of SELECT-then-INSERT (race condition).
  try {
    const insertRes = await executeRun(
      DB,
      'INSERT INTO time_deal_claims (deal_id, user_id) VALUES (?, ?)',
      [dealId, user.id],
    );
    if ((insertRes.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '이미 참여하셨습니다' }, 409);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE|constraint/i.test(msg)) {
      return c.json({ success: false, error: '이미 참여하셨습니다' }, 409);
    }
    throw e;
  }

  // ✅ CONCURRENCY: cap claimed_count at max_claims atomically. If the cap is
  //   already reached due to a race, the UPDATE affects 0 rows — roll back the
  //   claim insert and report sold_out.
  const incRes = await executeRun(
    DB,
    'UPDATE time_deals SET claimed_count = claimed_count + 1 WHERE id = ? AND claimed_count < max_claims',
    [dealId],
  );
  if ((incRes.meta?.changes ?? 0) === 0) {
    await executeRun(DB, 'DELETE FROM time_deal_claims WHERE deal_id = ? AND user_id = ?', [dealId, user.id]).catch(swallow('timedeal:claim-rollback'));
    await executeRun(DB, "UPDATE time_deals SET status = 'sold_out' WHERE id = ?", [dealId]).catch(swallow('timedeal:soldout'));
    return c.json({ success: false, error: '수량이 소진되었습니다' }, 400);
  }

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
    )`).run().catch(swallow('timedeal:api:timedeal'));

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
  // 🛡️ 입력 검증: 양수 정수만 허용
  const idNum = Number(c.req.param('id'));
  if (!Number.isInteger(idNum) || idNum < 1) {
    return c.json({ success: false, error: '유효하지 않은 id' }, 400);
  }
  const deal = await DB.prepare('SELECT * FROM time_deals WHERE id = ?').bind(idNum).first<any>();
  if (!deal) return c.json({ success: false, error: '타임딜을 찾을 수 없습니다' }, 404);
  return c.json({ success: true, data: deal });
});

export { timedealRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTables = new WeakSet<object>()
