/**
 * 🏨 날짜 지정 숙소 예약 — 체크아웃이 지나도록 안 쓴 이용권을 **사용한 것으로** 닫는다 (2026-11-25 대표
 * *"날짜 지정 시에 오지 않으면 환불되는게 아니라 소비한 것으로 해야하지 않을까?"*).
 *
 * ## 왜
 * 날짜 예약은 방을 그 날짜에 비워 둔다. 손님이 안 오면 사장님은 그 방을 다른 손님에게 못 판 채로 끝난다.
 * 그런데 2026-11-03 숙소=이용권 통일 뒤로 그 이용권은 일반 만료 환불(`auto-settlement`)을 탔다 ⇒ 안 오면 전액 환불.
 * 전날 취소는 정책대로 0~50% 인데 가만히 있으면 100% 였다. 만료 환불은 이제 날짜 예약을 뺀다
 * (`expired-voucher-refund-sql.ts` `notDateStaySql`) — 이 파일이 그 빈자리를 맡는다.
 *
 * ## 하는 일 (이용권 1장당)
 *   ① 이용권을 원자 선점 `unused|expired → used` (머니 룰 #1 — `changes = 1` 인 실행만 아래로 간다)
 *   ② 예약이 아직 `confirmed` 면 `no_show` 로(사장님이 이미 체크인·노쇼를 눌렀으면 그대로 둔다)
 *   ③ 정산 원장 — 스캔과 **같은 함수**(`recordVoucherUseSettlement`, 멱등)
 *   ④ 손님에게 앱 안 알림(외부 발송 아님)
 *
 * ## 대상이 아닌 것
 *   - 먼저 판매 숙박권(`sale_mode='voucher'`) — 만료 미사용은 전액 환불(결재 2026-11-24 Q4-1).
 *   - 취소·환불된 예약 — 취소 경로가 이용권을 먼저 `refunded` 로 잡는다(`holdStayVoucherForCancel`).
 *   - 만료 환불이 이미 처리한 이용권(`refund_status` 가 채워진 것).
 *
 * ⚠️ 선점 뒤 원장 기록이 실패하면 그 이용권은 `used` 인데 원장이 없다 — 다음 회차가 다시 잡지 못한다.
 *   그래서 실패를 삼키지 않고 크게 로그한다(같은 트레이드오프를 만료 환불이 이미 택했다 — 이중 지급보다 누락이 안전).
 */
import type { Env } from '../types/env'
import { logError } from '../utils/logger'
import { noPendingGiftSql } from '../utils/voucher-gift'

/** 조회 SSOT — 가드가 실제 sqlite 에 돌린다(`stay-no-show-2026-11-25.test.ts`). */
export function stayNoShowSelectSql(): string {
  return `
      SELECT v.id, v.user_id, v.product_id, v.applied_price,
             p.seller_id, p.name AS product_name,
             sb.id AS booking_id, sb.status AS booking_status
      FROM vouchers v
      JOIN stay_bookings sb ON sb.id = v.stay_booking_id
      JOIN products p ON p.id = v.product_id
      WHERE v.expires_at < datetime('now')
        AND v.status IN ('unused', 'expired')
        AND COALESCE(v.refund_status, '') = ''
        AND COALESCE(sb.sale_mode, 'date') <> 'voucher'
        AND sb.status IN ('confirmed', 'checked_in', 'checked_out', 'no_show')
      ORDER BY v.expires_at ASC
      LIMIT 500
    `
}

/**
 * 원자 선점. 만료 환불과 같은 칸(`refund_status`)을 함께 잠가 두 cron 이 같은 행을 둘 다 잡지 못한다.
 * 선물 중(받기 전)인 이용권은 다른 사용 경로와 똑같이 건너뛴다 — 회수·수락 뒤 다음 회차가 잡는다.
 */
export function stayNoShowClaimSql(): string {
  return `UPDATE vouchers SET status = 'used', used_at = datetime('now')
           WHERE id = ? AND status IN ('unused', 'expired') AND COALESCE(refund_status, '') = '' AND ${noPendingGiftSql('vouchers.id')}`
}

interface NoShowRow {
  id: number; user_id: string; product_id: number; applied_price: number | null
  seller_id: number; product_name: string | null; booking_id: number; booking_status: string
}

export async function handleStayNoShows(env: Env): Promise<{ closed: number }> {
  const DB = env.DB
  const rows = await DB.prepare(stayNoShowSelectSql()).all<NoShowRow>()
  let closed = 0
  for (const v of rows.results || []) {
    const claim = await DB.prepare(stayNoShowClaimSql()).bind(v.id).run()
    if (!claim.meta?.changes) continue
    closed++

    if (v.booking_status === 'confirmed') {
      const moved = await DB.prepare(
        `UPDATE stay_bookings SET status = 'no_show', no_show_marked_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND status = 'confirmed'`,
      ).bind(v.booking_id).run().catch(() => null)
      if (moved?.meta?.changes) {
        await DB.prepare(
          `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
           VALUES (?, 'confirmed', 'no_show', 'system', NULL, '체크아웃 경과 · 체크인 기록 없음 — 이용한 것으로 마감')`,
        ).bind(v.booking_id).run().catch(() => { /* 로그는 best-effort */ })
      }
    }

    try {
      const { recordVoucherUseSettlement } = await import('../utils/voucher-seller-redeem')
      await recordVoucherUseSettlement(DB, {
        id: Number(v.id), applied_price: v.applied_price, seller_id: Number(v.seller_id), consigned_from_seller_id: null,
      })
    } catch (e) {
      logError('[Cron] stay no-show: 이용권은 사용 처리됐는데 정산 원장 기록 실패 — 수동 확인 필요', { voucher_id: v.id, booking_id: v.booking_id, error: String(e) })
    }

    if (v.booking_status === 'confirmed' && v.user_id) {
      try {
        const { notifyUser } = await import('../../lib/notifications')
        await notifyUser(DB, String(v.user_id), 'stay_no_show', '숙소 예약 기간이 지났어요',
          `${v.product_name || '숙소'} 예약이 체크인 기록 없이 끝나 이용한 것으로 처리됐어요. 환불은 되지 않아요.`, '/my-stays')
      } catch { /* 알림은 best-effort */ }
    }
  }
  return { closed }
}
