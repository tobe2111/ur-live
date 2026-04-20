import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'
import { isKorea } from '@/shared/config/region'

interface Props {
  streamId: number | string
  compact?: boolean
}

export default function BroadcastNotifyButton({ streamId, compact = false }: Props) {
  const navigate = useNavigate()
  const [calLoading, setCalLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const userId = getUserIdSync()

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) {
      toast.error('로그인이 필요합니다')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
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

  const [showCalendarConsent, setShowCalendarConsent] = useState(false)

  const kr = isKorea()

  const requestKakaoConsent = (scope: string) => {
    const kakaoKey = import.meta.env.VITE_KAKAO_REST_API_KEY
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/kakao/consent/callback`)
    const state = encodeURIComponent(window.location.pathname)
    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoKey}&redirect_uri=${redirectUri}&response_type=code&state=${state}&scope=${scope}`
    const popup = window.open(url, 'kakao_consent', 'width=480,height=700,scrollbars=yes')
    if (!popup) { window.location.href = url; return }
    toast.info('카카오 권한 동의 후 다시 시도해주세요')
  }

  const fallbackToIcs = () => {
    window.open(`/api/kakao-social/calendar/ics/${streamId}`, '_blank')
    toast.success('📆 캘린더 파일을 다운로드합니다')
  }

  const handleAddCalendar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!kr) { openGoogleCalendar(); return }
    if (!userId) {
      toast.error('로그인이 필요합니다')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    setCalLoading(true)
    try {
      const res = await api.post('/api/kakao-social/calendar/add', { stream_id: streamId })
      if (res.data.success) {
        toast.success('카카오 캘린더에 등록되었습니다!')
      } else {
        // success: false인데 throw 안 된 경우
        fallbackToIcs()
      }
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'KAKAO_REAUTH_REQUIRED') {
        toast.error('카카오 인증이 만료되었습니다. 다시 로그인해주세요.')
        localStorage.setItem('loginReturnUrl', window.location.pathname)
        navigate('/login')
      } else if (code === 'KAKAO_SCOPE_REQUIRED') {
        const scope = err?.response?.data?.required_scope || 'talk_calendar'
        requestKakaoConsent(scope)
      } else {
        // 403/500 등 기타 모든 카카오 에러 → ICS 파일 폴백
        // (KOE006 앱 설정 오류, 일시적 장애, 네트워크 등)
        fallbackToIcs()
      }
    } finally {
      setCalLoading(false)
    }
  }

  const openGoogleCalendar = () => {
    // Google Calendar URL 생성 (API 키 불필요)
    const title = encodeURIComponent(`유어딜 라이브 방송`)
    const details = encodeURIComponent(`https://live.ur-team.com/live/${streamId}`)
    const now = new Date(Date.now() + 3600000)
    const start = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const end = new Date(now.getTime() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`, '_blank')
    toast.success('Google 캘린더가 열립니다')
  }

  const calendarConsentUI = showCalendarConsent ? (
    <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 mt-1.5">
      <p className="text-xs text-yellow-800 font-medium mb-2">카카오 캘린더 동의가 필요합니다</p>
      <button onClick={requestCalendarConsent}
        className="w-full py-2 bg-[#FEE500] text-[#3C1E1E] rounded-lg text-xs font-bold active:scale-[0.97]">
        카카오 캘린더 동의하기
      </button>
    </div>
  ) : null

  if (compact) {
    return (
      <div>
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
            {kr ? '📅 캘린더' : '📅 Calendar'}
          </button>
        </div>
        {calendarConsentUI}
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
        {calLoading ? '추가 중...' : kr ? '📅 카카오 캘린더에 추가' : '📅 Add to Calendar'}
      </button>
      {calendarConsentUI}
    </div>
  )
}
