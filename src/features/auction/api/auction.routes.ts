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
  // 🛡️ 2026-04-22 배치 115: deal balance escrow 테이블 (TD-007)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS auction_holds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auction_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'consumed')),
        created_at DATETIME DEFAULT (datetime('now')),
        released_at DATETIME
      )
    `).run();
  } catch {}
  try {
    await DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_auction_holds_user_active ON auction_holds(user_id, status)"
    ).run();
  } catch {}
  try {
    await DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_auction_holds_auction_active ON auction_holds(auction_id, status)"
    ).run();
  } catch {}
}

/**
 * 🛡️ 2026-04-22 배치 115 (TD-007): 유저의 가용 balance 계산
 * = user_points.balance - sum(active holds 금액)
 * 세션 쿠키 유저 (숫자 id) / Firebase 유저 (uid) 모두 지원 — user_points.user_id 는 TEXT.
 */
async function getAvailableBalance(DB: D1Database, userId: string): Promise<number> {
  const row = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number }>();
  const balance = row?.balance ?? 0;
  const holdRow = await DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM auction_holds WHERE user_id = ? AND status = 'active'"
  ).bind(userId).first<{ total: number }>();
  const held = holdRow?.total ?? 0;
  return Math.max(0, balance - held);
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

  // ✅ OWNERSHIP FIX: only the stream's seller (or admin) can create an auction
  if (user.type !== 'admin') {
    if (user.type !== 'seller' || Number(stream.seller_id) !== Number(user.id)) {
      return c.json({ success: false, error: 'forbidden — not your stream' }, 403);
    }
  }

  const dur = duration_seconds || 180;
  const endsAt = new Date(Date.now() + dur * 1000).toISOString();

  const result = await DB.prepare(`
    INSERT INTO live_auctions (stream_id, seller_id, product_id, title, start_price, current_price, min_increment, duration_seconds, ends_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(stream_id, stream.seller_id, product_id ?? null, title, start_price, start_price, min_increment || 1000, dur, endsAt).run();

  return c.json({ success: true, data: { id: result.meta.last_row_id, ends_at: endsAt } }, 201);
});

// POST /api/auction/:id/bid — 입찰
// 🛡️ 2026-04-22 배치 115 (TD-007): deal balance escrow 추가.
//   - 입찰 시 해당 금액을 user_points 에서 hold (auction_holds)
//   - 경쟁 입찰로 outbid 되면 hold 자동 해제
//   - 입찰자는 balance 를 초과하는 금액으로 bid 불가 ("지불능력 증명")
auctionRoutes.post('/:id/bid', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const auctionId = Number(c.req.param('id'));
  const { amount } = await c.req.json<{ amount: number }>();

  // 금액 유효성 검증 (NaN, 음수, 비정상 상한)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return c.json({ success: false, error: '유효하지 않은 금액입니다' }, 400);
  }

  const auction = await DB.prepare(
    "SELECT id, stream_id, seller_id, product_id, title, start_price, current_price, min_increment, bid_count, winner_user_id, winner_name, status, duration_seconds, started_at, ends_at, created_at FROM live_auctions WHERE id = ? AND status = 'active'"
  ).bind(auctionId).first<any>();

  if (!auction) return c.json({ success: false, error: '활성 경매가 없습니다' }, 404);
  if (new Date(auction.ends_at) < new Date()) {
    await DB.prepare("UPDATE live_auctions SET status = 'ended' WHERE id = ?").bind(auctionId).run();
    return c.json({ success: false, error: '경매가 종료되었습니다' }, 400);
  }

  // 본인 경매 입찰 방지 (자가낙찰 사기 차단)
  if (Number(auction.seller_id) === Number(user.id) && user.type === 'seller') {
    return c.json({ success: false, error: '본인 경매에는 입찰할 수 없습니다' }, 400);
  }

  // 시작가의 100배 초과 입찰 방지 (sanity cap)
  const startPrice = Number(auction.start_price) || 0;
  if (startPrice > 0 && amount > startPrice * 100) {
    return c.json({ success: false, error: '시작가의 100배 초과 입찰은 불가합니다' }, 400);
  }

  if (amount < auction.current_price + auction.min_increment) {
    return c.json({ success: false, error: `최소 ${(auction.current_price + auction.min_increment).toLocaleString()}원 이상 입찰해주세요` }, 400);
  }

  // 🛡️ 배치 115: 지불 능력 검증 — 가용 balance >= amount
  const userIdStr = String(user.id);
  // 기존 본인 hold (이 경매에 대한) 확인 — self-outbid 시 차액만 검증
  const existingHold = await DB.prepare(
    "SELECT id, amount FROM auction_holds WHERE auction_id = ? AND user_id = ? AND status = 'active'"
  ).bind(auctionId, userIdStr).first<{ id: number; amount: number }>();

  const existingHoldAmount = existingHold?.amount ?? 0;
  const available = await getAvailableBalance(DB, userIdStr);
  // available 은 이미 existingHold 를 차감한 값 — 추가로 필요한 양은 (amount - existingHoldAmount)
  const additionalRequired = amount - existingHoldAmount;
  if (available < additionalRequired) {
    return c.json({
      success: false,
      error: `딜 포인트가 부족합니다. 필요: ${amount.toLocaleString()}딜, 가용: ${(available + existingHoldAmount).toLocaleString()}딜`
    }, 400);
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

  // 🛡️ 배치 115: hold 관리
  // 1) 이 경매의 다른 유저 active hold 해제 (outbid 된 유저)
  await DB.prepare(
    "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND user_id != ? AND status = 'active'"
  ).bind(auctionId, userIdStr).run();

  // 2) 본인의 이전 hold 해제 (self-outbid 케이스)
  if (existingHold) {
    await DB.prepare(
      "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE id = ?"
    ).bind(existingHold.id).run();
  }

  // 3) 새 hold 생성
  await DB.prepare(
    "INSERT INTO auction_holds (auction_id, user_id, amount, status) VALUES (?, ?, ?, 'active')"
  ).bind(auctionId, userIdStr, amount).run();

  return c.json({ success: true, data: { current_price: amount, bid_count: auction.bid_count + 1 } });
});

// GET /api/auction/holds/me — 내 활성 hold 목록 (UI 표시용)
auctionRoutes.get('/holds/me', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const { results } = await DB.prepare(
    `SELECT h.id, h.auction_id, h.amount, h.created_at, a.title, a.status as auction_status
     FROM auction_holds h
     LEFT JOIN live_auctions a ON a.id = h.auction_id
     WHERE h.user_id = ? AND h.status = 'active'
     ORDER BY h.created_at DESC`
  ).bind(String(user.id)).all();

  const available = await getAvailableBalance(DB, String(user.id));
  return c.json({ success: true, data: { holds: results, available_balance: available } });
});

// GET /api/auction/stream/:streamId — 현재 활성 경매
auctionRoutes.get('/stream/:streamId', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const streamId = c.req.param('streamId');
  const auction = await DB.prepare(
    "SELECT id, stream_id, seller_id, product_id, title, start_price, current_price, min_increment, bid_count, winner_user_id, winner_name, status, duration_seconds, started_at, ends_at, created_at FROM live_auctions WHERE stream_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
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
// 🛡️ 2026-04-22 배치 115: 경매 종료 시 winner 의 hold 만 유지, 나머지 release.
//   cancel 케이스는 별도 로직 — 여기서는 정상 종료만 처리.
auctionRoutes.post('/:id/end', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  const auctionId = Number(c.req.param('id'));

  // ✅ OWNERSHIP FIX: only the auction's seller (or admin) can end it
  const existing = await DB.prepare('SELECT seller_id, winner_user_id FROM live_auctions WHERE id = ?').bind(auctionId).first<{ seller_id: number; winner_user_id: string | null }>();
  if (!existing) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);
  if (user.type !== 'admin') {
    if (user.type !== 'seller' || Number(existing.seller_id) !== Number(user.id)) {
      return c.json({ success: false, error: 'forbidden — not your auction' }, 403);
    }
  }

  await DB.prepare("UPDATE live_auctions SET status = 'ended' WHERE id = ? AND status = 'active'")
    .bind(auctionId).run();

  // winner 이외의 active hold 해제 (이미 bid 단계에서 해제되었어야 하지만 방어적)
  if (existing.winner_user_id) {
    await DB.prepare(
      "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND user_id != ? AND status = 'active'"
    ).bind(auctionId, existing.winner_user_id).run();
  } else {
    // winner 없음 (입찰 0건 종료) — 모든 hold 해제
    await DB.prepare(
      "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND status = 'active'"
    ).bind(auctionId).run();
  }

  const auction = await DB.prepare('SELECT id, stream_id, seller_id, product_id, title, start_price, current_price, min_increment, bid_count, winner_user_id, winner_name, status, duration_seconds, started_at, ends_at, created_at FROM live_auctions WHERE id = ?').bind(auctionId).first<any>();
  return c.json({ success: true, data: auction });
});

// POST /api/auction/:id/cancel — 경매 취소 (모든 hold 해제)
auctionRoutes.post('/:id/cancel', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  const auctionId = Number(c.req.param('id'));

  const existing = await DB.prepare('SELECT seller_id FROM live_auctions WHERE id = ?').bind(auctionId).first<{ seller_id: number }>();
  if (!existing) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);
  if (user.type !== 'admin') {
    if (user.type !== 'seller' || Number(existing.seller_id) !== Number(user.id)) {
      return c.json({ success: false, error: 'forbidden — not your auction' }, 403);
    }
  }

  await DB.prepare("UPDATE live_auctions SET status = 'cancelled' WHERE id = ? AND status = 'active'")
    .bind(auctionId).run();

  // 모든 active hold 해제
  await DB.prepare(
    "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND status = 'active'"
  ).bind(auctionId).run();

  return c.json({ success: true });
});

// GET /api/auction/:id — 경매 상세
auctionRoutes.get('/:id', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const auction = await DB.prepare('SELECT id, stream_id, seller_id, product_id, title, start_price, current_price, min_increment, bid_count, winner_user_id, winner_name, status, duration_seconds, started_at, ends_at, created_at FROM live_auctions WHERE id = ?')
    .bind(c.req.param('id')).first<any>();
  if (!auction) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);

  const { results: bids } = await DB.prepare(
    'SELECT user_name, amount, created_at FROM auction_bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 20'
  ).bind(auction.id).all();

  return c.json({ success: true, data: { ...auction, bids } });
});

// POST /api/auction/:id/purchase — 낙찰자 구매 (낙찰가로 주문 생성)
// 🛡️ 2026-04-22 배치 115: hold 상태 조회 후 주문 데이터와 함께 반환.
//   실제 hold consumption 은 체크아웃 완료 (주문 생성 시) 에 이뤄져야 하지만,
//   현 MVP 에서는 /purchase 호출 시점에서 hold 를 주문 생성 플로우 로 넘김.
auctionRoutes.post('/:id/purchase', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const auctionId = Number(c.req.param('id'));
  const auction = await DB.prepare('SELECT id, stream_id, seller_id, product_id, title, start_price, current_price, min_increment, bid_count, winner_user_id, winner_name, status, duration_seconds, started_at, ends_at, created_at FROM live_auctions WHERE id = ?').bind(auctionId).first<any>();

  if (!auction) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);
  if (auction.status !== 'ended') return c.json({ success: false, error: '아직 종료되지 않은 경매입니다' }, 400);
  if (auction.winner_user_id !== String(user.id)) return c.json({ success: false, error: '낙찰자만 구매할 수 있습니다' }, 403);

  // 상품 정보 조회
  if (!auction.product_id) return c.json({ success: false, error: '연결된 상품이 없습니다' }, 400);

  const product = await DB.prepare('SELECT id, name, price, image_url, seller_id FROM products WHERE id = ?')
    .bind(auction.product_id).first<any>();
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  // 🛡️ 배치 115: 유효한 hold 확인 (낙찰 후 release 되지 않았는지)
  const hold = await DB.prepare(
    "SELECT id, amount FROM auction_holds WHERE auction_id = ? AND user_id = ? AND status = 'active'"
  ).bind(auctionId, String(user.id)).first<{ id: number; amount: number }>();

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
      hold_id: hold?.id ?? null,
      held_amount: hold?.amount ?? 0,
    }
  });
});

// POST /api/auction/:id/release-hold — 낙찰자가 구매 포기 시 hold 해제
// 🛡️ 배치 115: 구매 거부 / 타임아웃 처리. 낙찰자 본인만 호출 가능.
auctionRoutes.post('/:id/release-hold', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  const auctionId = Number(c.req.param('id'));

  const result = await DB.prepare(
    "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND user_id = ? AND status = 'active'"
  ).bind(auctionId, String(user.id)).run();

  return c.json({ success: true, data: { released: (result.meta.changes ?? 0) > 0 } });
});

// POST /api/auction/:id/promote-runner-up — 낙찰자 결제 거부 시 차순위 자동 승격
// 🛡️ 2026-04-22 배치 133 (TD-007 확장): runner-up 승격 로직.
//   1) 현 winner 의 hold 해제
//   2) 차순위 (current_price 에서 두 번째로 높은 bid) 를 winner 로 승격
//   3) 새 winner 에 대한 hold 생성
//   4) 경매 current_price / winner_user_id / winner_name 업데이트
//
//   셀러 또는 admin 이 호출 (낙찰자 결제 거부 확인 후 수동 트리거).
auctionRoutes.post('/:id/promote-runner-up', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const auctionId = Number(c.req.param('id'));
  const auction = await DB.prepare('SELECT id, stream_id, seller_id, product_id, title, start_price, current_price, min_increment, bid_count, winner_user_id, winner_name, status, duration_seconds, started_at, ends_at, created_at FROM live_auctions WHERE id = ?').bind(auctionId).first<any>();
  if (!auction) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);
  if (auction.status !== 'ended') return c.json({ success: false, error: '종료된 경매에서만 승격 가능' }, 400);

  // 권한: 셀러 본인 또는 admin
  if (user.type !== 'admin') {
    if (user.type !== 'seller' || Number(auction.seller_id) !== Number(user.id)) {
      return c.json({ success: false, error: 'forbidden' }, 403);
    }
  }

  const currentWinnerId = auction.winner_user_id;
  if (!currentWinnerId) {
    return c.json({ success: false, error: '현재 낙찰자가 없습니다' }, 400);
  }

  // 1) 현 winner hold 해제
  await DB.prepare(
    "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND user_id = ? AND status = 'active'"
  ).bind(auctionId, currentWinnerId).run();

  // 2) 차순위 bid 조회 (현 winner 제외, 금액 내림차순 첫 번째)
  const runnerUp = await DB.prepare(
    `SELECT user_id, user_name, amount FROM auction_bids
     WHERE auction_id = ? AND user_id != ?
     ORDER BY amount DESC LIMIT 1`
  ).bind(auctionId, currentWinnerId).first<{ user_id: string; user_name: string; amount: number }>();

  if (!runnerUp) {
    // 다른 입찰자 없음 — 경매 무효 처리
    await DB.prepare(
      "UPDATE live_auctions SET winner_user_id = NULL, winner_name = NULL WHERE id = ?"
    ).bind(auctionId).run();
    return c.json({
      success: true,
      data: { promoted: false, reason: '다른 입찰자가 없어 낙찰자 없음 처리됨' },
    });
  }

  // 3) 차순위 가용 balance 확인
  const available = await getAvailableBalance(DB, runnerUp.user_id);
  if (available < runnerUp.amount) {
    // 차순위도 잔액 부족 — winner 만 비우고 재시도 유도
    await DB.prepare(
      "UPDATE live_auctions SET winner_user_id = NULL, winner_name = NULL WHERE id = ?"
    ).bind(auctionId).run();
    return c.json({
      success: true,
      data: {
        promoted: false,
        reason: `차순위 입찰자(${runnerUp.user_name})도 잔액 부족 (${available.toLocaleString()}딜 < ${runnerUp.amount.toLocaleString()}딜)`,
      },
    });
  }

  // 4) winner 교체 + hold 생성
  await DB.prepare(
    'UPDATE live_auctions SET current_price = ?, winner_user_id = ?, winner_name = ? WHERE id = ?'
  ).bind(runnerUp.amount, runnerUp.user_id, runnerUp.user_name, auctionId).run();

  await DB.prepare(
    "INSERT INTO auction_holds (auction_id, user_id, amount, status) VALUES (?, ?, ?, 'active')"
  ).bind(auctionId, runnerUp.user_id, runnerUp.amount).run();

  return c.json({
    success: true,
    data: {
      promoted: true,
      new_winner: { user_id: runnerUp.user_id, user_name: runnerUp.user_name, amount: runnerUp.amount },
    },
  });
});

export { auctionRoutes };
