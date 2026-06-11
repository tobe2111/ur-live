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
}

// 🏷️ 2026-06-09 브랜드 전시관 — 현재 몰의 브랜드(brand_name) distinct 목록 + 상품수 + 로고 (?brands=1 응답).
export interface BrandEntry { name: string; product_count: number; logo_url?: string | null }
export interface ReorderItem { id: number; name: string; image_url: string | null; stock: number; distributor_price: number; last_qty: number; last_date: string }
export interface CatOpt { id: string; label: string }
