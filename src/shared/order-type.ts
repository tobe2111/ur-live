/**
 * 🛡️ 2026-06-18: 주문 종류 분류 SSOT (주문내역 종류 탭 — 상품 / 교환권 / 공구).
 *
 * 배경: 한 `orders` 테이블에 쇼핑 상품 / 교환권 / 공구권이 모두 들어옴
 *   (group-buy.routes.ts 가 교환권·공구 결제도 INSERT INTO orders).
 *   `/my-orders` 는 종류 필터 없이 전부 노출 → 종류별 탭/카드 분기가 필요.
 *
 * product-flow.ts(결제흐름 SSOT)와 정합한 신호 사용:
 *   - deal_only=1            → 교환권 (voucher_deal)
 *   - group_buy_status 존재  → 공구   (group_buy_toss — 완료/만료 후에도 마커 유지)
 *   - 그 외                  → 상품   (standard_checkout)
 *
 * ⚠️ product-flow 의 getProductFlow() 는 group_buy_status==='active' 만 보지만,
 *    그건 "지금 결제 가능한가" 판단용. 주문내역은 과거 주문(완료/만료 공구)도
 *    공구로 분류해야 하므로 여기선 값이 있으면(비어있지 않으면) 공구로 본다.
 *
 * 의존성 없음(self-contained) — worker(상대 import) / 프론트(@/ alias) 양쪽에서 사용.
 */

export type OrderKind = 'product' | 'voucher' | 'groupbuy'

interface OrderItemLike {
  deal_only?: number | string | null
  group_buy_status?: string | null
  category?: string | null
}

interface OrderLike {
  items?: OrderItemLike[] | null
}

/** 주문 1건의 종류를 반환. 우선순위: 교환권 > 공구 > 상품. */
export function getOrderKind(order: OrderLike): OrderKind {
  const items = Array.isArray(order?.items) ? order.items : []
  if (items.some(it => Number(it?.deal_only) === 1)) return 'voucher'
  if (items.some(it => {
    const s = it?.group_buy_status
    return s != null && String(s).trim() !== ''
  })) return 'groupbuy'
  return 'product'
}

/** 종류별 한국어 라벨 (명칭 SSOT 정합 — 사람 아닌 상품 종류라 그대로 사용). */
export const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  product: '상품',
  voucher: '교환권',
  groupbuy: '공구',
}

/** 배송이 있는 종류인가 (상품만 배송지/송장 노출). */
export function orderKindHasShipping(kind: OrderKind): boolean {
  return kind === 'product'
}
