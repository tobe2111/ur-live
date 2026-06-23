/**
 * 🔢 한국 입력 포맷터 — 사업자등록번호 / 휴대폰번호 하이픈 자동 삽입.
 *   입력 onChange 에서 호출해 사용자가 하이픈을 직접 안 쳐도 자동 정규화.
 *   서버도 하이픈 무관 수용(숫자만 추출 검증)하므로 클라/서버 양쪽 안전.
 */

/** 사업자등록번호: 숫자만 추출 → 최대 10자리 → 000-00-00000 형식. */
export function formatBizNo(v: string): string {
  const d = String(v ?? '').replace(/[^0-9]/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

/** 휴대폰번호: 숫자만 추출 → 최대 11자리 → 010-0000-0000(11자리) / 010-000-0000(10자리) 형식. */
export function formatPhoneKr(v: string): string {
  const d = String(v ?? '').replace(/[^0-9]/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` // 10자리(구 번호) → 3-3-4
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` // 11자리 → 3-4-4
}
