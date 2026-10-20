/**
 * 🧾 **등록증 배지를 무엇으로 정하는가** — 어드민이 서류 없는 신청을 구분하게 하는 규칙.
 *
 * ## 왜 함수로 뺐나
 * 등록증이 **선택**이 되면서(2026-09-21 대표 확정) "아예 없음" 이 흔한 상태가 됐다. 그런데
 * 종전 배지는 `business_registration_status` 만 봤고, **매장 등록 경로는 그 컬럼을 한 번도
 * 채우지 않는다** — 그래서 서류를 올린 사람과 안 올린 사람이 **똑같이 "미제출"** 로 보였다.
 * 서류가 필수였을 땐 전부 제출이라 티가 안 났지만, 선택이 된 지금은 **어드민이 서류 없는 신청을
 * 구분하지 못한 채 승인**하게 된다.
 *
 * 화면 JSX 안에 삼항으로 두면 다음 세션이 조용히 되돌려도 문자열 검사로는 못 잡는다
 * (이 레포가 반복해 당한 "헛도는 가드"). 순수 함수로 빼서 **동작을 잰다**.
 *
 * ## ⚠️ 이 함수가 판정하지 않는 것
 * 서류가 **진짜인지**. 파일이 있다는 사실만 안다 — 내용 확인은 사람(또는 OCR)이 한다.
 */
export type SellerCertView = 'verified' | 'pending' | 'submitted' | 'rejected' | 'missing'

export function sellerCertView(
  status: string | null | undefined,
  certUrl: string | null | undefined,
): SellerCertView {
  const s = String(status || '').trim()
  if (s === 'verified' || s === 'pending' || s === 'rejected') return s
  // 상태가 비어 있을 때만 실제 파일 유무로 가른다.
  return String(certUrl || '').trim() ? 'submitted' : 'missing'
}

export const SELLER_CERT_LABEL: Record<SellerCertView, string> = {
  verified: '사업자 검증 완료',
  pending: '사업자 검증 대기',
  submitted: '등록증 제출됨 · 미검증',
  rejected: '사업자 반려',
  missing: '등록증 없음',
}
