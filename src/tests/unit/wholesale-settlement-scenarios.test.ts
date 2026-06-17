import { describe, it, expect } from 'vitest';
import { resolveDistributorPrice, gradeMarginMultiplier, DEFAULT_PLATFORM_MARGIN_PCT } from '@/lib/distributor-pricing';
import { splitWholesaleUnit } from '@/features/supply/api/wholesale-settlement';

// 🧾 2026-06-17 도매 정산 E2E 시나리오 (cost-plus) — docs/WHOLESALE_SETTLEMENT_E2E.md 표와 1:1 잠금.
//   제조사가(공급원가) 위에 플랫폼 마진%를 붙여 공급가 산출 → 정산: 제조사 = 공급원가 전액, 플랫폼 = 공급가 − 공급원가.
//   등급(유료) 배수로 고등급 판매사는 마진 인하 → 공급가 ↓ → 판매사 마진 ↑.
describe('도매 정산 cost-plus 시나리오 (문서 표 잠금)', () => {
  const cost = 10000;   // 제조사가 받을 금액(supply_price)
  const retail = 20000; // 판매가(권장소비자가) — 상한

  it('기본 플랫폼 마진 10% — 등급별 공급가/정산', () => {
    expect(DEFAULT_PLATFORM_MARGIN_PCT).toBe(10);
    const cases = [
      { grade: 'C', mult: 100, supply: 11000, plat: 1000 }, // 일반: 10% 그대로
      { grade: 'B', mult: 70,  supply: 10700, plat: 700 },  // 프로: 7%
      { grade: 'A', mult: 50,  supply: 10500, plat: 500 },  // 프리미엄: 5%
    ] as const;
    for (const cs of cases) {
      expect(gradeMarginMultiplier(cs.grade)).toBe(cs.mult);
      const r = resolveDistributorPrice({ baseSupplyPrice: cost, retailPrice: retail, grade: cs.grade });
      expect(r.price).toBe(cs.supply);
      expect(r.margin).toBe(cs.plat);
      const { manufacturerUnit, platformUnit } = splitWholesaleUnit(r.price, cost);
      expect(manufacturerUnit).toBe(cost);     // 제조사 = 입력가 전액
      expect(platformUnit).toBe(cs.plat);      // 플랫폼 = 공급가 − 공급원가
      expect(manufacturerUnit + platformUnit).toBe(r.price); // 누수 0
    }
  });

  it('제품별 플랫폼 마진 40%(스프레드 큰 상품) — 등급별', () => {
    const cases = [
      { grade: 'C', supply: 14000, plat: 4000, seller: 6000 }, // 40%
      { grade: 'B', supply: 12800, plat: 2800, seller: 7200 }, // 40×0.7=28%
      { grade: 'A', supply: 12000, plat: 2000, seller: 8000 }, // 40×0.5=20%
    ] as const;
    for (const cs of cases) {
      const r = resolveDistributorPrice({ baseSupplyPrice: cost, retailPrice: retail, grade: cs.grade, marginOverridePct: 40 });
      expect(r.price).toBe(cs.supply);
      expect(r.margin).toBe(cs.plat);
      expect(retail - r.price).toBe(cs.seller); // 판매사 마진 = 판매가 − 공급가
      expect(splitWholesaleUnit(r.price, cost).manufacturerUnit).toBe(cost);
    }
  });

  it('판매가 상한: 공급가가 판매가를 넘지 않음(판매사 마진 음수 차단)', () => {
    const r = resolveDistributorPrice({ baseSupplyPrice: 10000, retailPrice: 12000, grade: 'C', marginOverridePct: 50 });
    expect(r.price).toBe(12000); // round(10000×1.5)=15000 > 12000 → 12000
    expect(r.margin).toBe(2000);
  });

  it('전역 기본 마진은 어드민 조정 가능(defaultPlatformMarginPct 전달)', () => {
    const r = resolveDistributorPrice({ baseSupplyPrice: cost, retailPrice: retail, grade: 'C', defaultPlatformMarginPct: 25 });
    expect(r.price).toBe(12500); // 25% (제품별 미설정 → 전역값)
    expect(r.margin).toBe(2500);
  });
});
