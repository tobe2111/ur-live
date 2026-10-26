/**
 * 📊 **누가 팔았나** — 이용권 판매를 사장님 직접 · 에이전시별 · 소개(유어샵 링크)별로 나눈다 (2026-10-24 대표 확정)
 *
 * 대표: *"사장님 화면에서 에이전시 별 성과(인플루언서 혹은 고유링크별 성과)를 따로 보여줘야지."* → '누가 팔았나 한 화면'.
 *       *"이미 있는 이용권을 특정 에이전시에도 배정하는 기능 필요해."*
 *       에이전시에게는 *판매 내역·통계까지* (사용처리는 매장 몫).
 *
 * ## 귀속 = **판 순간에 그 이용권을 맡고 있던 에이전시**
 * `agency_products` 는 *지금* 누가 맡았는지만 안다. 그것으로 세면 이용권을 B 에이전시로 옮기는 순간 A 가 판 것까지
 * B 의 성과가 되고, 에이전시를 끊으면 그동안의 성과가 사라진다(에러 0). 그래서 **맡은 기간**을 따로 적는다
 * (`agency_product_periods` — 시작·끝). 판매(주문 시각)가 그 기간 안이면 그 에이전시 몫이다. 기간 밖 = 사장님 직접.
 * 지금 맡은 이용권(`agency_products`)과 열린 기간은 늘 짝이다 — 둘을 바꾸는 길은 이 파일의 세 함수뿐이다.
 *
 * ## 판매를 무엇으로 세나
 * 이용권 판매 = `vouchers` 한 장(주문 → 주문 줄 → 이용권). 장 단위로 센다:
 *   판매 = 환불 아닌 장 · 매출 = 그 장의 결제가(`applied_price`) · 사용 = used · 환불 = refunded. 0원 체험권은 뺀다.
 * 소개 판매 = 그 장이 유어샵 링크를 거쳐 팔렸는가(`ushop_sales` — 커미션과 무관하게 남는 기록). 소개 판매는
 * 위의 직접·에이전시 판매에 **이미 포함**돼 있다(같은 판매를 두 갈래로 본다 — 화면이 그렇게 말한다).
 *
 * 🤝 에이전시 몫(1단계) — 사장님이 정한 % 로 '줄 금액'을 같은 기준으로 계산한다(`agency-share.ts`). 보여 주기만 한다.
 *
 * 💰 읽기 전용 집계 + 배정 기록. 돈(결제·정산·원장·커미션)은 한 푼도 안 움직인다.
 */

import { currentSharePctSql, shareSumSql } from './agency-share'

export type SalesPeriod = 'month' | '30d' | 'all'

export function parsePeriod(raw: unknown): SalesPeriod {
  return raw === '30d' || raw === 'all' ? raw : 'month'
}

const sqlTs = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

/** 기간의 시작(UTC, D1 `datetime('now')` 와 같은 모양). 전체면 null. 이번 달 = **한국 시간** 1일 0시부터. */
export function periodSince(period: SalesPeriod, now = new Date()): string | null {
  if (period === 'all') return null
  if (period === '30d') return sqlTs(new Date(now.getTime() - 30 * 86400_000))
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const startKstAsUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600_000
  return sqlTs(new Date(startKstAsUtc))
}

/**
 * 판매(`o.created_at`)가 그 에이전시의 맡은 기간 안인가 — **귀속의 유일한 문장**.
 * 사장님 성과표 · 에이전시 판매 내역 · 콘솔 오늘 숫자가 모두 이것을 쓴다(셋이 다른 숫자를 말하지 않게).
 */
export function periodMatchSql(pr: string, productCol: string, sellerCol: string, orderAlias = 'o'): string {
  return `${pr}.product_id = ${productCol} AND ${pr}.seller_id = ${sellerCol} AND ${orderAlias}.created_at >= ${pr}.started_at AND (${pr}.ended_at IS NULL OR ${orderAlias}.created_at < ${pr}.ended_at)`
}

const VOUCHER_BASE = `FROM vouchers v JOIN orders o ON o.id = v.order_id JOIN products p ON p.id = v.product_id`
const METRICS = `COUNT(*) AS issued,
       SUM(CASE WHEN v.status = 'refunded' THEN 0 ELSE 1 END) AS sold,
       SUM(CASE WHEN v.status = 'refunded' THEN 0 ELSE COALESCE(v.applied_price, p.price, 0) END) AS revenue,
       SUM(CASE WHEN v.status = 'used' THEN 1 ELSE 0 END) AS used,
       SUM(CASE WHEN v.status = 'refunded' THEN 1 ELSE 0 END) AS refunded`

export interface SalesMetrics { sold: number; revenue: number; used: number; refunded: number }
const metricsOf = (r: Record<string, unknown> | undefined): SalesMetrics => ({
  sold: Number(r?.sold) || 0, revenue: Number(r?.revenue) || 0, used: Number(r?.used) || 0, refunded: Number(r?.refunded) || 0,
})
const isMissingTable = (e: unknown) => /no such table/i.test(String((e as Error)?.message || ''))

export interface ChannelRow extends SalesMetrics {
  kind: 'owner' | 'agency'
  agencyId: number | null
  name: string
  /** 지금 맡은 이용권 수(사장님 줄 = 아무 에이전시에도 안 맡긴 것). */
  products: number
  /** 에이전시 줄 — 지금 운영 중인가(끊었어도 그동안의 성과는 남는다). */
  linkStatus: 'active' | 'pending' | 'ended' | null
  /** 🤝 에이전시 몫 — 지금 % (정한 적 없으면 null) · 이 기간에 줄 금액(판매 시각의 % 로 계산). 사장님 줄은 null/0. */
  sharePct: number | null
  shareAmount: number
}
export interface ReferralRow extends SalesMetrics {
  userId: number
  name: string | null
  handle: string | null
  /** 이 매장이 그 사람에게 낸 소개비(환수 제외 · 중개사 몫 제외). */
  commission: number
}

type LinkRow = { agency_id: number; status: string; name: string; share_pct: number | null }

/** 사장님 화면 — 이 매장의 '누가 팔았나'. */
export async function storeChannelPerformance(DB: D1Database, sellerId: number, period: SalesPeriod) {
  const since = periodSince(period)
  const sinceSql = since ? 'AND o.created_at >= ?' : ''
  const sinceArgs = since ? [since] : []

  const byAgency = await DB.prepare(
    `SELECT pr.agency_id AS agency_id, ${METRICS}, ${shareSumSql('pr')}
       ${VOUCHER_BASE}
       LEFT JOIN agency_product_periods pr ON ${periodMatchSql('pr', 'v.product_id', 'p.seller_id')}
      WHERE p.seller_id = ? AND COALESCE(v.is_experience, 0) = 0 ${sinceSql}
      GROUP BY pr.agency_id`,
  ).bind(sellerId, ...sinceArgs).all<Record<string, unknown>>()
    .catch(async (e) => {
      if (!isMissingTable(e)) throw e
      // 기간 표가 아직 없다(에이전시가 한 번도 없던 매장) — 전부 사장님 직접이다.
      return DB.prepare(`SELECT NULL AS agency_id, ${METRICS} ${VOUCHER_BASE} WHERE p.seller_id = ? AND COALESCE(v.is_experience, 0) = 0 ${sinceSql}`)
        .bind(sellerId, ...sinceArgs).all<Record<string, unknown>>()
    })

  const links = await DB.prepare(
    `SELECT l.agency_id, l.status, a.name, ${currentSharePctSql('l.seller_id', 'l.agency_id')} AS share_pct
       FROM agency_store_links l JOIN agency_accounts a ON a.id = l.agency_id
      WHERE l.seller_id = ? ORDER BY l.id DESC LIMIT 50`,
  ).bind(sellerId).all<LinkRow>().catch(() => ({ results: [] as LinkRow[] }))
  const assigned = await DB.prepare(
    `SELECT agency_id, COUNT(*) AS n FROM agency_products WHERE seller_id = ? GROUP BY agency_id`,
  ).bind(sellerId).all<{ agency_id: number; n: number }>().catch(() => ({ results: [] as { agency_id: number; n: number }[] }))
  const total = await DB.prepare(
    `SELECT COUNT(*) AS n FROM products WHERE seller_id = ? AND COALESCE(status, '') != 'DELETED'`,
  ).bind(sellerId).first<{ n: number }>().catch(() => null)

  const sales = new Map<number | null, Record<string, unknown>>()
  for (const r of byAgency.results || []) sales.set(r.agency_id == null ? null : Number(r.agency_id), r)
  const productsOf = new Map((assigned.results || []).map((r) => [Number(r.agency_id), Number(r.n) || 0]))
  const assignedTotal = [...productsOf.values()].reduce((a, b) => a + b, 0)

  // 에이전시 이름·상태 — 가장 최근 링크 하나. 판매는 있는데 링크 기록이 없으면 이름만 비운다(지어내지 않는다).
  const linkOf = new Map<number, { status: string; name: string; sharePct: number | null }>()
  for (const l of links.results || []) {
    if (!linkOf.has(Number(l.agency_id))) linkOf.set(Number(l.agency_id), { status: l.status, name: l.name, sharePct: l.share_pct == null ? null : Number(l.share_pct) })
  }

  const rows: ChannelRow[] = [{
    kind: 'owner', agencyId: null, name: '사장님 직접', ...metricsOf(sales.get(null)),
    products: Math.max(0, (Number(total?.n) || 0) - assignedTotal), linkStatus: null, sharePct: null, shareAmount: 0,
  }]
  const agencyIds = new Set<number>([...linkOf.keys(), ...[...sales.keys()].filter((k): k is number => k != null)])
  for (const id of agencyIds) {
    const l = linkOf.get(id)
    const status = l ? (l.status === 'active' || l.status === 'pending' ? l.status : 'ended') : 'ended'
    // 맡김 요청만 하고 끝난 에이전시(판매 0)는 표를 어지럽히지 않게 뺀다.
    if (status === 'ended' && !sales.has(id)) continue
    rows.push({
      kind: 'agency', agencyId: id, name: l?.name || `에이전시 #${id}`, ...metricsOf(sales.get(id)),
      products: productsOf.get(id) || 0, linkStatus: status as ChannelRow['linkStatus'],
      sharePct: l?.sharePct ?? null, shareAmount: Math.round(Number(sales.get(id)?.share_raw) || 0),
    })
  }

  return { period, since, rows, referrals: await storeReferralPerformance(DB, sellerId, since) }
}

async function storeReferralPerformance(DB: D1Database, sellerId: number, since: string | null): Promise<ReferralRow[]> {
  const sinceO = since ? 'AND o.created_at >= ?' : ''
  const sinceA = since ? 'AND a.created_at >= ?' : ''
  const args = since ? [since] : []
  const viaLink = await DB.prepare(
    `SELECT us.curator_user_id AS uid, ${METRICS}
       ${VOUCHER_BASE}
       JOIN ushop_sales us ON us.order_id = v.order_id AND us.product_id = v.product_id
      WHERE p.seller_id = ? AND COALESCE(v.is_experience, 0) = 0 ${sinceO}
      GROUP BY us.curator_user_id`,
  ).bind(sellerId, ...args).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
  const paid = await DB.prepare(
    `SELECT a.influencer_id AS uid, COALESCE(SUM(a.commission_amount), 0) AS commission
       FROM influencer_attributions a
      WHERE a.seller_id = ? AND COALESCE(a.source, '') != 'broker_share' AND a.status != 'clawed_back' ${sinceA}
      GROUP BY a.influencer_id`,
  ).bind(sellerId, ...args).all<{ uid: string; commission: number }>().catch(() => ({ results: [] as { uid: string; commission: number }[] }))

  const out = new Map<number, ReferralRow>()
  const blank = (uid: number): ReferralRow => ({ userId: uid, name: null, handle: null, commission: 0, sold: 0, revenue: 0, used: 0, refunded: 0 })
  for (const r of viaLink.results || []) {
    const uid = Number(r.uid)
    if (!Number.isSafeInteger(uid) || uid <= 0) continue
    out.set(uid, { ...blank(uid), ...metricsOf(r) })
  }
  for (const r of paid.results || []) {
    const uid = Number(r.uid)
    if (!Number.isSafeInteger(uid) || uid <= 0) continue
    const row = out.get(uid) ?? blank(uid)
    row.commission = Number(r.commission) || 0
    out.set(uid, row)
  }
  const ids = [...out.keys()].slice(0, 50)
  if (ids.length) {
    const { results } = await DB.prepare(
      `SELECT id, name, handle FROM users WHERE id IN (${ids.map(() => '?').join(',')})`,
    ).bind(...ids).all<{ id: number; name: string | null; handle: string | null }>().catch(() => ({ results: [] as { id: number; name: string | null; handle: string | null }[] }))
    for (const u of results || []) {
      const row = out.get(Number(u.id))
      if (row) { row.name = u.name; row.handle = u.handle }
    }
  }
  return [...out.values()].filter((r) => ids.includes(r.userId)).sort((a, b) => b.revenue - a.revenue || b.commission - a.commission)
}

/** 에이전시 콘솔 — 이 에이전시가 이 매장에서 판 것(맡은 기간 안의 판매만). 손님 정보는 싣지 않는다. */
export async function agencyStoreSales(DB: D1Database, sellerId: number, agencyId: number, period: SalesPeriod) {
  const since = periodSince(period)
  const sinceSql = since ? 'AND o.created_at >= ?' : ''
  const args = since ? [since] : []
  const mine = `JOIN agency_product_periods pr ON ${periodMatchSql('pr', 'v.product_id', 'p.seller_id')} AND pr.agency_id = ?`
  const empty = { results: [] as Record<string, unknown>[] }
  const [sum, list] = await Promise.all([
    DB.prepare(`SELECT ${METRICS}, ${shareSumSql('pr')}, ${currentSharePctSql('?', '?')} AS share_pct ${VOUCHER_BASE} ${mine} WHERE p.seller_id = ? AND COALESCE(v.is_experience, 0) = 0 ${sinceSql}`)
      .bind(sellerId, agencyId, agencyId, sellerId, ...args).first<Record<string, unknown>>().catch((e) => { if (isMissingTable(e)) return null; throw e }),
    DB.prepare(
      `SELECT v.id, p.name AS product_name, COALESCE(v.applied_price, p.price, 0) AS price, v.status, o.created_at AS sold_at, v.used_at
         ${VOUCHER_BASE} ${mine}
        WHERE p.seller_id = ? AND COALESCE(v.is_experience, 0) = 0 ${sinceSql}
        ORDER BY o.created_at DESC, v.id DESC LIMIT 100`,
    ).bind(agencyId, sellerId, ...args).all<Record<string, unknown>>().catch((e) => { if (isMissingTable(e)) return empty; throw e }),
  ])
  return {
    period, since,
    summary: metricsOf(sum ?? undefined),
    // 🤝 우리 몫 — 지금 % 와 이 기간 금액(집계 한 줄이라 판매가 0 이어도 % 는 실린다). 정한 적 없으면 null.
    share: { pct: sum?.share_pct == null ? null : Number(sum.share_pct), amount: Math.round(Number(sum?.share_raw) || 0) },
    items: (list.results || []).map((r) => ({
      id: Number(r.id), productName: String(r.product_name ?? ''), price: Number(r.price) || 0,
      status: String(r.status ?? 'unused'), soldAt: String(r.sold_at ?? ''), usedAt: (r.used_at as string | null) ?? null,
    })),
  }
}

/**
 * 에이전시 콘솔 판매 알림 — 이 직원이 볼 수 있는 매장들에서 **이 에이전시 이용권**이 팔린 주문.
 * 매장 알림함(`dashboard_notifications`)은 누구 이용권인지 행에 없어 쓸 수 없다 — 판매 기록에서 바로 만든다.
 * 그래서 결제 확정 경로(잠금 파일)를 건드리지 않는다.
 */
export async function agencySaleEvents(DB: D1Database, agencyId: number, sellerIds: number[], limit: number) {
  const ids = sellerIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 60)
  if (ids.length === 0) return []
  const { results } = await DB.prepare(
    `SELECT o.id AS order_id, o.seller_id, o.created_at, MIN(p.name) AS product_name, COUNT(DISTINCT p.id) AS kinds,
            COUNT(*) AS qty, SUM(COALESCE(v.applied_price, p.price, 0)) AS amount
       ${VOUCHER_BASE}
       JOIN agency_product_periods pr ON ${periodMatchSql('pr', 'v.product_id', 'p.seller_id')} AND pr.agency_id = ?
      WHERE p.seller_id IN (${ids.map(() => '?').join(',')}) AND COALESCE(v.is_experience, 0) = 0
        AND o.created_at >= datetime('now', '-30 days')
      GROUP BY o.id
      ORDER BY o.created_at DESC LIMIT ?`,
  ).bind(agencyId, ...ids, limit).all<{ order_id: number; seller_id: number; created_at: string; product_name: string; kinds: number; qty: number; amount: number }>()
    .catch((e) => { if (isMissingTable(e)) return { results: [] as never[] }; throw e })
  return results || []
}

// ── 맡은 기간 기록 — `agency_products`(지금) 와 `agency_product_periods`(기간) 를 바꾸는 길은 아래 셋뿐 ──────────

/** 에이전시 좌석으로 이용권을 만들었다 — 지금 맡음 + 기간 시작. 이미 맡은 게 있으면 그대로(멱등). */
export async function startAgencyProduct(DB: D1Database, productId: number, sellerId: number, agencyId: number, staffId: number | null): Promise<void> {
  const r = await DB.prepare(
    'INSERT OR IGNORE INTO agency_products (product_id, seller_id, agency_id, created_by_staff_id) VALUES (?, ?, ?, ?)',
  ).bind(productId, sellerId, agencyId, staffId).run()
  if ((r.meta?.changes ?? 0) > 0) {
    await DB.prepare('INSERT INTO agency_product_periods (product_id, seller_id, agency_id) VALUES (?, ?, ?)')
      .bind(productId, sellerId, agencyId).run()
  }
}

/**
 * 사장님이 이용권을 에이전시에 맡기거나(agencyId) 돌려받는다(null). 열린 기간을 닫고 새 기간을 연다 —
 * 그래서 옮기기 전 판매는 앞 에이전시 몫으로 남는다. 반환: 바뀌었는가.
 */
export async function assignAgencyProduct(DB: D1Database, productId: number, sellerId: number, agencyId: number | null): Promise<boolean> {
  const cur = await DB.prepare('SELECT agency_id FROM agency_products WHERE product_id = ? AND seller_id = ?')
    .bind(productId, sellerId).first<{ agency_id: number }>()
  if ((cur?.agency_id ?? null) === agencyId) return false
  const stmts = [
    DB.prepare("UPDATE agency_product_periods SET ended_at = datetime('now') WHERE product_id = ? AND seller_id = ? AND ended_at IS NULL").bind(productId, sellerId),
    DB.prepare('DELETE FROM agency_products WHERE product_id = ? AND seller_id = ?').bind(productId, sellerId),
  ]
  if (agencyId != null) {
    stmts.push(
      DB.prepare('INSERT INTO agency_products (product_id, seller_id, agency_id) VALUES (?, ?, ?)').bind(productId, sellerId, agencyId),
      DB.prepare('INSERT INTO agency_product_periods (product_id, seller_id, agency_id) VALUES (?, ?, ?)').bind(productId, sellerId, agencyId),
    )
  }
  await DB.batch(stmts)
  return true
}

/**
 * 맡김이 끝났다(사장님이 끊음 · 에이전시가 내려놓음) — 그 에이전시 이용권을 사장님께 돌린다.
 * 그동안의 판매는 기간 기록에 남아 그 에이전시 성과로 계속 보인다. 이용권·주문은 매장에 그대로다.
 */
export async function releaseAgencyProducts(DB: D1Database, sellerId: number, agencyId: number): Promise<void> {
  await DB.batch([
    DB.prepare("UPDATE agency_product_periods SET ended_at = datetime('now') WHERE seller_id = ? AND agency_id = ? AND ended_at IS NULL").bind(sellerId, agencyId),
    DB.prepare('DELETE FROM agency_products WHERE seller_id = ? AND agency_id = ?').bind(sellerId, agencyId),
  ])
}
