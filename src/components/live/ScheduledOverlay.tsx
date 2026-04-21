import { useState, useEffect } from 'react'
import KakaoShareButton from '@/components/KakaoShareButton'
import type { Stream } from './LiveTypes'

function useCountdown(targetDate: string | undefined) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!targetDate) return

    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) {
        setRemaining('곧 시작됩니다')
        return
      }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      if (days > 0) {
        setRemaining(`D-${days} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
      } else {
        setRemaining(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return remaining
}

export default function ScheduledOverlay({ stream, onGoHome }: { stream: Stream; onGoHome: () => void }) {
  const countdown = useCountdown(stream.scheduled_at)

  const formattedDate = stream.scheduled_at
    ? `${new Date(stream.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} ${new Date(stream.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 px-8">
        <div className="px-5 py-2 bg-blue-600 rounded-full flex items-center gap-2">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-white text-sm font-bold">방송 예정</span>
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
            <p className="text-white/60 text-xs mb-2">방송 시작까지</p>
            <p className="text-white text-3xl font-bold font-mono tracking-wider">
              {countdown}
            </p>
            <p className="text-white/50 text-sm mt-2">{formattedDate}</p>
          </div>
        )}

        {!stream.scheduled_at && (
          <p className="text-white/60 text-sm">방송 시작 시간이 아직 정해지지 않았습니다</p>
        )}

        <div className="flex gap-3 mt-2">
          <KakaoShareButton
            title={stream.title}
            description={stream.seller_name ? `${stream.seller_name}의 라이브 방송` : '유어딜 라이브'}
            link={`/live/${stream.id}`}
            className="px-6 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-full text-sm font-bold"
            compact={false}
          />
          <button
            onClick={onGoHome}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-full text-sm font-medium transition-colors"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}
