/**
 * 🛡️ 2026-05-24: 전화번호 자동 포맷 유틸.
 *   사용자 입력 → 010-1234-5678 형태.
 *   - 숫자만 추출
 *   - 010/011/016/017/018/019 셀룰러 → AAA-BBBB-CCCC (11자) 또는 AAA-BBB-CCCC (10자)
 *   - 02 (서울) → AA-BBB-CCCC 또는 AA-BBBB-CCCC
 *   - 0XX (기타 지역) → AAA-BBB-CCCC 또는 AAA-BBBB-CCCC
 *   - 너무 짧으면 그대로 (입력 중 단계)
 *
 *   사용:
 *     <input value={formatPhone(input)} onChange={(e) => setInput(e.target.value)} />
 *   또는:
 *     onChange={(e) => setInput(formatPhone(e.target.value))}  // 즉시 포맷
 */
export function formatPhone(raw: string): string {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''

  // 서울 02 — 02-XXX-XXXX 또는 02-XXXX-XXXX
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`
  }

  // 010-1234-5678 (휴대폰 11자) / 010-123-4567 (10자) / 0XX-XXX-XXXX 지역.
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

/** 휴대폰 번호 (01x) 형식 검증 — 하이픈 무관. */
export function isValidMobilePhone(raw: string): boolean {
  const d = String(raw || '').replace(/\D/g, '')
  return /^01\d{8,9}$/.test(d)
}

/** 숫자만 추출 (DB 저장용). */
export function digitsOnly(raw: string): string {
  return String(raw || '').replace(/\D/g, '')
}
