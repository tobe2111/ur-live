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
  in:     { label: 'stockHistoryIn', color: 'text-tone-ok bg-tone-ok-bg' },
  out:    { label: 'stockHistoryOut', color: 'text-tone-bad bg-tone-bad-bg' },
  adjust: { label: 'stockHistoryAdjust', color: 'text-tone-info bg-tone-info-bg' },
  return: { label: 'stockHistoryReturn', color: 'text-tone-warn bg-tone-warn-bg' },
}
