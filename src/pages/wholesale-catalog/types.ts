/**
 * 🏭 유통스타트 도매몰 카탈로그 공유 타입 — WholesaleCatalogPage 분해 (순수 추출, 동작 변화 0).
 */
export interface CatalogItem {
  id: number
  name: string
  description?: string | null
  image_url: string | null
  category: string | null
  stock: number
  distributor_price: number | null
  retail_price?: number | null
  moq?: number
  pack_size?: number
  order_multiple?: number
  has_tiers?: boolean
  sold_count?: number
  requires_login?: boolean
  is_premium?: boolean | number
  is_brand_product?: boolean | number
  brand_name?: string | null
  code?: string | null
  // 🚚 2026-07-01 (라이브 감사): 카탈로그 목록 API 가 반환하는 제조사 그룹/정책 — 카드 빠른담기가
  //   카트에 스냅샷으로 넘겨야 카트·체크아웃 배송비/최소주문 표시가 실청구와 일치(이전 누락 → 표시 0/무료).
  supplier_group?: string | null
  supplier_policy?: { min_order_amount?: number; shipping_fee?: number; free_ship_threshold?: number } | null
}

// 🏷️ 2026-06-09 브랜드 전시관 — 현재 몰의 브랜드(brand_name) distinct 목록 + 상품수 + 로고 (?brands=1 응답).
export interface BrandEntry { name: string; product_count: number; logo_url?: string | null }
export interface ReorderItem { id: number; name: string; image_url: string | null; stock: number; distributor_price: number; last_qty: number; last_date: string }
export interface CatOpt { id: string; label: string }
