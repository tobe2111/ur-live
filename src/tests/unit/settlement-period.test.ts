/**
 * 정산 기간 날짜 계산 집중 테스트
 *
 * settlement-automation.ts 의 기간 계산 함수들을 edge case 중심으로 검증:
 *   - 1월 1일: 지난달 = 12월 (이전 연도)
 *   - 윤년 2월 말 처리
 *   - 월별 말일 정확성 (28/29/30/31)
 *   - KST UTC+9 경계 처리
 *   - 정산 주기 (매월 1일~말일)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getCurrentSettlementPeriod,
  getLastMonthSettlementPeriod,
} from '@/lib/settlement-automation';

afterEach(() => {
  vi.useRealTimers();
});

// ── 헬퍼 ─────────────────────────────────────────────────────────────
function freezeUTC(isoString: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoString));
}

function daysInPeriod(period: { startDate: string; endDate: string }): number {
  const start = new Date(period.startDate + 'T00:00:00Z');
  const end = new Date(period.endDate + 'T00:00:00Z');
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// ─────────────────────────────────────────────────────────────────────
// 1. 1월 → 지난달은 12월 (이전 연도)
// ─────────────────────────────────────────────────────────────────────
describe('Year-boundary: January → previous December', () => {
  it('Jan 1 (KST) → last month = Dec of previous year', () => {
    freezeUTC('2026-01-01T00:00:00Z'); // KST = 2026-01-01 09:00
    const last = getLastMonthSettlementPeriod();
    expect(last.startDate).toBe('2025-12-01');
    expect(last.endDate).toBe('2025-12-31');
  });

  it('Jan 31 (KST) → last month still December of previous year', () => {
    freezeUTC('2026-01-31T00:00:00Z');
    const last = getLastMonthSettlementPeriod();
    expect(last.startDate).toBe('2025-12-01');
    expect(last.endDate).toBe('2025-12-31');
  });

  it('Jan current period covers all 31 days', () => {
    freezeUTC('2026-01-15T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(daysInPeriod(current)).toBe(31);
  });

  it('Dec last period covers all 31 days', () => {
    freezeUTC('2026-01-15T00:00:00Z');
    const last = getLastMonthSettlementPeriod();
    expect(daysInPeriod(last)).toBe(31);
  });

  it('current year is correct after year boundary (current = Jan 2026)', () => {
    freezeUTC('2026-01-10T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(current.startDate.startsWith('2026')).toBe(true);
  });

  it('last period year is previous year (2025) when current is Jan 2026', () => {
    freezeUTC('2026-01-10T00:00:00Z');
    const last = getLastMonthSettlementPeriod();
    expect(last.startDate.startsWith('2025')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. 윤년 2월 말 처리
// ─────────────────────────────────────────────────────────────────────
describe('Leap year February handling', () => {
  it('2024 is a leap year: current period in Feb 2024 ends on Feb 29', () => {
    freezeUTC('2024-02-10T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(current.endDate).toBe('2024-02-29');
  });

  it('2024 leap year Feb has 29 days in period', () => {
    freezeUTC('2024-02-01T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(daysInPeriod(current)).toBe(29);
  });

  it('2025 is NOT a leap year: current period in Feb 2025 ends on Feb 28', () => {
    freezeUTC('2025-02-10T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(current.endDate).toBe('2025-02-28');
  });

  it('2025 non-leap Feb has 28 days in period', () => {
    freezeUTC('2025-02-01T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(daysInPeriod(current)).toBe(28);
  });

  it('March 2024 → last month (Feb 2024) has 29 days (leap year)', () => {
    freezeUTC('2024-03-05T00:00:00Z');
    const last = getLastMonthSettlementPeriod();
    expect(last.endDate).toBe('2024-02-29');
    expect(daysInPeriod(last)).toBe(29);
  });

  it('March 2025 → last month (Feb 2025) has 28 days (non-leap year)', () => {
    freezeUTC('2025-03-05T00:00:00Z');
    const last = getLastMonthSettlementPeriod();
    expect(last.endDate).toBe('2025-02-28');
    expect(daysInPeriod(last)).toBe(28);
  });

  it('century year 2100 is NOT a leap year: Feb 2100 ends on 28', () => {
    freezeUTC('2100-02-15T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(current.endDate).toBe('2100-02-28');
  });

  it('century year 2000 IS a leap year: Feb 2000 ends on 29', () => {
    freezeUTC('2000-02-20T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(current.endDate).toBe('2000-02-29');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. 월별 말일 정확성 (28/29/30/31)
// ─────────────────────────────────────────────────────────────────────
describe('Month last-day accuracy', () => {
  const MONTHS_31 = [1, 3, 5, 7, 8, 10, 12];
  const MONTHS_30 = [4, 6, 9, 11];

  for (const month of MONTHS_31) {
    const monthStr = String(month).padStart(2, '0');
    it(`${monthStr}월: 31일 말일`, () => {
      freezeUTC(`2026-${monthStr}-15T00:00:00Z`);
      const current = getCurrentSettlementPeriod();
      expect(current.endDate).toBe(`2026-${monthStr}-31`);
    });
  }

  for (const month of MONTHS_30) {
    const monthStr = String(month).padStart(2, '0');
    it(`${monthStr}월: 30일 말일`, () => {
      freezeUTC(`2026-${monthStr}-15T00:00:00Z`);
      const current = getCurrentSettlementPeriod();
      expect(current.endDate).toBe(`2026-${monthStr}-30`);
    });
  }

  it('February (non-leap): 28일 말일', () => {
    freezeUTC('2026-02-10T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    expect(current.endDate).toBe('2026-02-28');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4. KST UTC+9 경계 처리
// ─────────────────────────────────────────────────────────────────────
describe('KST timezone boundary', () => {
  it('UTC 12:00 Jan 31 = KST 21:00 Jan 31 → current = January', () => {
    freezeUTC('2026-01-31T12:00:00Z'); // KST 21:00 Jan 31 — still January
    const current = getCurrentSettlementPeriod();
    expect(current.startDate).toBe('2026-01-01');
    expect(current.endDate).toBe('2026-01-31');
  });

  it('UTC 15:00 Jan 31 = KST 00:00 Feb 1 → current = February', () => {
    freezeUTC('2026-01-31T15:00:00Z'); // KST 2026-02-01 00:00 — February
    const current = getCurrentSettlementPeriod();
    expect(current.startDate).toBe('2026-02-01');
    expect(current.endDate).toBe('2026-02-28'); // 2026 is non-leap
  });

  it('UTC Dec 31 14:59 = KST Dec 31 23:59 → current = December, last = November', () => {
    freezeUTC('2025-12-31T14:59:00Z'); // KST = 2025-12-31 23:59
    const current = getCurrentSettlementPeriod();
    const last = getLastMonthSettlementPeriod();
    expect(current.startDate).toBe('2025-12-01');
    expect(last.startDate).toBe('2025-11-01');
    expect(last.endDate).toBe('2025-11-30');
  });

  it('UTC Dec 31 15:00 = KST Jan 1 00:00 → current = January (new year)', () => {
    freezeUTC('2025-12-31T15:00:00Z'); // KST = 2026-01-01 00:00
    const current = getCurrentSettlementPeriod();
    expect(current.startDate).toBe('2026-01-01');
    expect(current.endDate).toBe('2026-01-31');
  });

  it('UTC Dec 31 15:00 = KST Jan 1 → last month = Dec 2025', () => {
    freezeUTC('2025-12-31T15:00:00Z'); // KST = 2026-01-01 00:00
    const last = getLastMonthSettlementPeriod();
    expect(last.startDate).toBe('2025-12-01');
    expect(last.endDate).toBe('2025-12-31');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5. 정산 주기 구조 (매월 1일~말일)
// ─────────────────────────────────────────────────────────────────────
describe('Settlement cycle structure', () => {
  it('every period starts on the 1st', () => {
    const months = ['2026-01', '2026-03', '2026-06', '2026-09', '2026-12'];
    for (const ym of months) {
      freezeUTC(`${ym}-15T00:00:00Z`);
      const current = getCurrentSettlementPeriod();
      expect(current.startDate).toMatch(/-01$/);
      vi.useRealTimers();
    }
  });

  it('consecutive periods are contiguous (end+1 = next start)', () => {
    freezeUTC('2026-04-15T00:00:00Z');
    const current = getCurrentSettlementPeriod(); // April
    const last = getLastMonthSettlementPeriod();   // March

    const lastEndDate = new Date(last.endDate + 'T00:00:00Z');
    const currentStartDate = new Date(current.startDate + 'T00:00:00Z');
    const daysDiff = (currentStartDate.getTime() - lastEndDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBe(1); // last day of March + 1 = first day of April
  });

  it('periods do not overlap', () => {
    freezeUTC('2026-07-10T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    const last = getLastMonthSettlementPeriod();
    // last period end must be strictly before current period start
    expect(last.endDate < current.startDate).toBe(true);
  });

  it('period covers an entire calendar month (no gaps)', () => {
    const testCases = [
      { utc: '2026-01-15T00:00:00Z', expected: 31 },
      { utc: '2026-04-15T00:00:00Z', expected: 30 },
      { utc: '2026-02-10T00:00:00Z', expected: 28 }, // non-leap
      { utc: '2024-02-10T00:00:00Z', expected: 29 }, // leap
    ];
    for (const tc of testCases) {
      freezeUTC(tc.utc);
      const current = getCurrentSettlementPeriod();
      expect(daysInPeriod(current)).toBe(tc.expected);
      vi.useRealTimers();
    }
  });

  it('endDate day string is zero-padded (e.g. 01, 28, 31)', () => {
    freezeUTC('2026-02-01T00:00:00Z');
    const current = getCurrentSettlementPeriod();
    const day = current.endDate.split('-')[2];
    expect(day).toMatch(/^\d{2}$/); // always 2 digits
  });

  it('month string is zero-padded in startDate and endDate', () => {
    freezeUTC('2026-01-15T00:00:00Z');
    const last = getLastMonthSettlementPeriod();
    // December of 2025: month = '12'
    const startMonth = last.startDate.split('-')[1];
    const endMonth = last.endDate.split('-')[1];
    expect(startMonth).toMatch(/^\d{2}$/);
    expect(endMonth).toMatch(/^\d{2}$/);
  });
});
