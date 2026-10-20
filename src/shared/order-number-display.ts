/**
 * 🔢 **주문번호를 사람이 읽을 수 있게** — 표시 전용 SSOT.
 *
 * 저장된 주문번호는 `GB-3-1789611467065` 같은 모양이다. 이건 **토스가 아는 그 orderId** 라
 * (`generateTossOrderId` = `{접두}-{유저id}-{Date.now()}`) 값 자체는 못 바꾼다 — 웹훅이 이 문자열로
 * 주문을 찾고, 결제 취소·상태 변경이 전부 여기에 걸려 있다(`gb-purchase-guards.ts` §②).
 *
 * 그래서 **저장값은 그대로 두고 보는 법만 바꾼다**(대표 신고 2026-09-21 — "주문번호 너무 복잡해").
 * 셀러 표에서는 `GB-3-` / `1789611467065` 로 줄바꿈까지 돼서 읽을 수가 없었다.
 *
 * ## 짧은 번호가 "또 하나의 식별자"가 되지 않게
 * - 전체 번호를 **감추지 않는다.** 짧은 쪽은 눈으로 찾기 위한 손잡이고, 전체는 늘 같이 보인다.
 *   (감추면 셀러↔어드민↔토스 사이에서 번역 문제가 생긴다.)
 * - 꼬리에서 잘라내므로 셀러 목록 검색(`order_number.includes(q)`)에 **그대로 걸린다** —
 *   손님이 "467065" 만 말해도 찾아진다.
 *
 * ⚠️ 유일성을 보장하지 않는다. 같은 밀리초 끝자리 6개가 겹치면 같은 짧은 번호가 나온다.
 *   그래서 권위는 언제나 전체 번호이고, 이 값으로 조회·정산·환불을 하면 안 된다.
 */

const TAIL = 6

/**
 * 표시용 짧은 주문번호. `GB-3-1789611467065` → `#467065`.
 *
 * 꼬리의 **연속된 숫자**에서 끝 6자리를 딴다(타임스탬프 부분). 숫자가 모자라면 영숫자 끝 6자,
 * 원래 값이 이미 짧으면(≤10자) 그대로 돌려준다 — 짧은 걸 더 줄이면 오히려 못 알아본다.
 */
export function shortOrderNo(orderNumber: string | null | undefined): string {
  const raw = String(orderNumber ?? '').trim()
  if (!raw) return ''
  if (raw.length <= 10) return raw

  const digits = raw.match(/\d+$/)?.[0] ?? ''
  if (digits.length >= TAIL) return `#${digits.slice(-TAIL)}`

  const alnum = raw.replace(/[^A-Za-z0-9]/g, '')
  return alnum.length >= TAIL ? `#${alnum.slice(-TAIL)}` : raw
}
