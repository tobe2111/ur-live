/**
 * 🛡️ 2026-05-31: 도매→소매 공급(B2B) 판매 정산 분배 로직.
 *
 * 외부 도매상(공급자)의 공급상품을 소매 셀러가 자기 소매가로 판매했을 때,
 * 소매가(retail)를 공급자/셀러/플랫폼 3방향으로 분배. (D2: 결제 시 즉시 split)
 *
 * 분배 식 (D3 기본 = 마진 기준 수수료):
 *   supplier_amount = supply_price                       (공급자: 공급가 그대로 — 반올림 없음)
 *   gross_margin    = retail - supply_price              (셀러 총마진)
 *   platform_amount = floor(gross_margin * platform_rate / 100)   (마진에만 수수료)
 *   seller_amount   = gross_margin - platform_amount     (잔돈은 셀러에게)
 *
 * D3 대안 (feeOnFullRetail=true): 수수료를 소매가 전체 기준으로:
 *   platform_amount = floor(retail * platform_rate / 100)
 *   seller_amount   = retail - supply_price - platform_amount
 *
 * 보장:
 *   supplier_amount + seller_amount + platform_amount === retail (총합 일치)
 *   각 금액 >= 0 (retail < supply_price 면 0 으로 클램프 — register 단계서 이미 차단)
 */

export interface SupplySplitInput {
  /** 소매가 라인 총액 (원, integer) — 고객이 이 상품에 지불한 금액 */
  retail_amount: number;
  /** 공급가 (원, integer) — 공급자(도매상)에게 갈 금액 */
  supply_price: number;
  /** 플랫폼 수수료율 (%, default 5) */
  platform_rate: number;
  /** D3 토글: true 면 소매가 전체 기준 수수료, false(기본) 면 셀러 마진 기준 */
  feeOnFullRetail?: boolean;
}

export interface SupplySplitResult {
  retail_amount: number;
  supplier_amount: number;
  seller_amount: number;
  platform_amount: number;
  /** 셀러 총마진 (수수료 차감 전) — 참고용 */
  gross_margin: number;
  rate_snapshot: number;
}

const PLATFORM_DEFAULT_RATE = 5;

export function calcSupplySplit(input: SupplySplitInput): SupplySplitResult {
  const retail = Math.max(0, Math.floor(input.retail_amount));
  const platformRate = clampRate(input.platform_rate ?? PLATFORM_DEFAULT_RATE, 0, 100);
  // 공급가는 소매가를 넘을 수 없음 (register 에서 seller_price >= supply_price 강제). 방어적 클램프.
  const supplierAmount = Math.max(0, Math.min(Math.floor(input.supply_price), retail));
  const grossMargin = retail - supplierAmount;

  const platformAmount = input.feeOnFullRetail
    ? Math.min(grossMargin, Math.floor((retail * platformRate) / 100))
    : Math.floor((grossMargin * platformRate) / 100);
  const sellerAmount = grossMargin - platformAmount; // 잔돈은 셀러에게

  return {
    retail_amount: retail,
    supplier_amount: supplierAmount,
    seller_amount: sellerAmount,
    platform_amount: platformAmount,
    gross_margin: grossMargin,
    rate_snapshot: platformRate,
  };
}

function clampRate(rate: number, min: number, max: number): number {
  if (!Number.isFinite(rate)) return min;
  return Math.max(min, Math.min(max, rate));
}
