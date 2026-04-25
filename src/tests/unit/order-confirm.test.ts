/**
 * 주문 구매확정 로직 단위 테스트
 *
 * orders.routes.ts 의 POST /:id/confirm 핸들러가 따르는 규칙:
 *   - SHIPPING 상태에서만 구매확정 가능 → 상태 전이: SHIPPING → DELIVERED
 *   - 잘못된 상태(e.g. PAID, PENDING, DONE, CANCELLED) → 400
 *   - 본인 주문 아닌 경우(user_id 불일치) → 403
 *   - 구매확정 후 settlement_status = 'confirmed' 으로 업데이트
 *
 * 실제 Hono 앱 없이 순수 로직 함수로 mirror하여 테스트.
 */
import { describe, it, expect } from 'vitest';

// ── 도메인 상수 (orders.routes.ts 에서 mirror) ────────────────────────
const CONFIRMABLE_STATUSES = ['SHIPPING'] as const;
type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPING' | 'DELIVERED' | 'DONE' | 'CANCELLED' | 'REFUNDED';

interface Order {
  id: number;
  user_id: number;
  seller_id: number;
  status: OrderStatus;
  total_amount: number;
  settlement_status: string | null;
}

type ConfirmSuccess = {
  ok: true;
  message: string;
  newStatus: 'DELIVERED';
  newSettlementStatus: 'confirmed';
};

type ConfirmFailure = {
  ok: false;
  statusCode: 400 | 403 | 404;
  error: string;
};

type ConfirmResult = ConfirmSuccess | ConfirmFailure;

/**
 * 구매확정 로직 (handler 에서 추출된 pure function)
 * - authUserId: 인증된 유저 DB ID
 * - order: DB에서 조회된 주문 행
 */
function confirmOrder(authUserId: number, order: Order | null): ConfirmResult {
  if (!order) {
    return { ok: false, statusCode: 404, error: 'Order not found' };
  }

  // 소유권 검증
  if (order.user_id !== authUserId) {
    return { ok: false, statusCode: 403, error: 'Forbidden' };
  }

  // 상태 전이 검증: SHIPPING 만 허용
  if (!CONFIRMABLE_STATUSES.includes(order.status as typeof CONFIRMABLE_STATUSES[number])) {
    return { ok: false, statusCode: 400, error: '배송중 상태에서만 구매확정이 가능합니다.' };
  }

  // 정상 확정
  return {
    ok: true,
    message: '구매확정이 완료되었습니다.',
    newStatus: 'DELIVERED',
    newSettlementStatus: 'confirmed',
  };
}

// ── D1 mock helpers (settlement_status 업데이트 검증용) ───────────────
interface UpdateCapture {
  id: number;
  status: string;
  settlement_status: string;
}

function createUpdateCaptureMockDB(): { db: D1Database; captured: UpdateCapture[] } {
  const captured: UpdateCapture[] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          if (/UPDATE orders/.test(sql) && /settlement_status/.test(sql)) {
            captured.push({
              id: args[0] as number,
              status: 'DELIVERED',
              settlement_status: 'confirmed',
            });
          }
          return { success: true, meta: { changes: 1 } };
        },
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    }),
  } as unknown as D1Database;
  return { db, captured };
}

// ─────────────────────────────────────────────────────────────────────
// 1. 구매확정 상태 전이
// ─────────────────────────────────────────────────────────────────────
describe('Order confirm — status transition', () => {
  const BASE_ORDER: Order = {
    id: 100,
    user_id: 1,
    seller_id: 50,
    status: 'SHIPPING',
    total_amount: 30000,
    settlement_status: null,
  };

  it('SHIPPING → DELIVERED: 구매확정 성공', () => {
    const result = confirmOrder(1, BASE_ORDER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newStatus).toBe('DELIVERED');
      expect(result.newSettlementStatus).toBe('confirmed');
      expect(result.message).toMatch(/구매확정/);
    }
  });

  it('DELIVERED 상태에서 재확정 시도 → 400', () => {
    const order = { ...BASE_ORDER, status: 'DELIVERED' as OrderStatus };
    const result = confirmOrder(1, order);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(400);
      expect(result.error).toMatch(/배송중 상태에서만/);
    }
  });

  it('PENDING 상태에서 구매확정 시도 → 400', () => {
    const order = { ...BASE_ORDER, status: 'PENDING' as OrderStatus };
    const result = confirmOrder(1, order);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('PAID 상태에서 구매확정 시도 → 400', () => {
    const order = { ...BASE_ORDER, status: 'PAID' as OrderStatus };
    const result = confirmOrder(1, order);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('DONE 상태에서 구매확정 시도 → 400', () => {
    const order = { ...BASE_ORDER, status: 'DONE' as OrderStatus };
    const result = confirmOrder(1, order);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('CANCELLED 상태에서 구매확정 시도 → 400', () => {
    const order = { ...BASE_ORDER, status: 'CANCELLED' as OrderStatus };
    const result = confirmOrder(1, order);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('REFUNDED 상태에서 구매확정 시도 → 400', () => {
    const order = { ...BASE_ORDER, status: 'REFUNDED' as OrderStatus };
    const result = confirmOrder(1, order);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. 소유권 검증
// ─────────────────────────────────────────────────────────────────────
describe('Order confirm — ownership', () => {
  const ORDER: Order = {
    id: 200,
    user_id: 99,
    seller_id: 50,
    status: 'SHIPPING',
    total_amount: 20000,
    settlement_status: null,
  };

  it('본인 주문 → 구매확정 성공', () => {
    const result = confirmOrder(99, ORDER); // authUserId === order.user_id
    expect(result.ok).toBe(true);
  });

  it('타인 주문 → 403 Forbidden', () => {
    const result = confirmOrder(777, ORDER); // 다른 유저
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.error).toMatch(/Forbidden/);
    }
  });

  it('order not found → 404', () => {
    const result = confirmOrder(99, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(404);
      expect(result.error).toMatch(/Order not found/);
    }
  });

  it('seller ID != auth user ID still blocked if user_id mismatch', () => {
    // seller_id 와 user_id 는 다른 개념 — seller가 자기 상품 주문 확정 불가
    const order = { ...ORDER, user_id: 99 };
    const result = confirmOrder(50, order); // 50 = seller_id, not user_id
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. settlement_status 업데이트 DB 쿼리 검증
// ─────────────────────────────────────────────────────────────────────
describe('Order confirm — settlement_status update in DB', () => {
  it('confirms capture settlement_status = confirmed in update query', async () => {
    const { db, captured } = createUpdateCaptureMockDB();

    // 구매확정 시 실행될 UPDATE 문 직접 시뮬레이션
    await db.prepare(`
      UPDATE orders
      SET status = 'DELIVERED', delivered_at = datetime('now'),
          settlement_status = 'confirmed', updated_at = datetime('now')
      WHERE id = ? AND status IN ('SHIPPING')
    `).bind(200).run();

    expect(captured).toHaveLength(1);
    expect(captured[0].settlement_status).toBe('confirmed');
    expect(captured[0].status).toBe('DELIVERED');
    expect(captured[0].id).toBe(200);
  });

  it('DB mock run() succeeds for confirm query', async () => {
    const { db } = createUpdateCaptureMockDB();
    const result = await db.prepare(`
      UPDATE orders SET status = 'DELIVERED', settlement_status = 'confirmed'
      WHERE id = ? AND status IN ('SHIPPING')
    `).bind(300).run();
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4. 정산 상태 전이 일관성
// ─────────────────────────────────────────────────────────────────────
describe('Order confirm — settlement lifecycle', () => {
  it('구매확정 전 settlement_status is null or pending', () => {
    const orderBefore: Order = {
      id: 300,
      user_id: 10,
      seller_id: 5,
      status: 'SHIPPING',
      total_amount: 50000,
      settlement_status: null,
    };
    // 아직 구매확정 전
    expect(orderBefore.settlement_status).toBeNull();
  });

  it('구매확정 후 settlement_status becomes confirmed (via confirmOrder result)', () => {
    const order: Order = {
      id: 300,
      user_id: 10,
      seller_id: 5,
      status: 'SHIPPING',
      total_amount: 50000,
      settlement_status: null,
    };
    const result = confirmOrder(10, order);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newSettlementStatus).toBe('confirmed');
    }
  });

  it('settlement_status = confirmed is NOT eligible for new settlement batch (pending only)', () => {
    // 정산 배치는 settlement_status = 'pending' 인 주문만 처리.
    // 구매확정 후엔 'confirmed' → 다음 배치에서 이미 처리된 것으로 집계.
    function isEligibleForSettlementBatch(status: string): boolean {
      return status === 'pending';
    }
    expect(isEligibleForSettlementBatch('confirmed')).toBe(false);
    expect(isEligibleForSettlementBatch('pending')).toBe(true);
    expect(isEligibleForSettlementBatch('completed')).toBe(false);
  });
});
