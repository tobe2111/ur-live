/**
 * 🎟️ 이용권별 판매·사용 장수 — 어드민 '이용권 관리' 목록용 〔2026-10-20 대표 *"상품관리 + 이용권 공구 … 역할이 모호해"*〕
 *
 * 한 번의 GROUP BY 로 목록에 보이는 상품들만 센다(행마다 쿼리하지 않는다).
 * 환불된 이용권은 '판매' 에서 뺀다 — 화면이 말하는 "팔린 장수" 는 돈이 남아 있는 것이다.
 * 실패하면 빈 Map(fail-soft) — 숫자가 안 뜰 뿐 목록은 뜬다. 0 으로 위장하지 않도록 호출부는
 * Map 에 없는 상품을 `null`(모름)로 둔다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export interface VoucherSales { sold: number; used: number }

export async function voucherSalesByProduct(DB: D1Database, ids: number[]): Promise<Map<number, VoucherSales>> {
  const out = new Map<number, VoucherSales>()
  const list = ids.filter((n) => Number.isFinite(n) && n > 0).slice(0, 200)
  if (list.length === 0) return out
  try {
    const { results } = await DB.prepare(
      `SELECT product_id,
              SUM(CASE WHEN status != 'refunded' THEN 1 ELSE 0 END) AS sold,
              SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) AS used
         FROM vouchers WHERE product_id IN (${list.map(() => '?').join(',')})
        GROUP BY product_id`,
    ).bind(...list).all<{ product_id: number; sold: number; used: number }>()
    for (const r of results || []) out.set(Number(r.product_id), { sold: Number(r.sold) || 0, used: Number(r.used) || 0 })
    // 조회는 됐는데 행이 없는 상품 = 진짜 0장(모름이 아니다).
    for (const id of list) if (!out.has(id)) out.set(id, { sold: 0, used: 0 })
  } catch { /* fail-soft — 빈 Map */ }
  return out
}
