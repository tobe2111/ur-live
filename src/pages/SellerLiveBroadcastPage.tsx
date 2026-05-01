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
