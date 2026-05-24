/**
 * 🛡️ 2026-05-23: 상품 결제 흐름 단일 진실원천 (SSOT).
 *
 * 배경:
 *   voucher (교환권) vs 일반 공구 상품 vs 일반 쇼핑 상품의 결제 흐름이
 *   ProductDetailPage / GroupBuyDetailPage / LiveCheckoutSheet / CheckoutPage 등
 *   여러 파일에 분산돼 있어 한 곳 변경 시 다른 곳 회귀 발생.
 *
 * 이상적 architecture:
 *   상품 1개 입력 → getProductFlow() → 단일 'voucher_deal' / 'group_buy_toss' /
 *   'standard_checkout' 분류 → FLOW_PATHS 가 detail / api / payment / success path 제공.
 *
 * 모든 caller 가 이 helper 만 호출 → 새 카테고리 / flow 추가 시 본 파일 1곳 수정.
 */

export type ProductFlow =
  | 'voucher_deal'         // 교환권 — 딜 결제, 즉시 발급, /my-vouchers 이동
  | 'group_buy_toss'       // 공동구매 (일반 상품) — Toss 결제, 배송, voucher 발급
  | 'standard_checkout'    // 일반 쇼핑 — Toss 결제, 배송, 장바구니 지원

export interface ProductFlowInput {
  category?: string | null
  /** 1 = voucher-style 강제 (deal 결제만). DB row 의 deal_only 컬럼. */
  deal_only?: number | null
  /** 'active' = 공구 활성 — Toss 결제 흐름. DB row 의 group_buy_status 컬럼. */
  group_buy_status?: string | null
}

/**
 * 상품 정보를 받아 결제 흐름 type 반환.
 *
 * 🛡️ 2026-05-23 v3 (사용자 정의 확정):
 *   - "교환권" = `deal_only=1` (단일 마커). VouchersPage 필터와 정합.
 *   - voucher category 만으로는 voucher 아님 — 같은 category (meal_voucher 등) 가
 *     공구 상품의 할인권 형태로 쓰일 수 있음 (예: 김밥천국 할인권 = 공구, Toss 결제).
 *
 * 분류:
 *   1. `deal_only=1` → 'voucher_deal' (딜 결제, /vouchers/:id)
 *   2. `group_buy_status='active'` → 'group_buy_toss' (Toss, /group-buy/:id)
 *   3. 그 외 → 'standard_checkout' (Toss, /product/:id)
 */
export function getProductFlow(product: ProductFlowInput): ProductFlow {
  if (product.deal_only === 1) {
    return 'voucher_deal'
  }
  if (product.group_buy_status === 'active') {
    return 'group_buy_toss'
  }
  return 'standard_checkout'
}

/**
 * 흐름별 path / API / payment method 매핑.
 * 모든 caller 가 이걸 참조 → 흐름 변경 시 1곳 수정.
 */
export const FLOW_CONFIG: Record<ProductFlow, {
  /** 상품 detail 페이지 URL */
  detailPath: (productId: string | number) => string
  /** join / order API path */
  apiPath: (productId: string | number) => string
  /** 결제 수단 (server 에 보낼 payment_method 필드) */
  paymentMethod: 'deal' | 'toss'
  /** 결제 성공 후 redirect 할 URL */
  successPath: string
  /** 사용자에게 보일 버튼 라벨 */
  buttonLabel: string
}> = {
  voucher_deal: {
    detailPath: id => `/vouchers/${id}`,
    apiPath: id => `/api/group-buy/join/${id}`,
    paymentMethod: 'deal',
    successPath: '/my-vouchers',
    buttonLabel: '🎁 딜로 교환하기',
  },
  group_buy_toss: {
    detailPath: id => `/group-buy/${id}`,
    apiPath: id => `/api/group-buy/join/${id}`,
    paymentMethod: 'toss',
    successPath: '/group-buy/confirm-payment',
    buttonLabel: '공구 참여하기',
  },
  standard_checkout: {
    detailPath: id => `/products/${id}`,
    apiPath: () => '/api/orders',
    paymentMethod: 'toss',
    successPath: '/payment/success',
    buttonLabel: '바로 구매',
  },
}

/** 편의 헬퍼: 상품 + 흐름 config 한 번에. */
export function resolveProductFlow(product: ProductFlowInput) {
  const flow = getProductFlow(product)
  return { flow, config: FLOW_CONFIG[flow] }
}
