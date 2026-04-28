import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { EndBroadcastModal, ConfirmModal, PromptModal, RecapModal } from './SellerLiveBroadcast.modals'
import {
  RecommendedPresetBlock, RtmpBlock,
  LiveStatsBar, ShareLiveLink, StreamList,
} from './SellerLiveBroadcast.parts'
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
interface YouTubeChannel {
  id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  is_active: boolean
  has_persistent_key?: boolean
  token_expired?: boolean
}

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  stock: number
  is_active: boolean
  is_supply_product?: boolean
}

interface LiveStream {
  id: number
  title: string
  youtube_video_id: string
  youtube_broadcast_id?: string
  youtube_url?: string
  rtmp_url?: string
  rtmp_key?: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count: number
  current_product_id?: number
  ended_at?: string
  scheduled_at?: string
}

type WizardStep = 'info' | 'setup' | 'live'
// 송출 도구 (streaming tool): 셀러가 영상을 어떻게 push 할지
type StreamMethod = 'youtube' | 'obs' | 'prism' | 'quick'
// 목적지 플랫폼 (destination): 시청자가 어디서 보는지
type Destination = 'youtube' | 'tiktok' | 'chzzk' | 'soop'

// ── 멀티플랫폼 API 타입 ────────────────────────────────────────────
interface DestinationPlatform {
  key: string; label: string; status: 'available' | 'coming_soon' | 'deprecated'
  icon: string; region: string
  features: { rtmp_ingest: boolean; chat_relay: boolean; product_overlay: boolean; oauth_required: boolean }
  eta?: string; note?: string
}

// 프리셋/RTMP/Stats/Share/StreamList → SellerLiveBroadcast.parts.tsx (TD-006 / audit #10 추가 분할)

// ── 모달 4종 → SellerLiveBroadcast.modals.tsx (TD-006 / audit #10 partial)
// EndBroadcastModal / ConfirmModal / PromptModal / RecapModal
// ── 채널 카드 (다중 채널 + 해제 + 토큰 만료 재연동) ──────────────
function ChannelCard({ channels, activeChannelId, onSelectChannel, onDisconnect, onReauthenticate, connectingYouTube }: {
  channels: YouTubeChannel[]
  activeChannelId: number | null
  onSelectChannel: (id: number) => void
  onDisconnect: (id: number) => void
  onReauthenticate: () => void
  connectingYouTube: boolean
}) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const active = channels.find(c => c.id === activeChannelId) || channels[0]
  if (!active) return null
  const hasMultiple = channels.length > 1

  return (
    <div className={`relative bg-white rounded-xl px-4 py-3 border mb-5 ${active.token_expired ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        {active.channel_thumbnail
          ? <img src={active.channel_thumbnail} alt="" className="w-8 h-8 rounded-full" />
          : <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><Youtube className="h-4 w-4 text-red-500" /></div>}
        <button
          onClick={() => hasMultiple && setPickerOpen(v => !v)}
          className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
            {active.channel_title}
            {hasMultiple && <span className="text-xs text-gray-400">▾</span>}
          </p>
          <p className="text-xs text-gray-400">{String(t('seller.liveBroadcast.subscribers', { count: active.subscriber_count?.toLocaleString() || '0' } as Record<string, string>))}</p>
        </button>
        {active.token_expired ? (
          <button onClick={onReauthenticate} disabled={connectingYouTube}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-full font-medium flex items-center gap-1">
            {connectingYouTube ? <Loader2 className="w-3 h-3 animate-spin" /> : <Youtube className="w-3 h-3" />}
            재연동
          </button>
        ) : (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('seller.liveBroadcast.linked')}</span>
        )}
        <button onClick={() => onDisconnect(active.id)}
          className="text-gray-300 hover:text-red-500 transition-colors p-1"
          title={t('seller.liveBroadcast.disconnectChannel')}
          aria-label={t('seller.liveBroadcast.disconnectChannel')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      {pickerOpen && hasMultiple && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
          {channels.map(ch => (
            <button key={ch.id}
              onClick={() => { onSelectChannel(ch.id); setPickerOpen(false) }}
              className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${ch.id === active.id ? 'bg-blue-50' : ''}`}>
              {ch.channel_thumbnail && <img src={ch.channel_thumbnail} alt="" className="w-6 h-6 rounded-full" />}
              <span className="text-xs font-medium text-gray-900 truncate flex-1">{ch.channel_title}</span>
              {ch.id === active.id && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
            </button>
          ))}
        </div>
      )}

    </div>
  )
}

// ── 송출 도구 마지막 선택 기억 ──────────────────────────────────
const METHOD_STORAGE_KEY = 'seller_live_last_method'
function getLastUsedMethod(): StreamMethod {
  try {
    const v = localStorage.getItem(METHOD_STORAGE_KEY)
    if (v === 'youtube' || v === 'obs' || v === 'prism' || v === 'quick') return v
  } catch { /* SSR or blocked */ }
  if (typeof window !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) return 'prism'
  return 'obs'
}
function rememberMethod(m: StreamMethod) {
  try { localStorage.setItem(METHOD_STORAGE_KEY, m) } catch { /* ignore */ }
}

// ── 최근 사용 상품 / 마지막 방송 값 prefill ─────────────────────
const RECENT_PRODUCTS_KEY = 'seller_live_recent_products'
const LAST_BROADCAST_KEY = 'seller_live_last_broadcast'
const TEMPLATES_KEY = 'seller_live_templates'

interface BroadcastTemplate {
  name: string
  title: string
  description: string
  privacy: 'public' | 'unlisted' | 'private'
  productIds: number[]
}

function getRecentProducts(): number[] {
  try {
    const v = localStorage.getItem(RECENT_PRODUCTS_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}
function rememberRecentProducts(ids: number[]) {
  try { localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(ids.slice(0, 20))) } catch { /* ignore */ }
}
function getLastBroadcast(): { description?: string; thumbnailUrl?: string; privacy?: 'public' | 'unlisted' | 'private' } {
  try {
    const v = localStorage.getItem(LAST_BROADCAST_KEY)
    return v ? JSON.parse(v) : {}
  } catch { return {} }
}
function rememberLastBroadcast(data: { description: string; thumbnailUrl: string; privacy: 'public' | 'unlisted' | 'private' }) {
  try { localStorage.setItem(LAST_BROADCAST_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}
function getTemplates(): BroadcastTemplate[] {
  try {
    const v = localStorage.getItem(TEMPLATES_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}
function saveTemplates(templates: BroadcastTemplate[]) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.slice(0, 10))) } catch { /* ignore */ }
}

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connectingYouTube, setConnectingYouTube] = useState(false)

  // 위저드 상태
  const [step, setStep] = useState<WizardStep>('info')
  const [method, setMethod] = useState<StreamMethod>(() => getLastUsedMethod())
  const [destination, setDestination] = useState<Destination>('youtube')
  const [destinations, setDestinations] = useState<DestinationPlatform[]>([])
  const [currentStream, setCurrentStream] = useState<LiveStream | null>(null)

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
        const minsUntil = (new Date(s.scheduled_at).getTime() - Date.now()) / 60000
        return minsUntil >= -10 && minsUntil <= 60 // -10분 ~ +60분
      }
      return false
    })
    if (active) navigate(`/seller/live-broadcast/${active.id}`, { replace: true })
  }, [streams, urlStreamId, loading, navigate])

  // Step 2: OBS/Prism/YouTube 연결 자동 감지 폴링
  useEffect(() => {
    if (step !== 'setup' || !currentStream || transitionCountdown !== null) return
    const poll = async () => {
      try {
        const res = await api.get(`/api/seller/youtube/live/${currentStream.id}/status`)
        setPollFailures(0)
        if (res.data?.success && res.data.data?.synced && res.data.data?.status === 'live') {
          // 감지됨 → 3-2-1 카운트다운 → 전환
          setTransitionCountdown(3)
        }
      } catch { setPollFailures(c => c + 1) }
    }
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
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
    try {
      setLoading(true); setLoadError(null)
      const [chRes, prRes, stRes, dRes] = await Promise.allSettled([
        api.get('/api/seller/youtube/channels'),
        api.get('/api/seller/products'),
        api.get('/api/seller/streams'),
        api.get('/api/platforms/destinations'),
      ])
      if (chRes.status === 'fulfilled' && chRes.value.data?.success) {
        const chs = chRes.value.data.data || []
        setChannels(chs)
        if (chs.length > 0 && !activeChannelId) setActiveChannelId(chs[0].id)
      }
      if (prRes.status === 'fulfilled' && prRes.value.data?.success)
        setProducts(prRes.value.data.data || [])
      if (stRes.status === 'fulfilled' && stRes.value.data?.success)
        setStreams(stRes.value.data.data || [])
      if (dRes.status === 'fulfilled' && dRes.value.data?.success)
        setDestinations(dRes.value.data.data || [])
    } catch { setLoadError(t('seller.liveBroadcast.dataLoadFailed')) }
    finally { setLoading(false) }
  }

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
    const effectiveTitle = overrides?.title ?? title
    const effectiveProducts = overrides?.productIds ?? selectedProducts
    if (!effectiveTitle.trim()) { toast.error(t('seller.liveBroadcast.enterTitle')); return }
    if (effectiveProducts.length === 0) { toast.error(t('seller.liveBroadcast.selectOneProduct')); return }
    try {
      setCreating(true)
      let scheduledStartTime = new Date().toISOString()
      if (isScheduled && scheduledDate && scheduledTime)
        scheduledStartTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()

      const res = await api.post('/api/seller/youtube/live/create', {
        title: effectiveTitle.trim(), description: description.trim(),
        thumbnail_url: thumbnailUrl.trim() || undefined,
        product_ids: effectiveProducts,
        scheduled_start_time: scheduledStartTime,
        privacy_status: privacy,
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
      setCurrentStream(s => s ? { ...s, status: 'live' } : s)
      setStep('live')
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
      await api.post(`/api/seller/youtube/live/${endingStream.id}/end`)
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
    } catch { toast.error(t('seller.liveBroadcast.endFailed')) }
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
interface StepInfoProps {
  title: string; setTitle: (v: string) => void
  description: string; setDescription: (v: string) => void
  thumbnailUrl: string; setThumbnailUrl: (v: string) => void
  privacy: 'public' | 'unlisted' | 'private'; setPrivacy: (v: 'public' | 'unlisted' | 'private') => void
  isScheduled: boolean; setIsScheduled: (fn: (v: boolean) => boolean) => void
  scheduledDate: string; setScheduledDate: (v: string) => void
  scheduledTime: string; setScheduledTime: (v: string) => void
  sellableProducts: Product[]; selectedProducts: number[]
  setSelectedProducts: React.Dispatch<React.SetStateAction<number[]>>
  toggleProduct: (id: number) => void
  method: StreamMethod; setMethod: (v: StreamMethod) => void
  destination: Destination; setDestination: (v: Destination) => void
  destinations: DestinationPlatform[]
  creating: boolean; onCreate: (overrides?: { title?: string; productIds?: number[] }) => void
  navigate: ReturnType<typeof useNavigate>
  channels: YouTubeChannel[]
  recentProductIds: number[]
  tokenExpired: boolean
  onReauthenticate: () => void
  connectingYouTube: boolean
}

function StepInfo({ title, setTitle, description, setDescription, thumbnailUrl, setThumbnailUrl, privacy, setPrivacy,
  isScheduled, setIsScheduled, scheduledDate, setScheduledDate, scheduledTime, setScheduledTime,
  sellableProducts, selectedProducts, setSelectedProducts, toggleProduct, method, setMethod,
  destination, setDestination, destinations,
  creating, onCreate, navigate, channels, recentProductIds,
  tokenExpired, onReauthenticate, connectingYouTube
}: StepInfoProps) {
  const { t } = useTranslation()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  // 고급 설정이 마지막 방송과 동일한지 (description/thumbnail/privacy)
  const lastBc = getLastBroadcast()
  const advancedUnchanged =
    description === (lastBc.description || '') &&
    thumbnailUrl === (lastBc.thumbnailUrl || '') &&
    privacy === (lastBc.privacy || 'public') &&
    !isScheduled
  const [productSearch, setProductSearch] = useState('')
  const [templates, setTemplates] = useState<BroadcastTemplate[]>(() => getTemplates())
  const [showTemplates, setShowTemplates] = useState(false)
  const hasPersistentKey = channels[0]?.has_persistent_key
  const privacyOptions: { key: 'public' | 'unlisted' | 'private'; icon: typeof Globe; label: string; desc: string }[] = [
    { key: 'public', icon: Globe, label: t('seller.liveBroadcast.public'), desc: t('seller.liveBroadcast.publicDesc') },
    { key: 'unlisted', icon: EyeOff, label: t('seller.liveBroadcast.unlisted'), desc: t('seller.liveBroadcast.unlistedDesc') },
    { key: 'private', icon: Lock, label: t('seller.liveBroadcast.private'), desc: t('seller.liveBroadcast.privateDesc') },
  ]
  const methodOptions = [
    { key: 'quick' as const, icon: Play, label: t('seller.liveBroadcast.quickStart'), desc: t('seller.liveBroadcast.quickStartDesc'), active: 'border-pink-400 bg-pink-50', iconActive: 'text-pink-600', hasKey: false },
    { key: 'youtube' as const, icon: Youtube, label: 'YouTube Studio', desc: t('seller.liveBroadcast.webBrowser'), active: 'border-red-400 bg-red-50', iconActive: 'text-red-600', hasKey: false },
    { key: 'obs' as const, icon: VideoIcon, label: 'OBS Studio', desc: t('seller.liveBroadcast.pcBroadcast'), active: 'border-purple-400 bg-purple-50', iconActive: 'text-purple-600', hasKey: !!hasPersistentKey },
    { key: 'prism' as const, icon: Smartphone, label: t('seller.liveBroadcast.naverPrism'), desc: t('seller.liveBroadcast.mobile'), active: 'border-green-400 bg-green-50', iconActive: 'text-green-600', hasKey: !!hasPersistentKey },
  ]

  // 상품 정렬: 선택된 것 → 최근 사용 → 나머지
  const filteredProducts = (() => {
    const q = productSearch.trim().toLowerCase()
    const filtered = q ? sellableProducts.filter(p => p.name.toLowerCase().includes(q)) : sellableProducts
    const selectedSet = new Set(selectedProducts)
    const recentSet = new Set(recentProductIds)
    return [...filtered].sort((a, b) => {
      const aSel = selectedSet.has(a.id) ? 0 : recentSet.has(a.id) ? 1 : 2
      const bSel = selectedSet.has(b.id) ? 0 : recentSet.has(b.id) ? 1 : 2
      return aSel - bSel
    })
  })()

  function applyTemplate(tpl: BroadcastTemplate) {
    setTitle(tpl.title)
    setDescription(tpl.description)
    setPrivacy(tpl.privacy)
    const validProducts = tpl.productIds.filter(id => sellableProducts.some(p => p.id === id))
    setSelectedProducts(validProducts)
    setShowTemplates(false)
    const removed = tpl.productIds.length - validProducts.length
    if (removed > 0) {
      toast.info(t('seller.liveBroadcast.templateAppliedPartial', { removed }) as string)
    } else {
      toast.success(t('seller.liveBroadcast.templateApplied'))
    }
  }

  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  function handleSaveTemplate(name: string) {
    const newTpl: BroadcastTemplate = { name, title, description, privacy, productIds: selectedProducts }
    const updated = [newTpl, ...templates.filter(t => t.name !== name)]
    saveTemplates(updated)
    setTemplates(updated)
    setShowSaveTemplate(false)
    toast.success(t('seller.liveBroadcast.templateSaved'))
  }
  // 🛡️ 2026-04-23 배치 164: 1-click quick start (P1 UX 단순화)
  //   클릭 한 번으로 기본값(오늘 날짜 제목 + 최근 상품 3개 + quick 방식)으로 방송 생성.
  //   세부 설정이 필요한 사용자는 아래 폼을 이용.
  const canQuickStart = sellableProducts.length > 0 && !creating
  const handleQuickStart = () => {
    if (!canQuickStart) return
    const now = new Date()
    const lng = (typeof navigator !== 'undefined' && navigator.language) || 'ko'
    const dateFmt = new Intl.DateTimeFormat(lng, { month: 'short', day: 'numeric' }).format(now)
    const timeFmt = new Intl.DateTimeFormat(lng, { hour: 'numeric', hour12: false }).format(now)
    const autoTitle = t('seller.liveBroadcast.quickAutoTitle', { date: dateFmt, hour: timeFmt }) as string
    const productIds = sellableProducts.slice(0, 5).map(p => p.id)
    setTitle(autoTitle)
    setSelectedProducts(productIds)
    setMethod('quick')
    onCreate({ title: autoTitle, productIds })
  }

  // 테스트 방송: unlisted + [TEST] 제목. 셀러가 파이프라인 검증 후 삭제.
  const handleTestBroadcast = () => {
    if (sellableProducts.length === 0 || creating) return
    const testTitle = `[TEST] ${new Date().toLocaleTimeString()}`
    setTitle(testTitle)
    setPrivacy('unlisted')
    setSelectedProducts([sellableProducts[0].id])
    onCreate({ title: testTitle, productIds: [sellableProducts[0].id] })
    toast.info('테스트 방송을 생성했습니다. 송출 도구에서 시작 후 파이프라인 확인해보세요.')
  }
  // 토큰 만료 시 폼 전체 차단 + 재연동 CTA
  if (tokenExpired) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-900 mb-1">YouTube 연동이 만료됐어요</h3>
          <p className="text-sm text-amber-700">방송을 시작하려면 채널을 다시 연동해야 합니다.<br/>약 30초 소요됩니다.</p>
        </div>
        <Button onClick={onReauthenticate} disabled={connectingYouTube}
          className="bg-red-600 hover:bg-red-700 text-white px-8 h-11 text-sm font-semibold">
          {connectingYouTube ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Youtube className="w-4 h-4 mr-2" />}
          지금 재연동하기
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('seller.liveBroadcast.enterBroadcastInfo')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('seller.liveBroadcast.enterBroadcastInfoDesc')}</p>
        </div>
        {/* Quick Start + Test broadcast */}
        <div className="flex gap-1.5 shrink-0">
          {sellableProducts.length > 0 && (
            <button onClick={handleTestBroadcast} disabled={creating}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-full font-medium disabled:opacity-50"
              title="비공개 테스트 방송으로 파이프라인 검증">
              🧪 테스트
            </button>
          )}
          {canQuickStart && (
            <button onClick={handleQuickStart}
              className="text-xs bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {t('seller.liveBroadcast.quickStart')}
            </button>
          )}
        </div>
        {templates.length > 0 && (
          <div className="relative shrink-0">
            <button onClick={() => setShowTemplates(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              📋 {t('seller.liveBroadcast.templates')}
            </button>
            {showTemplates && (
              <div className="absolute top-6 right-0 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-56 overflow-y-auto">
                {templates.map(tpl => (
                  <button key={tpl.name} onClick={() => applyTemplate(tpl)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{tpl.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{tpl.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 제목 (필수) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.broadcastTitle')} <span className="text-red-500">*</span></label>
        <input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          placeholder={t('seller.liveBroadcast.broadcastTitlePlaceholder')} maxLength={100}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

      {/* 상품 선택 (필수, 검색 + 정렬) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('seller.liveBroadcast.saleProducts')} <span className="text-red-500">*</span>
          {selectedProducts.length > 0 && <span className="ml-1 text-xs text-blue-600 font-normal">{t('seller.liveBroadcast.selectedCount', { count: selectedProducts.length })}</span>}
        </label>
        {sellableProducts.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-2">{t('seller.liveBroadcast.noProducts')}</p>
            <button onClick={() => navigate('/seller/products/new')} className="text-sm text-blue-600 font-medium">{t('seller.liveBroadcast.registerProduct')}</button>
          </div>
        ) : (
          <>
            {sellableProducts.length > 6 && (
              <input type="text" value={productSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)}
                placeholder={t('seller.liveBroadcast.searchProducts')}
                className="w-full px-3 py-2 mb-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            )}
            {recentProductIds.length > 0 && !productSearch && (
              <button type="button"
                onClick={() => {
                  const recent = recentProductIds.filter(id => sellableProducts.some(p => p.id === id)).slice(0, 5)
                  setSelectedProducts(prev => [...new Set([...prev, ...recent])])
                }}
                className="text-[11px] text-blue-600 hover:text-blue-700 mb-2 underline underline-offset-2">
                + {t('seller.liveBroadcast.addRecent')}
              </button>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
              {filteredProducts.map((p: Product) => (
                <button key={p.id} onClick={() => toggleProduct(p.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${selectedProducts.includes(p.id) ? 'border-blue-500 bg-blue-50' : recentProductIds.includes(p.id) ? 'border-gray-300 hover:border-blue-300' : 'border-gray-200 hover:border-gray-300'}`}>
                  {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                  <span className="truncate flex-1">{p.name}</span>
                  {selectedProducts.includes(p.id) && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 송출 도구 (필수) — P0-3 영구키 배지 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.streamingTool')}</label>
        <p className="text-xs text-gray-400 mb-2">{t('seller.liveBroadcast.streamingToolDesc')}</p>
        <div className="grid grid-cols-3 gap-3">
          {methodOptions.map(m => (
            <button key={m.key} onClick={() => setMethod(m.key)}
              className={`relative p-4 rounded-xl border-2 transition-all text-center active:scale-95 ${method === m.key ? m.active : 'border-gray-100 hover:border-gray-200'}`}>
              {m.hasKey && (
                <span className="absolute top-1 right-1 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                  ✓ 저장됨
                </span>
              )}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${method === m.key ? m.active.split(' ')[1] : 'bg-gray-100'}`}>
                <m.icon className={`h-5 w-5 ${method === m.key ? m.iconActive : 'text-gray-400'}`} />
              </div>
              <p className="text-xs font-semibold text-gray-900">{m.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 고급 설정 접기 + 마지막 방송과 동일 힌트 */}
      <div className="border-t border-gray-100 pt-4">
        <button type="button" onClick={() => setAdvancedOpen(v => !v)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900">
          <span className="flex items-center gap-2">
            {t('seller.liveBroadcast.advancedSettings')}
            {!advancedOpen && advancedUnchanged && (
              <span className="text-[10px] text-gray-400 font-normal">{t('seller.liveBroadcast.sameAsLast')}</span>
            )}
          </span>
          <span className="text-xs">{advancedOpen ? '▾' : '▸'}</span>
        </button>
        {advancedOpen && (
          <div className="mt-4 space-y-4">
            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')} <span className="text-xs text-gray-400 font-normal">({t('common.optional')})</span></label>
              <textarea value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder={t('seller.liveBroadcast.descriptionPlaceholder')} rows={2} maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
            </div>

            {/* 썸네일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.thumbnail')} <span className="text-xs text-gray-400 font-normal">({t('common.optional')})</span></label>
              <input value={thumbnailUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThumbnailUrl(e.target.value)}
                placeholder={t('seller.liveBroadcast.thumbnailPlaceholder')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              {thumbnailUrl && (
                <img src={thumbnailUrl} alt={t('seller.preview')} className="mt-2 w-full max-w-[200px] rounded-lg object-cover"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }} />
              )}
            </div>

            {/* 공개 설정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('seller.liveBroadcast.privacySetting')}</label>
              <div className="grid grid-cols-3 gap-2">
                {privacyOptions.map(opt => (
                  <button key={opt.key} onClick={() => setPrivacy(opt.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs transition-all ${privacy === opt.key ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <opt.icon className={`w-4 h-4 ${privacy === opt.key ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${privacy === opt.key ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</span>
                    <span className="text-gray-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 예약 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('seller.liveBroadcast.scheduleBroadcast')}</p>
                <p className="text-xs text-gray-500">{isScheduled ? t('seller.liveBroadcast.startAtScheduled') : t('seller.liveBroadcast.startNow')}</p>
              </div>
              <button onClick={() => setIsScheduled((v: boolean) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isScheduled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isScheduled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {isScheduled && (
              <div className="flex gap-3">
                <input type="date" value={scheduledDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                <input type="time" value={scheduledTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledTime(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
            )}

            {/* 목적지 */}
            {destinations.filter(d => d.status === 'available').length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.destination')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('seller.liveBroadcast.destinationDesc')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {destinations.map(d => {
                    const isAvailable = d.status === 'available'
                    const isSelected = destination === d.key
                    return (
                      <button key={d.key}
                        onClick={() => isAvailable && setDestination(d.key as Destination)}
                        disabled={!isAvailable}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${!isAvailable ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{d.label}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        {!isAvailable && (
                          <p className="text-[10px] text-amber-600 font-medium">
                            {t('seller.liveBroadcast.comingSoon')}{d.eta ? ` · ${d.eta}` : ''}
                          </p>
                        )}
                        {d.note && !isAvailable && (
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{d.note}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* P2-8: 템플릿으로 저장 */}
            {title && selectedProducts.length > 0 && (
              <button type="button" onClick={() => setShowSaveTemplate(true)}
                className="w-full text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 py-1">
                📋 {t('seller.liveBroadcast.saveAsTemplate')}
              </button>
            )}
          </div>
        )}
      </div>

      {showSaveTemplate && (
        <PromptModal
          title={t('seller.liveBroadcast.templateNamePrompt')}
          placeholder="예: 매주 화요일 신상 라이브"
          confirmLabel={t('seller.liveBroadcast.templateSaved').replace(/되었습니다|saved/i, '저장')}
          onConfirm={handleSaveTemplate}
          onCancel={() => setShowSaveTemplate(false)}
        />
      )}

      <Button onClick={() => onCreate()} disabled={creating || !title.trim() || selectedProducts.length === 0}
        className="w-full h-12 bg-red-600 hover:bg-red-700 text-white text-base font-semibold">
        {creating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Radio className="h-5 w-5 mr-2" />}
        {creating ? t('seller.liveBroadcast.creating') : t('seller.liveBroadcast.createBroadcast')}
      </Button>
      </div>
    </div>
  )
}

// ── 예약 방송 대기 화면 (P1-5) ──────────────────────────────────
function ScheduledBroadcastWaiting({ stream, onBack }: { stream: LiveStream; onBack: () => void }) {
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

// OBS timecode "HH:MM:SS.mmm" → seconds
function parseTimecode(tc: string): number {
  const parts = tc.split(':')
  if (parts.length !== 3) return 0
  const [h, m, sWithMs] = parts
  const s = parseFloat(sWithMs)
  return Number(h) * 3600 + Number(m) * 60 + (isNaN(s) ? 0 : s)
}

// ── OBS 원격 제어 (obs-websocket v5) ────────────────────────────
// OBS 28+ 는 Tools → WebSocket Server Settings 에서 활성화 가능.
// 셀러가 한 번 연결 설정을 저장하면 이후엔 우리 앱에서 OBS 시작/중지/씬 전환.
function OBSRemoteControl({ stream, hasPersistentKey, copiedField, onCopy }: {
  stream: LiveStream; hasPersistentKey: boolean
  copiedField: string | null; onCopy: (v: string, k: string) => void
}) {
  const { t } = useTranslation()
  const clientRef = useRef<OBSWebSocketClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [setupForm, setSetupForm] = useState<OBSConnectConfig>(() =>
    loadOBSConfig() || { host: 'localhost', port: 4455, password: '' })
  const [obsStatus, setObsStatus] = useState<OBSStatus>({ outputActive: false })
  const [starting, setStarting] = useState(false)

  // 저장된 설정 있으면 자동 연결 시도
  useEffect(() => {
    const cfg = loadOBSConfig()
    if (!cfg) return
    const client = new OBSWebSocketClient()
    clientRef.current = client
    const off = client.onStatusChange(s => setObsStatus(prev => ({ ...prev, ...s })))
    setConnecting(true)
    client.connect(cfg).then(ok => {
      setConnected(ok)
      setConnecting(false)
    })
    return () => { off(); client.disconnect() }
  }, [])

  // 연결됨 & 스트리밍 중 → 3초마다 OBS 씬 미리보기 스크린샷
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!connected || !clientRef.current) return
    let active = true
    const tick = async () => {
      try {
        const img = await clientRef.current?.getPreviewScreenshot()
        if (active && img) setPreviewUrl(img)
      } catch { /* silent */ }
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => { active = false; clearInterval(id) }
  }, [connected, obsStatus.currentScene])

  async function connect() {
    if (!clientRef.current) clientRef.current = new OBSWebSocketClient()
    setConnecting(true)
    const ok = await clientRef.current.connect(setupForm)
    setConnecting(false)
    if (ok) {
      saveOBSConfig(setupForm)
      setConnected(true)
      setShowSetup(false)
      toast.success(t('seller.liveBroadcast.obsConnected'))
    } else {
      toast.error(t('seller.liveBroadcast.obsConnectFailed'))
    }
  }

  function disconnect() {
    clientRef.current?.disconnect()
    clientRef.current = null
    clearOBSConfig()
    setConnected(false)
  }

  async function startOBSStream() {
    if (!clientRef.current || !stream.rtmp_url || !stream.rtmp_key) return
    setStarting(true)
    try {
      // 1) OBS에 RTMP 대상 세팅
      await clientRef.current.setRtmpTarget(stream.rtmp_url, stream.rtmp_key)
      // 2) 스트리밍 시작
      await clientRef.current.startStreaming()
      toast.success(t('seller.liveBroadcast.obsStreamStarted'))
    } catch {
      toast.error(t('seller.liveBroadcast.obsStreamFailed'))
    } finally {
      setStarting(false)
    }
  }

  // ── 미연결: 연결 UI OR 기존 RTMP 복사 fallback ─────────────────
  if (!connected) {
    return (
      <div className="space-y-3">
        {hasPersistentKey ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">{t('seller.liveBroadcast.rtmpSetupDone')}</p>
              <p className="text-xs text-green-700">{t('seller.liveBroadcast.obsJustStart')}</p>
            </div>
          </div>
        ) : stream.rtmp_url && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-purple-700">{t('seller.liveBroadcast.obsRtmpSetupDesc')}</p>
            <button onClick={() => onCopy(`URL: ${stream.rtmp_url}\nKey: ${stream.rtmp_key}`, 'all')}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              {copiedField === 'all' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedField === 'all' ? t('seller.liveBroadcast.copyDone') : 'RTMP URL + Key 복사'}
            </button>
            <details className="text-xs">
              <summary className="cursor-pointer text-purple-700 hover:text-purple-900 select-none">개별 복사 + 권장 설정 보기</summary>
              <div className="mt-2 space-y-2">
                <RtmpBlock label="RTMP URL" value={stream.rtmp_url} fieldKey="rtmp_url" copiedField={copiedField} onCopy={onCopy} />
                {stream.rtmp_key && <RtmpBlock label={t('seller.liveBroadcast.streamKey')} value={stream.rtmp_key} fieldKey="rtmp_key" copiedField={copiedField} onCopy={onCopy} />}
                <RecommendedPresetBlock tool="obs" />
                <button
                  onClick={() => downloadOBSProfile({
                    profileName: 'UR Live',
                    rtmpUrl: stream.rtmp_url!,
                    rtmpKey: stream.rtmp_key || '',
                  })}
                  className="w-full py-2 bg-white border border-purple-300 hover:bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5">
                  📥 OBS 프로파일 파일 다운로드 (최초 1회)
                </button>
              </div>
            </details>
          </div>
        )}

        {/* OBS 원격 제어 연결 — Extension 있거나 localhost dev 에서만 노출
            (HTTPS 프로덕션에서는 Mixed Content 로 작동 안 함 → 숨김) */}
        {(hasOBSExtension() || (typeof window !== 'undefined' && window.location.protocol !== 'https:')) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          {!showSetup ? (
            <button onClick={() => setShowSetup(true)}
              className="w-full flex items-center justify-between text-left">
              <div>
                <p className="text-sm font-semibold text-blue-900">✨ {t('seller.liveBroadcast.obsRemoteTitle')}</p>
                <p className="text-[11px] text-blue-700 mt-0.5">{t('seller.liveBroadcast.obsRemoteDesc')}</p>
              </div>
              <span className="text-xs text-blue-600 shrink-0 ml-2">{t('seller.liveBroadcast.obsSetup')} →</span>
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-blue-900">{t('seller.liveBroadcast.obsConnectTitle')}</p>
              <p className="text-[10px] text-blue-700">
                OBS → Tools → WebSocket Server Settings 에서 Enable + Password 설정 후 아래 입력
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input value={setupForm.host} onChange={e => setSetupForm(f => ({ ...f, host: e.target.value }))}
                  placeholder="localhost"
                  className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-gray-900 bg-white" />
                <input type="number" value={setupForm.port} onChange={e => setSetupForm(f => ({ ...f, port: Number(e.target.value) || 4455 }))}
                  placeholder="4455"
                  className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
              <input type="password" value={setupForm.password || ''}
                onChange={e => setSetupForm(f => ({ ...f, password: e.target.value }))}
                placeholder={t('seller.liveBroadcast.obsPassword') as string}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-gray-900 bg-white" />
              <div className="flex gap-2">
                <button onClick={() => setShowSetup(false)}
                  className="flex-1 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold">
                  {t('common.cancel')}
                </button>
                <button onClick={connect} disabled={connecting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                  {connecting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : t('seller.liveBroadcast.obsConnect')}
                </button>
              </div>
              <p className="text-[9px] text-blue-600 mt-1">
                💡 HTTPS 브라우저에서 ws://localhost 연결은 Mixed Content 로 차단될 수 있어요. 개발 환경 먼저 테스트 권장.
              </p>
            </div>
          )}
        </div>
        )}
      </div>
    )
  }

  // ── 연결됨: 원격 제어 UI ────────────────────────────────────────
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-sm font-bold text-blue-900">{t('seller.liveBroadcast.obsConnectedTitle')}</p>
        </div>
        <button onClick={disconnect} className="text-[10px] text-blue-600 hover:text-blue-800 underline">
          {t('seller.liveBroadcast.obsDisconnect')}
        </button>
      </div>

      {/* 씬 미리보기 썸네일 (실제 OBS 출력) */}
      {previewUrl && (
        <div className="bg-black rounded-lg overflow-hidden">
          <img src={previewUrl} alt="OBS preview" className="w-full aspect-video object-contain" />
          <p className="text-[10px] text-white/70 px-2 py-1 bg-black/60">
            🎬 {t('seller.liveBroadcast.obsLivePreview')} · {obsStatus.currentScene}
          </p>
        </div>
      )}

      {obsStatus.outputActive ? (
        <div className="bg-red-500 text-white rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-bold">{t('seller.liveBroadcast.obsStreaming')}</span>
            {obsStatus.outputTimecode && <span className="text-xs font-mono opacity-90">{obsStatus.outputTimecode}</span>}
          </div>
        </div>
      ) : (
        <button onClick={startOBSStream} disabled={starting || !stream.rtmp_url}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2">
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
          {t('seller.liveBroadcast.obsStartFromApp')}
        </button>
      )}

      {/* 씬 전환 */}
      {obsStatus.sceneList && obsStatus.sceneList.length > 1 && (
        <div>
          <p className="text-[10px] font-semibold text-blue-700 mb-1.5">{t('seller.liveBroadcast.obsScenes')}</p>
          <div className="flex gap-1.5 flex-wrap">
            {obsStatus.sceneList.map(scene => (
              <button key={scene}
                onClick={() => clientRef.current?.switchScene(scene)}
                className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                  obsStatus.currentScene === scene
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'
                }`}>
                {scene}
              </button>
            ))}
          </div>
        </div>
      )}

      {obsStatus.outputActive && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          {obsStatus.outputCongestion !== undefined && (
            <div className="bg-white/60 rounded-md px-2 py-1.5 text-center">
              <p className="text-blue-600">{t('seller.liveBroadcast.obsNetworkHealth')}</p>
              <p className="font-bold text-gray-900">
                {obsStatus.outputCongestion < 0.3 ? '🟢 좋음' : obsStatus.outputCongestion < 0.7 ? '🟡 보통' : '🔴 혼잡'}
              </p>
            </div>
          )}
          {obsStatus.outputBytes !== undefined && obsStatus.outputTimecode && (() => {
            const sec = parseTimecode(obsStatus.outputTimecode)
            const kbps = sec > 0 ? Math.round((obsStatus.outputBytes * 8) / sec / 1000) : 0
            return (
              <div className="bg-white/60 rounded-md px-2 py-1.5 text-center">
                <p className="text-blue-600">비트레이트</p>
                <p className="font-bold text-gray-900">{kbps.toLocaleString()} kbps</p>
              </div>
            )
          })()}
          {obsStatus.outputTotalFrames !== undefined && obsStatus.outputSkippedFrames !== undefined && (() => {
            const total = obsStatus.outputTotalFrames || 0
            const drop = obsStatus.outputSkippedFrames || 0
            const pct = total > 0 ? (drop / total) * 100 : 0
            return (
              <div className="bg-white/60 rounded-md px-2 py-1.5 text-center">
                <p className="text-blue-600">드롭 프레임</p>
                <p className={`font-bold ${pct < 1 ? 'text-gray-900' : pct < 5 ? 'text-amber-600' : 'text-red-600'}`}>
                  {drop} ({pct.toFixed(1)}%)
                </p>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ── YouTube Studio 대기 화면 (Quick / YouTube 공통) ─────────────
// Step 2 진입 시 자동으로 Studio 팝업 오픈 + 자동 감지 안내.
// onGoLive() 호출 안 함 — 폴링이 YouTube live 상태 감지 시에만 전환.
// stream.status === 'live' 가 되면 부모가 이 컴포넌트를 unmount → cleanup에서 팝업 자동 닫힘.
function YouTubeStudioWaiting({ stream, accent }: { stream: LiveStream; accent: 'pink' | 'red' }) {
  const { t } = useTranslation()
  const popupRef = useRef<Window | null>(null)
  const openedRef = useRef(false)
  const vid = stream.youtube_video_id || stream.youtube_broadcast_id
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
      if (p) popupRef.current = p
    } catch { /* blocked */ }
  }

  // YouTube 공식 앱 Deep link (모바일) — 구독자 50+ 필요 (YouTube 정책)
  // 설치된 YouTube 앱을 직접 엶 → 새로운 앱 설치 부담 0
  function openYouTubeApp() {
    // Universal link / App Store scheme
    // iOS: youtube:// / Android: vnd.youtube:// OR 그냥 https 링크 (자동 앱 열기)
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
      // 컴포넌트 unmount 시 (= live 전환 시) 팝업 자동 닫기
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

      <button onClick={openPopup}
        className="w-full text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 py-1">
        {t('seller.liveBroadcast.reopenStudio')}
      </button>

      {/* 모바일 기기 접속 시 YouTube 앱 딥링크 대안 제시 */}
      {typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent) && (
        <button onClick={openYouTubeApp}
          className="w-full mt-1 py-2 bg-white/70 hover:bg-white border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
          📱 YouTube 앱에서 열기
        </button>
      )}
    </div>
  )
}

// ── Step 2: 연결 설정 ────────────────────────────────────────────
interface StepSetupProps {
  stream: LiveStream; method: StreamMethod; channels: YouTubeChannel[]
  copiedField: string | null; onCopy: (v: string, k: string) => void
  onGoLive: () => void; onBack: () => void
}

function StepSetup({ stream, method, channels, copiedField, onCopy, onGoLive, onBack }: StepSetupProps) {
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
  const scheduledTime = stream.scheduled_at ? new Date(stream.scheduled_at).getTime() : 0
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

      {(method === 'quick' || method === 'youtube') && (
        <YouTubeStudioWaiting
          stream={stream}
          accent={method === 'quick' ? 'pink' : 'red'}
        />
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

// ── Step 3: 라이브 중 ────────────────────────────────────────────
interface StepLiveProps {
  stream: LiveStream; products: Product[]
  onChangeProduct: (productId: number) => void; onEndStream: () => void
}

function StepLive({ stream, products, onChangeProduct, onEndStream }: StepLiveProps) {
  const { t } = useTranslation()
  const startedAtRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState('00:00')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [pipActive, setPipActive] = useState(false)
  const pipWindowRef = useRef<Window | null>(null)
  const pipUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Document Picture-in-Picture API (Chrome 116+)
  // 가벼운 컨트롤 센터: LIVE 뱃지, 타이머, 현재 상품, 다음 상품 버튼들
  async function togglePiP() {
    // @ts-expect-error: documentPictureInPicture is not in standard DOM types yet
    const dpip = window.documentPictureInPicture
    if (!dpip) {
      toast.error('PiP 모드는 Chrome 116+ / Edge 에서만 지원됩니다')
      return
    }
    if (pipActive) {
      try { pipWindowRef.current?.close() } catch { /* ignore */ }
      return
    }
    try {
      const pipWin = await dpip.requestWindow({ width: 320, height: 420 })
      pipWindowRef.current = pipWin
      pipWin.document.title = 'UR Live — 방송 중'
      pipWin.document.body.style.margin = '0'
      pipWin.document.body.style.fontFamily = 'system-ui, sans-serif'
      pipWin.document.body.style.background = '#0a0a0a'
      pipWin.document.body.style.color = 'white'
      pipWin.document.body.innerHTML = `
        <div style="padding:12px;display:flex;flex-direction:column;gap:10px;height:100vh;box-sizing:border-box">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;background:#ef4444;border-radius:50%;animation:pulse 1s infinite"></span>
            <span style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:0.5px">LIVE</span>
            <span id="pip-elapsed" style="font-size:11px;font-family:monospace;color:#a1a1aa;margin-left:4px"></span>
          </div>
          <p id="pip-title" style="font-size:13px;font-weight:600;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></p>
          <div style="font-size:10px;color:#71717a;margin-top:-4px">현재 상품</div>
          <div id="pip-current-product" style="background:#18181b;border-radius:8px;padding:8px;display:flex;gap:8px;align-items:center">
            <div id="pip-product-img" style="width:40px;height:40px;border-radius:6px;background:#27272a;flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <p id="pip-product-name" style="font-size:12px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></p>
              <p id="pip-product-price" style="font-size:10px;color:#a1a1aa;margin:2px 0 0"></p>
            </div>
          </div>
          <div style="font-size:10px;color:#71717a">상품 전환</div>
          <div id="pip-product-list" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1"></div>
        </div>
        <style>
          @keyframes pulse { 50% { opacity:0.4 } }
          .pip-btn { background:#18181b;border:none;color:white;padding:8px;border-radius:6px;cursor:pointer;text-align:left;font-size:11px;display:flex;gap:6px;align-items:center }
          .pip-btn:hover { background:#27272a }
          .pip-btn.active { background:#dc2626 }
        </style>
      `
      setPipActive(true)

      const updatePiP = () => {
        if (!pipWin.document) return
        const titleEl = pipWin.document.getElementById('pip-title')
        const elapsedEl = pipWin.document.getElementById('pip-elapsed')
        if (titleEl) titleEl.textContent = stream.title
        if (elapsedEl) elapsedEl.textContent = elapsed

        // 현재 상품
        const currentP = products.find(p => p.id === stream.current_product_id)
        const imgEl = pipWin.document.getElementById('pip-product-img') as HTMLElement
        const nameEl = pipWin.document.getElementById('pip-product-name')
        const priceEl = pipWin.document.getElementById('pip-product-price')
        if (currentP && imgEl && nameEl && priceEl) {
          imgEl.style.background = currentP.image_url ? `url(${currentP.image_url}) center/cover` : '#27272a'
          nameEl.textContent = currentP.name
          priceEl.textContent = `₩${currentP.price.toLocaleString()}`
        }

        // 상품 전환 리스트
        const listEl = pipWin.document.getElementById('pip-product-list')
        if (listEl) {
          listEl.innerHTML = ''
          products.forEach(p => {
            const btn = pipWin.document.createElement('button')
            btn.className = 'pip-btn' + (p.id === stream.current_product_id ? ' active' : '')
            btn.innerHTML = `
              <span style="width:20px;height:20px;border-radius:4px;${p.image_url ? `background:url(${p.image_url}) center/cover` : 'background:#27272a'};flex-shrink:0"></span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span>
            `
            btn.onclick = async () => {
              try {
                await api.post(`/api/seller/streams/${stream.id}/change-product`, { productId: p.id })
                onChangeProduct(p.id)
              } catch { /* ignore */ }
            }
            listEl.appendChild(btn)
          })
        }
      }
      updatePiP()
      pipUpdateIntervalRef.current = setInterval(updatePiP, 1000)
      pipWin.addEventListener('pagehide', () => {
        if (pipUpdateIntervalRef.current) clearInterval(pipUpdateIntervalRef.current)
        pipWindowRef.current = null
        setPipActive(false)
      })
    } catch { /* cancelled or blocked */ }
  }

  // cleanup on unmount
  useEffect(() => () => {
    if (pipUpdateIntervalRef.current) clearInterval(pipUpdateIntervalRef.current)
    try { pipWindowRef.current?.close() } catch { /* ignore */ }
  }, [])

  // 방송 경과 시간 타이머
  useEffect(() => {
    const tick = () => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000)
      const h = Math.floor(sec / 3600)
      const m = Math.floor((sec % 3600) / 60)
      const s = sec % 60
      setElapsed(h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // P2-12: 키보드 단축키 (input 포커스 중에는 무시)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(v => !v) }
      else if (e.key === ' ' || e.key.toLowerCase() === 'n') {
        e.preventDefault()
        const idx = products.findIndex(p => p.id === stream.current_product_id)
        const next = products[(idx + 1) % products.length]
        if (next) {
          api.post(`/api/seller/streams/${stream.id}/change-product`, { productId: next.id })
            .then(() => { onChangeProduct(next.id); toast.success(`${next.name} ▶`) })
            .catch(() => { /* silent */ })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [products, stream.id, stream.current_product_id, onChangeProduct])

  return (
    <div className="space-y-4">
      {/* 상태 바 */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
          </span>
          <span className="text-xs font-mono text-gray-500 shrink-0">{elapsed}</span>
          <p className="text-sm font-semibold text-gray-900 truncate">{stream.title}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={togglePiP}
            className={`w-7 h-7 rounded-full text-xs font-bold ${pipActive ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
            title="Picture-in-Picture (PiP)">
            ⧉
          </button>
          <button onClick={() => setShowShortcuts(v => !v)}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold"
            title="키보드 단축키 (?)">
            ?
          </button>
          <Button onClick={onEndStream} size="sm" variant="destructive">{t('seller.liveBroadcast.endBroadcast')}</Button>
        </div>
      </div>

      {/* P2-12: 단축키 도움말 */}
      {showShortcuts && (
        <div className="bg-gray-900 text-white rounded-xl p-4 text-xs space-y-1.5">
          <p className="font-bold text-gray-100 mb-2">{t('seller.liveBroadcast.shortcutsTitle')}</p>
          <div className="flex justify-between"><span className="text-gray-300">{t('seller.liveBroadcast.shortcutNextProduct')}</span><kbd className="bg-gray-800 px-2 py-0.5 rounded font-mono">Space</kbd></div>
          <div className="flex justify-between"><span className="text-gray-300">{t('seller.liveBroadcast.shortcutToggleHelp')}</span><kbd className="bg-gray-800 px-2 py-0.5 rounded font-mono">?</kbd></div>
        </div>
      )}

      {/* 실시간 통계 카운터 */}
      <LiveStatsBar streamId={stream.id} />

      {/* 🛡️ 2026-04-27 후원 부스터 발동 버튼 + PK 진행 표시 */}
      <DonationBoosterButton liveStreamId={stream.id} />
      <PKLiveBanner liveStreamId={stream.id} />

      {/* 시청자 링크 공유 */}
      <ShareLiveLink streamId={stream.id} />

      {/* 채팅 (영상 미리보기 제거 — YouTube embed는 30초 지연으로 모니터링 무의미) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ minHeight: 320 }}>
        <LiveChatPanel streamId={stream.id} />
      </div>

      {/* 상품 전환 + 경매/타임딜 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">{t('seller.liveBroadcast.switchProduct')} <span className="text-gray-400 font-normal">({t('seller.liveBroadcast.tapToSwitch')})</span></p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {products.map((p: Product) => {
              const isCurrent = stream.current_product_id === p.id
              return (
                <button key={p.id}
                  onClick={async () => {
                    try {
                      await api.post(`/api/seller/streams/${stream.id}/change-product`,
                        { productId: p.id },
                        { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })
                      onChangeProduct(p.id)
                      toast.success(`${p.name} ${t('seller.liveBroadcast.nowShowing')}`)
                    } catch { toast.error(t('seller.liveBroadcast.switchFailed')) }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 transition-all active:scale-95 ${
                    isCurrent ? 'border-red-500 bg-red-50 text-red-600 shadow-sm' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}>
                  {p.image_url && <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover" />}
                  <span className="truncate max-w-[90px]">{p.name}</span>
                  {isCurrent && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
        <AuctionTimeDealControls streamId={stream.id} products={products} />
      </div>
    </div>
  )
}


// ── 경매 / 타임딜 컨트롤 ─────────────────────────────────────────
function AuctionTimeDealControls({ streamId, products }: { streamId: number; products: Product[] }) {
  const { t } = useTranslation()
  const [showAuction, setShowAuction] = useState(false)
  const [showTimeDeal, setShowTimeDeal] = useState(false)
  const [showGroupBuy, setShowGroupBuy] = useState(false)
  const [auctionForm, setAuctionForm] = useState({ product_id: 0, title: '', start_price: 1000, min_increment: 1000, duration_seconds: 180 })
  const [dealForm, setDealForm] = useState({ product_id: 0, discount_percent: 30, max_claims: 10, duration_seconds: 30 })
  const [groupBuyForm, setGroupBuyForm] = useState({ product_id: 0, target_participants: 20, bonus_discount_percent: 50, duration_minutes: 10 })
  const [submitting, setSubmitting] = useState(false)
  const [activeAuction, setActiveAuction] = useState<{ ends_at?: string } | null>(null)
  const [activeTimeDeal, setActiveTimeDeal] = useState<{ ends_at?: string; is_group_buy?: boolean } | null>(null)
  const [tick, setTick] = useState(0)
  const token = localStorage.getItem('seller_token')

  // 활성 경매/타임딜 5초 폴링
  useEffect(() => {
    let active = true
    const fetchActive = async () => {
      try {
        const [au, td] = await Promise.allSettled([
          api.get(`/api/auction/stream/${streamId}`),
          api.get(`/api/timedeal/stream/${streamId}`),
        ])
        if (!active) return
        setActiveAuction(au.status === 'fulfilled' && au.value.data?.success ? (au.value.data.data || null) : null)
        setActiveTimeDeal(td.status === 'fulfilled' && td.value.data?.success ? (td.value.data.data || null) : null)
      } catch { /* silent */ }
    }
    fetchActive()
    const id = setInterval(fetchActive, 5000)
    return () => { active = false; clearInterval(id) }
  }, [streamId])

  // 1초 카운트다운 갱신
  useEffect(() => {
    if (!activeAuction?.ends_at && !activeTimeDeal?.ends_at) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [activeAuction?.ends_at, activeTimeDeal?.ends_at])

  function fmtRemaining(endsAt?: string): string {
    if (!endsAt) return ''
    const sec = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
    void tick
    const m = Math.floor(sec / 60), s = sec % 60
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
  }

  async function createAuction() {
    if (!auctionForm.title || !auctionForm.start_price) { toast.error(t('seller.liveBroadcast.enterTitleAndPrice')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/auction/create', { stream_id: streamId, ...auctionForm }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.auctionStarted')); setShowAuction(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.auctionCreateFailed')) }
    finally { setSubmitting(false) }
  }

  async function createTimeDeal() {
    if (!dealForm.product_id) { toast.error(t('seller.liveBroadcast.selectProduct')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/timedeal/create', { stream_id: streamId, ...dealForm }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.timeDealStarted', { seconds: dealForm.duration_seconds })); setShowTimeDeal(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.timeDealCreateFailed')) }
    finally { setSubmitting(false) }
  }

  async function createGroupBuy() {
    if (!groupBuyForm.product_id) { toast.error(t('seller.liveBroadcast.selectProduct')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/timedeal/create', {
        stream_id: streamId,
        product_id: groupBuyForm.product_id,
        discount_percent: 0,
        max_claims: 100,
        duration_seconds: groupBuyForm.duration_minutes * 60,
        is_group_buy: true,
        target_participants: groupBuyForm.target_participants,
        bonus_discount_percent: groupBuyForm.bonus_discount_percent,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.groupBuyStarted')); setShowGroupBuy(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.groupBuyCreateFailed')) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-2">
      {/* 활성 진행 상태 */}
      {(activeAuction || activeTimeDeal) && (
        <div className="flex flex-wrap gap-2">
          {activeAuction && (
            <span className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-semibold">
              <Gavel className="w-3 h-3" />
              {t('seller.liveBroadcast.auction')} · {fmtRemaining(activeAuction.ends_at)}
            </span>
          )}
          {activeTimeDeal && (
            <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${activeTimeDeal.is_group_buy ? 'bg-pink-100 text-pink-800' : 'bg-red-100 text-red-800'}`}>
              {activeTimeDeal.is_group_buy ? <Users className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {activeTimeDeal.is_group_buy ? t('seller.liveBroadcast.liveGroupBuy') : t('seller.liveBroadcast.timeDeal')} · {fmtRemaining(activeTimeDeal.ends_at)}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => { setShowAuction(!showAuction); setShowTimeDeal(false); setShowGroupBuy(false) }}
          disabled={!!activeAuction}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showAuction ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <Gavel className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.auction')}
        </button>
        <button onClick={() => { setShowTimeDeal(!showTimeDeal); setShowAuction(false); setShowGroupBuy(false) }}
          disabled={!!activeTimeDeal}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showTimeDeal ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          <Zap className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.timeDeal')}
        </button>
        <button onClick={() => { setShowGroupBuy(!showGroupBuy); setShowAuction(false); setShowTimeDeal(false) }}
          disabled={!!activeTimeDeal}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showGroupBuy ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-600 border border-pink-200'}`}>
          <Users className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.liveGroupBuy')}
        </button>
      </div>

      {showAuction && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-amber-800">{t('seller.liveBroadcast.auctionSetup')}</p>
          <input value={auctionForm.title} onChange={e => setAuctionForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('seller.liveBroadcast.auctionTitlePlaceholder')} className="w-full px-2.5 py-2 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white" />
          <select value={auctionForm.product_id} onChange={e => setAuctionForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductOptional')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {([['start_price', t('seller.liveBroadcast.startPrice')], ['min_increment', t('seller.liveBroadcast.minIncrement')], ['duration_seconds', t('seller.liveBroadcast.durationSec')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-amber-700">{label}</label>
                <input type="number" value={auctionForm[key]} onChange={e => setAuctionForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createAuction} disabled={submitting}
            className="w-full py-2 bg-amber-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startAuction')}
          </button>
        </div>
      )}

      {showTimeDeal && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-red-700">{t('seller.liveBroadcast.timeDealSetup')}</p>
          <select value={dealForm.product_id} onChange={e => setDealForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-red-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductRequired')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price?.toLocaleString()}{t('common.won')})</option>)}
          </select>
          {/* 퀵 프리셋 */}
          <div className="flex gap-1.5">
            {[60, 180, 300].map(sec => (
              <button key={sec} type="button"
                onClick={() => setDealForm(f => ({ ...f, duration_seconds: sec }))}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border ${
                  dealForm.duration_seconds === sec ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200'
                }`}>
                {sec < 60 ? `${sec}s` : `${sec / 60}분`}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['discount_percent', t('seller.liveBroadcast.discountPercent')], ['max_claims', t('common.quantity')], ['duration_seconds', t('seller.liveBroadcast.durationSec')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-red-600">{label}</label>
                <input type="number" value={dealForm[key]} onChange={e => setDealForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createTimeDeal} disabled={submitting || !dealForm.product_id}
            className="w-full py-2 bg-red-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startTimeDeal', { seconds: dealForm.duration_seconds })}
          </button>
        </div>
      )}

      {showGroupBuy && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-pink-700">{t('seller.liveBroadcast.groupBuySetup')}</p>
          <p className="text-[10px] text-pink-600">{t('seller.liveBroadcast.groupBuySetupDesc')}</p>
          <select value={groupBuyForm.product_id} onChange={e => setGroupBuyForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-pink-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductRequired')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price?.toLocaleString()}{t('common.won')})</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {([['target_participants', t('seller.liveBroadcast.targetParticipants')], ['bonus_discount_percent', t('seller.liveBroadcast.discountPercent')], ['duration_minutes', t('seller.liveBroadcast.durationMin')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-pink-600">{label}</label>
                <input type="number" value={groupBuyForm[key]} onChange={e => setGroupBuyForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-pink-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createGroupBuy} disabled={submitting || !groupBuyForm.product_id}
            className="w-full py-2 bg-pink-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startGroupBuy')}
          </button>
        </div>
      )}
    </div>
  )
}
