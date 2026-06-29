/**
 * 🆕 2026-06-27 fee-resolver 그림자 배선(shadow) — 결제 확정 시 새 수수료 규칙 분배를
 *   **계산만 해서 기록**한다. 실제 정산/적립은 *전혀 바꾸지 않음*(현행 커미션 그대로).
 *
 *   목적: 잠긴 결제경로에 리졸버를 "연결"하되, 라이브 돈은 안 건드리고 → 스테이징/운영에서
 *   `order_fee_breakdown` 기록을 현행 정산과 **비교 검증** → 검증 후에야 authoritative 전환(별도).
 *
 *   안전: 순수 additive(INSERT OR IGNORE) + fail-soft. FEE_RESOLVER_ENABLED='true' 일 때만 호출.
 *   per-agency 율·기간(어드민 설정)을 그대로 반영 — pctOverride + withinTerm 판정.
 *   공급가(supplyCost)도 order_items 공급라인에서 계산해 주입 → 그림자 owner_net 이 authoritative
 *   전환 후 값과 동일(검증 유효). promo(핀 소개비)만 미모델링(0) — 주인 자율값이라 per-order 권위 없음.
 *
 *   ⚠️ 멱등 INSERT OR IGNORE: 요율을 바꾼 뒤 같은 주문을 다시 기록해도 *덮어쓰지 않음*. 새 요율로
 *   재계산하려면 백필(admin-fee-breakdown.routes recompute=1) 로 해당 주문 row 를 갱신.
 */
import { resolveOrderFees, loadFeeRates, type AgencyContext } from './fee-resolver'
import { swallow } from './swallow'

const _schemaDone = new WeakSet<object>()
async function ensureFeeBreakdownSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS order_fee_breakdown (
    order_id INTEGER PRIMARY KEY,
    amount INTEGER NOT NULL,
    ownership TEXT NOT NULL,
    platform INTEGER NOT NULL,
    agency INTEGER NOT NULL,
    platform_net INTEGER NOT NULL,
    promo INTEGER NOT NULL,
    supply INTEGER NOT NULL,
    owner_net INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('feebreakdown:schema'))
}

/** 주문 1건의 새 규칙 분배를 계산해 기록(그림자). 실제 정산 무변경. */
export async function recordOrderFeeBreakdown(
  DB: D1Database,
  order: { id: number; seller_id?: number | null; total_amount?: number | null },
): Promise<void> {
  try {
    const amount = Math.round(Number(order.total_amount) || 0)
    if (!order.id || amount <= 0) return
    const ownership: '1P' | '3P' = order.seller_id ? '3P' : '1P'  // 어드민 업로드(seller 없음)=1P

    // per-agency 컨텍스트(어드민 설정 율·기간 반영) — 영입 가게면.
    let agency: AgencyContext | null = null
    if (order.seller_id) {
      const s = await DB.prepare('SELECT introduced_by_agency_id FROM sellers WHERE id = ?')
        .bind(order.seller_id).first<{ introduced_by_agency_id: number | null }>().catch(() => null)
      const agencyId = s?.introduced_by_agency_id
      if (agencyId) {
        let pctOverride: number | undefined
        let termMonths = 0
        try {
          const a = await DB.prepare('SELECT store_intro_commission_pct AS pct, commission_term_months AS term FROM agencies WHERE id = ?')
            .bind(agencyId).first<{ pct: number | null; term: number | null }>()
          if (typeof a?.pct === 'number' && Number.isFinite(a.pct)) pctOverride = a.pct
          const t = Number(a?.term); termMonths = Number.isFinite(t) && t > 0 ? t : 0
        } catch { /* 컬럼 미존재 — 기본 율/무제한 */ }
        // withinTerm: termMonths>0 면 가게 활성화(첫 결제) 경과로 판정. 활성화 기록 없으면 첫 결제=within.
        let withinTerm = true
        if (termMonths > 0) {
          const age = await DB.prepare(
            "SELECT (julianday('now') - julianday(created_at)) AS days FROM agency_store_intro_commissions WHERE store_seller_id = ? AND type = 'signup_bonus' ORDER BY created_at ASC LIMIT 1"
          ).bind(order.seller_id).first<{ days: number }>().catch(() => null)
          if (age && (Number(age.days) || 0) > termMonths * 30.44) withinTerm = false
        }
        agency = { agencyId, active: true, withinTerm, pctOverride }
      }
    }

    // 공급가(B2B 원가) — 공급상품 라인(supply_source_id)의 공급가 합. authoritative 전환 시 resolver 가
    //   쓸 값과 동일하게 *여기서* 계산해야 검증이 유효(그림자 owner_net == 전환 후 owner_net).
    //   supplier_settlements 의 supplier_amount(=supply_price, calcSupplySplit) 와 같은 base.
    let supplyCost = 0
    if (order.seller_id) {
      const sc = await DB.prepare(`
        SELECT COALESCE(SUM(COALESCE(sp.supply_price, 0) * oi.quantity), 0) AS supply_total
          FROM order_items oi
          JOIN products sp ON sp.id = oi.product_id
         WHERE oi.order_id = ?
           AND sp.supply_source_id IS NOT NULL
           AND COALESCE(sp.supply_price, 0) > 0
      `).bind(order.id).first<{ supply_total: number }>().catch(() => null)
      const t = Math.round(Number(sc?.supply_total) || 0)
      supplyCost = Number.isFinite(t) && t > 0 ? t : 0
    }

    const rates = await loadFeeRates(DB)
    const b = resolveOrderFees({ amount, ownership, productKind: 'shopping', supplyCost, agency }, rates)
    await ensureFeeBreakdownSchema(DB)
    await DB.prepare(
      `INSERT OR IGNORE INTO order_fee_breakdown
         (order_id, amount, ownership, platform, agency, platform_net, promo, supply, owner_net)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(order.id, b.amount, b.ownership, b.platform, b.agency, b.platformNet, b.promo, b.supply, b.ownerNet)
      .run().catch(() => { /* UNIQUE 재confirm — 멱등 */ })
  } catch { /* fail-soft — 결제/정산 절대 안 막음 */ }
}
