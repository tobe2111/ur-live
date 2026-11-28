/**
 * 🏷️ 데모 숙소 할인율을 고르게 (2026-11-28)
 *
 * 숙소 사장님(플레이가비)이 앱을 직접 둘러보고 *"숙소가 다 23%라서 생긴 지 얼마 안 된 플랫폼이냐"* 고 물었다.
 * 원인: 데모 숙소 시드가 정가를 **판매가 × 1.3** 하나로 만들었다 → 할인율이 언제나 1 − 1/1.3 ≈ 23%.
 * 라이브 실측(2026-11-28): 활성 데모 숙소 20개 중 18개가 정확히 23%.
 * 대표 *"예시로 둘 수는 없을 것 같고 할인율이 좀 변경은 있어야 할 것 같아 다양하게."*
 *
 * 규칙: 숙소마다 정해진(같은 숫자 → 같은 결과) 할인율 하나를 아래 목록에서 고른다.
 * 23% 는 일부러 뺐다 — 다시 한 숫자로 몰리지 않게.
 */
import type { D1Database } from '@cloudflare/workers-types'

export const DEMO_STAY_DISCOUNT_PCTS = [12, 15, 17, 19, 21, 25, 27, 29, 32, 35] as const

/** seed(상품 id·slug 번호)로 할인율을 고른다. 같은 seed 는 늘 같은 값. */
export function demoStayDiscountPct(seed: number): number {
  const s = Math.abs(Math.floor(Number(seed) || 0))
  const h = (s * 2654435761) >>> 0 // 곱셈 해시 — 연속 id 가 같은 칸에 몰리지 않게
  return DEMO_STAY_DISCOUNT_PCTS[h % DEMO_STAY_DISCOUNT_PCTS.length]
}

/** 판매가와 seed 로 정가(천 원 단위)를 만든다. 판매가가 0 이하면 0. */
export function demoStayOriginalPrice(price: number, seed: number): number {
  const p = Number(price) || 0
  if (p <= 0) return 0
  const pct = demoStayDiscountPct(seed)
  return Math.max(p, Math.round(p / (1 - pct / 100) / 1000) * 1000)
}

/** 옛 규칙(× 1.3)으로 만든 정가인가. */
export function isLegacyDemoStayOriginal(price: number, original: number): boolean {
  const p = Number(price) || 0
  return p > 0 && Number(original) === Math.round(p * 1.3 / 1000) * 1000
}

/**
 * 이미 만들어진 데모 숙소(`slug LIKE 'demo-stay-%'`) 중 옛 규칙 정가인 행만 새 정가로 바꾼다.
 * 사람이 손으로 고친 정가는 옛 규칙 값과 다르므로 건드리지 않는다. 다시 돌려도 무해(멱등).
 * 판매가(`price`)는 바꾸지 않는다 — 손님이 내는 돈은 그대로고, 정가 표시만 바뀐다.
 */
export async function healDemoStayDiscounts(DB: D1Database): Promise<number> {
  const rows = await DB.prepare(
    `SELECT id, price, original_price FROM products WHERE slug LIKE 'demo-stay-%' AND COALESCE(price, 0) > 0`,
  ).all<{ id: number; price: number; original_price: number | null }>().catch(() => ({ results: [] as { id: number; price: number; original_price: number | null }[] }))
  let healed = 0
  for (const r of rows.results || []) {
    if (!isLegacyDemoStayOriginal(r.price, Number(r.original_price))) continue
    const next = demoStayOriginalPrice(r.price, r.id)
    if (!next || next === Number(r.original_price)) continue
    const u = await DB.prepare(
      `UPDATE products SET original_price = ?, updated_at = datetime('now') WHERE id = ? AND original_price = ? AND slug LIKE 'demo-stay-%'`,
    ).bind(next, r.id, r.original_price).run().catch(() => null)
    if (u && (u.meta.changes || 0) > 0) healed++
  }
  return healed
}
