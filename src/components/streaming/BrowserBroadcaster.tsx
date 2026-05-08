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

interface Props {
  streamId: number
  onStreaming?: () => void  // WebRTC 연결 성립 시
  onError?: (msg: string) => void
  onUnsupported?: (reason: string) => void
}

type Status = 'idle' | 'requesting_camera' | 'fetching_token' | 'connecting' | 'live' | 'failed'

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
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          deviceId: selected.micId ? { exact: selected.micId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (e) {
      const msg = (e as Error).name === 'NotAllowedError'
        ? '카메라/마이크 권한이 거부됐어요. 주소창의 자물쇠 아이콘에서 허용으로 변경해주세요.'
        : '카메라 접근 실패: ' + (e as Error).message
      setErrorMsg(msg); setStatus('failed'); onError?.(msg); return
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

    // 2. WHIP 토큰 발급
    setStatus('fetching_token')
    let whipUrl: string
    try {
      const res = await api.post('/api/seller/youtube/streaming/whip-token', { stream_id: streamId })
      if (!res.data?.success) throw new Error(res.data?.error || '토큰 발급 실패')
      whipUrl = res.data.data.whip_url
    } catch (e) {
      const errCode = (e as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code
      if (errCode === 'OME_NOT_CONFIGURED') {
        onUnsupported?.('자체 미디어 서버 미구성 — 외부 도구로 송출')
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
        onStreaming?.()
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (userStoppedRef.current) return
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
        params.encodings = [{ maxBitrate: 2_500_000, maxFramerate: 30 }]
        sender.setParameters(params).catch(() => {})
      }
    })

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // ICE gathering 완료 대기 (간단 trickle 미사용 — WHIP 표준은 단일 SDP 교환)
      await waitIceGathering(pc, 5000)

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
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
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
          <div className="flex-1 text-xs text-red-800">{errorMsg}</div>
          <button onClick={() => { setErrorMsg(null); setStatus('idle') }}
            className="text-[11px] text-red-600 underline flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> 다시
          </button>
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
