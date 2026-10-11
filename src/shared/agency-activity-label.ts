/**
 * 🏢 에이전시 활동 기록의 한 줄 이름 — 사장님이 "에이전시가 내 매장에서 무엇을 했는지" 읽는 말 (2026-10-11).
 *
 * 경로를 그대로 보여 주면 사장님은 못 읽는다(`/api/seller/products/12` 가 무엇인지). 그래서 기록하는 순간
 * **무엇(대상) + 어떻게(동작)** 두 낱말로 바꿔 저장한다. 모르는 경로는 '매장 정보' 로 묶는다 — 빠뜨리는 것보다
 * 거칠게라도 남기는 편이 낫다(이 기록의 일은 "무언가 바뀌었다" 를 알리는 것이다).
 */
const TARGETS: Array<[RegExp, string]> = [
  [/\/(meal-voucher|group-buy|vouchers?|passes?)\b/, '이용권'],
  [/\/products?\b/, '상품'],
  [/\/orders?\b/, '주문'],
  [/\/(appointments?|bookings?|reservations?)\b/, '예약'],
  [/\/(collab|marketing|deals?|codes?)\b/, '협업 코드'],
  [/\/reviews?\b/, '리뷰'],
  [/\/(notices?|announcements?)\b/, '공지'],
  [/\/(coupons?|promotions?)\b/, '쿠폰'],
]

const VERBS: Record<string, string> = { POST: '등록·처리', PUT: '수정', PATCH: '수정', DELETE: '삭제' }

export function agencyActivityLabel(method: string, path: string): string {
  const target = TARGETS.find(([re]) => re.test(path))?.[1] ?? '매장 정보'
  const verb = VERBS[method.toUpperCase()] ?? '변경'
  return `${target} ${verb}`
}

export const AGENCY_ACTIVITY_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
