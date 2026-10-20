/**
 * 유어딜 이용약관 — 정본(국문) v1.0, 시행 2026-07-05 (대표 확정).
 * 콘텐츠 SSOT: src/pages/terms/consumer-terms-content.ts (개정 시 그 파일 + 버전만 수정).
 */
import TermsDocument from './terms/TermsDocument'
import { CONSUMER_TERMS } from './terms/consumer-terms-content'

export default function TermsOfServicePage() {
  return <TermsDocument doc={CONSUMER_TERMS} url="/terms" />
}
