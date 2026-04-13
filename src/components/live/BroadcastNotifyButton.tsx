import { useState, useEffect } from 'react'
import { Bell, BellRing, Check, CalendarPlus } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'

interface Props {
  streamId: number | string
  compact?: boolean
}

export default function BroadcastNotifyButton({ streamId, compact = false }: Props) {
  const [subscribed, setSubscribed] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [calLoading, setCalLoading] = useState(false)
  const [showPhoneInput, setShowPhoneInput] = useState(false)
  const [phone, setPhone] = useState('')
  const userId = getUserIdSync()

  useEffect(() => {
    api.get(`/api/broadcast-notify/subscribe/${streamId}`)
      .then(r => {
        if (r.data.success) {
          setSubscribed(r.data.data.subscribed)
          setCount(r.data.data.count)
        }
      })
      .catch(() => {})
  }, [streamId])

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

  const handleToggle = async () => {
    if (!userId) {
      toast.error('로그인이 필요합니다')
      return
    }
    setLoading(true)
    try {
      if (subscribed) {
        await api.delete(`/api/broadcast-notify/subscribe/${streamId}`)
        setSubscribed(false)
        setCount(c => Math.max(0, c - 1))
        toast.info('알림이 취소되었습니다')
      } else {
        const res = await api.post(`/api/broadcast-notify/subscribe/${streamId}`, { phone: phone || undefined })
        if (res.data.success) {
          setSubscribed(true)
          setCount(res.data.data.count)
          setShowPhoneInput(false)
          toast.success('방송 시작 시 알림을 보내드릴게요!')
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggle()
          }}
          disabled={loading}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
            subscribed
              ? 'bg-pink-100 text-pink-600'
              : 'bg-[#1a1a1a] text-white border border-gray-700'
          }`}
        >
          {subscribed ? <BellRing className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
          {subscribed ? '알림 ON' : '알림'}
          {count > 0 && <span className="text-[10px] opacity-70">{count}</span>}
        </button>
        <button
          onClick={handleAddCalendar}
          disabled={calLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#FEE500]/15 text-[#3C1E1E]/80 border border-[#FEE500]/40 transition-all active:scale-95 disabled:opacity-50"
        >
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
            <path fill="#3C1E1E" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z"/>
          </svg>
          {calLoading ? '추가 중...' : '카카오 알림 받기 [캘린더]'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (subscribed) {
            handleToggle()
          } else if (!showPhoneInput) {
            // 바로 구독 (인앱 알림만)
            handleToggle()
          }
        }}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${
          subscribed
            ? 'bg-pink-50 text-pink-600 border border-pink-200'
            : 'bg-gray-900 text-white'
        }`}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : subscribed ? (
          <>
            <BellRing className="w-4 h-4" />
            알림 설정됨
            <Check className="w-3.5 h-3.5" />
          </>
        ) : (
          <>
            <Bell className="w-4 h-4" />
            방송 시작 알림 받기
          </>
        )}
      </button>

      {count > 0 && (
        <p className="text-center text-[10px] text-gray-400 mt-1">
          {count}명이 알림을 신청했어요
        </p>
      )}

      {/* 카카오 캘린더 추가 */}
      <button
        onClick={handleAddCalendar}
        disabled={calLoading}
        className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 bg-[#FEE500]/20 text-[#3C1E1E]/80 border border-[#FEE500]/30 rounded-lg text-[11px] font-bold active:scale-95 disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
          <path fill="#3C1E1E" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z"/>
        </svg>
        {calLoading ? '추가 중...' : '카카오 알림 받기 [캘린더]'}
      </button>
    </div>
  )
}
