/**
 * 🏠 홈 편성 섹션의 SSR 시드(`__SSR_INITIAL_SECTIONS__`)를 읽는 **단일 창구**.
 *
 * 같은 시드를 두 곳이 본다 — 섹션 자신(`HomeSections`)과 그 바로 아래 피드(`GroupBuyFeed`).
 * 파서가 둘로 갈리면 한쪽만 고쳐지고 결국 어긋난다(카드 컴포넌트가 두 벌이던 시절에
 * 실제로 그렇게 갈렸고, 2026-08-19 에 한 벌로 합쳤다).
 *
 * 시드는 워커가 홈(MAIN 슬롯)에만 실어 준다(`worker/index.ts` — `/region/*` 같은 다른 표면엔 없다).
 * 없으면 `undefined`/빈 집합이라 호출부는 그대로 평소 동작이 된다(fail-soft).
 */

/** 시드에서 실제로 읽는 최소 모양. 섹션 카드가 쓰는 필드는 `HomeSections` 가 자기 타입으로 본다. */
export interface SeededSectionShape {
  products?: unknown
}

/** `__SSR_INITIAL_SECTIONS__` 원문을 파싱해 섹션 배열을 돌려준다. 깨졌거나 없으면 `undefined`. */
export function readHomeSectionsSeed<T = SeededSectionShape>(): T[] | undefined {
  try {
    if (typeof document === 'undefined') return undefined
    const el = document.getElementById('__SSR_INITIAL_SECTIONS__')
    if (!el?.textContent) return undefined
    const r = JSON.parse(el.textContent) as { success?: boolean; data?: T[] }
    return r?.success && Array.isArray(r.data) ? r.data : undefined
  } catch {
    return undefined // 깨진 시드 하나가 홈을 못 열게 하면 안 된다
  }
}

/**
 * 위 섹션들에 **이미 뜬** 상품 id.
 *
 * 🔑 **쿼리 결과가 아니라 시드를 읽는 이유**: 섹션 fetch 를 구독하면 응답이 늦게 도착할 때
 * 그 값이 피드의 순서를 바꿔 **이미 그려진 카드가 재배치**된다. 2026-07-16 에 대표가 신고한
 * "스크롤하면 배치가 제멋대로" 와 같은 클래스다. 시드는 첫 렌더에 확정되고 그 뒤 변하지 않는다
 * — 그래서 순서를 여기에 걸어도 화면이 절대 안 튄다.
 *
 * 시드가 없는 콜드 진입에서는 빈 집합이 되어 겹침이 남는다. 그건 의도된 트레이드오프다:
 * **카드가 튀는 것보다 한 번 겹치는 편이 낫다.**
 */
export function seededSectionProductIds(): Set<number> {
  const out = new Set<number>()
  const sections = readHomeSectionsSeed()
  if (!sections) return out
  for (const s of sections) {
    const products = (s as SeededSectionShape)?.products
    if (!Array.isArray(products)) continue
    for (const p of products) {
      const id = (p as { id?: unknown })?.id
      if (typeof id === 'number' && Number.isFinite(id)) out.add(id)
    }
  }
  return out
}

/**
 * 편성 섹션에 이미 뜬 것을 **한 밴드 안에서 뒤로** 보낸다(제거가 아니라 순서만).
 *
 * - 개수·구성원은 보존된다. 피드는 *전체* 목록이라 여기서 지우면 목록이 거짓말이 된다.
 * - 두 묶음 안의 상대 순서는 그대로다(안정 분할) — 정렬 칩이 정한 의미가 유지된다.
 * - `ids` 가 비면 **입력과 같은 순서**를 돌려준다(홈이 아닌 표면·시드 없는 콜드 진입).
 *
 * ⚠️ 호출부는 이걸 **밴드 단위로만** 쓸 것. 여러 밴드를 합쳐 넘기면 이미 그려진 카드가
 *    나중 페이지 로드 때 움직인다(2026-07-16 "스크롤하면 배치가 제멋대로" 사고).
 */
export function deferSeeded<T extends { id?: number | string | null }>(
  band: readonly T[],
  ids: ReadonlySet<number>,
): T[] {
  if (ids.size === 0) return band as T[]
  const head: T[] = []
  const tail: T[] = []
  for (const p of band) {
    const id = p?.id
    ;(typeof id === 'number' && ids.has(id) ? tail : head).push(p)
  }
  return head.concat(tail)
}
