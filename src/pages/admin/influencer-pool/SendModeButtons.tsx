/**
 * 🚀 발송 모드 진입 버튼 묶음 — "오늘 보낼 20명"(서버 선별) + "현재 필터"(기존 동선).
 *
 *   왜 컴포넌트로 뺐나: 페이지(AdminInfluencerPoolPage)가 600줄 래칫에 정확히 닿아 있어 버튼을
 *   거기 더 얹을 수 없었다. 우회(`file-size-ok`) 대신 **큐 상태·모달·버튼을 한 덩어리로 옮겨**
 *   페이지를 줄이면서 기능을 늘렸다(2026-07-29). 큐를 여는 두 경로가 한 파일에 모여 있어야
 *   "어느 진입로로 열어도 연락 불가 리드는 안 들어간다"는 불변식도 한눈에 보인다.
 *
 *   ⚖️ [LEGAL] 두 버튼 모두 **목록만** 만든다. 발송은 SendQueueModal 에서 사람이 한 건씩 열어 직접 한다.
 */
import { useState } from 'react'
import { toast } from '@/hooks/useToast'
import SendQueueModal, { type QueueLead } from './SendQueueModal'
import { useSendQueue, type SendQueueLead } from './useSendQueue'

/** 오늘 한 번에 여는 기본 인원 — 사람이 한 자리에서 소화 가능한 크기(20명 ≈ Enter 20번). */
const TODAY_N = 20

export default function SendModeButtons<T extends QueueLead>({ leads, selectedIds, onReach }: {
  /** 현재 필터로 로드된 리드(기존 '발송 모드' 진입로). */
  leads: T[]
  /** 선택된 id — 있으면 선택분만 큐에 넣는다(기존 동작 보존). */
  selectedIds: Set<number>
  onReach: (l: QueueLead) => void
}) {
  const [queue, setQueue] = useState<QueueLead[] | null>(null) // null = 모달 닫힘
  const today = useSendQueue()

  /** 🎯 서버가 골라준 "지금 열 수 있고 · 아직 접촉 안 한 · 점수 높은" 순 N명. */
  async function openToday() {
    const picked: SendQueueLead[] = await today.load(TODAY_N)
    if (!picked.length) {
      toast.info(today.error || '지금 연락할 수 있는 리드가 없습니다 — 보강이 돌면 다시 채워집니다')
      return
    }
    setQueue(picked as unknown as QueueLead[])
    if (today.remaining > picked.length) toast.success(`${picked.length}명 준비됨 · 뒤에 ${today.remaining - picked.length}명 더 있습니다`)
  }

  /** 기존 동선 — 현재 필터(또는 선택분). 상태/바운스 제외는 여기서, 연락불가 제외는 모달이 한다. */
  function openFiltered() {
    const base = selectedIds.size ? leads.filter(l => selectedIds.has(l.id)) : leads
    setQueue(base.filter(l => l.status !== 'rejected'
      && (l as { email_status?: string | null }).email_status !== 'bounced'
      && (l as { email_status?: string | null }).email_status !== 'complained'))
  }

  return (
    <>
      <button onClick={openToday} disabled={today.loading} className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50" title="서버가 '지금 열 수 있고 · 아직 접촉 안 했고 · 점수 높은' 순으로 골라줍니다 — 누구부터 보낼지 고민할 필요 없이 바로 시작">
        {today.loading ? '큐 준비 중…' : `🎯 오늘 보낼 ${TODAY_N}명`}
      </button>
      <button onClick={openFiltered} disabled={!leads.length} className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium disabled:opacity-50" title="현재 필터의 리드를 한 명씩 넘기며 원클릭 발송(Enter) — 자동 발송 아님, 사람이 직접 보냄">
        🚀 발송 모드{selectedIds.size ? ` (선택 ${selectedIds.size})` : ` (${leads.length})`}
      </button>
      {queue && <SendQueueModal leads={queue} onReach={onReach} onClose={() => { setQueue(null); today.reset() }} />}
    </>
  )
}
