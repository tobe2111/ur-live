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
import { storeGoUrl } from '../../../shared/store-deep-link' // 🔗 한 번 눌러 그 매장의 그 화면(카카오 로그인 → 좌석)

type AlimtalkEnv = { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string }

export async function notifySellerVoucherSale(
  env: AlimtalkEnv,
  DB: D1Database,
  sale: { sellerId: unknown; productName: string; qty: number; amount: number },
): Promise<void> {
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
          restaurantName, productName: sale.productName, statsUrl: storeGoUrl(sale.sellerId, 'scan'),
        })
        return
      }
    }
    await sendSellerVoucherSoldAlimtalk(env, target.phone, {
      restaurantName, productName: sale.productName, qty: sale.qty, amount: Number(sale.amount) || 0,
      scanUrl: storeGoUrl(sale.sellerId, 'scan'), ordersUrl: storeGoUrl(sale.sellerId, 'orders'),
    })
  } catch { /* fail-soft — 알림이 결제를 막지 않는다 */ }
}
