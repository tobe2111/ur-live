/**
 * 라이브 경매 시스템 API
 *
 * POST /api/auction/create       - 경매 생성 (셀러)
 * POST /api/auction/:id/bid      - 입찰 (시청자)
 * GET  /api/auction/stream/:streamId - 현재 활성 경매 조회
 * POST /api/auction/:id/end      - 경매 종료 (셀러)
 * GET  /api/auction/:id          - 경매 상세
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const auctionRoutes = new Hono<{ Bindings: Env }>();

auctionRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS live_auctions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        product_id INTEGER,
        title TEXT NOT NULL,
        start_price INTEGER NOT NULL DEFAULT 0,
        current_price INTEGER NOT NULL DEFAULT 0,
        min_increment INTEGER NOT NULL DEFAULT 1000,
        bid_count INTEGER NOT NULL DEFAULT 0,
        winner_user_id TEXT,
        winner_name TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
        duration_seconds INTEGER NOT NULL DEFAULT 180,
        started_at DATETIME DEFAULT (datetime('now')),
        ends_at DATETIME,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch {}
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS auction_bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auction_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch {}
}

// POST /api/auction/create — 셀러가 경매 시작
auctionRoutes.post('/create', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const { stream_id, product_id, title, start_price, min_increment, duration_seconds } = await c.req.json<{
    stream_id: number; product_id?: number; title: string;
    start_price: number; min_increment?: number; duration_seconds?: number;
  }>();

  if (!stream_id || !title) return c.json({ success: false, error: '필수 항목 누락' }, 400);

  // 셀러 확인
  const stream = await DB.prepare('SELECT seller_id FROM live_streams WHERE id = ?').bind(stream_id).first<{ seller_id: number }>();
  if (!stream) return c.json({ success: false, error: '방송을 찾을 수 없습니다' }, 404);

  const dur = duration_seconds || 180;
  const endsAt = new Date(Date.now() + dur * 1000).toISOString();

  const result = await DB.prepare(`
    INSERT INTO live_auctions (stream_id, seller_id, product_id, title, start_price, current_price, min_increment, duration_seconds, ends_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(stream_id, stream.seller_id, product_id ?? null, title, start_price, start_price, min_increment || 1000, dur, endsAt).run();

  return c.json({ success: true, data: { id: result.meta.last_row_id, ends_at: endsAt } }, 201);
});

// POST /api/auction/:id/bid — 입찰
auctionRoutes.post('/:id/bid', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const auctionId = Number(c.req.param('id'));
  const { amount } = await c.req.json<{ amount: number }>();

  const auction = await DB.prepare(
    "SELECT * FROM live_auctions WHERE id = ? AND status = 'active'"
  ).bind(auctionId).first<any>();

  if (!auction) return c.json({ success: false, error: '활성 경매가 없습니다' }, 404);
  if (new Date(auction.ends_at) < new Date()) {
    await DB.prepare("UPDATE live_auctions SET status = 'ended' WHERE id = ?").bind(auctionId).run();
    return c.json({ success: false, error: '경매가 종료되었습니다' }, 400);
  }
  if (amount < auction.current_price + auction.min_increment) {
    return c.json({ success: false, error: `최소 ${(auction.current_price + auction.min_increment).toLocaleString()}원 이상 입찰해주세요` }, 400);
  }

  await DB.prepare('INSERT INTO auction_bids (auction_id, user_id, user_name, amount) VALUES (?, ?, ?, ?)')
    .bind(auctionId, user.id, user.name || '익명', amount).run();

  // conditional update: current_price < amount 일 때만 갱신 (동시 입찰 race condition 방지)
  const updateResult = await DB.prepare(
    'UPDATE live_auctions SET current_price = ?, bid_count = bid_count + 1, winner_user_id = ?, winner_name = ? WHERE id = ? AND current_price < ?'
  ).bind(amount, user.id, user.name || '익명', auctionId, amount).run();

  if (!updateResult.meta.changes) {
    return c.json({ success: false, error: '다른 입찰자가 더 높은 금액을 입찰했습니다. 다시 시도해주세요.' }, 409);
  }

  return c.json({ success: true, data: { current_price: amount, bid_count: auction.bid_count + 1 } });
});

// GET /api/auction/stream/:streamId — 현재 활성 경매
auctionRoutes.get('/stream/:streamId', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const streamId = c.req.param('streamId');
  const auction = await DB.prepare(
    "SELECT * FROM live_auctions WHERE stream_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
  ).bind(streamId).first<any>();

  if (!auction) return c.json({ success: true, data: null });

  // 시간 초과 자동 종료
  if (new Date(auction.ends_at) < new Date()) {
    await DB.prepare("UPDATE live_auctions SET status = 'ended' WHERE id = ?").bind(auction.id).run();
    auction.status = 'ended';
  }

  const { results: bids } = await DB.prepare(
    'SELECT user_name, amount, created_at FROM auction_bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 10'
  ).bind(auction.id).all();

  return c.json({ success: true, data: { ...auction, top_bids: bids } });
});

// POST /api/auction/:id/end — 경매 종료
auctionRoutes.post('/:id/end', requireAuth(), async (c) => {
  const { DB } = c.env;
  const auctionId = Number(c.req.param('id'));

  await DB.prepare("UPDATE live_auctions SET status = 'ended' WHERE id = ? AND status = 'active'")
    .bind(auctionId).run();

  const auction = await DB.prepare('SELECT * FROM live_auctions WHERE id = ?').bind(auctionId).first<any>();
  return c.json({ success: true, data: auction });
});

// GET /api/auction/:id — 경매 상세
auctionRoutes.get('/:id', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const auction = await DB.prepare('SELECT * FROM live_auctions WHERE id = ?')
    .bind(c.req.param('id')).first<any>();
  if (!auction) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);

  const { results: bids } = await DB.prepare(
    'SELECT user_name, amount, created_at FROM auction_bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 20'
  ).bind(auction.id).all();

  return c.json({ success: true, data: { ...auction, bids } });
});

// POST /api/auction/:id/purchase — 낙찰자 구매 (낙찰가로 주문 생성)
auctionRoutes.post('/:id/purchase', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const auctionId = Number(c.req.param('id'));
  const auction = await DB.prepare('SELECT * FROM live_auctions WHERE id = ?').bind(auctionId).first<any>();

  if (!auction) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);
  if (auction.status !== 'ended') return c.json({ success: false, error: '아직 종료되지 않은 경매입니다' }, 400);
  if (auction.winner_user_id !== String(user.id)) return c.json({ success: false, error: '낙찰자만 구매할 수 있습니다' }, 403);

  // 상품 정보 조회
  if (!auction.product_id) return c.json({ success: false, error: '연결된 상품이 없습니다' }, 400);

  const product = await DB.prepare('SELECT id, name, price, image_url, seller_id FROM products WHERE id = ?')
    .bind(auction.product_id).first<any>();
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  // 주문 생성 데이터 반환 (프론트에서 체크아웃으로 이동)
  return c.json({
    success: true,
    data: {
      product_id: product.id,
      product_name: product.name,
      product_image: product.image_url,
      auction_price: auction.current_price, // 낙찰가
      original_price: product.price,
      seller_id: product.seller_id,
      auction_id: auctionId,
    }
  });
});

export { auctionRoutes };
