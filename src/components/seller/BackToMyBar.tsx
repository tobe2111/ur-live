/**
 * ↩️ "마이로 돌아가기" 띠 — 마이에서 들어온 동안 셀러 화면 맨 위에 붙는다 (2026-09-26, 설계 §20)
 *
 * `SellerLayout` **한 곳**에만 단다. 페이지마다 붙이면 65개 중 안 붙인 페이지가 반드시 생기고,
 * 하필 그 페이지가 일이 끝나는 화면이면 사장님은 거기서 길을 잃는다(이 레포가 반복해 당한 클래스).
 *
 * ⚠️ 하드 이동(`location.assign`)이다 — 마이는 소비자 세션으로 도는 다른 표면이고,
 *   대시보드 전역이 들고 있던 매장 상태를 끌고 가면 안 된다(좌석 전환이 하드 리로드인 것과 같은 이유).
 */
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { MY_PATH, clearMyReturn, noteMyReturn, shouldOfferMyReturn } from '@/lib/seller-return'

export default function BackToMyBar() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 진입 주소에 표시가 있으면 세션에 적고, 그 뒤로는 세션이 판정한다.
    noteMyReturn(window.location.search)
    setShow(shouldOfferMyReturn())
  }, [])

  if (!show) return null

  return (
    <button
      type="button"
      onClick={() => { clearMyReturn(); window.location.assign(MY_PATH) }}
      className="w-full flex items-center gap-1.5 rounded-[var(--dash-radius,16px)] border border-rule bg-white px-3 py-2.5 text-left text-[13.5px] font-semibold text-gray-900 active:opacity-80"
    >
      <ChevronLeft size={16} strokeWidth={2} className="shrink-0 text-gray-400" aria-hidden="true" />
      <span>마이로 돌아가기</span>
      <span className="ml-auto text-[12px] font-medium text-gray-400">여기서 한 일은 저장돼요</span>
    </button>
  )
}
