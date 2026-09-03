import type { D1Database } from '@cloudflare/workers-types'

/**
 * 🏪 **매장 등록 때 낸 사업자 정보를 사업자 정보 화면에 보여 준다** (2026-09-03, 재현 완료).
 *
 * 대표: *"입력했던 정보가 저장이 안되어있나?"* — **저장은 돼 있었다. 다른 테이블에.**
 * 매장 등록(`POST /api/seller/stores`)은 사업자번호·상호·전화·주소를 **`sellers` 행**에 넣는데,
 * 사업자 정보 화면은 `seller_business_info` 만 읽어 404 → 빈 칸이 뜬다. 같은 정보를 두 곳이
 * 따로 갖고 있고 한쪽만 보여 주고 있었다.
 *
 * 라이브 실측(셀러 14 홍대돈까스, 2026-08-26 등록):
 *   `sellers.business_number='4790902930'` · `business_name='홍대돈까스'` · 전화·주소 전부 있음
 *   ↔ `seller_business_info` 행 **없음** → 화면은 "낸 적 없음" 처럼 보인다.
 *
 * ⇒ 행이 없으면 **없다고 말하지 말고** 등록 때 받은 값을 채워 돌려준다. 지어내는 게 아니라
 *   **셀러 본인이 제출한 값**이고, 그대로 저장을 누르면 정식 행이 생긴다.
 *
 * ⚠️ `is_verified` 는 반드시 **0** — 아직 심사받은 적이 없다. 여기서 1을 주면 미심사 매장이
 *   현금 정산 자격을 갖는다(머니 경로).
 * 🔢 번호는 등록 때 하이픈 없이 저장되는데 화면·검증은 `XXX-XX-XXXXX` 를 요구한다 — 10자리면
 *   여기서 맞춰 준다. 안 그러면 그대로 저장을 눌렀을 때 형식 오류로 튕긴다.
 */
export interface BusinessInfoSeed {
  id: null
  business_number: string
  business_name: string
  ceo_name: string
  business_type: null
  business_category: null
  postal_code: null
  address: string | null
  address_detail: string
  phone: string | null
  email: null
  is_verified: 0
  verified_at: null
  created_at: null
  mail_order_number: null
  onnuri_merchant: false
  /** 아직 `seller_business_info` 행이 아니다 — 화면이 "등록 때 받은 값"이라고 알릴 수 있게. */
  from_registration: true
}

/** 하이픈 없는 10자리를 `XXX-XX-XXXXX` 로. 그 외는 원본 그대로(빈 값 포함). */
export function formatBusinessNumber(raw: string | null | undefined): string {
  const d = String(raw || '').replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : String(raw || '')
}

/** 등록 때 받은 값으로 채운 응답. 채울 게 없으면 null(호출부가 404 를 유지한다). */
export async function buildBusinessInfoSeed(db: D1Database, sellerId: number | string): Promise<BusinessInfoSeed | null> {
  const seed = await db.prepare(
    'SELECT business_number, business_name, name, phone, address FROM sellers WHERE id = ? LIMIT 1',
  ).bind(sellerId).first<{
    business_number: string | null; business_name: string | null
    name: string | null; phone: string | null; address: string | null
  }>().catch(() => null)
  if (!seed) return null
  const bno = formatBusinessNumber(seed.business_number)
  const bname = seed.business_name || seed.name || ''
  if (!bno && !bname) return null
  return {
    id: null, business_number: bno, business_name: bname, ceo_name: '',
    business_type: null, business_category: null, postal_code: null,
    address: seed.address || null, address_detail: '', phone: seed.phone || null, email: null,
    is_verified: 0, verified_at: null, created_at: null,
    mail_order_number: null, onnuri_merchant: false, from_registration: true,
  }
}
