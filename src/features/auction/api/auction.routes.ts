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

import { swallow } from '@/worker/utils/swallow';
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

/**
 * 🛡️ 2026-04-28: 경매 사용자 phone 조회 — user_id 가 numeric session id 또는
 *   firebase_uid 둘 다 가능하므로 OR 매칭. 미존재 시 null.
 */
async function getUserPhone(DB: D1Database, userId: string): Promise<string | null> {
  try {
    const row = await DB.prepare(
      'SELECT phone FROM users WHERE CAST(id AS TEXT) = ? OR firebase_uid = ? LIMIT 1'
    ).bind(userId, userId).first<{ phone: string | null }>();
    return row?.phone ?? null;
  } catch {
    return null;
  }
}

/**
 * 🛡️ 2026-04-28: 경매 알림 통합 발송 (push + 옵션 alimtalk).
 *   push 는 항상 시도. alimtalk 은 phone 있을 때만 + 중요한 알림 (won/promoted) 만.
 */
async function notifyAuctionUser(
  env: Env,
  userId: string,
  notifyType: 'auction_won' | 'auction_outbid' | 'auction_promoted',
  pushPayload: { title: string; body: string; url?: string },
  alimtalkText?: string,
): Promise<void> {
  // 1) Push (best-effort, 가장 즉시성 높음)
  try {
    const { sendSystemPush } = await import('../../../lib/system-push');
    sendSystemPush(env, 'user', userId, pushPayload).catch(() => {});
  } catch { /* module load fail */ }

  // 2) Alimtalk (phone 있고 alimtalkText 지정 시 — 도달률 보강용)
  if (alimtalkText) {
    try {
      const phone = await getUserPhone(env.DB, userId);
      if (phone) {
        const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk');
        sendSystemAlimtalk(env, phone, notifyType, alimtalkText).catch(() => {});
      }
    } catch { /* phone lookup fail */ }
  }
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
    "SELECT * FROM live_auctions WHERE id = ? AND status = 'active'"
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
  // 이전 winner 정보 미리 저장 (outbid 알림용)
  const previousWinnerId = auction.winner_user_id;

  const updateResult = await DB.prepare(
    'UPDATE live_auctions SET current_price = ?, bid_count = bid_count + 1, winner_user_id = ?, winner_name = ? WHERE id = ? AND current_price < ?'
  ).bind(amount, user.id, user.name || '익명', auctionId, amount).run();

  if (!updateResult.meta.changes) {
    return c.json({ success: false, error: '다른 입찰자가 더 높은 금액을 입찰했습니다. 다시 시도해주세요.' }, 409);
  }

  // 🛡️ 2026-04-28: 이전 최고 입찰자가 본인이 아니면 outbid 알림 (push only — alimtalk 은 빈도 높아 비용 부담)
  if (previousWinnerId && previousWinnerId !== userIdStr) {
    notifyAuctionUser(c.env, previousWinnerId, 'auction_outbid', {
      title: '경매 입찰 갱신',
      body: `${auction.title}: ${amount.toLocaleString()}원으로 더 높은 입찰자가 나타났어요`,
      url: `/live/${auction.stream_id}`,
    }).catch(() => {});
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

  const auction = await DB.prepare('SELECT * FROM live_auctions WHERE id = ?').bind(auctionId).first<any>();

  // 🛡️ 2026-04-28: 낙찰자에게 결제 안내 (push + alimtalk — 큰 금액 결제이므로 도달률 중요)
  if (auction?.winner_user_id) {
    notifyAuctionUser(c.env, auction.winner_user_id, 'auction_won',
      {
        title: '경매 낙찰 🎉',
        body: `${auction.title} ${auction.current_price.toLocaleString()}원에 낙찰됐어요. 결제를 진행해주세요.`,
        url: `/live/${auction.stream_id}`,
      },
      `[유어딜] 경매 낙찰 안내\n${auction.title}\n낙찰가: ${auction.current_price.toLocaleString()}원\n결제를 진행해주세요.`
    ).catch(() => {});
  }

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

// 🛡️ 2026-04-26 (TD-007): POST /api/auction/:id/forfeit-winner
// 낙찰자가 결제 불이행 시 차순위 자동 승격.
//
// 동작:
// 1. 셀러/어드민 권한 확인
// 2. 현재 winner 의 hold 를 'released' (forfeit_reason 기록) + winner_history 'forfeited'
// 3. auction_bids 에서 forfeit 안 된 차순위 후보를 amount DESC 로 순회
// 4. 각 후보 별로 hold 재생성 시도 (가용 잔액 확인)
//    - 성공: live_auctions.winner_user_id 갱신, winner_history 'promoted', 알림
//    - 실패: 다음 후보 시도
// 5. 후보 모두 실패 시 winner_user_id = NULL, status = 'ended', 모두 release
//
// 마이그레이션 0211 미적용 시: 부분 동작 (winner_history INSERT 만 silent skip).

// 🛡️ 2026-04-27 (TD-007 마무리): POST /api/auction/:id/winner-paid
// 낙찰자 결제 완료 시 hold 를 'consumed' 로 마킹.
// 권한: 셀러(본인 경매) 또는 어드민
// 🛡️ 2026-04-28 (자동화 완료): worker/routes/webhook.routes.ts 의 handlePaymentConfirmed 가
//   user_id 매칭 + current_price 매칭으로 best-effort 자동 hold consume 처리.
//   본 endpoint 는 수동 트리거용 (관리자/테스트) 으로 유지.
auctionRoutes.post('/:id/winner-paid', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  const auctionId = Number(c.req.param('id'));
  if (!Number.isFinite(auctionId) || auctionId <= 0) return c.json({ success: false, error: 'invalid id' }, 400);

  const auction = await DB.prepare(
    'SELECT seller_id, winner_user_id, status FROM live_auctions WHERE id = ?'
  ).bind(auctionId).first<{ seller_id: number; winner_user_id: string | null; status: string }>();
  if (!auction) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);
  if (auction.status !== 'ended') return c.json({ success: false, error: '종료된 경매만 처리 가능' }, 409);
  if (!auction.winner_user_id) return c.json({ success: false, error: '낙찰자 없음' }, 409);

  if (user.type !== 'admin' && (user.type !== 'seller' || Number(auction.seller_id) !== Number(user.id))) {
    return c.json({ success: false, error: 'forbidden — not your auction' }, 403);
  }

  // winner 의 active hold 를 consumed 로 마킹 (멱등 — 이미 consumed 면 변화 없음)
  const result = await DB.prepare(
    "UPDATE auction_holds SET status = 'consumed', released_at = datetime('now') WHERE auction_id = ? AND user_id = ? AND status = 'active'"
  ).bind(auctionId, auction.winner_user_id).run();

  return c.json({
    success: true,
    consumed_holds: (result.meta as any)?.changes ?? 0,
    message: '낙찰자 결제 hold consumed 처리 완료',
  });
});

auctionRoutes.post('/:id/forfeit-winner', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  const auctionId = Number(c.req.param('id'));
  if (!Number.isFinite(auctionId) || auctionId <= 0) return c.json({ success: false, error: 'invalid id' }, 400);

  const reason = (await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }))).reason?.trim().slice(0, 500) || '결제 불이행';

  const auction = await DB.prepare(
    'SELECT id, seller_id, current_price, start_price, winner_user_id, winner_name FROM live_auctions WHERE id = ?'
  ).bind(auctionId).first<{
    id: number; seller_id: number; current_price: number; start_price: number;
    winner_user_id: string | null; winner_name: string | null;
  }>();
  if (!auction) return c.json({ success: false, error: '경매를 찾을 수 없습니다' }, 404);
  if (user.type !== 'admin') {
    if (user.type !== 'seller' || Number(auction.seller_id) !== Number(user.id)) {
      return c.json({ success: false, error: 'forbidden — not your auction' }, 403);
    }
  }
  if (!auction.winner_user_id) {
    return c.json({ success: false, error: '낙찰자가 없습니다' }, 400);
  }

  const forfeitedUserId = auction.winner_user_id;
  const forfeitedName = auction.winner_name;

  // 1) 현재 winner 의 active hold 를 forfeited 처리
  await DB.prepare(
    "UPDATE auction_holds SET status = 'released', released_at = datetime('now'), forfeit_reason = ? WHERE auction_id = ? AND user_id = ? AND status = 'active'"
  ).bind(reason, auctionId, forfeitedUserId).run().catch((e) => {
    // forfeit_reason 컬럼 미존재 → fallback (status 만 release)
    return DB.prepare(
      "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND user_id = ? AND status = 'active'"
    ).bind(auctionId, forfeitedUserId).run();
  });

  // 2) winner_history 기록 (마이그레이션 0211 미적용 시 silent skip)
  await DB.prepare(
    "INSERT INTO auction_winner_history (auction_id, user_id, user_name, amount, reason, notes) VALUES (?, ?, ?, ?, 'forfeited', ?)"
  ).bind(auctionId, forfeitedUserId, forfeitedName, auction.current_price, reason).run().catch(swallow('auction:api:auction'));

  // 3) 후보 차순위 순회 — 같은 user 의 동일 금액 중복 제거 + forfeit 된 user 제외
  const { results: candidates } = await DB.prepare(`
    SELECT user_id, user_name, MAX(amount) AS amount
    FROM auction_bids
    WHERE auction_id = ? AND user_id != ?
    GROUP BY user_id
    ORDER BY amount DESC
  `).bind(auctionId, forfeitedUserId).all<{ user_id: string; user_name: string; amount: number }>();

  let newWinner: { user_id: string; user_name: string; amount: number } | null = null;

  for (const cand of (candidates || [])) {
    if (cand.amount < auction.start_price) break; // 시작가 미만은 자격 없음

    // 가용 잔액 확인 (기존 hold 있으면 그대로 인정; 없으면 신규 생성)
    const balance = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(cand.user_id).first<{ balance: number }>();
    const userBalance = balance?.balance ?? 0;
    const otherActiveHolds = await DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM auction_holds WHERE user_id = ? AND status = 'active' AND auction_id != ?"
    ).bind(cand.user_id, auctionId).first<{ total: number }>();
    const heldElsewhere = otherActiveHolds?.total ?? 0;
    const available = Math.max(0, userBalance - heldElsewhere);

    if (available < cand.amount) continue; // 잔액 부족 → 다음 후보

    // 기존 hold 있으면 활성화 갱신, 없으면 신규 생성
    const existing = await DB.prepare(
      "SELECT id FROM auction_holds WHERE auction_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1"
    ).bind(auctionId, cand.user_id).first<{ id: number }>();
    if (existing) {
      await DB.prepare(
        "UPDATE auction_holds SET status = 'active', amount = ?, released_at = NULL WHERE id = ?"
      ).bind(cand.amount, existing.id).run();
    } else {
      await DB.prepare(
        "INSERT INTO auction_holds (auction_id, user_id, amount, status) VALUES (?, ?, ?, 'active')"
      ).bind(auctionId, cand.user_id, cand.amount).run();
    }

    newWinner = cand;
    break;
  }

  if (!newWinner) {
    // 4) 후보 없음 → winner 비움 + 경매 종료
    await DB.prepare(
      "UPDATE live_auctions SET winner_user_id = NULL, winner_name = NULL, status = 'ended' WHERE id = ?"
    ).bind(auctionId).run();
    await DB.prepare(
      "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND status = 'active'"
    ).bind(auctionId).run();
    await DB.prepare(
      "INSERT INTO auction_winner_history (auction_id, reason, notes) VALUES (?, 'cancelled', '차순위 후보 없음 또는 잔액 부족')"
    ).bind(auctionId).run().catch(swallow('auction:api:auction'));
    return c.json({
      success: true,
      data: { promoted: false, message: '차순위 후보 없음 — 경매 종료 처리됨', forfeited_user_id: forfeitedUserId },
    });
  }

  // 5) 새 winner 반영
  await DB.prepare(
    "UPDATE live_auctions SET winner_user_id = ?, winner_name = ?, current_price = ? WHERE id = ?"
  ).bind(newWinner.user_id, newWinner.user_name, newWinner.amount, auctionId).run();

  await DB.prepare(
    "INSERT INTO auction_winner_history (auction_id, user_id, user_name, amount, reason, notes) VALUES (?, ?, ?, ?, 'promoted', ?)"
  ).bind(auctionId, newWinner.user_id, newWinner.user_name, newWinner.amount, `${forfeitedName} 불이행으로 승격`).run().catch(swallow('auction:api:auction'));

  // 🛡️ 2026-04-28: 차순위 승격된 새 winner 에게 push + alimtalk
  notifyAuctionUser(c.env, newWinner.user_id, 'auction_promoted',
    {
      title: '경매 차순위 승격 🎉',
      body: `이전 낙찰자 결제 불이행으로 ${newWinner.amount.toLocaleString()}원에 승격됐어요. 결제 진행해주세요.`,
      url: `/auction/${auctionId}`,
    },
    `[유어딜] 경매 차순위 승격\n이전 낙찰자 결제 불이행으로\n${newWinner.amount.toLocaleString()}원에 승격됐어요.\n결제를 진행해주세요.`
  ).catch(() => {});

  return c.json({
    success: true,
    data: {
      promoted: true,
      forfeited: { user_id: forfeitedUserId, user_name: forfeitedName, amount: auction.current_price },
      new_winner: newWinner,
    },
  });
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
// 🛡️ 2026-04-22 배치 115: hold 상태 조회 후 주문 데이터와 함께 반환.
//   실제 hold consumption 은 체크아웃 완료 (주문 생성 시) 에 이뤄져야 하지만,
//   현 MVP 에서는 /purchase 호출 시점에서 hold 를 주문 생성 플로우 로 넘김.
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
  const auction = await DB.prepare('SELECT * FROM live_auctions WHERE id = ?').bind(auctionId).first<any>();
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

  // 🛡️ 2026-04-28: 승격된 새 winner 에게 push + alimtalk
  notifyAuctionUser(c.env, runnerUp.user_id, 'auction_promoted',
    {
      title: '경매 차순위 승격 🎉',
      body: `이전 낙찰자 포기로 ${runnerUp.amount.toLocaleString()}원에 승격됐어요. 결제 진행해주세요.`,
      url: `/auction/${auctionId}`,
    },
    `[유어딜] 경매 차순위 승격\n이전 낙찰자 결제 포기로\n${runnerUp.amount.toLocaleString()}원에 승격됐어요.\n결제를 진행해주세요.`
  ).catch(() => {});

  return c.json({
    success: true,
    data: {
      promoted: true,
      new_winner: { user_id: runnerUp.user_id, user_name: runnerUp.user_name, amount: runnerUp.amount },
    },
  });
});

export { auctionRoutes };
