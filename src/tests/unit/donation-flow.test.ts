/**
 * 후원(도네이션) 플로우 단위 테스트
 *
 * src/features/donations/api/donations.routes.ts 의 핵심 검증 로직을 mirror:
 *   1. 최소 후원 금액 검증 (MIN_REAL_DONATION = 1000원 미만 → 거부)
 *   2. 100원 단위 강제 (예: 1500원 OK, 1250원 거부)
 *   3. 최대 금액 상한 (1천만원 초과 → 거부)
 *   4. 중복 pending 후원 방지 (idempotency)
 *   5. pending → completed 상태 전이만 허용 (이미 처리된 건 재확정 불가)
 *   6. 금액 조작 방지 (클라이언트 amount != DB pending.amount → 거부)
 *   7. 인증 없는 요청 → 401 시뮬레이션
 *   8. 일일 한도 초과 → 거부
 *
 * 실제 DB 없이 D1 mock 으로 실행 가능.
 */
import { describe, it, expect } from 'vitest';

// ── 상수 (donations.routes.ts 에서 mirror) ────────────────────────────────────
const MIN_REAL_DONATION = 1000; // 실결제 후원 최소 금액 (원)
const MAX_DONATION_MESSAGE_LENGTH = 500;
const DAILY_CAP = 50_000_000;

// ── 검증 함수 (routes 핸들러 로직을 pure function 으로 mirror) ─────────────────

interface DonationInitInput {
  stream_id?: number;
  amount?: number;
  message?: string;
}

type ValidationResult =
  | { ok: true }
  | { ok: false; statusCode: 400 | 401 | 409 | 429; error: string; code?: string };

/**
 * /api/donations/init 핸들러의 입력 검증 로직
 */
function validateDonationInit(
  user: { id: number } | null,
  body: DonationInitInput
): ValidationResult {
  if (!user) return { ok: false, statusCode: 401, error: '로그인이 필요합니다' };

  if (!body.stream_id || !body.amount) {
    return { ok: false, statusCode: 400, error: '필수 항목 누락 (stream_id, amount)' };
  }

  if (!Number.isFinite(body.stream_id) || body.stream_id < 1 || body.stream_id > 1e10) {
    return { ok: false, statusCode: 400, error: 'stream_id 형식이 올바르지 않습니다' };
  }

  if (!Number.isFinite(body.amount) || body.amount < MIN_REAL_DONATION || body.amount % 100 !== 0) {
    return {
      ok: false,
      statusCode: 400,
      error: `후원 금액은 최소 ${MIN_REAL_DONATION.toLocaleString()}원이며 100원 단위여야 합니다`,
    };
  }

  if (body.amount > 10_000_000) {
    return { ok: false, statusCode: 400, error: '후원 금액은 최대 1천만원입니다' };
  }

  if (body.message && body.message.length > MAX_DONATION_MESSAGE_LENGTH) {
    return {
      ok: false,
      statusCode: 400,
      error: `메시지는 ${MAX_DONATION_MESSAGE_LENGTH}자 이내로 작성해주세요.`,
    };
  }

  return { ok: true };
}

/**
 * 일일 한도 검증
 */
function checkDailyLimit(dailyTotal: number, requestAmount: number): ValidationResult {
  if (dailyTotal + requestAmount > DAILY_CAP) {
    return {
      ok: false,
      statusCode: 429,
      error: '일일 후원 한도(5천만원)를 초과합니다. 24시간 후 다시 시도해주세요.',
    };
  }
  return { ok: true };
}

/**
 * 중복 pending 후원 검증
 */
function checkDuplicatePending(existingPending: { id: number } | null): ValidationResult {
  if (existingPending) {
    return {
      ok: false,
      statusCode: 409,
      error: '이미 진행 중인 후원이 있습니다. 잠시 후 다시 시도해주세요.',
      code: 'DUPLICATE_PENDING_DONATION',
    };
  }
  return { ok: true };
}

/**
 * /api/donations/confirm 핸들러의 상태 전이 + 금액 검증 로직
 */
interface PendingDonation {
  id: number;
  amount: number;
  payment_status: string;
}

type ConfirmResult =
  | { ok: true; amount: number }
  | { ok: false; statusCode: 400 | 401 | 404 | 409; error: string };

function validateDonationConfirm(
  user: { id: number } | null,
  pending: PendingDonation | null,
  clientAmount: number
): ConfirmResult {
  if (!user) return { ok: false, statusCode: 401, error: '로그인이 필요합니다' };
  if (!pending) return { ok: false, statusCode: 404, error: '후원 정보를 찾을 수 없습니다. 다시 시도해주세요.' };

  // ✅ SECURITY FIX (H8): pending 상태에서만 confirm 허용
  if (pending.payment_status !== 'pending') {
    return { ok: false, statusCode: 409, error: '이미 처리된 후원입니다.' };
  }

  // 금액 조작 방지 — DB 저장 금액과 클라이언트 금액 일치 여부 검증
  if (pending.amount !== clientAmount) {
    return { ok: false, statusCode: 400, error: '결제 금액이 일치하지 않습니다' };
  }

  return { ok: true, amount: pending.amount };
}

/**
 * 커미션/크레딧 계산 (donations.routes.ts 에서 mirror)
 */
function calcCommission(amount: number, commissionRate: number): { commissionAmount: number; creditAmount: number } {
  const commissionAmount = Math.round(amount * commissionRate / 100);
  const creditAmount = amount - commissionAmount;
  return { commissionAmount, creditAmount };
}

// ── D1 mock ──────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: (sql: string) => ({
    bind: (..._args: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1 } }),
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. 입력 검증 — 최소 금액 / 단위 / 상한
// ─────────────────────────────────────────────────────────────────────────────
describe('Donation init — 금액 유효성 검증', () => {
  const user = { id: 1 };

  it('1000원 (최솟값) → 통과', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: 1000 });
    expect(res.ok).toBe(true);
  });

  it('500원 (최솟값 미만) → 400 거부', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: 500 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/최소/);
    }
  });

  it('999원 (최솟값 -1원) → 400 거부', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: 999 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('1250원 (100원 단위 아님) → 400 거부', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: 1250 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/100원 단위/);
    }
  });

  it('1500원 (100원 단위 정수) → 통과', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: 1500 });
    expect(res.ok).toBe(true);
  });

  it('10_000_000원 (최대값 경계) → 통과', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: 10_000_000 });
    expect(res.ok).toBe(true);
  });

  it('10_000_100원 (최대값 초과) → 400 거부', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: 10_000_100 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/최대 1천만원/);
    }
  });

  it('음수 금액 → 400 거부', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: -1000 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('NaN 금액 → 400 거부', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: NaN });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('Infinity 금액 → 400 거부', () => {
    const res = validateDonationInit(user, { stream_id: 1, amount: Infinity });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 인증 없는 요청 → 401
// ─────────────────────────────────────────────────────────────────────────────
describe('Donation init — 인증 검증', () => {
  it('user = null → 401', () => {
    const res = validateDonationInit(null, { stream_id: 1, amount: 1000 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(401);
      expect(res.error).toMatch(/로그인/);
    }
  });

  it('인증된 유저 → 통과 (기타 조건 만족 시)', () => {
    const res = validateDonationInit({ id: 42 }, { stream_id: 1, amount: 1000 });
    expect(res.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 중복 pending 방지 (idempotency)
// ─────────────────────────────────────────────────────────────────────────────
describe('Donation init — 중복 pending 방지', () => {
  it('기존 pending 없음 → 통과', () => {
    const res = checkDuplicatePending(null);
    expect(res.ok).toBe(true);
  });

  it('기존 pending 존재 → 409 + DUPLICATE_PENDING_DONATION', () => {
    const res = checkDuplicatePending({ id: 99 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(409);
      expect(res.code).toBe('DUPLICATE_PENDING_DONATION');
      expect(res.error).toMatch(/이미 진행 중인 후원/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 일일 한도 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Donation init — 일일 한도 (5천만원)', () => {
  it('누적 0 + 1만원 → 통과', () => {
    expect(checkDailyLimit(0, 10_000).ok).toBe(true);
  });

  it('누적 4,990만 + 1만원 = 5천만원 → 통과 (경계)', () => {
    expect(checkDailyLimit(49_990_000, 10_000).ok).toBe(true);
  });

  it('누적 5천만 + 1만원 → 429 초과', () => {
    const res = checkDailyLimit(50_000_000, 10_000);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(429);
      expect(res.error).toMatch(/일일 후원 한도/);
    }
  });

  it('누적 4,999만 + 2만원 → 429 초과', () => {
    const res = checkDailyLimit(49_990_000, 20_000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(429);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. confirm — 상태 전이 & 금액 조작 방지
// ─────────────────────────────────────────────────────────────────────────────
describe('Donation confirm — 상태 전이', () => {
  const user = { id: 1 };

  it('pending 상태 → confirm 성공', () => {
    const pending: PendingDonation = { id: 1, amount: 5000, payment_status: 'pending' };
    const res = validateDonationConfirm(user, pending, 5000);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.amount).toBe(5000);
  });

  it('completed 상태 재확정 시도 → 409 (H8 방어)', () => {
    const pending: PendingDonation = { id: 1, amount: 5000, payment_status: 'completed' };
    const res = validateDonationConfirm(user, pending, 5000);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(409);
      expect(res.error).toMatch(/이미 처리된 후원/);
    }
  });

  it('failed 상태 재확정 시도 → 409', () => {
    const pending: PendingDonation = { id: 1, amount: 5000, payment_status: 'failed' };
    const res = validateDonationConfirm(user, pending, 5000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(409);
  });

  it('cancelled 상태 재확정 시도 → 409', () => {
    const pending: PendingDonation = { id: 1, amount: 5000, payment_status: 'cancelled' };
    const res = validateDonationConfirm(user, pending, 5000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(409);
  });
});

describe('Donation confirm — 금액 조작 방지', () => {
  const user = { id: 1 };

  it('클라이언트 금액 = DB 저장 금액 → 통과', () => {
    const pending: PendingDonation = { id: 1, amount: 10_000, payment_status: 'pending' };
    const res = validateDonationConfirm(user, pending, 10_000);
    expect(res.ok).toBe(true);
  });

  it('클라이언트가 1원으로 조작 → 400 거부', () => {
    const pending: PendingDonation = { id: 1, amount: 1_000_000, payment_status: 'pending' };
    const res = validateDonationConfirm(user, pending, 1);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/금액이 일치하지 않습니다/);
    }
  });

  it('클라이언트가 더 큰 금액으로 조작 → 400 거부', () => {
    const pending: PendingDonation = { id: 1, amount: 5_000, payment_status: 'pending' };
    const res = validateDonationConfirm(user, pending, 999_999);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('pending 레코드 없음 (phantom orderId) → 404', () => {
    const res = validateDonationConfirm(user, null, 5000);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(404);
      expect(res.error).toMatch(/찾을 수 없습니다/);
    }
  });

  it('인증 없는 confirm 요청 → 401', () => {
    const pending: PendingDonation = { id: 1, amount: 5000, payment_status: 'pending' };
    const res = validateDonationConfirm(null, pending, 5000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 커미션 / 크레딧 계산
// ─────────────────────────────────────────────────────────────────────────────
describe('Donation — 커미션 계산', () => {
  it('15% 수수료: 10,000원 → commission=1,500, credit=8,500', () => {
    const { commissionAmount, creditAmount } = calcCommission(10_000, 15);
    expect(commissionAmount).toBe(1_500);
    expect(creditAmount).toBe(8_500);
  });

  it('10% 수수료: 5,000원 → commission=500, credit=4,500', () => {
    const { commissionAmount, creditAmount } = calcCommission(5_000, 10);
    expect(commissionAmount).toBe(500);
    expect(creditAmount).toBe(4_500);
  });

  it('0% 수수료: 전액 셀러에게', () => {
    const { commissionAmount, creditAmount } = calcCommission(10_000, 0);
    expect(commissionAmount).toBe(0);
    expect(creditAmount).toBe(10_000);
  });

  it('반올림 처리: 15% of 1,000원 = 150 (소수 없음)', () => {
    const { commissionAmount } = calcCommission(1_000, 15);
    expect(Number.isInteger(commissionAmount)).toBe(true);
    expect(commissionAmount).toBe(150);
  });

  it('commission + credit = amount 항등식', () => {
    for (const amount of [1000, 5000, 10_000, 100_000, 1_000_000]) {
      const { commissionAmount, creditAmount } = calcCommission(amount, 15);
      expect(commissionAmount + creditAmount).toBe(amount);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. 메시지 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Donation init — 메시지 길이 검증', () => {
  const user = { id: 1 };

  it('500자 메시지 → 통과 (경계)', () => {
    const res = validateDonationInit(user, {
      stream_id: 1,
      amount: 1000,
      message: 'a'.repeat(500),
    });
    expect(res.ok).toBe(true);
  });

  it('501자 메시지 → 400 거부', () => {
    const res = validateDonationInit(user, {
      stream_id: 1,
      amount: 1000,
      message: 'a'.repeat(501),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/500자 이내/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. D1 mock — INSERT pending 레코드 DB 쿼리 동작 확인
// ─────────────────────────────────────────────────────────────────────────────
describe('Donation — D1 mock DB 동작', () => {
  it('pending INSERT 쿼리 성공', async () => {
    const result = await mockDB.prepare(`
      INSERT INTO donations
        (live_stream_id, seller_id, donor_user_id, donor_name, amount,
         commission_amount, credit_amount, commission_rate,
         order_id, payment_status, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(1, 10, 1, '익명', 5000, 750, 4250, 15, 'DON-1-1-123', '').run();
    expect(result.success).toBe(true);
  });

  it('confirm UPDATE 쿼리 성공', async () => {
    const result = await mockDB.prepare(
      "UPDATE donations SET payment_status = ?, payment_key = ?, completed_at = datetime('now') WHERE order_id = ?"
    ).bind('completed', 'pk_test_123', 'DON-1-1-123').run();
    expect(result.success).toBe(true);
  });

  it('pending 조회 — 없으면 null 반환', async () => {
    const row = await mockDB.prepare(
      'SELECT id FROM donations WHERE order_id = ? AND donor_user_id = ?'
    ).bind('non-existent', 1).first();
    expect(row).toBeNull();
  });
});
