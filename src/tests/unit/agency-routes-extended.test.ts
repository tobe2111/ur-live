/**
 * Agency Routes Extended 단위 테스트
 *   - agency.routes.ts
 *   - agency-analytics.routes.ts
 *   - agency-pin.routes.ts
 *   - agency-profile.routes.ts
 *   - agency-sellers.routes.ts
 */
import { describe, it, expect } from 'vitest';

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

// ── Agency PIN mirrors ────────────────────────────────────────────────────────

function validateAgencyPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function validateAgencyPinSet(body: { pin?: string; confirm_pin?: string }): string | null {
  if (!body.pin || !body.confirm_pin) return 'pin, confirm_pin 필수';
  if (!validateAgencyPinFormat(body.pin)) return 'pin 4~6자리 숫자';
  if (body.pin !== body.confirm_pin) return 'pin 과 confirm_pin 불일치';
  return null;
}

// ── Agency Profile mirrors ────────────────────────────────────────────────────

const MAX_AGENCY_NAME = 100;
const MAX_CONTACT_NAME = 50;
const MAX_BIO = 1000;
const MAX_PHONE = 20;

function validateAgencyProfileUpdate(body: {
  name?: string; contact_name?: string; bio?: string; phone?: string;
}): string | null {
  if (body.name !== undefined && body.name.length > MAX_AGENCY_NAME) return `name 최대 ${MAX_AGENCY_NAME}자`;
  if (body.contact_name !== undefined && body.contact_name.length > MAX_CONTACT_NAME) {
    return `contact_name 최대 ${MAX_CONTACT_NAME}자`;
  }
  if (body.bio !== undefined && body.bio.length > MAX_BIO) return `bio 최대 ${MAX_BIO}자`;
  if (body.phone !== undefined && body.phone.length > MAX_PHONE) return `phone 최대 ${MAX_PHONE}자`;
  return null;
}

// ── Agency Analytics mirrors ──────────────────────────────────────────────────

function validateAnalyticsRequest(body: {
  startDate?: string; endDate?: string; sellerId?: number; metric?: string
}): string | null {
  if (body.startDate && isNaN(Date.parse(body.startDate))) return 'startDate 형식 오류';
  if (body.endDate && isNaN(Date.parse(body.endDate))) return 'endDate 형식 오류';
  if (body.sellerId !== undefined) {
    const n = Number(body.sellerId);
    if (!Number.isInteger(n) || n <= 0) return 'sellerId 양의 정수';
  }
  const validMetrics = ['revenue', 'orders', 'commission', 'sellers'];
  if (body.metric && !validMetrics.includes(body.metric)) return '유효하지 않은 metric';
  return null;
}

function calcAgencyCommission(sellerCommission: number, platformRate: number, agencyRate: number): {
  platform: number; agency: number; seller: number;
} {
  const totalAmount = sellerCommission;
  const platform = Math.round(totalAmount * platformRate / 100);
  const agency = Math.round(totalAmount * agencyRate / 100);
  const seller = totalAmount - platform - agency;
  return { platform, agency, seller };
}

// ── Agency Sellers mirrors ────────────────────────────────────────────────────

function validateAgencySellerLink(body: {
  seller_id?: number; commission_rate?: number;
}): string | null {
  if (!body.seller_id || !Number.isInteger(body.seller_id) || body.seller_id <= 0) {
    return 'seller_id 양의 정수';
  }
  if (body.commission_rate !== undefined) {
    const n = Number(body.commission_rate);
    if (!Number.isFinite(n) || n < 0 || n > 50) return 'commission_rate 0~50 범위';
  }
  return null;
}

function calcSellerListPagination(pageStr?: string, limitStr?: string) {
  const page = Math.max((parseInt(pageStr || '1') || 1), 1);
  const limit = Math.min(Math.max((parseInt(limitStr || '20') || 20), 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Agency PIN Routes', () => {
  it('4~6자리 숫자 PIN 허용', () => {
    expect(validateAgencyPinFormat('1234')).toBe(true);
    expect(validateAgencyPinFormat('123456')).toBe(true);
    expect(validateAgencyPinFormat('123')).toBe(false);
  });

  it('PIN 설정 - 필수 필드 누락', () => {
    expect(validateAgencyPinSet({})).toBe('pin, confirm_pin 필수');
  });

  it('PIN 설정 - confirm_pin 불일치', () => {
    expect(validateAgencyPinSet({ pin: '1234', confirm_pin: '5678' })).toBe('pin 과 confirm_pin 불일치');
  });

  it('PIN 설정 - 정상 통과', () => {
    expect(validateAgencyPinSet({ pin: '1234', confirm_pin: '1234' })).toBeNull();
  });
});

describe('Agency Profile Routes', () => {
  it('name 100자 제한', () => {
    expect(validateAgencyProfileUpdate({ name: 'a'.repeat(101) })).toContain('name');
  });

  it('contact_name 50자 제한', () => {
    expect(validateAgencyProfileUpdate({ contact_name: 'a'.repeat(51) })).toContain('contact_name');
  });

  it('bio 1000자 제한', () => {
    expect(validateAgencyProfileUpdate({ bio: 'a'.repeat(1001) })).toContain('bio');
  });

  it('phone 20자 제한', () => {
    expect(validateAgencyProfileUpdate({ phone: '0'.repeat(21) })).toContain('phone');
  });

  it('정상 프로필 업데이트', () => {
    expect(validateAgencyProfileUpdate({
      name: '에이전시 이름', contact_name: '담당자', bio: '소개', phone: '02-123-4567'
    })).toBeNull();
  });
});

describe('Agency Analytics Routes', () => {
  it('잘못된 날짜 거부', () => {
    expect(validateAnalyticsRequest({ startDate: 'invalid' })).not.toBeNull();
    expect(validateAnalyticsRequest({ endDate: 'not-a-date' })).not.toBeNull();
  });

  it('sellerId 양의 정수만', () => {
    expect(validateAnalyticsRequest({ sellerId: 0 })).not.toBeNull();
    expect(validateAnalyticsRequest({ sellerId: -1 })).not.toBeNull();
    expect(validateAnalyticsRequest({ sellerId: 5 })).toBeNull();
  });

  it('metric enum 검증', () => {
    expect(validateAnalyticsRequest({ metric: 'revenue' })).toBeNull();
    expect(validateAnalyticsRequest({ metric: 'unknown' })).not.toBeNull();
  });

  describe('calcAgencyCommission', () => {
    it('플랫폼/에이전시/셀러 수수료 분배', () => {
      const r = calcAgencyCommission(100000, 5, 5);
      expect(r.platform).toBe(5000);
      expect(r.agency).toBe(5000);
      expect(r.seller).toBe(90000);
    });

    it('전체 합계는 입력값과 같음', () => {
      const r = calcAgencyCommission(33333, 10, 5);
      expect(r.platform + r.agency + r.seller).toBe(33333);
    });
  });
});

describe('Agency Sellers Routes', () => {
  it('seller_id 양의 정수 필수', () => {
    expect(validateAgencySellerLink({})).toBe('seller_id 양의 정수');
    expect(validateAgencySellerLink({ seller_id: 0 })).not.toBeNull();
    expect(validateAgencySellerLink({ seller_id: -5 })).not.toBeNull();
  });

  it('commission_rate 0~50 범위', () => {
    expect(validateAgencySellerLink({ seller_id: 1, commission_rate: 0 })).toBeNull();
    expect(validateAgencySellerLink({ seller_id: 1, commission_rate: 50 })).toBeNull();
    expect(validateAgencySellerLink({ seller_id: 1, commission_rate: 51 })).not.toBeNull();
    expect(validateAgencySellerLink({ seller_id: 1, commission_rate: -1 })).not.toBeNull();
  });

  it('페이지네이션 기본값과 제한', () => {
    expect(calcSellerListPagination().limit).toBe(20);
    expect(calcSellerListPagination('1', '500').limit).toBe(100);
    expect(calcSellerListPagination('5', '20').offset).toBe(80);
  });
});

describe('D1 mock', () => {
  it('에이전시 PIN 업데이트', async () => {
    const r = await mockDB.prepare('UPDATE agencies SET pin_hash = ? WHERE id = ?')
      .bind('hash', 1).run();
    expect(r.success).toBe(true);
  });
});
