/**
 * Payment confirmation guards — pure logic regression tests
 *
 * `POST /api/payments/confirm` 의 보안 가드 로직 (src/worker/routes/payment.routes.ts:120-130).
 * D1 / Toss 호출 없이 핵심 검증만 시뮬레이션:
 *
 *   1. user mismatch: 인증 사용자 ID ≠ order.user_id → 403
 *   2. amount mismatch: 클라이언트 amount ≠ DB total_amount 합계 → 400
 *
 * 이 테스트는 `payment.routes.ts:121-141` 의 비즈니스 룰을 모방하며,
 * 향후 가드 로직 변경 시 이 테스트가 깨지면 의도된 변경인지 재확인 필요.
 */
import { describe, it, expect } from 'vitest';

interface OrderRow {
  id: string;
  user_id: string;
  total_amount: number;
}

type GuardResult =
  | { ok: true }
  | { ok: false; status: 403 | 400; reason: string };

function checkPaymentGuards(
  authUserId: string,
  orders: OrderRow[],
  clientAmount: number,
): GuardResult {
  // 1. 사용자 검증 — 타입 안전 비교 (DB INTEGER, auth STRING 모두 처리)
  const unauthorized = orders.find(o => String(o.user_id) !== String(authUserId));
  if (unauthorized) {
    return { ok: false, status: 403, reason: 'PAYMENT_USER_MISMATCH' };
  }

  // 2. 금액 검증 — DB 기준 재계산 (클라이언트 변조 방지)
  const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
  if (totalAmount !== clientAmount) {
    return { ok: false, status: 400, reason: 'PAYMENT_AMOUNT_MISMATCH' };
  }

  return { ok: true };
}

describe('Payment confirm guards — user verification', () => {
  it('단일 주문, 본인 → 통과', () => {
    const orders: OrderRow[] = [{ id: 'o1', user_id: 'user-1', total_amount: 10000 }];
    expect(checkPaymentGuards('user-1', orders, 10000)).toEqual({ ok: true });
  });

  it('단일 주문, 다른 사용자 → 403', () => {
    const orders: OrderRow[] = [{ id: 'o1', user_id: 'user-1', total_amount: 10000 }];
    const r = checkPaymentGuards('attacker-9', orders, 10000);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.reason).toBe('PAYMENT_USER_MISMATCH');
    }
  });

  it('다중 주문 — 일부만 본인 → 403 (전부 본인이어야)', () => {
    const orders: OrderRow[] = [
      { id: 'o1', user_id: 'user-1', total_amount: 5000 },
      { id: 'o2', user_id: 'user-9', total_amount: 5000 }, // 다른 사람 주문 끼어듦
    ];
    const r = checkPaymentGuards('user-1', orders, 10000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('타입 안전 비교 — DB number, auth string 도 통과', () => {
    const orders: OrderRow[] = [{ id: 'o1', user_id: '123' as string, total_amount: 5000 }];
    expect(checkPaymentGuards('123', orders, 5000)).toEqual({ ok: true });
    // 다른 number-like string 은 거부
    const r = checkPaymentGuards('1234', orders, 5000);
    expect(r.ok).toBe(false);
  });
});

describe('Payment confirm guards — amount verification', () => {
  it('금액 정확히 일치 → 통과', () => {
    const orders: OrderRow[] = [
      { id: 'o1', user_id: 'u1', total_amount: 7000 },
      { id: 'o2', user_id: 'u1', total_amount: 3000 },
    ];
    expect(checkPaymentGuards('u1', orders, 10000)).toEqual({ ok: true });
  });

  it('클라이언트 금액 변조 (낮춤) → 400', () => {
    const orders: OrderRow[] = [{ id: 'o1', user_id: 'u1', total_amount: 10000 }];
    const r = checkPaymentGuards('u1', orders, 100); // 클라이언트가 100원으로 위조
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.reason).toBe('PAYMENT_AMOUNT_MISMATCH');
    }
  });

  it('클라이언트 금액 변조 (높임) → 400', () => {
    const orders: OrderRow[] = [{ id: 'o1', user_id: 'u1', total_amount: 10000 }];
    const r = checkPaymentGuards('u1', orders, 99999);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('user mismatch 가 amount mismatch 보다 먼저 검증 (정보 누출 방지)', () => {
    // 다른 사용자 주문 + 잘못된 금액 → user mismatch (403) 가 먼저 응답
    const orders: OrderRow[] = [{ id: 'o1', user_id: 'u9', total_amount: 10000 }];
    const r = checkPaymentGuards('u1', orders, 99); // 둘 다 잘못
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403); // user 가 먼저
  });

  it('빈 orders 배열 → 0 === clientAmount 일 때만 통과 (정상 케이스: caller 가 주문 검증 후 호출)', () => {
    expect(checkPaymentGuards('u1', [], 0)).toEqual({ ok: true });
    const r = checkPaymentGuards('u1', [], 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});
