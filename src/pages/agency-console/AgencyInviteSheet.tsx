import Sheet from '@/pages/user-profile/seller-section/Sheet'
import { AgencyInviteLinkCard } from './AgencyInviteLinkCard'

/**
 * 🔗 매장 영입 링크 시트 — 마이 머리의 '매장 영입' 버튼이 연다(2026-11-02 대표 *"버튼 1 기준으로 해줘"*).
 *   종전엔 에이전시 구역 한가운데 큰 카드 + 빈 칸 안 버튼으로 두 번 있었다. 이제 입구는 머리 하나다.
 *   직원도 연다(보내기·복사) — 만들기·끊기만 관리자(`canManage`).
 */
export default function AgencyInviteSheet({ canManage, onClose }: { canManage: boolean; onClose: () => void }) {
  return (
    <Sheet title="매장 영입 링크" onClose={onClose}>
      <div className="min-h-full bg-[#F8F7FC] dark:bg-[#11141C] p-4">
        <AgencyInviteLinkCard canManage={canManage} />
      </div>
    </Sheet>
  )
}
