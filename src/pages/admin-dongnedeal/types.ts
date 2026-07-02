// 🧭 2026-07-01 (대표 — 동네딜 수정/삭제): 등록된 동네딜 행 타입 (list/edit 공유).
export interface DealRow {
  id: number
  name: string
  price: number
  original_price?: number | null
  category: string
  restaurant_name?: string | null
  restaurant_address?: string | null
  image_url?: string | null
  is_active: number
  restaurant_lat?: number | null
  restaurant_lng?: number | null
  created_at?: string
  /** 🎯 1인당 최대 구매 수량 (0=무제한). */
  max_per_person?: number | null
  /** 🎯 카카오 장소 페이지 URL (place.map.kakao.com/{id}). */
  kakao_place_url?: string | null
}

export const CAT_LABEL: Record<string, string> = {
  meal_voucher: '식사', beauty_voucher: '미용', etc_voucher: '기타', general: '일반', stay_voucher: '숙소',
}
