/**
 * 유어딜 에이전시 파트너 약관 — 정본(국문) v1.0, 시행 2026-07-05 (대표 확정).
 * 콘텐츠 SSOT: src/pages/terms/agency-terms-content.ts
 */
import TermsDocument from './terms/TermsDocument'
import { AGENCY_PARTNER_TERMS } from './terms/agency-terms-content'

export default function AgencyPartnerTermsPage() {
  return <TermsDocument doc={AGENCY_PARTNER_TERMS} url="/terms/agency" />
}
