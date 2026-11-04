/**
 * 🔢 사업자번호 입력 자동 하이픈(000-00-00000) — 순수 함수 하나(2026-11-03 `RegisterFields.tsx` 에서 옮김).
 * 왜 옮겼나: 사업자등록증 화면(`/store/biz-cert`)이 이 함수만 쓰려고 가입 폼 부품 파일을 import 하면 그 부품이 공용 묶음으로
 * 올라가 다른 손님 화면이 무거워진다(check-surface-budgets). 가입 폼은 이 함수를 그대로 다시 내보낸다.
 */
export const formatBusinessNumber = (input: string) => {
  const d = input.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}
