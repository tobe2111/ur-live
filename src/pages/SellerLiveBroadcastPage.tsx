import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { safeTime } from '@/utils/safe-date'
import { toast } from '@/hooks/useToast'
import { EndBroadcastModal, ConfirmModal, PromptModal, RecapModal } from './SellerLiveBroadcast.modals'
import {
  RecommendedPresetBlock, RtmpBlock,
  LiveStatsBar, ShareLiveLink, StreamList,
} from './SellerLiveBroadcast.parts'
import AuctionTimeDealControls from './SellerLiveBroadcast.AuctionTimeDealControls'
import ChannelCard from './SellerLiveBroadcast.ChannelCard'
import { ScheduledBroadcastWaiting, YouTubeStudioWaiting } from './SellerLiveBroadcast.WaitingScreens'
import OBSRemoteControl from './SellerLiveBroadcast.OBSRemoteControl'
// 🛡️ 2026-05-01: TD-018 분할 — Step{Info, Setup, Live} 모두 추출 (총 ~733줄).
import StepLive from './seller-live-broadcast/StepLive'
import { useLiveStreamWebSocket } from '@/hooks/useLiveStreamWebSocket'
import StepInfo from './seller-live-broadcast/StepInfo'
import StepSetup from './seller-live-broadcast/StepSetup'
import SellerCameraPreview from './seller-live-broadcast/SellerCameraPreview'
import { Button } from '@/components/ui/button'
import { formatKSTDate } from '@/utils/date'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import DonationBoosterButton from '@/components/seller/DonationBoosterButton'
import PKLiveBanner from '@/components/live/PKLiveBanner'
import {
  Youtube, Loader2, Radio, Play,
  VideoIcon, CheckCircle2, AlertCircle, Copy,
  Smartphone, ArrowLeft, Gavel, Zap,
  Globe, EyeOff, Lock, Users, AlertTriangle,
  Eye, MessageSquare, ShoppingBag, DollarSign
} from 'lucide-react'
import { isSellerAuthenticated } from '@/lib/seller-auth'
import PrismQRCode from '@/components/streaming/PrismQRCode'
import LiveChatPanel from '@/components/seller/LiveChatPanel'
import { InlineCameraPreview } from '@/components/streaming/InlineCameraPreview'
import { BroadcastDiagnostic } from '@/components/streaming/BroadcastDiagnostic'
import { FirstTimeTutorial, hasSeenTutorial } from '@/components/streaming/FirstTimeTutorial'
import { OBSWebSocketClient, type OBSConnectConfig, type OBSStatus, saveOBSConfig, loadOBSConfig, clearOBSConfig, hasOBSExtension } from '@/lib/obs-websocket'
import { downloadOBSProfile } from '@/lib/obs-profile'

// ── Types ──────────────────────────────────────────────────────────
// 🛡️ 2026-05-02: TD-018 — types 는 ./seller-live-broadcast/types 로 이미 추출됨.
//   본체에 중복으로 남아있던 inline interfaces 정리.
import type {
  YouTubeChannel,
  Product,
  LiveStream,
  WizardStep,
  Destination,
  DestinationPlatform,
} from './seller-live-broadcast/types'

// 송출 도구 (streaming tool): 셀러가 영상을 어떻게 push 할지 — type StreamMethod 는 ./SellerLiveBroadcast.storage 로 이전
import type { StreamMethod, BroadcastTemplate } from './SellerLiveBroadcast.storage'
import { formatNumber } from '@/utils/format'
import {
  getLastUsedMethod,
  rememberMethod,
  getRecentProducts,
  rememberRecentProducts,
  rememberLastBroadcast,
  clearDraft,
  getTemplates,
  saveTemplates,
} from './SellerLiveBroadcast.storage'

// 프리셋/RTMP/Stats/Share/StreamList → SellerLiveBroadcast.parts.tsx (TD-006 / audit #10 추가 분할)

// ── 모달 4종 → SellerLiveBroadcast.modals.tsx (TD-006 / audit #10 partial)
// ChannelCard → SellerLiveBroadcast.ChannelCard.tsx (TD-006)
// localStorage helpers → SellerLiveBroadcast.storage.ts (2026-04-29 추출)

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function SellerLiveBroadcastPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { streamId: urlStreamId } = useParams<{ streamId?: string }>()

  // 데이터
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connectingYouTube, setConnectingYouTube] = useState(false)

  // 위저드 상태
  const [step, setStep] = useState<WizardStep>('info')
  const [method, setMethod] = useState<StreamMethod>(() => getLastUsedMethod())
  const [destination, setDestination] = useState<Destination>('youtube')
  const [destinations, setDestinations] = useState<DestinationPlatform[]>([])
  const [currentStream, setCurrentStream] = useState<LiveStream | null>(null)
  // 🛡️ 2026-05-07: 셀러 옵션 — 알림톡 자동 발송 / 연습 모드
  const [notifyFollowers, setNotifyFollowers] = useState<boolean>(() =>
    localStorage.getItem('ur_notify_followers_v1') !== '0')
  const [practiceMode, setPracticeMode] = useState<boolean>(false)
  useEffect(() => {
    localStorage.setItem('ur_notify_followers_v1', notifyFollowers ? '1' : '0')
  }, [notifyFollowers])

  // 🛡️ 2026-05-13: 폼 자동 채움 제거 (사용자 요청). 매번 빈 상태로 시작 → 셀러 혼란 방지.
  //   기존: draft (24h 임시저장) + lastBroadcast (영구) 자동 복원으로 제목/상품/설명 등 prefill.
  //   변경: 모든 필드 빈 값 default. clearDraft() 로 잔존 localStorage 정리.
  useEffect(() => { clearDraft() }, [])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  // 🛡️ 2026-05-14 v2: 30fps 로 되돌림 — 같은 9Mbps 에서 프레임당 화질 2배 (300 vs 150 kbps).
  //   라이브 커머스 = "정지 상품 보여주기" 80% → 부드러움보다 선명도가 핵심.
  //   UI 선택지는 여전히 숨김 (셀러 부담 0).
  const frameRate: '30fps' = '30fps'
  const setFrameRate = () => { /* no-op — UI 제거됨 */ }
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public')

  // UI
  const [creating, setCreating] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [endModalOpen, setEndModalOpen] = useState(false)
  const [recapStream, setRecapStream] = useState<LiveStream | null>(null)
  const [recapStats, setRecapStats] = useState<{
    duration: string; viewers: number; chat: number; orders: number; revenue: number
    peak_viewers?: number; unique_viewers?: number; unique_chatters?: number; unique_buyers?: number
    donation_count?: number; donation_amount?: number
  } | null>(null)
  const [pollFailures, setPollFailures] = useState(0)
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const restoredRef = useRef(false)
  const liveStartTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!isSellerAuthenticated()) { navigate('/seller/login'); return }
    loadData()
  }, [navigate])

  // 🛡️ 2026-05-13: 자동 임시저장 제거 (사용자 요청). 매번 빈 폼 시작.

  // 첫 방문 셀러에게 튜토리얼 1회 노출 (채널 있고 방송 기록 없을 때)
  useEffect(() => {
    if (loading || channels.length === 0) return
    if (streams.length === 0 && !hasSeenTutorial()) {
      setShowTutorial(true)
    }
  }, [loading, channels.length, streams.length])

  // URL streamId 기반 상태 복원 (새로고침 / 직접 진입 대응)
  useEffect(() => {
    if (!urlStreamId || restoredRef.current) return
    restoredRef.current = true
    const id = parseInt(urlStreamId)
    if (!Number.isFinite(id)) return
    ;(async () => {
      try {
        const res = await api.get(`/api/seller/streams/${id}`)
        if (!res.data?.success || !res.data.stream) {
          navigate('/seller/live-broadcast', { replace: true })
          return
        }
        const s = res.data.stream
        if (s.status === 'ended') {
          navigate('/seller/live-broadcast', { replace: true })
          return
        }
        setCurrentStream({
          id: s.id,
          title: s.title,
          youtube_video_id: s.youtube_video_id || '',
          youtube_broadcast_id: s.youtube_broadcast_id,
          youtube_url: s.youtube_video_id ? `https://www.youtube.com/watch?v=${s.youtube_video_id}` : undefined,
          rtmp_url: s.rtmp_url,
          rtmp_key: s.rtmp_key,
          status: s.status,
          viewer_count: 0,
          current_product_id: s.current_product_id,
          scheduled_at: s.scheduled_at,
        })
        // 🛡️ 2026-05-11: 셀러 중도 새로고침 후 복귀 시 — 라이브 중이라도 setup 으로 (preview + 컨트롤 유지).
        //   StepLive 는 미리보기 없어서 송출 모니터링 불가. setup 만 사용.
        setStep('setup')
        if (s.status === 'live') liveStartTimeRef.current = Date.now()
      } catch {
        navigate('/seller/live-broadcast', { replace: true })
      }
    })()
  }, [urlStreamId, navigate])

  // P0-1: 진행 중 방송 자동 redirect (URL 없을 때만, 1시간 이내 임박한 것만)
  useEffect(() => {
    if (urlStreamId || loading) return
    const active = streams.find(s => {
      if (s.status === 'live') return true
      if (s.status === 'scheduled' && s.scheduled_at) {
        const minsUntil = (safeTime(s.scheduled_at) - Date.now()) / 60000
        return minsUntil >= -10 && minsUntil <= 60 // -10분 ~ +60분
      }
      return false
    })
    if (active) navigate(`/seller/live-broadcast/${active.id}`, { replace: true })
  }, [streams, urlStreamId, loading, navigate])

  // 🛡️ 2026-05-13 v2: 5초 폴링 → WebSocket 구독.
  //   기존: 5초마다 /status 호출 → YouTube quota 720 units/시간 + 깜빡임 + D1 read
  //   개선: LIVE_STREAM DurableObject WS subscribe → status 변화 시에만 push
  //   효과: quota 절감, 깜빡임 제거, latency 0
  //   webcam 모드는 별도 폴링 유지 — broadcast_id 없는 흐름이라 WS sync 불가
  useEffect(() => {
    if (step !== 'setup' || !currentStream || transitionCountdown !== null) return
    if (method === 'youtube-webcam') {
      // webcam 모드만 폴링 유지 (broadcast_id null → WS sync 불가)
      const endpoint = `/api/seller/youtube/live/${currentStream.id}/detect-webcam`
      const poll = async () => {
        try {
          const res = await api.get(endpoint)
          setPollFailures(0)
          const candidate = res.data?.data
          if (candidate?.youtube_video_id) {
            try {
              const linkRes = await api.patch(`/api/seller/youtube/live/${currentStream.id}/link-broadcast`, {
                youtube_video_id: candidate.youtube_video_id,
              })
              if (linkRes.data?.success) {
                setCurrentStream(prev => prev ? { ...prev, youtube_video_id: candidate.youtube_video_id, youtube_broadcast_id: candidate.youtube_video_id, status: 'live' } : prev)
                setTransitionCountdown(3)
              }
            } catch { /* link 실패 시 다음 폴링에 재시도 */ }
          }
        } catch { setPollFailures(c => c + 1) }
      }
      poll()
      const interval = setInterval(poll, 10000)
      return () => clearInterval(interval)
    }
    // youtube/obs/prism 모드 — WS subscription 만 (폴링 없음)
    // useLiveStreamWebSocket 이 status 변화 시 wsStreamData.status='live' push → 아래 useEffect 에서 setTransitionCountdown
    // 별도 setup 필요 없음 — wsStreamData 처리는 별도 useEffect 로
  }, [step, currentStream, transitionCountdown, method])

  // 🛡️ 2026-05-13: WebSocket status 변화 감지 → transition countdown 트리거
  //   useLiveStreamWebSocket 의 streamData.status 가 'live' 로 변화하면 (admission opening 시 backend broadcast)
  //   1회만 트리거. setTransitionCountdown 으로 UI 전환.
  const wsTransitionTriggered = useRef(false)
  const wsHookEnabled = step === 'setup' && !!currentStream && currentStream.status !== 'live' && method !== 'youtube-webcam'
  const { streamData: wsStreamData } = useLiveStreamWebSocket(
    wsHookEnabled ? (currentStream?.id ?? null) : null,
    wsHookEnabled,
    false
  )
  useEffect(() => {
    if (!wsHookEnabled || wsTransitionTriggered.current) return
    if (wsStreamData?.status === 'live') {
      wsTransitionTriggered.current = true
      setCurrentStream(prev => prev ? { ...prev, status: 'live' } : prev)
      setTransitionCountdown(3)
    }
  }, [wsStreamData?.status, wsHookEnabled])
  // currentStream.id 변경 시 ref 리셋
  useEffect(() => { wsTransitionTriggered.current = false }, [currentStream?.id])

  // 카운트다운 tick
  useEffect(() => {
    if (transitionCountdown === null) return
    if (transitionCountdown === 0) {
      toast.success(t('seller.liveBroadcast.broadcastStartedAuto'))
      // 🛡️ 2026-05-11: setStep('live') 제거 — StepSetup → StepLive 전환 시 BrowserBroadcaster 가
      //   unmount 되면서 WebRTC 끊김 → YouTube 송출 중단. setup 페이지에 미리보기 유지.
      //   DB status 만 'live' 로 업데이트 (UI 는 setup 에 머무름).
      setCurrentStream(s => s ? { ...s, status: 'live' } : s)
      liveStartTimeRef.current = Date.now()
      setTransitionCountdown(null)
      return
    }
    const id = setTimeout(() => setTransitionCountdown(c => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(id)
  }, [transitionCountdown, t])

  async function loadData() {
    setLoadError(null)
    setLoading(true)
    // 🛡️ 2026-05-07 (perf): streams 만 critical — 도착 즉시 UI 표시 (loading=false).
    //   channels (YouTube API 호출 5s+) / products / destinations 는 백그라운드 보강.
    //   기존: Promise.allSettled 4개 모두 대기 → 가장 느린 API (youtube/channels) 가
    //   전체 로딩 시간 결정 → 사용자 5-10초 대기 사고.
    api.get('/api/seller/streams')
      .then(r => { if (r.data?.success) setStreams(r.data.data || []) })
      .catch(() => setLoadError(t('seller.liveBroadcast.dataLoadFailed')))
      .finally(() => setLoading(false))

    // 백그라운드 — 도착 즉시 setState (페이지는 이미 표시 중)
    // 🛡️ 2026-05-07: channelsLoading 플래그 — channels 가 도착하기 전에는
    //   "YouTube 연동 필요" 화면으로 떨어지지 않도록 (UX 플리커 방지).
    // 🛡️ 2026-05-10: localStorage 캐싱 — 두 번째 진입부터 즉시 노출 (백그라운드 갱신).
    try {
      const cached = localStorage.getItem('yt_channels_cache_v1')
      if (cached) {
        const chs = JSON.parse(cached)
        if (Array.isArray(chs) && chs.length > 0) {
          setChannels(chs)
          if (!activeChannelId) setActiveChannelId(chs[0].id)
          // 🛡️ 2026-05-11: 캐시가 token_expired=true 라면 (재연동 직후 stale 가능성) 로딩 유지 →
          //   서버 응답 도착 후 정확한 상태로 갱신. token_expired=false 면 즉시 폼 노출 (UX).
          const anyExpired = chs.some((ch: { token_expired?: boolean }) => ch.token_expired)
          if (!anyExpired) setChannelsLoading(false)
        }
      }
    } catch { /* ignore */ }
    setChannelsLoading(prev => prev) // keep current state
    api.get('/api/seller/youtube/channels').then(r => {
      if (r.data?.success) {
        const chs = r.data.data || []
        setChannels(chs)
        if (chs.length > 0 && !activeChannelId) setActiveChannelId(chs[0].id)
        try { localStorage.setItem('yt_channels_cache_v1', JSON.stringify(chs)) } catch { /* ignore */ }
      }
    }).catch(() => { /* silent — 채널 없어도 UI 표시 */ })
      .finally(() => setChannelsLoading(false))
    // 🛡️ 2026-05-10: products 도 localStorage 캐싱 — 즉시 노출 + 백그라운드 갱신
    try {
      const cached = localStorage.getItem('seller_products_cache_v1')
      if (cached) setProducts(JSON.parse(cached))
    } catch { /* ignore */ }
    api.get('/api/seller/products').then(r => {
      if (r.data?.success) {
        const ps = r.data.data || []
        setProducts(ps)
        try { localStorage.setItem('seller_products_cache_v1', JSON.stringify(ps)) } catch { /* ignore */ }
      }
    }).catch(() => { /* silent */ })
    api.get('/api/platforms/destinations').then(r => {
      if (r.data?.success) setDestinations(r.data.data || [])
    }).catch(() => { /* silent */ })
  }

  // 방송 중 재고 주기적 갱신 (2분) + 현재 상품 품절 감지
  const prevStockRef = useRef<Record<number, number>>({})
  useEffect(() => {
    if (step !== 'live' || !currentStream) return
    const refresh = async () => {
      try {
        const r = await api.get('/api/seller/products')
        if (!r.data?.success) return
        const updated: Product[] = r.data.data || []
        setProducts(updated)
        // 현재 판매 상품이 새로 품절됐는지 체크
        const prev = prevStockRef.current
        updated.forEach(p => {
          const wasInStock = (prev[p.id] ?? 1) > 0
          if (wasInStock && p.stock === 0 && p.id === currentStream.current_product_id) {
            toast.error(t('seller.liveBroadcast.productOutOfStock', { name: p.name, defaultValue: `⚠️ 현재 판매 상품 "${p.name}" 품절! 다른 상품으로 전환하세요.` }))
          }
          prev[p.id] = p.stock
        })
        prevStockRef.current = prev
      } catch { /* silent */ }
    }
    const id = setInterval(refresh, 30000)  // 30초 — 품절 상품 실시간 감지
    return () => clearInterval(id)
  }, [step, currentStream])

  // P2-11: 채널 연결 해제 (모달 기반)
  const [disconnectChannelId, setDisconnectChannelId] = useState<number | null>(null)
  function requestDisconnect(channelId: number) { setDisconnectChannelId(channelId) }
  async function confirmDisconnect() {
    if (!disconnectChannelId) return
    const id = disconnectChannelId
    setDisconnectChannelId(null)
    try {
      await api.delete(`/api/seller/youtube/oauth/${id}`)
      toast.success(t('seller.liveBroadcast.disconnected'))
      await loadData()
    } catch { toast.error(t('seller.liveBroadcast.disconnectFailed')) }
  }

  async function connectYouTube() {
    try {
      setConnectingYouTube(true)
      const res = await api.get('/api/seller/youtube/auth-url')
      if (res.data.success && res.data.data?.authUrl)
        window.location.href = res.data.data.authUrl
      else toast.error(t('seller.liveBroadcast.youtubeApiNotSet'))
    } catch { toast.error(t('seller.liveBroadcast.youtubeConnectFailed')) }
    finally { setConnectingYouTube(false) }
  }

  async function createBroadcast(overrides?: { title?: string; productIds?: number[] }) {
    const baseTitle = overrides?.title ?? title
    // 🛡️ 2026-05-07: 연습 모드면 title prefix [연습] + privacy 강제 private + 알림톡 OFF
    const effectiveTitle = practiceMode ? `[연습] ${baseTitle}`.slice(0, 200) : baseTitle
    const effectivePrivacy = practiceMode ? 'private' : privacy
    const effectiveProducts = overrides?.productIds ?? selectedProducts
    if (!effectiveTitle.trim()) { toast.error(t('seller.liveBroadcast.enterTitle')); return }
    if (effectiveProducts.length === 0) { toast.error(t('seller.liveBroadcast.selectOneProduct')); return }
    try {
      setCreating(true)
      let scheduledStartTime = new Date().toISOString()
      if (isScheduled && scheduledDate && scheduledTime) {
        const d = new Date(`${scheduledDate}T${scheduledTime}:00`)
        if (isNaN(d.getTime()) || d.getTime() < Date.now() - 60_000) {
          toast.error(t('seller.liveBroadcast.scheduledPastError', { defaultValue: '예약 시간이 과거입니다. 미래 시간으로 설정해주세요.' }))
          setCreating(false)
          return
        }
        scheduledStartTime = d.toISOString()
      }

      // 🛡️ 2026-05-11: youtube-webcam 모드는 /create-webcam 으로 — YouTube API 호출 안 함, DB stream record 만 생성.
      //   셀러는 YouTube Studio 웹캠 송출 popup 에서 직접 broadcast 만들고, /detect-webcam 폴링이 우리 stream 과 link.
      const endpoint = method === 'youtube-webcam'
        ? '/api/seller/youtube/live/create-webcam'
        : '/api/seller/youtube/live/create'
      const res = await api.post(endpoint, {
        title: effectiveTitle.trim(), description: description.trim(),
        thumbnail_url: thumbnailUrl.trim() || undefined,
        product_ids: effectiveProducts,
        scheduled_start_time: scheduledStartTime,
        privacy_status: effectivePrivacy,
        channel_id: activeChannelId || undefined,
        frame_rate: frameRate,
      })
      if (res.data?.success) {
        const d = res.data.data
        setCurrentStream({
          id: d.stream_id, title: effectiveTitle.trim(),
          youtube_video_id: d.broadcast?.id || '',
          youtube_broadcast_id: d.broadcast?.id,
          youtube_url: d.youtube_url,
          rtmp_url: d.rtmp_url, rtmp_key: d.rtmp_key,
          status: 'scheduled', viewer_count: 0,
          scheduled_at: scheduledStartTime,
        })
        setStep('setup')
        rememberMethod(method)
        rememberRecentProducts([...effectiveProducts, ...getRecentProducts().filter(id => !effectiveProducts.includes(id))])
        rememberLastBroadcast({ title: effectiveTitle.trim(), description: description.trim(), thumbnailUrl: thumbnailUrl.trim(), privacy, productIds: effectiveProducts })
        clearDraft()
        navigate(`/seller/live-broadcast/${d.stream_id}`, { replace: true })

        // 🛡️ 2026-05-11: 웹캠 모드면 YouTube Studio 웹캠 송출 popup 자동 열기.
        //   셀러가 popup 에서 [스트리밍 시작] 클릭 → /detect-webcam 폴링이 우리 stream 과 link.
        if (method === 'youtube-webcam') {
          const activeChannel = channels.find(ch => ch.id === activeChannelId) || channels[0]
          if (activeChannel?.channel_id) {
            const studioUrl = `https://studio.youtube.com/channel/${activeChannel.channel_id}/livestreaming/stream/webcam`
            try {
              const popup = window.open(studioUrl, 'youtube_studio_webcam', 'width=1200,height=800,noopener=false')
              if (!popup) {
                toast.error(t('seller.liveBroadcast.popupBlocked', { defaultValue: '팝업이 차단되었습니다. 주소창의 팝업 차단 해제 후 다시 시도해주세요.' }))
              }
            } catch { /* popup 차단 — 셀러에게 안내 */ }
          }
        }
      } else {
        if (res.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
          setChannels(prev => prev.map(ch => ({ ...ch, token_expired: true })))
        } else {
          toast.error(res.data?.error || t('seller.liveBroadcast.createFailed'))
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error_code?: string; error?: string; existing_stream_id?: number; hours_until_reset?: number; reset_at?: string }; status?: number } }
      const data = axiosErr.response?.data
      if (data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
        setChannels(prev => prev.map(ch => ({ ...ch, token_expired: true })))
      } else if (data?.error_code === 'YOUTUBE_QUOTA_EXCEEDED') {
        // 🛡️ 2026-05-13: YouTube quota 초과 — 안내 + 대안 제시 (OBS 로 YouTube Studio 직접 송출)
        const hours = data.hours_until_reset ?? 8
        const resetTime = data.reset_at
          ? new Date(data.reset_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '자정'
        toast.error(
          `YouTube API 일일 사용량 초과 (약 ${hours}시간 후 / ${resetTime} 자동 리셋)\n\n` +
          `🆘 급하면: YouTube Studio 에서 직접 라이브 만들고 → 셀러 페이지에서 "기존 방송 연결" 사용`,
          { duration: 15_000 }
        )
      } else if (data?.error_code === 'EXISTING_LIVE_BROADCAST' && data?.existing_stream_id) {
        // 🛡️ 2026-05-13 v2: confirm popup 제거 — 자동으로 기존 종료 + 재시도.
        //   사용자 신고: popup 마찰. 어차피 셀러가 새 방송 누른 의도 = 기존 종료 + 새로 시작.
        //   기존 방송 페이지로 이동 원하면 셀러 대시보드 streamList 에서 클릭 가능.
        toast.info(t('seller.liveBroadcast.endingPrevious', { defaultValue: '기존 방송을 자동 종료하고 새 방송을 시작합니다...' }), { duration: 3000 })
        try {
          await api.post(`/api/seller/youtube/live/${data.existing_stream_id}/end`)
          // 1초 후 재시도 (백엔드 cron 캐시 + transition latency 고려)
          setTimeout(() => createBroadcast(overrides), 1000)
          return  // setCreating(false) 는 재시도에서 처리됨
        } catch (endErr) {
          const endErrMsg = (endErr as { response?: { data?: { error?: string } } }).response?.data?.error
          toast.error(endErrMsg || t('seller.liveBroadcast.endFailed', { defaultValue: '기존 방송 종료에 실패했습니다. 셀러 대시보드에서 직접 종료해주세요.' }))
        }
      } else {
        toast.error(data?.error || t('seller.liveBroadcast.createFailed'))
      }
    } finally { setCreating(false) }
  }

  async function goLive(mode?: string) {
    if (!currentStream) return
    try {
      await api.post(`/api/seller/youtube/live/${currentStream.id}/start`, mode ? { mode } : undefined)
      // DB에서 최신 스트림 정보 새로고침 (webcam 모드에서 link-broadcast 후 youtube_video_id 반영)
      try {
        const refreshRes = await api.get(`/api/seller/streams/${currentStream.id}`)
        if (refreshRes.data?.success && refreshRes.data.stream) {
          const s = refreshRes.data.stream
          setCurrentStream(prev => prev ? {
            ...prev,
            youtube_video_id: s.youtube_video_id || prev.youtube_video_id,
            youtube_broadcast_id: s.youtube_broadcast_id || prev.youtube_broadcast_id,
            youtube_url: s.youtube_video_id ? `https://www.youtube.com/watch?v=${s.youtube_video_id}` : prev.youtube_url,
            thumbnail_url: s.thumbnail_url || prev.thumbnail_url,
            status: 'live',
          } : prev)
        } else {
          setCurrentStream(s => s ? { ...s, status: 'live' } : s)
        }
      } catch {
        setCurrentStream(s => s ? { ...s, status: 'live' } : s)
      }
      setStep('live')
      liveStartTimeRef.current = Date.now()
      toast.success(t('seller.liveBroadcast.liveStarted'))
    } catch { toast.error(t('seller.liveBroadcast.startFailed')) }
  }

  function requestEndStream() {
    if (!currentStream) return
    setEndModalOpen(true)
  }

  async function confirmEndStream() {
    if (!currentStream) return
    setEndModalOpen(false)
    const endingStream = currentStream
    // 리캡 통계 미리 가져오기
    let stats = null
    try {
      const res = await api.get(`/api/seller/streams/${endingStream.id}/live-stats`)
      if (res.data?.success) stats = res.data.data
    } catch { /* ignore */ }

    try {
      // 🛡️ 2026-05-07: 방송 종료 fallback — primary 엔드포인트 404 시 legacy alias 시도.
      //   배포 lag / 라우트 변경 사이에도 사용자가 방송 종료 못하는 사고 방지.
      try {
        await api.post(`/api/seller/youtube/live/${endingStream.id}/end`)
      } catch (firstErr: unknown) {
        const e = firstErr as { response?: { status?: number } }
        if (e?.response?.status === 404) {
          // legacy alias 시도
          await api.post(`/api/youtube/live/${endingStream.id}/end`)
        } else {
          throw firstErr
        }
      }
      toast.success(t('seller.liveBroadcast.ended'))
      // 🛡️ 2026-05-13 (#1): 리캡 항상 표시 — 서버 duration_sec 우선 (liveStartTimeRef 0 인 케이스 회복).
      //   peak/unique/donations 포함한 풍부한 결산.
      if (stats) {
        const sec = (stats.duration_sec as number) > 0
          ? (stats.duration_sec as number)
          : Math.max(0, Math.floor((Date.now() - (liveStartTimeRef.current || Date.now())) / 1000))
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
        const duration = h > 0
          ? t('seller.liveBroadcast.durationHMS', { h, m, s, defaultValue: `${h}시간 ${m}분 ${s}초` })
          : t('seller.liveBroadcast.durationMS', { m, s, defaultValue: `${m}분 ${s}초` })
        setRecapStream(endingStream)
        setRecapStats({
          duration,
          viewers: stats.viewer_count,
          peak_viewers: stats.peak_viewers,
          unique_viewers: stats.unique_viewers,
          chat: stats.chat_count,
          unique_chatters: stats.unique_chatters,
          orders: stats.order_count,
          unique_buyers: stats.unique_buyers,
          revenue: stats.revenue,
          donation_count: stats.donation_count,
          donation_amount: stats.donation_amount,
        })
      }
      setCurrentStream(null); setStep('info')
      setTitle(''); setSelectedProducts([])
      navigate('/seller/live-broadcast', { replace: true })
      restoredRef.current = false
      liveStartTimeRef.current = 0
      await loadData()
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('[live-broadcast] end failed:', err)
      // 종료 실패: 스트림 상태 유지 + 재시도 안내 (강제 초기화 않음)
      toast.error('방송 종료 실패. 다시 시도하거나 YouTube Studio에서 직접 종료해주세요.')
    }
  }

  function copyField(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopiedField(key)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // ── 로딩 / 에러 ───────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      {urlStreamId && <p className="text-sm text-gray-500">{t('seller.liveBroadcast.restoringBroadcast')}</p>}
    </div>
  )

  if (loadError) return (
    <SellerLayout title={t('seller.nav.liveBroadcast')}>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-gray-700">{loadError}</p>
        <Button onClick={loadData}>{t('common.retry')}</Button>
      </div>
    </SellerLayout>
  )

  // ── 채널 로딩 중 ─────────────────────────────────────────────
  // 🛡️ 2026-05-07: streams 도착 후 channels 도착 전까지 "YouTube 연동 필요"
  //   화면이 잠깐 노출되는 플리커 방지. channelsLoading 인 동안은 스켈레톤.
  if (channelsLoading && channels.length === 0) return (
    <SellerLayout title={t('seller.nav.liveBroadcast')}>
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto" />
        <p className="text-sm text-gray-500">{t('seller.liveBroadcast.checkingYoutube', { defaultValue: 'YouTube 연동 상태 확인 중…' })}</p>
      </div>
    </SellerLayout>
  )

  // ── YouTube 미연동 ────────────────────────────────────────────
  if (channels.length === 0) return (
    <SellerLayout title={t('seller.nav.liveBroadcast')}>
      <div className="max-w-md mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
          <Youtube className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('seller.liveBroadcast.youtubeRequired')}</h2>
          <p className="text-sm text-gray-500">{t('seller.liveBroadcast.youtubeRequiredDesc')}</p>
        </div>
        <Button onClick={connectYouTube} disabled={connectingYouTube} className="bg-red-600 hover:bg-red-700 text-white w-full">
          {connectingYouTube ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Youtube className="h-4 w-4 mr-2" />}
          {t('seller.liveBroadcast.connectYoutube')}
        </Button>
      </div>
    </SellerLayout>
  )

  const sellableProducts = products.filter(p => !p.is_supply_product)

  // ── 메인 렌더 (위저드) ────────────────────────────────────────
  return (
    <SellerLayout title={t('seller.nav.liveBroadcast')}>
      {/* 🛡️ 2026-05-13: PC 에서 가로 폭 확장 — max-w-3xl 1024px 에선 비좁아 모바일 그대로 늘려놓은 느낌.
          mobile (모바일/태블릿) 기존 그대로, lg+ 에서 max-w-7xl 로 확장 + 2컬럼 grid. */}
      <div className="mx-auto max-w-3xl lg:max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.nav.liveBroadcast')}
          subtitle={t('seller.liveBroadcastSubtitle', { defaultValue: '라이브 방송 시작 및 관리' })}
          icon={<Youtube className="h-5 w-5" />}
        />

        {/* 연동 채널 — 전체 폭 */}
        <ChannelCard
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={setActiveChannelId}
          onDisconnect={requestDisconnect}
          onReauthenticate={connectYouTube}
          connectingYouTube={connectingYouTube}
        />

        {/* 🛡️ 2026-05-13: 예약된 방송 prominent 안내 — info 화면이 새 방송 폼 처럼 보여서
            셀러가 "내가 예약한 방송 어디 갔지?" 헷갈리던 사고 해결. 가장 임박한 1개를 강조. */}
        {step === 'info' && (() => {
          const nextScheduled = streams
            .filter(s => s.status === 'scheduled' && s.scheduled_at)
            .sort((a, b) => safeTime(a.scheduled_at!) - safeTime(b.scheduled_at!))[0]
          if (!nextScheduled) return null
          const ms = safeTime(nextScheduled.scheduled_at!) - Date.now()
          const totalMin = Math.floor(ms / 60000)
          const hours = Math.floor(totalMin / 60)
          const mins = totalMin % 60
          const countdownText = ms <= 0 ? '시작 시간이 지났어요' :
            hours > 0 ? `${hours}시간 ${mins}분 뒤 시작` : `${mins}분 뒤 시작`
          return (
            <div className="rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 p-4 text-white shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold opacity-90 mb-1">📅 예약된 방송이 있어요</p>
                  <p className="text-sm font-bold truncate">{nextScheduled.title}</p>
                  <p className="text-xs opacity-90 mt-0.5">⏰ {countdownText}</p>
                </div>
                <button
                  onClick={() => navigate(`/seller/live-broadcast/${nextScheduled.id}`)}
                  className="shrink-0 px-4 py-2 bg-white text-pink-600 rounded-lg text-sm font-bold hover:bg-pink-50 transition-colors"
                >
                  송출 준비 →
                </button>
              </div>
            </div>
          )
        })()}

        {/* STEP 1: 방송 정보 — PC (lg+) 에선 좌:폼 / 우:카메라 미리보기 2컬럼.
            모바일은 기존 1컬럼 stack (CameraPreview 는 hidden). */}
        {step === 'info' && (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start space-y-5 lg:space-y-0">
            <StepInfo
              title={title} setTitle={setTitle}
              description={description} setDescription={setDescription}
              thumbnailUrl={thumbnailUrl} setThumbnailUrl={setThumbnailUrl}
              privacy={privacy} setPrivacy={setPrivacy}
              isScheduled={isScheduled} setIsScheduled={setIsScheduled}
              scheduledDate={scheduledDate} setScheduledDate={setScheduledDate}
              scheduledTime={scheduledTime} setScheduledTime={setScheduledTime}
              sellableProducts={sellableProducts}
              selectedProducts={selectedProducts}
              setSelectedProducts={setSelectedProducts}
              toggleProduct={(id: number) => setSelectedProducts(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
              method={method} setMethod={setMethod}
              destination={destination} setDestination={setDestination}
              destinations={destinations}
              creating={creating} onCreate={createBroadcast}
              navigate={navigate}
              channels={channels}
              recentProductIds={getRecentProducts()}
              tokenExpired={!!channels.find(c => c.id === activeChannelId)?.token_expired}
              onReauthenticate={connectYouTube}
              connectingYouTube={connectingYouTube}
              channelsLoading={channelsLoading}
              notifyFollowers={notifyFollowers}
              setNotifyFollowers={setNotifyFollowers}
              practiceMode={practiceMode}
              setPracticeMode={setPracticeMode}
              frameRate={frameRate}
              setFrameRate={setFrameRate}
            />
            {/* 우측 패널 — PC 만 (카메라 미리보기 + 빠른 안내). 모바일에선 hidden */}
            <aside className="hidden lg:block lg:sticky lg:top-6 space-y-4">
              <SellerCameraPreview />
              <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  💡 라이브 커머스 팁
                </h3>
                <ul className="text-[11px] text-gray-600 space-y-1.5 leading-relaxed">
                  <li>• 좌측 카메라 미리보기로 각도/조명 확인</li>
                  <li>• 송출 중에는 시청자에게 영상이 3-5초 늦게 보여요</li>
                  <li>• "5개 남았어요" 같은 안내는 여유 있게 외쳐주세요</li>
                  <li>• 화면 우측 채팅창을 자주 확인하세요</li>
                </ul>
              </div>
            </aside>
          </div>
        )}

        {/* STEP 2: 연결 설정 + 라이브 컨트롤.
            🛡️ 2026-05-13: PC (lg+) 에선 2컬럼 — 좌:송출 미리보기 / 우:라이브 컨트롤+채팅.
              세로 스크롤 부담 해소, 라이브 중 상품 전환 + 채팅을 한 화면에서. */}
        {step === 'setup' && currentStream && (
          <div className={
            currentStream.status === 'live'
              ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6 lg:items-start space-y-5 lg:space-y-0'
              : 'space-y-5'
          }>
            <div className="lg:sticky lg:top-6 lg:self-start space-y-5">
              <StepSetup
                stream={currentStream}
                method={method}
                channels={channels}
                copiedField={copiedField}
                onCopy={copyField}
                onGoLive={goLive}
                onBack={() => { setCurrentStream(null); setStep('info') }}
              />
            </div>
            {/* 라이브 중: 우측에 컨트롤 패널 (채팅 + 상품 전환 + 통계). 송출 전엔 노출 X. */}
            {currentStream.status === 'live' && (
              <div className="space-y-5">
                <StepLive
                  stream={currentStream}
                  products={sellableProducts}
                  method={method}
                  notifyFollowers={notifyFollowers}
                  practiceMode={practiceMode}
                  onChangeProduct={(productId: number) => setCurrentStream(s => s ? { ...s, current_product_id: productId } : s)}
                  onEndStream={requestEndStream}
                />
              </div>
            )}
          </div>
        )}

        {/* 기존 방송 목록 (info 단계에서만) */}
        {step === 'info' && (
          <StreamList
            streams={streams}
            onManage={(stream) => {
              navigate(`/seller/live-broadcast/${stream.id}`)
            }}
          />
        )}

        {/* P2-10: 네트워크 끊김 표시 */}
        {pollFailures >= 3 && step === 'setup' && (
          <div className="fixed bottom-4 right-4 z-50 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2.5 max-w-xs">
            <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <p className="text-xs text-amber-800">{t('seller.liveBroadcast.reconnecting')}</p>
          </div>
        )}

        {/* 첫 방송 셀러 튜토리얼 */}
        {showTutorial && (
          <FirstTimeTutorial onClose={() => setShowTutorial(false)} />
        )}

        {/* 스트림 감지 시 3-2-1 카운트다운 풀스크린 */}
        {transitionCountdown !== null && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 text-red-400 text-sm font-bold">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                {t('seller.liveBroadcast.streamDetected')}
              </div>
              <div className="text-white text-[140px] font-black leading-none tabular-nums">
                {transitionCountdown === 0 ? '▶' : transitionCountdown}
              </div>
              <p className="text-gray-300 text-base">{t('seller.liveBroadcast.streamDetectedDesc')}</p>
            </div>
          </div>
        )}

        {/* P0-2: 방송 종료 확인 모달 */}
        {endModalOpen && currentStream && (
          <EndBroadcastModal
            stream={currentStream}
            onConfirm={confirmEndStream}
            onCancel={() => setEndModalOpen(false)}
          />
        )}

        {/* P1-7: 방송 종료 후 리캡 모달 */}
        {recapStream && recapStats && (
          <RecapModal
            stream={recapStream}
            stats={recapStats}
            onClose={() => { setRecapStream(null); setRecapStats(null) }}
          />
        )}

        {/* 채널 연결 해제 확인 모달 */}
        {disconnectChannelId !== null && (
          <ConfirmModal
            title={t('seller.liveBroadcast.disconnectChannelTitle')}
            description={t('seller.liveBroadcast.disconnectChannelDesc')}
            confirmLabel={t('seller.liveBroadcast.disconnectChannel')}
            confirmStyle="bg-red-600 hover:bg-red-700"
            onConfirm={confirmDisconnect}
            onCancel={() => setDisconnectChannelId(null)}
          />
        )}

      </div>
    </SellerLayout>
  )
}

// ── Step 1: 방송 정보 입력 ───────────────────────────────────────

// ── 예약 방송 대기 화면 (P1-5) ──────────────────────────────────
// ScheduledBroadcastWaiting → SellerLiveBroadcast.WaitingScreens.tsx (TD-006)

// OBSRemoteControl + parseTimecode → SellerLiveBroadcast.OBSRemoteControl.tsx (TD-006)

// ── YouTube Studio 대기 화면 (Quick / YouTube 공통) ─────────────
// Step 2 진입 시 자동으로 Studio 팝업 오픈 + 자동 감지 안내.
// onGoLive() 호출 안 함 — 폴링이 YouTube live 상태 감지 시에만 전환.
// stream.status === 'live' 가 되면 부모가 이 컴포넌트를 unmount → cleanup에서 팝업 자동 닫힘.
// YouTubeStudioWaiting → SellerLiveBroadcast.WaitingScreens.tsx (TD-006)

// ── Step 2: 연결 설정 ────────────────────────────────────────────

// ── Step 3: 라이브 중 ────────────────────────────────────────────
