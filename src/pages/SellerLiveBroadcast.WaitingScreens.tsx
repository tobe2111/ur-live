/**
 * Waiting Screens — 라이브 시작 전 대기 화면 2종.
 *
 *   - ScheduledBroadcastWaiting:  예약 방송 카운트다운 (OBS 자동 시작 옵션)
 *   - YouTubeStudioWaiting:        YouTube Studio 팝업 자동 열기 + 자동 감지
 *
 * SellerLiveBroadcastPage.tsx 에서 분리 (TD-006).
 *
 * 🛡️ 2026-04-28: TD-006 추가 분할.
 */
import { useState, useEffect, useRef } from 'react'
import { safeDate, safeTime } from '@/utils/safe-date'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Youtube, Camera } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { OBSWebSocketClient, loadOBSConfig, hasOBSExtension } from '@/lib/obs-websocket'
import { ShareLiveLink } from './SellerLiveBroadcast.parts'
import api from '@/lib/api'

// LiveStream 의 부분만 사용 — 호출처에서 더 풍부한 타입 전달 가능
interface LiveStreamLite {
  id: number
  title: string
  scheduled_at?: string
  rtmp_url?: string
  rtmp_key?: string
  youtube_video_id?: string
  youtube_broadcast_id?: string
}

export function ScheduledBroadcastWaiting({ stream, onBack }: { stream: LiveStreamLite; onBack: () => void }) {
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
      const target = safeTime(stream.scheduled_at)
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

  const scheduledDate = safeDate(stream.scheduled_at)
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

export function YouTubeStudioWaiting({ stream, accent }: { stream: LiveStreamLite; accent: 'pink' | 'red' }) {
  const { t } = useTranslation()
  const popupRef = useRef<Window | null>(null)
  const openedRef = useRef(false)
  const obsAutoTriedRef = useRef(false)
  const [obsAutoState, setObsAutoState] = useState<'idle' | 'connecting' | 'success' | 'failed'>('idle')
  const [popupBlocked, setPopupBlocked] = useState(false)
  const vid = stream.youtube_video_id || stream.youtube_broadcast_id

  // 🛡️ 2026-05-07: YouTube Studio 모드도 obs-websocket 설정이 있으면 자동 송출 시도.
  //   YT Studio popup 은 모니터링용으로 유지, OBS 는 백그라운드에서 자동 송출.
  useEffect(() => {
    if (obsAutoTriedRef.current) return
    obsAutoTriedRef.current = true
    if (!stream.rtmp_url || !stream.rtmp_key) return

    ;(async () => {
      try {
        const { OBSWebSocketClient, loadOBSConfig, hasOBSExtension } = await import('@/lib/obs-websocket')
        const cfg = loadOBSConfig()
        if (!cfg) return // 저장된 설정 없음 → 조용히 skip (사용자가 직접 OBS 켜야 함)

        // HTTPS + ws://localhost Mixed Content 차단 사전 감지
        const isHttps = typeof location !== 'undefined' && location.protocol === 'https:'
        const isLocalhostTarget = !cfg.host || cfg.host === 'localhost' || cfg.host === '127.0.0.1'
        if (isHttps && isLocalhostTarget && !hasOBSExtension()) {
          // 익스텐션 없으면 자동 시도 자체를 안 함 (false alarm 방지)
          return
        }

        setObsAutoState('connecting')
        const client = new OBSWebSocketClient()
        await client.connect(cfg)
        await client.setRtmpTarget(stream.rtmp_url!, stream.rtmp_key!)
        await client.startStreaming()
        setObsAutoState('success')
      } catch {
        setObsAutoState('failed')
      }
    })()
  }, [stream.id, stream.rtmp_url, stream.rtmp_key])

  // ?ur_stream_id 로 우리 Chrome Extension 에 streamId 전달
  //   → Extension content-studio.js 가 사이드바 iframe 을 /embed/live/:id 로 자동 연결
  const studioUrl = vid
    ? `https://studio.youtube.com/video/${vid}/livestreaming?ur_stream_id=${stream.id}`
    : `https://studio.youtube.com/channel/UC/livestreaming?ur_stream_id=${stream.id}`

  function openPopup() {
    const w = Math.min(1280, Math.floor(window.screen.availWidth * 0.85))
    const h = Math.min(820, Math.floor(window.screen.availHeight * 0.85))
    const left = Math.floor((window.screen.availWidth - w) / 2)
    const top = Math.floor((window.screen.availHeight - h) / 2)
    const features = `popup=yes,width=${w},height=${h},left=${left},top=${top},noopener`
    try {
      const p = window.open(studioUrl, 'ur-yt-studio', features)
      if (p) { popupRef.current = p; setPopupBlocked(false) }
      else setPopupBlocked(true)
    } catch { setPopupBlocked(true) }
  }

  // YouTube 공식 앱 Deep link (모바일) — 구독자 50+ 필요 (YouTube 정책)
  // 설치된 YouTube 앱을 직접 엶 → 새로운 앱 설치 부담 0
  function openYouTubeApp() {
    const videoUrl = vid ? `https://www.youtube.com/watch?v=${vid}` : 'https://m.youtube.com/'
    try {
      window.location.href = videoUrl
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    const tid = setTimeout(openPopup, 200)
    return () => {
      clearTimeout(tid)
      try {
        if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
      } catch { /* ignore */ }
      popupRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const colorMap = {
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', icon: 'bg-pink-100 text-pink-600', dot: 'bg-pink-400', accent: 'text-pink-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100 text-red-600', dot: 'bg-red-400', accent: 'text-red-700' },
  }[accent]

  return (
    <div className={`${colorMap.bg} border ${colorMap.border} rounded-xl p-5 space-y-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${colorMap.icon} rounded-xl flex items-center justify-center`}>
          <Youtube className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{t('seller.liveBroadcast.studioOpened')}</p>
          <p className="text-xs text-gray-600 mt-0.5">{t('seller.liveBroadcast.studioOpenedDesc')}</p>
        </div>
      </div>

      <div className={`flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2.5 border ${colorMap.border}`}>
        <span className="flex gap-1 shrink-0">
          {[0, 0.2, 0.4].map((d, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${colorMap.dot} animate-bounce`}
              style={{ animationDelay: `${d}s` }} />
          ))}
        </span>
        <p className={`text-xs font-medium ${colorMap.accent} flex-1`}>
          {t('seller.liveBroadcast.autoDetecting')}
        </p>
      </div>

      {/* 🛡️ 2026-05-07: OBS 자동 송출 상태 (저장된 obs-websocket 설정 있을 때만) */}
      {obsAutoState !== 'idle' && (
        <div className={`border rounded-lg p-3 space-y-0.5 ${
          obsAutoState === 'success' ? 'bg-green-50 border-green-200' :
          obsAutoState === 'failed' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <p className={`text-xs font-bold ${
            obsAutoState === 'success' ? 'text-green-900' :
            obsAutoState === 'failed' ? 'text-red-900' :
            'text-blue-900'
          }`}>
            {obsAutoState === 'connecting' && '⚙️ OBS 자동 연결 중…'}
            {obsAutoState === 'success' && '✅ OBS 자동 송출 시작됨'}
            {obsAutoState === 'failed' && '⚠️ OBS 자동 연결 실패'}
          </p>
          <p className={`text-[11px] leading-relaxed ${
            obsAutoState === 'success' ? 'text-green-800' :
            obsAutoState === 'failed' ? 'text-red-800' :
            'text-blue-800'
          }`}>
            {obsAutoState === 'connecting' && 'obs-websocket 으로 OBS 를 자동 제어합니다.'}
            {obsAutoState === 'success' && 'YouTube Studio 에서 곧 영상이 잡혀요.'}
            {obsAutoState === 'failed' && 'OBS 가 켜져있고 WebSocket 이 활성화됐는지 확인해주세요.'}
          </p>
        </div>
      )}

      {/* 🛡️ 2026-05-07: 셀러가 "데이터 없음" 화면 보고 멈춤 — RTMP 송출 필요 명시 (auto OBS 실패시만 노출) */}
      {obsAutoState !== 'success' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-bold text-amber-900">⚠️ YouTube Studio 에 "데이터 없음" 표시 시</p>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            이 모드는 <b>OBS / 인코더에서 RTMP 송출</b>이 필요해요. 웹캠만으로는 진행이 안 됩니다.
            OBS 가 없다면 <b>"OBS Studio"</b> 또는 <b>"Prism Mobile"</b> 모드로 다시 시작해주세요.
          </p>
        </div>
      )}

      {popupBlocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <span className="text-sm shrink-0">🚫</span>
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-900">팝업이 차단됐습니다</p>
            <p className="text-[11px] text-amber-800 mt-0.5">브라우저 주소창 오른쪽 팝업 차단 아이콘을 클릭해 허용 후 아래 버튼을 눌러주세요.</p>
          </div>
        </div>
      )}

      <button onClick={openPopup}
        className="w-full text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 py-1">
        {t('seller.liveBroadcast.reopenStudio')}
      </button>

      {typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent) && (
        <button onClick={openYouTubeApp}
          className="w-full mt-1 py-2 bg-white/70 hover:bg-white border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
          📱 YouTube 앱에서 열기
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// YouTubeWebcamWaiting — OBS 없이 YouTube Studio 웹캠으로 라이브
//
// 플로우:
//   1. /create-webcam 으로 생성 → youtube_video_id 없음 (YouTube API 호출 안 함)
//   2. 셀러가 YouTube Studio 에서 직접 웹캠 방송 시작
//   3. /detect-webcam (10s 폴링) → liveBroadcasts.list 로 활성 방송 자동 감지
//   4. 감지 시 /link-broadcast PATCH → youtube_video_id DB 저장 → onGoLive()
// ─────────────────────────────────────────────────────────────────────────────
export function YouTubeWebcamWaiting({ stream, onGoLive, channelId }: { stream: LiveStreamLite; onGoLive: () => void; channelId?: string }) {
  const popupRef = useRef<Window | null>(null)
  const openedRef = useRef(false)
  const linkingRef = useRef(false)
  const [detected, setDetected] = useState<{ youtube_video_id: string; title?: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)

  // 실제 채널 ID 사용 — UC 플레이스홀더 대신 셀러의 실제 채널로 정확히 이동
  const studioUrl = `https://studio.youtube.com/channel/${channelId || 'UC'}/livestreaming`

  function openStudio() {
    if (isMobile) {
      window.open(studioUrl, '_blank', 'noopener')
    } else {
      const w = Math.min(1280, Math.floor(window.screen.availWidth * 0.85))
      const h = Math.min(820, Math.floor(window.screen.availHeight * 0.85))
      const left = Math.floor((window.screen.availWidth - w) / 2)
      const top = Math.floor((window.screen.availHeight - h) / 2)
      try {
        const p = window.open(studioUrl, 'ur-yt-studio', `popup=yes,width=${w},height=${h},left=${left},top=${top},noopener`)
        if (p) { popupRef.current = p; setPopupBlocked(false) }
        else setPopupBlocked(true)
      } catch { setPopupBlocked(true); window.open(studioUrl, '_blank', 'noopener') }
    }
  }

  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    setTimeout(openStudio, 200)
    // 🛡️ 2026-05-07: 웹캠 모드는 popup = 카메라 인코더. 자동 close 시 방송 즉시 끊김.
    //   라이브 전환 시 WaitingScreens 언마운트 되더라도 popup 유지 (셀러가 명시적으로 닫을 때까지).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 경과 시간 카운터
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // /detect-webcam 폴링 — 10s 간격, liveBroadcasts.list 1 unit/call
  // 🛡️ 2026-05-07: Visibility API 통합 — 셀러가 우리 탭으로 복귀할 때 즉시 폴링.
  //   YouTube Studio 에서 라이브 시작 → 우리 탭 복귀 시 10s 기다리지 않고 바로 감지.
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (linkingRef.current || cancelled) return
      try {
        const res = await api.get(`/api/seller/youtube/live/${stream.id}/detect-webcam`)
        if (!cancelled && res.data?.success && res.data.data) {
          linkingRef.current = true
          const d = res.data.data as { youtube_video_id: string; title?: string }
          try {
            await api.patch(`/api/seller/youtube/live/${stream.id}/link-broadcast`, {
              youtube_video_id: d.youtube_video_id,
            })
            if (!cancelled) { setDetected(d); setTimeout(onGoLive, 1200) }
          } catch {
            linkingRef.current = false // PATCH 실패 시 재시도 허용
          }
        }
      } catch { /* 네트워크 오류 무시 */ }
    }
    poll()
    const id = setInterval(poll, 10000)
    const onVisible = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [stream.id, onGoLive])

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
          <Camera className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">YouTube Studio 웹캠 라이브</p>
          <p className="text-xs text-gray-600 mt-0.5">OBS 없이 브라우저/앱 웹캠으로 바로 송출</p>
        </div>
      </div>

      {detected ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-green-800">방송 감지됨! 라이브 화면으로 전환 중…</p>
            {detected.title && <p className="text-[11px] text-green-700 mt-0.5 truncate">{detected.title}</p>}
          </div>
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {(isMobile ? [
              'YouTube Studio 앱에서 "웹캠" 탭으로 방송 시작',
              '방송이 시작되면 자동으로 감지됩니다',
            ] : [
              '팝업 YouTube Studio 창에서 "웹캠" 탭 선택',
              '카메라/마이크 설정 후 "라이브 시작" 클릭',
              '방송이 시작되면 자동으로 감지됩니다 ✓',
            ]).map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-xs text-gray-700">{s}</span>
              </li>
            ))}
          </ol>

          <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2.5 border border-red-100">
            <span className="flex gap-1 shrink-0">
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
              ))}
            </span>
            <p className="text-xs text-red-700 flex-1">YouTube 방송 시작 감지 중…</p>
            <span className="text-[11px] text-red-400 font-mono shrink-0">
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </span>
          </div>

          {/* 30초 후: 방송 시작했는지 확인 유도 */}
          {elapsed >= 30 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
              <p className="text-xs text-amber-800">YouTube Studio에서 방송을 시작하셨나요?</p>
              <button onClick={onGoLive}
                className="shrink-0 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold rounded-md">
                네, 시작했어요
              </button>
            </div>
          )}

          {popupBlocked && !isMobile && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <span className="text-sm shrink-0">🚫</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-900">팝업이 차단됐습니다</p>
                <p className="text-[11px] text-amber-800 mt-0.5">주소창 오른쪽 팝업 차단 아이콘을 허용 후 아래 버튼을 눌러주세요.</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={openStudio}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5">
              <Youtube className="w-3.5 h-3.5" />
              {isMobile ? 'YouTube Studio 열기' : 'Studio 팝업 다시 열기'}
            </button>
            <button onClick={onGoLive}
              className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 shrink-0">
              수동 시작
            </button>
          </div>
        </>
      )}
    </div>
  )
}
