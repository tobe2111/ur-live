/**
 * 🎟️ 주문 경로의 공구(group-buy) 가격 해석 — order.routes 에서 추출 (2026-07-29 세션 ①)
 *
 * 이 레포엔 공구 할인이 **두 가지**이고, 둘이 만나면 돈이 샌다. 그래서 한 자리에 모은다.
 *   ① `group_buy_tiers` + `maxTierDiscount` — 구 모델. 할인 *portion* 으로 서버 cap 재계산.
 *   ② `gb_price`(product_supply_meta) — 신 공구 엔진. **단가 자체**를 공구가로 바꾼다.
 *
 * 🔴 이중 할인: ②로 단가가 이미 낮아진 상품을 ①의 cap 계산에 넣으면, `perUnit` 이
 *   **낮아진 unit_price** 에서 다시 계산돼 cap 이 부풀고 **과소청구**된다.
 *   ⇒ `applied` 에 든 상품은 cap 누적에서 제외한다. 그 판정을 호출부에 맡기지 않고 여기서 고정한다.
 *
 * 안전 방향: `validateGbSession` 이 `gb_price < 상시가` 를 강제하고 `resolveGbPricing` 도
 *   `gbPrice < list` 일 때만 적용 ⇒ **가격을 낮추기만 하고 올릴 수 없다.**
 * fail-soft: 세션/티어 조회 실패는 주문을 막지 않는다(상시가·cap 0 으로 진행 — 과금 보호 방향).
 */
import { resolveGbPricing, type GbSession } from '../../shared/gb-session'
import { getGbSessions } from './gb-session-store'
import { maxTierDiscount } from '../../features/group-buy/api/helpers'

export interface GbOrderPricing {
  /** 상품별 기준가(공구 live 면 공구 특가, 아니면 상시가). 옵션 조정은 호출부에서 더한다. */
  basePrice(productId: number, listPrice: number): number
  /** 공구가가 실제 적용된 상품 id — tier cap 에서 제외해야 하는 대상(이중 할인 차단). */
  applied: Set<number>
}

/**
 * 주문 상품들의 공구 세션을 **배치 조회**(N+1 회피)해 가격 해석기를 만든다.
 * @param viaRefLink linkOnly 세션은 `?ref` 경유일 때만 공구가 — 호출부의 referrer 소스와 같은 값.
 */
export async function loadGbOrderPricing(
  DB: D1Database,
  productIds: number[],
  viaRefLink: boolean,
  nowMs: number = Date.now(),
): Promise<GbOrderPricing> {
  const applied = new Set<number>()
  // 🔌 2026-08-11 킬스위치 〔대표 "게이트를 붙인다"〕 — 값이 정확히 `'false'` 일 때만 끈다.
  //
  // 🔴 **왜 `gb_engine_enabled` 를 안 쓰는가**: 그 키는 기본값이 `'false'`(미설정 포함)다.
  //   그걸 여기에 걸면 **오늘 당장 공구가가 안 먹어** 몰 화면은 공구가인데 청구는 상시가가 된다
  //   — 지금 상태보다 나쁘다. 그래서 **기본 ON 인 별도 스위치**를 둔다. 게이트의 목적은
  //   "기능을 잠가 두는 것"이 아니라 **잘못 설정된 공구가를 즉시 되돌릴 손잡이**이기 때문이다.
  //   (`seller-gb`·`gb-cockpit` 주석이 *"적용은 gb_engine_enabled 뒤"* 라고 적어 온 것은
  //    **사실이 아니었다** — 이 커밋에서 그 문구도 함께 바로잡는다.)
  //
  // ⚠️ 조회 실패는 **켠 것으로 본다**(fail-open). DB 한 번 흔들렸다고 전 주문이 상시가로
  //   청구되면 그게 더 큰 사고다. 끄는 것은 **명시적으로 'false' 를 저장했을 때만** 일어난다.
  let killed = false
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'gb_pricing_enabled'")
      .first<{ value: string }>()
    killed = String(row?.value ?? '').trim() === 'false'
  } catch { killed = false }
  if (killed) return { applied, basePrice: (_id, listPrice) => Number(listPrice) || 0 }

  const sessions: Map<number, GbSession> = await getGbSessions(DB, productIds)
    .catch(() => new Map<number, GbSession>())
  return {
    applied,
    basePrice(productId, listPrice) {
      const list = Number(listPrice) || 0
      const s = sessions.get(Number(productId))
      if (!s) return list
      const eff = resolveGbPricing(s, list, null, nowMs, viaRefLink).effectivePrice
      if (eff < list) applied.add(Number(productId))
      return eff
    },
  }
}

/**
 * 구 tier 모델의 서버 cap — 조작된 클라 할인액을 잘라내는 상한.
 *   cap = Σ 항목( quantity × (단가 − round(단가 × (1 − md/100))) )
 *   tiers 없는 상품(즉시판매 단일가/일반)은 md=0 → cap 기여 0.
 * ⚠️ `gbApplied` 상품은 제외 — 공구가가 이미 단가에 반영돼 있어 이중 할인이 된다.
 */
export async function computeGroupBuyCap(
  DB: D1Database,
  items: Array<{ product_id: number | string; unit_price: number; quantity: number }>,
  gbApplied: Set<number>,
): Promise<number> {
  if (items.length === 0) return 0
  try {
    const ph = items.map(() => '?').join(',')
    const { results } = await DB.prepare(
      `SELECT id, group_buy_tiers FROM products WHERE id IN (${ph})`,
    ).bind(...items.map((i) => Number(i.product_id))).all<{ id: number; group_buy_tiers: string | null }>()
    const tierMap = new Map<number, string | null>((results ?? []).map((r) => [Number(r.id), r.group_buy_tiers]))
    let cap = 0
    for (const it of items) {
      if (gbApplied.has(Number(it.product_id))) continue
      const md = maxTierDiscount(tierMap.get(Number(it.product_id)) ?? null)
      if (md > 0) cap += Math.max(0, it.unit_price - Math.round(it.unit_price * (1 - md / 100))) * it.quantity
    }
    return cap
  } catch {
    return 0 // 조회 실패 → 그룹바이 할인 미인정(fail-closed, 과금 보호)
  }
}
