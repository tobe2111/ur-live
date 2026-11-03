import AgencyInviteButton from './AgencyInviteButton'
import { useAgencyPresence } from './useAgencyPresence'

/**
 * 🏢 폰 마이 '에이전시' 탭의 머리 — 2026-11-03 대표 확정 *"안 1 다듬기"*
 *   (*"나를 클릭할 때는 내 딜 바로 위에 [정지원·프로필 편집]이 나오고, 에이전시를 누르면 그게 안 나오고 에이전시
 *   이름이 나오는 거지"* · 시안 캔버스 F2).
 *
 * '나' 탭 머리(48px 사진 · 이름 17 · 보조 13)와 **같은 문법**으로 선다 — 탭을 바꿔도 머리 높이·자리가 그대로다.
 * 얼굴은 에이전시 이름의 첫 글자를 옅은 블루 면에 — 진한 블루 면은 '사용처리' 하나로 남긴다(🎫 규칙 ②).
 * 매장 영입 버튼(`AgencyInviteButton`)은 이 줄 오른쪽에 선다. 에이전시 로그인이 없으면 아무것도 안 그린다.
 */
export default function AgencyHead({ storeCount }: { storeCount: number }) {
  const { on, agencyName, isAdmin } = useAgencyPresence()
  if (!on) return null
  const name = agencyName || '에이전시'
  const meta = ['에이전시', isAdmin ? '관리자' : '직원', storeCount > 0 ? `매장 ${storeCount}곳` : null].filter(Boolean).join(' · ')
  return (
    <div className="ur-content-medium px-5 pt-3 pb-2 flex items-center gap-3" data-testid="agency-head">
      <span aria-hidden="true" className="w-12 h-12 rounded-[14px] shrink-0 flex items-center justify-center bg-brand-tint text-brand-text text-[16px] font-semibold">
        {name.slice(0, 1)}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold text-gray-900 dark:text-white truncate" style={{ letterSpacing: '-0.01em' }}>{name}</span>
        <span className="block mt-1 text-[13px] text-gray-600 dark:text-gray-300 truncate">{meta}</span>
      </span>
      <AgencyInviteButton />
    </div>
  )
}
