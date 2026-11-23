/**
 * 📣 이용권 판매 → 사장님 알림톡 — 결제 경로 셋이 **같은 함수**를 부른다 (2026-10-10 전수조사)
 *
 * 그 전엔 판매 알림톡이 **딜 결제 경로에만** 있었고, 그마저 실제로는 한 번도 안 갔다:
 *   ① 조회가 존재하지 않는 컬럼 `sellers.store_owner_token` 을 SELECT 해서 매번 예외 → `catch {}` 가 삼킴
 *   ② 번호를 `sellers.phone`(매장 대표번호, 대부분 유선)에서만 찾음 → 휴대폰 필터에 걸려 건너뜀
 *   ③ 카드 결제(`/confirm-toss`)·장바구니 결제에는 알림톡 호출 자체가 없었다(대시보드 벨뿐)
 * 이용권은 대부분 **카드**로 팔리므로, 사장님은 손님이 문 앞에 올 때까지 판매를 몰랐다.
 *
 * 첫 판매는 온보딩 안내(사용 처리 방법)를, 그 다음부터는 건별 판매 알림을 보낸다.
 * 🔒 첫 판매 판정은 **CAS** 다 — 동시 결제 두 건이 둘 다 "첫 판매" 문자를 보내지 않는다.
 * 실패는 전부 삼킨다(응답 후 실행이고, 알림이 결제를 되돌릴 이유는 없다).
 */
import { resolveSellerNotifyTarget } from '../../../worker/utils/seller-notify-phone'
import { sendSellerFirstVoucherAlimtalk, sendSellerVoucherSoldAlimtalk } from './helpers'
// 🔘 링크는 알림톡 버튼으로 간다(lib/alimtalk-buttons — 카카오 로그인 → 그 매장 좌석 → 그 화면). 여기선 매장 번호만 넘긴다.

export async function notifySellerVoucherSale(
  env: unknown, // 📨 알림톡(sendTextNotice → SENS) — 워커 env 그대로
  DB: D1Database,
  sale: { sellerId: unknown; productName: string; qty: number; amount: number },
): Promise<void> {
  // 📞 2026-11-23 전화 예약형 이용권이 팔렸으면 사장님 대시보드에 '손님 전화가 올 거예요' 를 따로 알린다(알림톡과 무관 — 벨).
  await notifyCallBookingSale(DB, sale).catch(() => null)
  try {
    const target = await resolveSellerNotifyTarget(DB, sale.sellerId)
    if (!target?.phone) return // 휴대폰이 없으면 첫 판매 표시도 남기지 않는다 — 번호가 생기면 그때 안내받는다
    const restaurantName = target.businessName || '매장'
    if (!target.firstVoucherNotified) {
      const claim = await DB.prepare(
        'UPDATE sellers SET first_voucher_notified = 1 WHERE id = ? AND COALESCE(first_voucher_notified, 0) = 0',
      ).bind(Number(sale.sellerId)).run().catch(() => null)
      if (Number(claim?.meta?.changes ?? 0) === 1) {
        await sendSellerFirstVoucherAlimtalk(env, target.phone, {
          restaurantName, productName: sale.productName, sellerId: sale.sellerId,
        })
        return
      }
    }
    await sendSellerVoucherSoldAlimtalk(env, target.phone, {
      restaurantName, productName: sale.productName, qty: sale.qty, amount: Number(sale.amount) || 0,
      sellerId: sale.sellerId,
    })
  } catch { /* fail-soft — 알림이 결제를 막지 않는다 */ }
}

/** 이 판매에 전화 예약형 이용권이 들어 있으면 대시보드 알림 1건. 호출부는 상품 id 를 안 넘기므로 매장의 전화 예약형 상품 이름과 대조한다. */
export async function notifyCallBookingSale(DB: D1Database, sale: { sellerId: unknown; productName: string }): Promise<boolean> {
  const sid = Number(sale.sellerId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  const { results } = await DB.prepare(
    `SELECT p.name FROM products p JOIN product_supply_meta m ON m.product_id = p.id AND m.key = 'call_booking' AND m.value = '1'
      WHERE p.seller_id = ? LIMIT 50`,
  ).bind(sid).all<{ name: string }>().catch(() => ({ results: [] as { name: string }[] }))
  const hit = (results || []).find((r) => r.name && sale.productName.includes(r.name))
  if (!hit) return false
  const { notifySeller } = await import('../../../lib/notifications')
  await notifySeller(DB, sid, 'call_booking_sold', '📞 예약이 필요한 이용권이 팔렸어요',
    `${hit.name} — 손님이 전화로 날짜를 잡을 거예요. [예약 손님]에서 확인하세요.`, '/seller/bookings?tab=call')
  return true
}
