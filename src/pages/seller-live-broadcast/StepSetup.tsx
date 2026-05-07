/**
 * 🛡️ 2026-05-01: TD-018 분할 — SellerLiveBroadcastPage StepSetup 추출.
 *
 * 라이브 시작 전 RTMP 설정 / OBS 가이드 / 카메라 미리보기 / 송출 진단.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { safeTime } from '@/utils/safe-date'
import { ScheduledBroadcastWaiting, YouTubeStudioWaiting, YouTubeWebcamWaiting } from '../SellerLiveBroadcast.WaitingScreens'
import OBSRemoteControl from '../SellerLiveBroadcast.OBSRemoteControl'
import PrismQRCode from '@/components/streaming/PrismQRCode'
import { InlineCameraPreview } from '@/components/streaming/InlineCameraPreview'
import { BroadcastDiagnostic } from '@/components/streaming/BroadcastDiagnostic'
import BroadcastPreflightCheck from '@/components/streaming/BroadcastPreflightCheck'
import ChromeExtensionBanner from '@/components/streaming/ChromeExtensionBanner'
import QuickStartWaiting from './QuickStartWaiting'
import type { StreamMethod } from '../SellerLiveBroadcast.storage'
import type { LiveStream, YouTubeChannel } from './types'

interface StepSetupProps {
  stream: LiveStream; method: StreamMethod; channels: YouTubeChannel[]
  copiedField: string | null; onCopy: (v: string, k: string) => void
  onGoLive: () => void; onBack: () => void
}

export default function StepSetup({ stream, method, channels, copiedField, onCopy, onGoLive, onBack }: StepSetupProps) {
  const { t } = useTranslation()
  const hasPersistentKey = channels.some((ch: YouTubeChannel) => ch.has_persistent_key)
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [autoDiagnosticShown, setAutoDiagnosticShown] = useState(false)

  // 30초 경과 + 여전히 setup 상태 = 송출이 감지 안 되고 있음 → 진단 자동 제안
  useEffect(() => {
    if (autoDiagnosticShown) return
    const id = setTimeout(() => {
      setShowDiagnostic(true)
      setAutoDiagnosticShown(true)
    }, 30000)
    return () => clearTimeout(id)
  }, [autoDiagnosticShown])

  // P1-5: 예약 방송이고 시작 시간이 30분 이상 미래면 카운트다운 화면
  const scheduledTime = safeTime(stream.scheduled_at)
  const minutesUntil = scheduledTime > 0 ? (scheduledTime - Date.now()) / 60000 : -1
  if (minutesUntil > 30) {
    return <ScheduledBroadcastWaiting stream={stream} onBack={onBack} />
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shrink-0" />
        <p className="text-sm font-semibold text-gray-900 truncate flex-1">{stream.title}</p>
        <span className="text-[11px] text-amber-600 font-medium shrink-0">{t('seller.liveBroadcast.waitingConnection')}</span>
      </div>

      {/* 🛡️ 2026-05-07: Quick 과 YouTube Studio 분리 */}
      {method === 'quick' && (
        <QuickStartWaiting stream={stream} />
      )}

      {method === 'youtube-webcam' && (
        <YouTubeWebcamWaiting stream={stream} onGoLive={onGoLive} />
      )}

      {method === 'youtube' && (
        <>
          <ChromeExtensionBanner />
          <YouTubeStudioWaiting stream={stream} accent="red" />
        </>
      )}

      {method === 'obs' && (
        <OBSRemoteControl stream={stream} hasPersistentKey={!!hasPersistentKey} copiedField={copiedField} onCopy={onCopy} />
      )}

      {method === 'prism' && (
        <div className="space-y-3">
          {hasPersistentKey ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{t('seller.liveBroadcast.rtmpSetupDone')}</p>
                <p className="text-xs text-green-700">{t('seller.liveBroadcast.prismJustStart')}</p>
              </div>
            </div>
          ) : stream.rtmp_url && stream.rtmp_key ? (
            <PrismQRCode rtmpUrl={stream.rtmp_url} rtmpKey={stream.rtmp_key} streamTitle={stream.title} />
          ) : null}
        </div>
      )}

      <div className="pt-3 border-t border-gray-100 space-y-3">
        {/* 🛡️ 2026-05-07: Pre-flight 사전 점검 — 30초 멈춤 사고 미연 방지 */}
        <BroadcastPreflightCheck method={method} />

        {/* 인라인 카메라 미리보기 — 어느 방법이든 방송 전 확인용 */}
        <InlineCameraPreview />

        {(method === 'obs' || method === 'prism') && (
          <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="flex gap-1 shrink-0">
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${d}s` }} />
              ))}
            </span>
            <p className="text-xs text-blue-700 flex-1">
              {method === 'obs' ? 'OBS' : 'Prism'}에서 스트리밍을 시작하면 자동으로 방송이 시작됩니다
            </p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-4 h-4" /> {t('common.cancel')}
          </button>
          <div className="flex-1" />
          <button onClick={() => setShowDiagnostic(true)}
            className="text-[11px] text-blue-500 hover:text-blue-700 underline underline-offset-2">
            🔍 감지 안 되나요?
          </button>
          <button onClick={onGoLive}
            className="text-[11px] text-gray-300 hover:text-gray-500 underline underline-offset-2">
            {t('seller.liveBroadcast.manualStartHint')}
          </button>
        </div>
      </div>
      {showDiagnostic && (
        <BroadcastDiagnostic streamId={stream.id} method={method} onClose={() => setShowDiagnostic(false)} />
      )}
    </div>
  )
}
