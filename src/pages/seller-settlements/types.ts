// 🛡️ 2026-06-10: SellerSettlementsPage 분해 — 공유 타입 (동작 변화 0, 순수 이동).
export interface Settlement {
  id: number
  seller_id: number
  period_start: string
  period_end: string
  total_sales: number
  commission_rate: number
  commission_amount: number
  settlement_amount: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  requested_at: string
  approved_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface SettlementStats {
  total_pending: number
  total_approved: number
  total_paid: number
  pending_amount: number
  approved_amount: number
  paid_amount: number
}
