/**
 * 🎁 교환권(기프티콘)이 **이미 발송됐나** — 발송된 것은 환불하지 않는다 (2026-11-25).
 *
 * ## 무엇이 새고 있었나
 * 교환권을 딜로 사면 내부 이용권 행(`vouchers`)이 하나 생기고, 실제 기프티콘은 KT Alpha 가 문자로 보낸다
 * (`voucher_orders`). 발송은 내부 이용권 행을 건드리지 않아 그 행은 **영원히 `unused`** 로 남는다. 그래서:
 *   ① 구매 응답에 실려 온 코드로 `POST /api/group-buy/voucher/:code/cancel` → **딜 전액 환불**(기프티콘은 이미 받음)
 *   ② `POST /api/orders/:id/cancel` 도 같은 판정이라 통과
 *   ③ 유효기간이 지나면 만료 환불 cron 이 **자동으로** 딜을 돌려줬다(라이브 2026-10-02: 1,800딜 환불 1건이 교환권이었다)
 * 로컬 시험 환경에서 ①을 실제로 돌려 확인했다(발송 `sent` 뒤 취소 200 · 4,500딜 환불).
 * 화면은 "교환하면 환불할 수 없어요" 라고 말하고 있었다 — 규칙은 있었고 서버가 안 지켰다.
 *
 * ## 판정
 * `voucher_orders.external_order_id` 는 `u{orderId}-…` 다(`kt-alpha-auto-send.ts` — 주문 경계가 `-` 라 접두 충돌이 없다).
 * 발송이 **실패·취소**된 주문은 손님이 받은 것이 없으니 환불할 수 있다. 접수·진행 중은 받았을 수 있으므로 막는다.
 *
 * ⚠️ 못 막는 것: 어드민 환불(일부러 열어 둔다 — 발송사 쪽 취소와 함께 사람이 판단) · KT 가 아닌 다른 발송사.
 */
export const KT_DELIVERED_REFUND_BLOCKED = '이미 발송된 교환권은 취소·환불할 수 없어요'

/**
 * SQL 술어 — `orderIdExpr` 은 주문 id 를 가리키는 식(`?` · `v.order_id` · `vouchers.order_id`).
 * `CAST(… AS INTEGER)` 가 꼭 있어야 한다: 숫자를 실수로 바인딩하는 드라이버에서는 `'u' || 5.0` 이 `u5.0-%` 가 되어 **아무것도 안 걸린다**
 * (시험 환경에서 실제로 그렇게 뚫렸다 — 판정이 조용히 false 였다).
 */
export function ktCouponDeliveredSql(orderIdExpr: string): string {
  return `EXISTS (SELECT 1 FROM voucher_orders kvo WHERE kvo.source = 'kt_alpha' AND kvo.status NOT IN ('failed', 'cancelled') AND kvo.external_order_id LIKE 'u' || CAST(${orderIdExpr} AS INTEGER) || '-%')`
}

/** 이 주문의 교환권이 발송됐나. 표가 없으면 false, 그 밖의 조회 실패는 **true**(모르면 환불하지 않는다). */
export async function ktCouponDelivered(DB: D1Database, orderId: number | string): Promise<boolean> {
  try {
    const r = await DB.prepare(`SELECT ${ktCouponDeliveredSql('?')} AS d`).bind(orderId).first<{ d: number }>()
    return Number(r?.d) === 1
  } catch (err) {
    return !/no such table/i.test(String((err as Error)?.message || ''))
  }
}
