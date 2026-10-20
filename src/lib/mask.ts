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
 * 사람 이름 마스킹 — '홍길동' → '홍*동', '홍길' → '홍*', 'Jonathan' → 'J******n'
 *
 * 🔐 2026-07-05 (운영 감사 Q8): 에이전시는 매장 성과 관리 조직이지 주문 당사자가 아님 —
 * 소속 셀러 주문의 수령인/투숙객 **실명 원문**을 에이전시 대시보드에 내려보내지 않는다.
 * 식별(같은 사람인지)만 가능하면 되므로 첫/끝 글자만 남김.
 */
export function maskPersonName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return ''
  const s = name.trim()
  if (s.length <= 1) return s ? '*' : ''
  if (s.length === 2) return `${s[0]}*`
  return `${s[0]}${'*'.repeat(s.length - 2)}${s[s.length - 1]}`
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
