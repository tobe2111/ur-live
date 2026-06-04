import { describe, it, expect } from 'vitest';
import {
  distributorPrice,
  platformMargin,
  effectiveGrade,
  marginForGrade,
  resolveDistributorPrice,
  qtyTierDiscount,
  tierUnitPrice,
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

  it('effectiveGrade: 미배정/잘못된 등급 → 기본 C(스펙: 가입 시 자동 C등급)', () => {
    expect(effectiveGrade({ grade: null })).toBe('C');
    expect(effectiveGrade({ grade: 'ZZZ' })).toBe('C');
    expect(effectiveGrade({ grade: 'oem' })).toBe('OEM');
  });

  it('marginForGrade: 테이블 우선, 없으면 기본값', () => {
    expect(marginForGrade('A')).toBe(DEFAULT_GRADE_MARGINS.A);
    expect(marginForGrade('A', [{ grade: 'A', margin_pct: 7 }])).toBe(7);
    expect(marginForGrade('UNKNOWN')).toBe(DEFAULT_GRADE_MARGINS.C); // fallback = 기본 등급(C)
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

  it('상품별 마진 override(고정): 등급/특별 무관 동일 마진 적용', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    // override 12% → 등급 무관 base×1.12
    const a = resolveDistributorPrice({ baseSupplyPrice: 10000, grade: 'A', marginOverridePct: 12 });
    const d = resolveDistributorPrice({ baseSupplyPrice: 10000, grade: 'D', marginOverridePct: 12 });
    expect(a.overridden).toBe(true);
    expect(a.price).toBe(11200);
    expect(a.marginPct).toBe(12);
    expect(d.price).toBe(11200); // 등급 달라도 동일가
    // override 는 특별할인 기간보다 우선(고정가)
    const s = resolveDistributorPrice({ baseSupplyPrice: 10000, grade: 'B', specialUntil: future, marginOverridePct: 12 });
    expect(s.price).toBe(11200);
    expect(s.overridden).toBe(true);
  });

  it('override 미설정/잘못된 값 → 기존 등급 마진 fallback', () => {
    const none = resolveDistributorPrice({ baseSupplyPrice: 10000, grade: 'B', marginOverridePct: null });
    expect(none.overridden).toBe(false);
    expect(none.price).toBe(11500); // B 등급 그대로
    const neg = resolveDistributorPrice({ baseSupplyPrice: 10000, grade: 'B', marginOverridePct: -5 });
    expect(neg.overridden).toBe(false); // 음수 무시
    expect(neg.price).toBe(11500);
    const zero = resolveDistributorPrice({ baseSupplyPrice: 10000, grade: 'B', marginOverridePct: 0 });
    expect(zero.overridden).toBe(true); // 0% = 유효(마진 0, 덤핑)
    expect(zero.price).toBe(10000);
  });

  it('수량 구간 할인: qty 이상 만족하는 최대 tier 할인 적용', () => {
    const tiers = [{ min_qty: 100, discount_pct: 5 }, { min_qty: 500, discount_pct: 10 }];
    expect(qtyTierDiscount(20, tiers)).toBe(0);    // 구간 미달
    expect(qtyTierDiscount(100, tiers)).toBe(5);   // 100개~
    expect(qtyTierDiscount(499, tiers)).toBe(5);
    expect(qtyTierDiscount(500, tiers)).toBe(10);  // 500개~
    expect(qtyTierDiscount(9999, tiers)).toBe(10);
    expect(qtyTierDiscount(100, null)).toBe(0);    // tier 없음
    expect(qtyTierDiscount(100, [])).toBe(0);
  });

  it('tierUnitPrice: 등급가 × (1 − 구간할인), 원 반올림', () => {
    const tiers = [{ min_qty: 100, discount_pct: 5 }, { min_qty: 500, discount_pct: 10 }];
    expect(tierUnitPrice(10000, 20, tiers)).toBe(10000);  // 할인 없음
    expect(tierUnitPrice(10000, 100, tiers)).toBe(9500);  // 5%
    expect(tierUnitPrice(10000, 500, tiers)).toBe(9000);  // 10%
    expect(tierUnitPrice(9999, 100, tiers)).toBe(Math.round(9999 * 0.95));
    expect(tierUnitPrice(10000, 100, [])).toBe(10000);    // tier 없음 = 등급가 불변
    // discount 90 초과는 90 으로 클램프
    expect(tierUnitPrice(10000, 1, [{ min_qty: 1, discount_pct: 99 }])).toBe(1000);
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
