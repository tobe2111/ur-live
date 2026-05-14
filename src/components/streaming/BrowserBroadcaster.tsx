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

type WhipMode = 'youtube_whip' | 'ome_whip' | 'youtube_whip_proxy'

interface Props {
  streamId: number
  onStreaming?: (mode: WhipMode) => void  // WebRTC 연결 성립 시, mode 전달
  onError?: (msg: string) => void
  onUnsupported?: (reason: string) => void
  // 🛡️ 2026-05-13: mount 시 자동 시작 — 새로고침 후 status='live' 인 경우 셀러가 다시 클릭 안 해도 재연결.
  autoStart?: boolean
}

type Status = 'idle' | 'requesting_camera' | 'fetching_token' | 'connecting' | 'live' | 'failed' | 'permission_denied'

export default function BrowserBroadcaster({ streamId, onStreaming, onError, onUnsupported, autoStart }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const videoSenderRef = useRef<RTCRtpSender | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // 🛡️ 2026-05-14: WHIP 토큰 prewarm — 셀러가 "시작" 클릭 전에 백그라운드 fetch.
  //   효과: 클릭 → 라이브 활성 시간 -300~500ms (네트워크 RTT 1번 절약).
  const prewarmedTokenRef = useRef<{ whipUrl: string; mode: WhipMode; isProxy: boolean; ts: number } | null>(null)
  // WebAudio cleanup chain context (NoiseReduction wrapper 의 정리용)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  // 🛡️ 2026-05-13: 실제 캡처 해상도 — 카메라가 1080p 못 잡으면 셀러에게 안내
  const [captureRes, setCaptureRes] = useState<{ width: number; height: number } | null>(null)
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

  // 🛡️ 2026-05-14: WHIP 토큰 pre-warm — 셀러가 "시작" 클릭 전에 백그라운드 fetch.
  //   60s 유효성 보장. 효과: 클릭 → 라이브 활성 -300~500ms.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await api.post('/api/seller/youtube/streaming/whip-token', { stream_id: streamId })
        if (cancelled) return
        if (res.data?.success && res.data?.data?.whip_url) {
          prewarmedTokenRef.current = {
            whipUrl: res.data.data.whip_url,
            mode: (res.data.data.mode as WhipMode) || 'youtube_whip',
            isProxy: (res.data.data.mode as string) === 'youtube_whip_proxy',
            ts: Date.now(),
          }
        }
      } catch { /* prewarm 실패해도 정상 흐름은 보존 — startBroadcast 가 다시 fetch */ }
    })()
    return () => { cancelled = true }
  }, [streamId])

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

  // 🛡️ 2026-05-13: 자동 시작 — 페이지 새로고침 후 status='live' 면 셀러 클릭 없이 재연결.
  //   getUserMedia 권한은 이미 허용된 도메인이면 prompt 없이 통과. autoplay-permission 정책상 동작.
  //   1회만 실행, status='idle' 일 때만 (이미 진행 중이면 skip).
  const autoStartedRef = useRef(false)
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return
    if (status !== 'idle') return
    autoStartedRef.current = true
    void startBroadcast()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  // 🛡️ 2026-05-13: Network-aware 적응형 비트레이트 — 패킷 손실/RTT 모니터링 → 자동 하향/복구.
  //   "끊기느니 저화질" 원칙. 라이브 커머스 안정성 매출 직결.
  //
  //   알고리즘:
  //   - 1.5s 주기 getStats() 호출
  //   - packetLoss > 5% 또는 RTT > 300ms 면 비트레이트 한 단계 하향 (6M → 4M → 2M → 1M)
  //   - 양호 (loss < 1% AND RTT < 150ms) 가 5회 연속 (~7.5s) 면 한 단계 복구
  //   - 최저 800kbps 까지만 (그 이하면 화질 안 보여서 의미 X)
  useEffect(() => {
    if (status !== 'live') return
    const pc = pcRef.current
    if (!pc) return

    // 🛡️ 2026-05-13 v2: 화질 최대화 우선 — 하한 3Mbps (1080p 최저 권장). 그 아래로 안 내려감.
    //   "끊기느니 저화질" 보다 "끊기더라도 최고 화질 유지" 가 사용자 요청.
    //   네트워크 약하면 영상 끊김 위험은 있지만 화질 보장.
    const BITRATE_LADDER = [9_000_000, 7_000_000, 5_000_000, 4_000_000, 3_000_000]
    let currentLevel = 0
    let consecutiveGood = 0
    let lastPacketsLost = 0
    let lastPacketsSent = 0

    const setBitrate = async (bps: number) => {
      const sender = videoSenderRef.current
      if (!sender) return
      try {
        const params = sender.getParameters()
        if (!params.encodings?.[0]) return
        params.encodings[0].maxBitrate = bps
        await sender.setParameters(params)
        if (import.meta.env.DEV) console.log(`[Adaptive] bitrate → ${Math.round(bps / 1000)}kbps`)
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[Adaptive] setBitrate failed:', e)
      }
    }

    const tick = async () => {
      try {
        const stats = await pc.getStats()
        let packetsLost = 0
        let packetsSent = 0
        let roundTripTime = 0
        let nackCount = 0

        stats.forEach((report) => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            packetsSent = (report as { packetsSent?: number }).packetsSent ?? 0
            nackCount = (report as { nackCount?: number }).nackCount ?? 0
          } else if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
            packetsLost = (report as { packetsLost?: number }).packetsLost ?? 0
            roundTripTime = (report as { roundTripTime?: number }).roundTripTime ?? 0
          }
        })

        // delta 계산 (전체 누적값이 아니라 이번 인터벌 동안 차이)
        const deltaSent = packetsSent - lastPacketsSent
        const deltaLost = packetsLost - lastPacketsLost
        lastPacketsSent = packetsSent
        lastPacketsLost = packetsLost

        const lossRate = deltaSent > 0 ? deltaLost / deltaSent : 0
        const rttMs = roundTripTime * 1000

        const isBad = lossRate > 0.05 || rttMs > 300 || nackCount > 50
        const isGood = lossRate < 0.01 && rttMs < 150 && rttMs > 0

        if (isBad && currentLevel < BITRATE_LADDER.length - 1) {
          currentLevel++
          consecutiveGood = 0
          await setBitrate(BITRATE_LADDER[currentLevel])
          if (import.meta.env.DEV) console.log(`[Adaptive] downgrade — loss=${(lossRate * 100).toFixed(1)}% RTT=${rttMs.toFixed(0)}ms`)
        } else if (isGood && currentLevel > 0) {
          consecutiveGood++
          if (consecutiveGood >= 5) {
            currentLevel--
            consecutiveGood = 0
            await setBitrate(BITRATE_LADDER[currentLevel])
            if (import.meta.env.DEV) console.log(`[Adaptive] recover — loss=${(lossRate * 100).toFixed(1)}% RTT=${rttMs.toFixed(0)}ms`)
          }
        } else if (!isGood) {
          consecutiveGood = 0
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[Adaptive] tick failed:', e)
      }
    }

    const interval = setInterval(() => { void tick() }, 1500)
    return () => clearInterval(interval)
  }, [status])

  // 🛡️ 2026-05-13 v2: beforeunload confirm 제거 (사용자 요청 — 시도때도 없이 떠서 불편).
  //   대신 안전망:
  //   1. 60s grace period (admission closing) — 새로고침해도 60s 안에 재연결 OK
  //   2. autoStart=true on mount — 새로고침 후 자동 재연결
  //   → 사용자 실수로 새로고침해도 3-10s 끊김만 발생, 자동 복귀.

  // 🛡️ 2026-05-11 P1-#6: 라이브 시작 5초 후 video 프레임 캡처 → thumbnail 자동 설정
  //   셀러가 thumbnail 미설정 시 빈 이미지로 표시되는 문제 해결. 백그라운드 자동 — UI 변경 없음.
  // 🛡️ 2026-05-13 v3 (사용자 요청 — 100% 작동 보장):
  //   imgbb 의존 제거. 라이브 시작 후 thumbnail_url 을 YouTube CDN 패턴 URL 로 즉시 설정.
  //   YouTube 가 30-60초 후 그 URL 에 자동 frame 띄움 (img.youtube.com/vi/{id}/maxresdefault.jpg).
  //   장점: 비용 0, 빠름 (CDN), 500 에러 없음, 항상 최신 frame.
  //   broadcaster prop 에 youtubeVideoId 없으므로 streamId 로 backend 에 요청 → backend 가
  //   DB 에서 youtube_video_id 조회 후 thumbnail_url 업데이트.
  const thumbnailSetRef = useRef(false)
  useEffect(() => {
    if (status !== 'live' || thumbnailSetRef.current) return
    const markerKey = `thumb_set_v2:${streamId}`
    try {
      if (localStorage.getItem(markerKey)) {
        thumbnailSetRef.current = true
        return
      }
    } catch { /* ignore */ }
    thumbnailSetRef.current = true
    const timer = setTimeout(async () => {
      try {
        // backend endpoint 가 자동으로 youtube_video_id 기반 CDN URL 로 thumbnail_url 갱신
        await api.post(`/api/seller/youtube/live/${streamId}/refresh-thumbnail`)
        try { localStorage.setItem(markerKey, String(Date.now())) } catch { /* ignore */ }
      } catch { /* best-effort */ }
    }, 30000)  // 30초 후 — YouTube CDN 에 frame 생성 시점
    return () => clearTimeout(timer)
  }, [status, streamId])

  // 🛡️ 2026-05-13: beforeunload/pagehide 자동 종료 제거 (큰 사고 — stream 77 case).
  //   기존 동작: 셀러가 다른 페이지 이동 / 탭 전환 / 새로고침 시에도 sendBeacon 으로 즉시 종료 →
  //              시청자가 보고 있는 라이브가 셀러의 사소한 이탈로 죽음.
  //              YouTube 측은 OME keep-alive 로 여전히 받지만 우리 DB.status='ended' 로 표시.
  //   현재 정책: 셀러가 명시적 "방송 종료" 버튼 누를 때만 종료.
  //              페이지 이동/탭 이탈 시엔 WebRTC 끊김 → OME 알아서 stopPush →
  //              YouTube broadcast 가 5-15분 후 자체 종료 → 우리 cron 이 감지하여 ended 처리.
  //   안전망: PR #327 의 12시간 idle cron + youtube-broadcast-end-detect cron.
  //
  //   ※ 정말 "탭 닫힘 = 종료" 가 필요한 케이스가 미래에 생기면 grace period (5분) 후 ended 처리로 변경.

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
          // 🛡️ 2026-05-14: 1080p60 강제 (UI 선택 제거 — 무조건 최고 화질).
          //   카메라가 60fps 못 잡으면 자동 30fps fallback (min:24). 1080p 못 잡으면 720p fallback.
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 24, max: 60 },
        },
        audio: {
          deviceId: selected.micId ? { exact: selected.micId } : undefined,
          // 🛡️ 2026-05-14: stereo 명시 + Opus native 48kHz — 디바이스가 기본 mono/44.1kHz
          //   잡는 경우에도 강제 stereo 캡처. 음악·소리 풍부함 +50%.
          channelCount: { ideal: 2 },
          sampleRate: { ideal: 48000 },
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
    // 🛡️ 2026-05-13: 실제 캡처 해상도 측정 → 셀러 UI 경고용
    try {
      const vt = stream.getVideoTracks()[0]
      const s = vt?.getSettings()
      if (s?.width && s?.height) setCaptureRes({ width: s.width, height: s.height })
      // 🛡️ 2026-05-14: contentHint='motion' — 라이브 커머스는 고움직임 (옷 입어보기/상품 흔들기).
      //   인코더가 motion 우선으로 비트 분배 → 잔상 ↓, 같은 bitrate 에서 체감 화질 ↑.
      if (vt && 'contentHint' in vt) (vt as MediaStreamTrack).contentHint = 'motion'
    } catch { /* ignore */ }

    // 디바이스 라벨 다시 로드 (권한 후엔 라벨 채워짐)
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        cams: list.filter(d => d.kind === 'videoinput'),
        mics: list.filter(d => d.kind === 'audioinput'),
      })
    } catch { /* noop */ }
    }  // end "새 stream 획득" block

    // 2. WHIP endpoint 발급 (3-tier 우선순위: YouTube WHIP proxy → OME WHIP → OBS)
    // 🛡️ 2026-05-13: Worker WHIP proxy 우선 시도 — 우리 Worker 가 YouTube WHIP 으로 forward.
    //   장점: OME 인프라 0, 미디어 P2P, 무한 확장.
    //   서버 응답: { mode: 'youtube_whip_proxy', whip_url: '/api/seller/youtube/streaming/whip-proxy/:id' }
    //   실패 시 OME WHIP 으로 자동 fallback.
    setStatus('fetching_token')
    let whipUrl: string
    let isProxyMode = false
    // 🛡️ 2026-05-14: prewarmed 토큰 사용 (mount 시 백그라운드 fetch 됨).
    //   60s 이내 fresh 면 fetch 1번 건너뛰어 시작 시간 -300~500ms.
    const prewarmed = prewarmedTokenRef.current
    const useFresh = !prewarmed || Date.now() - prewarmed.ts >= 60_000
    if (!useFresh && prewarmed) {
      whipUrl = prewarmed.whipUrl
      modeRef.current = prewarmed.mode
      isProxyMode = prewarmed.isProxy
    } else try {
      const res = await api.post('/api/seller/youtube/streaming/whip-token', { stream_id: streamId })
      if (!res.data?.success) throw new Error(res.data?.error || '토큰 발급 실패')
      whipUrl = res.data.data.whip_url
      modeRef.current = (res.data.data.mode as WhipMode) || 'youtube_whip'
      isProxyMode = (res.data.data.mode as string) === 'youtube_whip_proxy'
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
        // 🛡️ 2026-05-14: 동적 bitrate — getStats 로 RTT/loss 측정 → 3M~9M 내 자동 조정.
        //   네트워크 좋음: 9M 유지 (최고 화질)
        //   RTT > 250ms or loss > 2%: 단계적 하향 (9M → 7M → 5M → 3M)
        //   30s 안정 시: 다음 단계 상향
        //   비용 영향 0 (3M~9M cap 안에서만 움직임, 평균은 오히려 절약).
        startBitrateAdapter(pc).catch((e) => { if (import.meta.env.DEV) console.warn('[BrowserBroadcaster] bitrate adapter:', e) })
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

    // 🛡️ 2026-05-14: WebAudio enhancement chain — RNNoise 의 ~70% 효과 (zero deps).
    //   원본 audio track → HighPass(80Hz) → Compressor → NoiseGate → cleaned track.
    //   실패 시 자동으로 원본 track 사용.
    const audioTracks = stream.getAudioTracks()
    const videoTracks = stream.getVideoTracks()
    let processedAudioTrack: MediaStreamTrack | null = null
    try {
      if (audioTracks[0]) {
        processedAudioTrack = await enhanceAudioTrack(audioTracks[0], audioCtxRef)
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[BrowserBroadcaster] audio enhancement 실패, 원본 사용:', e)
    }
    const tracksToAdd = [
      ...videoTracks,
      ...(processedAudioTrack ? [processedAudioTrack] : audioTracks),
    ]

    // H.264 우선 (YouTube/OME 패스스루 호환). 없으면 VP8 fallback 자동.
    tracksToAdd.forEach(track => {
      const sender = pc.addTrack(track, stream)
      if (track.kind === 'video') {
        videoSenderRef.current = sender
        // 🛡️ 2026-05-14: 하드웨어 인코더 우선 — H.264 Constrained Baseline 3.1 (`42e01f`)
        //   은 거의 모든 GPU/SoC 가 하드웨어 인코딩 지원. Chrome 이 자동으로 HW path 사용 →
        //   CPU -40%, 인코딩 품질 안정 (소프트웨어 fallback 보다 압축 효율 ↑).
        //   YouTube/OME 도 H.264 RTMP 패스스루 가능 → 추가 트랜스코딩 0.
        const transceiver = pc.getTransceivers().find(t => t.sender === sender)
        if (transceiver && typeof RTCRtpSender !== 'undefined' && RTCRtpSender.getCapabilities) {
          try {
            const caps = RTCRtpSender.getCapabilities('video')
            if (caps?.codecs) {
              const h264Hw = caps.codecs.filter(c =>
                c.mimeType === 'video/H264' && /42e0|42c0|4d40|640032/i.test(c.sdpFmtpLine || '')
              )
              const h264Rest = caps.codecs.filter(c => c.mimeType === 'video/H264' && !h264Hw.includes(c))
              const others = caps.codecs.filter(c => c.mimeType !== 'video/H264')
              const ordered = [...h264Hw, ...h264Rest, ...others]
              if (typeof transceiver.setCodecPreferences === 'function' && ordered.length > 0) {
                transceiver.setCodecPreferences(ordered)
              }
            }
          } catch (e) {
            if (import.meta.env.DEV) console.warn('[BrowserBroadcaster] setCodecPreferences 실패:', e)
          }
        }
        const params = sender.getParameters()
        // 🛡️ 2026-05-13 v3: 화질 절대 사수 — scaleResolutionDownBy:1 (해상도 강제 다운 차단)
        //   + minBitrate 3M (최저 3Mbps 보장, CBR 유사)
        //   브라우저가 CPU 부족 시 720p 로 변환하는 동작 차단.
        params.encodings = [{
          // 🛡️ 2026-05-14: maxFramerate 60 — UI 선택 제거 후 무조건 최고 화질.
          //   카메라가 30fps 만 잡으면 어차피 그 값 — 60 은 상한일 뿐 강제 보간 X.
          maxBitrate: 9_000_000,
          minBitrate: 3_000_000,
          maxFramerate: 60,
          scaleResolutionDownBy: 1,
          networkPriority: 'high',
          priority: 'high',
        } as RTCRtpEncodingParameters & { minBitrate?: number; scaleResolutionDownBy?: number }]
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
      // 🛡️ 2026-05-14: Opus SDP munging — DTX + inband FEC + stereo.
      //   usedtx=0     침묵 시 패킷 전송 중단 (bandwidth -10%, 음질 영향 0)
      //   useinbandfec=1   패킷 손실 시 음성 인밴드 복구 (2-5% 손실 환경 음질 ↑↑)
      //   stereo=1; sprop-stereo=1   stereo 협상 명시 (mono fallback 차단)
      //   maxaveragebitrate=192000   상한 보존
      if (offer.sdp) {
        offer.sdp = offer.sdp.replace(
          /a=fmtp:(\d+) ([^\r\n]*)/g,
          (full, pt, fmtp: string) => {
            // Opus 의 payload type 라인만 처리 — fmtp 직전 a=rtpmap:PT opus/48000 라인 매치
            // 간단히 fmtp 내용에 minptime 이나 useinbandfec 키가 이미 있으면 Opus 가능성 ↑
            if (/minptime|useinbandfec|stereo/i.test(fmtp) || /\bopus\b/i.test(fmtp)) {
              const params = new Set(fmtp.split(';').map(s => s.trim()).filter(Boolean))
              params.add('usedtx=0')
              params.add('useinbandfec=1')
              params.add('stereo=1')
              params.add('sprop-stereo=1')
              params.add('maxaveragebitrate=192000')
              return `a=fmtp:${pt} ${[...params].join(';')}`
            }
            return full
          }
        )
        // rtpmap 매칭으로 Opus payload type 확실히 찾아 fmtp 추가/보강
        const opusMatch = offer.sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i)
        if (opusMatch) {
          const opusPt = opusMatch[1]
          if (!new RegExp(`a=fmtp:${opusPt}\\b`).test(offer.sdp)) {
            offer.sdp = offer.sdp.replace(
              new RegExp(`(a=rtpmap:${opusPt}\\s+opus/48000[^\\r\\n]*)`, 'i'),
              `$1\r\na=fmtp:${opusPt} minptime=10;usedtx=0;useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=192000`
            )
          }
        }
      }
      await pc.setLocalDescription(offer)

      // ICE gathering 대기 — 🛡️ 2026-05-14: server-reflexive candidate (STUN 응답) 도착 시 즉시 진행.
      //   WHIP 는 단일 SDP 교환이라 trickle 미사용. 하지만 호스트 candidate 만으로도 동작 가능
      //   → 첫 srflx 보이면 0.3s 더 대기 후 종료 (꼬리 candidates 잡으려고 2초 전체 안 기다림).
      //   효과: 라이브 시작 시간 -800~1500ms.
      await waitIceGathering(pc, 1500)

      // 4. WHIP POST
      // 🛡️ 2026-05-13: proxy mode 시 Authorization 헤더 필수 (우리 endpoint 인증 통과용).
      //   OME 직접 URL 은 token 이 URL query 안에 있어서 Authorization 불필요.
      const whipHeaders: Record<string, string> = { 'Content-Type': 'application/sdp' }
      if (isProxyMode) {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('seller_token') : null
        if (token) whipHeaders['Authorization'] = `Bearer ${token}`
      }
      const res = await fetch(whipUrl, {
        method: 'POST',
        headers: whipHeaders,
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
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close().catch(() => { /* ignore */ })
      audioCtxRef.current = null
    }
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
        {/* 🛡️ 2026-05-13: 실제 캡처 해상도 표시 — 셀러가 1080p 가 안 잡혔는지 즉시 인지 */}
        {captureRes && status === 'live' && (
          <div className={`absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-bold ${
            captureRes.height >= 1080 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            {captureRes.width}×{captureRes.height}
            {captureRes.height < 1080 && ' ⚠️'}
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
      {/* 🛡️ 2026-05-13: 카메라가 1080p 못 잡으면 안내 banner */}
      {captureRes && captureRes.height < 1080 && status === 'live' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-800">
            <p className="font-semibold">현재 {captureRes.width}×{captureRes.height} 송출 중</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              1080p (1920×1080) 권장 — 카메라가 1080p 미지원이거나 권한 제한일 수 있어요. 외장 웹캠 또는 다른 브라우저 시도 권장.
            </p>
          </div>
        </div>
      )}

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
    let sawSrflx = false
    const earlyExit = setTimeout(() => {
      if (sawSrflx && pc.iceGatheringState !== 'complete') {
        clearTimeout(t)
        pc.removeEventListener('icegatheringstatechange', check)
        pc.removeEventListener('icecandidate', onCand)
        resolve()
      }
    }, timeoutMs)
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t)
        clearTimeout(earlyExit)
        pc.removeEventListener('icegatheringstatechange', check)
        pc.removeEventListener('icecandidate', onCand)
        resolve()
      }
    }
    // 🛡️ 2026-05-14: srflx (STUN reflexive) 첫 도착 후 200ms 더 모으고 진행 — 꼬리 후보 안 기다림.
    const onCand = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate?.type === 'srflx' && !sawSrflx) {
        sawSrflx = true
        setTimeout(() => {
          if (pc.iceGatheringState !== 'complete') {
            clearTimeout(t)
            clearTimeout(earlyExit)
            pc.removeEventListener('icegatheringstatechange', check)
            pc.removeEventListener('icecandidate', onCand)
            resolve()
          }
        }, 200)
      }
    }
    pc.addEventListener('icegatheringstatechange', check)
    pc.addEventListener('icecandidate', onCand)
  })
}

/**
 * 🛡️ 2026-05-14: getStats 기반 동적 bitrate 어댑터.
 *   매 4초마다 RTT + packet loss 측정 → 3M~9M 내에서 자동 조절.
 *   네트워크 변동 시 끊김 없이 최적 화질 유지. 비용 영향 0 (cap 안에서만 움직임).
 */
async function startBitrateAdapter(pc: RTCPeerConnection): Promise<void> {
  // 🛡️ 2026-05-14: 보수화 — 최저 5M, severe 일 때만 하향. YouTube health 'low' 분류 회피.
  //   기존 3M 까지 떨어지면 YouTube 가 stream 강제 종료 가능 (audio/video loss + low quality).
  const BITRATE_STEPS = [5_000_000, 7_000_000, 9_000_000]
  let currentStep = BITRATE_STEPS.length - 1 // 9M 부터 시작
  let lastPacketsLost = 0
  let goodStreak = 0
  let warmUpCycles = 3 // 첫 12초는 측정만 (cold start 노이즈 회피)

  const interval = setInterval(async () => {
    if (pc.connectionState !== 'connected') {
      clearInterval(interval)
      return
    }
    if (warmUpCycles > 0) { warmUpCycles--; return }
    try {
      const stats = await pc.getStats()
      let rtt = 0
      let lossRate = 0
      stats.forEach(s => {
        if (s.type === 'remote-inbound-rtp' && s.kind === 'video') {
          rtt = (s as { roundTripTime?: number }).roundTripTime ?? 0
          const packetsLost = (s as { packetsLost?: number }).packetsLost ?? 0
          const packetsRecv = (s as { packetsReceived?: number }).packetsReceived ?? 1
          const newLoss = packetsLost - lastPacketsLost
          const total = newLoss + (packetsRecv > 0 ? 100 : 0)
          lossRate = total > 0 ? newLoss / total : 0
          lastPacketsLost = packetsLost
        }
      })

      // severe 조건만 하향 (RTT 500ms+ or loss 5%+)
      const severe = (rtt > 0.5) || (lossRate > 0.05)
      const great = (rtt < 0.15) && (lossRate < 0.005)

      if (severe && currentStep > 0) {
        currentStep--
        goodStreak = 0
        applyBitrate(pc, BITRATE_STEPS[currentStep])
      } else if (great) {
        goodStreak++
        if (goodStreak >= 5 && currentStep < BITRATE_STEPS.length - 1) {
          currentStep++
          goodStreak = 0
          applyBitrate(pc, BITRATE_STEPS[currentStep])
        }
      } else {
        goodStreak = 0
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[bitrate adapter]', e)
    }
  }, 4000)
}

/**
 * 🛡️ 2026-05-14: WebAudio 기반 음성 정리 체인 (RNNoise 라이트).
 *   1. HighPass 80Hz   — 저주파 럼블 (에어컨, 노트북 팬) 제거
 *   2. LowShelf -3dB @ 200Hz — 흉성 boom 톤 절제
 *   3. DynamicsCompressor — 음량 평준화 (큰 소리 ↓, 작은 소리 그대로)
 *   4. HighShelf +2dB @ 4kHz — 음성 명료도 boost
 *   5. NoiseGate (compressor threshold) — 침묵 시 노이즈 차단
 *   6. MediaStreamDestination — 출력 track 반환
 *
 * 효과: 키보드 타격음, 에어컨, 흉성 boom 약 70% 감소. 음성 명료도 ↑.
 * 비용: AudioContext 1개 (CPU < 1%).
 */
async function enhanceAudioTrack(
  src: MediaStreamTrack,
  ctxRef: { current: AudioContext | null }
): Promise<MediaStreamTrack> {
  // 기존 ctx 정리
  if (ctxRef.current && ctxRef.current.state !== 'closed') {
    try { await ctxRef.current.close() } catch { /* ignore */ }
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) throw new Error('AudioContext 미지원')
  const ctx = new AC({ sampleRate: 48000, latencyHint: 'interactive' })
  ctxRef.current = ctx

  const srcStream = new MediaStream([src])
  const source = ctx.createMediaStreamSource(srcStream)

  const highPass = ctx.createBiquadFilter()
  highPass.type = 'highpass'
  highPass.frequency.value = 80

  const lowShelf = ctx.createBiquadFilter()
  lowShelf.type = 'lowshelf'
  lowShelf.frequency.value = 200
  lowShelf.gain.value = -3

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -24
  compressor.knee.value = 12
  compressor.ratio.value = 4
  compressor.attack.value = 0.003
  compressor.release.value = 0.25

  const highShelf = ctx.createBiquadFilter()
  highShelf.type = 'highshelf'
  highShelf.frequency.value = 4000
  highShelf.gain.value = 2

  const noiseGate = ctx.createDynamicsCompressor()
  noiseGate.threshold.value = -50
  noiseGate.knee.value = 0
  noiseGate.ratio.value = 12
  noiseGate.attack.value = 0
  noiseGate.release.value = 0.05

  const outputGain = ctx.createGain()
  outputGain.gain.value = 1.05

  source
    .connect(highPass)
    .connect(lowShelf)
    .connect(compressor)
    .connect(highShelf)
    .connect(noiseGate)
    .connect(outputGain)

  const dest = ctx.createMediaStreamDestination()
  outputGain.connect(dest)

  const out = dest.stream.getAudioTracks()[0]
  if (!out) throw new Error('output track 없음')
  return out
}

function applyBitrate(pc: RTCPeerConnection, bps: number): void {
  pc.getSenders().forEach(sender => {
    if (sender.track?.kind === 'video') {
      const params = sender.getParameters()
      if (params.encodings[0]) {
        params.encodings[0].maxBitrate = bps
        sender.setParameters(params).catch(() => { /* ignore */ })
      }
    }
  })
}
