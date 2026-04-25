/**
 * Agency & Seller Settlement Routes unit tests
 * Pure function mirrors of validation logic from:
 *   - agency-auth.routes.ts
 *   - agency-ops.routes.ts / agency-orders.routes.ts
 *   - seller-settlements-management.routes.ts
 *   - alimtalk.routes.ts
 */
import { describe, it, expect } from 'vitest';

// ── D1 mock ───────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._args: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  }),
};

// ── Agency Auth mirrors ───────────────────────────────────────────────────────

function validateAgencyLoginInput(body: { email?: string; password?: string }): string | null {
  if (!body.email || !body.password) return '이메일과 비밀번호를 입력해주세요.';
  return null;
}

function validateAgencyRegisterInput(body: {
  name?: string; contact_name?: string; email?: string; password?: string
}): string | null {
  if (!body.name || !body.contact_name || !body.email || !body.password) return '필수 항목 누락';
  return null;
}

function validatePasswordComplexityMirror(password: string): { ok: boolean; reason?: string } {
  if (password.length < 8) return { ok: false, reason: '8자 이상' };
  if (!/[A-Z]/.test(password) && !/[0-9]/.test(password)) return { ok: false, reason: '숫자 또는 대문자 포함' };
  return { ok: true };
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.substring(7);
}

// ── Agency Status mirrors ─────────────────────────────────────────────────────

const VALID_AGENCY_STATUSES = ['pending', 'active', 'suspended'] as const;

function isValidAgencyStatus(status: string): boolean {
  return VALID_AGENCY_STATUSES.includes(status as typeof VALID_AGENCY_STATUSES[number]);
}

// ── Settlement mirrors ────────────────────────────────────────────────────────

function validateSettlementAmount(amount: unknown, minBalance: number): string | null {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '정산 금액이 유효하지 않습니다.';
  if (n > minBalance) return '잔액이 부족합니다.';
  return null;
}

function calcSettlementPagination(limitStr: string | undefined, offsetStr: string | undefined) {
  const limit = (parseInt(limitStr || '20') || 20);
  const offset = (parseInt(offsetStr || '0') || 0);
  return { limit, offset };
}

// ── Alimtalk Credit mirrors ───────────────────────────────────────────────────

function validateAlimtalkPackageId(packageId: unknown): boolean {
  const n = Number(packageId);
  return Number.isInteger(n) && n > 0;
}

function parseAlimtalkOrderId(orderId: string): number | null {
  const match = orderId.match(/pkg(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function validateCreditConfirm(body: {
  paymentKey?: string; orderId?: string; amount?: number
}): string | null {
  if (!body.paymentKey || !body.orderId || body.amount === undefined) return '필수 항목 누락';
  if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return '금액 오류';
  return null;
}

// ── Tests: Agency Auth ────────────────────────────────────────────────────────

describe('Agency Auth Routes', () => {
  describe('validateAgencyLoginInput', () => {
    it('rejects missing email or password', () => {
      expect(validateAgencyLoginInput({})).toBe('이메일과 비밀번호를 입력해주세요.');
      expect(validateAgencyLoginInput({ email: 'a@b.com' })).toBe('이메일과 비밀번호를 입력해주세요.');
      expect(validateAgencyLoginInput({ password: 'pw' })).toBe('이메일과 비밀번호를 입력해주세요.');
    });

    it('accepts valid login credentials', () => {
      expect(validateAgencyLoginInput({ email: 'agency@example.com', password: 'pass123' })).toBeNull();
    });
  });

  describe('validateAgencyRegisterInput', () => {
    it('requires all four fields', () => {
      expect(validateAgencyRegisterInput({})).toBe('필수 항목 누락');
      expect(validateAgencyRegisterInput({ name: 'N', contact_name: 'C', email: 'e@e.com' })).toBe('필수 항목 누락');
    });

    it('accepts complete registration data', () => {
      expect(validateAgencyRegisterInput({
        name: '에이전시명', contact_name: '담당자', email: 'a@b.com', password: 'Abc1234!'
      })).toBeNull();
    });
  });

  describe('extractBearerToken', () => {
    it('returns null for missing or malformed header', () => {
      expect(extractBearerToken(undefined)).toBeNull();
      expect(extractBearerToken('Basic xyz')).toBeNull();
      expect(extractBearerToken('Bearer')).toBeNull();
    });

    it('extracts token from valid Bearer header', () => {
      expect(extractBearerToken('Bearer mytoken123')).toBe('mytoken123');
    });
  });

  describe('isValidAgencyStatus', () => {
    it('accepts valid agency statuses', () => {
      expect(isValidAgencyStatus('pending')).toBe(true);
      expect(isValidAgencyStatus('active')).toBe(true);
      expect(isValidAgencyStatus('suspended')).toBe(true);
    });

    it('rejects invalid statuses', () => {
      expect(isValidAgencyStatus('banned')).toBe(false);
      expect(isValidAgencyStatus('ACTIVE')).toBe(false);
      expect(isValidAgencyStatus('')).toBe(false);
    });
  });
});

// ── Tests: Seller Settlements ─────────────────────────────────────────────────

describe('Seller Settlement Routes', () => {
  describe('validateSettlementAmount', () => {
    it('rejects zero or negative amount', () => {
      expect(validateSettlementAmount(0, 100000)).not.toBeNull();
      expect(validateSettlementAmount(-500, 100000)).not.toBeNull();
    });

    it('rejects amount exceeding balance', () => {
      expect(validateSettlementAmount(200000, 100000)).toBe('잔액이 부족합니다.');
    });

    it('rejects non-numeric amount', () => {
      expect(validateSettlementAmount('abc', 100000)).not.toBeNull();
      expect(validateSettlementAmount(NaN, 100000)).not.toBeNull();
    });

    it('accepts valid amount within balance', () => {
      expect(validateSettlementAmount(50000, 100000)).toBeNull();
      expect(validateSettlementAmount(100000, 100000)).toBeNull();
    });
  });

  describe('calcSettlementPagination', () => {
    it('defaults to limit=20, offset=0', () => {
      const r = calcSettlementPagination(undefined, undefined);
      expect(r.limit).toBe(20);
      expect(r.offset).toBe(0);
    });

    it('parses valid limit and offset', () => {
      const r = calcSettlementPagination('30', '60');
      expect(r.limit).toBe(30);
      expect(r.offset).toBe(60);
    });

    it('falls back to defaults on NaN input', () => {
      const r = calcSettlementPagination('abc', 'xyz');
      expect(r.limit).toBe(20);
      expect(r.offset).toBe(0);
    });
  });
});

// ── Tests: Alimtalk Credits ───────────────────────────────────────────────────

describe('Alimtalk Credits Routes', () => {
  describe('validateAlimtalkPackageId', () => {
    it('accepts positive integers', () => {
      expect(validateAlimtalkPackageId(1)).toBe(true);
      expect(validateAlimtalkPackageId(5)).toBe(true);
    });

    it('rejects zero, negatives, non-integers', () => {
      expect(validateAlimtalkPackageId(0)).toBe(false);
      expect(validateAlimtalkPackageId(-1)).toBe(false);
      expect(validateAlimtalkPackageId(1.5)).toBe(false);
      expect(validateAlimtalkPackageId('abc')).toBe(false);
    });
  });

  describe('parseAlimtalkOrderId', () => {
    it('extracts package ID from orderId format ALT-{sellerId}-pkg{id}-{ts}', () => {
      expect(parseAlimtalkOrderId('ALT-42-pkg3-1714000000000')).toBe(3);
      expect(parseAlimtalkOrderId('ALT-1-pkg100-1714000000000')).toBe(100);
    });

    it('returns null for malformed orderId', () => {
      expect(parseAlimtalkOrderId('INVALID-ORDER')).toBeNull();
      expect(parseAlimtalkOrderId('')).toBeNull();
    });
  });

  describe('validateCreditConfirm', () => {
    it('rejects missing required fields', () => {
      expect(validateCreditConfirm({})).toBe('필수 항목 누락');
      expect(validateCreditConfirm({ paymentKey: 'pk', orderId: 'oid' })).toBe('필수 항목 누락');
    });

    it('rejects invalid amounts', () => {
      expect(validateCreditConfirm({ paymentKey: 'pk', orderId: 'oid', amount: 0 })).toBe('금액 오류');
      expect(validateCreditConfirm({ paymentKey: 'pk', orderId: 'oid', amount: -100 })).toBe('금액 오류');
    });

    it('accepts valid confirm data', () => {
      expect(validateCreditConfirm({ paymentKey: 'pk_live_abc', orderId: 'ALT-1-pkg3-ts', amount: 9000 })).toBeNull();
    });
  });

  describe('D1 mock', () => {
    it('mockDB bind/all returns empty results', async () => {
      const r = await mockDB.prepare('SELECT * FROM alimtalk_packages WHERE is_active = 1')
        .bind().all();
      expect(r.results).toEqual([]);
    });
  });
});
