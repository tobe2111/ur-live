import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { OBSWebSocketClient, loadOBSConfig } from '@/lib/obs-websocket'
import { ShareLiveLink } from '@/components/seller/broadcast/ShareLiveLink'
import type { LiveStream } from '@/components/seller/broadcast/broadcast-types'

// ── 예약 방송 대기 화면 (P1-5) ──────────────────────────────────
export function ScheduledBroadcastWaiting({ stream, onBack }: { stream: LiveStream; onBack: () => void }) {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState('')
  const [obsAutoStartEnabled, setObsAutoStartEnabled] = useState(false)
  const obsClientRef = useRef<OBSWebSocketClient | null>(null)
  const autoStartedRef = useRef(false)

  // OBS 연결 설정이 저장되어 있으면 자동 시작 옵션 활성화
  useEffect(() => {
    const cfg = loadOBSConfig()
    if (!cfg) return
    const client = new OBSWebSocketClient()
    client.connect(cfg).then(ok => {
      if (ok) {
        obsClientRef.current = client
        setObsAutoStartEnabled(true)
      }
    })
    return () => client.disconnect()
  }, [])

  useEffect(() => {
    const tick = () => {
      if (!stream.scheduled_at) return
      const target = new Date(stream.scheduled_at).getTime()
      const diff = target - Date.now()
      if (diff <= 0) { setCountdown('00:00:00') } else {
        const days = Math.floor(diff / (24 * 3600 * 1000))
        const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000))
        const minutes = Math.floor((diff % (3600 * 1000)) / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        setCountdown(days > 0
          ? `${days}일 ${hours}시간 ${minutes}분`
          : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
      }
      // 예약 시간 도달 + OBS 연결됨 + 아직 자동 시작 안 했으면 → 자동 시작
      if (diff <= 0 && obsClientRef.current && obsAutoStartEnabled && !autoStartedRef.current
          && stream.rtmp_url && stream.rtmp_key) {
        autoStartedRef.current = true
        ;(async () => {
          try {
            await obsClientRef.current!.setRtmpTarget(stream.rtmp_url!, stream.rtmp_key!)
            await obsClientRef.current!.startStreaming()
            toast.success('⏰ 예약 시간 도달. OBS 자동 시작!')
          } catch {
            toast.error('OBS 자동 시작 실패. 수동으로 시작해주세요.')
          }
        })()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [stream.scheduled_at, stream.rtmp_url, stream.rtmp_key, obsAutoStartEnabled])

  const scheduledDate = stream.scheduled_at ? new Date(stream.scheduled_at) : null
  const scheduledStr = scheduledDate
    ? `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')} ${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`
    : ''

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="text-center space-y-1">
        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📅</span>
        </div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t('seller.liveBroadcast.scheduledBroadcast')}</p>
        <h2 className="text-lg font-bold text-gray-900 truncate">{stream.title}</h2>
        <p className="text-xs text-gray-500">{scheduledStr}</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
        <p className="text-[11px] text-blue-700 font-semibold mb-1">{t('seller.liveBroadcast.timeRemaining')}</p>
        <p className="text-2xl font-bold font-mono text-blue-900">{countdown}</p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 flex-1">{t('seller.liveBroadcast.scheduledStartHint')}</p>
      </div>

      {obsAutoStartEnabled && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-green-800">
            <p className="font-semibold">✨ OBS 자동 시작 활성화됨</p>
            <p className="text-[11px] mt-0.5">예약 시간이 되면 OBS가 자동으로 스트리밍 시작됩니다. 컴퓨터만 켜둬주세요.</p>
          </div>
        </div>
      )}

      <ShareLiveLink streamId={stream.id} />

      <div className="flex items-center justify-center pt-2 border-t border-gray-100">
        <button onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
