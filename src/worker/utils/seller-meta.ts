/**
 * 🛡️ 2026-07-05: seller_meta — sellers god-table 증식 차단용 사이드테이블 (product_supply_meta 미러).
 *
 * 배경: sellers 컬럼이 **정확히 100개 = D1 결과셋 한도 도달** (repair-schema 경고
 * "sellers 컬럼 100개 — 한도 임박"). 다음 sellers ALTER 는 `SELECT s.*` 류 조회를 즉시 500 으로
 * 만들 수 있다(products 사고와 동일 클래스 — KNOWN_ERRORS 참조). column-budget 가드
 * (`check-products-column-budget.mjs` + `scripts/sellers-column-baseline.json`)가 ALTER 를 차단하므로,
 * **새 셀러 메타가 필요한 순간 갈 곳**이 이 테이블이다 — 미리 깔아두는 인프라.
 *
 * 룰:
 *   - 새 셀러 설정/메타/플래그 컬럼은 sellers 에 ALTER 금지 → 이 테이블 사용.
 *   - 인증/정산 핫패스가 매 행 필요로 하는 값(commission_rate 등 기존 컬럼)만 sellers 본체.
 *
 * 사용:
 *   const meta = await getSellerMeta(DB, sellerIds)        // Map<seller_id, Record>
 *   await setSellerMeta(DB, sellerId, { key: value, ... }) // UPSERT (부분 갱신, null=삭제)
 *
 * 설계: (seller_id, key, value) K-V — 새 메타 추가가 스키마 변경 0. value 는 TEXT
 * (숫자/불리언은 호출측 캐스팅). 셀러당 키 수십 개 수준이라 K-V 비용 무시 가능.
 */

import { swallow } from './swallow'

const _ensured = new WeakSet<object>()

export async function ensureSellerMetaTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_meta (
    seller_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT (datetime('now')),
    PRIMARY KEY (seller_id, key)
  )`).run().catch(swallow('seller-meta:create'))
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_seller_meta_key ON seller_meta(key, seller_id)'
  ).run().catch(swallow('seller-meta:idx'))
}

/** 여러 셀러의 메타를 1쿼리로 로드 — Map<seller_id, Record<key, value>>. */
export async function getSellerMeta(
  DB: D1Database,
  sellerIds: number[],
): Promise<Map<number, Record<string, string>>> {
  const out = new Map<number, Record<string, string>>()
  const ids = sellerIds.filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return out
  await ensureSellerMetaTable(DB)
  const ph = ids.map(() => '?').join(',')
  const { results } = await DB.prepare(
    `SELECT seller_id, key, value FROM seller_meta WHERE seller_id IN (${ph})`
  ).bind(...ids).all<{ seller_id: number; key: string; value: string | null }>()
    .catch(() => ({ results: [] as Array<{ seller_id: number; key: string; value: string | null }> }))
  for (const r of results || []) {
    const rec = out.get(r.seller_id) || {}
    rec[r.key] = r.value ?? ''
    out.set(r.seller_id, rec)
  }
  return out
}

/** 셀러 1명의 메타 부분 UPSERT — value null 이면 해당 키 삭제. fail-soft. */
export async function setSellerMeta(
  DB: D1Database,
  sellerId: number,
  entries: Record<string, string | number | boolean | null>,
): Promise<void> {
  if (!Number.isFinite(sellerId) || sellerId <= 0) return
  await ensureSellerMetaTable(DB)
  for (const [key, raw] of Object.entries(entries)) {
    if (!key) continue
    if (raw === null) {
      await DB.prepare('DELETE FROM seller_meta WHERE seller_id = ? AND key = ?')
        .bind(sellerId, key).run().catch(swallow('seller-meta:del'))
      continue
    }
    await DB.prepare(
      `INSERT INTO seller_meta (seller_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(seller_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(sellerId, key, String(raw)).run().catch(swallow('seller-meta:set'))
  }
}
