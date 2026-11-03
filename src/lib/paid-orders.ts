/**
 * 결제를 마친 주문 표시 — 완료 화면에서 폰 뒤로를 눌러 **이미 쓴 결제창**(`/pay/widget`)으로
 * 돌아가지 않게 한다 (2026-11-03 대표 승인 — 결재 `docs/decisions/2026-11-03-back-navigation-locked-files.md` ②).
 *
 * 🩸 카드 결제 이력: 상세 → `/pay/widget` → (토스) → 완료 화면. 토스는 문서를 통째로 바꿔 돌아오므로
 *   우리가 앞 칸을 지울 수 없다. 그래서 **결제창이 다시 열릴 때** 스스로 알아보고 비킨다:
 *   완료 화면이 승인 성공 때 `markOrderPaid(토스 orderId)` → 결제창이 열릴 때 `isOrderPaid` 면 위젯을 띄우지 않고 한 칸 더 뒤로.
 *
 * - 탭 한정(sessionStorage) · 최근 20건만. 저장이 막힌 환경이면 아무 일도 안 한다(종전 동작).
 * - 금액·승인·원장과 무관하다 — 결제창을 *보여 줄지*만 정한다. 서버는 같은 orderId 재승인을 이미 막는다.
 */
const KEY = 'ur_paid_orders_v1'

function read(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function markOrderPaid(orderId: string): void {
  if (!orderId) return
  try {
    const list = read().filter((x) => x !== orderId)
    list.push(orderId)
    sessionStorage.setItem(KEY, JSON.stringify(list.slice(-20)))
  } catch { /* 저장 불가 — 종전 동작 */ }
}

export function isOrderPaid(orderId: string): boolean {
  return !!orderId && read().includes(orderId)
}
