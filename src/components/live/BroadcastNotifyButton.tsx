import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'

interface Props {
  streamId: number | string
  compact?: boolean
}

const KakaoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#3C1E1E" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z"/>
  </svg>
)

export default function BroadcastNotifyButton({ streamId, compact = false }: Props) {
  const [calLoading, setCalLoading] = useState(false)
  const userId = getUserIdSync()

  const handleAddCalendar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) { toast.error('로그인이 필요합니다'); return }
    setCalLoading(true)
    try {
      const res = await api.post('/api/kakao-social/calendar/add', { stream_id: streamId })
      if (res.data.success) toast.success('카카오 캘린더에 등록되었습니다!')
      else toast.error(res.data.error || '캘린더 등록 실패')
    } catch {
      toast.error('카카오 로그인이 필요합니다')
    } finally {
      setCalLoading(false)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleAddCalendar}
        disabled={calLoading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#FEE500]/15 text-[#3C1E1E]/80 border border-[#FEE500]/40 transition-all active:scale-95 disabled:opacity-50"
      >
        <KakaoIcon className="w-3 h-3 shrink-0" />
        {calLoading ? '추가 중...' : '카카오 알림 받기 [캘린더]'}
      </button>
    )
  }

  return (
    <button
      onClick={handleAddCalendar}
      disabled={calLoading}
      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500]/20 text-[#3C1E1E]/80 border border-[#FEE500]/30 rounded-xl text-sm font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
    >
      <KakaoIcon className="w-4 h-4 shrink-0" />
      {calLoading ? '추가 중...' : '카카오 알림 받기 [캘린더]'}
    </button>
  )
}
