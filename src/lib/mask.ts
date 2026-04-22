/**
 * 순수 유틸 — 이메일/개인정보 마스킹
 *
 * ⚠️ 이 파일은 worker/backend에서 import되므로
 * 브라우저 전용 패키지(@sentry/react 등)를 import하면 안 됩니다.
 */

/**
 * 이메일 마스킹
 * 'hello@ex.com' → 'h***@ex.com'
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return ''
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const head = local.slice(0, 1)
  return `${head}***@${domain}`
}

/**
 * 전화번호 마스킹
 * '010-1234-5678' → '010-****-5678'
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return '***'
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}
