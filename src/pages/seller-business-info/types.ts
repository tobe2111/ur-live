/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerBusinessInfoPage 공유 타입.
 */

export interface BusinessInfo {
  /** 🏪 2026-09-03: 아직 저장된 행이 아니라 **매장 등록 때 받은 값**이면 null (서버 `from_registration`). */
  id: number | null
  /** 매장 등록에서 넘어온 값 — 저장을 눌러야 정식 등록이 된다(서버가 붙인다). */
  from_registration?: boolean
  business_number: string
  business_name: string
  ceo_name: string
  business_type: string
  business_category: string
  postal_code: string
  address: string
  address_detail: string
  mail_order_number?: string | null // 🖼️ 2026-07-01 통신판매업신고번호 (side-table 컬럼)
  onnuri_merchant?: boolean // 🏪 2026-07-05 온누리상품권 가맹 (seller_meta K-V)
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

// 🛡️ 2026-06-10: 탭화 분해 — 사업자 정보 폼 입력값 (동작 변화 0, 순수 이동).
export interface BusinessFormData {
  business_number: string
  business_name: string
  ceo_name: string
  business_type: string
  business_category: string
  postal_code: string
  address: string
  address_detail: string
  mail_order_number: string // 🖼️ 2026-07-01 통신판매업신고번호
  phone: string
  email: string
  onnuri_merchant: boolean // 🏪 2026-07-05 온누리상품권 가맹 여부 (동네딜 카드/상세 뱃지)
}
