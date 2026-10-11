/**
 * 🏢 "에이전시로 운영 중" 띠 — 에이전시 직원이 맡은 매장의 셀러 화면에 들어와 있는 동안 맨 위에 붙는다 (2026-10-11).
 *
 * `SellerLayout` **한 곳**에만 단다(BackToMyBar 와 같은 이유 — 페이지마다 붙이면 반드시 빠진다).
 * 판정은 저장된 이름이 아니라 **토큰 자신**이 한다(`agency_staff_id` claim) — 이름만 남고 좌석이 바뀐 경우
 * 띠가 거짓말을 하지 않게. 서명 검증은 서버 일이고, 여기서는 무엇을 그릴지만 고른다.
 *
 * ⚠️ 돌아갈 때 셀러 좌석을 **지운다** — 에이전시 직원의 컴퓨터에 매장 좌석이 남아 있으면 다음 사람이 그대로 연다.
 *   하드 이동이다(대시보드가 들고 있던 매장 상태를 끌고 가지 않게).
 */
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { clearAuthData } from '@/utils/auth'

// 판정·키는 `shared/agency-seat-token.ts` 에 있다 — 공용 부품이 이 파일을 import 하면 셀러 청크가 소비자 화면으로 샌다.
import { AGENCY_SEAT_NAME_KEY, isAgencySeatToken } from '@/shared/agency-seat-token'
export { AGENCY_SEAT_NAME_KEY, isAgencySeatToken }

export default function AgencySeatBar() {
  const [agencyName, setAgencyName] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (!isAgencySeatToken(localStorage.getItem('seller_token'))) return
      setAgencyName(localStorage.getItem(AGENCY_SEAT_NAME_KEY) || '에이전시')
    } catch { /* storage 접근 불가 */ }
  }, [])

  if (!agencyName) return null

  function leave() {
    clearAuthData('seller')
    try { localStorage.removeItem(AGENCY_SEAT_NAME_KEY) } catch { /* noop */ }
    window.location.assign('/agency')
  }

  return (
    <button
      type="button"
      onClick={leave}
      className="w-full flex items-center gap-1.5 rounded-[var(--dash-radius,16px)] bg-brand-tint px-3 py-2.5 text-left text-[13px] font-semibold text-gray-900 active:opacity-80"
    >
      <ChevronLeft size={16} strokeWidth={1.6} className="shrink-0 text-brand-text" aria-hidden="true" />
      <span className="truncate">{agencyName} 에이전시로 운영 중</span>
      <span className="ml-auto shrink-0 text-[12px] font-medium text-brand-text">에이전시로 돌아가기</span>
    </button>
  )
}
