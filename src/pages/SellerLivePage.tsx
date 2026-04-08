import { useTranslation } from 'react-i18next'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatKSTDate, formatKSTTime } from '@/utils/date'
import SellerLayout from '@/components/SellerLayout'
import {
  Play, Radio, Clock, Loader2, Eye, ChevronDown, ChevronUp,
  Youtube, Instagram, Link as LinkIcon, Settings, Video,
  Users, Zap, Square, CalendarClock, History, Plus, Copy,
  CheckCircle2, ExternalLink, Image as ImageIcon
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────

interface Product {
  id: number
  name: string
  price: number
  image_url?: string
  stock?: number
}

interface LiveStream {
  id: number
  title: string
  description?: string
  youtube_video_id?: string
  youtube_url?: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count?: number
  current_product_id?: number | null
  scheduled_at?: string
  started_at?: string
  ended_at?: string
  created_at?: string
  seller_instagram?: string
  seller_youtube?: string
}

type TabKey = 'start' | 'control' | 'history'

// ─── Component ───────────────────────────────────────────────────

export default function SellerLivePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('start')

  const token = localStorage.getItem('seller_token')

  useEffect(() => {
    if (!token) {
      navigate('/seller/login')
    }
  }, [token, navigate])

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'start', label: t('seller.startBroadcast'), icon: <Play className="w-4 h-4" /> },
    { key: 'control', label: t('seller.broadcastControl'), icon: <Radio className="w-4 h-4" /> },
    { key: 'history', label: t('seller.broadcastHistory'), icon: <History className="w-4 h-4" /> },
  ]

  return (
    <SellerLayout title={t('seller.liveManage')}>
      <div className="max-w-4xl mx-auto">
        {/* Tab Bar */}
        <div className="bg-white rounded-xl shadow-sm mb-5">
          <div className="flex border-b border-gray-100">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'start' && <StartTab token={token} />}
        {activeTab === 'control' && <ControlTab token={token} />}
        {activeTab === 'history' && <HistoryTab token={token} />}
      </div>
    </SellerLayout>
  )
}

// ─── Tab 1: 방송 시작 ────────────────────────────────────────────

function StartTab({ token }: { token: string | null }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'instant' | 'scheduled'>('instant')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtubeUrl: '',
    scheduledAt: '',
    sellerInstagram: '',
    sellerYoutube: '',
  })
  const [products, setProducts] = useState<Product[]>([])
  const [supplyProducts, setSupplyProducts] = useState<Product[]>([])
  const [productTab, setProductTab] = useState<'my' | 'supply'>('my')
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState('')
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [youtubeChannelName, setYoutubeChannelName] = useState('')
  const [streamKey, setStreamKey] = useState('')
  const [broadcastPlatform, setBroadcastPlatform] = useState<'prism' | 'obs' | 'youtube'>('prism')
  const [createdStream, setCreatedStream] = useState<{
    id: number
    streamKey: string
    rtmpUrl: string
    title: string
    youtubeVideoId?: string
  } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const navigate = useNavigate()

  // Load SNS links from localStorage on mount
  useEffect(() => {
    const savedInstagram = localStorage.getItem('seller_sns_instagram')
    const savedYoutube = localStorage.getItem('seller_sns_youtube')
    if (savedInstagram) setFormData(prev => ({ ...prev, sellerInstagram: savedInstagram }))
    if (savedYoutube) setFormData(prev => ({ ...prev, sellerYoutube: savedYoutube }))
  }, [])

  useEffect(() => {
    if (!token) return
    setProductsLoading(true)
    const headers = { Authorization: `Bearer ${token}` }

    Promise.allSettled([
      api.get('/api/seller/products?limit=100', { headers }),
      api.get('/api/seller/youtube/channels', { headers }),
      api.get('/api/supply/products', { headers }),
    ]).then(([prodRes, ytRes, supplyRes]) => {
      if (prodRes.status === 'fulfilled' && prodRes.value.data?.success) {
        setProducts(prodRes.value.data.data || [])
      }
      if (ytRes.status === 'fulfilled' && ytRes.value.data?.success) {
        const channels = ytRes.value.data.data || []
        if (channels.length > 0) {
          setYoutubeConnected(true)
          setYoutubeChannelName(channels[0].channel_title || channels[0].channel_name || channels[0].title || localStorage.getItem('youtube_channel_name') || '')
          if (channels[0].default_rtmp_key) {
            setStreamKey(channels[0].default_rtmp_key)
          }
        }
      }
      // Check localStorage fallback for youtube channel
      if (!youtubeConnected) {
        const savedName = localStorage.getItem('youtube_channel_name')
        if (savedName) {
          setYoutubeConnected(true)
          setYoutubeChannelName(savedName)
        }
      }
      if (supplyRes.status === 'fulfilled' && supplyRes.value.data?.success) {
        const supplyData = supplyRes.value.data.data
        const items = Array.isArray(supplyData) ? supplyData : supplyData?.items || supplyData?.products || []
        // 승인된 공급 상품 표시 (대소문자 모두 매칭)
        const approved = items.filter((p: Record<string, unknown>) => {
          const status = String(p.request_status || '').toUpperCase()
          return status === 'APPROVED' || !p.request_status
        }).map((p: Record<string, unknown>) => ({
          id: p.id as number,
          name: p.name as string,
          price: (p.retail_price || p.price) as number,
          image_url: p.image_url as string | undefined,
        }))
        setSupplyProducts(approved)
      }
    }).finally(() => setProductsLoading(false))
  }, [token])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Auto-save SNS links to localStorage
    if (name === 'sellerInstagram') localStorage.setItem('seller_sns_instagram', value)
    if (name === 'sellerYoutube') localStorage.setItem('seller_sns_youtube', value)
  }

  function toggleProduct(id: number) {
    setSelectedProductIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pid => pid !== id)
      }
      return [...prev, id]
    })
  }

  function moveProduct(id: number, direction: 'up' | 'down') {
    setSelectedProductIds(prev => {
      const idx = prev.indexOf(id)
      if (idx === -1) return prev
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError('')
    setLoading(true)

    try {
      const isScheduled = mode === 'scheduled' && formData.scheduledAt
      const response = await api.post('/api/seller/streams', {
        title: formData.title,
        description: formData.description,
        youtube_url: formData.youtubeUrl || '',
        scheduled_at: isScheduled ? formData.scheduledAt : null,
        status: isScheduled ? 'scheduled' : 'live',
        seller_instagram: formData.sellerInstagram || null,
        seller_youtube: formData.sellerYoutube || null,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        const streamId = response.data.data?.id
        const responseStreamKey = response.data.data?.stream_key || response.data.data?.streamKey || streamKey || ''
        const responseRtmpUrl = response.data.data?.rtmp_url || response.data.data?.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2'
        const youtubeVideoId = response.data.data?.youtube_video_id || response.data.data?.youtubeVideoId || ''
        // Link selected products
        if (streamId && selectedProductIds.length > 0) {
          await Promise.allSettled(
            selectedProductIds.map(pid =>
              api.post(`/api/seller/products/${pid}/link-to-stream`,
                { stream_id: streamId },
                { headers: { Authorization: `Bearer ${token}` } }
              )
            )
          )
        }
        toast.success(isScheduled ? t('seller.broadcastScheduled') : t('seller.liveStarted'))

        // Show the broadcast ready section
        setCreatedStream({
          id: streamId,
          streamKey: responseStreamKey,
          rtmpUrl: responseRtmpUrl,
          title: formData.title,
          youtubeVideoId,
        })

        setFormData({ title: '', description: '', youtubeUrl: '', scheduledAt: '', sellerInstagram: '', sellerYoutube: '' })
        setSelectedProductIds([])
      } else {
        setError(response.data.error || t('seller.broadcastCreateFailed'))
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('seller.broadcastCreateFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(t('common.copySuccess'))
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error(t('common.copyFailed'))
    }
  }

  // Show broadcast ready section after successful creation
  if (createdStream) {
    return (
      <div className="space-y-5">
        {/* Success header */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-green-800 mb-1">{t('seller.broadcastReady')}</h3>
          <p className="text-sm text-green-700">&quot;{createdStream.title}&quot; {t('seller.broadcastCreated')}</p>
        </div>

        {/* Stream Key & RTMP URL */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" />
            {t('seller.streamInfo')}
          </h4>

          {createdStream.streamKey && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('seller.streamKey')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createdStream.streamKey}
                  readOnly
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdStream.streamKey, 'streamKey')}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    copiedField === 'streamKey'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copiedField === 'streamKey' ? (
                    <><CheckCircle2 className="w-4 h-4" /> {t('common.copied')}</>
                  ) : (
                    <><Copy className="w-4 h-4" /> {t('common.copy')}</>
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">RTMP URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={createdStream.rtmpUrl}
                readOnly
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 select-all"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(createdStream.rtmpUrl, 'rtmpUrl')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  copiedField === 'rtmpUrl'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copiedField === 'rtmpUrl' ? (
                  <><CheckCircle2 className="w-4 h-4" /> {t('common.copied')}</>
                ) : (
                  <><Copy className="w-4 h-4" /> {t('common.copy')}</>
                )}
              </button>
            </div>
          </div>

          {createdStream.youtubeVideoId && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('seller.youtubeVideoId')}</label>
              <p className="px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50">{createdStream.youtubeVideoId}</p>
            </div>
          )}
        </div>

        {/* Platform-specific next steps */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">{t('seller.nextSteps')}</h4>
          {broadcastPlatform === 'prism' && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <h5 className="text-sm font-semibold text-purple-900 mb-2">{t('seller.prismStudioGuide')}</h5>
              <ol className="text-xs text-purple-800 space-y-1.5 list-decimal list-inside">
                <li>{t('seller.prismStudioGuide')}</li>
                <li>{'YouTube'}</li>
                <li>{t('seller.streamKey')}</li>
                <li>TikTok, Facebook</li>
                <li>{t('seller.startBroadcast')}</li>
              </ol>
            </div>
          )}
          {broadcastPlatform === 'obs' && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-900 mb-2">{t('seller.obsStudioGuide')}</h5>
              <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
                <li>OBS Studio</li>
                <li>{'Settings > Stream > YouTube - RTMPS'}</li>
                <li>RTMP URL + {t('seller.streamKey')}</li>
                <li>{t('seller.startBroadcast')}</li>
              </ol>
            </div>
          )}
          {broadcastPlatform === 'youtube' && (
            <div className="p-4 bg-red-50 rounded-lg">
              <h5 className="text-sm font-semibold text-red-900 mb-2">{t('seller.youtubeStudioGuide')}</h5>
              <ol className="text-xs text-red-800 space-y-1.5 list-decimal list-inside">
                <li>
                  <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    YouTube Studio
                  </a>
                </li>
                <li>YouTube Studio</li>
                <li>{t('seller.startBroadcast')}</li>
              </ol>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <a
            href={`/live/${createdStream.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            {t('seller.liveView')}
          </a>
          <button
            type="button"
            onClick={() => setCreatedStream(null)}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('seller.newBroadcastCreate')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* 즉시/예약 Toggle */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <label className="block text-sm font-semibold text-gray-800 mb-3">{t('seller.broadcastType')}</label>
        <div className="flex gap-3">
          {[
            { key: 'instant' as const, label: t('seller.instantStart'), icon: <Zap className="w-4 h-4" /> },
            { key: 'scheduled' as const, label: t('seller.scheduled'), icon: <CalendarClock className="w-4 h-4" /> },
          ].map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                mode === opt.key
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {mode === 'scheduled' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.scheduledTime')}</label>
            <input
              type="datetime-local"
              name="scheduledAt"
              value={formData.scheduledAt}
              onChange={handleChange}
              required={mode === 'scheduled'}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* YouTube 연동 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <label className="block text-sm font-semibold text-gray-800 mb-3">{t('seller.liveBroadcast')}</label>
        {youtubeConnected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('seller.youtubeLinked')}{youtubeChannelName ? `: @${youtubeChannelName}` : ''}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/seller/live-broadcast')}
                className="text-xs text-green-600 hover:text-green-800 font-medium"
              >
                {t('common.change')}
              </button>
            </div>
            {streamKey && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('seller.streamKey')}</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={streamKey}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(streamKey)
                      toast.success(t('seller.streamKeyCopied'))
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <Youtube className="w-4 h-4 text-red-500" />
              {t('seller.connectYouTubeAccount')}
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/api/seller/youtube/connect'
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors mb-3"
            >
              <Youtube className="w-4 h-4" />
              {t('seller.connectYouTube')}
            </button>
            <p className="text-xs text-gray-400 mb-2">{t('seller.orManualUrl')}</p>
            <input
              type="url"
              name="youtubeUrl"
              value={formData.youtubeUrl}
              onChange={handleChange}
              placeholder={t("seller.youtubeUrlPlaceholder")}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* {t('seller.selectSaleProducts')} */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          {t('seller.selectSaleProducts')}
          {selectedProductIds.length > 0 && (
            <span className="ml-2 text-blue-600 font-normal">{t('seller.selectedCount', { count: selectedProductIds.length })}</span>
          )}
        </label>

        {/* Product source tabs */}
        <div className="flex items-center gap-1 mb-3 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setProductTab('my')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              productTab === 'my'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('seller.myProducts')}
          </button>
          <button
            type="button"
            onClick={() => setProductTab('supply')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              productTab === 'supply'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('seller.supplyProducts')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/seller/products/new')}
            className="ml-auto flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('seller.newProduct')}
          </button>
        </div>

        {productsLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">{t('seller.loadingProducts')}</span>
          </div>
        ) : (productTab === 'my' ? products : supplyProducts).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {productTab === 'my' ? t('seller.noMyProducts') : t('seller.noSupplyProducts')}
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(productTab === 'my' ? products : supplyProducts).map(p => (
              <label
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                  selectedProductIds.includes(p.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(p.id)}
                  onChange={() => toggleProduct(p.id)}
                  className="rounded border-gray-300 text-blue-600"
                />
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.price.toLocaleString()}{t('common.won')}</p>
                </div>
                {selectedProductIds.includes(p.id) && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveProduct(p.id, 'up'); }}
                      disabled={selectedProductIds.indexOf(p.id) === 0}
                      className="p-0.5 rounded hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Up"
                    >
                      <ChevronUp className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveProduct(p.id, 'down'); }}
                      disabled={selectedProductIds.indexOf(p.id) === selectedProductIds.length - 1}
                      className="p-0.5 rounded hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Down"
                    >
                      <ChevronDown className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 방송 정보 */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <label className="block text-sm font-semibold text-gray-800">{t('seller.broadcastInfo')}</label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.broadcastTitleLabel')}</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder={t("seller.broadcastTitlePlaceholder")}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.broadcastDescLabel')}</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            placeholder={t("seller.broadcastDescPlaceholder")}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* SNS 링크 */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <label className="block text-sm font-semibold text-gray-800">{t('seller.snsLinks')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <Instagram className="w-3.5 h-3.5" />
              Instagram
            </label>
            <input
              type="text"
              name="sellerInstagram"
              value={formData.sellerInstagram}
              onChange={handleChange}
              placeholder="@username"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <Youtube className="w-3.5 h-3.5" />
              YouTube
            </label>
            <input
              type="text"
              name="sellerYoutube"
              value={formData.sellerYoutube}
              onChange={handleChange}
              placeholder="@channel"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 송출 플랫폼 선택 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <label className="block text-sm font-semibold text-gray-800 mb-3">{t('seller.broadcastPlatformLabel')}</label>
        <div className="space-y-2">
          {([
            { key: 'prism' as const, label: t('seller.prismLiveStudio'), desc: t('seller.prismRecommended'), color: 'text-purple-600' },
            { key: 'obs' as const, label: 'OBS Studio', desc: t('seller.obsAdvanced'), color: 'text-blue-600' },
            { key: 'youtube' as const, label: t('seller.youtubeStudioDirect'), desc: t('seller.youtubeStudioNoSoftware'), color: 'text-red-600' },
          ]).map(opt => (
            <label
              key={opt.key}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                broadcastPlatform === opt.key
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="broadcastPlatform"
                value={opt.key}
                checked={broadcastPlatform === opt.key}
                onChange={() => setBroadcastPlatform(opt.key)}
                className="text-blue-600"
              />
              <div>
                <p className={`text-sm font-medium ${broadcastPlatform === opt.key ? opt.color : 'text-gray-700'}`}>{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Platform-specific guide */}
        <div className="mt-4">
          {broadcastPlatform === 'prism' && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">{t('seller.prismLiveStudioFull')}</h4>
              <ol className="text-xs text-purple-800 space-y-1 list-decimal list-inside">
                <li>Prism Live (PC/iOS/Android)</li>
                <li>{'YouTube'}</li>
                <li>{t('seller.streamKey')}</li>
                <li>TikTok, Facebook</li>
                <li>{t('seller.startBroadcast')}</li>
              </ol>
              <p className="mt-2 text-xs text-purple-700">
                <strong>{t('seller.prismAdvantage')}</strong>
              </p>
            </div>
          )}
          {broadcastPlatform === 'obs' && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">{t('seller.obsStudioSetup')}</h4>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                <li>OBS Studio</li>
                <li>{'Settings > Stream > YouTube - RTMPS'}</li>
                <li>{t('seller.streamKey')}</li>
                <li>{t('seller.startBroadcast')}</li>
              </ol>
            </div>
          )}
          {broadcastPlatform === 'youtube' && (
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="text-sm font-semibold text-red-900 mb-2">{t('seller.youtubeStudioLabel')}</h4>
              <ol className="text-xs text-red-800 space-y-1 list-decimal list-inside">
                <li>YouTube Studio</li>
                <li>YouTube Studio</li>
                <li>{t('seller.startBroadcast')}</li>
              </ol>
              <p className="mt-2 text-xs text-red-700">
                {t('seller.youtubeStudioNoSoftwareNote')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !formData.title.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.processing')}
          </>
        ) : mode === 'scheduled' ? (
          <>
            <CalendarClock className="w-4 h-4" />
            {t('seller.scheduleAction')}
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            {t('seller.startBroadcast')}
          </>
        )}
      </button>
    </form>
  )
}

// ─── Tab 2: 방송 컨트롤 ──────────────────────────────────────────

function ControlTab({ token }: { token: string | null }) {
  const { t } = useTranslation()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingProduct, setChangingProduct] = useState(false)
  const [endingStream, setEndingStream] = useState(false)
  const [boostValue, setBoostValue] = useState('')
  const [viewerCounts, setViewerCounts] = useState<Record<number, number>>({})

  const loadData = useCallback(async () => {
    if (!token) return
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [streamsRes, productsRes] = await Promise.allSettled([
        api.get('/api/seller/streams?status=live', { headers }),
        api.get('/api/seller/products', { headers }),
      ])

      let allStreams: LiveStream[] = []
      if (streamsRes.status === 'fulfilled' && streamsRes.value.data?.success) {
        const data = streamsRes.value.data.data || []
        allStreams = data.filter((s: LiveStream) => s.status === 'live')
      }
      // Fallback: if filtering by query param doesn't work, fetch all and filter
      if (allStreams.length === 0 && streamsRes.status === 'fulfilled') {
        const allData = streamsRes.value.data?.data || []
        allStreams = allData.filter((s: LiveStream) => s.status === 'live')
      }

      setLiveStreams(allStreams)
      if (allStreams.length > 0 && !selectedStream) {
        setSelectedStream(allStreams[0])
        // Load boost from localStorage
        const saved = localStorage.getItem(`viewer_boost_${allStreams[0].id}`)
        if (saved) setBoostValue(saved)
      }

      if (productsRes.status === 'fulfilled' && productsRes.value.data?.success) {
        setProducts(productsRes.value.data.data || [])
      }
    } catch (err) {
      console.error('Failed to load control data:', err)
    } finally {
      setLoading(false)
    }
  }, [token, selectedStream])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Poll viewer counts
  useEffect(() => {
    if (liveStreams.length === 0) return

    const fetchCounts = async () => {
      const counts: Record<number, number> = {}
      for (const s of liveStreams) {
        try {
          const res = await api.get(`/api/streams/${s.id}/viewer-count`)
          if (res.data?.success) {
            counts[s.id] = res.data.data.viewer_count
          }
        } catch {
          // ignore
        }
      }
      setViewerCounts(counts)
    }

    fetchCounts()
    const interval = setInterval(fetchCounts, 10000)
    return () => clearInterval(interval)
  }, [liveStreams])

  async function changeProduct(productId: number) {
    if (!selectedStream || changingProduct) return
    setChangingProduct(true)
    try {
      await api.post(
        `/api/seller/streams/${selectedStream.id}/change-product`,
        { productId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSelectedStream(prev => prev ? { ...prev, current_product_id: productId } : null)
      toast.success(t('common.productChanged'))
    } catch (err: any) {
      toast.error(`${t('common.productChangeFailed')}: ${err.response?.data?.error || err.message}`)
    } finally {
      setChangingProduct(false)
    }
  }

  async function endStream() {
    if (!selectedStream) return
    if (!confirm(t('seller.endBroadcastConfirm'))) return
    setEndingStream(true)
    try {
      await api.patch(
        `/api/seller/streams/${selectedStream.id}`,
        { status: 'ended' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(t('seller.broadcastEnded'))
      localStorage.removeItem(`viewer_boost_${selectedStream.id}`)
      setSelectedStream(null)
      setLoading(true)
      await loadData()
    } catch (err: any) {
      toast.error(`${t('seller.broadcastEndFailed')}: ${err.response?.data?.error || err.message}`)
    } finally {
      setEndingStream(false)
    }
  }

  function applyBoost() {
    if (!selectedStream) return
    const val = parseInt(boostValue)
    if (isNaN(val) || val < 0) {
      toast.error(t('seller.enterAboveZero'))
      return
    }
    localStorage.setItem(`viewer_boost_${selectedStream.id}`, String(val))
    toast.success(t('seller.boostSet', { count: val }))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (liveStreams.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Radio className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 mb-1">{t('seller.noCurrentBroadcast')}</p>
        <p className="text-xs text-gray-400">{t('seller.startFromTab')}</p>
      </div>
    )
  }

  const currentProduct = selectedStream
    ? products.find(p => p.id === selectedStream.current_product_id)
    : null

  const displayViewerCount = selectedStream
    ? (viewerCounts[selectedStream.id] || 0) + (parseInt(localStorage.getItem(`viewer_boost_${selectedStream.id}`) || '0') || 0)
    : 0

  return (
    <div className="space-y-5">
      {/* Stream selector */}
      {liveStreams.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <select
            value={selectedStream?.id || ''}
            onChange={e => {
              const s = liveStreams.find(s => s.id === Number(e.target.value))
              setSelectedStream(s || null)
              if (s) {
                const saved = localStorage.getItem(`viewer_boost_${s.id}`)
                setBoostValue(saved || '')
              }
            }}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
          >
            {liveStreams.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      )}

      {selectedStream && (
        <>
          {/* Stream info */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{selectedStream.title}</h3>
              <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {displayViewerCount}{t('common.person')} {t('common.watching')}
              </span>
              {selectedStream.started_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatKSTTime(selectedStream.started_at)} {t('seller.startedAt')}
                </span>
              )}
            </div>
          </div>

          {/* Current product */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{t('seller.currentDisplayedProduct')}</h3>
            {currentProduct ? (
              <div className="border-2 border-blue-500 rounded-lg p-3">
                <p className="text-sm font-bold text-gray-900">{currentProduct.name}</p>
                <p className="text-sm font-semibold text-blue-600 mt-1">{currentProduct.price.toLocaleString()}{t('common.won')}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">{t('seller.noCurrentProduct')}</p>
            )}

            {/* Product selector */}
            <div className="mt-4">
              <label className="block text-xs text-gray-500 mb-2">{t('seller.changeProduct')}</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => changeProduct(p.id)}
                    disabled={changingProduct || p.id === selectedStream.current_product_id}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      p.id === selectedStream.current_product_id
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                    } ${changingProduct ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="truncate block">{p.name}</span>
                    <span className="text-xs text-gray-400">{p.price.toLocaleString()}{t('common.won')}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Viewer boost */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              {t('seller.viewerBoost')}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {t('seller.currentRealViewers')}: {viewerCounts[selectedStream.id] || 0}{t('common.person')}
              {localStorage.getItem(`viewer_boost_${selectedStream.id}`) && (
                <span className="ml-1 text-blue-600">
                  (+ {localStorage.getItem(`viewer_boost_${selectedStream.id}`)} {t('seller.boost')})
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={boostValue}
                onChange={e => setBoostValue(e.target.value)}
                placeholder={t("seller.boostCount")}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={applyBoost}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t('common.apply')}
              </button>
            </div>
          </div>

          {/* End stream */}
          <button
            onClick={endStream}
            disabled={endingStream}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {endingStream ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.ending')}
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                {t('seller.endBroadcast')}
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Tab 3: 방송 기록 ────────────────────────────────────────────

function HistoryTab({ token }: { token: string | null }) {
  const { t } = useTranslation()
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null)

  useEffect(() => {
    if (!token) return
    api.get('/api/seller/streams', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (res.data?.success) {
          setStreams(res.data.data || [])
        }
      })
      .catch(err => {
        console.error('Failed to load streams:', err)
      })
      .finally(() => setLoading(false))
  }, [token])

  function getStatusBadge(status: string) {
    switch (status) {
      case 'live':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />LIVE</span>
      case 'scheduled':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" />{t('common.scheduled')}</span>
      case 'ended':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{t('common.ended')}</span>
      default:
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{status}</span>
    }
  }

  function getDuration(stream: LiveStream): string {
    const start = stream.started_at || stream.created_at
    const end = stream.ended_at
    if (!start) return '-'
    const s = new Date(start).getTime()
    const e = end ? new Date(end).getTime() : Date.now()
    const diffMin = Math.round((e - s) / 60000)
    if (diffMin < 60) return `${diffMin}${t('common.minutes')}`
    const hours = Math.floor(diffMin / 60)
    const mins = diffMin % 60
    return `${hours}h ${mins}m`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (streams.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 mb-1">{t('seller.noBroadcastHistory')}</p>
        <p className="text-xs text-gray-400">{t('seller.startFirstLive')}</p>
      </div>
    )
  }

  // Detail view
  if (selectedStream) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedStream(null)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          &larr; {t('seller.backToListShort')}
        </button>
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{selectedStream.title}</h3>
            {getStatusBadge(selectedStream.status)}
          </div>
          {selectedStream.description && (
            <p className="text-sm text-gray-600">{selectedStream.description}</p>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{t('common.date')}</p>
              <p className="font-medium text-gray-800">{formatKSTDate(selectedStream.created_at || null)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{t('common.time')}</p>
              <p className="font-medium text-gray-800">{formatKSTTime(selectedStream.started_at || selectedStream.created_at || null)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{t('seller.broadcastDuration')}</p>
              <p className="font-medium text-gray-800">{getDuration(selectedStream)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{t('common.viewers')}</p>
              <p className="font-medium text-gray-800">{selectedStream.viewer_count ?? '-'}{t('common.person')}</p>
            </div>
          </div>
          {selectedStream.youtube_url && (
            <a
              href={selectedStream.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <Youtube className="w-4 h-4" />
              {t('common.viewOnYouTube')}
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {streams.map(stream => (
        <button
          key={stream.id}
          onClick={() => setSelectedStream(stream)}
          className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900 truncate flex-1 mr-3">{stream.title}</h4>
            {getStatusBadge(stream.status)}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{formatKSTDate(stream.created_at || null)}</span>
            <span>{getDuration(stream)}</span>
            {stream.viewer_count !== undefined && stream.viewer_count > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {stream.viewer_count}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
