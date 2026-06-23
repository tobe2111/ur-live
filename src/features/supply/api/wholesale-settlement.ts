/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 제조사(공급자) 정산 배선 (Phase 2 후속).
 *
 * B2B 선결제 주문(판매사→유통스타트) 결제완료 시, 각 라인의 제조사 공급가(base × qty)를
 * 제조사(supplier)에게 적립 → 기존 공급자 지급 파이프라인(matureSupplierSettlements →
 * payoutSupplier)이 7일 환불창 성숙 후 자동 지급.
 *
 * 충돌 방지: supplier_settlements.source='wholesale' 로 consumer(드랍쉽) 정산과 분리.
 *   - consumer 정산: source='consumer' (default). reverseSupplierOnRefund 가 wholesale 제외.
 *   - wholesale 정산: 이 파일에서만 적립/역전.
 * 멱등: 같은 wholesale_order_id + source='wholesale' 이미 있으면 재적립 안 함.
 */
import { recordLedger } from '@/worker/utils/ledger'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

const REFUND_WINDOW_DAYS = 7
// 🛡️ 브랜드제품: '거의 당일' 정산이되 최소 환불 클로백 안전창(1일) 확보 — 지급 후 환불로 인한 미회수 방지.
const BRAND_REFUND_WINDOW_DAYS = 1

/**
 * 🆕 2026-06-17 대표 확정 모델 (cost-plus): 제조사가 받을 금액(공급원가) *위에* 플랫폼 마진%를 붙여 공급가 산출.
 *   → 공급가에는 이미 플랫폼 마진이 *포함*돼 있으므로, 정산은 단순 분리:
 *        제조사 정산 = 공급원가(입력가) 전액,  플랫폼 = 공급가 − 공급원가.
 *   기본 마진은 platform_settings.wholesale_platform_commission_pct(기본 10, 어드민 편집) — 공급가 *산출* 단계
 *   (distributor-pricing.resolveDistributorPrice)에서 적용되고, 여기 분리에는 commPct 가 더는 필요 없음(공급가에 내재).
 */
export const DEFAULT_PLATFORM_COMMISSION_PCT = 10
export async function loadPlatformCommissionPct(DB: D1Database): Promise<number> {
  const row = await DB.prepare(
    "SELECT value FROM platform_settings WHERE key = 'wholesale_platform_commission_pct'"
  ).first<{ value: string }>().catch(() => null)
  const v = Number(row?.value)
  return Number.isFinite(v) && v >= 0 && v <= 90 ? v : DEFAULT_PLATFORM_COMMISSION_PCT
}

/** 라인 단가 정산 분해 — 제조사 = 공급원가 전액(입력가), 플랫폼 = 공급가 − 공급원가. 주문생성·정산 공용 SSOT.
 *  (🆕 2026-06-17: 마진은 공급가 산출 시 이미 붙으므로 commPct 미사용 — 시그니처 호환 위해 인자만 보존.) */
export function splitWholesaleUnit(distributorUnit: number, costFloor: number, _commPct?: number): { manufacturerUnit: number; platformUnit: number } {
  const dist = Math.max(0, Math.floor(distributorUnit || 0))
  const floor = Math.max(0, Math.floor(costFloor || 0))
  const manufacturerUnit = Math.min(floor, dist) // 제조사 = 입력가 전액(공급가 초과 안 하도록 안전 clamp)
  return { manufacturerUnit, platformUnit: Math.max(0, dist - manufacturerUnit) }
}

// 🛡️ 2026-06-08 OPS-2: 완료된 ensure 만 promise 로 캐시(supply-visibility.ts 패턴).
//   기존 WeakSet 는 add 를 await *전* 에 해서, 첫 호출의 ALTER 가 일시 실패(락/타임아웃)하면
//   DB 가 '완료됨'으로 영구 마킹돼 컬럼 없는 채 모든 후속 호출이 통과 → source 쿼리 500 영구화.
//   in-flight promise 를 공유하고, 실패 시 캐시를 delete 해 다음 호출이 재시도하도록 한다.
const _sourceEnsuring = new WeakMap<object, Promise<void>>()
/** supplier_settlements.source 컬럼 보장 (repair-schema CI 불안정 대비). */
async function ensureSourceColumn(DB: D1Database): Promise<void> {
  const existing = _sourceEnsuring.get(DB)
  if (existing) return existing
  const p = _doEnsureSourceColumn(DB)
  _sourceEnsuring.set(DB, p)
  try {
    await p
  } catch {
    _sourceEnsuring.delete(DB) // 실패 시 다음 호출이 재시도
  }
}
async function _doEnsureSourceColumn(DB: D1Database): Promise<void> {
  // CREATE/ALTER 문은 기존과 동일 — 이미 존재하면 무시(컬럼 추가는 1회).
  await DB.prepare("ALTER TABLE supplier_settlements ADD COLUMN source TEXT DEFAULT 'consumer'")
    .run().catch(() => { /* 이미 존재 — 무시 */ })
  // 🛡️ 2026-06-19 (머니 감사): 적립/클로백의 ON CONFLICT(order_id, product_id, source) 타겟 보장.
  //   creditSupplier 가 항상 호출하는 ensure 라 여기서 보장하면, 인덱스 부재로 ON CONFLICT 가 throw→미적립 되는
  //   경로를 원천 차단. source 컬럼 추가 직후라 안전. 기존 중복행 있으면 생성 실패→swallow(repair-schema 가 정리).
  await DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_settle_unique ON supplier_settlements(order_id, product_id, source)")
    .run().catch(() => { /* 이미 존재 / 중복행 — 무시(repair-schema 보강) */ })
}

interface WholesaleLine {
  product_id: number
  supplier_id: number
  qty: number
  base_supply_price: number
  distributor_unit_price: number
}

/**
 * 도매 주문의 제조사 라인을 공급자에게 적립 (pending). 멱등.
 * @returns 적립된 라인 수
 */
export async function creditSupplierOnWholesaleOrder(DB: D1Database, wholesaleOrderId: number): Promise<number> {
  if (!wholesaleOrderId) return 0
  await ensureSourceColumn(DB)

  // 멱등 가드.
  const existing = await DB.prepare(
    "SELECT 1 FROM supplier_settlements WHERE order_id = ? AND source = 'wholesale' LIMIT 1"
  ).bind(wholesaleOrderId).first().catch(() => null)
  if (existing) return 0

  // 🛡️ 스펙 정산 분기: 브랜드제품(is_brand_product=1) = 판매 후 당일(즉시 available) / 일반제품 = 7일 환불창 성숙.
  //   products.is_brand_product 없을 수 있어 LEFT JOIN + COALESCE(0).
  const rows = await DB.prepare(`
    SELECT i.product_id, i.supplier_id, i.qty, i.base_supply_price, i.distributor_unit_price,
           COALESCE(p.is_brand_product, 0) AS is_brand_product
    FROM wholesale_order_items i LEFT JOIN products p ON p.id = i.product_id
    WHERE i.wholesale_order_id = ? AND i.supplier_id IS NOT NULL AND i.base_supply_price > 0
  `).bind(wholesaleOrderId).all<WholesaleLine & { is_brand_product: number }>().catch(() => ({ results: [] as (WholesaleLine & { is_brand_product: number })[] }))

  let credited = 0
  const notifySuppliers = new Set<number>()
  // 🆕 2026-06-16 정산 분배: 제조사 = max(원가, 공급가×(1−수수료%)), 플랫폼 = 공급가 − 제조사(= 수수료).
  const commPct = await loadPlatformCommissionPct(DB)
  const generalAvailableAt = new Date(Date.now() + REFUND_WINDOW_DAYS * 86400_000).toISOString()
  const brandAvailableAt = new Date(Date.now() + BRAND_REFUND_WINDOW_DAYS * 86400_000).toISOString()
  for (const r of rows.results || []) {
    const qty = Math.max(1, Math.floor(Number(r.qty) || 1))
    const distUnit = Math.floor(Number(r.distributor_unit_price) || 0) // 판매사 지불 단가(공급가, tier할인 반영)
    const { manufacturerUnit } = splitWholesaleUnit(distUnit, Number(r.base_supply_price) || 0, commPct)
    const supplyAmount = manufacturerUnit * qty // 제조사 정산액(원가 하한)
    if (supplyAmount <= 0) continue
    const retailAmount = distUnit * qty // 판매사 지불액(공급가 — retail−supply = 플랫폼 수수료)
    const isBrand = Number(r.is_brand_product) === 1
    const availableAt = isBrand ? brandAvailableAt : generalAvailableAt
    const noteText = isBrand ? 'B2B 도매주문(브랜드 — 익일정산/1일보호창)' : 'B2B 도매주문(일반 — 7일성숙)'

    // 🛡️ 2026-06-19 (머니 감사): 라인별 멱등 — idx_supplier_settle_unique(order_id, product_id, source) 로
    //   ON CONFLICT DO NOTHING. 기존 plain INSERT 는 중복 시 throw 라, 동시 같은-주문 경쟁의 부분 인터리브에서
    //   한 라인 throw → 루프 중단 → 나머지 라인 미적립(under-credit) 여지가 있었음. 이제 이미 적립된 라인은
    //   조용히 skip + 그 라인의 잔액증가·원장·카운트도 함께 skip(아래 changes 게이트) → 이중적립·잔액과다·미적립 0.
    //   정상(중복 없음) 경로는 동작 byte-identical.
    const insSettle = await DB.prepare(`
      INSERT INTO supplier_settlements (supplier_id, order_id, product_id, seller_id, retail_amount, supply_amount, status, available_at, source, note)
      VALUES (?, ?, ?, NULL, ?, ?, 'pending', ?, 'wholesale', ?)
      ON CONFLICT(order_id, product_id, source) DO NOTHING
    `).bind(r.supplier_id, wholesaleOrderId, r.product_id, retailAmount, supplyAmount, availableAt, noteText).run()
    if ((insSettle.meta?.changes ?? 0) === 0) continue // 이미 적립된 라인 → 잔액·원장·카운트 skip

    await DB.prepare(`
      INSERT INTO supplier_balances (supplier_id, pending_amount, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(supplier_id) DO UPDATE SET pending_amount = pending_amount + excluded.pending_amount, updated_at = datetime('now')
    `).bind(r.supplier_id, supplyAmount).run()

    try {
      await recordLedger(DB, {
        event_type: 'supplier_wholesale', reference_id: `whs-${wholesaleOrderId}`, amount: supplyAmount,
        debit_account: 'platform:wholesale', credit_account: `supplier:${r.supplier_id}`,
        metadata: { product_id: r.product_id, qty, wholesale_order_id: wholesaleOrderId },
      })
    } catch { /* ledger best-effort */ }
    notifySuppliers.add(r.supplier_id)
    credited++
  }

  // 제조사 대시보드 알림 — 주문 접수 시 발송 준비 안내 (제조사당 1회, best-effort).
  for (const sid of notifySuppliers) {
    try {
      await createDashboardNotification(
        DB, 'supplier', String(sid), 'wholesale_order',
        '새 도매 주문', '도매 주문이 접수되었습니다. 발송을 준비해주세요.', '/supplier/wholesale-orders',
      )
    } catch { /* best-effort */ }
  }
  return credited
}

/**
 * 🛡️ 2026-06-08 PAY-4: 제조사 잔고 캐시를 settlements(권위 출처) status별 SUM 으로 재계산(자가치유).
 *   (supply-settlement.ts 의 recomputeSupplierBalance 와 동일 패턴 — 파일 분리상 로컬 재정의.)
 *   consumer/wholesale 정산이 같은 supplier_settlements 테이블을 공유하므로 SUM 은 source 무관 전체 합 —
 *   supplier_balances 도 source 구분 없는 단일 잔고이므로 일관(기존 increment 도 동일 단일 잔고였음).
 */
async function recomputeSupplierBalance(DB: D1Database, supplierId: number): Promise<void> {
  await DB.prepare(
    `INSERT INTO supplier_balances (supplier_id, pending_amount, available_amount, paid_amount, updated_at)
     VALUES (
       ?,
       COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'pending'), 0),
       COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'), 0),
       COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'paid'), 0),
       datetime('now')
     )
     ON CONFLICT(supplier_id) DO UPDATE SET
       pending_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'pending'), 0),
       available_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'available'), 0),
       paid_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'paid'), 0),
       updated_at = datetime('now')`
  ).bind(supplierId, supplierId, supplierId, supplierId).run()
}

/**
 * 도매 주문 환불 시 제조사 적립 역전. 멱등.
 * 🛡️ 2026-06-08 PAY-1(클로백) + PAY-4(SUM 재계산):
 *   - pending/available(미지급): 기존처럼 'cancelled' 취소.
 *   - **이미 paid 된 정산**: 기존엔 SKIP → 플랫폼 손실. 이제 음수 클로백 row(status='available',
 *     supply_amount 음수, source='wholesale', note='clawback')를 추가 → available SUM 순감 →
 *     다음 payout 이 그만큼 적게 지급(net-out). 미래 잔고 부족(음수)이면 어드민 ops 알림.
 *   - 잔고는 per-row 버킷 감산 대신 supplier별 SUM 재계산(만기 레이스 제거).
 * @param supplierId 지정 시 해당 제조사 라인만 역전(부분환불). 미지정 시 주문 전체.
 * @param productIds 🛡️ 2026-06-12 (라인 선택 환불): 지정 시 그 상품 라인의 정산만 역전 —
 *   제조사가 일부 라인만 환불할 때 나머지 라인 정산이 같이 역전되는 과다 클로백 방지.
 *   미지정 시 기존 동작(스코프 내 전체) 그대로 — additive.
 * @returns 역전된 라인 수 (취소 + 클로백 합산)
 */
export async function reverseSupplierOnWholesaleRefund(
  DB: D1Database,
  wholesaleOrderId: number,
  reason: string,
  supplierId?: number,
  productIds?: number[],
): Promise<number> {
  if (!wholesaleOrderId) return 0
  await ensureSourceColumn(DB)
  const scoped = Number.isFinite(supplierId) && (supplierId as number) > 0
  const pids = (productIds || []).filter(p => Number.isFinite(p) && p > 0)
  const pidWhere = pids.length ? ` AND product_id IN (${pids.map(() => '?').join(',')})` : ''
  // 🛡️ PAY-1: paid 도 함께 조회(클로백 대상). 이미 클로백된 row(note='clawback')는 제외(멱등).
  // 🛡️ 2026-06-08 PAY-6(b): retail_amount 도 조회 — 환불되는 라인의 플랫폼 마진
  //   (retail − supply)을 wholesale_orders.margin_total 에서 비례 차감하기 위함.
  const rows = await DB.prepare(
    `SELECT id, supplier_id, product_id, supply_amount, retail_amount, status FROM supplier_settlements
     WHERE order_id = ? AND source = 'wholesale' AND status IN ('pending','available','paid') AND note IS NOT 'clawback'
     ${scoped ? 'AND supplier_id = ?' : ''}${pidWhere}`
  ).bind(...(scoped ? [wholesaleOrderId, supplierId] : [wholesaleOrderId]), ...pids)
    .all<{ id: number; supplier_id: number; product_id: number; supply_amount: number; retail_amount: number; status: string }>()
    .catch(() => ({ results: [] as { id: number; supplier_id: number; product_id: number; supply_amount: number; retail_amount: number; status: string }[] }))

  let reversed = 0
  let marginReversed = 0 // PAY-6(b): 역전 라인들의 플랫폼 마진 합(비례 차감용)
  const touchedSuppliers = new Set<number>()
  for (const a of rows.results || []) {
    const amt = Math.max(0, Math.floor(Number(a.supply_amount) || 0))
    // PAY-6(b): 이 라인의 플랫폼 마진 기여분 = retail − supply (적립 시 동일 산식으로 기록됨). 음수 클램프.
    const retail = Math.max(0, Math.floor(Number(a.retail_amount) || 0))
    const lineMargin = Math.max(0, retail - amt)
    // 🛡️ 2026-06-08 PAY-6(1) 원장 대칭: 적립 시 `debit platform:wholesale → credit supplier:N`.
    //   역전 시 대칭 반대 entry(debit supplier:N → credit platform:wholesale)로 공급자 외상을 상쇄 →
    //   getAccountBalance('supplier:N')=Σcredit−Σdebit 가 잔고 캐시(settlements SUM)와 다시 정합.
    //   amount 음수 불가(helper 거부)이므로 부호 대신 account swap. cancel/clawback 모두 동일 1회 기록.
    //   ⚠️ 멱등: ledger reverse entry + margin 차감 모두 *실제 상태 전환이 일어난 row* 에만 반영한다.
    //   paid row 는 환불 2회 호출 시 원본이 status='paid'(note≠'clawback')로 계속 재선택되므로,
    //   무조건 기록하면 ledger over-reverse + margin 이중 차감으로 Σ-invariant/마진 정합이 깨진다.
    //   clawback INSERT 가 실제 삽입(ON CONFLICT no-op 아님) 또는 cancel UPDATE 가 실제 변경일 때만.
    let effected = false
    if (a.status === 'paid') {
      // 🛡️ PAY-1 클로백: 음수 보정 row(available). product_id 음수로 기록 → 원본 라인과 별도 +
      //   idx_supplier_settle_unique(order_id, -product_id, 'wholesale') 로 재호출 시 중복 차단.
      const cb = await DB.prepare(
        `INSERT INTO supplier_settlements (supplier_id, order_id, product_id, seller_id, retail_amount, supply_amount, status, available_at, source, note)
         VALUES (?, ?, ?, NULL, 0, ?, 'available', datetime('now','-1 second'), 'wholesale', 'clawback')
         ON CONFLICT(order_id, product_id, source) DO NOTHING`
      ).bind(a.supplier_id, wholesaleOrderId, -Math.abs(a.product_id || 0), -amt).run().catch(() => null)
      effected = (cb?.meta?.changes ?? 0) > 0
    } else {
      const upd = await DB.prepare("UPDATE supplier_settlements SET status = 'cancelled', note = ? WHERE id = ? AND status IN ('pending','available')").bind(reason, a.id).run()
      effected = (upd.meta?.changes ?? 0) > 0
    }
    if (!effected) continue // 멱등 no-op (이미 역전된 row) — ledger/margin/카운트/잔고 무영향.
    marginReversed += lineMargin // 실제 역전된 라인의 마진만 누산(부분/반복 환불 비례 정합).
    if (amt > 0) {
      try {
        await recordLedger(DB, {
          event_type: 'supplier_wholesale_reversal', reference_id: `whs-${wholesaleOrderId}`, amount: amt,
          debit_account: `supplier:${a.supplier_id}`, credit_account: 'platform:wholesale',
          metadata: { product_id: a.product_id, prior_status: a.status, wholesale_order_id: wholesaleOrderId, reason },
        })
      } catch { /* ledger best-effort */ }
    }
    reversed++
    touchedSuppliers.add(a.supplier_id)
  }

  // 🛡️ PAY-4: 영향받은 제조사별 잔고 SUM 재계산 + 클로백 부족분 어드민 알림.
  for (const sid of touchedSuppliers) {
    await recomputeSupplierBalance(DB, sid).catch(() => { /* best-effort */ })
    const bal = await DB.prepare(
      "SELECT COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'), 0) AS avail"
    ).bind(sid).first<{ avail: number }>().catch(() => null)
    const avail = Math.floor(Number(bal?.avail) || 0)
    if (avail < 0) {
      try {
        await createDashboardNotification(
          DB, 'admin', null, 'supplier_clawback_shortfall',
          '제조사 클로백 잔고 부족',
          `제조사 #${sid} 의 지급 후 도매 환불 클로백을 향후 정산으로 상계하지 못했습니다(부족 ₩${Math.abs(avail).toLocaleString()}). 직접 회수가 필요합니다. (도매주문 #${wholesaleOrderId})`,
          '/admin/suppliers',
        )
      } catch { /* 알림 best-effort */ }
    }
  }

  // 🛡️ 2026-06-08 PAY-6(b) 마진 비례 역전: 주문 생성 시 wholesale_orders.margin_total = subtotal − supply_total
  //   (플랫폼 B2B 총마진)을 기록만 하고 환불 시 줄이지 않아, 부분/전액 환불 후에도 마진이 과대 집계됐다.
  //   이번 역전 라인들의 마진 기여분(Σ retail − supply, 위 루프에서 누산)만큼 차감 → 환불 비례 정합.
  //   - 멱등: 역전된 settlement row 는 cancelled/clawback 으로 마킹돼 재호출 시 재선택 안 됨(marginReversed=0).
  //   - 음수 클램프 MAX(0, …): 반올림/혼합 환불로 누적 차감이 원금 초과해도 margin_total 음수 방지.
  //   - retail/supply 분리 컬럼을 그대로 사용 — split/VAT/반올림 산식 미변경(차감액=기존 적립 산식의 역).
  //   best-effort(집계 필드, 정산 자체는 settlements/balances 가 권위) — 실패해도 역전은 유효.
  if (reversed > 0 && marginReversed > 0) {
    await DB.prepare(
      "UPDATE wholesale_orders SET margin_total = MAX(0, COALESCE(margin_total,0) - ?) WHERE id = ?"
    ).bind(marginReversed, wholesaleOrderId).run().catch(() => { /* best-effort: 집계 필드 */ })
  }
  return reversed
}
