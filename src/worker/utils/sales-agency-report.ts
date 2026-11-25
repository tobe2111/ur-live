/**
 * 🧾 판매·결제대행 명세 — 분기마다 국세청 제출용 집계 (부가가치세법 제75조, 2026-11-25 대표 *"너가 할 수 있는거 해줘"*)
 *
 * 손님 카드결제는 유어딜 이름으로 잡혀 국세청엔 결제 총액이 유어딜 매출처럼 보인다. 통신판매중개자는 매장별
 * 월별 거래명세를 **분기 말일의 다음 달 15일까지** 내야 하고, 그래야 "이 돈은 매장 매출, 우리 매출은 수수료" 가 맞춰진다.
 *
 * 이 파일은 그 **데이터**를 매장·월·결제수단별로 모은다(읽기 전용). 국세청 전자제출 파일 형식은 세무사·홈택스 안내로
 * 확인해 옮긴다 — 형식 변환은 아직 하지 않았다(아래 CSV 는 사람이 읽는 집계표).
 *
 * 금액 기준: 결제 완료 주문의 품목 금액(`order_items.subtotal`, 없으면 단가 × 수량)을 품목의 매장으로 나누고,
 * 환불은 그 주문 안에서 매장 금액 비율로 나눈다. 결제월 = `paid_at`(없으면 `created_at`) KST.
 */
import type { D1Database } from '@cloudflare/workers-types'

export interface SalesAgencyRow {
  sellerId: number; month: string; method: 'card' | 'deal'; orders: number; gross: number; refunded: number; net: number
  bizNo: string | null; name: string | null
}

/** 'YYYY-Qn' → 그 분기의 세 달 · 제출 기한(분기 다음 달 15일). 순수. */
export function quarterInfo(q: string): { months: string[]; due: string } | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(q)
  if (!m) return null
  const y = Number(m[1]), n = Number(m[2])
  const months = [0, 1, 2].map((i) => `${y}-${String((n - 1) * 3 + 1 + i).padStart(2, '0')}`)
  const due = new Date(Date.UTC(y, n * 3, 15))
  return { months, due: `${due.getUTCFullYear()}-${String(due.getUTCMonth() + 1).padStart(2, '0')}-15` }
}

/** 지난 분기(KST) 'YYYY-Qn'. 순수. */
export function previousKstQuarter(nowMs: number = Date.now()): string {
  const k = new Date(nowMs + 9 * 3600_000)
  let y = k.getUTCFullYear()
  let q = Math.floor(k.getUTCMonth() / 3) // 이번 분기 0-base
  if (q === 0) { y -= 1; q = 4 }
  return `${y}-Q${q}`
}

export async function computeSalesAgencyReport(DB: D1Database, quarter: string): Promise<SalesAgencyRow[]> {
  const info = quarterInfo(quarter)
  if (!info) throw new Error('quarter must be YYYY-Qn')
  const { results } = await DB.prepare(`
    SELECT o.id AS order_id, strftime('%Y-%m', datetime(COALESCE(o.paid_at, o.created_at), '+9 hours')) AS month,
           CASE WHEN o.payment_method = 'deal_points' THEN 'deal' ELSE 'card' END AS method,
           COALESCE(o.refunded_amount, 0) AS refunded,
           COALESCE(oi.seller_id, p.seller_id, o.seller_id) AS seller_id,
           COALESCE(oi.subtotal, COALESCE(oi.unit_price, oi.price, 0) * COALESCE(oi.quantity, 1)) AS line
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.status IN ('PAID', 'DONE', 'DELIVERED', 'PREPARING', 'SHIPPING', 'REFUNDED', 'PARTIAL_REFUNDED')
       AND strftime('%Y-%m', datetime(COALESCE(o.paid_at, o.created_at), '+9 hours')) IN (?, ?, ?)`,
  ).bind(...info.months).all<{ order_id: number; month: string; method: 'card' | 'deal'; refunded: number; seller_id: number | null; line: number }>()

  // 주문별 품목 합(환불 비율 배분용)
  const orderTotal = new Map<number, number>()
  for (const r of results || []) orderTotal.set(r.order_id, (orderTotal.get(r.order_id) ?? 0) + (Number(r.line) || 0))
  const key = (s: number, m: string, k: string) => `${s}|${m}|${k}`
  const agg = new Map<string, SalesAgencyRow & { _orders: Set<number> }>()
  for (const r of results || []) {
    const sellerId = Number(r.seller_id)
    if (!Number.isInteger(sellerId) || sellerId <= 0) continue // 매장 없는 플랫폼 상품(교환권)은 유어딜 매출 — 명세 대상 아님
    const line = Math.max(0, Number(r.line) || 0)
    const tot = orderTotal.get(r.order_id) || 0
    const refundShare = tot > 0 ? Math.round((Number(r.refunded) || 0) * line / tot) : 0
    const k = key(sellerId, r.month, r.method)
    const cur = agg.get(k) ?? { sellerId, month: r.month, method: r.method, orders: 0, gross: 0, refunded: 0, net: 0, bizNo: null, name: null, _orders: new Set<number>() }
    cur._orders.add(r.order_id)
    cur.gross += line
    cur.refunded += Math.min(refundShare, line)
    cur.net = cur.gross - cur.refunded
    agg.set(k, cur)
  }
  const rows = [...agg.values()]
  const ids = [...new Set(rows.map((r) => r.sellerId))]
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const { results: ss } = await DB.prepare(
      `SELECT id, business_number, COALESCE(business_name, name) AS bname FROM sellers WHERE id IN (${chunk.map(() => '?').join(',')})`,
    ).bind(...chunk).all<{ id: number; business_number: string | null; bname: string | null }>()
    const m = new Map((ss || []).map((s) => [Number(s.id), s]))
    for (const r of rows) {
      const s = m.get(r.sellerId)
      if (s) { r.bizNo = String(s.business_number || '').replace(/\D/g, '') || null; r.name = s.bname }
    }
  }
  return rows
    .map(({ _orders, ...r }) => ({ ...r, orders: _orders.size }))
    .sort((a, b) => a.month.localeCompare(b.month) || a.sellerId - b.sellerId || a.method.localeCompare(b.method))
}

/** 순수 — 사람이 읽는 집계표 CSV(수식 인젝션 방어). */
export function salesAgencyCsv(quarter: string, rows: SalesAgencyRow[]): string {
  const cell = (v: unknown): string => {
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return `"${s.replace(/"/g, '""')}"`
  }
  const info = quarterInfo(quarter)
  const header = ['분기', '월', '매장 사업자번호', '상호', '결제수단', '주문 수', '결제금액', '환불', '순액']
  const body = rows.map((r) => [quarter, r.month, r.bizNo || '(사업자번호 없음)', r.name, r.method === 'deal' ? '딜' : '카드', r.orders, r.gross, r.refunded, r.net])
  const foot = [['', '', '', `제출 기한 ${info?.due ?? ''} (부가가치세법 제75조, 분기 다음 달 15일)`, '', '', '', '', '']]
  return '﻿' + [header, ...body, ...foot].map((r) => r.map(cell).join(',')).join('\r\n')
}
