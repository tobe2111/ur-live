import { describe, it, expect } from 'vitest';
import { resolveDistributorPrice, DEFAULT_PLATFORM_MARGIN_PCT } from '@/lib/distributor-pricing';
import { splitWholesaleUnit } from '@/features/supply/api/wholesale-settlement';

// 🧾 2026-06-17 (대표 확정): 공급가 + 플랫폼 마진(기본 10%, 조율 가능). **등급은 가격에 영향 X**(노출 큐레이션 전용).
//   정산: 제조사 = 공급원가 전액, 플랫폼 = 공급가 − 공급원가. → 모든 등급 동일가(단일가).
describe('도매 가격/정산 (단일가 cost-plus)', () => {
  const cost = 10000;   // 제조사가 받을 금액(supply_price)
  const retail = 20000; // 판매가(권장소비자가) — 표시·상한용

  it('기본 마진 10% — 모든 등급 동일가 + 정산', () => {
    expect(DEFAULT_PLATFORM_MARGIN_PCT).toBe(10);
    for (const grade of ['C', 'B', 'A'] as const) {
      const r = resolveDistributorPrice({ baseSupplyPrice: cost, retailPrice: retail, grade });
      expect(r.price).toBe(11000);   // 공급가 = 10,000 × 1.1 (등급 무관 동일)
      expect(r.margin).toBe(1000);   // 플랫폼 = 공급가 − 공급원가
      const { manufacturerUnit, platformUnit } = splitWholesaleUnit(r.price, cost);
      expect(manufacturerUnit).toBe(cost);  // 제조사 = 입력 공급원가 전액
      expect(platformUnit).toBe(1000);
      expect(manufacturerUnit + platformUnit).toBe(r.price); // 누수 0
    }
  });

  it('마진 조율 — 상품별 override 40% (등급 무관 동일가)', () => {
    for (const grade of ['C', 'B', 'A'] as const) {
      const r = resolveDistributorPrice({ baseSupplyPrice: cost, retailPrice: retail, grade, marginOverridePct: 40 });
      expect(r.price).toBe(14000);   // 10,000 × 1.4
      expect(r.margin).toBe(4000);
      expect(retail - r.price).toBe(6000); // 판매사 마진 = 판매가 − 공급가
      expect(splitWholesaleUnit(r.price, cost).manufacturerUnit).toBe(cost);
    }
  });

  it('마진 조율 — 전역 기본(defaultPlatformMarginPct 25%)', () => {
    const r = resolveDistributorPrice({ baseSupplyPrice: cost, retailPrice: retail, grade: 'C', defaultPlatformMarginPct: 25 });
    expect(r.price).toBe(12500); // 25% (제품별 미설정 → 전역값)
    expect(r.margin).toBe(2500);
  });

  it('판매가 상한: 공급가가 판매가를 넘지 않음(판매사 마진 음수 차단)', () => {
    const r = resolveDistributorPrice({ baseSupplyPrice: 10000, retailPrice: 12000, grade: 'C', marginOverridePct: 50 });
    expect(r.price).toBe(12000); // round(10000×1.5)=15000 > 12000 → 12000
    expect(r.margin).toBe(2000);
  });
});
