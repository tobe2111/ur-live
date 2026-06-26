/**
 * 🆕 2026-06-26 마케팅 서비스 — 쇼핑몰 발주수집 (네이버 커머스 API 재사용).
 *
 * naver-commerce-core(OAuth 토큰·암호화 연결·naverFetch)를 그대로 재사용. 기존 커머스 연동은
 * 상품 내보내기/가져오기였고, 여기에 '주문(발주) 조회'만 추가 — 같은 인증/연결 공유.
 *
 * ⚠️ 미검증 (이 환경 egress 차단 + 실계정 키 필요 — naver-commerce-core 와 동일 주의):
 *   1) 주문 조회는 판매자가 커머스 앱 발급 시 '상품주문/배송' API 권한 스코프를 포함해야 함(없으면 403).
 *   2) 엔드포인트 경로/응답 스키마는 현행 커머스 API 문서 기준 운영 1회 E2E 로 확정 필요.
 *   파싱은 응답 형태 변화에 견디도록 방어적으로 작성(아래 pick/asArray).
 */
import { naverFetch, type NaverConnection } from '../../supply/api/naver-commerce-core'

export interface CollectedOrder {
  productOrderId: string
  orderId: string | null
  productName: string | null
  quantity: number
  totalAmount: number
  status: string | null
  ordererName: string | null
  orderedAt: string | null
}

const _schema = new WeakSet<object>()
export async function ensureCollectedOrdersSchema(DB: D1Database): Promise<void> {
  if (_schema.has(DB)) return
  _schema.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_collected_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    channel TEXT NOT NULL DEFAULT 'naver',
    product_order_id TEXT NOT NULL,
    order_id TEXT,
    product_name TEXT,
    quantity INTEGER DEFAULT 1,
    total_amount INTEGER DEFAULT 0,
    status TEXT,
    orderer_name TEXT,
    ordered_at TEXT,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(seller_id, channel, product_order_id)
  )`).run().catch(() => { /* best-effort */ })
}

// ── 응답 방어 파싱(스키마 변화 내성) ──
function asArray(v: unknown): unknown[] { return Array.isArray(v) ? v : [] }
function pick(o: unknown, ...keys: string[]): unknown {
  let cur: unknown = o
  for (const k of keys) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[k]
    else return undefined
  }
  return cur
}

/** 변경 주문 ID 추출 — GET .../last-changed-statuses 응답. */
function extractProductOrderIds(data: unknown): string[] {
  let list = asArray(pick(data, 'data', 'lastChangeStatuses'))
  if (!list.length) list = asArray(pick(data, 'data'))
  const ids: string[] = []
  for (const it of list) {
    const id = pick(it, 'productOrderId')
    if (typeof id === 'string' && id) ids.push(id)
  }
  return [...new Set(ids)]
}

/** 주문 상세 → CollectedOrder[] — POST .../query 응답. */
function mapOrders(data: unknown): CollectedOrder[] {
  const out: CollectedOrder[] = []
  for (const it of asArray(pick(data, 'data'))) {
    const po = pick(it, 'productOrder') ?? it
    const ord = pick(it, 'order')
    const pid = pick(po, 'productOrderId')
    if (typeof pid !== 'string' || !pid) continue
    out.push({
      productOrderId: pid,
      orderId: (pick(ord, 'orderId') as string) ?? (pick(po, 'orderId') as string) ?? null,
      productName: (pick(po, 'productName') as string) ?? null,
      quantity: Number(pick(po, 'quantity')) || 1,
      totalAmount: Number(pick(po, 'totalPaymentAmount')) || Number(pick(po, 'totalProductAmount')) || 0,
      status: (pick(po, 'productOrderStatus') as string) ?? null,
      ordererName: (pick(ord, 'ordererName') as string) ?? null,
      orderedAt: (pick(ord, 'orderDate') as string) ?? (pick(po, 'orderDate') as string) ?? null,
    })
  }
  return out
}

/** 최근 변경 주문 수집: 변경ID 목록 → 상세조회. */
export async function fetchRecentSmartStoreOrders(conn: NaverConnection, sinceISO: string): Promise<{ ok: boolean; orders?: CollectedOrder[]; error?: string }> {
  const changed = await naverFetch(conn, `/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${encodeURIComponent(sinceISO)}`)
  if (!changed.ok) return { ok: false, error: changed.error || '변경 주문 조회 실패' }
  const ids = extractProductOrderIds(changed.data)
  if (!ids.length) return { ok: true, orders: [] }
  const detail = await naverFetch(conn, '/v1/pay-order/seller/product-orders/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productOrderIds: ids.slice(0, 300) }),
  })
  if (!detail.ok) return { ok: false, error: detail.error || '주문 상세 조회 실패' }
  return { ok: true, orders: mapOrders(detail.data) }
}

/** 수집 + 멱등 저장(UNIQUE 충돌 무시). 반환: 신규 저장 건수. */
export async function collectAndStore(DB: D1Database, sellerId: number, conn: NaverConnection, sinceISO: string): Promise<{ ok: boolean; collected: number; error?: string }> {
  await ensureCollectedOrdersSchema(DB)
  const r = await fetchRecentSmartStoreOrders(conn, sinceISO)
  if (!r.ok) return { ok: false, collected: 0, error: r.error }
  let stored = 0
  for (const o of r.orders || []) {
    const res = await DB.prepare(
      `INSERT OR IGNORE INTO ad_collected_orders
        (seller_id, channel, product_order_id, order_id, product_name, quantity, total_amount, status, orderer_name, ordered_at)
       VALUES (?, 'naver', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sellerId, o.productOrderId, o.orderId, o.productName, o.quantity, o.totalAmount, o.status, o.ordererName, o.orderedAt).run().catch(() => null)
    if (res?.meta?.changes) stored += res.meta.changes
  }
  return { ok: true, collected: stored }
}

export async function listCollectedOrders(DB: D1Database, sellerId: number, limit = 100): Promise<CollectedOrder[]> {
  await ensureCollectedOrdersSchema(DB)
  const { results } = await DB.prepare(
    `SELECT product_order_id AS productOrderId, order_id AS orderId, product_name AS productName,
            quantity, total_amount AS totalAmount, status, orderer_name AS ordererName, ordered_at AS orderedAt
     FROM ad_collected_orders WHERE seller_id = ? ORDER BY id DESC LIMIT ?`
  ).bind(sellerId, Math.min(500, limit)).all<CollectedOrder>().catch(() => ({ results: [] as CollectedOrder[] }))
  return results || []
}
