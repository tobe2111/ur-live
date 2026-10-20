/**
 * 🛡️ 2026-06-18: 주문 종류 분류 SSOT (주문내역 종류 탭 — 상품 / 교환권 / 공구).
 *
 * 배경: 한 `orders` 테이블에 쇼핑 상품 / 교환권 / 이용권이 모두 들어옴
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

/**
 * 📦 **이 품목에 배송이 없는가** — 배송비 부과 판정 SSOT (2026-08-11).
 *
 * 그전까지 이 규칙이 **세 벌**로 복제돼 있었다(`order.routes` 주문생성 · 같은 파일 견적 ·
 * `CheckoutPage`). 셋 다 `deal_only=1 || isVoucherCategory` 만 봤고, 그래서
 * **픽업 공구 상품에 배송비 3,000원이 붙었다** — 손님은 가지러 가는데 배송비를 낸다.
 * (운영자 몰의 픽업 상품은 물리 재화라 `deal_only` 도 이용권 카테고리도 아니다.)
 *
 * 🔴 **`has_pickup` 은 '픽업 정보가 있는가' 다** — 몰 상품인지로 가르지 않는다.
 *   그래야 본진 픽업 상품에도 그대로 맞고 몰 결합이 안 생긴다
 *   (`products.routes` 가 상세에 `pickup` 을 실을 때 쓴 것과 같은 원칙).
 */
export interface ShippingItemLike {
  deal_only?: number | string | null
  category?: string | null
  /** 픽업 정보 보유 여부. 파싱(`parsePickup`)은 호출부가 하고 여기엔 결과만 넘긴다. */
  has_pickup?: boolean | null
}

export function itemHasNoShipping(it: ShippingItemLike | null | undefined): boolean {
  if (!it) return false
  if (Number(it.deal_only) === 1) return true            // 교환권 — MMS 발송
  if (isVoucherCategory(it.category ?? null)) return true // 이용권 — 매장 사용
  return it.has_pickup === true                           // 픽업 공구 — 손님이 가지러 온다
}

/**
 * 주문(그룹) 전체가 비배송인가. **하나라도 배송이면 배송비를 받는다**(빈 목록은 false).
 * ⚠️ `every` 는 빈 배열에 true 를 주므로 길이 검사를 함께 둔다 — 이 실수가 실제로 있었다
 *   (픽스처에 항목이 없어 가드가 늘 통과하던 클래스).
 */
export function allItemsNoShipping(items: readonly ShippingItemLike[] | null | undefined): boolean {
  return Array.isArray(items) && items.length > 0 && items.every(itemHasNoShipping)
}
