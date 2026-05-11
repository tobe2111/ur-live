/**
 * 🛡️ 2026-05-07: 항상 노출되는 연결 품질 게이지.
 *
 * YouTube API liveStreamingDetails + 우리 자체 latency 측정 으로 셀러에게
 * 실시간 송출 품질을 보여줌. OBS WebSocket 연결 여부와 무관.
 */
import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Props {
  streamId: number
  // youtube/quick: YouTube API로 시청자수+RTT / 나머지: RTT 전용 (API quota 0)
  mode?: 'youtube' | 'youtube-webcam' | 'quick' | 'obs' | 'prism'
}

interface QualityData {
  concurrent_viewers: number
  rtt_ms: number
  status: 'good' | 'warn' | 'bad' | 'unknown'
  ts: number
}

export default function ConnectionQualityGauge({ streamId, mode }: Props) {
  const [data, setData] = useState<QualityData | null>(null)
  const consecutiveBadRef = useRef(0)
  const warnedRef = useRef(false)
  const lastRecoveryRef = useRef(0) // 회복 toast 마지막 시각 — 2분 내 중복 방지
  // youtube/quick만 YouTube API 호출, 나머지는 경량 ping으로 RTT만 측정
  const useYouTubeStats = mode === 'youtube' || mode === 'quick' || !mode

  useEffect(() => {
    let cancelled = false
    async function tick() {
      const t0 = performance.now()
      try {
        const res = useYouTubeStats
          ? await api.get(`/api/youtube/live/${streamId}/youtube-stats`)
          : await api.get(`/api/seller/streams/${streamId}`)  // RTT 측정용 경량 호출
        const rtt = Math.round(performance.now() - t0)
        if (cancelled) return
        const viewers = useYouTubeStats ? (res.data?.data?.concurrent_viewers ?? 0) : 0
        const status: QualityData['status'] = rtt < 600 ? 'good' : rtt < 1500 ? 'warn' : 'bad'
        setData({ concurrent_viewers: viewers, rtt_ms: rtt, status, ts: Date.now() })

        // 🛡️ 2026-05-07: 자동 재연결 grace period — 30초 (4 cycles) 연속 bad 시 경고
        if (status === 'bad') {
          consecutiveBadRef.current++
          if (consecutiveBadRef.current >= 4 && !warnedRef.current) {
            warnedRef.current = true
            toast.info('🔴 송출 품질 저하 30초 이상 — 인터넷 연결 / OBS 비트레이트 확인')
          }
        } else if (status === 'good') {
          if (warnedRef.current && Date.now() - lastRecoveryRef.current > 120_000) {
            toast.success('✅ 송출 품질 회복')
            lastRecoveryRef.current = Date.now()
          }
          consecutiveBadRef.current = 0
          warnedRef.current = false
        }
      } catch {
        if (!cancelled) setData(prev => prev ? { ...prev, status: 'unknown', ts: Date.now() } : null)
        consecutiveBadRef.current++
        if (consecutiveBadRef.current >= 6 && !warnedRef.current) {
          warnedRef.current = true
          toast.info('⚠️ 라이브 상태 확인 불가 60초 이상 — 인터넷 연결 확인')
        }
      }
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [streamId])

  if (!data) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
        <Loader2 className="w-3 h-3 animate-spin" /> 측정 중
      </div>
    )
  }

  const colorMap = {
    good: 'bg-green-50 text-green-700 border-green-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    bad: 'bg-red-50 text-red-700 border-red-200',
    unknown: 'bg-gray-50 text-gray-500 border-gray-200',
  }

  const Icon = data.status === 'unknown' ? WifiOff : Wifi
  const ageS = Math.round((Date.now() - data.ts) / 1000)

  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold border px-2 py-1 rounded-md ${colorMap[data.status]}`}
      title={`RTT ${data.rtt_ms}ms · ${ageS}초 전 측정`}>
      <Icon className="w-3 h-3" />
      {data.status === 'good' && '🟢 양호'}
      {data.status === 'warn' && '🟡 보통'}
      {data.status === 'bad' && '🔴 불안정'}
      {data.status === 'unknown' && '⚪ 측정 불가'}
      <span className="text-gray-500 font-normal">· {data.rtt_ms}ms</span>
    </div>
  )
}
