/**
 * 유어딜 판매자 이용약관 — 정본(국문) v1.0, 시행 2026-07-05 (대표 확정, 구 2026-05-16 초안 대체).
 * 콘텐츠 SSOT: src/pages/terms/seller-terms-content.ts
 */
import TermsDocument from './terms/TermsDocument'
import { SELLER_TERMS } from './terms/seller-terms-content'

export default function SellerTermsPage() {
  return <TermsDocument doc={SELLER_TERMS} url="/terms/seller" />
}
