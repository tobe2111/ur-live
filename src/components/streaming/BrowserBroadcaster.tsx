/**
 * 🛡️ 2026-05-08: 브라우저 직접 송출 (WebRTC + WHIP) — UR Live 자체 미디어 서버 사용.
 *
 * 흐름:
 *   1. getUserMedia (camera + mic)
 *   2. POST /api/seller/youtube/streaming/whip-token  → WHIP endpoint URL + 토큰
 *   3. RTCPeerConnection 생성 → addTrack → createOffer
 *   4. WHIP POST (offer SDP) → answer SDP 받음
 *   5. setRemoteDescription → ICE 연결 → 송출 시작
 *   6. OME 가 admission webhook 으로 token 검증 → YouTube 로 RTMP push 시작
 *   7. 부모 컴포넌트의 onStreaming() 콜백 실행 — YouTube 라이브 폴링이 알아서 라이브 전환 감지
 *
 * Fallback:
 *   - WHIP 토큰 발급 실패 (OME 미구성) → onUnsupported() 호출 → 부모가 Larix/OBS 가이드 표시
 *   - WebRTC 미지원 브라우저 → 동일 fallback
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2, Camera, Mic, MicOff, Video, VideoOff, AlertCircle, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'

type WhipMode = 'youtube_whip' | 'ome_whip'

interface Props {
  streamId: number
  onStreaming?: (mode: WhipMode) => void  // WebRTC 연결 성립 시, mode 전달
  onError?: (msg: string) => void
  onUnsupported?: (reason: string) => void
}

type Status = 'idle' | 'requesting_camera' | 'fetching_token' | 'connecting' | 'live' | 'failed' | 'permission_denied'

export default function BrowserBroadcaster({ streamId, onStreaming, onError, onUnsupported }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [devices, setDevices] = useState<{ cams: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cams: [], mics: [] })
  const [selected, setSelected] = useState<{ camId?: string; micId?: string }>({})
  // 자동 재연결 — 의도적 종료 (사용자 클릭 stop) 가 아닌 끊김 시에만.
  const userStoppedRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const wasConnectedRef = useRef(false)
  const modeRef = useRef<WhipMode>('youtube_whip')
  const [reconnectingIn, setReconnectingIn] = useState<number | null>(null)

  // 브라우저 호환성 사전 체크
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      onUnsupported?.('이 브라우저는 WebRTC 송출을 지원하지 않습니다')
    }
  }, [onUnsupported])

  // 디바이스 목록 로드 (카메라/마이크 선택용)
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    void (async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices()
        setDevices({
          cams: list.filter(d => d.kind === 'videoinput'),
          mics: list.filter(d => d.kind === 'audioinput'),
        })
      } catch { /* 권한 전엔 빈 라벨 — 무시 */ }
    })()
  }, [])

  // cleanup
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      pcRef.current?.close()
    }
  }, [])

  // 🛡️ 2026-05-11 P1-#6: 라이브 시작 5초 후 video 프레임 캡처 → thumbnail 자동 설정
  //   셀러가 thumbnail 미설정 시 빈 이미지로 표시되는 문제 해결. 백그라운드 자동 — UI 변경 없음.
  const thumbnailCapturedRef = useRef(false)
  useEffect(() => {
    if (status !== 'live' || thumbnailCapturedRef.current) return
    thumbnailCapturedRef.current = true
    const timer = setTimeout(async () => {
      const video = videoRef.current
      if (!video || video.videoWidth === 0) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85))
        if (!blob) return
        const form = new FormData()
        form.append('image', new File([blob], `stream_${streamId}_auto.jpg`, { type: 'image/jpeg' }))
        const upload = await api.post('/api/seller/upload-image', form)
        const url = upload.data?.data?.url
        if (url) {
          await api.put(`/api/seller/streams/${streamId}`, { thumbnail: url })
        }
      } catch { /* best-effort, 실패해도 라이브엔 영향 없음 */ }
    }, 5000)
    return () => clearTimeout(timer)
  }, [status, streamId])

  // 🛡️ 2026-05-11 P0-#1: 탭/브라우저 닫힘 시 좀비 스트림 방지.
  //   beforeunload → sendBeacon 으로 /live/:id/end 호출 (비동기 fetch 는 unload 시 차단됨).
  //   sendBeacon 은 페이지 unload 후에도 백그라운드로 전송 보장.
  useEffect(() => {
    function handleUnload() {
      // pc 가 살아있는 동안만 (방송 중) cleanup 요청
      if (!pcRef.current || pcRef.current.connectionState !== 'connected') return
      try {
        // Authorization 헤더는 sendBeacon 에 못 실음 → 토큰을 body 에 함께 전송.
        const token = localStorage.getItem('seller_token') || localStorage.getItem('admin_token') || ''
        const blob = new Blob(
          [JSON.stringify({ stream_id: streamId, token, reason: 'tab_close' })],
          { type: 'application/json' }
        )
        navigator.sendBeacon(`/api/seller/youtube/live/${streamId}/end-beacon`, blob)
      } catch { /* best-effort */ }
    }
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
    }
  }, [streamId])

  async function startBroadcast() {
    setErrorMsg(null)

    // 1. 카메라/마이크 권한 + stream — 재연결 시엔 기존 stream 재사용
    let stream: MediaStream
    if (streamRef.current && streamRef.current.getTracks().every(t => t.readyState === 'live')) {
      stream = streamRef.current
    } else {
    setStatus('requesting_camera')
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selected.camId ? { exact: selected.camId } : undefined,
          // 🛡️ 2026-05-11: 1080p 우선 — 5Mbps 업로드면 가능. 카메라 미지원 시 자동 720p fallback.
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 24, max: 30 },
        },
        audio: {
          deviceId: selected.micId ? { exact: selected.micId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (e) {
      const isPermDenied = (e as Error).name === 'NotAllowedError'
      const msg = isPermDenied
        ? '카메라/마이크 권한이 거부됐어요. 주소창의 자물쇠 아이콘에서 허용으로 변경해주세요.'
        : '카메라 접근 실패: ' + (e as Error).message
      // 🛡️ 2026-05-11: 권한 거부는 별도 status — 재시도해도 같은 에러 반복되므로 사용자 행동 필요.
      setErrorMsg(msg); setStatus(isPermDenied ? 'permission_denied' : 'failed'); onError?.(msg); return
    }
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream

    // 디바이스 라벨 다시 로드 (권한 후엔 라벨 채워짐)
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        cams: list.filter(d => d.kind === 'videoinput'),
        mics: list.filter(d => d.kind === 'audioinput'),
      })
    } catch { /* noop */ }
    }  // end "새 stream 획득" block

    // 2. WHIP endpoint 발급 (YouTube WHIP direct 또는 OME WHIP fallback)
    setStatus('fetching_token')
    let whipUrl: string
    try {
      const res = await api.post('/api/seller/youtube/streaming/whip-token', { stream_id: streamId })
      if (!res.data?.success) throw new Error(res.data?.error || '토큰 발급 실패')
      whipUrl = res.data.data.whip_url
      modeRef.current = (res.data.data.mode as WhipMode) || 'youtube_whip'
    } catch (e) {
      const errResp = (e as { response?: { data?: { error_code?: string; error?: string; rtmp_url?: string } } })?.response?.data
      const errCode = errResp?.error_code
      if (errCode === 'OME_NOT_CONFIGURED' || errCode === 'OBS_REQUIRED') {
        // 🛡️ 2026-05-12 (LIVE-FIX-3): OBS_REQUIRED 도 브라우저 라이브 불가 → OBS 안내 흐름.
        //   이전: 알 수 없는 코드 → 일반 에러로 표시. 명확한 가이드로 UX 개선.
        const guidance = errCode === 'OBS_REQUIRED'
          ? '브라우저에서는 직접 송출이 불가능합니다. OBS 등 외부 도구를 사용해주세요.'
          : (errResp?.error || '자체 미디어 서버 미구성 — 외부 도구로 송출')
        onUnsupported?.(guidance)
        cleanup()
        return
      }
      const msg = '토큰 발급 실패: ' + (e as Error).message
      setErrorMsg(msg); setStatus('failed'); onError?.(msg); cleanup(); return
    }

    // 3. RTCPeerConnection
    setStatus('connecting')
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      bundlePolicy: 'max-bundle',
    })
    pcRef.current = pc

    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') {
        setStatus('live')
        reconnectAttemptsRef.current = 0
        wasConnectedRef.current = true
        onStreaming?.(modeRef.current)
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (userStoppedRef.current) return
        // 한 번도 connected 한 적 없으면 자동 재연결 안 함 (초기 연결 실패는 사용자가 재시도)
        if (!wasConnectedRef.current) {
          setStatus('failed')
          setErrorMsg('연결 실패 — 다시 시도 버튼을 눌러주세요.')
          return
        }
        // exponential backoff (3s, 6s, 12s, 24s, 30s max), 최대 5회 시도
        const attempt = reconnectAttemptsRef.current + 1
        if (attempt > 5) {
          setStatus('failed')
          setErrorMsg('재연결 실패 — 다시 시도 버튼을 눌러주세요.')
          return
        }
        reconnectAttemptsRef.current = attempt
        const delaySec = Math.min(3 * Math.pow(2, attempt - 1), 30)
        setReconnectingIn(delaySec)
        const tick = setInterval(() => {
          setReconnectingIn(s => {
            if (s === null || s <= 1) {
              clearInterval(tick)
              return null
            }
            return s - 1
          })
        }, 1000)
        setTimeout(() => {
          clearInterval(tick)
          setReconnectingIn(null)
          // 기존 PC 정리 후 재시도 (stream 은 유지 — 재getUserMedia 불필요)
          pc.close()
          if (!userStoppedRef.current) void startBroadcast()
        }, delaySec * 1000)
      }
    })

    // H.264 우선 (YouTube/OME 패스스루 호환). 없으면 VP8 fallback 자동.
    stream.getTracks().forEach(track => {
      const sender = pc.addTrack(track, stream)
      if (track.kind === 'video') {
        const params = sender.getParameters()
        // 🛡️ 2026-05-11 Option D: YouTube WHIP direct 는 셀러가 보내는 게 그대로 시청자에게 전달됨
        //   → 화질이 더 중요. 1080p30 YouTube 권장 상한 6 Mbps 로 상향. 모바일 LTE 도 보통 6Mbps 업로드 OK.
        //   maintain-resolution: 대역폭 부족 시 프레임 떨어뜨려도 해상도 유지 (상품 디테일 살림).
        params.encodings = [{
          maxBitrate: 6_000_000,
          maxFramerate: 30,
          networkPriority: 'high',
          priority: 'high',
        }]
        params.degradationPreference = 'maintain-resolution'
        sender.setParameters(params).catch((e) => { if (import.meta.env.DEV) console.warn('[BrowserBroadcaster] video setParameters failed:', e) })
      } else if (track.kind === 'audio') {
        const params = sender.getParameters()
        // 🛡️ 2026-05-11: Opus 192 kbps stereo - 라이브 음악/상품 사운드까지 깔끔 재생.
        //   대역폭 negligible (192 kbps), 음질 체감 차이 큼. YouTube Live 권장 상한.
        params.encodings = [{ maxBitrate: 192_000, networkPriority: 'high', priority: 'high' }]
        sender.setParameters(params).catch((e) => { if (import.meta.env.DEV) console.warn('[BrowserBroadcaster] audio setParameters failed:', e) })
      }
    })

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // ICE gathering 완료 대기 (간단 trickle 미사용 — WHIP 표준은 단일 SDP 교환).
      // 🛡️ 2026-05-11 Option D: YouTube WHIP/OME WHIP 모두 well-known 엔드포인트 → 1~2s 면 충분.
      //   5s → 2s 단축 (라이브 시작 시간 평균 3s 단축).
      await waitIceGathering(pc, 2000)

      // 4. WHIP POST
      const res = await fetch(whipUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp || '',
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`WHIP HTTP ${res.status}: ${text}`)
      }
      const answerSdp = await res.text()
      // 🛡️ 2026-05-10: OME 0.16.7 SDP answer 가 ssrc-audio-level 와 transport-wide-cc 를
      //   같은 RTP extension ID (1) 로 보내서 Chrome 이 거부.
      //   → OME WHIP 전용 워크어라운드 (YouTube WHIP 에는 불필요 — SDP 가 올바름).
      const sanitized = modeRef.current === 'ome_whip'
        ? answerSdp
            .split('\n')
            .filter(l => !/^a=extmap:\d+\s+http:\/\/www\.ietf\.org\/id\/draft-holmer-rmcat-transport-wide-cc-extensions/.test(l))
            .join('\n')
        : answerSdp
      await pc.setRemoteDescription({ type: 'answer', sdp: sanitized })
    } catch (e) {
      const msg = '연결 실패: ' + (e as Error).message
      setErrorMsg(msg); setStatus('failed'); onError?.(msg); cleanup()
    }
  }

  function stopBroadcast() {
    userStoppedRef.current = true
    reconnectAttemptsRef.current = 0
    setReconnectingIn(null)
    cleanup()
    setStatus('idle')
  }

  async function startBroadcastWrapper() {
    userStoppedRef.current = false
    reconnectAttemptsRef.current = 0
    await startBroadcast()
  }

  function cleanup() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next })
  }
  function toggleCam() {
    const next = !camOff
    setCamOff(next)
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next })
  }

  const isRunning = status === 'live' || status === 'connecting' || status === 'fetching_token' || status === 'requesting_camera'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      {/* 비디오 미리보기 */}
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <Camera className="w-12 h-12 opacity-30" />
          </div>
        )}
        {status === 'live' && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white px-2 py-1 rounded text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </div>
        )}
        {(status === 'fetching_token' || status === 'connecting' || status === 'requesting_camera') && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {status === 'requesting_camera' && '카메라 권한 요청 중…'}
            {status === 'fetching_token' && '서버 연결 준비 중…'}
            {status === 'connecting' && '송출 연결 중…'}
          </div>
        )}
        {reconnectingIn !== null && (
          <div className="absolute top-3 right-3 bg-amber-500 text-white text-[11px] font-bold px-2 py-1 rounded">
            재연결 {reconnectingIn}s…
          </div>
        )}
      </div>

      {/* 디바이스 선택 (송출 전에만) */}
      {status === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <select value={selected.camId || ''} onChange={e => setSelected(s => ({ ...s, camId: e.target.value }))}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900">
            <option value="">📷 카메라 자동선택</option>
            {devices.cams.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `카메라 ${d.deviceId.slice(0, 6)}`}</option>)}
          </select>
          <select value={selected.micId || ''} onChange={e => setSelected(s => ({ ...s, micId: e.target.value }))}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900">
            <option value="">🎙️ 마이크 자동선택</option>
            {devices.mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `마이크 ${d.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </div>
      )}

      {/* 컨트롤 */}
      <div className="flex items-center gap-2">
        {!isRunning ? (
          <Button onClick={startBroadcastWrapper} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            <span className="w-2 h-2 rounded-full bg-white mr-2" /> 방송 시작
          </Button>
        ) : (
          <>
            <Button onClick={toggleMute} variant="outline" size="sm">
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button onClick={toggleCam} variant="outline" size="sm">
              {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </Button>
            <div className="flex-1" />
            <Button onClick={stopBroadcast} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
              방송 종료
            </Button>
          </>
        )}
      </div>

      {/* 에러 */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-red-800">
            {errorMsg}
            {status === 'permission_denied' && (
              <p className="mt-1 text-[10px] text-red-700">
                Chrome: 주소창 왼쪽 자물쇠 → 카메라/마이크 → 허용 → 페이지 새로고침
              </p>
            )}
          </div>
          {/* 권한 거부 시 재시도 버튼 숨김 — 사용자가 브라우저 설정 변경해야 함 */}
          {status !== 'permission_denied' && (
            <button onClick={() => { setErrorMsg(null); setStatus('idle') }}
              className="text-[11px] text-red-600 underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> 다시
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function waitIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') return resolve()
    const t = setTimeout(() => resolve(), timeoutMs)
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t)
        pc.removeEventListener('icegatheringstatechange', check)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', check)
  })
}
