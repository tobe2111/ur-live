/**
 * 브랜드메시지(카카오 친구톡) 크레딧 시스템 API
 *
 * GET  /api/seller/alimtalk/credits          - 잔액 + 이력 + 패키지 조회
 * POST /api/seller/alimtalk/credits/charge   - 충전 결제 시작 (토스)
 * POST /api/seller/alimtalk/credits/confirm  - 결제 완료 → 크레딧 지급
 * GET  /api/seller/alimtalk/logs             - 발송 이력
 *
 * 브랜드메시지(친구톡): 25원/건  |  알리고 원가: 19.9원/건
 * 자동 발송 알림톡(주문/배송/취소)은 플랫폼 예산으로 별도 처리
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { safeError } from '@/worker/utils/safe-error';
import {TOSS_PAYMENT_URL } from '@/shared/constants';
import { withCircuitBreaker } from '@/worker/utils/circuit-breaker';
const alimtalkRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

interface DbPackage {
  id: number;
  label: string;
  credits: number;
  price: number;
  is_active: number;
  sort_order: number;
}

// ── JWT에서 seller_id 추출 ────────────────────────────────────────────────────
async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    const { verify } = await import('hono/jwt');
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number };
    return payload.seller_id ?? null;
  } catch {
    return null;
  }
}

// ── alimtalk_packages 테이블 자동 생성 ────────────────────────────────────────
async function ensureAlimtalkPackagesTable(DB: Env['DB']): Promise<void> {
  if (_done_ensureAlimtalkPackagesTable.has(DB)) return
  _done_ensureAlimtalkPackagesTable.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS alimtalk_packages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        label      TEXT    NOT NULL,
        credits    INTEGER NOT NULL,
        price      INTEGER NOT NULL,
        is_active  INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    const count = await DB.prepare('SELECT COUNT(*) as c FROM alimtalk_packages').first<{ c: number }>();
    if (!count || count.c === 0) {
      await DB.prepare(`
        INSERT INTO alimtalk_packages (label, credits, price, is_active, sort_order) VALUES
          ('100건',   100,   900,   1, 1),
          ('500건',   500,   4500,  1, 2),
          ('1,000건', 1000,  9000,  1, 3),
          ('3,000건', 3000,  27000, 1, 4),
          ('5,000건', 5000,  45000, 1, 5)
      `).run();
    }
  } catch {
    // Table might already exist, ignore errors
  }
}

// ── DB에서 활성 패키지 목록 조회 ──────────────────────────────────────────────
async function getActivePackages(DB: Env['DB']): Promise<DbPackage[]> {
  try {
    await ensureAlimtalkPackagesTable(DB);
    const { results } = await DB.prepare(
      `SELECT id, label, credits, price, is_active, sort_order
       FROM alimtalk_packages WHERE is_active = 1
       ORDER BY sort_order ASC`
    ).all<DbPackage>();
    return results ?? [];
  } catch {
    // 테이블 미생성 시 빈 배열 반환
    return [];
  }
}

// ── GET /credits ──────────────────────────────────────────────────────────────
alimtalkRoutes.get('/credits', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  try {
    const [credit, history, packages] = await Promise.all([
      DB.prepare('SELECT balance FROM seller_credits WHERE seller_id = ?')
        .bind(sellerId).first<{ balance: number }>(),
      DB.prepare(`
        SELECT id, type, amount, price_paid, description, created_at
        FROM credit_transactions
        WHERE seller_id = ?
        ORDER BY created_at DESC LIMIT 50
      `).bind(sellerId).all<{
        id: number; type: string; amount: number;
        price_paid: number | null; description: string | null; created_at: string;
      }>(),
      getActivePackages(DB),
    ]);

    return c.json({
      success: true,
      data: {
        balance: credit?.balance ?? 0,
        packages,
        history: history.results ?? [],
      },
    });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[alimtalk]');
  }
});

// ── POST /credits/charge ──────────────────────────────────────────────────────
// 충전 결제 시작: 패키지 ID(DB) → 토스 결제창 오픈에 필요한 정보 반환
alimtalkRoutes.post('/credits/charge', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const body = await c.req.json<{ package_id: number }>();

  // DB에서 패키지 조회
  const pkg = await c.env.DB.prepare(
    'SELECT id, label, credits, price, is_active FROM alimtalk_packages WHERE id = ? AND is_active = 1'
  ).bind(body.package_id).first<DbPackage>().catch(() => null);

  if (!pkg) return c.json({ success: false, error: '유효하지 않은 패키지입니다' }, 400);

  // 토스 결제용 주문 ID
  const orderId = `ALT-${sellerId}-pkg${pkg.id}-${Date.now()}`;

  return c.json({
    success: true,
    data: {
      orderId,
      amount: pkg.price,
      orderName: `브랜드메시지 ${pkg.label} 충전`,
      credits: pkg.credits,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// ── POST /credits/confirm ─────────────────────────────────────────────────────
// 토스 결제 완료 후 크레딧 지급
alimtalkRoutes.post('/credits/confirm', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const body = await c.req.json<{ paymentKey: string; orderId: string; amount: number }>();

  // orderId에서 패키지 ID 추출 (ALT-{sellerId}-pkg{id}-{ts})
  const pkgIdMatch = body.orderId.match(/pkg(\d+)/);
  const pkgId = pkgIdMatch ? parseInt(pkgIdMatch[1]) : null;

  const { DB } = c.env;

  // DB에서 패키지 조회 (is_active 여부 무관 — 결제 시점엔 활성이었음)
  const pkg = pkgId
    ? await DB.prepare('SELECT id, label, credits, price FROM alimtalk_packages WHERE id = ?')
        .bind(pkgId).first<DbPackage>().catch(() => null)
    : null;

  // 금액 기반 폴백 (패키지 ID 파싱 실패 시)
  const resolvedPkg = pkg ??
    await DB.prepare('SELECT id, label, credits, price FROM alimtalk_packages WHERE price = ? AND is_active = 1 LIMIT 1')
      .bind(body.amount).first<DbPackage>().catch(() => null);

  if (!resolvedPkg) return c.json({ success: false, error: '패키지 정보를 확인할 수 없습니다' }, 400);
  if (resolvedPkg.price !== body.amount) return c.json({ success: false, error: '결제 금액이 패키지와 다릅니다' }, 400);

  // 중복 결제 확인
  const dup = await DB.prepare(
    'SELECT id FROM credit_transactions WHERE payment_key = ?'
  ).bind(body.paymentKey).first<{ id: number }>();
  if (dup) return c.json({ success: false, error: '이미 처리된 결제입니다' }, 409);

  // 토스 결제 승인 (Idempotency-Key로 중복 승인 방지)
  let tossRes: Response;
  try {
    tossRes = await withCircuitBreaker(
      { name: 'toss-confirm', maxFailures: 10, resetTimeoutMs: 60_000 },
      () => fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(c.env.TOSS_SECRET_KEY + ':')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `alimtalk_${body.orderId}_${body.paymentKey}`,
        },
        // 🛡️ Defense-in-depth: send DB-verified resolvedPkg.price (equal to client amount above)
        body: JSON.stringify({ paymentKey: body.paymentKey, orderId: body.orderId, amount: resolvedPkg.price }),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  } catch {
    return c.json({ success: false, error: 'Toss 결제 시스템이 일시 중단됐습니다. 잠시 후 다시 시도해주세요.', code: 'CIRCUIT_OPEN' }, 503);
  }

  if (!tossRes.ok) {
    const err = await tossRes.json<{ message?: string }>();
    return c.json({ success: false, error: err.message ?? '결제 승인 실패' }, 400);
  }

  // D1 배치: 잔액 증가 + 이력 기록
  await DB.batch([
    DB.prepare(`
      INSERT INTO seller_credits (seller_id, balance, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(seller_id) DO UPDATE SET
        balance = balance + excluded.balance,
        updated_at = datetime('now')
    `).bind(sellerId, resolvedPkg.credits),
    DB.prepare(`
      INSERT INTO credit_transactions (seller_id, type, amount, price_paid, description, payment_key, created_at)
      VALUES (?, 'charge', ?, ?, ?, ?, datetime('now'))
    `).bind(sellerId, resolvedPkg.credits, resolvedPkg.price, `브랜드메시지 ${resolvedPkg.label} 충전`, body.paymentKey),
  ]);

  return c.json({
    success: true,
    data: { credits_added: resolvedPkg.credits, description: `브랜드메시지 ${resolvedPkg.label} 충전` },
    message: `${Number(resolvedPkg.credits ?? 0).toLocaleString('ko-KR')}건이 충전되었습니다.`,
  });
});

// ── GET /logs ─────────────────────────────────────────────────────────────────
alimtalkRoutes.get('/logs', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const limit = Math.min(parseInt(c.req.query('limit') || '30', 10), 100);

  try {
    const logs = await DB.prepare(`
      SELECT id, receiver, template_code, message, order_id, success, error_msg, created_at
      FROM alimtalk_logs
      WHERE seller_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).bind(sellerId, limit).all();

    return c.json({ success: true, data: logs.results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });  // 테이블 없으면 빈 배열
  }
});

export { alimtalkRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureAlimtalkPackagesTable = new WeakSet<object>()
