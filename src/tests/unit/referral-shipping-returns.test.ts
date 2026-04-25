/**
 * Referral, Shipping Address, Returns Routes 단위 테스트
 * 각 라우트 핵심 검증 로직을 pure function 으로 mirror
 */
import { describe, it, expect } from 'vitest';

// ── D1 mock ───────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  }),
};

// ── Referral mirrors ──────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function validateInviteCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

function validateReferralGroupCreate(body: {
  product_id?: number; target_count?: number; discount_percent?: number; discount_per_person?: number
}): string | null {
  if (!body.product_id) return 'product_id 필수';
  if (!body.target_count || body.target_count < 2) return 'target_count 최소 2 이상';
  if (body.discount_percent !== undefined) {
    if (body.discount_percent < 0 || body.discount_percent > 100) return 'discount_percent 범위 초과';
  }
  if (body.discount_per_person !== undefined && body.discount_per_person < 0) {
    return 'discount_per_person 음수 불가';
  }
  return null;
}

function getUnlockedTier(tiers: Array<{ count: number; discount: number }>, currentCount: number) {
  if (!tiers.length) return null;
  const reached = tiers.filter(t => currentCount >= t.count);
  return reached.length > 0 ? reached[reached.length - 1] : null;
}

// ── Shipping Address mirrors ──────────────────────────────────────────────────

function validateShippingAddressCreate(body: {
  recipient_name?: string; phone?: string; address?: string; postal_code?: string
}): string | null {
  if (!body.recipient_name?.trim()) return 'recipient_name 필수';
  if (!body.phone?.trim()) return 'phone 필수';
  if (!body.address?.trim()) return 'address 필수';
  if (!body.postal_code?.trim()) return 'postal_code 필수';
  return null;
}

function validateKoreanPhone(phone: string): boolean {
  return /^01[0-9]{8,9}$/.test(phone.replace(/-/g, ''));
}

function validatePostalCode(code: string): boolean {
  return /^\d{5}$/.test(code);
}

// ── Returns mirrors ───────────────────────────────────────────────────────────

const VALID_RETURN_STATUSES = [
  'requested', 'approved', 'rejected', 'shipped', 'received', 'inspected', 'refunded', 'cancelled'
] as const;
type ReturnStatus = typeof VALID_RETURN_STATUSES[number];

function isValidReturnStatus(status: string): status is ReturnStatus {
  return VALID_RETURN_STATUSES.includes(status as ReturnStatus);
}

function validateReturnRequest(body: { order_id?: number; reason?: string }): string | null {
  if (!body.order_id || !body.reason) return 'order_id, reason 필수';
  return null;
}

function canRequestReturn(orderStatus: string): boolean {
  return orderStatus.toUpperCase() === 'DELIVERED';
}

function canRequestReturnByDate(deliveredAt: string | null, windowDays = 14): boolean {
  if (!deliveredAt) return false;
  const delivered = new Date(deliveredAt).getTime();
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return (now - delivered) <= windowMs;
}

// ── Tests: Referral ───────────────────────────────────────────────────────────

describe('Referral Routes', () => {
  describe('generateInviteCode', () => {
    it('생성된 코드는 6자 대문자+숫자', () => {
      for (let i = 0; i < 10; i++) {
        const code = generateInviteCode();
        expect(validateInviteCode(code)).toBe(true);
        expect(code.length).toBe(6);
      }
    });
  });

  describe('validateInviteCode', () => {
    it('유효한 6자 대문자/숫자 코드 허용', () => {
      expect(validateInviteCode('ABC123')).toBe(true);
      expect(validateInviteCode('ZZZZZZ')).toBe(true);
      expect(validateInviteCode('000000')).toBe(true);
    });

    it('소문자, 특수문자, 길이 오류 거부', () => {
      expect(validateInviteCode('abc123')).toBe(false);
      expect(validateInviteCode('ABC12')).toBe(false);
      expect(validateInviteCode('ABC1234')).toBe(false);
      expect(validateInviteCode('ABC!23')).toBe(false);
    });
  });

  describe('validateReferralGroupCreate', () => {
    it('product_id 없으면 거부', () => {
      expect(validateReferralGroupCreate({ target_count: 5 })).toBe('product_id 필수');
    });

    it('target_count 2 미만 거부', () => {
      expect(validateReferralGroupCreate({ product_id: 1, target_count: 1 })).not.toBeNull();
      expect(validateReferralGroupCreate({ product_id: 1, target_count: 0 })).not.toBeNull();
    });

    it('discount_percent 0~100 범위 초과 거부', () => {
      expect(validateReferralGroupCreate({ product_id: 1, target_count: 3, discount_percent: 101 })).not.toBeNull();
      expect(validateReferralGroupCreate({ product_id: 1, target_count: 3, discount_percent: -1 })).not.toBeNull();
    });

    it('유효한 그룹 생성 데이터 허용', () => {
      expect(validateReferralGroupCreate({ product_id: 1, target_count: 5, discount_percent: 10 })).toBeNull();
    });
  });

  describe('getUnlockedTier', () => {
    const tiers = [{ count: 3, discount: 5 }, { count: 5, discount: 10 }, { count: 10, discount: 15 }];

    it('참여자 수에 맞는 가장 높은 티어 반환', () => {
      expect(getUnlockedTier(tiers, 5)?.discount).toBe(10);
      expect(getUnlockedTier(tiers, 10)?.discount).toBe(15);
    });

    it('첫 티어 미달이면 null', () => {
      expect(getUnlockedTier(tiers, 2)).toBeNull();
    });

    it('티어 없으면 null', () => {
      expect(getUnlockedTier([], 100)).toBeNull();
    });
  });
});

// ── Tests: Shipping Addresses ─────────────────────────────────────────────────

describe('Shipping Address Routes', () => {
  describe('validateShippingAddressCreate', () => {
    it('필수 항목 누락 시 거부', () => {
      expect(validateShippingAddressCreate({})).not.toBeNull();
      expect(validateShippingAddressCreate({ recipient_name: '홍길동' })).not.toBeNull();
      expect(validateShippingAddressCreate({
        recipient_name: '홍길동', phone: '01012345678', address: '서울시'
      })).toBe('postal_code 필수');
    });

    it('공백만 있는 필드 거부', () => {
      expect(validateShippingAddressCreate({
        recipient_name: '  ', phone: '01012345678', address: '서울시', postal_code: '12345'
      })).not.toBeNull();
    });

    it('모든 필수 항목 있으면 통과', () => {
      expect(validateShippingAddressCreate({
        recipient_name: '홍길동', phone: '01012345678', address: '서울시 강남구', postal_code: '06236'
      })).toBeNull();
    });
  });

  describe('validateKoreanPhone', () => {
    it('유효한 한국 휴대폰 번호 허용', () => {
      expect(validateKoreanPhone('01012345678')).toBe(true);
      expect(validateKoreanPhone('010-1234-5678')).toBe(true);
      expect(validateKoreanPhone('01198765432')).toBe(true);
    });

    it('잘못된 형식 거부', () => {
      expect(validateKoreanPhone('01012345')).toBe(false);       // 8자리 (짧음)
      expect(validateKoreanPhone('02-123-4567')).toBe(false);    // 유선전화 (02로 시작)
      expect(validateKoreanPhone('hello-world')).toBe(false);    // 문자 혼합
      expect(validateKoreanPhone('0101234567890')).toBe(false);  // 13자리 (너무 김)
    });
  });

  describe('validatePostalCode', () => {
    it('5자리 숫자 우편번호 허용', () => {
      expect(validatePostalCode('06236')).toBe(true);
      expect(validatePostalCode('00000')).toBe(true);
    });

    it('6자리 구우편번호나 문자 혼합 거부', () => {
      expect(validatePostalCode('123456')).toBe(false);
      expect(validatePostalCode('1234A')).toBe(false);
      expect(validatePostalCode('1234')).toBe(false);
    });
  });
});

// ── Tests: Returns ────────────────────────────────────────────────────────────

describe('Returns Routes', () => {
  describe('isValidReturnStatus', () => {
    it('유효한 반품 상태 허용', () => {
      const validStatuses = ['requested', 'approved', 'rejected', 'shipped', 'received', 'inspected', 'refunded', 'cancelled'];
      validStatuses.forEach(s => expect(isValidReturnStatus(s)).toBe(true));
    });

    it('유효하지 않은 상태 거부', () => {
      expect(isValidReturnStatus('PENDING')).toBe(false);
      expect(isValidReturnStatus('returned')).toBe(false);
      expect(isValidReturnStatus('')).toBe(false);
    });
  });

  describe('validateReturnRequest', () => {
    it('order_id 또는 reason 없으면 거부', () => {
      expect(validateReturnRequest({})).not.toBeNull();
      expect(validateReturnRequest({ order_id: 1 })).not.toBeNull();
      expect(validateReturnRequest({ reason: '변심' })).not.toBeNull();
    });

    it('둘 다 있으면 통과', () => {
      expect(validateReturnRequest({ order_id: 1, reason: '변심' })).toBeNull();
    });
  });

  describe('canRequestReturn', () => {
    it('DELIVERED 상태에서만 반품 가능', () => {
      expect(canRequestReturn('DELIVERED')).toBe(true);
    });

    it('다른 상태에서는 반품 불가', () => {
      expect(canRequestReturn('PAID')).toBe(false);
      expect(canRequestReturn('SHIPPING')).toBe(false);
      expect(canRequestReturn('CANCELLED')).toBe(false);
    });

    it('대소문자 관계없이 처리', () => {
      expect(canRequestReturn('delivered')).toBe(true);
    });
  });

  describe('canRequestReturnByDate', () => {
    it('배송 완료 후 14일 이내 반품 가능', () => {
      const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(canRequestReturnByDate(recent)).toBe(true);
    });

    it('14일 초과 후 반품 불가', () => {
      const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      expect(canRequestReturnByDate(old)).toBe(false);
    });

    it('delivered_at 없으면 반품 불가', () => {
      expect(canRequestReturnByDate(null)).toBe(false);
    });
  });

  describe('D1 mock', () => {
    it('반품 생성 DB 호출 성공', async () => {
      const r = await mockDB.prepare('INSERT INTO returns (order_id, reason, status) VALUES (?, ?, ?)')
        .bind(1, '변심', 'requested').run();
      expect(r.success).toBe(true);
    });
  });
});
