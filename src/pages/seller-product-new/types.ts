/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerProductNewPage 공유 타입.
 */

export interface LiveStream {
  id: number
  title: string
  status: string
}

export interface ProductFormData {
  name: string
  description: string
  long_description: string
  price: string
  stock: string
  image_url: string
  live_stream_id: string
  live_only_price: string
  live_price_enabled: boolean
  product_type: string
  category: string
  product_kind: 'physical' | 'digital' | 'video_course' | 'pdf_guide' | 'live_class'
  delivery_type: 'shipping' | 'instant_url' | 'email' | 'unlock'
  content_url: string
  content_format: '' | 'pdf' | 'video' | 'zip' | 'epub' | 'html' | 'audio' | 'image'
  access_duration_days: string
  preview_url: string
  [key: string]: unknown
}
