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

import { isVoucherCategory } from './constants/voucher-categories'

// 🏷️ 명칭 주의 (2026-08-03): **교환권 ≠ 이용권.**
//   교환권 = 기프티콘·KT (`deal_only=1`) → 딜 결제
//   이용권 = 식당·뷰티·숙박 매장권 (`meal_voucher` 등 카테고리) → **카드 결제**(group_buy_toss)
//   카테고리 이름에 `_voucher` 가 붙는다고 딜 결제가 아니다 — 이 혼동이 실제 오판을 낳았다.
export type ProductFlow =
  | 'voucher_deal'         // 교환권(deal_only=1) — 딜 결제, 즉시 발급, /my-gifticons 이동
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
 * 📦 배송이 없는 상품인가 — **배송비·배송지 판정의 단일 진실원천** (2026-09-01 신설).
 *
 * ■ 왜 만들었나
 *   같은 판정이 CartPage 와 CheckoutPage 에 **따로** 적혀 있었고 둘이 갈라졌다.
 *   CheckoutPage 는 2026-06-22 에 `이용권 카테고리도 비배송` 으로 넓혔는데 CartPage 는
 *   `deal_only===1` 에 머물러, 같은 장바구니가 **장바구니에선 배송비 6,000원 · 결제 화면에선 0원**
 *   이었다(2026-09-01 프리뷰 하네스로 실제 재현). 합계가 결제 직전에 줄어드는 화면은
 *   깎아 준 것도 아니고 틀린 것도 아닌, 그냥 못 믿을 화면이다.
 *
 * ■ 두 가지 비배송
 *   · 교환권(`deal_only=1`) — 휴대폰으로 온다(배송이 아니라 발송)
 *   · 이용권(`meal_voucher` 등) — 아무것도 오지 않는다. 매장에서 쓴다
 *   문구는 다르지만 **배송비가 0 이라는 결론은 같다.**
 */
export function isNoShippingProduct(p: ProductFlowInput): boolean {
  return getNoShippingKind(p) !== null
}

/**
 * 비배송이라면 **어떤 종류**인가 — 화면 문구가 이 값으로 갈린다.
 *   'deal'    교환권: 휴대폰으로 온다 → "휴대폰 즉시 발송 (무료)"
 *   'voucher' 이용권: 아무것도 오지 않는다 → "매장에서 사용 (배송 없음)"
 * 문구를 고르려고 `deal_only === 1` 을 화면에서 다시 쓰기 시작하면 판정이 또 갈라진다.
 */
export function getNoShippingKind(p: ProductFlowInput): 'deal' | 'voucher' | null {
  if (Number(p.deal_only) === 1) return 'deal'
  if (isVoucherCategory(p.category ?? undefined)) return 'voucher'
  return null
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
    // 🎟️ 2026-08-31 (대표 — 지갑 분리): 교환권은 교환권 보관함으로. 이용권 지갑(/my-vouchers)이 아니다.
    successPath: '/my-gifticons',
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

/**
 * 🧭 2026-06-22: 상품의 정규(canonical) 상세 페이지 경로.
 *   /products/:id 직접 진입 시 종류에 맞는 페이지로 정렬하기 위한 라우팅 SSOT.
 *     - 교환권(deal_only=1)        → /vouchers/:id (딜 결제 전용 UI)
 *     - 숙소(stay_voucher)         → /stays/:id (객실·날짜 예약 UI — 2026-07-20 신설, 아래 주석)
 *     - 공구(voucher 카테고리)       → /group-buy/:id (홈 피드/동네딜 리스트가 링크하는 정규 페이지)
 *     - 온라인 일반 상품             → null (/products/:id 가 이미 정규 → redirect 불요)
 *   ⚠️ group_buy_status 로 분류 금지(migration 0146 에서 모든 상품 DEFAULT 'active') —
 *      deal_only + isVoucherCategory SSOT 만 사용 (order-type.ts / voucher-categories.ts 와 동일 기준).
 *   🏨 2026-07-20 (숙소 상세 SSOT — 대표 "더 이상적으로"): 숙소는 객실/날짜/예약이 있는 /stays/:id 가
 *      정식 상세인데 홈 피드·지도가 일반 딜 상세로 보내 진입점마다 다른 상세가 뜨던 것 정규화.
 *      stay_info 미보유 stay_voucher(안전판)는 StayDetailPage 가 /group-buy/:id 로 폴백(단방향 — 루프 0).
 */
export function canonicalDetailPath(p: {
  id: string | number
  deal_only?: number | string | null
  category?: string | null
}): string | null {
  if (Number(p.deal_only) === 1) return FLOW_CONFIG.voucher_deal.detailPath(p.id)
  if (p.category === 'stay_voucher') return `/stays/${p.id}`
  if (isVoucherCategory(p.category)) return FLOW_CONFIG.group_buy_toss.detailPath(p.id)
  return null
}
