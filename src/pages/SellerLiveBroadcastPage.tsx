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
import StepInfo from './seller-live-broadcast/StepInfo'
import StepSetup from './seller-live-broadcast/StepSetup'
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
  getLastBroadcast,
  rememberLastBroadcast,
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

  // Step 1 폼 (마지막 방송 값으로 prefill)
  const lastBroadcast = useRef(getLastBroadcast()).current
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState(lastBroadcast.description || '')
  const [thumbnailUrl, setThumbnailUrl] = useState(lastBroadcast.thumbnailUrl || '')
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>(lastBroadcast.privacy || 'public')

  // UI
  const [creating, setCreating] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [endModalOpen, setEndModalOpen] = useState(false)
  const [recapStream, setRecapStream] = useState<LiveStream | null>(null)
  const [recapStats, setRecapStats] = useState<{ duration: string; viewers: number; chat: number; orders: number; revenue: number } | null>(null)
  const [pollFailures, setPollFailures] = useState(0)
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const restoredRef = useRef(false)
  const liveStartTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!isSellerAuthenticated()) { navigate('/seller/login'); return }
    loadData()
  }, [navigate])

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
        setStep(s.status === 'live' ? 'live' : 'setup')
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

  // Step 2: OBS/Prism/YouTube 연결 자동 감지 폴링
  // 적응형: 초반 2분은 5s, 이후 15s (YouTube API quota 절감)
  useEffect(() => {
    if (step !== 'setup' || !currentStream || transitionCountdown !== null) return
    const startedAt = Date.now()
    const poll = async () => {
      try {
        const res = await api.get(`/api/seller/youtube/live/${currentStream.id}/status`)
        setPollFailures(0)
        if (res.data?.success && res.data.data?.synced && res.data.data?.status === 'live') {
          setTransitionCountdown(3)
        }
      } catch { setPollFailures(c => c + 1) }
    }
    poll() // 최초 즉시 실행
    let interval = setInterval(poll, 5000)
    // 2분 후 15s 간격으로 전환
    const slowDown = setTimeout(() => {
      clearInterval(interval)
      interval = setInterval(poll, 15000)
    }, 120000)
    return () => { clearInterval(interval); clearTimeout(slowDown) }
  }, [step, currentStream, transitionCountdown])

  // 카운트다운 tick
  useEffect(() => {
    if (transitionCountdown === null) return
    if (transitionCountdown === 0) {
      toast.success(t('seller.liveBroadcast.broadcastStartedAuto'))
      setCurrentStream(s => s ? { ...s, status: 'live' } : s)
      setStep('live')
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
    setChannelsLoading(true)
    api.get('/api/seller/youtube/channels').then(r => {
      if (r.data?.success) {
        const chs = r.data.data || []
        setChannels(chs)
        if (chs.length > 0 && !activeChannelId) setActiveChannelId(chs[0].id)
      }
    }).catch(() => { /* silent — 채널 없어도 UI 표시 */ })
      .finally(() => setChannelsLoading(false))
    api.get('/api/seller/products').then(r => {
      if (r.data?.success) setProducts(r.data.data || [])
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
            toast.error(`⚠️ 현재 판매 상품 "${p.name}" 품절! 다른 상품으로 전환하세요.`)
          }
          prev[p.id] = p.stock
        })
        prevStockRef.current = prev
      } catch { /* silent */ }
    }
    const id = setInterval(refresh, 120000)  // 2분 (D1 reads, 무료)
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
          toast.error('예약 시간이 과거입니다. 미래 시간으로 설정해주세요.')
          setCreating(false)
          return
        }
        scheduledStartTime = d.toISOString()
      }

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
        rememberLastBroadcast({ description: description.trim(), thumbnailUrl: thumbnailUrl.trim(), privacy })
        navigate(`/seller/live-broadcast/${d.stream_id}`, { replace: true })
      } else {
        if (res.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
          setChannels(prev => prev.map(ch => ({ ...ch, token_expired: true })))
        } else {
          toast.error(res.data?.error || t('seller.liveBroadcast.createFailed'))
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error_code?: string; error?: string } } }
      if (axiosErr.response?.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
        setChannels(prev => prev.map(ch => ({ ...ch, token_expired: true })))
      } else {
        toast.error(axiosErr.response?.data?.error || t('seller.liveBroadcast.createFailed'))
      }
    } finally { setCreating(false) }
  }

  async function goLive() {
    if (!currentStream) return
    try {
      await api.post(`/api/seller/youtube/live/${currentStream.id}/start`)
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
      // 리캡 표시
      if (stats && liveStartTimeRef.current > 0) {
        const sec = Math.floor((Date.now() - liveStartTimeRef.current) / 1000)
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
        const duration = h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`
        setRecapStream(endingStream)
        setRecapStats({ duration, viewers: stats.viewer_count, chat: stats.chat_count, orders: stats.order_count, revenue: stats.revenue })
      }
      setCurrentStream(null); setStep('info')
      setTitle(''); setSelectedProducts([])
      navigate('/seller/live-broadcast', { replace: true })
      restoredRef.current = false
      liveStartTimeRef.current = 0
      await loadData()
    } catch (err: unknown) {
      // 🛡️ 종료 실패 시에도 UI 상으로는 종료 처리 (DB 가 아직 'live' 라도 사용자에겐 'ended' 보임).
      // YouTube 측 자동 stream-detection cron 이 결국 정리. 사용자에게 명확한 안내.
      if (import.meta.env.DEV) console.error('[live-broadcast] end failed:', err)
      toast.error(t('seller.liveBroadcast.endFailed'))
      // 5초 후 페이지 새로고침 — 다음 시도 가능
      setCurrentStream(null); setStep('info')
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
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 131: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.nav.liveBroadcast')}
          subtitle={t('seller.liveBroadcastSubtitle', { defaultValue: '라이브 방송 시작 및 관리' })}
          icon={<Youtube className="h-5 w-5" />}
        />

        {/* 연동 채널 (P2-9 다중 채널 + P2-11 해제 메뉴) */}
        <ChannelCard
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={setActiveChannelId}
          onDisconnect={requestDisconnect}
          onReauthenticate={connectYouTube}
          connectingYouTube={connectingYouTube}
        />

        {/* STEP 1: 방송 정보 */}
        {step === 'info' && (
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
            notifyFollowers={notifyFollowers}
            setNotifyFollowers={setNotifyFollowers}
            practiceMode={practiceMode}
            setPracticeMode={setPracticeMode}
          />
        )}

        {/* STEP 2: 연결 설정 */}
        {step === 'setup' && currentStream && (
          <StepSetup
            stream={currentStream}
            method={method}
            channels={channels}
            copiedField={copiedField}
            onCopy={copyField}
            onGoLive={goLive}
            onBack={() => { setCurrentStream(null); setStep('info') }}
          />
        )}

        {/* STEP 3: 라이브 중 */}
        {step === 'live' && currentStream && (
          <StepLive
            stream={currentStream}
            products={sellableProducts}
            method={method}
            notifyFollowers={notifyFollowers}
            practiceMode={practiceMode}
            onChangeProduct={(productId: number) => setCurrentStream(s => s ? { ...s, current_product_id: productId } : s)}
            onEndStream={requestEndStream}
          />
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
          <div className="fixed bottom-4 right-4 z-40 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2.5 max-w-xs">
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
                스트림 감지됨
              </div>
              <div className="text-white text-[140px] font-black leading-none tabular-nums">
                {transitionCountdown === 0 ? '▶' : transitionCountdown}
              </div>
              <p className="text-gray-300 text-base">잠시 후 라이브 대시보드로 이동합니다</p>
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
            title="채널 연결을 해제하시겠습니까?"
            description="해제하면 이 채널로는 방송할 수 없어요. 다시 연동하면 복구 가능합니다."
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
