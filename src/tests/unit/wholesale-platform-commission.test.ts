import { describe, it, expect } from 'vitest';
import { splitWholesaleUnit, DEFAULT_PLATFORM_COMMISSION_PCT } from '@/features/supply/api/wholesale-settlement';

// 🆕 2026-06-17 대표 확정 모델 (cost-plus): 공급가 = 제조사가(공급원가) + 플랫폼 마진(공급가 산출 단계에서 가산).
//   정산 분리는 단순: 제조사 = 공급원가 전액, 플랫폼 = 공급가 − 공급원가.
describe('splitWholesaleUnit — 제조사 전액 + 플랫폼 = 스프레드', () => {
  it('제조사 = 공급원가 전액, 플랫폼 = 공급가 − 공급원가', () => {
    // 공급원가 10,000 + 10% → 공급가 11,000.
    const a = splitWholesaleUnit(11000, 10000);
    expect(a.manufacturerUnit).toBe(10000); // 제조사 입력가 전액
    expect(a.platformUnit).toBe(1000);      // 11,000 − 10,000
    // 같은 상품에 플랫폼 마진 40% → 공급가 14,000.
    const b = splitWholesaleUnit(14000, 10000);
    expect(b.manufacturerUnit).toBe(10000);
    expect(b.platformUnit).toBe(4000);
  });

  it('합 보존: 제조사 + 플랫폼 = 공급가 (누수 0)', () => {
    for (const [dist, cost] of [[11000, 10000], [14000, 10000], [8000, 7800], [10000, 0]] as const) {
      const r = splitWholesaleUnit(dist, cost);
      expect(r.manufacturerUnit + r.platformUnit).toBe(Math.floor(dist));
      expect(r.platformUnit).toBeGreaterThanOrEqual(0);
    }
  });

  it('공급가 < 공급원가(degenerate) — 제조사는 공급가 한도, 플랫폼 0 (음수 차단)', () => {
    const r = splitWholesaleUnit(7000, 10000);
    expect(r.manufacturerUnit).toBe(7000); // min(10000, 7000)
    expect(r.platformUnit).toBe(0);
  });

  it('음수/범위 방어 + commPct 인자는 무시(공급가에 마진 내재)', () => {
    expect(splitWholesaleUnit(-100, 0).platformUnit).toBe(0);
    // commPct 를 줘도 결과 동일(시그니처 호환용 — 분리에는 미사용).
    expect(splitWholesaleUnit(11000, 10000, 90)).toEqual(splitWholesaleUnit(11000, 10000));
    expect(DEFAULT_PLATFORM_COMMISSION_PCT).toBe(10);
  });
});
