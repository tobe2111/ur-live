import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import KakaoShareButton from '@/components/KakaoShareButton'
import type { Stream } from './LiveTypes'
import { safeDate, safeTime } from '@/utils/safe-date'

function useCountdown(targetDate: string | undefined, soonText: string) {
  const [remaining, setRemaining] = useState('')
  const [imminent, setImminent] = useState(false) // 60초 이내 → 강조 모드

  useEffect(() => {
    if (!targetDate) return

    const update = () => {
      const diff = safeTime(targetDate) - Date.now()
      if (diff <= 0) {
        setRemaining(soonText)
        setImminent(true)
        return
      }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      // 🛡️ 2026-05-07: 60초 이내 → 초만 강조 ("곧 시작! 23초")
      setImminent(diff < 60000)
      if (diff < 60000) {
        setRemaining(`${seconds}초`)
      } else if (days > 0) {
        setRemaining(`D-${days} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
      } else {
        setRemaining(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate, soonText])

  return { remaining, imminent }
}

export default function ScheduledOverlay({ stream, onGoHome }: { stream: Stream; onGoHome: () => void }) {
  const { t } = useTranslation()
  const { remaining: countdown, imminent } = useCountdown(stream.scheduled_at, t('live.scheduled.soon', { defaultValue: '곧 시작됩니다' }))

  const _schedDate = safeDate(stream.scheduled_at)
  const formattedDate = _schedDate
    ? `${_schedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} ${_schedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 px-8">
        <div className="px-5 py-2 bg-blue-600 rounded-full flex items-center gap-2">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-white text-sm font-bold">{t('live.scheduled.badge', { defaultValue: '방송 예정' })}</span>
        </div>

        <h2 className="text-white text-xl font-bold text-center leading-tight">
          {stream.title}
        </h2>

        {(stream.seller_name || stream.streamerName) && (
          <p className="text-white/70 text-sm">
            @{stream.seller_name || stream.streamerName}
          </p>
        )}

        {stream.scheduled_at && (
          <div className="text-center">
            <p className="text-white/60 text-xs mb-2">
              {imminent ? '🔥 곧 시작!' : t('live.scheduled.untilStart', { defaultValue: '방송 시작까지' })}
            </p>
            <p className={`font-bold font-mono tracking-wider transition-all ${
              imminent ? 'text-red-400 text-5xl animate-pulse' : 'text-white text-3xl'
            }`}>
              {countdown}
            </p>
            <p className="text-white/50 text-sm mt-2">{formattedDate}</p>
            {imminent && (
              <p className="text-amber-300 text-xs mt-3 font-semibold">⏰ 알림 켜놓고 기다려주세요</p>
            )}
          </div>
        )}

        {!stream.scheduled_at && (
          <p className="text-white/60 text-sm">{t('live.scheduled.notSet', { defaultValue: '방송 시작 시간이 아직 정해지지 않았습니다' })}</p>
        )}

        <div className="flex gap-3 mt-2">
          <KakaoShareButton
            title={stream.title}
            description={stream.seller_name ? t('live.scheduled.shareDescWithName', { defaultValue: '{{name}}의 라이브 방송', name: stream.seller_name }) : t('live.scheduled.shareDescDefault', { defaultValue: '유어딜 라이브' })}
            link={`/live/${stream.id}`}
            className="px-6 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-full text-sm font-bold"
            compact={false}
          />
          <button
            onClick={onGoHome}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-full text-sm font-medium transition-colors"
          >
            {t('live.scheduled.goHome', { defaultValue: '홈으로' })}
          </button>
        </div>
      </div>
    </div>
  )
}
