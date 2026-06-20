/**
 * 🛡️ 2026-06-18: 주문 종류 분류 SSOT (주문내역 종류 탭 — 상품 / 교환권 / 공구).
 *
 * 배경: 한 `orders` 테이블에 쇼핑 상품 / 교환권 / 공구권이 모두 들어옴
 *   (group-buy.routes.ts 가 교환권·공구 결제도 INSERT INTO orders).
 *   `/my-orders` 는 종류 필터 없이 전부 노출 → 종류별 탭/카드 분기가 필요.
 *
 * ⚠️ 분류 신호 (2026-06-18 정정 — group_buy_status 사용 금지):
 *   `group_buy_status` 는 migration 0146 에서 `DEFAULT 'active'` 로 추가됨 → **모든 상품
 *   (일반 쇼핑 포함)이 기본 'active'** 라 종류 구분에 못 씀(쓰면 거의 다 공구로 오분류).
 *   서비스 전체가 쓰는 SSOT 신호로 통일:
 *     - deal_only=1                  → 교환권 (voucher_deal — 즉시 딜 결제)
 *     - isVoucherCategory(category)  → 공구   (오프라인 동네 공구 — voucher 카테고리)
 *     - 그 외(온라인 일반 상품)        → 상품   (standard_checkout)
 *   근거: group-buy 피드는 `category IN voucher_categories`, 교환권은 `deal_only=1`,
 *   쇼핑은 online(non-voucher) 으로 거름. voucher-categories.ts 가 SSOT.
 *
 * 의존성: voucher-categories.ts(상수 SSOT) — worker(상대 import) / 프론트(@/) 양쪽 사용.
 */

import { isVoucherCategory } from './constants/voucher-categories'

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
  if (items.some(it => isVoucherCategory(it?.category))) return 'groupbuy'
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
