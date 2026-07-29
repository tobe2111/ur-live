/**
 * 🕶️ 2026-07-13 (데이터 감사 3단계): PII 마스킹 — 어드민 대량 목록에서 개인정보 노출 최소화.
 *
 * 원칙(대표 지시): 개인 식별정보 최소·익명 행동데이터 최대. 대량 열람(enumeration)은 유출 표면이라
 *   목록 응답의 이메일/전화는 기본 마스킹. 단건 상세(full-state)는 감사로그 남기고 원문 허용(CS 필요).
 */

/** foo@bar.com → fo***@bar.com (로컬 앞 2자만, 도메인 유지). */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return email ?? null
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at)
  const keep = local.slice(0, Math.min(2, local.length))
  return `${keep}${'*'.repeat(Math.max(1, local.length - keep.length))}${domain}`
}

/** 010-1234-5678 → 010-****-5678 (뒤 4자리만, 하이픈 무관). */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return phone ?? null
  const digits = String(phone).replace(/[^\d]/g, '')
  if (digits.length < 4) return '***'
  const last4 = digits.slice(-4)
  return `***-****-${last4}`
}
