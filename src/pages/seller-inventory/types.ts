/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerInventoryPage 공유 타입 + 재고 이동 라벨 매핑.
 */

export interface Product {
  id: number
  name: string
  stock: number
  barcode: string | null
  min_stock_alert: number
  image_url: string | null
  price: number
  is_supply_product?: boolean
}

export interface StockMovement {
  id: number
  type: 'in' | 'out' | 'adjust' | 'return'
  quantity: number
  stock_before: number
  stock_after: number
  reason: string
  created_at: string
}

export const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  in:     { label: 'stockHistoryIn', color: 'text-green-600 bg-green-50' },
  out:    { label: 'stockHistoryOut', color: 'text-red-600 bg-red-50' },
  adjust: { label: 'stockHistoryAdjust', color: 'text-blue-600 bg-blue-50' },
  return: { label: 'stockHistoryReturn', color: 'text-amber-600 bg-amber-50' },
}
