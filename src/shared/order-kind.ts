/**
 * 🧾 **주문 한 건의 종류** — 배송 주문관리가 이용권을 택배처럼 그리던 것을 끊는 SSOT.
 *
 * ## 왜 생겼나 (2026-09-21 대표 신고)
 * 라이브 주문 89(이용권 "테스트1")를 셀러 주문관리에서 열면 **배송 정보**가 빈 칸 셋으로 뜨고
 * (이용권엔 배송지가 없으니 `shipping_name`·`shipping_phone` 이 `null`),
 * 셀러가 누를 수 있는 버튼은 `"준비중"으로 변경` → `발송` → `배송 완료` 뿐이었다.
 * 정작 이 주문이 실제로 처리되는 자리(`/seller/scan` 사용처리)로 가는 길은 그 화면에 없었다.
 *
 * 어드민은 더 고약했다 — '종류' 칸이 **이미 있는데 판정이 틀렸다**:
 * `isVoucherCategory(category)` 하나로 갈라서 `meal_voucher` 를 **"교환권"** 이라고 불렀다.
 * 그건 이용권이다(`deal_only=0`, 카드 결제). 교환권은 `deal_only=1`(기프티콘·KT, 딜 결제)이고
 * 전혀 다른 물건이다 — CLAUDE.md 명칭 SSOT 가 못 박아 둔 구분이다.
 *
 * ## 판정을 새로 만들지 않는다
 * 이 파일은 **`getNoShippingKind()`(`product-flow.ts`)를 그대로 쓴다.** 그 함수는 2026-09-01 에
 * *"배송비·배송지 판정의 단일 진실원천"* 으로 만들어졌고, 주문관리가 묻는 질문
 * (*"이 주문에 배송이 있나"*)이 정확히 같은 질문이다. 판정을 한 벌 더 만들면 장바구니가
 * 배송비 0원이라고 한 주문을 주문관리가 택배로 그리는 날이 온다 — 그게 저 함수가 생긴 이유다.
 *
 * ⚠️ **`group_buy_status` 로 분류하지 않는다** — migration 0146 이 모든 상품을 DEFAULT `'active'`
 * 로 만들어서 쇼핑 상품까지 공구로 잡힌다(`canonical-detail-path` 주석이 경고하는 그 함정).
 */

import { getNoShippingKind, type ProductFlowInput } from './product-flow'

export type OrderKind = 'deal' | 'voucher' | 'shipping'

/**
 * 주문의 상품 라인들로 종류를 정한다.
 *
 * 🔒 **모르면 배송이다.** 라인을 못 읽었거나(`[]`) 하나라도 배송 상품이 섞였으면 `'shipping'` —
 * 운송장·배송지 UI 를 **지우는** 쪽이 위험하기 때문이다. 이용권을 배송으로 그리면 화면이 이상하지만,
 * 배송 주문에서 운송장 칸을 지우면 셀러가 **송장을 넣을 방법이 없어진다.**
 */
export function orderKindOfItems(items: ProductFlowInput[]): OrderKind {
  if (items.length === 0) return 'shipping'
  let first: 'deal' | 'voucher' | null = null
  for (const it of items) {
    const kind = getNoShippingKind(it)
    if (kind === null) return 'shipping'
    if (first === null) first = kind
  }
  return first ?? 'shipping'
}

/** 서버가 실어 보낸 값을 화면이 읽을 때 — 값이 없으면(구 응답·enrich 실패) 배송으로 떨어진다. */
export function orderKindOf(raw: unknown): OrderKind {
  return raw === 'voucher' || raw === 'deal' ? raw : 'shipping'
}

/** 배송이 없는 주문인가 — 운송장·배송지·배송 상태 전이를 감출지 이 하나로 정한다. */
export function isNoShippingOrder(kind: OrderKind): boolean {
  return kind !== 'shipping'
}

export interface OrderKindMeta {
  /** 배지에 찍히는 이름. 명칭 SSOT(CLAUDE.md) — 이용권 ≠ 교환권. */
  label: string
  /** 셀러가 무엇을 해야 하는지 한 줄. 배송이 없는 주문은 "기다릴 것"이 다르다. */
  hint: string
  icon: 'ticket' | 'gift' | 'package'
}

export const ORDER_KIND_META: Record<OrderKind, OrderKindMeta> = {
  voucher: { label: '이용권', hint: '손님이 매장에서 사용합니다 · 배송 없음', icon: 'ticket' },
  deal: { label: '교환권', hint: '휴대폰으로 발송됩니다 · 배송 없음', icon: 'gift' },
  shipping: { label: '상품', hint: '택배 배송', icon: 'package' },
}
