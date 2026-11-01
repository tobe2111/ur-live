/**
 * 🏠 생활 이용권 업종 저장·조회 (2026-10-25). SSOT 는 `shared/life-deal-subcat.ts`.
 *
 * - 저장: 사장님 등록(POST)·수정(PUT) 이 부른다. `home_voucher` 가 아니면 지운다(카테고리를 바꾼
 *   이용권에 옛 업종이 남아 엉뚱한 칩에 뜨지 않게). 값이 안 왔으면(옛 화면·다른 등록 경로) 건드리지 않는다.
 * - 조회: 홈 '생활' 탭 칩이 쓰는 `{ 상품 id: 업종 }` 표. 저장값이 없으면 이름으로 추정한다.
 */
import { ensureSupplyMetaTable, setSupplyMeta } from '../../../worker/utils/product-supply-meta'
import { LIFE_SUBCAT_META_KEY, normalizeLifeSubcat, resolveLifeSubcat, type LifeSubcat } from '../../../shared/life-deal-subcat'

export async function saveLifeSubcat(DB: D1Database, productId: number, category: unknown, raw: unknown): Promise<void> {
  if (raw === undefined || !Number.isFinite(productId) || productId <= 0) return
  const value = String(category ?? '') === 'home_voucher' ? normalizeLifeSubcat(raw) : null
  await ensureSupplyMetaTable(DB)
  await setSupplyMeta(DB, productId, { [LIFE_SUBCAT_META_KEY]: value })
}

/** 판매 중인 생활 이용권 → 업종. 업종을 정할 수 없는 이용권은 표에 없다('전체' 칩에만 보인다). */
export async function lifeSubcatMap(DB: D1Database): Promise<Record<number, LifeSubcat>> {
  await ensureSupplyMetaTable(DB)
  const { results } = await DB.prepare(
    `SELECT p.id, p.name, m.value AS sub
       FROM products p
       LEFT JOIN product_supply_meta m ON m.product_id = p.id AND m.key = ?
      WHERE p.category = 'home_voucher' AND p.is_active = 1
      ORDER BY p.id DESC LIMIT 1000`,
  ).bind(LIFE_SUBCAT_META_KEY).all<{ id: number; name: string | null; sub: string | null }>()
    .catch(() => ({ results: [] as Array<{ id: number; name: string | null; sub: string | null }> }))
  const out: Record<number, LifeSubcat> = {}
  for (const r of results || []) {
    const s = resolveLifeSubcat(r.sub, r.name)
    if (s) out[Number(r.id)] = s
  }
  return out
}
