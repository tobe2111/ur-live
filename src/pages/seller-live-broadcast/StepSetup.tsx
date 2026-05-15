/**
 * 🛡️ 2026-05-01: TD-018 분할 — SellerLiveBroadcastPage StepSetup 추출.
 *
 * 라이브 시작 전 RTMP 설정 / OBS 가이드 / 카메라 미리보기 / 송출 진단.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { safeTime } from '@/utils/safe-date'
import { ScheduledBroadcastWaiting } from '../SellerLiveBroadcast.WaitingScreens'
import { InlineCameraPreview } from '@/components/streaming/InlineCameraPreview'
import { BroadcastDiagnostic } from '@/components/streaming/BroadcastDiagnostic'
import BroadcastPreflightCheck from '@/components/streaming/BroadcastPreflightCheck'
import { toast } from '@/hooks/useToast'
// 🛡️ 2026-05-10: BrowserBroadcaster 는 OME 가용 시에만 로드 (~50KB getUserMedia + WebRTC peer 코드)
const BrowserBroadcaster = lazy(() => import('@/components/streaming/BrowserBroadcaster'))
import type { StreamMethod } from '../SellerLiveBroadcast.storage'
import type { LiveStream, YouTubeChannel } from './types'
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock'
import api from '@/lib/api'

interface StepSetupProps {
  stream: LiveStream; method: StreamMethod; channels: YouTubeChannel[]
  copiedField: string | null; onCopy: (v: string, k: string) => void
  onGoLive: (mode?: string) => void; onBack: () => void
}

export default function StepSetup({ stream, method, channels, copiedField, onCopy, onGoLive, onBack }: StepSetupProps) {
  const { t } = useTranslation()
  const hasPersistentKey = channels.some((ch: YouTubeChannel) => ch.has_persistent_key)
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [waitSeconds, setWaitSeconds] = useState(0)
  // 🛡️ 2026-05-08: OME 가용성 또는 YouTube WHIP direct (stream.rtmp_key 있으면 항상 가능).
  //   가용 → BrowserBroadcaster 노출 (기본 송출 방법).
  //   불가용 → 기존 Larix/OBS 가이드만 표시.
  // 🛡️ 2026-05-11 Option D: rtmp_key 있으면 YouTube WHIP direct 사용 — OME 필요 없음.
  const [omeAvailable, setOmeAvailable] = useState<boolean | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // 대기 중 화면 잠금 방지 (Prism QR 스캔 중, YouTube Studio 확인 중 화면 꺼짐 방지)
  useScreenWakeLock(true)
  const orientationAlertedRef = useRef(false)

  // 모바일 가로 전환 알림 — 방송 중 가로 모드는 카메라 각도 변경 주의
  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent)
    if (!isMobile) return
    const handleOrientation = () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches
      if (isLandscape && !orientationAlertedRef.current) {
        orientationAlertedRef.current = true
        toast.info('📱 가로 모드 감지 — 카메라 각도가 변경됩니다. 시청자 화면을 확인하세요.')
      } else if (!isLandscape) {
        orientationAlertedRef.current = false
      }
    }
    window.addEventListener('orientationchange', handleOrientation)
    window.screen?.orientation?.addEventListener('change', handleOrientation)
    return () => {
      window.removeEventListener('orientationchange', handleOrientation)
      window.screen?.orientation?.removeEventListener('change', handleOrientation)
    }
  }, [])

  // 브라우저 송출 가용성:
  //   1. stream.rtmp_key 있으면 YouTube WHIP direct → 항상 가능 (OME 불필요)
  //   2. rtmp_key 없으면 OME health check
  useEffect(() => {
    if (stream.rtmp_key) {
      setOmeAvailable(true)  // YouTube WHIP direct 사용 가능
      return
    }
    let cancelled = false
    api.get('/api/seller/youtube/streaming/health')
      .then(r => { if (!cancelled) setOmeAvailable(!!(r.data?.data?.ome_available || r.data?.data?.youtube_whip_available)) })
      .catch(() => { if (!cancelled) setOmeAvailable(false) })
    return () => { cancelled = true }
  }, [stream.rtmp_key])

  // 대기 경과 시간 카운터 (탈출 안내 표시용)
  useEffect(() => {
    const id = setInterval(() => setWaitSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

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

      {/* 🛡️ 2026-05-08: 기본 = 브라우저 직접 송출 (OME 가용 시).
          OME 미가용 시 또는 셀러가 "고급" 토글 시 → 기존 Larix/OBS RTMP 가이드 노출. */}
      {omeAvailable === true && (
        <Suspense fallback={<div className="flex items-center justify-center py-12 bg-gray-50 rounded-2xl"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}>
          <BrowserBroadcaster
            streamId={stream.id}
            // 🛡️ 2026-05-13: 새로고침 후 mount 시 stream.status='live' 면 자동 재연결.
            //   기존: 셀러가 매번 "방송 시작" 다시 눌러야 함. 60s grace 안에 못 누르면 종료.
            //   변경: 페이지 reload 만으로 자동 복귀 (카메라 권한 재허용 prompt 없이 통과 가정).
            autoStart={stream.status === 'live'}
            onStreaming={(mode) => {
              if (mode === 'youtube_whip') onGoLive('youtube_whip')
            }}
            onUnsupported={() => setOmeAvailable(false)}
          />
        </Suspense>
      )}

      {(omeAvailable === false || showAdvanced) && hasPersistentKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">송출 준비 완료</p>
            <p className="text-xs text-green-700 mt-0.5">OBS / Prism / Larix 어디서든 [방송 시작] 버튼만 누르세요.</p>
            <a href="/seller/streaming-setup" className="inline-flex items-center gap-1 text-[11px] text-green-800 hover:text-green-900 underline underline-offset-2 mt-1.5 font-medium">
              RTMP 키 다시 보기 →
            </a>
          </div>
        </div>
      )}

      {/* 🛡️ 2026-05-14: OME 미가용 + 모바일 fallback — 모바일에선 OBS 불가능, 명확한 안내. */}
      {omeAvailable === false && !hasPersistentKey && !(stream.rtmp_url && stream.rtmp_key) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-900">미디어 서버 일시 장애</p>
              <p className="text-xs text-red-700 mt-1">송출 인프라가 일시적으로 사용 불가합니다. 잠시 후 새로고침해주세요.</p>
              <p className="text-[11px] text-red-600 mt-2">계속 문제 시 운영팀 문의</p>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ 로딩 상태 표시 (omeAvailable === null) — 빈 화면 방지 */}
      {omeAvailable === null && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-600">송출 준비 중...</span>
        </div>
      )}

      {(omeAvailable === false || showAdvanced) && !hasPersistentKey && stream.rtmp_url && stream.rtmp_key && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-bold text-amber-900">아래 RTMP 정보를 OBS/Prism/Larix 에 입력하세요</p>
          <div className="space-y-1.5 mt-2">
            <div>
              <label className="block text-[10px] font-bold text-amber-700">RTMP URL</label>
              <div className="flex gap-2">
                <input readOnly value={stream.rtmp_url} className="flex-1 px-2 py-1.5 bg-white border border-amber-200 rounded text-xs font-mono text-gray-900" />
                <button onClick={() => onCopy(stream.rtmp_url!, 'url')} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded">
                  {copiedField === 'url' ? '✓' : '복사'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-amber-700">Stream Key</label>
              <div className="flex gap-2">
                <input readOnly type="password" value={stream.rtmp_key} className="flex-1 px-2 py-1.5 bg-white border border-amber-200 rounded text-xs font-mono text-gray-900" />
                <button onClick={() => onCopy(stream.rtmp_key!, 'key')} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded">
                  {copiedField === 'key' ? '✓' : '복사'}
                </button>
              </div>
            </div>
          </div>
          <a href="/seller/streaming-setup" className="inline-block text-[11px] text-amber-700 hover:text-amber-900 underline mt-2">상세 가이드 보기 →</a>
        </div>
      )}

      {/* 고급 옵션 토글 — OME 가용 + 기본 송출 사용 중에만 노출 (외부 OBS/DSLR 셀러용) */}
      {omeAvailable === true && !showAdvanced && (
        <button onClick={() => setShowAdvanced(true)}
          className="w-full text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 inline-flex items-center justify-center gap-1">
          <ChevronDown className="w-3 h-3" /> 외부 송출 도구 사용 (OBS / DSLR / 다중 카메라)
        </button>
      )}
      {omeAvailable === true && showAdvanced && (
        <button onClick={() => setShowAdvanced(false)}
          className="w-full text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 inline-flex items-center justify-center gap-1">
          <ChevronUp className="w-3 h-3" /> 외부 송출 도구 가이드 접기
        </button>
      )}

      <div className="pt-3 border-t border-gray-100 space-y-3">
        {/* 🛡️ 2026-05-07: Pre-flight 사전 점검 — 30초 멈춤 사고 미연 방지 */}
        <BroadcastPreflightCheck method={method} />

        {/* 인라인 카메라 미리보기 — 어느 방법이든 방송 전 확인용 */}
        <InlineCameraPreview />

        {/* 외부 송출 모드일 때만 OBS/Prism 안내 노출. 브라우저 송출 시엔 숨김 */}
        {(omeAvailable === false || showAdvanced) && (
          <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="flex gap-1 shrink-0">
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${d}s` }} />
              ))}
            </span>
            <p className="text-xs text-blue-700 flex-1">
              송출 도구 (OBS/Prism/Larix) 에서 [방송 시작] 누르면 자동으로 라이브 시작됩니다.
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
          {/* 60초 이상 대기 시 수동 시작 버튼 강조 */}
          <button onClick={() => onGoLive()}
            className={`text-[11px] underline underline-offset-2 transition-colors ${
              waitSeconds >= 60
                ? 'text-orange-500 hover:text-orange-700 font-semibold'
                : 'text-gray-300 hover:text-gray-500'
            }`}>
            {waitSeconds >= 60 ? '⚡ 수동으로 시작' : t('seller.liveBroadcast.manualStartHint')}
          </button>
        </div>
        {/* 2분 이상 대기 시 명시적 안내 */}
        {waitSeconds >= 120 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <span className="text-base shrink-0">⏱️</span>
            <div>
              <p className="text-xs font-bold text-orange-800">송출 감지가 오래 걸리고 있어요</p>
              <p className="text-[11px] text-orange-700 mt-0.5">
                이미 OBS/Prism에서 송출 중이라면 <button onClick={() => onGoLive()} className="underline font-semibold">수동으로 시작</button>을 눌러 진행할 수 있어요.
              </p>
            </div>
          </div>
        )}
      </div>
      {showDiagnostic && (
        <BroadcastDiagnostic streamId={stream.id} method={method} onClose={() => setShowDiagnostic(false)} />
      )}
    </div>
  )
}
