/**
 * 🔔 만료 자동 환불을 손님에게 알린다 — 푸시 + 알림톡 (2026-11-25)
 *
 * 종전엔 앱 안 알림 목록 한 줄이 전부였다. 유효기간이 지난 이용권이 환불됐다는 것은 손님이 앱을 열어야만 알았다
 * (카드 환불은 3~5일 뒤 카드사에서 따로 보인다 — 무슨 돈인지 모른다).
 *
 * ⚠️ **돈이 실제로 돌아간 뒤에만** 부른다(딜 잔액 반영 뒤 · 카드 취소 성공 뒤). 알림톡 문구가 "환불 완료" 다.
 * 전부 best-effort — 알림이 실패해도 환불은 이미 끝났다(되돌리지 않는다).
 * 알림톡은 `voucher_refunded`(카카오 승인됨)를 그대로 쓴다. 이용권마다 따로 보낸다(같은 날 여러 장이 만료될 수 있다).
 */
export interface ExpiredRefundInfo {
  /** cron 의 행은 칸마다 타입이 풀려 있다(unknown) — 여기서 글자로 바꿔 쓴다. */
  voucherId: unknown
  userId: unknown
  productName: unknown
  amount: number
  /** 'deal' = 딜 잔액으로 돌아감 · 'card' = 카드 취소 */
  via: 'deal' | 'card'
}

export function expiredRefundPushBody(i: Pick<ExpiredRefundInfo, 'amount' | 'via' | 'productName'>): string {
  const amt = Math.max(0, Math.floor(Number(i.amount) || 0)).toLocaleString('ko-KR')
  const name = i.productName ? ` (${String(i.productName)})` : ''
  return i.via === 'deal'
    ? `유효기간이 지나 ${amt}딜을 돌려드렸어요${name}`
    : `유효기간이 지나 ${amt}원을 환불했어요. 카드 환불은 영업일 3~5일 걸려요${name}`
}

export async function notifyExpiredRefund(env: unknown, DB: D1Database, i: ExpiredRefundInfo): Promise<void> {
  if (!i.userId || !(i.amount > 0)) return
  const uid = String(i.userId)
  const vid = String(i.voucherId ?? '')
  try {
    const { sendSystemPush } = await import('../../lib/system-push')
    await sendSystemPush(env as never, 'user', uid, {
      title: '이용권 만료 환불', body: expiredRefundPushBody(i), url: '/my-vouchers', tag: `expired-refund-${vid}`,
    })
  } catch { /* best-effort */ }
  try {
    const { sendRefundAlimtalk } = await import('../../features/group-buy/api/helpers')
    await sendRefundAlimtalk(env as Record<string, unknown>, DB, uid, i.productName ? String(i.productName) : '이용권', i.amount, `voucher:${vid}:expired`)
  } catch { /* best-effort */ }
}
