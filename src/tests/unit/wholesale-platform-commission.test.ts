import { describe, it, expect } from 'vitest';
import { splitWholesaleUnit, DEFAULT_PLATFORM_COMMISSION_PCT } from '@/features/supply/api/wholesale-settlement';

// 🆕 2026-06-16 대표 모델: "공급가에 플랫폼 마진 N%가 포함".
//   제조사 = max(원가, round(공급가×(1−N/100))), 플랫폼 = 공급가 − 제조사.
describe('splitWholesaleUnit — 공급가 내 플랫폼 수수료 분배', () => {
  it('기본 10%: 공급가의 10%를 플랫폼, 나머지는 제조사 (원가 하한 비적용)', () => {
    // 대표 예시: 판매가 10,000 → 공급가 8,500(일반)/7,000(프로). 원가는 낮아 하한 미적용.
    const a = splitWholesaleUnit(8500, 5000, 10);
    expect(a.platformUnit).toBe(850);       // 8,500 × 10%
    expect(a.manufacturerUnit).toBe(7650);  // 8,500 − 850
    const b = splitWholesaleUnit(7000, 5000, 10);
    expect(b.platformUnit).toBe(700);
    expect(b.manufacturerUnit).toBe(6300);
  });

  it('원가 하한: 공급가×90% 가 원가보다 낮으면 제조사는 원가, 플랫폼은 줄어듦', () => {
    // 공급가 8,000, 원가 7,800 → 8000×0.9=7200 < 7800 → 제조사 7,800, 플랫폼 200(<10%).
    const r = splitWholesaleUnit(8000, 7800, 10);
    expect(r.manufacturerUnit).toBe(7800);
    expect(r.platformUnit).toBe(200);
    expect(r.manufacturerUnit + r.platformUnit).toBe(8000); // 합 = 공급가 보존
  });

  it('수수료 0%: 제조사가 공급가 전부, 플랫폼 0', () => {
    const r = splitWholesaleUnit(8500, 5000, 0);
    expect(r.manufacturerUnit).toBe(8500);
    expect(r.platformUnit).toBe(0);
  });

  it('합 보존 + 음수/범위 방어', () => {
    for (const [dist, cost, pct] of [[8500, 5000, 10], [7000, 6800, 10], [10000, 0, 90], [5000, 5000, 15]] as const) {
      const r = splitWholesaleUnit(dist, cost, pct);
      expect(r.manufacturerUnit + r.platformUnit).toBe(Math.floor(dist)); // 합 = 공급가
      expect(r.platformUnit).toBeGreaterThanOrEqual(0);
      expect(r.manufacturerUnit).toBeGreaterThanOrEqual(Math.min(Math.floor(dist), Math.floor(cost))); // 제조사 ≥ 원가(공급가 한도 내)
    }
    expect(splitWholesaleUnit(-100, 0, 10).platformUnit).toBe(0);
    // 잘못된 pct → 기본값으로 클램프(NaN→default)
    expect(splitWholesaleUnit(10000, 0, NaN).platformUnit).toBe(Math.round(10000 * DEFAULT_PLATFORM_COMMISSION_PCT / 100));
  });
});
