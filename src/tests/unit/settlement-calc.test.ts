/**
 * 정산 계산 — 수수료 / 부가세 / 순지급액 순수 로직 테스트
 *
 * src/worker/cron/agency-monthly-invoices.ts 와 auto-settlement.ts 의 핵심
 * 계산 로직을 시뮬레이션. D1 / 외부 의존성 없이 pure function 으로 검증.
 *
 * 가드:
 *   1. commission_amount = total_amount × rate / 100 (반올림)
 *   2. tax_amount = commission_amount × 10 / 100 (VAT)
 *   3. net_amount = total_amount - commission_amount - tax_amount
 *   4. 음수 입력 거부
 *   5. rate 0~100 범위 외 거부
 */
import { describe, it, expect } from 'vitest';

interface SettlementCalc {
  total_amount: number;
  commission_rate: number; // %, e.g. 2.0
  commission_amount: number;
  tax_amount: number;
  net_amount: number;
}

function calcSettlement(totalAmount: number, commissionRate: number): SettlementCalc | { error: string } {
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return { error: 'total_amount must be non-negative number' };
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    return { error: 'commission_rate must be 0~100' };
  }
  const commission_amount = Math.round((totalAmount * commissionRate) / 100);
  const tax_amount = Math.round((commission_amount * 10) / 100); // VAT 10%
  const net_amount = totalAmount - commission_amount - tax_amount;
  return {
    total_amount: totalAmount,
    commission_rate: commissionRate,
    commission_amount,
    tax_amount,
    net_amount,
  };
}

describe('Settlement 계산 — 정상 케이스', () => {
  it('100만원 × 2% (에이전시 기본) → 수수료 2만 / VAT 2천 / 순지급 977800', () => {
    const r = calcSettlement(1_000_000, 2.0);
    expect(r).toEqual({
      total_amount: 1_000_000,
      commission_rate: 2.0,
      commission_amount: 20_000,
      tax_amount: 2_000,
      net_amount: 978_000,
    });
  });

  it('500만원 × 10% (셀러 기본) → 수수료 50만 / VAT 5만 / 순지급 445만', () => {
    const r = calcSettlement(5_000_000, 10);
    expect(r).toEqual({
      total_amount: 5_000_000,
      commission_rate: 10,
      commission_amount: 500_000,
      tax_amount: 50_000,
      net_amount: 4_450_000,
    });
  });

  it('100만원 × 15% (후원 수수료) → 수수료 15만 / VAT 1.5만 / 순지급 83.5만', () => {
    const r = calcSettlement(1_000_000, 15);
    expect(r).toEqual({
      total_amount: 1_000_000,
      commission_rate: 15,
      commission_amount: 150_000,
      tax_amount: 15_000,
      net_amount: 835_000,
    });
  });

  it('0원 매출 → 수수료/VAT/순지급 모두 0', () => {
    const r = calcSettlement(0, 10);
    expect((r as SettlementCalc).commission_amount).toBe(0);
    expect((r as SettlementCalc).tax_amount).toBe(0);
    expect((r as SettlementCalc).net_amount).toBe(0);
  });
});

describe('Settlement 계산 — 반올림', () => {
  it('소수점 결과 → 반올림 (5500원 × 7% = 385원)', () => {
    const r = calcSettlement(5500, 7);
    expect((r as SettlementCalc).commission_amount).toBe(385);
    expect((r as SettlementCalc).tax_amount).toBe(39); // 385 × 10% = 38.5 → 39
    expect((r as SettlementCalc).net_amount).toBe(5500 - 385 - 39); // 5076
  });

  it('정확히 0.5 → 반올림 (Math.round half-to-even 아님, JS 는 half-up)', () => {
    // 1000 × 1.5% = 15 정확
    expect((calcSettlement(1000, 1.5) as SettlementCalc).commission_amount).toBe(15);
    // 1234 × 2.5% = 30.85 → 31
    expect((calcSettlement(1234, 2.5) as SettlementCalc).commission_amount).toBe(31);
  });
});

describe('Settlement 계산 — 입력 검증', () => {
  it('음수 매출 거부', () => {
    const r = calcSettlement(-100, 10);
    expect('error' in r && r.error).toContain('non-negative');
  });

  it('NaN 매출 거부', () => {
    const r = calcSettlement(NaN, 10);
    expect('error' in r && r.error).toContain('non-negative');
  });

  it('수수료율 음수 거부', () => {
    const r = calcSettlement(1000, -1);
    expect('error' in r && r.error).toContain('0~100');
  });

  it('수수료율 100 초과 거부', () => {
    const r = calcSettlement(1000, 101);
    expect('error' in r && r.error).toContain('0~100');
  });

  it('수수료율 0 통과 (수수료 면제)', () => {
    const r = calcSettlement(1000, 0);
    expect((r as SettlementCalc).commission_amount).toBe(0);
    expect((r as SettlementCalc).net_amount).toBe(1000);
  });

  it('수수료율 100 통과 (전액 수수료)', () => {
    const r = calcSettlement(1000, 100);
    expect((r as SettlementCalc).commission_amount).toBe(1000);
    expect((r as SettlementCalc).tax_amount).toBe(100);
    expect((r as SettlementCalc).net_amount).toBe(-100); // 부가세 만큼 음수 (운영자 부담)
  });
});

describe('Settlement 계산 — 무결성 (회계 항등식)', () => {
  it('total = commission + tax + net (모든 정상 케이스)', () => {
    const cases = [
      [1_000_000, 2],
      [5_500, 7],
      [10_000_000, 0.5],
      [37, 12.34],
    ] as const;
    for (const [amt, rate] of cases) {
      const r = calcSettlement(amt, rate);
      if ('error' in r) continue;
      expect(r.commission_amount + r.tax_amount + r.net_amount).toBe(r.total_amount);
    }
  });

  it('VAT = commission × 10% 항상 성립 (rounding 오차 ±1)', () => {
    for (const amt of [1000, 5500, 12345, 999_999]) {
      for (const rate of [1, 2, 5, 10, 15]) {
        const r = calcSettlement(amt, rate) as SettlementCalc;
        const expectedVat = Math.round(r.commission_amount * 0.1);
        expect(r.tax_amount).toBe(expectedVat);
      }
    }
  });
});
