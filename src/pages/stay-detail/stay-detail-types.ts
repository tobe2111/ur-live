/**
 * 🏨 숙소 상세의 데이터 모양 + 날짜 도우미 (2026-11-03 상세 합치기 1단계 — `StayDetailPage` 에서 분리).
 * 이용권 상세가 숙소 예약 모듈을 품을 때(2단계) 같은 타입을 쓴다.
 */

export interface StayDetail {
  id: number
  name: string
  restaurant_name?: string | null  // 🏨 숙소명(오퍼명 name 과 별도) — h1 우선
  description: string
  image_url?: string
  // 🖼️ 2026-07-21: 데모 시드가 저장하는 실사진 3~5장(products.images JSON) — 스와이프 갤러리 소비.
  images?: string | null
  // 🗺️ 2026-07-21: 위치(product_stay_info psi.* 로 이미 응답에 포함) + 카카오 장소 페이지 URL(supply_meta 동봉).
  latitude?: number | null
  longitude?: number | null
  kakao_place_url?: string | null
  property_type: string
  star_rating: number | null
  region_sido: string
  region_sigungu: string
  address: string
  check_in_time: string
  check_out_time: string
  cancellation_policy: string
  custom_cancellation_text: string | null
  house_rules: string | null
  check_in_instructions: string | null
  amenities: string | null
  description_full: string | null
  min_nights: number
  seller_id: number
  seller_name: string
  avg_rating: number | null
  review_count: number
  // 🛡️ 2026-05-18: 판매 모드 + voucher 옵션 + referral.
  sale_mode?: 'date' | 'voucher' | 'both'
  voucher_validity_days?: number
  voucher_weekday_only?: number
  voucher_weekend_only?: number
  referral_enabled?: number
  influencer_discount_pct?: number
}

export interface AvailRoom {
  room_id: number
  name: string
  bed_config: string | null
  base_guests: number
  max_guests: number
  extra_guest_fee: number
  amenities: string | null
  image_urls: string | null
  available: boolean
  available_count: number
  total_price: number
  /** 🗓️ 날짜별 1박 요금/재고 — 달력에 그대로 쓴다(서버가 주는 값만). */
  dates?: Array<{ date: string; price?: number; available?: boolean }>
  discounted_price?: number
  discount_pct?: number
  avg_per_night_discounted?: number
  nights: number
  avg_per_night: number
}

/**
 * 🕐 오늘·내일 — **한국 날짜**. 종전 `new Date().toISOString().slice(0,10)` 은 UTC 라 한국 밤 12시~오전 9시엔
 *   **어제**가 기본 체크인으로 잡혔다(2026-11-03 실측 — 한국 새벽 3시 요청에 어제 날짜). `src/utils/date.ts` 규칙과 같다.
 */
export function kstYmd(offsetDays = 0, now: number = Date.now()): string {
  return new Date(now + 9 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10)
}
export function todayIso(): string { return kstYmd(0) }
export function tomorrowIso(): string { return kstYmd(1) }
