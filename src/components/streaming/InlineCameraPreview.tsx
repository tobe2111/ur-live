/**
 * InlineCameraPreview — getUserMedia 미니 카메라 preview
 *
 * 셀러가 어느 송출 도구를 쓰든 (OBS/Prism/YouTube Studio), 우리 앱 안에서
 * 자기 얼굴/카메라를 확인할 수 있게 해주는 작은 블록.
 * 실제 방송은 아님 — 순수 로컬 preview.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { VideoIcon, MicOff, Mic, CameraOff, RefreshCw } from 'lucide-react'
import { isFeatureBlocked } from '@/lib/in-app-warning'
import InAppFeatureBlockedModal from '@/components/InAppFeatureBlockedModal'

export function InlineCameraPreview() {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCam, setSelectedCam] = useState<string>('')
  // 🛡️ 2026-04-30: 인앱 webview 차단 안내 모달
  const [showBlocked, setShowBlocked] = useState(false)

  async function start(deviceId?: string) {
    // 🛡️ 2026-04-30 v2: try-first 패턴 — 일단 시도하고 실패 시 분류.
    //   PWA standalone / 라인 Android 처럼 "일부 가능" 환경에서 false positive 차단 회피.
    setErr(null)

    // 🛡️ 2026-05-07: navigator.mediaDevices 미존재 사전 체크 (안전하지 않은 context / 구 브라우저).
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const isHttps = typeof location !== 'undefined' && (location.protocol === 'https:' || location.hostname === 'localhost')
      setErr(
        !isHttps
          ? t('seller.cameraHttpsRequired', { defaultValue: 'HTTPS 환경에서만 카메라를 사용할 수 있습니다.' })
          : t('seller.cameraNotSupported', { defaultValue: '이 브라우저는 카메라를 지원하지 않아요. Chrome/Safari/Edge 최신 버전을 사용해주세요.' })
      )
      return
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' },
        audio: false, // 하울링 방지, 마이크 시각화는 별도
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setActive(true)
      // 카메라 목록 로드
      try {
        const all = await navigator.mediaDevices.enumerateDevices()
        setDevices(all.filter(d => d.kind === 'videoinput'))
      } catch { /* 목록 로드 실패는 치명적이지 않음 */ }
    } catch (e: unknown) {
      const err = e as Error
      // 🛡️ 2026-05-07: 에러 종류 확장 (iOS Safari/Brave/Chromium 변형 대응).
      //   NotAllowed: 사용자 거부 / 시스템 차단
      //   NotFound:   카메라 장치 없음
      //   NotReadable / TrackStartError: 다른 앱이 카메라 점유 중 (Zoom, Teams 등)
      //   OverconstrainedError: deviceId 가 사라짐 → 기본 카메라로 재시도
      //   AbortError: 사용자가 프롬프트 무시 / 사파리 PWA 일부 케이스
      //   SecurityError: insecure context
      //   NotSupportedError: 브라우저 미지원
      const denied = ['NotAllowedError', 'NotFoundError', 'NotSupportedError', 'SecurityError'].includes(err.name)
      const inUse = err.name === 'NotReadableError' || err.name === 'TrackStartError'
      const constraintFail = err.name === 'OverconstrainedError'

      if (constraintFail && deviceId) {
        // 특정 deviceId 가 사라짐 → 기본 카메라로 재시도
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          streamRef.current = stream
          if (videoRef.current) videoRef.current.srcObject = stream
          setActive(true)
          return
        } catch { /* fall-through */ }
      }

      if (denied) {
        const blocked = await isFeatureBlocked('camera', { permissionState: 'denied' })
        if (blocked) {
          setShowBlocked(true) // 인앱 detect → 외부 브라우저 안내
          return
        }
        // 일반 브라우저인데 사용자가 권한 거부한 케이스
        setErr(t('seller.cameraDenied', { defaultValue: '카메라 권한이 거부되었어요. 주소창 왼쪽 자물쇠 아이콘 → 카메라 → 허용으로 변경 후 새로고침해주세요.' }))
      } else if (inUse) {
        setErr(t('seller.cameraInUse', { defaultValue: '카메라가 다른 앱에서 사용 중이에요. Zoom/Teams/OBS 등을 종료하고 다시 시도해주세요.' }))
      } else if (err.name === 'AbortError') {
        setErr(t('seller.cameraAbort', { defaultValue: '카메라 요청이 중단됐어요. 다시 시도해주세요.' }))
      } else {
        setErr(err.message || t('seller.cameraAccessFailed', { defaultValue: '카메라 접근 실패' }))
      }
      setActive(false)
    }
  }

  function stop() {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop())
    } catch { /* ignore */ }
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
  }

  useEffect(() => {
    return () => stop()
  }, [])

  if (!active) {
    return (
      <>
        <button onClick={() => start()}
          className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-blue-300 text-left">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <VideoIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{t('seller.cameraPreviewOn', { defaultValue: '카메라 미리보기 켜기' })}</p>
            <p className="text-xs text-gray-500">{t('seller.cameraPreviewDesc', { defaultValue: '방송 전 내 화면 확인 (로컬 미리보기, 방송에 영향 없음)' })}</p>
          </div>
        </button>
        {err && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700 leading-relaxed">
            {err}
          </div>
        )}
        {showBlocked && <InAppFeatureBlockedModal feature="camera" onClose={() => setShowBlocked(false)} />}
      </>
    )
  }

  return (
    <div className="bg-black rounded-xl overflow-hidden relative">
      <video ref={videoRef} autoPlay playsInline muted={muted}
        className="w-full aspect-video object-cover" />
      <div className="absolute top-2 right-2 flex gap-1.5">
        {devices.length > 1 && (
          <select value={selectedCam}
            onChange={e => { setSelectedCam(e.target.value); stop(); start(e.target.value) }}
            className="bg-black/60 text-white text-xs px-2 py-1.5 rounded-md backdrop-blur-sm min-w-[80px] max-w-[140px]">
            {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || t('seller.cameraDefault', { defaultValue: '카메라' })}</option>)}
          </select>
        )}
        <button onClick={() => setMuted(m => !m)}
          className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md backdrop-blur-sm"
          title={t('seller.cameraAudioToggle', { defaultValue: '소리 토글' })}>
          {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { stop(); start(selectedCam) }}
          className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md backdrop-blur-sm"
          title={t('common.refresh', { defaultValue: '새로고침' })}>
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={stop}
          aria-label={t('seller.cameraOff', { defaultValue: '카메라 끄기' })}
          className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md backdrop-blur-sm"
          title={t('seller.cameraOffTitle', { defaultValue: '끄기' })}>
          <CameraOff className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm">
        {t('seller.cameraLocalPreview', { defaultValue: '🔒 로컬 미리보기' })}
      </div>
    </div>
  )
}
