import { describe, it, expect } from 'vitest';
import { distributorPriceFromRetail, DEFAULT_GRADE_MARGINS } from '@/lib/distributor-pricing';
import { splitWholesaleUnit } from '@/features/supply/api/wholesale-settlement';

// 🧾 2026-06-16 도매 정산 E2E 시나리오 — docs/WHOLESALE_SETTLEMENT_E2E.md 의 표와 1:1 잠금.
//   판매가 → 등급 공급가(distributorPriceFromRetail) → 정산 분배(splitWholesaleUnit, 플랫폼 수수료 10%).
//   문서 숫자가 코드와 절대 어긋나지 않게 함(둘 중 하나만 바뀌면 이 테스트가 깨져 동기화를 강제).
describe('도매 정산 E2E 시나리오 (문서 표 잠금)', () => {
  const cost = 10000;   // 제조사 원가 (supply floor)
  const retail = 20000; // 판매가(권장소비자가)
  const comm = 10;      // 플랫폼 수수료 %

  const cases = [
    { grade: 'C', label: '일반',     margin: 15, supply: 17000, manuf: 15300, plat: 1700 },
    { grade: 'B', label: '프로',     margin: 30, supply: 14000, manuf: 12600, plat: 1400 },
    { grade: 'A', label: '프리미엄', margin: 38, supply: 12400, manuf: 11160, plat: 1240 },
  ] as const;

  it.each(cases)('판매가 20,000 / 원가 10,000 · $label($grade) 마진 $margin%', (cs) => {
    expect(DEFAULT_GRADE_MARGINS[cs.grade]).toBe(cs.margin);
    // 공급가(유통사 단가) = max(원가, round(판매가 × (1 − 마진%)))
    const supply = distributorPriceFromRetail(retail, cost, cs.margin);
    expect(supply).toBe(cs.supply);
    // 정산: 제조사 = max(원가, round(공급가 × 90%)), 플랫폼 = 공급가 − 제조사 (= 공급가 × 10%)
    const { manufacturerUnit, platformUnit } = splitWholesaleUnit(supply, cost, comm);
    expect(manufacturerUnit).toBe(cs.manuf);
    expect(platformUnit).toBe(cs.plat);
    expect(manufacturerUnit + platformUnit).toBe(supply);  // 합 = 공급가 (누수 0)
    expect(manufacturerUnit).toBeGreaterThanOrEqual(cost);  // 제조사 원가 이상 보장
  });

  it('원가 하한 바인딩: 판매가가 낮으면 공급가=원가, 플랫폼=0 (degenerate 안전 — 손실 차단)', () => {
    const supply = distributorPriceFromRetail(11000, 10000, 38); // round(11000×0.62)=6820 < 10000 → 10000
    expect(supply).toBe(10000);
    const { manufacturerUnit, platformUnit } = splitWholesaleUnit(supply, 10000, comm);
    expect(manufacturerUnit).toBe(10000); // round(10000×0.9)=9000 < 10000 floor → 10000
    expect(platformUnit).toBe(0);         // 플랫폼 마진 0 (원가 보호 우선)
  });
});
