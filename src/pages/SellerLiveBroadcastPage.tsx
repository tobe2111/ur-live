import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { formatKSTDate } from '@/utils/date'
import SellerLayout from '@/components/SellerLayout'
import {
  Youtube, Loader2, ExternalLink, Radio, Play,
  VideoIcon, CheckCircle2, AlertCircle, Copy,
  Smartphone, ArrowLeft, Gavel, Zap,
  Globe, EyeOff, Lock, Users
} from 'lucide-react'
import { isSellerAuthenticated } from '@/lib/seller-auth'
import PrismQRCode from '@/components/streaming/PrismQRCode'
import LiveChatPanel from '@/components/seller/LiveChatPanel'

// ── Types ──────────────────────────────────────────────────────────
interface YouTubeChannel {
  id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  is_active: boolean
  has_persistent_key?: boolean
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
}

type WizardStep = 'info' | 'setup' | 'live'
type StreamMethod = 'youtube' | 'obs' | 'prism' | 'quick'

// ── 스텝 인디케이터 ────────────────────────────────────────────────
function StepIndicator({ step }: { step: WizardStep }) {
  const { t } = useTranslation()
  const steps: { key: WizardStep; label: string }[] = [
    { key: 'info', label: t('seller.liveBroadcast.stepInfo') },
    { key: 'setup', label: t('seller.liveBroadcast.stepSetup') },
    { key: 'live', label: t('seller.liveBroadcast.stepLive') },
  ]
  const idx = steps.findIndex(s => s.key === step)
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            i < idx ? 'bg-green-100 text-green-700' :
            i === idx ? 'bg-blue-600 text-white' :
            'bg-gray-100 text-gray-400'
          }`}>
            {i < idx ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
            <span>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-6 h-px ${i < idx ? 'bg-green-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── RTMP 복사 블록 ─────────────────────────────────────────────────
function RtmpBlock({ label, value, fieldKey, copiedField, onCopy }: {
  label: string; value: string; fieldKey: string
  copiedField: string | null; onCopy: (v: string, k: string) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="flex gap-2">
        <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono truncate">
          {value}
        </code>
        <button
          onClick={() => onCopy(value, fieldKey)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0"
        >
          {copiedField === fieldKey
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : <Copy className="w-4 h-4 text-gray-500" />}
        </button>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function SellerLiveBroadcastPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // 데이터
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connectingYouTube, setConnectingYouTube] = useState(false)

  // 위저드 상태
  const [step, setStep] = useState<WizardStep>('info')
  const [method, setMethod] = useState<StreamMethod>('obs')
  const [currentStream, setCurrentStream] = useState<LiveStream | null>(null)

  // Step 1 폼
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public')

  // UI
  const [creating, setCreating] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    if (!isSellerAuthenticated()) { navigate('/seller/login'); return }
    loadData()
  }, [navigate])

  // Step 2: OBS/Prism 연결 자동 감지 폴링
  useEffect(() => {
    if (step !== 'setup' || !currentStream) return
    const poll = async () => {
      try {
        const res = await api.get(`/api/seller/youtube/live/${currentStream.id}/status`)
        if (res.data?.success && res.data.data?.synced && res.data.data?.status === 'live') {
          toast.success(t('seller.liveBroadcast.broadcastStartedAuto'))
          setCurrentStream(s => s ? { ...s, status: 'live' } : s)
          setStep('live')
        }
      } catch { /* silent */ }
    }
    const interval = setInterval(poll, 8000)
    return () => clearInterval(interval)
  }, [step, currentStream])

  async function loadData() {
    try {
      setLoading(true); setLoadError(null)
      const [chRes, prRes, stRes] = await Promise.allSettled([
        api.get('/api/seller/youtube/channels'),
        api.get('/api/seller/products'),
        api.get('/api/seller/streams'),
      ])
      if (chRes.status === 'fulfilled' && chRes.value.data?.success)
        setChannels(chRes.value.data.data || [])
      if (prRes.status === 'fulfilled' && prRes.value.data?.success)
        setProducts(prRes.value.data.data || [])
      if (stRes.status === 'fulfilled' && stRes.value.data?.success)
        setStreams(stRes.value.data.data || [])
    } catch { setLoadError(t('seller.liveBroadcast.dataLoadFailed')) }
    finally { setLoading(false) }
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

  async function createBroadcast() {
    if (!title.trim()) { toast.error(t('seller.liveBroadcast.enterTitle')); return }
    if (selectedProducts.length === 0) { toast.error(t('seller.liveBroadcast.selectOneProduct')); return }
    try {
      setCreating(true)
      let scheduledStartTime = new Date().toISOString()
      if (isScheduled && scheduledDate && scheduledTime)
        scheduledStartTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()

      const res = await api.post('/api/seller/youtube/live/create', {
        title: title.trim(), description: description.trim(),
        thumbnail_url: thumbnailUrl.trim() || undefined,
        product_ids: selectedProducts,
        scheduled_start_time: scheduledStartTime,
        privacy_status: privacy,
      })
      if (res.data?.success) {
        const d = res.data.data
        setCurrentStream({
          id: d.stream_id, title: title.trim(),
          youtube_video_id: d.broadcast?.id || '',
          youtube_broadcast_id: d.broadcast?.id,
          youtube_url: d.youtube_url,
          rtmp_url: d.rtmp_url, rtmp_key: d.rtmp_key,
          status: 'scheduled', viewer_count: 0,
        })
        setStep('setup')
      } else {
        if (res.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') toast.error(t('seller.liveBroadcast.youtubeReauthRequired'))
        else toast.error(res.data?.error || t('seller.liveBroadcast.createFailed'))
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error_code?: string; error?: string } } }
      if (axiosErr.response?.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') toast.error(t('seller.liveBroadcast.youtubeReauthRequired'))
      else toast.error(axiosErr.response?.data?.error || t('seller.liveBroadcast.createFailed'))
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

  async function endStream() {
    if (!currentStream || !confirm(t('seller.liveBroadcast.confirmEnd'))) return
    try {
      await api.post(`/api/seller/youtube/live/${currentStream.id}/end`)
      toast.success(t('seller.liveBroadcast.ended'))
      setCurrentStream(null); setStep('info')
      setTitle(''); setDescription(''); setSelectedProducts([])
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
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
      <div className="max-w-2xl mx-auto">

        {/* 연동 채널 */}
        <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200 mb-5">
          {channels[0]?.channel_thumbnail
            ? <img src={channels[0].channel_thumbnail} alt="" className="w-8 h-8 rounded-full" />
            : <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><Youtube className="h-4 w-4 text-red-500" /></div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{channels[0]?.channel_title}</p>
            <p className="text-xs text-gray-400">{String(t('seller.liveBroadcast.subscribers', { count: channels[0]?.subscriber_count?.toLocaleString() || '0' } as Record<string, string>))}</p>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('seller.liveBroadcast.linked')}</span>
        </div>

        <StepIndicator step={step} />

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
            toggleProduct={(id: number) => setSelectedProducts(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            method={method} setMethod={setMethod}
            creating={creating} onCreate={createBroadcast}
            navigate={navigate}
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
            onEndStream={endStream}
          />
        )}

        {/* 기존 방송 목록 (info 단계에서만) */}
        {step === 'info' && (
          <StreamList
            streams={streams}
            onManage={(stream: LiveStream) => {
              setCurrentStream(stream)
              setStep(stream.status === 'live' ? 'live' : 'setup')
            }}
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
  sellableProducts: Product[]; selectedProducts: number[]; toggleProduct: (id: number) => void
  method: StreamMethod; setMethod: (v: StreamMethod) => void
  creating: boolean; onCreate: () => void
  navigate: ReturnType<typeof useNavigate>
}

function StepInfo({ title, setTitle, description, setDescription, thumbnailUrl, setThumbnailUrl, privacy, setPrivacy,
  isScheduled, setIsScheduled, scheduledDate, setScheduledDate, scheduledTime, setScheduledTime,
  sellableProducts, selectedProducts, toggleProduct, method, setMethod, creating, onCreate, navigate
}: StepInfoProps) {
  const { t } = useTranslation()
  const privacyOptions: { key: 'public' | 'unlisted' | 'private'; icon: typeof Globe; label: string; desc: string }[] = [
    { key: 'public', icon: Globe, label: t('seller.liveBroadcast.public'), desc: t('seller.liveBroadcast.publicDesc') },
    { key: 'unlisted', icon: EyeOff, label: t('seller.liveBroadcast.unlisted'), desc: t('seller.liveBroadcast.unlistedDesc') },
    { key: 'private', icon: Lock, label: t('seller.liveBroadcast.private'), desc: t('seller.liveBroadcast.privateDesc') },
  ]
  const methodOptions = [
    { key: 'quick' as const, icon: Play, label: t('seller.liveBroadcast.quickStart'), desc: t('seller.liveBroadcast.quickStartDesc'), active: 'border-pink-400 bg-pink-50', iconActive: 'text-pink-600' },
    { key: 'youtube' as const, icon: Youtube, label: 'YouTube Studio', desc: t('seller.liveBroadcast.webBrowser'), active: 'border-red-400 bg-red-50', iconActive: 'text-red-600' },
    { key: 'obs' as const, icon: VideoIcon, label: 'OBS Studio', desc: t('seller.liveBroadcast.pcBroadcast'), active: 'border-purple-400 bg-purple-50', iconActive: 'text-purple-600' },
    { key: 'prism' as const, icon: Smartphone, label: t('seller.liveBroadcast.naverPrism'), desc: t('seller.liveBroadcast.mobile'), active: 'border-green-400 bg-green-50', iconActive: 'text-green-600' },
  ]
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">{t('seller.liveBroadcast.enterBroadcastInfo')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('seller.liveBroadcast.enterBroadcastInfoDesc')}</p>
      </div>

      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.broadcastTitle')} <span className="text-red-500">*</span></label>
        <input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          placeholder={t('seller.liveBroadcast.broadcastTitlePlaceholder')} maxLength={100}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

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

      {/* 상품 선택 */}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
            {sellableProducts.map((p: Product) => (
              <button key={p.id} onClick={() => toggleProduct(p.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${selectedProducts.includes(p.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                <span className="truncate flex-1">{p.name}</span>
                {selectedProducts.includes(p.id) && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 방송 방식 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('seller.liveBroadcast.broadcastMethod')}</label>
        <div className="grid grid-cols-3 gap-3">
          {methodOptions.map(m => (
            <button key={m.key} onClick={() => setMethod(m.key)}
              className={`p-4 rounded-xl border-2 transition-all text-center active:scale-95 ${method === m.key ? m.active : 'border-gray-100 hover:border-gray-200'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${method === m.key ? m.active.split(' ')[1] : 'bg-gray-100'}`}>
                <m.icon className={`h-5 w-5 ${method === m.key ? m.iconActive : 'text-gray-400'}`} />
              </div>
              <p className="text-xs font-semibold text-gray-900">{m.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={onCreate} disabled={creating || !title.trim() || selectedProducts.length === 0}
        className="w-full h-12 bg-red-600 hover:bg-red-700 text-white text-base font-semibold">
        {creating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Radio className="h-5 w-5 mr-2" />}
        {creating ? t('seller.liveBroadcast.creating') : t('seller.liveBroadcast.createBroadcast')}
      </Button>
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
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('seller.liveBroadcast.connectionSetup')}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{stream.title}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full font-medium">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
          {t('seller.liveBroadcast.waitingConnection')}

        </div>
      </div>

      {method === 'quick' && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
              <Play className="w-4 h-4 text-pink-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('seller.liveBroadcast.quickStartTitle')}</p>
              <p className="text-xs text-gray-500">{t('seller.liveBroadcast.quickStartTitleDesc')}</p>
            </div>
          </div>
          {[t('seller.liveBroadcast.quickStep1'), t('seller.liveBroadcast.quickStep2'), t('seller.liveBroadcast.quickStep3'), t('seller.liveBroadcast.quickStep4')].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              {s}
            </div>
          ))}
          <Button onClick={() => {
            onGoLive()
            const vid = stream.youtube_video_id || stream.youtube_broadcast_id
            if (vid) {
              window.open(`https://studio.youtube.com/video/${vid}/livestreaming`, '_blank')
            } else {
              toast.info(t('seller.liveBroadcast.createFirst'))
            }
          }} className="w-full bg-pink-600 hover:bg-pink-700 text-white mt-2">
            <Play className="w-4 h-4 mr-2" /> {t('seller.liveBroadcast.createAndOpenStudio')}
          </Button>
          <p className="text-[10px] text-gray-400 text-center">{t('seller.liveBroadcast.youtubeApiAutoNote')}</p>
        </div>
      )}

      {method === 'youtube' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Youtube className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('seller.liveBroadcast.ytStudioTitle')}</p>
              <p className="text-xs text-gray-500">{t('seller.liveBroadcast.ytStudioDesc')}</p>
            </div>
          </div>
          {[t('seller.liveBroadcast.ytStep1'), t('seller.liveBroadcast.ytStep2'), t('seller.liveBroadcast.ytStep3'), t('seller.liveBroadcast.ytStep4')].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              {s}
            </div>
          ))}
          <Button onClick={() => {
            onGoLive()
            const vid = stream.youtube_video_id || stream.youtube_broadcast_id
            window.open(vid ? `https://studio.youtube.com/video/${vid}/livestreaming` : 'https://studio.youtube.com/channel/UC/livestreaming', '_blank')
          }} className="w-full bg-red-600 hover:bg-red-700 text-white mt-2">
            <ExternalLink className="w-4 h-4 mr-2" /> {t('seller.liveBroadcast.openYtStudio')}
          </Button>
        </div>
      )}

      {method === 'obs' && (
        <div className="space-y-3">
          {hasPersistentKey ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{t('seller.liveBroadcast.rtmpSetupDone')}</p>
                <p className="text-xs text-green-700">{t('seller.liveBroadcast.obsJustStart')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <VideoIcon className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t('seller.liveBroadcast.obsRtmpSetup')}</p>
                    <p className="text-xs text-gray-500">{t('seller.liveBroadcast.obsRtmpSetupDesc')}</p>
                  </div>
                </div>
                {[t('seller.liveBroadcast.obsStep1'), t('seller.liveBroadcast.obsStep2'), t('seller.liveBroadcast.obsStep3'), t('seller.liveBroadcast.obsStep4')].map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {s}
                  </div>
                ))}
              </div>
              {stream.rtmp_url && (
                <div className="space-y-2">
                  <RtmpBlock label="RTMP URL" value={stream.rtmp_url} fieldKey="rtmp_url" copiedField={copiedField} onCopy={onCopy} />
                  {stream.rtmp_key && <RtmpBlock label={t('seller.liveBroadcast.streamKey')} value={stream.rtmp_key} fieldKey="rtmp_key" copiedField={copiedField} onCopy={onCopy} />}
                  <button onClick={() => onCopy(`URL: ${stream.rtmp_url}\nKey: ${stream.rtmp_key}`, 'all')}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    {copiedField === 'all' ? t('seller.liveBroadcast.copyDone') : t('seller.liveBroadcast.copyAll')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
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

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> {t('common.cancel')}
        </button>
        <div className="flex-1" />
        <Button onClick={onGoLive} className="bg-red-600 hover:bg-red-700 text-white">
          <Radio className="w-4 h-4 mr-2" /> {t('seller.liveBroadcast.goLive')}
        </Button>
      </div>
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
  return (
    <div className="space-y-4">
      {/* 상태 바 */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
          </span>
          <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{stream.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {stream.youtube_video_id && (
            <a href={`https://www.youtube.com/watch?v=${stream.youtube_video_id}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> YouTube
            </a>
          )}
          <Button onClick={onEndStream} size="sm" variant="destructive">{t('seller.liveBroadcast.endBroadcast')}</Button>
        </div>
      </div>

      {/* 영상 + 채팅 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {stream.youtube_video_id && (
            <div className="lg:w-1/2 bg-black">
              <div className="aspect-video">
                <iframe src={`https://www.youtube.com/embed/${stream.youtube_video_id}?autoplay=0&mute=1`}
                  title={t('seller.live')} className="w-full h-full"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            </div>
          )}
          <div className={`${stream.youtube_video_id ? 'lg:w-1/2' : 'w-full'} flex flex-col border-t lg:border-t-0 lg:border-l border-gray-100`} style={{ minHeight: 320 }}>
            <LiveChatPanel streamId={stream.id} />
          </div>
        </div>
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

// ── 기존/최근 방송 목록 ──────────────────────────────────────────
interface StreamListProps {
  streams: LiveStream[]; onManage: (stream: LiveStream) => void
}

function StreamList({ streams, onManage }: StreamListProps) {
  const { t } = useTranslation()
  const active = streams.filter((s: LiveStream) => s.status !== 'ended')
  const ended = streams.filter((s: LiveStream) => s.status === 'ended')
  if (streams.length === 0) return null
  return (
    <div className="mt-6 space-y-4">
      {active.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700">{t('seller.liveBroadcast.activeBroadcasts')}</h3>
          {active.map((s: LiveStream) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${s.status === 'live' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                {s.status === 'live' ? '● LIVE' : t('common.scheduled')}
              </span>
              <p className="text-sm font-medium text-gray-900 truncate flex-1">{s.title}</p>
              <button onClick={() => onManage(s)} className="text-xs text-blue-600 font-medium shrink-0">{t('common.manage')} →</button>
            </div>
          ))}
        </div>
      )}
      {ended.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700">{t('seller.liveBroadcast.recentBroadcasts')}</h3>
          {ended.slice(0, 5).map((s: LiveStream) => (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {s.youtube_video_id && <img src={`https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                <p className="text-xs text-gray-500">{s.ended_at ? formatKSTDate(s.ended_at) : ''}</p>
              </div>
              <a href={`/seller/live-analytics/${s.id}`} className="text-xs text-blue-600 font-medium shrink-0">{t('seller.analytics')}</a>
            </div>
          ))}
        </div>
      )}
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
  const token = localStorage.getItem('seller_token')

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
      <div className="flex gap-2">
        <button onClick={() => { setShowAuction(!showAuction); setShowTimeDeal(false); setShowGroupBuy(false) }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${showAuction ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <Gavel className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.auction')}
        </button>
        <button onClick={() => { setShowTimeDeal(!showTimeDeal); setShowAuction(false); setShowGroupBuy(false) }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${showTimeDeal ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          <Zap className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.timeDeal')}
        </button>
        <button onClick={() => { setShowGroupBuy(!showGroupBuy); setShowAuction(false); setShowTimeDeal(false) }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${showGroupBuy ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-600 border border-pink-200'}`}>
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
