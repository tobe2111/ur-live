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
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('start')

  const token = localStorage.getItem('seller_token')

  useEffect(() => {
    if (!token) {
      navigate('/seller/login')
    }
  }, [token, navigate])

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'start', label: '방송 시작', icon: <Play className="w-4 h-4" /> },
    { key: 'control', label: '방송 컨트롤', icon: <Radio className="w-4 h-4" /> },
    { key: 'history', label: '방송 기록', icon: <History className="w-4 h-4" /> },
  ]

  return (
    <SellerLayout title="라이브 방송">
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
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showObsGuide, setShowObsGuide] = useState(false)
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [youtubeChannelName, setYoutubeChannelName] = useState('')
  const [streamKey, setStreamKey] = useState('')
  const [broadcastPlatform, setBroadcastPlatform] = useState<'prism' | 'obs' | 'youtube'>('prism')
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return
    setProductsLoading(true)
    const headers = { Authorization: `Bearer ${token}` }

    Promise.allSettled([
      api.get('/api/seller/products?limit=100', { headers }),
      api.get('/api/seller/youtube/channels', { headers }),
      api.get('/api/seller/supply?status=approved', { headers }),
    ]).then(([prodRes, ytRes, supplyRes]) => {
      if (prodRes.status === 'fulfilled' && prodRes.value.data?.success) {
        setProducts(prodRes.value.data.data || [])
      }
      if (ytRes.status === 'fulfilled' && ytRes.value.data?.success) {
        const channels = ytRes.value.data.data || []
        if (channels.length > 0) {
          setYoutubeConnected(true)
          setYoutubeChannelName(channels[0].channel_name || channels[0].title || localStorage.getItem('youtube_channel_name') || '')
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
        setSupplyProducts(supplyRes.value.data.data || [])
      }
    }).finally(() => setProductsLoading(false))
  }, [token])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleProduct(id: number) {
    setSelectedProductIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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
        youtube_url: formData.youtubeUrl || null,
        scheduled_at: isScheduled ? formData.scheduledAt : null,
        status: isScheduled ? 'scheduled' : 'live',
        seller_instagram: formData.sellerInstagram || null,
        seller_youtube: formData.sellerYoutube || null,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        const streamId = response.data.data?.id
        // Link selected products
        if (streamId && selectedProductIds.size > 0) {
          await Promise.allSettled(
            Array.from(selectedProductIds).map(pid =>
              api.post(`/api/seller/products/${pid}/link-to-stream`,
                { stream_id: streamId },
                { headers: { Authorization: `Bearer ${token}` } }
              )
            )
          )
        }
        toast.success(isScheduled ? '방송이 예약되었습니다!' : '라이브가 시작되었습니다!')
        setFormData({ title: '', description: '', youtubeUrl: '', scheduledAt: '', sellerInstagram: '', sellerYoutube: '' })
        setSelectedProductIds(new Set())
      } else {
        setError(response.data.error || '생성 실패')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || '생성 실패')
    } finally {
      setLoading(false)
    }
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
        <label className="block text-sm font-semibold text-gray-800 mb-3">방송 유형</label>
        <div className="flex gap-3">
          {[
            { key: 'instant' as const, label: '즉시 시작', icon: <Zap className="w-4 h-4" /> },
            { key: 'scheduled' as const, label: '예약', icon: <CalendarClock className="w-4 h-4" /> },
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
            <label className="block text-sm font-medium text-gray-700 mb-1">예약 시간</label>
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
        <label className="block text-sm font-semibold text-gray-800 mb-3">YouTube 연동 설정</label>
        {youtubeConnected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>YouTube 연동됨{youtubeChannelName ? `: @${youtubeChannelName}` : ''}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/seller/settings/youtube')}
                className="text-xs text-green-600 hover:text-green-800 font-medium"
              >
                변경
              </button>
            </div>
            {streamKey && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">스트림 키</label>
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
                      toast.success('스트림 키가 복사되었습니다!')
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
              YouTube 계정을 연동해주세요
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/api/seller/youtube/connect'
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors mb-3"
            >
              <Youtube className="w-4 h-4" />
              YouTube 계정 연동하기
            </button>
            <p className="text-xs text-gray-400 mb-2">또는 수동으로 URL을 입력하세요</p>
            <input
              type="url"
              name="youtubeUrl"
              value={formData.youtubeUrl}
              onChange={handleChange}
              placeholder="https://www.youtube.com/watch?v=... 또는 라이브 URL"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* 판매 상품 선택 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          판매 상품 선택
          {selectedProductIds.size > 0 && (
            <span className="ml-2 text-blue-600 font-normal">{selectedProductIds.size}개 선택됨</span>
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
            내 상품
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
            공급 상품
          </button>
          <button
            type="button"
            onClick={() => navigate('/seller/products/new')}
            className="ml-auto flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            새 상품 등록
          </button>
        </div>

        {productsLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">상품 불러오는 중...</span>
          </div>
        ) : (productTab === 'my' ? products : supplyProducts).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {productTab === 'my' ? '등록된 상품이 없습니다' : '승인된 공급 상품이 없습니다'}
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(productTab === 'my' ? products : supplyProducts).map(p => (
              <label
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                  selectedProductIds.has(p.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedProductIds.has(p.id)}
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
                  <p className="text-xs text-gray-400">{p.price.toLocaleString()}원</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 방송 정보 */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <label className="block text-sm font-semibold text-gray-800">방송 정보</label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">방송 제목 *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="라이브 방송 제목을 입력하세요"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            placeholder="방송에 대한 설명을 입력하세요"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* SNS 링크 */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <label className="block text-sm font-semibold text-gray-800">SNS 링크 (선택)</label>
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
              placeholder="@username 또는 URL"
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
              placeholder="@channel 또는 URL"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* OBS/프리즘 가이드 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowObsGuide(!showObsGuide)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" />
            OBS / 프리즘 라이브 설정 가이드
          </span>
          {showObsGuide ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showObsGuide && (
          <div className="px-5 pb-5 space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">OBS Studio 설정</h4>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                <li>OBS Studio 실행</li>
                <li>{'설정 > 방송 > 서비스: YouTube - RTMPS'}</li>
                <li>스트림 키 입력</li>
                <li>&quot;방송 시작&quot; 클릭</li>
              </ol>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">프리즘 라이브 스튜디오 (추천)</h4>
              <ol className="text-xs text-purple-800 space-y-1 list-decimal list-inside">
                <li>프리즘 라이브 앱 설치 (PC/iOS/Android)</li>
                <li>{'외부 플랫폼 연동 > YouTube 선택'}</li>
                <li>스트림 키 입력</li>
                <li>동시 송출: TikTok, Facebook 등 추가 가능</li>
                <li>&quot;방송 시작&quot; 클릭</li>
              </ol>
              <p className="mt-2 text-xs text-purple-700">
                <strong>장점:</strong> 스마트폰으로도 가능, 동시 송출, 화면 꾸미기/자막 내장, 완전 무료
              </p>
            </div>
          </div>
        )}
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
            처리 중...
          </>
        ) : mode === 'scheduled' ? (
          <>
            <CalendarClock className="w-4 h-4" />
            예약하기
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            방송 시작
          </>
        )}
      </button>
    </form>
  )
}

// ─── Tab 2: 방송 컨트롤 ──────────────────────────────────────────

function ControlTab({ token }: { token: string | null }) {
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
      toast.success('상품이 변경되었습니다!')
    } catch (err: any) {
      toast.error(`상품 변경 실패: ${err.response?.data?.error || err.message}`)
    } finally {
      setChangingProduct(false)
    }
  }

  async function endStream() {
    if (!selectedStream) return
    if (!confirm('방송을 종료하시겠습니까?')) return
    setEndingStream(true)
    try {
      await api.patch(
        `/api/seller/streams/${selectedStream.id}`,
        { status: 'ended' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('방송이 종료되었습니다.')
      localStorage.removeItem(`viewer_boost_${selectedStream.id}`)
      setSelectedStream(null)
      setLoading(true)
      await loadData()
    } catch (err: any) {
      toast.error(`방송 종료 실패: ${err.response?.data?.error || err.message}`)
    } finally {
      setEndingStream(false)
    }
  }

  function applyBoost() {
    if (!selectedStream) return
    const val = parseInt(boostValue)
    if (isNaN(val) || val < 0) {
      toast.error('0 이상의 숫자를 입력하세요')
      return
    }
    localStorage.setItem(`viewer_boost_${selectedStream.id}`, String(val))
    toast.success(`시청자 수 부스트가 ${val}명으로 설정되었습니다`)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    )
  }

  if (liveStreams.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Radio className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 mb-1">현재 진행 중인 방송이 없습니다</p>
        <p className="text-xs text-gray-400">&quot;방송 시작&quot; 탭에서 새 라이브를 시작하세요</p>
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
                {displayViewerCount}명 시청
              </span>
              {selectedStream.started_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatKSTTime(selectedStream.started_at)} 시작
                </span>
              )}
            </div>
          </div>

          {/* Current product */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">현재 노출 상품</h3>
            {currentProduct ? (
              <div className="border-2 border-blue-500 rounded-lg p-3">
                <p className="text-sm font-bold text-gray-900">{currentProduct.name}</p>
                <p className="text-sm font-semibold text-blue-600 mt-1">{currentProduct.price.toLocaleString()}원</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">노출 중인 상품이 없습니다</p>
            )}

            {/* Product selector */}
            <div className="mt-4">
              <label className="block text-xs text-gray-500 mb-2">상품 변경</label>
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
                    <span className="text-xs text-gray-400">{p.price.toLocaleString()}원</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Viewer boost */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              시청자 수 부스트
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              현재 실제 시청자: {viewerCounts[selectedStream.id] || 0}명
              {localStorage.getItem(`viewer_boost_${selectedStream.id}`) && (
                <span className="ml-1 text-blue-600">
                  (+ {localStorage.getItem(`viewer_boost_${selectedStream.id}`)} 부스트)
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={boostValue}
                onChange={e => setBoostValue(e.target.value)}
                placeholder="부스트 수"
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={applyBoost}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                적용
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
                종료 중...
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                방송 종료
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
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" />예약됨</span>
      case 'ended':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">종료</span>
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
    if (diffMin < 60) return `${diffMin}분`
    const hours = Math.floor(diffMin / 60)
    const mins = diffMin % 60
    return `${hours}시간 ${mins}분`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    )
  }

  if (streams.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 mb-1">방송 기록이 없습니다</p>
        <p className="text-xs text-gray-400">첫 라이브를 시작해보세요</p>
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
          &larr; 목록으로
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
              <p className="text-xs text-gray-500 mb-1">날짜</p>
              <p className="font-medium text-gray-800">{formatKSTDate(selectedStream.created_at || null)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">시간</p>
              <p className="font-medium text-gray-800">{formatKSTTime(selectedStream.started_at || selectedStream.created_at || null)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">방송 시간</p>
              <p className="font-medium text-gray-800">{getDuration(selectedStream)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">시청자</p>
              <p className="font-medium text-gray-800">{selectedStream.viewer_count ?? '-'}명</p>
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
              YouTube에서 보기
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
