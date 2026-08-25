/**
 * 💸 이용권 커미션 clawback — `helpers.ts` 에서 추출(2026-08-25, file-size 래칫).
 *   본문은 추출 시점과 동일 + 원장 셰어 역전 배선 1건. 호출부는 `helpers` 재수출로 무수정.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { adjustUserPoints } from '../../../worker/utils/point-ledger'

/**
 * 🛡️ 2026-05-30: 인플루언서 커미션 clawback — voucher 환불/취소 시 미지급 커미션 회수.
 *   admin force-refund(group-buy-admin.routes.ts:272) / 만료 cron(auto-settlement.ts:259) 의
 *   인라인 로직을 공유 헬퍼로 통합 — 셀러 /refund + 사용자 셀프취소 누수 차단.
 *   pending/available + paid_at IS NULL 건만 회수 (이미 송금된 'paid' 는 미차감 — 다음 정산 음수 처리).
 *   best-effort: 호출자가 try/catch 또는 waitUntil 로 감쌀 것 (환불 자체는 항상 진행).
 */
export async function clawbackVoucherCommission(
  DB: D1Database,
  voucherId: number,
  reason: string,
): Promise<number> {
  let clawed = 0
  // 💸 2026-08-25 [머니 룰 #2] 원장 셰어 역전 — 이 함수는 여태 `influencer_balances` 만 만지고
  //   **원장(`voucher:N:agency` / `voucher:N:intro-inf`)은 손대지 않았다.** 그래서 환불·만료된
  //   이용권의 에이전시/인플 셰어가 원장에 영구히 남았다(플랫폼 수익 과소·수취인 과대).
  //   flip 이 켜지면 그 부담이 **매장**으로 가므로 더 나쁘다 → 여기서 같이 되돌린다.
  //   fail-soft: 역전 실패가 기존 clawback 을 막지 않는다.
  try {
    const { reverseVoucherCommissionShares } = await import('../../../worker/utils/ledger')
    await reverseVoucherCommissionShares(DB, voucherId, reason)
  } catch { /* 관측 실패가 회수를 막지 않는다 */ }
  // 🛡️ 2026-05-31: attribution 은 주문(order_id) 단위 1행(커미션=주문 총액 기준), 환불은 바우처 단위.
  //   이전 버그: attribution.voucher_id 는 항상 NULL(insert 누락) → `WHERE voucher_id=?` 매칭 0건
  //   → 환불/취소/만료 시 인플 커미션이 전혀 회수 안 됨(누수). order_id 로 연결하고 바우처 비례 clawback.
  const v = await DB.prepare('SELECT order_id FROM vouchers WHERE id = ?').bind(voucherId).first<{ order_id: number | null }>().catch(() => null)
  const orderId = v?.order_id ?? null

  // attribution 조회: order_id 우선(신규), 레거시 voucher_id fallback.
  const attrRows = orderId
    ? await DB.prepare(
        `SELECT id, influencer_id, commission_amount, status FROM influencer_attributions
         WHERE order_id = ? AND order_id != 0 AND status IN ('pending', 'available') AND paid_at IS NULL`
      ).bind(orderId).all<{ id: number; influencer_id: string; commission_amount: number; status: string }>()
    : await DB.prepare(
        `SELECT id, influencer_id, commission_amount, status FROM influencer_attributions
         WHERE voucher_id = ? AND status IN ('pending', 'available') AND paid_at IS NULL`
      ).bind(voucherId).all<{ id: number; influencer_id: string; commission_amount: number; status: string }>()
  const attrs = attrRows.results || []
  if (attrs.length === 0) return 0

  // 비례 분모: 주문 내 아직 회수 안 된 바우처 수(이 바우처 포함). 환불 flow 가 voucher.status='refunded'/'expired'
  //   를 clawback 직전 설정하므로, unused/used + 현재 바우처(id=?) 카운트 → 회수된 건 자동 제외.
  let denom = 1
  if (orderId) {
    const cntRow = await DB.prepare(
      `SELECT COUNT(*) AS n FROM vouchers WHERE order_id = ? AND (id = ? OR status IN ('unused', 'used'))`
    ).bind(orderId, voucherId).first<{ n: number }>().catch(() => null)
    denom = Math.max(1, Number(cntRow?.n ?? 1))
  }

  // 🛡️ 2026-06-11 [UNLOCK] (사용자 승인): 행당 2 write 루프 → 단일 DB.batch (원자 + 왕복 1회).
  //   각 write 는 사전 조회값으로만 계산(read-after-write 없음) — 의미 동일, 부분실패만 제거.
  const clawStmts: D1PreparedStatement[] = []
  for (const a of attrs) {
    // 이 바우처 몫 = 남은 커미션 / 남은(미회수) 바우처 수. qty=1 이면 전액.
    const share = orderId
      ? Math.min(a.commission_amount, Math.max(1, Math.floor(a.commission_amount / denom)))
      : a.commission_amount
    // balance 즉시 차감(즉각 일관성). 권위 출처는 attribution SUM 이라 cron 이 재집계로 보정.
    if (a.status === 'pending') {
      clawStmts.push(DB.prepare("UPDATE influencer_balances SET pending_amount = MAX(0, pending_amount - ?), updated_at = datetime('now') WHERE influencer_id = ?")
        .bind(share, a.influencer_id))
    } else if (a.status === 'available') {
      clawStmts.push(DB.prepare("UPDATE influencer_balances SET available_amount = MAX(0, available_amount - ?), updated_at = datetime('now') WHERE influencer_id = ?")
        .bind(share, a.influencer_id))
    }
    // attribution(권위 출처) 갱신: 전액 회수면 clawed_back, 부분이면 commission_amount 차감(나머지 바우처 몫 유지).
    const remaining = a.commission_amount - share
    if (remaining <= 0) {
      clawStmts.push(DB.prepare("UPDATE influencer_attributions SET status = 'clawed_back', commission_amount = 0, clawback_reason = ? WHERE id = ?")
        .bind(reason, a.id))
    } else {
      clawStmts.push(DB.prepare("UPDATE influencer_attributions SET commission_amount = ?, clawback_reason = ? WHERE id = ?")
        .bind(remaining, reason, a.id))
    }
    clawed++
  }
  if (clawStmts.length > 0) await DB.batch(clawStmts)

  // 🛡️ 2026-05-31: 에이전시 입점 sales_commission(구매 시 order 단위 적립) 도 동일 비례 회수.
  //   payout 은 agency_store_intro_commissions 를 status 별 SUM(commission_amount) 로 집계하므로
  //   cancelled 전환 + 부분 감액이면 정합. paid 는 제외(이미 송금). order_id 없으면 skip.
  if (orderId) {
    try {
      const ag = await DB.prepare(
        `SELECT id, commission_amount FROM agency_store_intro_commissions
         WHERE order_id = ? AND type = 'sales_commission' AND status IN ('pending', 'available') AND paid_at IS NULL`
      ).bind(orderId).all<{ id: number; commission_amount: number }>()
      const agStmts = (ag.results || []).map((a) => {
        const share = Math.min(a.commission_amount, Math.max(1, Math.floor(a.commission_amount / denom)))
        const remaining = a.commission_amount - share
        return remaining <= 0
          ? DB.prepare("UPDATE agency_store_intro_commissions SET status = 'cancelled', commission_amount = 0 WHERE id = ?").bind(a.id)
          : DB.prepare("UPDATE agency_store_intro_commissions SET commission_amount = ? WHERE id = ?").bind(remaining, a.id)
      })
      if (agStmts.length > 0) await DB.batch(agStmts)
    } catch (e) { if (import.meta.env?.DEV) console.warn('[agency intro clawback]', e) }
  }

  // 🧭 2026-06-10 (링크샵×교환권 적립 루프): 유저-큐레이터 레일(affiliate_earnings)도 동일 비례 역전.
  //   /track 이 적립 시 user_points 즉시 충전하므로 회수도 포인트 차감 + 권위행 감액(물리상품 returns 패턴).
  if (orderId) {
    try {
      const aff = await DB.prepare(
        "SELECT id, referrer_id, commission FROM affiliate_earnings WHERE order_id = ? AND COALESCE(status,'pending') IN ('pending','granted')"
      ).bind(orderId).all<{ id: number; referrer_id: string; commission: number }>()
      for (const row of aff.results || []) {
        const share = Math.min(row.commission, Math.max(1, Math.floor(row.commission / denom)))
        // 💸 2026-08-25: 여태 잔액만 깎고 **`point_transactions` 이력을 안 남겼다.**
        //   유저 딜이 줄었는데 왜 줄었는지 기록이 없다는 뜻이다(문의가 오면 답할 근거가 없다).
        //   `helpers.ts` 에 있을 땐 파일 다른 곳의 point_transactions 덕에 가드를 통과했다 —
        //   **근접성으로 통과한 것이지 옳아서가 아니었다.** 추출하니 드러났다.
        //   ⇒ SSOT(`adjustUserPoints`)로 — 잔액과 이력을 한 번에, free 버킷 우선 소진 규칙도 승계.
        await adjustUserPoints(DB, {
          userId: row.referrer_id,
          delta: -share,
          type: 'affiliate_clawback',
          description: `추천 커미션 회수 (${reason})`,
          orderId,
        }).catch(() => null)
        const remaining = row.commission - share
        if (remaining <= 0) {
          await DB.prepare("UPDATE affiliate_earnings SET status = 'refunded', commission = 0 WHERE id = ?").bind(row.id).run()
        } else {
          await DB.prepare("UPDATE affiliate_earnings SET commission = ? WHERE id = ?").bind(remaining, row.id).run()
        }
        clawed += share
      }
      // ⏳ holding(미성숙·미적립) 적립: 잔액 회수 없이 상태만 refunded — 성숙 cron 이 확정 안 함.
      await DB.prepare("UPDATE affiliate_earnings SET status = 'refunded', commission = 0 WHERE order_id = ? AND COALESCE(status,'pending') = 'holding'")
        .bind(orderId).run().catch(() => null)
    } catch { /* affiliate 테이블 없거나 미적립 — best-effort */ }
  }

  return clawed
}
