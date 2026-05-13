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
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
         style={{ background: 'radial-gradient(circle at center, rgba(20,20,20,0.85) 0%, rgba(0,0,0,0.95) 100%)' }}>
      {stream.thumbnail_url && (
        <div className="absolute inset-0 -z-10 opacity-20 blur-2xl"
             style={{ backgroundImage: `url(${stream.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}

      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full">
          <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
          <span className="text-white/90 text-[11px] font-medium tracking-wide">{t('live.scheduled.badge', { defaultValue: '방송 예정' })}</span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-white text-2xl font-bold leading-snug line-clamp-2">{stream.title}</h2>
          {(stream.seller_name || stream.streamerName) && (
            <p className="text-white/60 text-sm">@{stream.seller_name || stream.streamerName}</p>
          )}
        </div>

        {stream.scheduled_at && (() => {
          // 🛡️ 2026-05-13: "곧 시작됩니다" 같은 텍스트 메시지는 작게, 숫자 카운트만 크게.
          //   기존 text-6xl + animate-pulse 가 메시지에도 적용돼 화면을 점령하는 사고.
          const isNumericCount = /\d/.test(countdown)
          return (
            <div className="text-center w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl py-5 px-4">
              <p className={`font-mono tracking-tight transition-all ${
                isNumericCount && imminent
                  ? 'text-pink-400 text-4xl font-bold'
                  : isNumericCount
                    ? 'text-white text-3xl font-bold'
                    : 'text-white/90 text-base font-semibold'
              }`}>
                {countdown}
              </p>
              <p className="text-white/40 text-[11px] mt-2 tracking-wide">{formattedDate}</p>
              {imminent && isNumericCount && (
                <p className="text-amber-300/90 text-[11px] mt-2 font-medium">⏰ 알림 켜놓고 기다려주세요</p>
              )}
            </div>
          )
        })()}

        {/* status='live' 이지만 video_id 미수신 — 방송 준비 중 표시 */}
        {!stream.scheduled_at && stream.status === 'live' && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl py-6 px-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <p className="text-white text-sm font-medium">방송 준비 중…</p>
            <p className="text-white/50 text-[11px] mt-1">잠시 후 자동으로 시작됩니다</p>
          </div>
        )}

        {!stream.scheduled_at && stream.status !== 'live' && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl py-5 px-5 text-center">
            <p className="text-white/70 text-sm">{t('live.scheduled.notSet', { defaultValue: '방송 시작 시간이 아직 정해지지 않았습니다' })}</p>
          </div>
        )}

        <div className="flex gap-2 w-full">
          <KakaoShareButton
            title={stream.title}
            description={stream.seller_name ? t('live.scheduled.shareDescWithName', { defaultValue: '{{name}}의 라이브 방송', name: stream.seller_name }) : t('live.scheduled.shareDescDefault', { defaultValue: '유어딜 라이브' })}
            link={`/live/${stream.id}`}
            className="flex-1 px-4 py-3 bg-[#FEE500] hover:bg-[#FDD800] text-[#3C1E1E] rounded-xl text-sm font-semibold transition-colors"
            compact={false}
          />
          <button
            onClick={onGoHome}
            className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl text-sm font-medium transition-colors backdrop-blur-md border border-white/10"
          >
            {t('live.scheduled.goHome', { defaultValue: '홈' })}
          </button>
        </div>
      </div>
    </div>
  )
}
