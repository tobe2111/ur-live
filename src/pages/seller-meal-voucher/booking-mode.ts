/**
 * 🗓️ 이용권 등록 — **예약 방식** SSOT (2026-11-03 숙소·예약 통일 ①)
 *
 * 대표: *"처음에 이용권 등록, 매장 등록 이런 것 할 때도 통일감이 있어야 할텐데?"* →
 * *"모두 해줘. 에이전시든 사장님이든 시간 예약도 받게 되어있어?"*
 *
 * 종전엔 '예약' 이 세 갈래로 따로 있었다 — 숙소(객실·날짜, 5월 별도 등록 화면) · 시간 예약(미용 등, 설정 화면에
 * 들어가는 길이 0) · 외부 예약 링크(판매 설정의 칸 하나). 셋 다 하는 일은 같다: **이용권을 사고, 언제 쓸지 정한다.**
 * ⇒ 이용권 등록 위저드 하나에서 "예약 방식" 만 고른다. 숙소는 '숙박' 종류를 고르면 자동으로 날짜·객실 예약이다.
 *
 * 저장은 기존 API 를 그대로 쓴다(새 머니 경로 0):
 *   - 상품: `POST /api/seller/products` (모든 이용권과 같은 길 — 매장·사진·사장님 링크·매장 프로필)
 *   - 숙소: `POST /api/seller/stays/:id/info` + `POST /api/seller/stays/:id/rooms`
 *   - 시간: `POST /api/seller/products/:id/booking-slots`
 */

export type BookingMode = 'none' | 'external' | 'time'

export interface StayRoomDraft {
  name: string
  base_guests: number
  max_guests: number
  price_weekday: number
  price_weekend: number
  inventory: number
}

export interface SlotDraft { day_of_week: number; start_time: string; end_time: string; capacity: number }

export const STAY_PROPERTY_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'pension', label: '펜션' }, { value: 'hotel', label: '호텔' }, { value: 'motel', label: '모텔' },
  { value: 'guesthouse', label: '게스트하우스' }, { value: 'resort', label: '리조트' }, { value: 'camping', label: '캠핑·글램핑' },
]

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function emptyRoom(): StayRoomDraft {
  return { name: '', base_guests: 2, max_guests: 2, price_weekday: 0, price_weekend: 0, inventory: 1 }
}

/** 기본 시간표 — 평일(월~금) 10시부터 1시간 단위 한 칸. 사장님이 늘리거나 지운다. */
export function defaultSlots(): SlotDraft[] {
  return [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, start_time: '10:00', end_time: '11:00', capacity: 1 }))
}

/** 숙소 이용권의 판매가 = 객실 평일가 중 최저(카드·검색에 '1박 N원~' 로 뜬다). 0 이면 아직 미입력. */
export function stayFromPrice(rooms: StayRoomDraft[]): number {
  const ps = rooms.map((r) => Math.floor(Number(r.price_weekday) || 0)).filter((p) => p > 0)
  return ps.length ? Math.min(...ps) : 0
}

/** 숙소 단계의 막힘 — 비어 있으면 통과. 화면과 등록이 같은 판정을 쓴다. */
export function stayRoomsError(rooms: StayRoomDraft[]): string | null {
  if (!rooms.length) return '객실을 1개 이상 넣어 주세요'
  for (const [i, r] of rooms.entries()) {
    const n = `객실 ${i + 1}`
    if (!r.name.trim()) return `${n}: 이름을 넣어 주세요`
    if (!(Number(r.price_weekday) > 0)) return `${n}: 평일 1박 요금을 넣어 주세요`
    if (!(Number(r.price_weekend) > 0)) return `${n}: 주말 1박 요금을 넣어 주세요`
    if (!(Number(r.inventory) >= 1)) return `${n}: 객실 수는 1개 이상이에요`
    if (Number(r.max_guests) < Number(r.base_guests)) return `${n}: 최대 인원이 기준 인원보다 적어요`
  }
  return null
}

/** 시간 예약의 막힘 — 칸이 하나도 없거나 끝이 시작보다 이르면 막는다. */
export function slotsError(slots: SlotDraft[]): string | null {
  if (!slots.length) return '예약 받을 시간을 1개 이상 넣어 주세요'
  for (const s of slots) {
    if (!(s.start_time < s.end_time)) return `${DAY_LABELS[s.day_of_week]} ${s.start_time}: 끝나는 시간이 시작보다 늦어야 해요`
    if (!(Number(s.capacity) >= 1)) return '한 시간에 받는 인원은 1명 이상이에요'
  }
  return null
}

/** 주소 첫·둘째 낱말 → 시도·시군구 (숙소 지역 필터가 쓴다). 매장 주소를 다시 칠 필요가 없다. */
export function regionFromAddress(addr: string): { sido: string; sigungu: string } {
  const [a = '', b = ''] = (addr || '').trim().split(/\s+/)
  return { sido: a, sigungu: b }
}
