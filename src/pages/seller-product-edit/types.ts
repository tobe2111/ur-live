/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerProductEditPage 공유 타입.
 */

export interface LiveStream {
  id: number
  title: string
  status: string
}

export interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  image_url: string
  live_stream_id: number | null
  is_active: boolean
  detail_images?: string | string[]
  product_type?: string // 'live' or 'featured'
}
