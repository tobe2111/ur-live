/**
 * 📦 2026-06-29 (대표 — 대량발주 드랍십, "둘 다" 매칭): 판매사가 올린 엑셀의 상품코드(예: 셀파이 SOTN…)를
 *   우리 product_id 로 해석한다. 매칭 우선순위:
 *     1) 행에 우리 product_id 가 직접 있으면 그걸 사용(가장 강함).
 *     2) 판매사별 학습된 코드 맵(이 판매사가 이전 업로드에서 product_id+상품코드를 함께 넣어 학습된 것).
 *     3) 상품 단위 ext_code(제조사/어드민이 product_supply_meta 에 등록한 글로벌 코드).
 *
 *   자동학습: 한 행이 product_id 와 상품코드를 *둘 다* 주면 (seller_id, code)→product_id 를 upsert.
 *   → 처음엔 우리 양식(product_id 포함)으로 올려 코드가 학습되고, 이후엔 코드만 있는 외부 발주서도 해석됨.
 *   UI 등록 없이 "둘 다"를 충족(별도 매핑 화면 불필요). 코드는 판매사 스코프라 타 판매사 코드와 충돌 없음.
 */
import { swallow } from '@/worker/utils/swallow'

const _codeMapEnsured = new WeakSet<object>()

export async function ensureCodeMap(DB: D1Database): Promise<void> {
  if (_codeMapEnsured.has(DB)) return
  _codeMapEnsured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_product_code_map (
    seller_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now')),
    PRIMARY KEY (seller_id, code)
  )`).run().catch(swallow('wholesale:code-map:create'))
}

/** 외부 상품코드 정규화 — 앞뒤 공백 제거(대소문자는 보존: SKU 는 case-sensitive 일 수 있음). */
export function normCode(raw: unknown): string {
  return String(raw ?? '').trim().slice(0, 80)
}

/** 자동학습 — product_id 와 code 를 둘 다 가진 행에서 (seller_id, code)→product_id upsert. best-effort. */
export async function learnCodes(
  DB: D1Database,
  sellerId: number,
  pairs: Array<{ code: string; product_id: number }>,
): Promise<void> {
  const valid = pairs
    .map((p) => ({ code: normCode(p.code), product_id: Math.floor(Number(p.product_id)) }))
    .filter((p) => p.code && Number.isFinite(p.product_id) && p.product_id > 0)
  if (!valid.length) return
  await ensureCodeMap(DB)
  // 중복 코드 제거(마지막 값 우선) — 한 업로드 내 같은 코드가 다른 pid 면 마지막 행 기준.
  const dedup = new Map<string, number>()
  for (const p of valid) dedup.set(p.code, p.product_id)
  for (const [code, pid] of dedup) {
    await DB.prepare(`
      INSERT INTO wholesale_product_code_map (seller_id, code, product_id, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(seller_id, code) DO UPDATE SET product_id = excluded.product_id, updated_at = datetime('now')
    `).bind(sellerId, code, pid).run().catch(swallow('wholesale:code-map:learn'))
  }
}

/** 코드 배열 → Map<code, product_id>. 판매사 맵 우선, 없으면 상품 ext_code(글로벌) 폴백. */
export async function resolveCodes(
  DB: D1Database,
  sellerId: number,
  codes: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const uniq = [...new Set(codes.map(normCode).filter(Boolean))]
  if (!uniq.length) return out
  await ensureCodeMap(DB)
  const ph = uniq.map(() => '?').join(',')
  // 1) 판매사 학습 맵.
  const seller = await DB.prepare(
    `SELECT code, product_id FROM wholesale_product_code_map WHERE seller_id = ? AND code IN (${ph})`
  ).bind(sellerId, ...uniq).all<{ code: string; product_id: number }>().catch(() => ({ results: [] as Array<{ code: string; product_id: number }> }))
  for (const r of seller.results || []) out.set(r.code, r.product_id)
  // 2) 미해석 코드만 상품 ext_code(글로벌 메타) 폴백.
  const remain = uniq.filter((c) => !out.has(c))
  if (remain.length) {
    const ph2 = remain.map(() => '?').join(',')
    const global = await DB.prepare(
      `SELECT value AS code, product_id FROM product_supply_meta WHERE key = 'ext_code' AND value IN (${ph2})`
    ).bind(...remain).all<{ code: string; product_id: number }>().catch(() => ({ results: [] as Array<{ code: string; product_id: number }> }))
    for (const r of global.results || []) if (!out.has(r.code)) out.set(r.code, r.product_id)
  }
  return out
}
