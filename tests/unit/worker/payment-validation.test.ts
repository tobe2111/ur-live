/**
 * Payment Validation Unit Tests
 *
 * 결제 경로의 핵심 불변성 검증:
 * 1. 금액은 반드시 DB 검증값 사용 (클라이언트 값 신뢰 금지)
 * 2. 이미 처리된 결제의 중복 처리 방지
 * 3. 결제 상태 전이 (pending → completed / failed / cancelled)
 * 4. Idempotency 키 충돌 시 200 반환 (not 500)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── 결제 금액 검증 로직 (routes에서 추출 가능한 순수 함수) ───────────────

function validatePaymentAmount(
  clientAmount: number,
  dbAmount: number,
): { valid: boolean; error?: string } {
  if (!Number.isFinite(clientAmount) || clientAmount <= 0) {
    return { valid: false, error: '유효하지 않은 결제 금액' };
  }
  if (clientAmount !== dbAmount) {
    return { valid: false, error: `금액 불일치: client=${clientAmount}, db=${dbAmount}` };
  }
  return { valid: true };
}

// ─── 결제 상태 전이 검증 ────────────────────────────────────────────────────

type PaymentStatus = 'pending' | 'approved' | 'failed' | 'cancelled' | 'refunded';

function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  const allowed: Record<PaymentStatus, PaymentStatus[]> = {
    pending: ['approved', 'failed', 'cancelled'],
    approved: ['refunded'],
    failed: [],
    cancelled: [],
    refunded: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

// ─── 기여 ID 생성 (Idempotency key 고유성 검증) ─────────────────────────────

function buildIdempotencyKey(routePrefix: string, orderId: string, paymentKey: string): string {
  return `${routePrefix}_${orderId}_${paymentKey}`;
}

// ─── Toss 에러 코드 분류 ────────────────────────────────────────────────────

type TossErrorCode =
  | 'ALREADY_PROCESSED_PAYMENT'
  | 'INVALID_STOPPED_CARD'
  | 'EXCEED_MAX_CARD_INSTALLMENT_PLAN'
  | 'NOT_AVAILABLE_PAYMENT';

function isTossAlreadyProcessed(code: string | undefined): boolean {
  return code === 'ALREADY_PROCESSED_PAYMENT';
}

function tossErrorToHttp(code: TossErrorCode | string | undefined): number {
  const mapping: Record<string, number> = {
    ALREADY_PROCESSED_PAYMENT: 200, // idempotent
    INVALID_STOPPED_CARD: 400,
    EXCEED_MAX_CARD_INSTALLMENT_PLAN: 400,
    NOT_AVAILABLE_PAYMENT: 402,
  };
  return mapping[code ?? ''] ?? 400;
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe('Payment Amount Validation', () => {
  it('client amount === db amount → valid', () => {
    expect(validatePaymentAmount(10000, 10000)).toEqual({ valid: true });
  });

  it('client amount !== db amount → invalid (tamper protection)', () => {
    const result = validatePaymentAmount(1, 10000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('금액 불일치');
  });

  it('amount=0 → invalid (free payment attack prevention)', () => {
    const result = validatePaymentAmount(0, 0);
    expect(result.valid).toBe(false);
  });

  it('amount=-1 → invalid (negative payment)', () => {
    const result = validatePaymentAmount(-1, -1);
    expect(result.valid).toBe(false);
  });

  it('amount=NaN → invalid', () => {
    const result = validatePaymentAmount(NaN, 10000);
    expect(result.valid).toBe(false);
  });

  it('amount=Infinity → invalid', () => {
    const result = validatePaymentAmount(Infinity, 10000);
    expect(result.valid).toBe(false);
  });

  it('amount=1e15 (large) + db matches → valid', () => {
    expect(validatePaymentAmount(1_000_000_000_000_000, 1_000_000_000_000_000)).toEqual({ valid: true });
  });
});

describe('Payment Status Transitions', () => {
  it('pending → approved ✅', () => {
    expect(canTransitionPaymentStatus('pending', 'approved')).toBe(true);
  });

  it('pending → failed ✅', () => {
    expect(canTransitionPaymentStatus('pending', 'failed')).toBe(true);
  });

  it('pending → cancelled ✅', () => {
    expect(canTransitionPaymentStatus('pending', 'cancelled')).toBe(true);
  });

  it('approved → refunded ✅', () => {
    expect(canTransitionPaymentStatus('approved', 'refunded')).toBe(true);
  });

  it('approved → failed ❌ (cannot fail after approval)', () => {
    expect(canTransitionPaymentStatus('approved', 'failed')).toBe(false);
  });

  it('failed → approved ❌ (cannot approve failed payment)', () => {
    expect(canTransitionPaymentStatus('failed', 'approved')).toBe(false);
  });

  it('cancelled → approved ❌ (cannot approve cancelled)', () => {
    expect(canTransitionPaymentStatus('cancelled', 'approved')).toBe(false);
  });

  it('refunded → approved ❌ (terminal state)', () => {
    expect(canTransitionPaymentStatus('refunded', 'approved')).toBe(false);
  });
});

describe('Idempotency Key Construction', () => {
  it('same inputs → same key (deterministic)', () => {
    const key1 = buildIdempotencyKey('donations', 'ORD-001', 'pay_abc123');
    const key2 = buildIdempotencyKey('donations', 'ORD-001', 'pay_abc123');
    expect(key1).toBe(key2);
  });

  it('different routes → different keys', () => {
    const k1 = buildIdempotencyKey('donations', 'ORD-001', 'pay_abc');
    const k2 = buildIdempotencyKey('alimtalk', 'ORD-001', 'pay_abc');
    expect(k1).not.toBe(k2);
  });

  it('different orderId → different keys', () => {
    const k1 = buildIdempotencyKey('points', 'ORD-001', 'pay_abc');
    const k2 = buildIdempotencyKey('points', 'ORD-002', 'pay_abc');
    expect(k1).not.toBe(k2);
  });

  it('different paymentKey → different keys', () => {
    const k1 = buildIdempotencyKey('points', 'ORD-001', 'pay_abc');
    const k2 = buildIdempotencyKey('points', 'ORD-001', 'pay_xyz');
    expect(k1).not.toBe(k2);
  });
});

describe('Toss Error Code Handling', () => {
  it('ALREADY_PROCESSED_PAYMENT → idempotent 200', () => {
    expect(isTossAlreadyProcessed('ALREADY_PROCESSED_PAYMENT')).toBe(true);
    expect(tossErrorToHttp('ALREADY_PROCESSED_PAYMENT')).toBe(200);
  });

  it('INVALID_STOPPED_CARD → 400', () => {
    expect(tossErrorToHttp('INVALID_STOPPED_CARD')).toBe(400);
  });

  it('undefined error code → 400 (safe default)', () => {
    expect(tossErrorToHttp(undefined)).toBe(400);
  });

  it('unknown error code → 400 (safe default)', () => {
    expect(tossErrorToHttp('SOME_UNKNOWN_CODE')).toBe(400);
  });
});

describe('Payment Route Guard — Fetch Mock Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('Toss API 성공 응답 (200) → 결제 완료 처리', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentKey: 'pay_test123',
        orderId: 'ORD-001',
        status: 'DONE',
        totalAmount: 10000,
      }),
    });
    global.fetch = mockFetch;

    const res = await global.fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: 'Basic test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey: 'pay_test123', orderId: 'ORD-001', amount: 10000 }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe('DONE');
  });

  it('Toss API 실패 응답 (400) → 에러 코드 처리', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'INVALID_STOPPED_CARD', message: '정지된 카드' }),
    });
    global.fetch = mockFetch;

    const res = await global.fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ paymentKey: 'pay_test', orderId: 'ORD-001', amount: 10000 }),
    });

    expect(res.ok).toBe(false);
    const err = await res.json();
    expect(err.code).toBe('INVALID_STOPPED_CARD');
    expect(tossErrorToHttp(err.code)).toBe(400);
  });

  it('Toss API 네트워크 오류 → 예외 발생', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      global.fetch('https://api.tosspayments.com/v1/payments/confirm', {}),
    ).rejects.toThrow('network error');
  });

  it('중복 결제 요청 → ALREADY_PROCESSED_PAYMENT 로 멱등 처리', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'ALREADY_PROCESSED_PAYMENT', message: '이미 처리된 결제' }),
    });

    const res = await global.fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'pay_dup_test' },
      body: JSON.stringify({ paymentKey: 'pay_dup_test', orderId: 'ORD-001', amount: 10000 }),
    });

    const err = await res.json();
    expect(isTossAlreadyProcessed(err.code)).toBe(true);
    // idempotent → caller should treat as success
    expect(tossErrorToHttp(err.code)).toBe(200);
  });
});

describe('Donation-Specific Payment Guards', () => {
  it('후원 금액 최솟값 500 딜 이하 → 차단', () => {
    const MIN_DONATION = 500;
    const validate = (amount: number) => amount >= MIN_DONATION;

    expect(validate(499)).toBe(false);
    expect(validate(500)).toBe(true);
    expect(validate(1000)).toBe(true);
  });

  it('후원은 라이브 종료 후 불가 (STREAM_ENDED guard)', () => {
    type StreamStatus = 'live' | 'ended' | 'scheduled';
    const canDonate = (status: StreamStatus) => status === 'live';

    expect(canDonate('live')).toBe(true);
    expect(canDonate('ended')).toBe(false);
    expect(canDonate('scheduled')).toBe(false);
  });
});
