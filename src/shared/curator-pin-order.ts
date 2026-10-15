/**
 * 🔢 유어샵(`/u/:handle`) 진열 순서의 **단일 소스(SSOT)** — 2026-10-09.
 *
 * ## 왜 분리했나
 * 이 순서는 `CuratorPage.tsx` 안의 `useMemo` 세 개로만 존재했다. 그런데 2026-10-09 에
 * **워커가 첫 화면(줄 4개)을 그리게** 되면서 같은 순서를 두 곳에서 알아야 했다.
 * 손으로 두 번 적으면 반드시 갈린다 — 그리고 갈리면 **에러가 아니라 거짓말**이 된다:
 * 순번 배지는 SNS 에서 *"N번 이용권 사세요"* 로 부르는 **주소**라(2026-08-31 대표),
 * 서버가 그린 번호와 마운트 뒤 번호가 다르면 소개비가 엉뚱한 상품으로 샌다.
 *
 * ## 규칙 (2026-08-27·2026-06-10 대표 확정 — 행동 불변으로 옮긴 것)
 *   딜 있는 핀(`deal_pct > 0`) → 교환권/이용권 → 그 외 상품.
 *   **덩어리만 가르고 각 덩어리 안은 원래 순서 그대로**(`filter` 가 순서를 보존한다).
 *   순서는 주인 것이다 — 자동 정렬로 `position` 을 덮지 않는다.
 *
 * ⚠️ 이 파일은 **워커가 import 한다** — React·lucide·i18n 을 끌어오면 워커 번들이 터진다
 *    (2026-10-08 `shared/deal-cats.ts` 를 분리한 것과 같은 이유). 순수 함수만 둘 것.
 */

/** 순서 판정에 쓰는 세 필드만 본다(나머지 필드는 호출부 타입 그대로 통과). */
export interface CuratorPinOrderFields {
  category?: string | null
  deal_only?: number | null
  deal_pct?: number | null
}

/** 교환권/이용권인가 — `deal_only===1` 또는 카테고리에 `voucher`. */
export function isVoucherPin(p: CuratorPinOrderFields): boolean {
  return p.deal_only === 1 || /voucher/i.test(p.category || '')
}

/** 딜(소개비)이 붙는 핀인가. */
export function hasDealPin(p: CuratorPinOrderFields): boolean {
  return Number(p.deal_pct) > 0
}

/**
 * 진열 순서(= 기본 정렬 `curated`, 그리고 순번 배지의 기준).
 * 입력 배열은 바꾸지 않는다.
 */
export function curatorHomePins<T extends CuratorPinOrderFields>(pins: readonly T[]): T[] {
  const rest = pins.filter((p) => !hasDealPin(p))
  return [
    ...pins.filter(hasDealPin),
    ...rest.filter(isVoucherPin),
    ...rest.filter((p) => !isVoucherPin(p)),
  ]
}

/**
 * 👤 2026-10-14 (대표 확정 유어샵 A): 머리 아래 숫자 줄의 **누적 구매**.
 *   🛍️ 2026-10-15 대표 *"바꾸자"* — **이 유어샵을 거쳐 팔린 수**(서버가 `curator.ushop_sold` 로 싣는다,
 *   근거 `worker/utils/ushop-sales.ts`). 종전엔 진열 상품들의 `sold_count`(어디서 팔렸든 전체) 합이었다 —
 *   그건 이 유어샵 주인이 만든 판매가 아니다. ⚠️ `sold_count` 로 되돌리지 말 것.
 *   화면(`CuratorPage`·`SellerPublicPage`)과 서버 첫 화면(`curator-ssr-body`)이 같은 함수를 쓴다 —
 *   두 벌이면 마운트 때 숫자가 바뀌어 보인다. 음수·비숫자·없음은 0(지어내지 않는다 — 0 이면 머리가 숨긴다).
 */
export function curatorSoldTotal(curator: { ushop_sold?: number | null } | null | undefined): number {
  const v = Number(curator?.ushop_sold)
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}
