/**
 * Seller Ad Slots API (2026-05-05)
 *
 * Migration 0244 (ad_slots, ad_bids) 적용 후 동작.
 *
 * GET  /api/seller/ad-slots           — 전체 슬롯 + 내 입찰 현황
 * GET  /api/seller/ad-slots/my-bids   — 내 활성 입찰 목록
 * POST /api/seller/ad-slots/:id/bid   — 입찰 (현재 최고가 초과 필수)
 * POST /api/seller/ad-slots/:id/cancel-bid — 낙찰 전 입찰 취소
 *
 * 낙찰 로직: 매일 18시 배치 (cron/ad-slots-award.ts) 가
 *   slot 만료 + 최고가 입찰자를 won 으로 선정 + seller 알림.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { requireSeller } from '@/worker/middleware/auth';
import type { AuthUser } from '@/worker/middleware/auth';
import { swallow } from '@/worker/utils/swallow';

const app = new Hono<{ Bindings: Env }>();
// 🛡️ 2026-05-12: app.use('*', …) 를 /ad-slots 경로로 scope 한정.
//   이전: 이 sub-router 가 /api/seller 에 마운트되어 있어 '*' 가
//   /api/seller/youtube/live/create 등 무관한 경로까지 가로채 405 발생.
//   변경 후: ad-slots 관련 경로(루트 + 하위)에만 cors + requireSeller 적용.
app.use('/ad-slots', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));
app.use('/ad-slots/*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));
app.use('/ad-slots', requireSeller());
app.use('/ad-slots/*', requireSeller());

function getSellerIdFromCtx(c: { get: (k: string) => unknown }): number {
  const user = c.get('user') as AuthUser;
  return Number(user.id);
}

// GET /ad-slots — 전체 슬롯 목록 + 내 입찰 정보
app.get('/ad-slots', async (c) => {
  const sellerId = getSellerIdFromCtx(c);
  const DB = c.env.DB;

  const [slotsRes, myBidsRes] = await Promise.all([
    DB.prepare(`
      SELECT
        s.slot_id,
        s.display_name,
        s.description,
        s.base_price,
        s.current_seller_id,
        s.current_bid,
        s.starts_at,
        s.expires_at,
        s.is_active,
        sel.business_name AS current_winner_name,
        (
          SELECT MAX(b2.bid_amount) FROM ad_bids b2
          WHERE b2.slot_id = s.slot_id AND b2.status = 'active'
        ) AS top_bid,
        (
          SELECT COUNT(*) FROM ad_bids b3
          WHERE b3.slot_id = s.slot_id AND b3.status = 'active'
        ) AS bid_count
      FROM ad_slots s
      LEFT JOIN sellers sel ON sel.id = s.current_seller_id
      WHERE s.is_active = 1
      ORDER BY s.base_price DESC
    `).all<{
      slot_id: string; display_name: string; description: string;
      base_price: number; current_seller_id: number | null; current_bid: number | null;
      starts_at: string | null; expires_at: string | null; is_active: number;
      current_winner_name: string | null; top_bid: number | null; bid_count: number;
    }>().catch(() => ({ results: [] })),

    DB.prepare(`
      SELECT slot_id, bid_amount, status, created_at, start_period, end_period, payment_status
      FROM ad_bids
      WHERE seller_id = ? AND status IN ('active','won')
      ORDER BY created_at DESC
    `).bind(sellerId).all<{
      slot_id: string; bid_amount: number; status: string;
      created_at: string; start_period: string | null; end_period: string | null;
      payment_status: string;
    }>().catch(() => ({ results: [] })),
  ]);

  const myBidMap = new Map(myBidsRes.results.map(b => [b.slot_id, b]));

  const slots = slotsRes.results.map(s => ({
    ...s,
    my_bid: myBidMap.get(s.slot_id) ?? null,
    min_bid: Math.max(s.base_price, (s.top_bid ?? 0) + 1000),
    is_expired: s.expires_at ? new Date(s.expires_at) < new Date() : false,
  }));

  return c.json({ slots });
});

// GET /ad-slots/my-bids — 내 전체 입찰 이력
app.get('/ad-slots/my-bids', async (c) => {
  const sellerId = getSellerIdFromCtx(c);
  const bids = await c.env.DB.prepare(`
    SELECT b.id, b.slot_id, b.bid_amount, b.status, b.payment_status,
           b.created_at, b.start_period, b.end_period,
           s.display_name AS slot_name, s.description AS slot_description
    FROM ad_bids b
    JOIN ad_slots s ON s.slot_id = b.slot_id
    WHERE b.seller_id = ?
    ORDER BY b.created_at DESC
    LIMIT 50
  `).bind(sellerId).all().catch(() => ({ results: [] }));

  return c.json({ bids: bids.results });
});

// POST /ad-slots/:id/bid — 입찰
app.post('/ad-slots/:id/bid', async (c) => {
  const sellerId = getSellerIdFromCtx(c);
  const slotId = c.req.param('id');
  const DB = c.env.DB;

  let bidAmount: number;
  try {
    const body = await c.req.json<{ bid_amount: number }>();
    bidAmount = Math.floor(Number(body.bid_amount));
  } catch {
    return c.json({ error: '입찰가를 입력해주세요.' }, 400);
  }

  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return c.json({ error: '유효하지 않은 입찰가입니다.' }, 400);
  }

  const slot = await DB.prepare(`
    SELECT slot_id, base_price, current_bid, expires_at, is_active
    FROM ad_slots WHERE slot_id = ?
  `).bind(slotId).first<{
    slot_id: string; base_price: number; current_bid: number | null;
    expires_at: string | null; is_active: number;
  }>().catch(() => null);

  if (!slot) return c.json({ error: '슬롯을 찾을 수 없습니다.' }, 404);
  if (!slot.is_active) return c.json({ error: '비활성 슬롯입니다.' }, 409);
  if (slot.expires_at && new Date(slot.expires_at) < new Date()) {
    return c.json({ error: '입찰 기간이 종료된 슬롯입니다.' }, 409);
  }

  const currentTop = await DB.prepare(`
    SELECT MAX(bid_amount) AS top FROM ad_bids
    WHERE slot_id = ? AND status = 'active'
  `).bind(slotId).first<{ top: number | null }>().catch(() => null);

  const minBid = Math.max(slot.base_price, (currentTop?.top ?? 0) + 1000);
  if (bidAmount < minBid) {
    return c.json({ error: `최소 입찰가는 ${minBid.toLocaleString('ko-KR')}원입니다.`, min_bid: minBid }, 409);
  }

  // 기존 active 입찰 취소 후 새 입찰 등록 (같은 슬롯 중복 입찰 방지)
  await DB.batch([
    DB.prepare(`
      UPDATE ad_bids SET status = 'cancelled'
      WHERE seller_id = ? AND slot_id = ? AND status = 'active'
    `).bind(sellerId, slotId),
    DB.prepare(`
      INSERT INTO ad_bids (slot_id, seller_id, bid_amount, status, payment_status)
      VALUES (?, ?, ?, 'active', 'pending')
    `).bind(slotId, sellerId, bidAmount),
  ]).catch(swallow('seller:ad-slots:bid'));

  // 슬롯 current_bid 갱신 (최고가일 경우)
  if (bidAmount > (currentTop?.top ?? 0)) {
    await DB.prepare(`
      UPDATE ad_slots SET current_bid = ?, current_seller_id = ?
      WHERE slot_id = ?
    `).bind(bidAmount, sellerId, slotId).run().catch(swallow('seller:ad-slots:update-slot'));
  }

  return c.json({ ok: true, bid_amount: bidAmount, min_bid: minBid });
});

// POST /ad-slots/:id/cancel-bid — 입찰 취소 (낙찰 전만)
app.post('/ad-slots/:id/cancel-bid', async (c) => {
  const sellerId = getSellerIdFromCtx(c);
  const slotId = c.req.param('id');

  const result = await c.env.DB.prepare(`
    UPDATE ad_bids SET status = 'cancelled'
    WHERE seller_id = ? AND slot_id = ? AND status = 'active'
  `).bind(sellerId, slotId).run().catch(swallow('seller:ad-slots:cancel'));

  if (!result?.meta?.changes) {
    return c.json({ error: '취소할 입찰이 없습니다.' }, 404);
  }

  return c.json({ ok: true });
});

export { app as sellerAdSlotsRoutes };
