/**
 * 📦 상품별 **픽업 여부** 배치 조회 (2026-08-11).
 *
 * 배송비 판정(`allItemsNoShipping`)에 필요한 `has_pickup` 을 만드는 유일한 자리다.
 * 주문 생성과 견적이 **같은 값**을 봐야 화면과 청구가 갈리지 않아서, 두 호출부가 이 함수를 공유한다.
 *
 * ⚠️ `products.id` 는 코드 곳곳에서 문자열/숫자가 섞인다 — 메타 Map 의 키는 **숫자**라
 *   여기서 한 번에 `Number()` 로 맞춘다(호출부마다 캐스팅하다 한 곳을 빠뜨리면 그 상품만 조용히
 *   배송비가 붙는다).
 * ⚠️ 조회 실패는 **빈 Set**(= 픽업 아님) — 배송비를 물리는 쪽이 안전하다(과소청구 방지).
 */
import { getSupplyMeta } from './product-supply-meta'
import { parsePickup, isEmptyPickup } from '../../shared/pickup'
import { allItemsNoShipping, type ShippingItemLike } from '../../shared/order-type'

/** 배송비 판정 입력 — `id` 로 픽업을 찾고 나머지는 그대로 SSOT 에 넘긴다. */
export interface ShippingRow extends ShippingItemLike {
  id?: number | string | null
}

export async function loadPickupIds(
  DB: D1Database,
  productIds: Array<number | string | null | undefined>,
): Promise<Set<number>> {
  const ids = productIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
  const out = new Set<number>()
  if (ids.length === 0) return out
  const meta = await getSupplyMeta(DB, ids).catch(() => null)
  if (!meta) return out
  for (const id of ids) if (!isEmptyPickup(parsePickup(meta.get(id) ?? null))) out.add(id)
  return out
}

/**
 * 품목 하나씩 물어보는 판정기(견적처럼 **그룹별로 누적**해야 할 때).
 * 픽업 조회는 **한 번**만 한다 — 호출부가 루프 안에서 DB 를 때리지 않게.
 */
export async function loadNoShippingCheck(
  DB: D1Database,
  productIds: Array<number | string | null | undefined>,
): Promise<(row: ShippingRow) => boolean> {
  const pick = await loadPickupIds(DB, productIds)
  return (row) => allItemsNoShipping([{ ...row, has_pickup: pick.has(Number(row?.id)) }])
}

/** 주문 하나가 통째로 비배송인가(주문 생성 경로). 견적과 **같은 판정**을 쓴다. */
export async function resolveNoShipping(DB: D1Database, rows: readonly ShippingRow[]): Promise<boolean> {
  const pick = await loadPickupIds(DB, rows.map((r) => r?.id))
  return allItemsNoShipping(rows.map((r) => ({ ...r, has_pickup: pick.has(Number(r?.id)) })))
}
