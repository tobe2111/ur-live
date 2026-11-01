/**
 * 🧷 유어샵 진열 핀의 **분류 키**와 **칩·정렬 줄이 뜨는 조건** — 화면과 워커가 같이 쓰는 순수 SSOT.
 *
 * ## 왜 여기로 뺐나 (2026-11-01)
 * 판정은 `PinCategoryChips.tsx` 안에 있었는데 그 파일은 `voucher-types` → `urdeal-icons` 를
 * import 한다. **워커가 그걸 읽으면 번들이 터진다**(`curator-ssr-body.ts` 머리말의 ❌ 항목).
 * 그래서 워커는 칩 줄의 자리를 **무조건** 예약하고 있었고, 상품이 적어 화면이 그 줄을 안 그리면
 * 마운트 때 그만큼 밀렸다. 판정만 의존성 없는 모듈로 빼서 **둘이 같은 답**을 내게 한다.
 *
 * 🔴 이 파일에 React·아이콘·i18n 을 import 하지 말 것 — 그 순간 워커가 다시 못 읽는다.
 */

/** 분류 키 — 이용권 4종 + 쇼핑 상품. 라벨·아이콘은 `PinCategoryChips` 가 붙인다. */
export type UShopPinCategory = 'meal_voucher' | 'beauty_voucher' | 'stay_voucher' | 'etc_voucher' | 'shop'

/** 분류에 필요한 최소 모양 — 핀 타입 전체를 끌어오지 않는다(워커가 읽어야 하므로). */
export interface UShopPinLike {
  category?: string | null
  deal_only?: number | null
}

/** 핀 → 칩 키. 교환권(`deal_only`)·voucher 카테고리는 4종 중 하나, 나머지는 '상품'. */
export function pinCategory(p: UShopPinLike): UShopPinCategory {
  const cat = p.category || ''
  if (/^(meal|beauty|stay|etc)_voucher$/.test(cat)) return cat as UShopPinCategory
  if (p.deal_only === 1 || /voucher/i.test(cat)) return 'etc_voucher'
  return 'shop'
}

/**
 * 분류 **탭**을 그리는가. `PinCategoryChips` 의 `defs.length <= 2 → null` 과 같은 뜻이다 —
 * `defs` 는 `전체` + 실제로 있는 분류들이라, 분류가 하나뿐이면 탭이 늘 같은 목록을 가리킨다.
 */
export function showUShopChips(pins: readonly UShopPinLike[]): boolean {
  if (!pins.length) return false
  const keys = new Set<UShopPinCategory>()
  for (const p of pins) keys.add(pinCategory(p))
  return keys.size >= 2
}

/**
 * 🎚️ 정렬 드롭다운이 뜨는 최소 진열 수 (2026-11-01).
 *   s3 줄 카드가 128px 이고 2안 머리(146) + 칩 줄(56) + 하단 탭(60) 을 빼면 844px 화면에
 *   **4.5줄**이 든다 — 4개까지는 스크롤 없이 다 보이므로 정렬할 이유가 없다.
 *   ⚠️ 기준은 **전체 핀 수**다(칩과 같은 입력). 검색·분류로 걸러진 수로 하면 거를 때마다
 *      버튼이 사라져 그 자체가 깜빡임이 된다.
 */
export const USHOP_SORT_MIN_PINS = 5

/** 정렬 드롭다운을 그리는가. */
export function showUShopSort(pins: readonly unknown[]): boolean {
  return pins.length >= USHOP_SORT_MIN_PINS
}
