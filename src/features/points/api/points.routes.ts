/**
 * 딜 포인트 시스템 API
 *
 * GET  /api/points/balance       - 잔액 조회
 * POST /api/points/charge/init   - 충전 결제 시작
 * POST /api/points/charge/confirm - 충전 결제 확인 (토스 승인)
 * POST /api/points/donate        - 딜 후원 (포인트 차감)
 * GET  /api/points/history       - 거래 내역
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { rateLimit } from '@/worker/middleware/rate-limit';
import type { Env } from '@/worker/types/env';
import { TOSS_PAYMENT_URL} from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { ensureUserPointsTable } from '@/worker/utils/ensure-tables';
import { withCircuitBreaker } from '@/worker/utils/circuit-breaker';
import { swallow } from '@/worker/utils/swallow';
const pointsRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

const DEFAULT_COMMISSION_RATE = 0.10; // 🛡️ 2026-04-22: 기본 10% (CLAUDE.md 정책). DB platform_settings.commission_rate_default 로 오버라이드 가능.

async function getDefaultCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'commission_rate_default'").first<{ value: string }>();
    if (row) return Number(row.value) / 100;
  } catch { /* table may not exist */ }
  return DEFAULT_COMMISSION_RATE;
}

// 충전: 1원 = 1딜 (수수료 없음, 셀러 정산 시 기본 10% 차감 / 식사권 5% / 어드민 조정 가능)
// 🛡️ 2026-05-15: 충전 패키지 재설계 — 5만/10만/20만 권장 + 보너스 딜.
//   PG 수수료 (~2.5%) 가 충전 1건마다 발생 → 1만 충전 시 마진 거의 0.
//   고액 충전 유도로 결제 횟수 ↓ + bonus 로 사용자 perceived value ↑.
//   bonus 는 비용이지만 마케팅 acquisition cost 로 간주 (PG 변동비보다 작음).
const CHARGE_AMOUNTS = [
  { amount: 5000,   points: 5000,   bonus: 0,     label: '5,000원' },
  { amount: 10000,  points: 10000,  bonus: 0,     label: '10,000원' },
  { amount: 30000,  points: 30000,  bonus: 600,   label: '30,000원 +2%', recommended: false },
  { amount: 50000,  points: 50000,  bonus: 1500,  label: '50,000원 +3%', recommended: true },
  { amount: 100000, points: 100000, bonus: 4000,  label: '100,000원 +4%', recommended: true, best: true },
  { amount: 200000, points: 200000, bonus: 10000, label: '200,000원 +5%', recommended: false },
];

// ── 테이블 자동 생성 (마이그레이션 미적용 시 fallback) ────────────────
// user_points는 shared helper 사용; point_transactions는 이 파일에만 필요한
// CHECK 제약(type IN ('charge','donate','refund','ad_reward'))이 있어 로컬 유지.
// 🛡️ 2026-05-19: ensureTables 가 매 요청마다 CREATE TABLE 실행 → 잔액 조회 느림.
//   per-worker 메모이제이션: 한 번 호출 후 skip.
let _ensuredTables = false
async function ensureTables(DB: D1Database) {
  if (_done_ensureTables.has(DB)) return
  _done_ensureTables.add(DB)
  if (_ensuredTables) return
  await ensureUserPointsTable(DB);
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS point_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('charge', 'donate', 'refund', 'ad_reward')),
        amount INTEGER NOT NULL,
        commission_amount INTEGER NOT NULL DEFAULT 0,
        points_amount INTEGER NOT NULL DEFAULT 0,
        balance_after INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        payment_key TEXT,
        order_id TEXT,
        stream_id INTEGER,
        seller_id INTEGER,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* 이미 존재 */ }
  _ensuredTables = true
}

// ── GET /api/points/balance ──────────────────────────────────────────
pointsRoutes.get('/balance', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  // H8: user_points.user_id는 TEXT — 항상 String(user.id)로 통일하여 TEXT/INTEGER 혼용 방지
  const userId = String(user.id);
  const row = await DB.prepare('SELECT balance, total_charged, total_donated FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number; total_charged: number; total_donated: number }>();

  return c.json({
    success: true,
    data: {
      balance: row?.balance ?? 0,
      total_charged: row?.total_charged ?? 0,
      total_donated: row?.total_donated ?? 0,
    },
  });
});

// ── POST /api/points/charge/init ─────────────────────────────────────
pointsRoutes.post('/charge/init', rateLimit({ action: 'points_charge_init', max: 5, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { amount } = await c.req.json<{ amount: number }>();

  // 🛡️ 입력 검증: 숫자형 + 화이트리스트
  if (!Number.isFinite(amount)) {
    return c.json({ success: false, error: '유효하지 않은 금액입니다' }, 400);
  }
  const pkg = CHARGE_AMOUNTS.find(p => p.amount === amount);
  if (!pkg) {
    return c.json({ success: false, error: `유효하지 않은 충전 금액입니다. 가능: ${CHARGE_AMOUNTS.map(p => p.amount).join(', ')}` }, 400);
  }

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id); // H8: 항상 문자열로 통일
  const orderId = `DEAL-${userId}-${Date.now()}`;

  // 🛡️ 2026-05-19 v2 (사용자 409 신고 fix):
  //   이전: 1시간 내 pending charge 발견 시 즉시 409 → 사용자가 결제 취소 후 재시도 불가.
  //   이후: 5분 이상 된 pending row 자동 삭제 (만료 처리) → 그 후 같은 사용자 충전 가능.
  //   여전히 5분 이내 연속 시도는 차단 (남용 방지). 동시에 같은 amount 의 row 도 정리.
  //
  //   payment_key IS NULL = 결제 미완료. confirm 단계에서 payment_key 가 채워지므로
  //   confirm 이전에 머문 row 만 영향.
  try {
    // 1) 만료된 pending (5분 초과) 자동 삭제 — 영구 cleanup.
    await DB.prepare(
      "DELETE FROM point_transactions WHERE user_id = ? AND type = 'charge' AND payment_key IS NULL AND created_at <= datetime('now', '-5 minutes')"
    ).bind(userId).run();
    // 2) 그래도 최근 5분 내 pending 이 있으면 409 (남용 방지).
    const existing = await DB.prepare(
      "SELECT id FROM point_transactions WHERE user_id = ? AND type = 'charge' AND payment_key IS NULL AND created_at > datetime('now', '-5 minutes')"
    ).bind(userId).first<{ id: number }>();
    if (existing) {
      return c.json({
        success: false,
        error: '진행 중인 충전이 있습니다. 5분 후 다시 시도해주세요.',
        code: 'PENDING_CHARGE_EXISTS',
      }, 409);
    }
  } catch { /* column/shape fallback: skip guard */ }

  // 🛡️ 2026-05-15: bonus 딜 포함 (5만+ 충전 시 추가 적립)
  const bonusPoints = (pkg as { bonus?: number }).bonus ?? 0
  const totalPoints = pkg.points + bonusPoints

  // pending 트랜잭션 기록
  await DB.prepare(`
    INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
    VALUES (?, 'charge', ?, ?, ?, 0, ?, ?)
  `).bind(
    userId, amount, 0, totalPoints, // 충전은 수수료 0 (1:1) + bonus
    bonusPoints > 0
      ? `딜 ${Number(pkg.points).toLocaleString('ko-KR')}개 충전 (+${bonusPoints.toLocaleString('ko-KR')}딜 보너스)`
      : `딜 ${Number(pkg.points ?? 0).toLocaleString('ko-KR')}개 충전`, orderId
  ).run();

  return c.json({
    success: true,
    data: {
      orderId,
      amount,
      points: totalPoints,
      base_points: pkg.points,
      bonus_points: bonusPoints,
      commission: 0, // 충전은 수수료 없음
      orderName: `딜 ${Number(totalPoints).toLocaleString('ko-KR')}개 충전`,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// ── POST /api/points/charge/confirm ──────────────────────────────────
pointsRoutes.post('/charge/confirm', rateLimit({ action: 'points_charge_confirm', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { paymentKey, orderId, amount } = await c.req.json<{
    paymentKey: string;
    orderId: string;
    amount: number;
  }>();

  if (!paymentKey || !orderId || !amount) {
    return c.json({ success: false, error: '필수 항목 누락' }, 400);
  }

  // 🛡️ 입력 검증: 타입 + 길이 + 범위
  if (typeof paymentKey !== 'string' || paymentKey.length > 200) {
    return c.json({ success: false, error: '유효하지 않은 paymentKey' }, 400);
  }
  if (typeof orderId !== 'string' || orderId.length > 100) {
    return c.json({ success: false, error: '유효하지 않은 orderId' }, 400);
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 100_000_000) {
    return c.json({ success: false, error: '유효하지 않은 금액' }, 400);
  }

  const { DB } = c.env;

  // pending 트랜잭션 조회 (금액 검증)
  const userId = String(user.id); // H8: 항상 문자열로 통일
  const pending = await DB.prepare(
    'SELECT id, amount, points_amount, payment_key, balance_after FROM point_transactions WHERE order_id = ? AND user_id = ? AND type = ?'
  ).bind(orderId, userId, 'charge').first<{ id: number; amount: number; points_amount: number; payment_key: string | null; balance_after: number }>();

  if (!pending) return c.json({ success: false, error: '충전 정보를 찾을 수 없습니다' }, 404);
  if (pending.amount !== amount) return c.json({ success: false, error: '금액이 일치하지 않습니다' }, 400);

  // ✅ SECURITY FIX (Payment C6): If this transaction has already been credited
  // (payment_key populated), return existing balance WITHOUT re-crediting.
  // Without this guard, a retry after Toss returned ALREADY_PROCESSED_PAYMENT
  // would double-credit points every call.
  if (pending.payment_key) {
    const current = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();
    return c.json({
      success: true,
      data: {
        points_added: 0,
        balance: current?.balance ?? pending.balance_after ?? 0,
      },
      message: '이미 처리된 충전입니다',
    });
  }

  // 토스 결제 승인
  let tossRes: Response;
  try {
    tossRes = await withCircuitBreaker(
      { name: 'toss-confirm', maxFailures: 10, resetTimeoutMs: 60_000 },
      () => fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(c.env.TOSS_SECRET_KEY + ':')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': paymentKey,
        },
        // 🛡️ Defense-in-depth: send DB-verified pending.amount (equal to client amount above)
        body: JSON.stringify({ paymentKey, orderId, amount: pending.amount }),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  } catch {
    return c.json({ success: false, error: 'Toss 결제 시스템이 일시 중단됐습니다. 잠시 후 다시 시도해주세요.', code: 'CIRCUIT_OPEN' }, 503);
  }

  if (!tossRes.ok) {
    const err = await tossRes.json<{ message?: string; code?: string }>();
    if (err.code !== 'ALREADY_PROCESSED_PAYMENT') {
      return c.json({ success: false, error: err.message ?? '결제 승인 실패' }, 400);
    }
    // ALREADY_PROCESSED_PAYMENT: double-check CAS didn't already credit
    // (race between two concurrent confirm calls).
  }

  // 포인트 적립
  const pointsToAdd = pending.points_amount;

  // ✅ CAS (compare-and-swap) FIX for Payment C6: only credit if payment_key
  // is still NULL. If another concurrent request already won the race, skip.
  const casResult = await DB.prepare(
    'UPDATE point_transactions SET payment_key = ? WHERE id = ? AND payment_key IS NULL'
  ).bind(paymentKey, pending.id).run();

  if (!casResult.meta.changes) {
    // Another request already credited — return current balance untouched
    const current = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();
    return c.json({
      success: true,
      data: {
        points_added: 0,
        balance: current?.balance ?? 0,
      },
      message: '이미 처리된 충전입니다',
    });
  }

  // user_points UPSERT — only runs once per transaction thanks to CAS above
  await DB.prepare(`
    INSERT INTO user_points (user_id, balance, total_charged)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      balance = balance + ?,
      total_charged = total_charged + ?,
      updated_at = datetime('now')
  `).bind(userId, pointsToAdd, pointsToAdd, pointsToAdd, pointsToAdd).run();

  // 잔액 조회
  const updated = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number }>();

  // 트랜잭션의 balance_after 업데이트 (payment_key는 CAS에서 이미 기록됨)
  await DB.prepare(
    'UPDATE point_transactions SET balance_after = ? WHERE id = ?'
  ).bind(updated?.balance ?? pointsToAdd, pending.id).run();

  // 딜 충전 → 어드민 알림
  createDashboardNotification(
    DB, 'admin', null, 'deal_charged',
    '딜 충전',
    `${Number(amount ?? 0).toLocaleString('ko-KR')}원 → ${Number(pointsToAdd ?? 0).toLocaleString('ko-KR')}딜 충전`,
    '/admin/deals'
  ).catch(swallow('points:api:points'));

  return c.json({
    success: true,
    data: {
      points_added: pointsToAdd,
      balance: updated?.balance ?? pointsToAdd,
    },
    message: `${Number(pointsToAdd ?? 0).toLocaleString('ko-KR')}딜이 충전되었습니다!`,
  });
});

// ── POST /api/points/donate ──────────────────────────────────────────
// 딜 포인트로 후원 (결제 없이 즉시 차감)
pointsRoutes.post('/donate', rateLimit({ action: 'points_donate', max: 20, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const body = await c.req.json<{
    stream_id: number;
    amount: number;
    message?: string;
    /** Optional idempotency key — protects against double-click / retry. */
    idempotency_key?: string;
  }>();
  const { stream_id, amount, message } = body;

  if (!Number.isFinite(stream_id) || stream_id < 1) {
    return c.json({ success: false, error: '유효하지 않은 방송입니다' }, 400);
  }
  if (!Number.isFinite(amount) || amount < 500 || amount > 10_000_000) {
    return c.json({ success: false, error: '후원 금액은 500딜 이상 10,000,000딜 이하입니다' }, 400);
  }

  const { DB } = c.env;
  await ensureTables(DB);

  // H8: user_points.user_id는 TEXT — 항상 String(user.id)로 통일
  const userId = String(user.id);

  // ✅ IDEMPOTENCY: if the client supplied a key, guard the whole handler.
  if (body.idempotency_key) {
    const { idempotentWrite, IdempotencyConflictError } = await import('../../../worker/utils/idempotency');
    try {
      const result = await idempotentWrite<{ status: number; body: any }>(
        DB,
        `donate:${body.idempotency_key}`,
        userId,
        () => executeDonate(DB, userId, stream_id, amount, message),
        { ttlSeconds: 6 * 60 * 60 },
      );
      return c.json(result.body, result.status as any);
    } catch (e) {
      if (e instanceof IdempotencyConflictError) {
        return c.json({ success: false, error: e.message }, 409);
      }
      throw e;
    }
  }

  const result = await executeDonate(DB, userId, stream_id, amount, message);
  return c.json(result.body, result.status as any);
});

/**
 * Core donate logic, extracted so it can be wrapped by idempotentWrite.
 * Returns a { status, body } object instead of a Response because the
 * idempotency cache needs to serialize it.
 */
async function executeDonate(
  DB: D1Database,
  userId: string,
  stream_id: number,
  amount: number,
  message: string | undefined,
): Promise<{ status: number; body: any }> {
  // 잔액 확인
  const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number }>();

  if (!wallet || wallet.balance < amount) {
    return {
      status: 400,
      body: {
        success: false,
        error: `딜이 부족합니다. (보유: ${wallet?.balance ?? 0}딜, 필요: ${amount}딜)`,
        code: 'INSUFFICIENT_POINTS',
      },
    };
  }

  // 스트림 + 셀러 정보
  const stream = await DB.prepare(
    `SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name
     FROM live_streams ls
     LEFT JOIN sellers s ON ls.seller_id = s.id
     WHERE ls.id = ?`
  ).bind(stream_id).first<{ id: number; title: string; seller_id: number; seller_name: string }>();

  if (!stream) return { status: 404, body: { success: false, error: '스트림을 찾을 수 없습니다' } };

  // 포인트 차감 (atomic: balance >= amount 조건으로 race condition 방지)
  const deductResult = await DB.prepare(
    'UPDATE user_points SET balance = balance - ?, total_donated = total_donated + ?, updated_at = datetime(\'now\') WHERE user_id = ? AND balance >= ?'
  ).bind(amount, amount, userId, amount).run();
  if (!deductResult.meta.changes) {
    return { status: 400, body: { success: false, error: '딜이 부족합니다 (동시 결제 충돌)' } };
  }
  const updatedWallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(userId).first<{ balance: number }>();
  const newBalance = updatedWallet?.balance ?? 0;

  // 트랜잭션 기록
  await DB.prepare(`
    INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, stream_id, seller_id)
    VALUES (?, 'donate', ?, ?, ?, ?, ?, ?)
  `).bind(
    userId, amount, amount, newBalance,
    `${stream.seller_name ?? '셀러'} 라이브 후원`,
    stream_id, stream.seller_id
  ).run();

  // donations 테이블에도 기록 (셀러 정산 시 platform_settings.commission_rate_default 적용, 기본 10%)
  const COMMISSION_RATE = await getDefaultCommissionRate(DB);
  const commissionAmount = Math.round(amount * COMMISSION_RATE);
  const creditAmount = amount - commissionAmount; // 셀러 실수령액
  const donationOrderId = `DEAL-DON-${userId}-${stream_id}-${Date.now()}`;
  await DB.prepare(`
    INSERT INTO donations (live_stream_id, seller_id, donor_user_id, donor_name, amount,
      commission_amount, credit_amount, commission_rate, order_id, payment_status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
  `).bind(
    stream_id, stream.seller_id, userId, '후원자',
    amount, commissionAmount, creditAmount, COMMISSION_RATE, donationOrderId, message ?? ''
  ).run();

  // 10. 후원 받음 → 셀러 알림
  createDashboardNotification(DB, 'seller', String(stream.seller_id), 'donation_received', '후원 받음', `${amount}딜 후원`, '/seller/donations').catch(swallow('points:api:points'));

  // 후원 발생 → 어드민 알림
  createDashboardNotification(DB, 'admin', null, 'donation_received', '후원 발생', `${amount}딜 후원`, '/admin/settlement').catch(swallow('points:api:points'));

  return {
    status: 200,
    body: {
      success: true,
      data: {
        amount,
        balance: newBalance,
        seller_name: stream.seller_name,
      },
      message: `${Number(amount ?? 0).toLocaleString('ko-KR')}딜을 후원했습니다!`,
    },
  };
}

// ── GET /api/points/history ──────────────────────────────────────────
pointsRoutes.get('/history', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  // H8: user_points.user_id는 TEXT — 항상 String(user.id)로 통일
  const userId = String(user.id);
  const { results } = await DB.prepare(
    'SELECT id, type, amount, points_amount, balance_after, description, created_at FROM point_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50'
  ).bind(userId).all();

  return c.json({ success: true, data: results ?? [] });
});

// ── GET /api/points/charge-options ───────────────────────────────────
pointsRoutes.get('/charge-options', async (c) => {
  return c.json({ success: true, data: CHARGE_AMOUNTS });
});

// ── 리워드 광고 ────────────────────────────────────────────────────
const AD_REWARD_POINTS = 50;   // 광고 1회 시청 = 50딜
const AD_DAILY_LIMIT = 10;      // 하루 최대 10회
const AD_REWARD_DESC_PREFIX = '[광고리워드]'; // description 기반 구분

// POST /api/points/ad-reward — 광고 시청 완료 후 딜 지급
pointsRoutes.post('/ad-reward', rateLimit({ action: 'points_ad_reward', max: 5, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id); // 항상 문자열로 통일

  // 오늘 이미 시청한 횟수 확인 (KST 기준)
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const kstDateStr = kstNow.toISOString().slice(0, 10);

  try {
    const countRow = await DB.prepare(
      `SELECT COUNT(*) as cnt FROM point_transactions
       WHERE user_id = ? AND description LIKE ? AND DATE(created_at, '+9 hours') = ?`
    ).bind(userId, `${AD_REWARD_DESC_PREFIX}%`, kstDateStr).first<{ cnt: number }>();

    const todayCount = countRow?.cnt ?? 0;
    if (todayCount >= AD_DAILY_LIMIT) {
      return c.json({
        success: false,
        error: `오늘 광고 시청 한도(${AD_DAILY_LIMIT}회)에 도달했습니다`,
        data: { todayCount, dailyLimit: AD_DAILY_LIMIT, nextResetKST: kstDateStr + ' 자정' },
      }, 429);
    }

    // v24 FIX: lost-update 방지. 원자적 UPSERT (balance = balance + ?)로 전환.
    // SELECT-then-UPDATE 패턴은 동시 광고 보상 요청 시 잔액 덮어쓰기 발생.
    await DB.prepare(`
      INSERT INTO user_points (user_id, balance, total_charged, total_donated)
      VALUES (?, ?, 0, 0)
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + excluded.balance,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, AD_REWARD_POINTS).run();

    // 거래 기록용 최신 잔액 조회 (원자적 UPSERT 후)
    const afterRow = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();
    const newBalance = afterRow?.balance ?? AD_REWARD_POINTS;

    // 거래 기록 (type='charge'로 저장, description으로 광고 리워드 구분)
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description)
       VALUES (?, 'charge', 0, 0, ?, ?, ?)`
    ).bind(userId, AD_REWARD_POINTS, newBalance, `${AD_REWARD_DESC_PREFIX} 광고 시청 리워드 (+${AD_REWARD_POINTS}딜)`).run();

    return c.json({
      success: true,
      data: {
        rewarded: AD_REWARD_POINTS,
        balance: newBalance,
        todayCount: todayCount + 1,
        dailyLimit: AD_DAILY_LIMIT,
      },
    });
  } catch (err) {
    console.error('[ad-reward] Error:', err);
    return c.json({ success: false, error: '리워드 지급 중 오류가 발생했습니다', detail: String(err) }, 500);
  }
});

// GET /api/points/ad-reward/status — 오늘 광고 시청 현황
pointsRoutes.get('/ad-reward/status', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const kstDateStr = kstNow.toISOString().slice(0, 10);

  const countRow = await DB.prepare(
    `SELECT COUNT(*) as cnt FROM point_transactions
     WHERE user_id = ? AND description LIKE ? AND DATE(created_at, '+9 hours') = ?`
  ).bind(userId, `${AD_REWARD_DESC_PREFIX}%`, kstDateStr).first<{ cnt: number }>();

  return c.json({
    success: true,
    data: {
      todayCount: countRow?.cnt ?? 0,
      dailyLimit: AD_DAILY_LIMIT,
      rewardPerAd: AD_REWARD_POINTS,
    },
  });
});

// ── POST /api/points/pay — 딜로 상품 결제 ───────────────────────────
pointsRoutes.post('/pay', rateLimit({ action: 'points_pay', max: 20, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);

  // ✅ SECURITY FIX: Ignore client-supplied total_amount/price. Recompute server-side.
  const { order_number, items, shipping, live_stream_id } = await c.req.json<{
    order_number: string;
    total_amount?: number; // ignored (kept for back-compat parsing)
    // 🛡️ 2026-05-13 (Phase A1): 라이브 결제면 social proof broadcast 트리거.
    live_stream_id?: number;
    items: Array<{
      product_id: string | number;
      product_name?: string;
      quantity: number;
      price?: number; // ignored — fetched from DB
      seller_id?: string;
      option_value?: string;
    }>;
    shipping: {
      name: string;
      phone: string;
      postal_code: string;
      address1: string;
      address2?: string;
    };
  }>();

  if (!order_number || !items?.length || !shipping?.name) {
    return c.json({ success: false, error: '필수 항목이 누락되었습니다' }, 400);
  }

  // 🛡️ 입력 검증
  if (typeof order_number !== 'string' || order_number.length === 0 || order_number.length > 100) {
    return c.json({ success: false, error: '유효하지 않은 order_number' }, 400);
  }
  if (!Array.isArray(items) || items.length > 100) {
    return c.json({ success: false, error: '주문 항목 수가 유효하지 않습니다' }, 400);
  }

  // ✅ IDEMPOTENCY: client-supplied `order_number` doubles as the idempotency
  //   key. If a row already exists with this order_number *for this user*,
  //   return it — DO NOT re-deduct deals or re-reserve stock.
  //
  // HIGH-4: Use an exact-match pattern instead of arbitrary prefix `LIKE '${ord}%'`,
  // which would let an attacker collide with another user's order by guessing a
  // prefix. Sub-orders follow the format `${order_number}_s{sellerId}`.
  try {
    const existingOrder = await DB.prepare(
      `SELECT id, order_number, total_amount FROM orders
       WHERE (order_number = ? OR order_number LIKE ?)
         AND user_id = ?
       LIMIT 1`
    ).bind(order_number, `${order_number}_s%`, userId)
     .first<{ id: number; order_number: string; total_amount: number }>();
    if (existingOrder) {
      const wallet2 = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
        .bind(userId).first<{ balance: number }>();
      return c.json({
        success: true,
        data: {
          order_number,
          amount_paid: existingOrder.total_amount,
          balance: wallet2?.balance ?? 0,
          payment_method: 'deal_points',
        },
        message: '이미 처리된 결제입니다',
      });
    }
  } catch { /* ignore — defensive */ }

  // ✅ Server-side price lookup: fetch actual price + seller_id from DB
  const productIds = Array.from(new Set(items.map(i => Number(i.product_id)))).filter(n => !isNaN(n));
  if (productIds.length === 0) {
    return c.json({ success: false, error: '유효하지 않은 상품입니다' }, 400);
  }

  const placeholders = productIds.map(() => '?').join(',');
  const { results: productRows = [] } = await DB.prepare(
    `SELECT id, name, price, seller_id, stock FROM products WHERE id IN (${placeholders}) AND is_active = 1`
  ).bind(...productIds).all<{ id: number; name: string; price: number; seller_id: number | null; stock: number }>();

  const productMap = new Map<number, { id: number; name: string; price: number; seller_id: number | null; stock: number }>();
  for (const p of productRows) productMap.set(Number(p.id), p);

  // Validate all items exist + have stock
  for (const item of items) {
    const p = productMap.get(Number(item.product_id));
    if (!p) {
      return c.json({ success: false, error: `상품을 찾을 수 없거나 판매 중단된 상품입니다 (id: ${item.product_id})` }, 404);
    }
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) {
      return c.json({ success: false, error: '수량이 유효하지 않습니다' }, 400);
    }
    if (p.stock < qty) {
      return c.json({ success: false, error: `재고 부족: ${p.name}` }, 400);
    }
  }

  // Build server-side normalized items with authoritative price
  const normalizedItems = items.map(i => {
    const p = productMap.get(Number(i.product_id))!;
    return {
      product_id: p.id,
      product_name: p.name,
      price: Number(p.price),
      quantity: Number(i.quantity),
      seller_id: p.seller_id ? String(p.seller_id) : '0',
      option_value: i.option_value,
    };
  });

  // Group by seller to compute shipping fee per seller
  const sellerGroups = new Map<string, typeof normalizedItems>();
  for (const item of normalizedItems) {
    const sid = item.seller_id;
    if (!sellerGroups.has(sid)) sellerGroups.set(sid, []);
    sellerGroups.get(sid)!.push(item);
  }

  // Compute authoritative total (subtotal + shipping per seller group)
  let authoritativeTotal = 0;
  for (const [, groupItems] of sellerGroups) {
    const groupSubtotal = groupItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingFee = groupSubtotal >= 50000 ? 0 : 3000;
    authoritativeTotal += groupSubtotal + shippingFee;
  }

  // ✅ Validate balance BEFORE deducting
  const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number }>();

  if (!wallet || wallet.balance < authoritativeTotal) {
    return c.json({
      success: false,
      error: `딜이 부족합니다. (보유: ${wallet?.balance ?? 0}딜, 필요: ${authoritativeTotal}딜)`,
      code: 'INSUFFICIENT_POINTS',
    }, 400);
  }

  // ✅ Atomic deduct (balance >= authoritativeTotal guard)
  const deductRes = await DB.prepare(
    'UPDATE user_points SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND balance >= ?'
  ).bind(authoritativeTotal, userId, authoritativeTotal).run();
  if (!deductRes.meta.changes) {
    return c.json({ success: false, error: '딜이 부족합니다 (동시 결제 충돌)', code: 'INSUFFICIENT_POINTS' }, 400);
  }

  // Track stock reservations so we can roll back on failure
  const stockReserved: Array<{ product_id: number; quantity: number }> = [];

  try {
    const afterWallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();
    const newBalance = afterWallet?.balance ?? 0;

    // ✅ PERF: batch all stock reservations in a single D1 round-trip.
    // Each UPDATE is still atomic per row thanks to `stock >= ?` guard.
    const stockStmts = normalizedItems.map(item =>
      DB.prepare(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ? AND is_active = 1'
      ).bind(item.quantity, item.product_id, item.quantity)
    );
    const stockResults = await DB.batch(stockStmts);
    for (let i = 0; i < stockResults.length; i++) {
      const changes = stockResults[i]?.meta?.changes ?? 0;
      if (changes === 0) {
        throw new Error(`재고 부족 (동시 결제 충돌): ${normalizedItems[i].product_name}`);
      }
      stockReserved.push({
        product_id: normalizedItems[i].product_id,
        quantity: normalizedItems[i].quantity,
      });
    }

    // Transaction record
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
       VALUES (?, 'donate', ?, 0, ?, ?, ?, ?)`
    ).bind(userId, authoritativeTotal, authoritativeTotal, newBalance, `상품 구매 (${normalizedItems.length}건)`, order_number).run();

    // Create orders per seller
    // ✅ PERF: use INSERT meta.last_row_id (avoids a separate SELECT per order)
    //         and batch all order_items per order into a single multi-row INSERT.
    for (const [sellerId, groupItems] of sellerGroups) {
      const groupSubtotal = groupItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const shippingFee = groupSubtotal >= 50000 ? 0 : 3000;
      const sellerOrderNumber = `${order_number}_s${sellerId}`;

      // 🛡️ 2026-05-13 (Phase A1): live_stream_id 포함 → 라이브 분석/Social proof 트리거.
      //   컬럼 없는 환경 대비 try-catch + 일반 INSERT fallback.
      let orderInsert: D1Result;
      try {
        orderInsert = await DB.prepare(`
          INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method, shipping_name, shipping_phone, shipping_address, shipping_memo, live_stream_id)
          VALUES (?, ?, ?, ?, ?, 0, ?, 'KRW', 'PAID', 'deal_points', ?, ?, ?, '', ?)
        `).bind(
          sellerOrderNumber, userId, sellerId === '0' ? null : sellerId,
          groupSubtotal, shippingFee, groupSubtotal + shippingFee,
          shipping.name, shipping.phone,
          JSON.stringify({ postal_code: shipping.postal_code, address1: shipping.address1, address2: shipping.address2 || '' }),
          live_stream_id ?? null,
        ).run();
      } catch {
        orderInsert = await DB.prepare(`
          INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method, shipping_name, shipping_phone, shipping_address, shipping_memo)
          VALUES (?, ?, ?, ?, ?, 0, ?, 'KRW', 'PAID', 'deal_points', ?, ?, ?, '')
        `).bind(
          sellerOrderNumber, userId, sellerId === '0' ? null : sellerId,
          groupSubtotal, shippingFee, groupSubtotal + shippingFee,
          shipping.name, shipping.phone,
          JSON.stringify({ postal_code: shipping.postal_code, address1: shipping.address1, address2: shipping.address2 || '' })
        ).run();
      }

      const orderId = orderInsert.meta.last_row_id as number | undefined;

      if (orderId && groupItems.length > 0) {
        const values = groupItems.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const bindings = groupItems.flatMap(item => [
          orderId,
          item.product_id,
          item.product_name,
          item.price,
          item.price,
          item.quantity,
          item.price * item.quantity,
        ]);
        await DB.prepare(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, price, quantity, subtotal) VALUES ${values}`
        ).bind(...bindings).run();
      }
    }

    createDashboardNotification(DB, 'admin', null, 'deal_payment', '딜 결제', `${Number(authoritativeTotal ?? 0).toLocaleString('ko-KR')}딜 상품 결제`, '/admin/orders').catch(swallow('points:api:points'));

    // 🛡️ 2026-05-19: KT Alpha 교환권 자동 발송 — 딜 교환 전용 상품 결제 시.
    try {
      const ktOrders = await DB.prepare(
        `SELECT id, shipping_phone, user_id FROM orders WHERE order_number LIKE ? AND user_id = ? AND status = 'PAID'`
      ).bind(`${order_number}%`, userId).all<{ id: number; shipping_phone: string | null; user_id: string }>()
        .catch(() => ({ results: [] }))
      if (ktOrders.results && ktOrders.results.length > 0) {
        const { autoSendKtAlphaVouchersForOrders } = await import('@/worker/utils/kt-alpha-auto-send')
        await autoSendKtAlphaVouchersForOrders(
          c.env as unknown as Parameters<typeof autoSendKtAlphaVouchersForOrders>[0],
          ktOrders.results,
          userId,
        )
      }
    } catch (e) {
      console.error('[points/pay] kt-alpha auto-send failed:', e)
    }

    return c.json({
      success: true,
      data: {
        order_number,
        amount_paid: authoritativeTotal,
        balance: newBalance,
        payment_method: 'deal_points',
      },
      message: `${Number(authoritativeTotal ?? 0).toLocaleString('ko-KR')}딜로 결제가 완료되었습니다!`,
    });
  } catch (err) {
    console.error('[points/pay] Error:', err);
    // ✅ Refund deals on any failure
    try {
      await DB.prepare(
        'UPDATE user_points SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).bind(authoritativeTotal, userId).run();
    } catch (refundErr) {
      console.error('[points/pay] Refund failed:', refundErr);
    }
    // ✅ Roll back any stock reservations
    for (const r of stockReserved) {
      try {
        await DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .bind(r.quantity, r.product_id).run();
      } catch (stockErr) {
        console.error('[points/pay] Stock rollback failed:', stockErr);
      }
    }
    return c.json({ success: false, error: '딜 결제 중 오류가 발생했습니다', detail: String(err) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ 2026-05-19: 일반 user 의 딜 → 현금 출금 (추천 수익 환급용).
//
// 최소 10,000딜 / 8.8% 원천징수 (기타소득 — 사업자 미등록 기본)
// 어드민이 주 1회 일괄 송금 처리 (`/admin/user-withdrawals` 페이지).
// ─────────────────────────────────────────────────────────────────────────────
pointsRoutes.post('/withdraw',
  rateLimit({ action: 'user_deal_withdraw', max: 5, windowSec: 3600 }),
  requireAuth(),
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)

    const body = await c.req.json<{
      amount?: number
      bank_name?: string
      bank_account?: string
      account_holder?: string
    }>().catch(() => ({}))

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount < 10000 || amount > 10_000_000) {
      return c.json({ success: false, error: '출금 금액은 10,000~10,000,000딜 사이' }, 400)
    }
    const bankName = (body.bank_name || '').trim()
    const bankAccount = (body.bank_account || '').trim().replace(/[^0-9-]/g, '')
    const holder = (body.account_holder || '').trim()
    if (!bankName || bankName.length > 30) return c.json({ success: false, error: '은행명 1~30자' }, 400)
    if (!bankAccount || bankAccount.length < 5 || bankAccount.length > 30) return c.json({ success: false, error: '계좌번호 5~30자' }, 400)
    if (!holder || holder.length > 30) return c.json({ success: false, error: '예금주명 1~30자' }, 400)

    const { DB } = c.env
    const userId = String(user.id)

    // 잔액 확인 + 차감 (atomic — UPDATE WHERE balance >= amount).
    const decResult = await DB.prepare(
      `UPDATE user_points SET balance = balance - ?, updated_at = datetime('now')
       WHERE user_id = ? AND balance >= ?`
    ).bind(amount, userId, amount).run().catch(() => null)
    if (!decResult || (decResult.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '딜 잔액 부족' }, 400)
    }

    // 8.8% 원천징수 (소득세 8% + 지방세 0.8%) — 정수 floor.
    const tax = Math.floor(amount * 0.088)
    const net = amount - tax

    try {
      const result = await DB.prepare(`
        INSERT INTO user_withdrawals
          (user_id, amount, withholding_tax, net_amount, bank_name, bank_account, account_holder)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, amount, tax, net, bankName, bankAccount, holder).run()

      return c.json({
        success: true,
        data: {
          withdrawal_id: result.meta?.last_row_id,
          amount, withholding_tax: tax, net_amount: net,
          status: 'requested',
          eta: '영업일 기준 3-5일 내 입금',
        },
      })
    } catch (err) {
      // INSERT 실패 시 차감된 잔액 복구.
      await DB.prepare(
        `UPDATE user_points SET balance = balance + ? WHERE user_id = ?`
      ).bind(amount, userId).run().catch(() => null)
      return c.json({ success: false, error: '출금 요청 저장 실패 — 잔액 자동 복구됨. 잠시 후 다시 시도해주세요.' }, 500)
    }
  }
)

// GET — 내 출금 내역
pointsRoutes.get('/withdrawals', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const userId = String(user.id)
  const { DB } = c.env

  const rows = await DB.prepare(`
    SELECT id, amount, withholding_tax, net_amount,
           bank_name, account_holder, status, requested_at, processed_at, rejection_reason,
           -- 계좌번호는 끝 4자리만 노출 (PII 보호).
           '****' || SUBSTR(bank_account, -4) AS bank_account_masked
    FROM user_withdrawals
    WHERE user_id = ?
    ORDER BY requested_at DESC
    LIMIT 50
  `).bind(userId).all().catch(() => ({ results: [] }))

  return c.json({ success: true, data: rows.results || [] })
})

export { pointsRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTables = new WeakSet<object>()
