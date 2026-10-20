/**
 * 💸 promo owner-펀딩 원장 차감/역전 — ledger.ts 에서 추출(2026-07-12, file-size 래칫).
 *   함수 본문은 ledger.ts 시절과 byte-동일(추출만) — 로직 변경 0.
 *
 * 💸 2026-07-04 (promo owner-펀딩 — docs/design/commission-funding-restructure.md §3-D):
 *   핀 추천 소개비(affiliate)를 **주인(매장/셀러) 부담**으로 이전하는 원장 차감.
 *   추천인에게는 현행대로 딜이 적립되고(affiliate-credit), 같은 금액을 주인 receivable 에서
 *   debit → platform:revenue 로 회수(플랫폼이 딜 지급 재원을 주인 몫에서 충당).
 *
 *   게이트: platform_settings.promo_funding_source === 'owner' 일 때만 (기본 'platform' = no-op 현행)
 *   + 파일럿 매장 스코프(flip-pilot.ts — 전역 OFF 여도 지정 매장만 검증).
 *   멱등: reference_id = `order:{id}:promo` 주문당 1회.
 *   호출: 이용권 사용 확정 시(group-buy-voucher.routes — 주인 receivable 이 생기는 시점과 동일).
 *   역전: reverseOwnerPromoDebit (환불 시 affiliate clawback 과 함께 — order-refund.ts).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { recordLedger, ensureLedgerTable } from './ledger'

/**
 * 💸 [INV-#44] 이 매장이 **owner-펀딩(promo flip)** 대상인가.
 *
 * 전역 스위치(`promo_funding_source='owner'`) 또는 파일럿 매장 스코프(`flip-pilot.ts`) 중 하나면 true.
 * `debitOwnerPromoForOrder` 가 쓰던 판정을 그대로 뽑아낸 것이다 — 같은 flip 을 여러 축
 * (어필리에이트 / 에이전시 share / 인플 소개 share)이 **공유**해야 "5% 불가침"이 축마다 갈리지 않는다.
 *
 * fail-soft: 조회 실패 시 false(= 현행 플랫폼 재원). **모르면 바꾸지 않는다**가 안전한 방향이다.
 */
export async function isOwnerFunded(DB: D1Database, sellerId?: number | string | null): Promise<boolean> {
  try {
    const src = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'promo_funding_source'")
      .first<{ value: string }>().catch(() => null)
    if (src?.value === 'owner') return true
    const id = Number(sellerId)
    if (!Number.isFinite(id) || id <= 0) return false
    const { readFlipPilotSellerIds } = await import('./flip-pilot')
    return (await readFlipPilotSellerIds(DB)).has(id)
  } catch { return false }
}

/** @returns 차감된 금액 (no-op 이면 0) */
export async function debitOwnerPromoForOrder(
  DB: D1Database,
  params: {
    orderId?: number | string | null
    /** orderId 미보유 호출부(셀러 PIN 사용 등)용 — vouchers.order_id 를 조회해 해석 */
    voucherId?: number | string | null
    /** 주인 원장 계정 — 예: `merchant:{id}` (이용권) / `seller:{id}` (쇼핑) */
    ownerAccount: string
  },
): Promise<number> {
  try {
    const src = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'promo_funding_source'")
      .first<{ value: string }>().catch(() => null)
    const ownerFunded = src?.value === 'owner'

    // 💸 2026-07-12 파일럿 매장 스코프 — 전역이 platform 이어도 지정 매장 주문이면 owner 되갚기(검증용).
    //   전역 owner 면 pilot 조회 생략(perf). 전역 platform + 파일럿 없음 = 즉시 현행(return 0).
    const { readFlipPilotSellerIds } = await import('./flip-pilot')
    const pilot = ownerFunded ? new Set<number>() : await readFlipPilotSellerIds(DB)
    if (!ownerFunded && pilot.size === 0) return 0

    let orderId = params.orderId
    if (!orderId && params.voucherId) {
      const v = await DB.prepare('SELECT order_id FROM vouchers WHERE id = ?')
        .bind(params.voucherId).first<{ order_id: number | null }>().catch(() => null)
      orderId = v?.order_id ?? null
    }
    if (!orderId || !params.ownerAccount) return 0

    // 파일럿 판정 — ownerAccount('merchant:{id}'/'seller:{id}') 또는 orders.seller_id 가 파일럿 목록에.
    if (!ownerFunded) {
      const m = /(?:merchant|seller):(\d+)/.exec(params.ownerAccount)
      let sellerId = m ? Number(m[1]) : null
      if (sellerId == null || !pilot.has(sellerId)) {
        const row = await DB.prepare('SELECT seller_id FROM orders WHERE id = ?')
          .bind(orderId).first<{ seller_id: number | null }>().catch(() => null)
        if (row?.seller_id != null) sellerId = Number(row.seller_id)
      }
      if (!(sellerId != null && pilot.has(sellerId))) return 0
    }

    await ensureLedgerTable(DB)
    const ref = `order:${orderId}:promo`
    const existing = await DB.prepare(
      `SELECT id FROM ledger_entries WHERE reference_id = ? AND event_type = 'promo_fee' LIMIT 1`,
    ).bind(ref).first().catch(() => null)
    if (existing) return 0

    // 💸 2026-07-12 (S4a per-axis owner-redirect — commission-funding-restructure.md §flip 구현 스펙):
    //   owner 되갚기 = 이 주문에서 **딜로 지급된** 성장 커미션 총합. 딜 지급 축은 platform:revenue 를
    //   debit 하지 않으므로(user_points 부채), 여기서 merchant→platform:revenue 로 크레딧해 그 딜 재원을
    //   매장 promo(5% 밖)로 충당. 역전(reverseOwnerPromoDebit)이 이 저장 금액을 그대로 되돌리므로
    //   **합산 대상을 넓혀도 환불 대칭 자동 보장**(리스크 낮음 — 대표 조건 ②). 축:
    //     C1 affiliate_earnings(holding/granted) · C2 referral_commissions · C3 influencer_attributions
    //     (source='store_intro') · C4 agency_store_intro_commissions(sales_commission).
    //   confirm-시점(system-1)과 사용-시점 셰어(system-2)는 주문당 상호배타(dedup)라 이중합산 없음.
    //   ⚠️ C2 status 어휘('되갚을 활성분' 정의)는 코드만으론 확정 불가 → 아래는 보수적 필터(cancelled/
    //      withdrawn/refunded/clawed_back 제외 = 실지급분). **staging 실결제 축별 검증 필수(조건 ①).**
    const sums = await DB.batch<{ total: number }>([
      DB.prepare(`SELECT COALESCE(SUM(commission), 0) AS total FROM affiliate_earnings
                   WHERE order_id = ? AND COALESCE(status, '') IN ('holding', 'granted')`).bind(orderId),
      DB.prepare(`SELECT COALESCE(SUM(commission_amount), 0) AS total FROM referral_commissions
                   WHERE order_id = ? AND COALESCE(status, '') NOT IN ('withdrawn')`).bind(orderId),
      DB.prepare(`SELECT COALESCE(SUM(commission_amount), 0) AS total FROM influencer_attributions
                   WHERE order_id = ? AND source = 'store_intro'
                     AND COALESCE(status, '') NOT IN ('clawed_back', 'cancelled')`).bind(orderId),
      DB.prepare(`SELECT COALESCE(SUM(commission_amount), 0) AS total FROM agency_store_intro_commissions
                   WHERE order_id = ? AND type = 'sales_commission'
                     AND COALESCE(status, '') != 'cancelled'`).bind(orderId),
    ]).catch(() => null)
    const promo = Math.max(0, Math.round(
      (sums || []).reduce((acc, r) => acc + (Number(r?.results?.[0]?.total) || 0), 0)
    ))
    if (promo <= 0) return 0

    await recordLedger(DB, {
      event_type: 'promo_fee',
      reference_id: ref,
      amount: promo,
      debit_account: params.ownerAccount,   // 주인 receivable 차감
      credit_account: 'platform:revenue',   // 딜 지급 재원 회수
      metadata: { kind: 'owner_promo_fee', order_id: orderId },
    })
    return promo
  } catch {
    return 0 // fail-soft — 사용 확정/정산 흐름 불막음 (미차감 방향 = 주인에게 유리, 안전)
  }
}

/**
 * 환불 시 promo 차감 역전(멱등) — affiliate clawback 과 대칭. debit 이 없으면 no-op.
 */
export async function reverseOwnerPromoDebit(
  DB: D1Database,
  orderId: number | string,
  reason: string,
): Promise<void> {
  try {
    if (!orderId) return
    const ref = `order:${orderId}:promo`
    const orig = await DB.prepare(
      `SELECT debit_account, amount FROM ledger_entries WHERE reference_id = ? AND event_type = 'promo_fee' LIMIT 1`,
    ).bind(ref).first<{ debit_account: string; amount: number }>().catch(() => null)
    if (!orig || !(Number(orig.amount) > 0)) return
    const done = await DB.prepare(
      `SELECT id FROM ledger_entries WHERE reference_id = ? AND event_type = 'promo_fee_reversal' LIMIT 1`,
    ).bind(ref).first().catch(() => null)
    if (done) return
    await recordLedger(DB, {
      event_type: 'promo_fee_reversal',
      reference_id: ref,
      amount: Number(orig.amount),
      debit_account: 'platform:revenue',
      credit_account: String(orig.debit_account), // 주인 receivable 복원
      metadata: { kind: 'owner_promo_fee_reversal', order_id: orderId, reason },
    })
  } catch { /* fail-soft */ }
}
