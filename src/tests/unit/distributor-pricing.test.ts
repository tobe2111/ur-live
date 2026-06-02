import { describe, it, expect } from 'vitest';
import {
  distributorPrice,
  platformMargin,
  effectiveGrade,
  marginForGrade,
  resolveDistributorPrice,
  DEFAULT_GRADE_MARGINS,
} from '@/lib/distributor-pricing';

describe('distributor-pricing — 유통스타트 등급별 공급가', () => {
  it('distributorPrice: 제조사공급가 × (1+마진%)', () => {
    expect(distributorPrice(10000, 10)).toBe(11000); // A
    expect(distributorPrice(10000, 25)).toBe(12500); // D
    expect(distributorPrice(10000, 0)).toBe(10000); // SPECIAL(덤핑)
  });

  it('distributorPrice: 반올림(원 단위) + 음수/NaN 방어', () => {
    expect(distributorPrice(9999, 15)).toBe(Math.round(9999 * 1.15)); // 11499
    expect(distributorPrice(-100, 10)).toBe(0);
    expect(distributorPrice(10000, NaN)).toBe(10000);
  });

  it('platformMargin = 유통사공급가 − 제조사공급가', () => {
    expect(platformMargin(10000, 10)).toBe(1000);
    expect(platformMargin(10000, 0)).toBe(0);
  });

  it('effectiveGrade: 특별할인 기간 안이면 SPECIAL', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(effectiveGrade({ grade: 'B', specialUntil: future })).toBe('SPECIAL');
    expect(effectiveGrade({ grade: 'B', specialUntil: past })).toBe('B');
    expect(effectiveGrade({ grade: 'A', specialUntil: null })).toBe('A');
  });

  it('effectiveGrade: 미배정/잘못된 등급 → 기본 D(고마진 보수적)', () => {
    expect(effectiveGrade({ grade: null })).toBe('D');
    expect(effectiveGrade({ grade: 'ZZZ' })).toBe('D');
    expect(effectiveGrade({ grade: 'oem' })).toBe('OEM');
  });

  it('marginForGrade: 테이블 우선, 없으면 기본값', () => {
    expect(marginForGrade('A')).toBe(DEFAULT_GRADE_MARGINS.A);
    expect(marginForGrade('A', [{ grade: 'A', margin_pct: 7 }])).toBe(7);
    expect(marginForGrade('UNKNOWN')).toBe(DEFAULT_GRADE_MARGINS.D); // fallback
  });

  it('resolveDistributorPrice: 전 과정 통합', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    // 일반 B 등급
    const b = resolveDistributorPrice({ baseSupplyPrice: 10000, grade: 'B' });
    expect(b.grade).toBe('B');
    expect(b.marginPct).toBe(DEFAULT_GRADE_MARGINS.B);
    expect(b.price).toBe(11500);
    expect(b.margin).toBe(1500);
    // 특별할인 기간 → SPECIAL 으로 덮임
    const s = resolveDistributorPrice({ baseSupplyPrice: 10000, grade: 'B', specialUntil: future });
    expect(s.grade).toBe('SPECIAL');
    expect(s.price).toBe(10000);
    expect(s.margin).toBe(0);
  });

  it('고등급일수록 저렴 (A < B < C < D)', () => {
    const base = 10000;
    const a = distributorPrice(base, DEFAULT_GRADE_MARGINS.A);
    const b = distributorPrice(base, DEFAULT_GRADE_MARGINS.B);
    const c = distributorPrice(base, DEFAULT_GRADE_MARGINS.C);
    const d = distributorPrice(base, DEFAULT_GRADE_MARGINS.D);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(d);
  });
});
