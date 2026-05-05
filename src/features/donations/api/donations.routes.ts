/**
 * 라이브 후원(도네이션) API
 *
 * POST /api/donations/init        - 후원 결제 시작 (토스)
 * POST /api/donations/confirm     - 결제 완료 → 후원 기록
 * GET  /api/donations/stream/:id  - 스트림 후원 목록 (공개)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { verifyTurnstile } from '@/worker/utils/turnstile';
import type { Env } from '@/worker/types/env';
import { TOSS_PAYMENT_URL } from '@/shared/constants';

import { swallow } from '@/worker/utils/swallow';
const donationsRoutes = new Hono<{ Bindings: Env }>();

donationsRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'https://world.ur-team.com', 'https://ur-live.pages.dev', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
}));

// ── POST /api/donations/init ─────────────────────────────────────────────────
// 후원 결제 시작: pending 레코드를 DB에 저장 후 토스 결제 정보 반환
// confirm 단계에서 DB 저장 금액으로 검증하여 금액 조작을 방지합니다.
// 🛡️ 2026-05-03: Turnstile (CAPTCHA) 추가 — 분산 봇 spam donate 방어 (rate limit + bot challenge 다층).
donationsRoutes.post('/init', rateLimit({ action: 'donations_init', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const userId = user.id;

  const body = await c.req.json<{
    stream_id: number;
    amount: number;
    message?: string;
    donor_name?: string;
    is_anonymous?: boolean;
    turnstile_token?: string;
  }>();

  // 🛡️ Turnstile 검증 (TURNSTILE_SECRET 미설정 시 fail-open, 즉시 활성 안전).
  const ip = c.req.header('cf-connecting-ip') || undefined;
  const turnstileOk = await verifyTurnstile(c.env.TURNSTILE_SECRET, body.turnstile_token, ip);
  if (!turnstileOk) {
    return c.json({ success: false, error: '봇 검증 실패. 페이지를 새로고침 후 다시 시도해주세요.' }, 403);
  }

  if (!body.stream_id || !body.amount) {
    return c.json({ success: false, error: '필수 항목 누락 (stream_id, amount)' }, 400);
  }
  // 🛡️ stream_id 형식 검증 — NaN/음수/매우 큰 수 방지
  if (!Number.isFinite(body.stream_id) || body.stream_id < 1 || body.stream_id > 1e10) {
    return c.json({ success: false, error: 'stream_id 형식이 올바르지 않습니다' }, 400);
  }
  if (!Number.isFinite(body.amount) || body.amount < 1000 || body.amount % 100 !== 0) {
    return c.json({ success: false, error: '후원 금액은 최소 1,000원이며 100원 단위여야 합니다' }, 400);
  }
  // ✅ SECURITY FIX (H1): Upper bound on donation amount (prevent overflow /
  //    abuse via oversized values).
  if (body.amount > 10_000_000) {
    return c.json({ success: false, error: '후원 금액은 최대 1천만원입니다' }, 400);
  }

  // 🛡️ 2026-04-22: 일일 후원 한도 (user 당 5천만원/일) — 돈세탁/fraud 방어
  try {
    const dailyTotal = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM donations
       WHERE user_id = ?
         AND payment_status = 'approved'
         AND created_at >= datetime('now', '-1 day')`
    ).bind(String(userId)).first<{ total: number }>().catch(() => ({ total: 0 }));

    const DAILY_CAP = 50_000_000;
    if ((dailyTotal?.total ?? 0) + body.amount > DAILY_CAP) {
      return c.json({
        success: false,
        error: '일일 후원 한도(5천만원)를 초과합니다. 24시간 후 다시 시도해주세요.',
      }, 429);
    }
  } catch { /* 테이블/컬럼 미존재 시 skip (legacy) */ }
  // ✅ C2 FIX: cap message length + XSS 위험 문자 제거
  if (body.message && body.message.length > 500) {
    return c.json({ success: false, error: '메시지는 500자 이내로 작성해주세요.' }, 400);
  }
  // 🛡️ 메시지 XSS 방어 (강화: 2026-04-29) — <, >, javascript:/data: URL, on* 이벤트 핸들러,
  //   HTML entity-encoded 변형까지 차단. 저장 시점 sanitize + 프런트는 텍스트 노드로만 렌더.
  if (body.message && typeof body.message === 'string') {
    body.message = body.message
      .replace(/[<>]/g, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/data\s*:/gi, '')
      .replace(/\bon[a-z]+\s*=/gi, '')   // onclick=, onerror= 등
      .replace(/&#x?[0-9a-f]+;?/gi, '')   // entity-encoded 차단
      .slice(0, 500);
  }

  const { DB } = c.env;

  // 스트림 + 셀러 정보 조회 (two-step: donation_commission_rate 컬럼 없을 수 있음)
  type StreamRow = { id: number; title: string; seller_id: number; seller_name: string; commission_rate: number; };
  let stream: StreamRow | null = null;
  try {
    stream = await DB.prepare(
      `SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name,
              COALESCE(s.donation_commission_rate, 15.0) AS commission_rate
       FROM live_streams ls
       JOIN sellers s ON ls.seller_id = s.id
       WHERE ls.id = ?`
    ).bind(body.stream_id).first<StreamRow>();
  } catch {
    // Fallback: donation_commission_rate column may not exist yet
    try {
      stream = await DB.prepare(
        `SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name, 15.0 AS commission_rate
         FROM live_streams ls
         JOIN sellers s ON ls.seller_id = s.id
         WHERE ls.id = ?`
      ).bind(body.stream_id).first<StreamRow>();
    } catch (err2) {
      console.error('[donations/init] DB error:', (err2 as Error).message);
      return c.json({ success: false, error: 'live_streams 테이블이 없습니다. 마이그레이션을 실행해주세요.' }, 500);
    }
  }

  if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

  // 라이브 중인 스트림에만 후원 가능
  const streamStatus = await DB.prepare('SELECT status FROM live_streams WHERE id = ?')
    .bind(body.stream_id).first<{ status: string }>().catch(() => null);
  if (!streamStatus || streamStatus.status !== 'live') {
    return c.json({ success: false, error: '현재 라이브 중인 방송에만 후원할 수 있습니다' }, 400);
  }

  // 🛡️ 2026-05-05 P0: 자기 자신에게 후원 차단 (셀러 = 후원자 = 어뷰징 패턴)
  try {
    const sellerOwner = await DB.prepare('SELECT user_id FROM sellers WHERE id = ?')
      .bind(stream.seller_id).first<{ user_id: string }>();
    if (sellerOwner?.user_id && String(sellerOwner.user_id) === String(userId)) {
      try {
        await DB.prepare(
          `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
           VALUES ('self_donation', ?, 'donation', ?, ?, 'high')`
        ).bind(String(userId), `stream-${body.stream_id}`, JSON.stringify({ amount: body.amount, sellerId: stream.seller_id })).run();
      } catch { /* abuse_detections may not exist yet */ }
      return c.json({ success: false, error: '본인 라이브에 후원할 수 없습니다' }, 400);
    }
  } catch { /* sellers row missing — skip check */ }

  const orderId = `DON-${userId}-${stream.id}-${Date.now()}`;
  const commissionAmount = Math.round(body.amount * stream.commission_rate / 100);
  const creditAmount = body.amount - commissionAmount;

  // 🛡️ 중복 방지 — 동일 스트림 + 동일 유저의 pending 후원 이미 있으면 거부
  // 빠른 2회 클릭으로 2개 pending 레코드 생기는 문제 방지
  const existingPending = await DB.prepare(
    `SELECT id FROM donations
     WHERE donor_user_id = ? AND live_stream_id = ? AND payment_status = 'pending'
     AND created_at >= datetime('now', '-10 minutes')`
  ).bind(userId, body.stream_id).first<{ id: number }>();
  if (existingPending) {
    return c.json({
      success: false,
      error: '이미 진행 중인 후원이 있습니다. 잠시 후 다시 시도해주세요.',
      code: 'DUPLICATE_PENDING_DONATION',
    }, 409);
  }

  // pending 레코드를 DB에 저장 — confirm 단계에서 이 레코드의 금액으로 검증
  // DB 스키마: live_stream_id (NOT stream_id), credit_amount (NOT seller_amount),
  //           payment_status (NOT status), is_anonymous 컬럼 없음
  await DB.prepare(`
    INSERT INTO donations
      (live_stream_id, seller_id, donor_user_id, donor_name, amount,
       commission_amount, credit_amount, commission_rate,
       order_id, payment_status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(
    body.stream_id, stream.seller_id, userId,
    body.is_anonymous ? '익명' : (body.donor_name ?? '익명'),
    body.amount, commissionAmount, creditAmount, stream.commission_rate,
    orderId,
    body.message ?? '',
  ).run();

  return c.json({
    success: true,
    data: {
      orderId,
      amount: body.amount,
      orderName: `${stream.seller_name} 라이브 후원`,
      streamId: stream.id,
      sellerName: stream.seller_name,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// ── POST /api/donations/confirm ──────────────────────────────────────────────
// 토스 결제 완료 → init에서 저장한 pending 레코드 기반으로 금액 검증 후 완료 처리
donationsRoutes.post('/confirm', rateLimit({ action: 'donations_confirm', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const userId = user.id;

  const body = await c.req.json<{
    paymentKey: string;
    orderId: string;
    amount: number;
  }>();

  if (!body.paymentKey || !body.orderId || !body.amount) {
    return c.json({ success: false, error: '필수 항목 누락' }, 400);
  }

  const { DB } = c.env;

  // init 단계에서 DB에 저장한 pending 레코드 조회 (금액 조작 방지)
  // DB 스키마: live_stream_id, credit_amount, payment_status
  type DonationRow = {
    id: number; live_stream_id: number; seller_id: number; amount: number;
    commission_amount: number; credit_amount: number; payment_status: string; donor_name: string;
  };
  const pending = await DB.prepare(
    'SELECT id, live_stream_id, seller_id, amount, commission_amount, credit_amount, payment_status, donor_name FROM donations WHERE order_id = ? AND donor_user_id = ?'
  ).bind(body.orderId, userId).first<DonationRow>().catch(() => null);

  if (!pending) return c.json({ success: false, error: '후원 정보를 찾을 수 없습니다. 다시 시도해주세요.' }, 404);
  // ✅ SECURITY FIX (H8): Only allow 'pending' → 'completed' transition.
  //    Without this guard a failed/refunded donation could be re-confirmed
  //    from the client side, reviving a canceled transaction.
  if (pending.payment_status !== 'pending') {
    return c.json({ success: false, error: '이미 처리된 후원입니다.' }, 409);
  }

  // 클라이언트가 보낸 amount를 DB 저장값으로 검증 (금액 조작 방지)
  if (pending.amount !== body.amount) {
    console.error('[donations/confirm] Amount mismatch', { db: pending.amount, client: body.amount, orderId: body.orderId });
    return c.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, 400);
  }

  // ✅ C2 FIX: confirm 시점에 스트림 상태 재확인.
  //    init 후 방송이 종료되었을 수 있으므로 결제 승인 전 한 번 더 검사한다.
  //    라이브가 아니면 결제를 취소하고 pending → cancelled 전이하여 이중 처리 방지.
  const streamRecheck = await DB.prepare('SELECT status FROM live_streams WHERE id = ?')
    .bind(pending.live_stream_id).first<{ status: string }>().catch(() => null);
  if (!streamRecheck || streamRecheck.status !== 'live') {
    if (import.meta.env.DEV) {
      console.warn('[donations/confirm] stream ended before confirm', {
        streamId: pending.live_stream_id,
        orderId: body.orderId,
        status: streamRecheck?.status ?? 'missing',
      });
    }
    await DB.prepare('UPDATE donations SET payment_status = ? WHERE order_id = ?')
      .bind('cancelled', body.orderId).run().catch(swallow('donations:api:donations'));
    return c.json({
      success: false,
      error: '방송이 종료되어 후원이 취소되었습니다. 결제는 승인되지 않았습니다.',
      code: 'STREAM_ENDED',
    }, 409);
  }

  // 토스 결제 승인 (DB에서 검증된 금액 사용)
  // Idempotency-Key: paymentKey 기반 — 동일 결제의 중복 승인 요청 방지
  const tossRes = await fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(c.env.TOSS_SECRET_KEY + ':')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': body.paymentKey,
    },
    body: JSON.stringify({ paymentKey: body.paymentKey, orderId: body.orderId, amount: pending.amount }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json<{ message?: string; code?: string }>();
    if (err.code !== 'ALREADY_PROCESSED_PAYMENT') {
      await DB.prepare('UPDATE donations SET payment_status = ? WHERE order_id = ?')
        .bind('failed', body.orderId).run();
      console.error('[donations/confirm] Toss error:', { code: err.code, message: err.message, orderId: body.orderId });
      return c.json({ success: false, error: err.message ?? '결제 승인 실패', code: err.code }, 400);
    }
  }

  // pending → completed 상태 업데이트 (payment_key 기록)
  await DB.prepare('UPDATE donations SET payment_status = ?, payment_key = ?, completed_at = datetime(\'now\') WHERE order_id = ?')
    .bind('completed', body.paymentKey, body.orderId).run();

  return c.json({
    success: true,
    data: {
      amount: pending.amount,
      credit_amount: pending.credit_amount,
      commission_amount: pending.commission_amount,
    },
    message: `${Number(pending.amount ?? 0).toLocaleString('ko-KR')}원 후원이 완료되었습니다!`,
  });
});

// ── GET /api/donations/stream/:streamId ──────────────────────────────────────
// 스트림 후원 목록 (최근 50건, 이름 마스킹)
donationsRoutes.get('/stream/:streamId', async (c) => {
  const { DB } = c.env;
  const streamId = c.req.param('streamId');

  try {
    const [donations, totalRow] = await Promise.all([
      DB.prepare(`
        SELECT id,
               SUBSTR(donor_name, 1, 1) || '**' AS donor_name,
               amount, message, created_at
        FROM donations
        WHERE live_stream_id = ? AND payment_status = 'completed'
        ORDER BY created_at DESC LIMIT 50
      `).bind(streamId).all(),
      DB.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM donations
        WHERE live_stream_id = ? AND payment_status = 'completed'
      `).bind(streamId).first<{ total: number }>(),
    ]);

    return c.json({ success: true, data: { donations: donations.results ?? [], total: totalRow?.total || 0 } });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

export { donationsRoutes };
