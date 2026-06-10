/**
 * 🛡️ 2026-06-10: product_supply_meta — products god-table 증식 차단용 사이드테이블 (구조적 후속).
 *
 * 배경: products 컬럼이 94개+ 까지 증식 → SELECT p.* 가 D1 결과셋 한도(100) 초과로 교환권/공구
 * 상세 전체 500 (KNOWN_ERRORS 참조). star-select 제거 + CI 차단으로 즉발 위험은 닫혔지만,
 * 증식 자체를 멈추지 않으면 row 폭·스키마 혼란이 누적된다.
 *
 * 룰 (CI `check-products-column-budget.mjs` 가 강제):
 *   - 새 도매/브랜드/전시성 product 메타 컬럼은 products 에 ALTER 금지 → 이 테이블 사용.
 *   - 소비자 핫패스(피드/상세)가 매 행 필요로 하는 값만 products 본체 (예: dominant_color).
 *
 * 사용:
 *   await ensureSupplyMetaTable(DB)
 *   const meta = await getSupplyMeta(DB, productIds)        // Map<product_id, Record>
 *   await setSupplyMeta(DB, productId, { key: value, ... }) // UPSERT (부분 갱신)
 *
 * 설계: wide-column 대신 (product_id, key, value) K-V — 새 메타 추가가 스키마 변경 0.
 *   value 는 TEXT (숫자/불리언은 호출측 캐스팅). 상품당 키 수십 개 수준이라 K-V 비용 무시 가능.
 */

import { swallow } from './swallow'

const _ensured = new WeakSet<object>()

export async function ensureSupplyMetaTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS product_supply_meta (
    product_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT (datetime('now')),
    PRIMARY KEY (product_id, key)
  )`).run().catch(swallow('supply-meta:create'))
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_product_supply_meta_key ON product_supply_meta(key, product_id)'
  ).run().catch(swallow('supply-meta:idx'))
}

/** 여러 상품의 메타를 1쿼리로 로드 — Map<product_id, Record<key, value>>. */
export async function getSupplyMeta(
  DB: D1Database,
  productIds: number[],
): Promise<Map<number, Record<string, string>>> {
  const out = new Map<number, Record<string, string>>()
  const ids = productIds.filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return out
  await ensureSupplyMetaTable(DB)
  const ph = ids.map(() => '?').join(',')
  const { results } = await DB.prepare(
    `SELECT product_id, key, value FROM product_supply_meta WHERE product_id IN (${ph})`
  ).bind(...ids).all<{ product_id: number; key: string; value: string | null }>()
    .catch(() => ({ results: [] as Array<{ product_id: number; key: string; value: string | null }> }))
  for (const r of results || []) {
    const rec = out.get(r.product_id) || {}
    rec[r.key] = r.value ?? ''
    out.set(r.product_id, rec)
  }
  return out
}

/** 부분 UPSERT — 전달한 키만 갱신. */
export async function setSupplyMeta(
  DB: D1Database,
  productId: number,
  values: Record<string, string | number | boolean | null>,
): Promise<void> {
  if (!Number.isFinite(productId) || productId <= 0) return
  await ensureSupplyMetaTable(DB)
  for (const [key, raw] of Object.entries(values)) {
    const value = raw == null ? null : String(raw)
    await DB.prepare(`
      INSERT INTO product_supply_meta (product_id, key, value, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(product_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).bind(productId, key, value).run()
  }
}
