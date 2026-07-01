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
}

export const CAT_LABEL: Record<string, string> = {
  meal_voucher: '식사', beauty_voucher: '미용', etc_voucher: '기타', general: '일반', stay_voucher: '숙소',
}
