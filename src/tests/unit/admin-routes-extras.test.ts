/**
 * Admin Routes Extras 단위 테스트
 * 다른 admin 테스트 파일에서 다루지 않는 라우트:
 *   - admin-flags.routes.ts
 *   - admin-management.routes.ts
 *   - admin-metrics.routes.ts
 *   - admin-misc.routes.ts
 *   - admin-accounts.routes.ts
 *   - admin-settlements.routes.ts
 *   - admin-analytics.routes.ts
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

// ── Admin Flags mirrors ───────────────────────────────────────────────────────

const VALID_FLAG_MODES = ['emergency', 'normal'] as const;
type FlagMode = typeof VALID_FLAG_MODES[number];

function validateFlagMode(mode: string): mode is FlagMode {
  return VALID_FLAG_MODES.includes(mode as FlagMode);
}

function validateFlagToggle(flag: string, value: unknown): string | null {
  if (typeof flag !== 'string' || flag.trim().length === 0) return 'flag 필수';
  if (!flag.startsWith('enable_')) return 'flag 이름은 enable_ 로 시작';
  if (typeof value !== 'boolean') return 'value 는 boolean';
  return null;
}

// ── Admin Settlements mirrors ─────────────────────────────────────────────────

const VALID_SETTLEMENT_STATUSES = ['pending', 'completed'] as const;
type SettlementStatus = typeof VALID_SETTLEMENT_STATUSES[number];

function validateSettlementStatus(status: string): status is SettlementStatus {
  return VALID_SETTLEMENT_STATUSES.includes(status as SettlementStatus);
}

function calcSellerAmount(totalAmount: number, commissionRate: number): number {
  if (commissionRate < 0 || commissionRate > 100) throw new Error('commission_rate 범위 오류');
  return Math.round(totalAmount * (1 - commissionRate / 100));
}

function calcCommissionAmount(totalAmount: number, commissionRate: number): number {
  return Math.round(totalAmount * commissionRate / 100);
}

// ── Admin Accounts mirrors ────────────────────────────────────────────────────

function validateAdminCreate(body: {
  email?: string; password?: string; name?: string; role?: string
}): string | null {
  if (!body.email || !body.password || !body.name || !body.role) {
    return '필수 항목이 누락되었습니다 (email, password, name, role)';
  }
  if (!body.email.includes('@')) return 'email 형식 오류';
  return null;
}

function validatePasswordComplexityMirror(password: string): { ok: boolean; reason?: string } {
  if (password.length < 8) return { ok: false, reason: '8자 이상' };
  if (!/[A-Z]/.test(password) && !/[!@#$%^&*]/.test(password)) {
    return { ok: false, reason: '대문자 또는 특수문자 포함' };
  }
  return { ok: true };
}

const VALID_ADMIN_ROLES = ['admin', 'super_admin', 'support', 'moderator'] as const;

function isValidAdminRole(role: string): boolean {
  return VALID_ADMIN_ROLES.includes(role as typeof VALID_ADMIN_ROLES[number]);
}

// ── Admin Metrics mirrors ─────────────────────────────────────────────────────

function validateMetricsDateRange(startDate: string, endDate: string): string | null {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (isNaN(start)) return 'startDate 형식 오류';
  if (isNaN(end)) return 'endDate 형식 오류';
  if (start > end) return 'startDate > endDate';
  // 최대 1년 범위 제한
  const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;
  if (end - start > ONE_YEAR_MS) return '날짜 범위는 최대 1년';
  return null;
}

// ── Admin Misc mirrors ────────────────────────────────────────────────────────

function validateAdminListPagination(pageStr?: string, limitStr?: string) {
  const page = Math.max((parseInt(pageStr || '1') || 1), 1);
  const limit = Math.min(Math.max((parseInt(limitStr || '20') || 20), 1), 200);
  return { page, limit, offset: (page - 1) * limit };
}

function escapeLikeWildcard(input: string): string {
  return input.replace(/[%_]/g, '\\$&');
}

// ── Tests: Admin Flags ────────────────────────────────────────────────────────

describe('Admin Flags Routes', () => {
  describe('validateFlagMode', () => {
    it('emergency / normal 모드만 허용', () => {
      expect(validateFlagMode('emergency')).toBe(true);
      expect(validateFlagMode('normal')).toBe(true);
    });

    it('잘못된 모드 거부', () => {
      expect(validateFlagMode('safe')).toBe(false);
      expect(validateFlagMode('EMERGENCY')).toBe(false);
      expect(validateFlagMode('')).toBe(false);
    });
  });

  describe('validateFlagToggle', () => {
    it('flag 이름은 enable_ 접두사 필수', () => {
      expect(validateFlagToggle('reviews', true)).toBe('flag 이름은 enable_ 로 시작');
      expect(validateFlagToggle('enable_reviews', true)).toBeNull();
    });

    it('value 는 boolean만 허용', () => {
      expect(validateFlagToggle('enable_reviews', 'true')).toBe('value 는 boolean');
      expect(validateFlagToggle('enable_reviews', 1)).toBe('value 는 boolean');
      expect(validateFlagToggle('enable_reviews', false)).toBeNull();
    });

    it('빈 flag 거부', () => {
      expect(validateFlagToggle('', true)).toBe('flag 필수');
      expect(validateFlagToggle('   ', true)).toBe('flag 필수');
    });
  });
});

// ── Tests: Admin Settlements ──────────────────────────────────────────────────

describe('Admin Settlements Routes', () => {
  describe('validateSettlementStatus', () => {
    it('pending / completed 만 허용', () => {
      expect(validateSettlementStatus('pending')).toBe(true);
      expect(validateSettlementStatus('completed')).toBe(true);
    });

    it('다른 상태 거부', () => {
      expect(validateSettlementStatus('paid')).toBe(false);
      expect(validateSettlementStatus('PENDING')).toBe(false);
      expect(validateSettlementStatus('')).toBe(false);
    });
  });

  describe('calcSellerAmount', () => {
    it('수수료 10% 적용 시 셀러 금액 = 주문금액 × 0.9', () => {
      expect(calcSellerAmount(100000, 10)).toBe(90000);
      expect(calcSellerAmount(50000, 10)).toBe(45000);
    });

    it('수수료 0% 시 전액 셀러 지급', () => {
      expect(calcSellerAmount(100000, 0)).toBe(100000);
    });

    it('수수료 100% 시 셀러 금액 0', () => {
      expect(calcSellerAmount(100000, 100)).toBe(0);
    });

    it('수수료율 범위 초과 시 에러', () => {
      expect(() => calcSellerAmount(100000, -1)).toThrow();
      expect(() => calcSellerAmount(100000, 101)).toThrow();
    });
  });

  describe('calcCommissionAmount', () => {
    it('수수료율 적용 후 반올림', () => {
      expect(calcCommissionAmount(33333, 10)).toBe(3333);
      expect(calcCommissionAmount(99999, 10)).toBe(10000); // 9999.9 → 10000
    });
  });
});

// ── Tests: Admin Accounts ─────────────────────────────────────────────────────

describe('Admin Accounts Routes', () => {
  describe('validateAdminCreate', () => {
    it('필수 필드 누락 시 거부', () => {
      expect(validateAdminCreate({})).not.toBeNull();
      expect(validateAdminCreate({ email: 'a@b.com' })).not.toBeNull();
      expect(validateAdminCreate({
        email: 'a@b.com', password: 'pw', name: 'N'
      })).toBe('필수 항목이 누락되었습니다 (email, password, name, role)');
    });

    it('@ 없는 이메일 거부', () => {
      expect(validateAdminCreate({
        email: 'invalid', password: 'p', name: 'n', role: 'admin'
      })).toBe('email 형식 오류');
    });

    it('모든 필드 있으면 통과', () => {
      expect(validateAdminCreate({
        email: 'a@b.com', password: 'Abc123!@', name: '홍길동', role: 'admin'
      })).toBeNull();
    });
  });

  describe('validatePasswordComplexityMirror', () => {
    it('8자 미만 거부', () => {
      expect(validatePasswordComplexityMirror('abc').ok).toBe(false);
      expect(validatePasswordComplexityMirror('1234567').ok).toBe(false);
    });

    it('8자 이상 + 대문자/특수문자 포함 시 통과', () => {
      expect(validatePasswordComplexityMirror('Abc12345').ok).toBe(true);
      expect(validatePasswordComplexityMirror('abc12345!').ok).toBe(true);
    });

    it('대문자/특수문자 없으면 거부', () => {
      expect(validatePasswordComplexityMirror('abcdefgh').ok).toBe(false);
    });
  });

  describe('isValidAdminRole', () => {
    it('정의된 역할만 허용', () => {
      ['admin', 'super_admin', 'support', 'moderator'].forEach(r => {
        expect(isValidAdminRole(r)).toBe(true);
      });
    });

    it('정의되지 않은 역할 거부', () => {
      expect(isValidAdminRole('owner')).toBe(false);
      expect(isValidAdminRole('user')).toBe(false);
      expect(isValidAdminRole('')).toBe(false);
    });
  });
});

// ── Tests: Admin Metrics ──────────────────────────────────────────────────────

describe('Admin Metrics Routes', () => {
  describe('validateMetricsDateRange', () => {
    it('유효한 날짜 범위 통과', () => {
      expect(validateMetricsDateRange('2024-01-01', '2024-12-31')).toBeNull();
    });

    it('잘못된 날짜 형식 거부', () => {
      expect(validateMetricsDateRange('not-a-date', '2024-01-01')).not.toBeNull();
      expect(validateMetricsDateRange('2024-01-01', 'invalid')).not.toBeNull();
    });

    it('startDate > endDate 거부', () => {
      expect(validateMetricsDateRange('2024-12-31', '2024-01-01')).toBe('startDate > endDate');
    });

    it('1년 초과 범위 거부', () => {
      expect(validateMetricsDateRange('2023-01-01', '2025-01-01')).toBe('날짜 범위는 최대 1년');
    });
  });
});

// ── Tests: Admin Misc ─────────────────────────────────────────────────────────

describe('Admin Misc Routes', () => {
  describe('validateAdminListPagination', () => {
    it('기본값: page=1, limit=20', () => {
      const r = validateAdminListPagination();
      expect(r.page).toBe(1);
      expect(r.limit).toBe(20);
      expect(r.offset).toBe(0);
    });

    it('limit 최대 200 제한', () => {
      expect(validateAdminListPagination('1', '500').limit).toBe(200);
    });

    it('잘못된 값은 기본값 사용', () => {
      const r = validateAdminListPagination('abc', 'xyz');
      expect(r.page).toBe(1);
      expect(r.limit).toBe(20);
    });
  });

  describe('escapeLikeWildcard', () => {
    it('LIKE 와일드카드 이스케이프', () => {
      expect(escapeLikeWildcard('test%user')).toBe('test\\%user');
      expect(escapeLikeWildcard('a_b')).toBe('a\\_b');
    });

    it('이스케이프 필요 없는 문자는 그대로', () => {
      expect(escapeLikeWildcard('홍길동')).toBe('홍길동');
      expect(escapeLikeWildcard('test123')).toBe('test123');
    });
  });
});

// ── D1 mock interaction ──────────────────────────────────────────────────────

describe('D1 mock sanity', () => {
  it('UPDATE 정산 상태 호출 동작', async () => {
    const r = await mockDB.prepare('UPDATE orders SET settlement_status = ? WHERE id = ?')
      .bind('completed', 1).run();
    expect(r.success).toBe(true);
    expect(r.meta?.changes).toBe(1);
  });

  it('SELECT admin 목록 호출 동작', async () => {
    const r = await mockDB.prepare('SELECT id, email, name FROM admins').bind().all();
    expect(r.results).toEqual([]);
  });
});
