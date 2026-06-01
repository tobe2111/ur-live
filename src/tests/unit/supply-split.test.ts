import { describe, it, expect } from 'vitest';
import { calcSupplySplit } from '@/lib/supply-split';

describe('calcSupplySplit — 도매→소매 공급 정산 분배', () => {
  it('마진 기준 수수료(기본): 공급가 정확 + 합계 일치', () => {
    // 소매가 10000, 공급가 7000, 마진 3000, 플랫폼 5% of margin = 150
    const r = calcSupplySplit({ retail_amount: 10000, supply_price: 7000, platform_rate: 5 });
    expect(r.supplier_amount).toBe(7000);
    expect(r.gross_margin).toBe(3000);
    expect(r.platform_amount).toBe(150);
    expect(r.seller_amount).toBe(2850);
    expect(r.supplier_amount + r.seller_amount + r.platform_amount).toBe(10000);
  });

  it('소매가 전체 기준 수수료(D3 대안)', () => {
    const r = calcSupplySplit({ retail_amount: 10000, supply_price: 7000, platform_rate: 5, feeOnFullRetail: true });
    expect(r.supplier_amount).toBe(7000);
    expect(r.platform_amount).toBe(500); // 10000 * 5%
    expect(r.seller_amount).toBe(2500);
    expect(r.supplier_amount + r.seller_amount + r.platform_amount).toBe(10000);
  });

  it('잔돈은 셀러에게 (floor 후 합계 보존)', () => {
    // 마진 3333, 5% = 166.65 → floor 166, 셀러 3167
    const r = calcSupplySplit({ retail_amount: 10333, supply_price: 7000, platform_rate: 5 });
    expect(r.platform_amount).toBe(166);
    expect(r.seller_amount).toBe(3167);
    expect(r.supplier_amount + r.seller_amount + r.platform_amount).toBe(10333);
  });

  it('공급가 = 소매가 (마진 0): 셀러/플랫폼 0', () => {
    const r = calcSupplySplit({ retail_amount: 7000, supply_price: 7000, platform_rate: 5 });
    expect(r.supplier_amount).toBe(7000);
    expect(r.seller_amount).toBe(0);
    expect(r.platform_amount).toBe(0);
  });

  it('방어: 공급가 > 소매가 면 공급가를 소매가로 클램프 (음수 방지)', () => {
    const r = calcSupplySplit({ retail_amount: 5000, supply_price: 7000, platform_rate: 5 });
    expect(r.supplier_amount).toBe(5000);
    expect(r.seller_amount).toBe(0);
    expect(r.platform_amount).toBe(0);
    expect(r.supplier_amount + r.seller_amount + r.platform_amount).toBe(5000);
  });

  it('공급가 0 (일반 상품): 플랫폼이 마진(=소매가) 기준 수수료', () => {
    const r = calcSupplySplit({ retail_amount: 10000, supply_price: 0, platform_rate: 5 });
    expect(r.supplier_amount).toBe(0);
    expect(r.platform_amount).toBe(500);
    expect(r.seller_amount).toBe(9500);
  });

  it('rate 비정상(NaN) → 0 으로 안전 클램프', () => {
    const r = calcSupplySplit({ retail_amount: 10000, supply_price: 7000, platform_rate: NaN });
    expect(r.platform_amount).toBe(0);
    expect(r.seller_amount).toBe(3000);
    expect(r.supplier_amount + r.seller_amount + r.platform_amount).toBe(10000);
  });
});
