/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerBusinessInfoPage 공유 타입.
 */

export interface BusinessInfo {
  id: number
  business_number: string
  business_name: string
  ceo_name: string
  business_type: string
  business_category: string
  postal_code: string
  address: string
  address_detail: string
  phone: string
  email: string
  is_verified: boolean
  verified_at: string | null
  created_at: string
}

export interface BankInfo {
  bank_name: string
  bank_account: string
  account_holder: string
}
