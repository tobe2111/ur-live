/**
 * 법적 문서 SSOT 레지스트리 — 5종(이용약관·판매자·에이전시·개인정보·위치기반).
 * 대표 제공 공식 문안(2026-07-05, v1.0) 반영 · 연락처 jiwon@ur-team.com.
 * 각 페이지(LegalDocPage) + 파트너 약관 clickwrap 이 여기서 문안을 읽는다(단일 출처).
 */
import { TERMS_OF_SERVICE_MD } from './terms-of-service'
import { SELLER_TERMS_MD } from './seller-terms'
import { AGENCY_TERMS_MD } from './agency-terms'
import { PRIVACY_POLICY_MD } from './privacy-policy'
import { LOCATION_TERMS_MD } from './location-terms'

export type LegalDocKey = 'terms' | 'seller' | 'agency' | 'privacy' | 'location'

export interface LegalDoc {
  key: LegalDocKey
  title: string
  version: string
  effectiveDate: string
  markdown: string
}

export const LEGAL_DOCUMENTS: Record<LegalDocKey, LegalDoc> = {
  terms:    { key: 'terms',    title: '이용약관',            version: '1.0', effectiveDate: '2026-07-05', markdown: TERMS_OF_SERVICE_MD },
  seller:   { key: 'seller',   title: '판매자 이용약관',      version: '1.0', effectiveDate: '2026-07-05', markdown: SELLER_TERMS_MD },
  agency:   { key: 'agency',   title: '에이전시 파트너 약관',  version: '1.0', effectiveDate: '2026-07-05', markdown: AGENCY_TERMS_MD },
  privacy:  { key: 'privacy',  title: '개인정보처리방침',      version: '1.0', effectiveDate: '2026-07-05', markdown: PRIVACY_POLICY_MD },
  location: { key: 'location', title: '위치기반서비스 이용약관', version: '1.0', effectiveDate: '2026-07-05', markdown: LOCATION_TERMS_MD },
}

export { LEGAL_BUSINESS_INFO, LEGAL_CONTACT_EMAIL } from './business-info'
