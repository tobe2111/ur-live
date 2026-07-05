/**
 * 📜 2026-07-05 약관 버전 SSOT — 동의 로그(terms_agreements)의 doc_version 이 여기서 찍힌다.
 *
 * 룰:
 *  - 약관 문서(/terms, /privacy, /terms/seller, 에이전시 약관 …)를 **개정**하면 해당 doc 의
 *    버전을 올려라 (예: '1.0' → '1.1'). 버전이 오르면:
 *      · 유저: TermsConsentGate 가 GET /api/terms/status 로 현행 버전 동의 부재를 감지 → 재동의 모달 (⑤ 골격).
 *      · 신규 동의 row 는 새 버전으로 기록 — 과거 버전 row 는 증적으로 보존(덮어쓰지 않음).
 *  - 문서 페이지 하단의 "시행일" 표기와 함께 갱신할 것.
 *
 * doc_type 키:
 *  - service   : 서비스 이용약관 (/terms) — 유저 필수
 *  - privacy   : 개인정보 수집·이용 (/privacy) — 유저 필수
 *  - location  : 위치기반서비스 (내 동네/지도) — 유저 선택
 *  - marketing : 마케팅 정보 수신 — 유저 선택
 *  - seller    : 사업자 유저(셀러) 약관 (/terms/seller) — 셀러 가입 필수
 *  - agency    : 에이전시 약관 (커미션 1%·24개월·회수 조건 포함) — 에이전시 가입 필수
 */

export const TERMS_EFFECTIVE_DATE = '2026-07-05'

export const TERMS_DOC_VERSIONS = {
  service: '1.0',
  privacy: '1.0',
  location: '1.0',
  marketing: '1.0',
  seller: '1.0',
  agency: '1.0',
} as const

export type TermsDocType = keyof typeof TERMS_DOC_VERSIONS

/** 소비자(유저) 가입/이용에 필수인 문서 — TermsConsentGate 가 이 목록의 현행 버전 동의를 요구. */
export const USER_REQUIRED_DOCS: readonly TermsDocType[] = ['service', 'privacy'] as const
/** 소비자 선택 동의 문서. */
export const USER_OPTIONAL_DOCS: readonly TermsDocType[] = ['location', 'marketing'] as const

export function isTermsDocType(v: unknown): v is TermsDocType {
  return typeof v === 'string' && v in TERMS_DOC_VERSIONS
}
