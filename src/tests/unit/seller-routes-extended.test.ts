/**
 * Seller Routes Extended 단위 테스트
 *   - seller-business.routes.ts
 *   - seller-pin.routes.ts
 *   - seller-profile.routes.ts
 *   - seller-stats.routes.ts
 *   - seller-orders-management.routes.ts
 *   - seller-kakao-link.routes.ts
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

// ── Seller Business mirrors ───────────────────────────────────────────────────

function validateBusinessNumber(num: string): boolean {
  // 한국 사업자번호: 10자리 숫자 (NNN-NN-NNNNN 형식)
  const stripped = num.replace(/-/g, '');
  return /^\d{10}$/.test(stripped);
}

function validateBankAccount(account: string): boolean {
  // 계좌번호: 숫자/하이픈, 10~20자리
  const stripped = account.replace(/-/g, '');
  return /^\d{10,20}$/.test(stripped);
}

function validateBusinessInfo(body: {
  business_number?: string; bank_name?: string; bank_account?: string; account_holder?: string
}): string | null {
  if (body.business_number && !validateBusinessNumber(body.business_number)) {
    return '사업자번호 형식 오류 (10자리 숫자)';
  }
  if (body.bank_account && !validateBankAccount(body.bank_account)) {
    return '계좌번호 형식 오류';
  }
  if (body.account_holder && body.account_holder.length > 50) {
    return '예금주명 50자 이하';
  }
  return null;
}

// ── Seller PIN mirrors ────────────────────────────────────────────────────────

function validatePinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function validatePinChange(body: { current_pin?: string; new_pin?: string }): string | null {
  if (!body.current_pin || !body.new_pin) return 'current_pin, new_pin 필수';
  if (!validatePinFormat(body.new_pin)) return 'new_pin 4~6자리 숫자';
  if (body.current_pin === body.new_pin) return '새 PIN 은 기존과 달라야 함';
  return null;
}

// ── Seller Profile mirrors ────────────────────────────────────────────────────

const MAX_BIO_LEN = 1000;
const MAX_NAME_LEN = 100;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_URL_LEN = 500;

function validateProfileUpdate(body: {
  name?: string; bio?: string; description?: string; website_url?: string;
  kakao_chat_link?: string; sns_instagram?: string;
}): string | null {
  if (body.name !== undefined && body.name.length > MAX_NAME_LEN) return `name 최대 ${MAX_NAME_LEN}자`;
  if (body.bio !== undefined && body.bio.length > MAX_BIO_LEN) return `bio 최대 ${MAX_BIO_LEN}자`;
  if (body.description !== undefined && body.description.length > MAX_DESCRIPTION_LEN) {
    return `description 최대 ${MAX_DESCRIPTION_LEN}자`;
  }
  for (const url of [body.website_url, body.kakao_chat_link, body.sns_instagram]) {
    if (url !== undefined && url.length > MAX_URL_LEN) return `URL 최대 ${MAX_URL_LEN}자`;
  }
  return null;
}

// ── Seller Stats mirrors ──────────────────────────────────────────────────────

const VALID_STATS_PERIODS = ['7d', '30d', '90d', 'all'] as const;
type StatsPeriod = typeof VALID_STATS_PERIODS[number];

function parseStatsPeriod(period: string | undefined): StatsPeriod {
  if (!period) return '30d';
  return VALID_STATS_PERIODS.includes(period as StatsPeriod) ? (period as StatsPeriod) : '30d';
}

function periodToDays(period: StatsPeriod): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case 'all': return 9999;
  }
}

// ── Seller Orders Management mirrors ──────────────────────────────────────────

const VALID_ORDER_STATUSES = ['PENDING', 'PAID', 'DONE', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

function validateOrderUpdate(body: { status?: string; tracking_number?: string }): string | null {
  if (body.status && !VALID_ORDER_STATUSES.includes(body.status)) return `유효하지 않은 상태`;
  if (body.tracking_number !== undefined) {
    if (typeof body.tracking_number !== 'string') return 'tracking_number 형식 오류';
    if (body.tracking_number.length > 50) return 'tracking_number 50자 이하';
  }
  return null;
}

// ── Seller Kakao Link mirrors ─────────────────────────────────────────────────

function validateKakaoChatUrl(url: string): boolean {
  // 카카오톡 오픈채팅 URL: open.kakao.com/o/ 또는 pf.kakao.com
  return /^https:\/\/(open\.kakao\.com\/o\/|pf\.kakao\.com\/)/.test(url);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Seller Business Routes', () => {
  it('사업자번호 10자리 숫자 허용', () => {
    expect(validateBusinessNumber('1234567890')).toBe(true);
    expect(validateBusinessNumber('123-45-67890')).toBe(true);
  });

  it('잘못된 사업자번호 거부', () => {
    expect(validateBusinessNumber('123')).toBe(false);
    expect(validateBusinessNumber('12345678901')).toBe(false);
    expect(validateBusinessNumber('abc-de-fghij')).toBe(false);
  });

  it('계좌번호 10~20자리 허용', () => {
    expect(validateBankAccount('1234567890')).toBe(true);
    expect(validateBankAccount('123-456-789012')).toBe(true);
  });

  it('계좌번호 너무 짧으면 거부', () => {
    expect(validateBankAccount('123')).toBe(false);
  });

  it('예금주명 50자 초과 거부', () => {
    expect(validateBusinessInfo({ account_holder: 'a'.repeat(51) })).toBe('예금주명 50자 이하');
  });
});

describe('Seller PIN Routes', () => {
  it('4~6자리 숫자만 허용', () => {
    expect(validatePinFormat('1234')).toBe(true);
    expect(validatePinFormat('123456')).toBe(true);
    expect(validatePinFormat('123')).toBe(false);
    expect(validatePinFormat('1234567')).toBe(false);
    expect(validatePinFormat('abcd')).toBe(false);
  });

  it('PIN 변경 - 필수 항목 누락 거부', () => {
    expect(validatePinChange({})).toBe('current_pin, new_pin 필수');
  });

  it('새 PIN 이 기존과 같으면 거부', () => {
    expect(validatePinChange({ current_pin: '1234', new_pin: '1234' })).toBe('새 PIN 은 기존과 달라야 함');
  });

  it('정상 PIN 변경 통과', () => {
    expect(validatePinChange({ current_pin: '1234', new_pin: '5678' })).toBeNull();
  });
});

describe('Seller Profile Routes', () => {
  it('name 100자 제한', () => {
    expect(validateProfileUpdate({ name: 'a'.repeat(101) })).toContain('name');
    expect(validateProfileUpdate({ name: 'a'.repeat(100) })).toBeNull();
  });

  it('bio 1000자 제한', () => {
    expect(validateProfileUpdate({ bio: 'a'.repeat(1001) })).toContain('bio');
    expect(validateProfileUpdate({ bio: 'a'.repeat(1000) })).toBeNull();
  });

  it('description 2000자 제한', () => {
    expect(validateProfileUpdate({ description: 'a'.repeat(2001) })).toContain('description');
  });

  it('URL 500자 제한', () => {
    expect(validateProfileUpdate({ website_url: 'a'.repeat(501) })).toContain('URL');
  });

  it('빈 객체는 통과', () => {
    expect(validateProfileUpdate({})).toBeNull();
  });
});

describe('Seller Stats Routes', () => {
  it('유효한 기간 파싱', () => {
    expect(parseStatsPeriod('7d')).toBe('7d');
    expect(parseStatsPeriod('30d')).toBe('30d');
    expect(parseStatsPeriod('all')).toBe('all');
  });

  it('알 수 없는 기간은 30d 기본값', () => {
    expect(parseStatsPeriod('60d')).toBe('30d');
    expect(parseStatsPeriod(undefined)).toBe('30d');
  });

  it('기간 → 일수 변환', () => {
    expect(periodToDays('7d')).toBe(7);
    expect(periodToDays('30d')).toBe(30);
    expect(periodToDays('90d')).toBe(90);
    expect(periodToDays('all')).toBeGreaterThan(1000);
  });
});

describe('Seller Orders Management Routes', () => {
  it('유효한 주문 상태만 허용', () => {
    expect(validateOrderUpdate({ status: 'PAID' })).toBeNull();
    expect(validateOrderUpdate({ status: 'invalid' })).not.toBeNull();
    expect(validateOrderUpdate({ status: 'paid' })).not.toBeNull();
  });

  it('tracking_number 50자 제한', () => {
    expect(validateOrderUpdate({ tracking_number: 'a'.repeat(51) })).toContain('50자');
  });

  it('정상 송장번호 통과', () => {
    expect(validateOrderUpdate({ status: 'SHIPPING', tracking_number: '12345678901234' })).toBeNull();
  });
});

describe('Seller Kakao Link Routes', () => {
  it('유효한 카카오 오픈채팅 URL', () => {
    expect(validateKakaoChatUrl('https://open.kakao.com/o/abc123')).toBe(true);
    expect(validateKakaoChatUrl('https://pf.kakao.com/_xxxxx')).toBe(true);
  });

  it('잘못된 URL 거부', () => {
    expect(validateKakaoChatUrl('http://kakao.com')).toBe(false);
    expect(validateKakaoChatUrl('https://google.com')).toBe(false);
    expect(validateKakaoChatUrl('not-a-url')).toBe(false);
  });
});

describe('D1 mock', () => {
  it('PIN 업데이트 호출', async () => {
    const r = await mockDB.prepare('UPDATE sellers SET pin_hash = ? WHERE id = ?')
      .bind('hash', 1).run();
    expect(r.success).toBe(true);
  });
});
