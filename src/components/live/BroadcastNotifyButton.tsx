import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [calLoading, setCalLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const userId = getUserIdSync()

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) {
      toast.error(t('broadcastNotify.loginRequired', { defaultValue: '로그인이 필요합니다' }))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
    setLoading(true)
    try {
      if (subscribed) {
        await api.delete(`/api/broadcast-notify/subscribe/${streamId}`)
        setSubscribed(false)
        toast.info(t('broadcastNotify.unsubscribed', { defaultValue: '알림이 취소되었습니다' }))
      } else {
        const res = await api.post(`/api/broadcast-notify/subscribe/${streamId}`, {})
        if (res.data.success) {
          setSubscribed(true)
          toast.success(t('broadcastNotify.subscribeSuccess', { defaultValue: '방송 시작 시 알림을 보내드릴게요!' }))
        }
      }
    } catch {
      toast.error(t('broadcastNotify.subscribeFailed', { defaultValue: '알림 설정에 실패했습니다' }))
    } finally { setLoading(false) }
  }

  const kr = isKorea()

  const requestKakaoConsent = (scope: string) => {
    // 서버 엔드포인트가 client_id를 포함해 Kakao authorize로 리다이렉트
    // (VITE_KAKAO_REST_API_KEY를 프론트 번들에 노출하지 않음)
    const params = new URLSearchParams({
      scope,
      return: window.location.pathname,
    })
    const url = `/auth/kakao/consent/start?${params.toString()}`
    const popup = window.open(url, 'kakao_consent', 'width=480,height=700,scrollbars=yes')
    if (!popup) { window.location.href = url; return }
    toast.info(t('broadcastNotify.consentHint', { defaultValue: '카카오 권한 동의 후 다시 시도해주세요' }))
  }

  const fallbackToIcs = async () => {
    try {
      const res = await fetch(`/api/kakao-social/calendar/ics/${streamId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        toast.error(data?.error || t('broadcastNotify.calendarIcsDesc', { defaultValue: '방송 일정이 아직 설정되지 않았습니다' }))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `live-${streamId}.ics`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('broadcastNotify.calendarDownloadSuccess', { defaultValue: '📆 캘린더 파일을 다운로드합니다' }))
    } catch {
      toast.error(t('broadcastNotify.calendarDownloadFailed', { defaultValue: '캘린더 다운로드에 실패했습니다' }))
    }
  }

  const handleAddCalendar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!kr) { openGoogleCalendar(); return }
    if (!userId) {
      toast.error(t('broadcastNotify.loginRequired', { defaultValue: '로그인이 필요합니다' }))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    setCalLoading(true)
    try {
      const res = await api.post('/api/kakao-social/calendar/add', { stream_id: streamId })
      if (res.data.success) {
        toast.success(t('broadcastNotify.calendarAdded', { defaultValue: '카카오 캘린더에 등록되었습니다!' }))
      } else {
        // success: false인데 throw 안 된 경우
        fallbackToIcs()
      }
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'KAKAO_REAUTH_REQUIRED') {
        toast.error(t('broadcastNotify.reauth', { defaultValue: '카카오 인증이 만료되었습니다. 다시 로그인해주세요.' }))
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
    const title = encodeURIComponent(t('broadcastNotify.googleCalendarTitle', { defaultValue: '유어딜 라이브 방송' }))
    const details = encodeURIComponent(`https://live.ur-team.com/live/${streamId}`)
    const now = new Date(Date.now() + 3600000)
    const start = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const end = new Date(now.getTime() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`, '_blank')
    toast.success(t('broadcastNotify.googleCalendarOpened', { defaultValue: 'Google 캘린더가 열립니다' }))
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
              : 'bg-white/10 text-gray-900 dark:text-white border border-white/20'
          }`}
        >
          {subscribed ? t('broadcastNotify.notifyOn', { defaultValue: '🔔 알림 ON' }) : t('broadcastNotify.notify', { defaultValue: '🔔 알림' })}
        </button>
        <button
          onClick={handleAddCalendar}
          disabled={calLoading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#FEE500] text-[#3C1E1E] active:scale-95 disabled:opacity-50"
        >
          {kr ? t('broadcastNotify.calendarKr', { defaultValue: '📅 캘린더' }) : t('broadcastNotify.calendarEn', { defaultValue: '📅 Calendar' })}
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
            : 'bg-white/15 text-gray-900 dark:text-white border border-white/20'
        }`}
      >
        {loading ? t('broadcastNotify.processing', { defaultValue: '처리 중...' }) : subscribed ? t('broadcastNotify.notifySet', { defaultValue: '🔔 알림 설정됨' }) : t('broadcastNotify.notifyRequest', { defaultValue: '🔔 방송 알림 받기' })}
      </button>
      <button
        onClick={handleAddCalendar}
        disabled={calLoading}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold active:scale-[0.97] disabled:opacity-50"
      >
        {calLoading ? t('broadcastNotify.adding', { defaultValue: '추가 중...' }) : kr ? t('broadcastNotify.kakaoCalendar', { defaultValue: '📅 카카오 캘린더에 추가' }) : t('broadcastNotify.googleCalendar', { defaultValue: '📅 Add to Calendar' })}
      </button>
    </div>
  )
}
