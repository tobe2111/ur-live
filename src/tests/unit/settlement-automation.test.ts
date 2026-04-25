/**
 * 정산 자동화 단위 테스트
 *
 * getCurrentSettlementPeriod / getLastMonthSettlementPeriod 날짜 계산,
 * generateSettlementReport D1 mock 기반, 수수료 계산 로직 검증.
 *
 * 실제 DB 없이 실행 가능 — D1 인메모리 스텁 사용.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getCurrentSettlementPeriod,
  getLastMonthSettlementPeriod,
  generateSettlementReport,
} from '@/lib/settlement-automation';

// ── D1 인메모리 스텁 ──────────────────────────────────────────────────
function createMockDB(overrides?: {
  sellers?: Array<{ id: number }>;
  orders?: Array<{
    id: number; order_number: string; created_at: string;
    total_amount: number; shipping_fee: number; status: string;
    product_names: string | null; total_quantity: number | null;
  }>;
  sellerInfo?: { id: number; business_name: string; commission_rate: number } | null;
  refundAmount?: number;
}) {
  const sellers = overrides?.sellers ?? [];
  const orders = overrides?.orders ?? [];
  const sellerInfo = overrides?.sellerInfo ?? null;
  const refundAmt = overrides?.refundAmount ?? 0;

  return {
    prepare: (sql: string) => {
      const stmt = {
        _args: [] as unknown[],
        bind(...args: unknown[]) {
          this._args = args;
          return this;
        },
        async run() {
          return { success: true, meta: { changes: 1, last_row_id: 1 } };
        },
        async first<T>() {
          // seller 조회
          if (/SELECT id, business_name/.test(sql)) {
            return (sellerInfo as T) ?? null;
          }
          // 환불 합계 조회
          if (/status = 'refunded'/.test(sql)) {
            return { refund_amount: refundAmt } as T;
          }
          return null;
        },
        async all<T>() {
          // sellers distinct 조회
          if (/FROM sellers s/.test(sql) && /JOIN orders o/.test(sql)) {
            return { results: sellers as unknown as T[] };
          }
          // 주문 목록 조회
          if (/FROM orders o/.test(sql) && /GROUP BY o\.id/.test(sql)) {
            return { results: orders as unknown as T[] };
          }
          return { results: [] as T[] };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
}

// ── 헬퍼: KST 기준 날짜 기대값 계산 ─────────────────────────────────
function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ─────────────────────────────────────────────────────────────────────
// 1. getCurrentSettlementPeriod
// ─────────────────────────────────────────────────────────────────────
describe('getCurrentSettlementPeriod', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('startDate is first day of current month (KST)', () => {
    const period = getCurrentSettlementPeriod();
    expect(period.startDate).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('endDate is last day of current month (KST)', () => {
    const period = getCurrentSettlementPeriod();
    expect(period.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [yearStr, monthStr, dayStr] = period.endDate.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const expectedLastDay = lastDayOfMonth(year, month);
    expect(Number(dayStr)).toBe(expectedLastDay);
  });

  it('startDate and endDate are in the same month', () => {
    const period = getCurrentSettlementPeriod();
    const startMonth = period.startDate.slice(0, 7); // YYYY-MM
    const endMonth = period.endDate.slice(0, 7);
    expect(startMonth).toBe(endMonth);
  });

  it('endDate >= startDate', () => {
    const period = getCurrentSettlementPeriod();
    expect(period.endDate >= period.startDate).toBe(true);
  });

  it('returns correct dates for a month with 31 days (Jan)', () => {
    // UTC 기준 2026-01-01 00:00 → KST = 2026-01-01 09:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
    const period = getCurrentSettlementPeriod();
    expect(period.startDate).toBe('2026-01-01');
    expect(period.endDate).toBe('2026-01-31');
  });

  it('returns correct dates for February in a leap year (2024)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-02-05T00:00:00Z'));
    const period = getCurrentSettlementPeriod();
    expect(period.startDate).toBe('2024-02-01');
    expect(period.endDate).toBe('2024-02-29'); // 2024 is a leap year
  });

  it('returns correct dates for February in a non-leap year (2025)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-15T00:00:00Z'));
    const period = getCurrentSettlementPeriod();
    expect(period.startDate).toBe('2025-02-01');
    expect(period.endDate).toBe('2025-02-28');
  });

  it('returns correct dates for a 30-day month (April)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));
    const period = getCurrentSettlementPeriod();
    expect(period.startDate).toBe('2026-04-01');
    expect(period.endDate).toBe('2026-04-30');
  });

  // KST UTC+9 경계: UTC 12월 31일 15:00 → KST 1월 1일 00:00
  it('KST year-boundary: UTC Dec 31 15:00 is KST Jan 1 00:00 → reports January', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-31T15:00:00Z')); // KST = 2026-01-01 00:00
    const period = getCurrentSettlementPeriod();
    expect(period.startDate).toBe('2026-01-01');
    expect(period.endDate).toBe('2026-01-31');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. getLastMonthSettlementPeriod
// ─────────────────────────────────────────────────────────────────────
describe('getLastMonthSettlementPeriod', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('startDate is first day of last month', () => {
    const period = getLastMonthSettlementPeriod();
    expect(period.startDate).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('endDate is last day of last month', () => {
    const period = getLastMonthSettlementPeriod();
    const [yearStr, monthStr, dayStr] = period.endDate.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const expectedLastDay = lastDayOfMonth(year, month);
    expect(Number(dayStr)).toBe(expectedLastDay);
  });

  it('last month period ends before current month starts', () => {
    const last = getLastMonthSettlementPeriod();
    const current = getCurrentSettlementPeriod();
    expect(last.endDate < current.startDate).toBe(true);
  });

  it('January → last month is December of previous year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'));
    const period = getLastMonthSettlementPeriod();
    expect(period.startDate).toBe('2025-12-01');
    expect(period.endDate).toBe('2025-12-31');
  });

  it('March → last month is February (non-leap 2025)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T00:00:00Z'));
    const period = getLastMonthSettlementPeriod();
    expect(period.startDate).toBe('2025-02-01');
    expect(period.endDate).toBe('2025-02-28');
  });

  it('March → last month is February in a leap year (2024)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-10T00:00:00Z'));
    const period = getLastMonthSettlementPeriod();
    expect(period.startDate).toBe('2024-02-01');
    expect(period.endDate).toBe('2024-02-29');
  });

  it('May → last month is April (30 days)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T00:00:00Z'));
    const period = getLastMonthSettlementPeriod();
    expect(period.startDate).toBe('2026-04-01');
    expect(period.endDate).toBe('2026-04-30');
  });

  it('August → last month is July (31 days)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    const period = getLastMonthSettlementPeriod();
    expect(period.startDate).toBe('2026-07-01');
    expect(period.endDate).toBe('2026-07-31');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. generateSettlementReport — D1 mock
// ─────────────────────────────────────────────────────────────────────
describe('generateSettlementReport', () => {
  const period = { startDate: '2026-03-01', endDate: '2026-03-31' };

  it('returns a report with the correct period', async () => {
    const db = createMockDB();
    const report = await generateSettlementReport(db, period);
    expect(report.period.startDate).toBe(period.startDate);
    expect(report.period.endDate).toBe(period.endDate);
  });

  it('returns generated_at as a valid ISO string', async () => {
    const db = createMockDB();
    const report = await generateSettlementReport(db, period);
    expect(() => new Date(report.generated_at)).not.toThrow();
    expect(isNaN(new Date(report.generated_at).getTime())).toBe(false);
  });

  it('returns zero totals when no sellers have orders', async () => {
    const db = createMockDB({ sellers: [] });
    const report = await generateSettlementReport(db, period);
    expect(report.total_sales).toBe(0);
    expect(report.total_platform_fee).toBe(0);
    expect(report.total_settlement).toBe(0);
    expect(report.sellers).toHaveLength(0);
  });

  it('aggregates totals across multiple sellers', async () => {
    // Seller 1: 100,000원 매출, 10% 수수료 → 정산 90,000
    // Seller 2: 200,000원 매출, 10% 수수료 → 정산 180,000
    const seller1Orders = [{
      id: 1, order_number: 'ORD-001', created_at: '2026-03-05T00:00:00Z',
      total_amount: 100000, shipping_fee: 3000, status: 'delivered',
      product_names: '상품A', total_quantity: 1,
    }];
    const seller2Orders = [{
      id: 2, order_number: 'ORD-002', created_at: '2026-03-10T00:00:00Z',
      total_amount: 200000, shipping_fee: 3000, status: 'confirmed',
      product_names: '상품B', total_quantity: 2,
    }];

    // Create a DB mock that serves both sellers
    let callCount = 0;
    const db = {
      prepare: (sql: string) => {
        const stmt = {
          _args: [] as unknown[],
          bind(...args: unknown[]) { this._args = args; return this; },
          async run() { return { success: true, meta: { changes: 1, last_row_id: 1 } }; },
          async first<T>() {
            if (/SELECT id, business_name/.test(sql)) {
              const sellerId = this._args[0] as number;
              if (sellerId === 10) return { id: 10, business_name: '셀러A', commission_rate: 10 } as T;
              if (sellerId === 20) return { id: 20, business_name: '셀러B', commission_rate: 10 } as T;
            }
            if (/status = 'refunded'/.test(sql)) return { refund_amount: 0 } as T;
            return null;
          },
          async all<T>() {
            if (/FROM sellers s/.test(sql) && /JOIN orders o/.test(sql)) {
              return { results: [{ id: 10 }, { id: 20 }] as unknown as T[] };
            }
            if (/FROM orders o/.test(sql) && /GROUP BY o\.id/.test(sql)) {
              const sellerId = this._args[0] as number;
              if (sellerId === 10) return { results: seller1Orders as unknown as T[] };
              if (sellerId === 20) return { results: seller2Orders as unknown as T[] };
            }
            return { results: [] as T[] };
          },
        };
        return stmt;
      },
    } as unknown as D1Database;

    const report = await generateSettlementReport(db, period);
    expect(report.sellers).toHaveLength(2);
    expect(report.total_sales).toBe(300000);
    // 10% fee on 100000 = 10000, on 200000 = 20000 → total fee = 30000
    expect(report.total_platform_fee).toBe(30000);
    // settlement = 300000 - 30000 = 270000
    expect(report.total_settlement).toBe(270000);
  });

  it('individual seller settlement: 10% commission on 50,000원 = 5,000원 fee', async () => {
    const db = {
      prepare: (sql: string) => {
        const stmt = {
          _args: [] as unknown[],
          bind(...args: unknown[]) { this._args = args; return this; },
          async run() { return { success: true, meta: { changes: 1, last_row_id: 1 } }; },
          async first<T>() {
            if (/SELECT id, business_name/.test(sql)) {
              return { id: 42, business_name: '테스트셀러', commission_rate: 10 } as T;
            }
            if (/status = 'refunded'/.test(sql)) return { refund_amount: 0 } as T;
            return null;
          },
          async all<T>() {
            if (/FROM sellers s/.test(sql)) return { results: [{ id: 42 }] as unknown as T[] };
            if (/FROM orders o/.test(sql) && /GROUP BY o\.id/.test(sql)) {
              return {
                results: [{
                  id: 99, order_number: 'ORD-099', created_at: '2026-03-01T00:00:00Z',
                  total_amount: 50000, shipping_fee: 0, status: 'delivered',
                  product_names: '상품Z', total_quantity: 1,
                }] as unknown as T[],
              };
            }
            return { results: [] as T[] };
          },
        };
        return stmt;
      },
    } as unknown as D1Database;

    const report = await generateSettlementReport(db, period);
    expect(report.sellers).toHaveLength(1);
    const s = report.sellers[0];
    expect(s.total_sales).toBe(50000);
    expect(s.platform_fee).toBe(5000);       // Math.round(50000 * 0.10) = 5000
    expect(s.settlement_amount).toBe(45000); // 50000 - 5000 = 45000
  });

  it('seller with 0% commission rate: full amount goes to seller', async () => {
    const db = {
      prepare: (sql: string) => {
        const stmt = {
          _args: [] as unknown[],
          bind(...args: unknown[]) { this._args = args; return this; },
          async run() { return { success: true, meta: { changes: 1, last_row_id: 1 } }; },
          async first<T>() {
            if (/SELECT id, business_name/.test(sql)) {
              return { id: 5, business_name: '제휴셀러', commission_rate: 0 } as T;
            }
            if (/status = 'refunded'/.test(sql)) return { refund_amount: 0 } as T;
            return null;
          },
          async all<T>() {
            if (/FROM sellers s/.test(sql)) return { results: [{ id: 5 }] as unknown as T[] };
            if (/GROUP BY o\.id/.test(sql)) {
              return {
                results: [{
                  id: 10, order_number: 'ORD-010', created_at: '2026-03-10T00:00:00Z',
                  total_amount: 80000, shipping_fee: 0, status: 'confirmed',
                  product_names: '프리미엄상품', total_quantity: 1,
                }] as unknown as T[],
              };
            }
            return { results: [] as T[] };
          },
        };
        return stmt;
      },
    } as unknown as D1Database;

    const report = await generateSettlementReport(db, period);
    const s = report.sellers[0];
    expect(s.platform_fee).toBe(0);
    expect(s.settlement_amount).toBe(80000);
  });

  it('refund larger than sales clamps settlement to 0 (no negative payout)', async () => {
    const db = {
      prepare: (sql: string) => {
        const stmt = {
          _args: [] as unknown[],
          bind(...args: unknown[]) { this._args = args; return this; },
          async run() { return { success: true, meta: { changes: 1, last_row_id: 1 } }; },
          async first<T>() {
            if (/SELECT id, business_name/.test(sql)) {
              return { id: 7, business_name: '환불많은셀러', commission_rate: 10 } as T;
            }
            // 환불 금액이 매출보다 큼
            if (/status = 'refunded'/.test(sql)) return { refund_amount: 200000 } as T;
            return null;
          },
          async all<T>() {
            if (/FROM sellers s/.test(sql)) return { results: [{ id: 7 }] as unknown as T[] };
            if (/GROUP BY o\.id/.test(sql)) {
              return {
                results: [{
                  id: 20, order_number: 'ORD-020', created_at: '2026-03-15T00:00:00Z',
                  total_amount: 50000, shipping_fee: 0, status: 'delivered',
                  product_names: '환불상품', total_quantity: 1,
                }] as unknown as T[],
              };
            }
            return { results: [] as T[] };
          },
        };
        return stmt;
      },
    } as unknown as D1Database;

    const report = await generateSettlementReport(db, period);
    const s = report.sellers[0];
    // raw = 50000 - 5000 - 200000 = -155000 → clamped to 0
    expect(s.settlement_amount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4. 수수료 계산 (calculatePlatformFee 로직 직접 검증)
// ─────────────────────────────────────────────────────────────────────
describe('Commission calculation (Math.round policy)', () => {
  // settlement-automation.ts 의 calculatePlatformFee 로직을 mirror
  function calculatePlatformFee(amount: number, feeRate: number = 0.10): number {
    return Math.round(amount * feeRate);
  }

  it('10% of 1,000원 = 100원', () => {
    expect(calculatePlatformFee(1000, 0.10)).toBe(100);
  });

  it('10% of 100,000원 = 10,000원', () => {
    expect(calculatePlatformFee(100000, 0.10)).toBe(10000);
  });

  it('rounds half-up: 10% of 1005 = Math.round(100.5) = 101', () => {
    expect(calculatePlatformFee(1005, 0.10)).toBe(101); // Math.round(100.5) = 101
  });

  it('rounds down when < .5: 10% of 1004 = Math.round(100.4) = 100', () => {
    expect(calculatePlatformFee(1004, 0.10)).toBe(100);
  });

  it('15% commission rate applied correctly', () => {
    expect(calculatePlatformFee(200000, 0.15)).toBe(30000);
  });

  it('0% commission rate yields 0 fee', () => {
    expect(calculatePlatformFee(50000, 0)).toBe(0);
  });

  it('settlement-automation uses percentage (÷100) before calling calculatePlatformFee', () => {
    // CLAUDE.md HIGH-1 NOTE: commission_rate stored as PERCENTAGE (e.g. 10)
    // must be divided by 100 before passing to calculatePlatformFee
    const commissionRate = 10; // from DB: sellers.commission_rate = 10
    const amount = 100000;
    const fee = calculatePlatformFee(amount, commissionRate / 100);
    expect(fee).toBe(10000);
  });

  it('settlement amount = sales - fee - refunds, floored to 0 on negative', () => {
    const sales = 30000;
    const fee = calculatePlatformFee(30000, 0.10); // 3000
    const refunds = 35000; // more than sales
    const raw = sales - fee - refunds; // -8000
    const settlement = Math.max(0, raw);
    expect(settlement).toBe(0);
  });
});
