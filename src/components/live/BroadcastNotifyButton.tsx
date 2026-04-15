import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'

interface Props {
  streamId: number | string
  compact?: boolean
}

export default function BroadcastNotifyButton({ streamId, compact = false }: Props) {
  const [calLoading, setCalLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const userId = getUserIdSync()

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) { toast.error('로그인이 필요합니다'); return }
    setLoading(true)
    try {
      if (subscribed) {
        await api.delete(`/api/broadcast-notify/subscribe/${streamId}`)
        setSubscribed(false)
        toast.info('알림이 취소되었습니다')
      } else {
        const res = await api.post(`/api/broadcast-notify/subscribe/${streamId}`, {})
        if (res.data.success) {
          setSubscribed(true)
          toast.success('방송 시작 시 알림을 보내드릴게요!')
        }
      }
    } catch {
      toast.error('알림 설정에 실패했습니다')
    } finally { setLoading(false) }
  }

  const handleAddCalendar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) { toast.error('로그인이 필요합니다'); return }
    setCalLoading(true)
    try {
      const res = await api.post('/api/kakao-social/calendar/add', { stream_id: streamId })
      if (res.data.success) {
        toast.success('카카오 캘린더에 등록되었습니다!')
      } else {
        // 카카오 실패 시 ICS 파일 다운로드 (구글/애플 호환)
        downloadICS()
      }
    } catch {
      downloadICS()
    } finally {
      setCalLoading(false)
    }
  }

  const downloadICS = () => {
    window.open(`/api/kakao-social/calendar/ics/${streamId}`, '_blank')
    toast.success('캘린더 파일을 다운로드합니다')
  }

  if (compact) {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
            subscribed
              ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
              : 'bg-white/10 text-white border border-white/20'
          }`}
        >
          {subscribed ? '🔔 알림 ON' : '🔔 알림'}
        </button>
        <button
          onClick={handleAddCalendar}
          disabled={calLoading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#FEE500] text-[#3C1E1E] active:scale-95 disabled:opacity-50"
        >
          📅 캘린더
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${
          subscribed
            ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
            : 'bg-white/15 text-white border border-white/20'
        }`}
      >
        {loading ? '처리 중...' : subscribed ? '🔔 알림 설정됨' : '🔔 방송 알림 받기'}
      </button>
      <button
        onClick={handleAddCalendar}
        disabled={calLoading}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold active:scale-[0.97] disabled:opacity-50"
      >
        {calLoading ? '추가 중...' : '📅 카카오 캘린더에 추가'}
      </button>
    </div>
  )
}
