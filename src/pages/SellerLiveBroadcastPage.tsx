/**
 * Seller Live Broadcast Page
 * Prism-style zero-setup YouTube live streaming
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { formatKSTTime, formatKSTDate } from '@/utils/date'
import { Badge } from '@/components/ui/badge'
import SellerLayout from '@/components/SellerLayout'
import {
  Play,
  Youtube,
  Link as LinkIcon,
  Settings,
  Eye,
  Clock,
  Loader2,
  ExternalLink,
  Radio,
  VideoIcon,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  Monitor,
  Smartphone,
  Zap,
  Key,
  Plus,
  X,
  Wifi,
  WifiOff,
  Globe,
  Tv
} from 'lucide-react'
import { getSellerToken, isSellerAuthenticated } from '@/lib/seller-auth'
import WebStreaming from '@/components/streaming/WebStreaming'
import PrismQRCode from '@/components/streaming/PrismQRCode'
import LiveControlPanel from '@/components/streaming/LiveControlPanel'

interface YouTubeChannel {
  id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  google_email: string
  is_active: boolean
  default_rtmp_url?: string | null
  default_rtmp_key?: string | null
  has_persistent_key?: boolean
}

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  stock: number
  is_active: boolean
}

interface LiveStream {
  id: number
  title: string
  description: string
  youtube_video_id: string
  youtube_url?: string
  embed_url?: string
  rtmp_url?: string
  rtmp_key?: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count: number
  scheduled_at?: string
  started_at?: string
  ended_at?: string
}

interface RtmpDestination {
  id: number
  platform: string
  label: string
  rtmp_url: string
  rtmp_key: string
}

const PLATFORM_OPTIONS = [
  { value: 'tiktok', label: 'TikTok 라이브', icon: '🎵', color: 'bg-black text-white' },
  { value: 'instagram', label: 'Instagram 라이브', icon: '📸', color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' },
  { value: 'twitch', label: 'Twitch', icon: '🟣', color: 'bg-purple-600 text-white' },
  { value: 'facebook', label: '페이스북 라이브', icon: '📘', color: 'bg-blue-600 text-white' },
  { value: 'naver', label: '네이버 쇼핑라이브', icon: '🟢', color: 'bg-green-500 text-white' },
  { value: 'afreeca', label: '아프리카TV', icon: '🔵', color: 'bg-blue-500 text-white' },
  { value: 'kick', label: 'Kick', icon: '💚', color: 'bg-green-600 text-white' },
  { value: 'custom', label: '커스텀 RTMP', icon: '🔗', color: 'bg-gray-600 text-white' },
]

export default function SellerLiveBroadcastPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [showSetup, setShowSetup] = useState(false)
  const [newStream, setNewStream] = useState<LiveStream | null>(null)
  const [copiedRTMP, setCopiedRTMP] = useState(false)
  const [streamingMethod, setStreamingMethod] = useState<'web' | 'prism' | 'obs'>('web')
  const [showControlPanel, setShowControlPanel] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connectingYouTube, setConnectingYouTube] = useState(false)

  // Quick start state
  const [quickTitle, setQuickTitle] = useState('')
  const [quickCreating, setQuickCreating] = useState(false)
  const [quickProducts, setQuickProducts] = useState<number[]>([])
  const [showQuickProducts, setShowQuickProducts] = useState(false)

  // Multi-RTMP destinations state
  const [rtmpDestinations, setRtmpDestinations] = useState<RtmpDestination[]>([])
  const [showAddDest, setShowAddDest] = useState(false)
  const [destForm, setDestForm] = useState({ platform: 'tiktok', label: '', rtmp_url: '', rtmp_key: '' })
  const [savingDest, setSavingDest] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!isSellerAuthenticated()) {
      navigate('/seller/login')
      return
    }
    loadData()
  }, [navigate])

  async function loadData() {
    try {
      setLoading(true)
      setLoadError(null)

      // Load all data in parallel for faster loading
      const [channelsRes, productsRes, streamsRes, destRes] = await Promise.allSettled([
        api.get('/api/seller/youtube/channels'),
        api.get('/api/seller/products'),
        api.get('/api/seller/streams'),
        api.get('/api/seller/youtube/rtmp-destinations'),
      ])

      if (channelsRes.status === 'fulfilled' && channelsRes.value.data?.success) {
        setChannels(channelsRes.value.data.data || [])
      }

      if (productsRes.status === 'fulfilled' && productsRes.value.data?.success) {
        setProducts(productsRes.value.data.data || [])
      }

      if (streamsRes.status === 'fulfilled' && streamsRes.value.data?.success) {
        setStreams(streamsRes.value.data.data || [])
      }

      if (destRes.status === 'fulfilled' && destRes.value.data?.success) {
        setRtmpDestinations(destRes.value.data.data || [])
      }
    } catch (error: any) {
      console.error('[LiveBroadcast] Failed to load data:', error)
      setLoadError('데이터를 불러오는데 실패했습니다. 페이지를 새로고침해주세요.')
    } finally {
      setLoading(false)
    }
  }

  async function connectYouTube() {
    try {
      setConnectingYouTube(true)
      const response = await api.get('/api/seller/youtube/auth-url')
      if (response.data.success && response.data.data?.authUrl) {
        // Redirect to YouTube OAuth
        window.location.href = response.data.data.authUrl
      } else {
        const errMsg = response.data.error || 'YouTube 연동 URL을 가져오지 못했습니다.'
        toast.error(`YouTube 연동 실패: ${errMsg}\n\n관리자에게 문의해주세요 (YouTube API 설정 필요).`)
      }
    } catch (error: any) {
      console.error('Failed to get auth URL:', error)
      const errMsg = error.response?.data?.error || error.message || '알 수 없는 오류'
      toast.error(`YouTube 연동에 실패했습니다: ${errMsg}`)
    } finally {
      setConnectingYouTube(false)
    }
  }

  async function createLiveStream() {
    if (!title.trim()) {
      toast.error('방송 제목을 입력해주세요.')
      return
    }

    if (selectedProducts.length === 0) {
      toast.error('최소 1개 이상의 상품을 선택해주세요.')
      return
    }

    try {
      setCreating(true)

      const payload = {
        title: title.trim(),
        description: description.trim(),
        product_ids: selectedProducts,
        scheduled_start_time: new Date().toISOString()
      }

      const response = await api.post('/api/seller/youtube/live/create', payload)

      if (response.data?.success) {
        setNewStream(response.data.data)
        setShowSetup(false)
        setTitle('')
        setDescription('')
        setSelectedProducts([])
        await loadData()
      } else if (response.data) {
        const errMsg = response.data.error || '라이브 생성에 실패했습니다.'
        if (response.data.error_code === 'YOUTUBE_AUTH_REQUIRED') {
          toast.error('YouTube 연동이 필요합니다. 먼저 YouTube 계정을 연동해주세요.')
        } else if (response.data.error === 'YouTube API not configured') {
          toast.error('YouTube API가 설정되지 않았습니다.\n관리자에게 문의하여 YOUTUBE_CLIENT_ID 및 YOUTUBE_CLIENT_SECRET 설정을 요청하세요.')
        } else {
          toast.error(`라이브 생성 실패: ${errMsg}`)
        }
      } else {
        // Empty response - API not configured or route mismatch
        console.warn('[LiveBroadcast] Empty response - checking YouTube API configuration')
        toast.error('방송 생성에 실패했습니다. YouTube API 설정을 확인해주세요.\n\n관리자에게 문의하세요.')
      }
    } catch (error: any) {
      console.error('[LiveBroadcast] Failed to create stream:', error)
      if (error.response?.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
        toast.error('YouTube 연동이 필요합니다. 먼저 YouTube 계정을 연동해주세요.')
      } else {
        const errMsg = error.response?.data?.error || error.message || '알 수 없는 오류'
        toast.error('라이브 생성에 실패했습니다: ' + errMsg)
      }
    } finally {
      setCreating(false)
    }
  }

  async function startStream(streamId: number) {
    try {
      const res = await api.post(`/api/seller/youtube/live/${streamId}/start`)
      await loadData()
      if (res.data.success) {
        toast.success('방송이 시작되었습니다!')
      } else {
        toast.error('방송 시작 실패: ' + (res.data.error || '알 수 없는 오류'))
      }
    } catch (error: any) {
      console.error('Failed to start stream:', error)
      toast.error('방송 시작에 실패했습니다: ' + (error.response?.data?.error || error.message))
    }
  }

  // OBS/프리즘 방송 시 자동 상태 감지 (YouTube autoStart 연동)
  useEffect(() => {
    const scheduledStreams = streams.filter(s => s.status === 'scheduled')
    if (scheduledStreams.length === 0) return

    const pollStatus = async () => {
      for (const stream of scheduledStreams) {
        try {
          const res = await api.get(`/api/seller/youtube/live/${stream.id}/status`)
          if (res.data?.success && res.data.data?.synced) {
            // YouTube에서 자동으로 라이브 시작됨 → 데이터 리로드
            toast.success(`"${stream.title}" 방송이 자동으로 시작되었습니다!`)
            await loadData()
            return
          }
        } catch {
          // Polling error는 무시
        }
      }
    }

    // 5초마다 상태 확인 (빠른 감지)
    pollStatus()
    const interval = setInterval(pollStatus, 5000)
    return () => clearInterval(interval)
  }, [streams])

  async function endStream(streamId: number) {
    if (!confirm('방송을 종료하시겠습니까?')) return

    try {
      const res = await api.post(`/api/seller/youtube/live/${streamId}/end`)
      await loadData()
      setNewStream(null)
      if (res.data.success) {
        toast.success('방송이 종료되었습니다.')
      } else {
        toast.error('방송 종료 처리: ' + (res.data.error || '상태를 확인해주세요.'))
      }
    } catch (error: any) {
      console.error('Failed to end stream:', error)
      toast.error('방송 종료에 실패했습니다: ' + (error.response?.data?.error || error.message))
    }
  }

  async function disconnectYouTube(channelId: number) {
    if (!confirm('YouTube 연동을 해제하시겠습니까?')) return

    try {
      await api.delete(`/api/seller/youtube/oauth/${channelId}`)
      await loadData()
    } catch (error) {
      console.error('Failed to disconnect:', error)
      toast.error('연동 해제에 실패했습니다.')
    }
  }

  function copyRTMP() {
    if (!newStream?.rtmp_url || !newStream?.rtmp_key) return
    const rtmpText = `URL: ${newStream.rtmp_url}\nKey: ${newStream.rtmp_key}`
    navigator.clipboard.writeText(rtmpText)
    setCopiedRTMP(true)
    setTimeout(() => setCopiedRTMP(false), 2000)
  }

  // ── Quick create (one-click with persistent key) ──
  async function quickCreateStream() {
    if (!quickTitle.trim()) {
      toast.error('방송 제목을 입력해주세요.')
      return
    }
    if (quickProducts.length === 0) {
      toast.error('최소 1개 이상의 상품을 선택해주세요.')
      return
    }
    try {
      setQuickCreating(true)
      const res = await api.post('/api/seller/youtube/live/quick-create', {
        title: quickTitle.trim(),
        product_ids: quickProducts,
      })
      if (res.data?.success) {
        toast.success('방송이 생성되었습니다! OBS/프리즘에서 방송 시작을 누르세요.')
        setQuickTitle('')
        setQuickProducts([])
        setShowQuickProducts(false)
        await loadData()
      } else {
        toast.error(res.data?.error || '방송 생성에 실패했습니다.')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || '방송 생성에 실패했습니다.')
    } finally {
      setQuickCreating(false)
    }
  }

  // ── RTMP Destination Management ──
  async function addRtmpDestination() {
    if (!destForm.label.trim() || !destForm.rtmp_url.trim() || !destForm.rtmp_key.trim()) {
      toast.error('모든 필드를 입력해주세요.')
      return
    }
    try {
      setSavingDest(true)
      const res = await api.post('/api/seller/youtube/rtmp-destinations', destForm)
      if (res.data?.success) {
        toast.success('플랫폼이 추가되었습니다.')
        setShowAddDest(false)
        setDestForm({ platform: 'tiktok', label: '', rtmp_url: '', rtmp_key: '' })
        await loadData()
      }
    } catch {
      toast.error('추가에 실패했습니다.')
    } finally {
      setSavingDest(false)
    }
  }

  async function removeRtmpDestination(id: number) {
    if (!confirm('이 플랫폼 설정을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/seller/youtube/rtmp-destinations/${id}`)
      setRtmpDestinations(prev => prev.filter(d => d.id !== id))
      toast.success('삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  function toggleProduct(productId: number) {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#007aff] mx-auto mb-4" />
          <p className="text-[17px] text-[#6e6e73]">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-[17px] text-[#1d1d1f] mb-4">{loadError}</p>
          <Button onClick={loadData} className="bg-[#007aff] hover:bg-[#0051d5] text-white">
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SellerLayout title="YouTube 라이브 방송">
      <div className="max-w-[1280px] mx-auto">
        {/* YouTube Connection Status */}
        {channels.length === 0 ? (
          <div className="apple-card p-8 sm:p-12 text-center mb-8 bg-gradient-to-br from-red-50 to-orange-50">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Youtube className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-[24px] font-bold text-[#1d1d1f] mb-2">
              YouTube 계정 연동 필요
            </h2>
            <p className="text-[15px] text-[#6e6e73] mb-6 max-w-md mx-auto">
              YouTube 라이브 방송을 시작하려면 먼저 YouTube 계정을 연동해주세요.
              한 번만 인증하면 계속 사용할 수 있습니다.
            </p>
            <Button
              onClick={connectYouTube}
              disabled={connectingYouTube}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-[17px] font-semibold h-auto"
            >
              {connectingYouTube ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  연결 중...
                </>
              ) : (
                <>
                  <Youtube className="h-5 w-5 mr-2" />
                  YouTube 계정 연동하기
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Connected YouTube Channels */}
            <div className="mb-8">
              <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-4">
                연동된 YouTube 채널
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {channels.map(channel => (
                  <div key={channel.id} className="apple-card p-4 flex items-center gap-4">
                    {channel.channel_thumbnail ? (
                      <img
                        src={channel.channel_thumbnail}
                        alt=""
                        className="w-16 h-16 rounded-full flex-shrink-0 object-cover bg-[#f5f5f7]"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex-shrink-0 bg-red-100 flex items-center justify-center">
                        <Youtube className="h-8 w-8 text-red-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-semibold text-[#1d1d1f] truncate">
                        {channel.channel_title}
                      </h4>
                      <p className="text-[13px] text-[#6e6e73]">
                        구독자 {channel.subscriber_count.toLocaleString()}명
                      </p>
                    </div>
                    <button
                      onClick={() => disconnectYouTube(channel.id)}
                      className="p-2 text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-lg transition-colors"
                      title="연동 해제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 고정 RTMP 키 (OBS/프리즘 원클릭 설정) */}
            {channels.some(ch => ch.has_persistent_key) && (
              <div className="apple-card p-5 sm:p-6 mb-8 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Key className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1d1d1f]">내 고정 RTMP 설정</h3>
                    <p className="text-[12px] text-[#6e6e73]">OBS/프리즘에 한 번만 입력하면 매번 자동으로 연결됩니다</p>
                  </div>
                </div>
                {channels.filter(ch => ch.has_persistent_key).map(channel => (
                  <div key={channel.id} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide">서버 URL</label>
                      <div className="flex gap-2 mt-1">
                        <code className="flex-1 px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg text-[13px] font-mono truncate select-all">
                          {channel.default_rtmp_url}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(channel.default_rtmp_url || ''); toast.success('URL 복사됨') }}
                          className="px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#e5e5ea] transition-colors flex-shrink-0"
                          title="복사"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide">스트림 키</label>
                      <div className="flex gap-2 mt-1">
                        <code className="flex-1 px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg text-[13px] font-mono truncate select-all">
                          {channel.default_rtmp_key}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(channel.default_rtmp_key || ''); toast.success('키 복사됨') }}
                          className="px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#e5e5ea] transition-colors flex-shrink-0"
                          title="복사"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-purple-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      이 키는 영구적으로 사용 가능합니다. 방송마다 새로 입력할 필요 없습니다.
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Quick Start (persistent key users) ── */}
            {channels.some(ch => ch.has_persistent_key) && !showSetup && !newStream && (
              <div className="apple-card p-5 sm:p-6 mb-8 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#1d1d1f]">빠른 방송 시작</h3>
                    <p className="text-[12px] text-[#6e6e73]">OBS/프리즘에 RTMP 키가 설정되어 있다면, 제목만 입력하고 바로 시작하세요</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickTitle}
                    onChange={e => setQuickTitle(e.target.value)}
                    placeholder="방송 제목 입력..."
                    className="flex-1 px-4 py-3 bg-white border border-green-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-green-400"
                    maxLength={100}
                  />
                  <button
                    onClick={() => setShowQuickProducts(!showQuickProducts)}
                    className={`px-4 h-[46px] rounded-xl border text-[13px] font-medium shrink-0 transition-colors ${
                      quickProducts.length > 0
                        ? 'bg-green-100 border-green-300 text-green-700'
                        : 'bg-white border-green-200 text-gray-500 hover:border-green-400'
                    }`}
                  >
                    상품 {quickProducts.length > 0 ? `${quickProducts.length}개` : '선택'}
                  </button>
                  <Button
                    onClick={quickCreateStream}
                    disabled={quickCreating || !quickTitle.trim() || quickProducts.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 h-[46px] text-[14px] font-semibold shrink-0"
                  >
                    {quickCreating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Radio className="h-4 w-4 mr-1.5" />
                        생성
                      </>
                    )}
                  </Button>
                </div>

                {/* Quick product selector */}
                {showQuickProducts && (
                  <div className="mt-3 bg-white border border-green-200 rounded-xl p-3 max-h-[200px] overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {products.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setQuickProducts(prev =>
                            prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                          )}
                          className={`flex items-center gap-2 p-2 rounded-lg text-left text-[12px] transition-all border ${
                            quickProducts.includes(p.id)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-green-300'
                          }`}
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-100 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-800">{p.name}</p>
                            <p className="text-green-600 font-bold">{p.price.toLocaleString()}원</p>
                          </div>
                          {quickProducts.includes(p.id) && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-green-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  생성 후 OBS/프리즘에서 방송 시작만 누르세요.
                </p>
              </div>
            )}

            {/* ── Active Streams with Live Preview ── */}
            {streams.filter(s => s.status !== 'ended').length > 0 && (
              <div className="mb-8">
                <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-4">
                  진행 중인 방송
                </h3>
                <div className="space-y-4">
                  {streams.filter(s => s.status !== 'ended').map(stream => (
                    <div key={stream.id} className="apple-card overflow-hidden">
                      {/* Live Preview Embed */}
                      {stream.status === 'live' && stream.youtube_video_id && (
                        <div className="aspect-video bg-black">
                          <iframe
                            src={`https://www.youtube.com/embed/${stream.youtube_video_id}?autoplay=1&mute=1&controls=1&modestbranding=1`}
                            title={stream.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; encrypted-media; gyroscope"
                            allowFullScreen
                          />
                        </div>
                      )}

                      {/* Waiting for encoder indicator */}
                      {stream.status === 'scheduled' && (
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 flex items-center gap-3 border-b border-amber-200/50">
                          <div className="relative">
                            <Wifi className="h-5 w-5 text-amber-600" />
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-amber-800">인코더 연결 대기 중...</p>
                            <p className="text-[11px] text-amber-600">OBS/프리즘에서 방송 시작을 누르면 자동으로 라이브가 시작됩니다</p>
                          </div>
                        </div>
                      )}

                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-[17px] font-semibold text-[#1d1d1f]">
                                {stream.title}
                              </h4>
                              <Badge className={stream.status === 'live' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}>
                                {stream.status === 'live' ? '● LIVE' : '⏳ 대기'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-[13px] text-[#6e6e73]">
                              {stream.status === 'live' && (
                                <div className="flex items-center gap-1">
                                  <Eye className="h-3.5 w-3.5" />
                                  {stream.viewer_count.toLocaleString()}명 시청
                                </div>
                              )}
                              {stream.started_at && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  시작: {formatKSTTime(stream.started_at)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* RTMP info for scheduled streams */}
                        {stream.status === 'scheduled' && stream.rtmp_url && stream.rtmp_key && (
                          <div className="bg-[#f5f5f7] rounded-lg p-4 mb-4">
                            <p className="text-[11px] font-semibold text-[#6e6e73] mb-2">RTMP 설정 정보</p>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <code className="flex-1 px-2 py-1.5 bg-white border border-[#e5e5ea] rounded text-[12px] font-mono truncate">{stream.rtmp_url}</code>
                                <button onClick={() => { navigator.clipboard.writeText(stream.rtmp_url || ''); toast.success('URL 복사됨') }} className="px-2 py-1.5 bg-white border border-[#e5e5ea] rounded hover:bg-[#e5e5ea] transition-colors"><Copy className="h-3.5 w-3.5" /></button>
                              </div>
                              <div className="flex gap-2">
                                <code className="flex-1 px-2 py-1.5 bg-white border border-[#e5e5ea] rounded text-[12px] font-mono truncate">{stream.rtmp_key}</code>
                                <button onClick={() => { navigator.clipboard.writeText(stream.rtmp_key || ''); toast.success('키 복사됨') }} className="px-2 py-1.5 bg-white border border-[#e5e5ea] rounded hover:bg-[#e5e5ea] transition-colors"><Copy className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {stream.status === 'scheduled' && (
                            <Button onClick={() => startStream(stream.id)} className="bg-red-600 hover:bg-red-700 text-white">
                              <Radio className="h-4 w-4 mr-2" />
                              수동 방송 시작
                            </Button>
                          )}
                          {stream.status === 'live' && (
                            <>
                              <Button
                                onClick={() => { setShowControlPanel(true); setNewStream(stream) }}
                                className="bg-[#007aff] hover:bg-[#0051d5] text-white"
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                방송 관리
                              </Button>
                              <Button onClick={() => endStream(stream.id)} variant="destructive">
                                방송 종료
                              </Button>
                            </>
                          )}
                          <a href={stream.youtube_url || `https://youtube.com/watch?v=${stream.youtube_video_id}`} target="_blank" rel="noopener noreferrer"
                            className="px-4 py-2 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#f5f5f7] transition-colors flex items-center gap-2 text-[13px] font-medium">
                            <Youtube className="h-4 w-4 text-red-600" /> YouTube
                          </a>
                          <a href={`/live/${stream.id}`} target="_blank" rel="noopener noreferrer"
                            className="px-4 py-2 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#f5f5f7] transition-colors flex items-center gap-2 text-[13px] font-medium">
                            <Eye className="h-4 w-4" /> Ur Live
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Multi-Platform RTMP Destinations ── */}
            {channels.length > 0 && (
              <div className="apple-card p-5 sm:p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Globe className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-[#1d1d1f]">멀티 플랫폼 동시 송출</h3>
                      <p className="text-[12px] text-[#6e6e73]">OBS multi-rtmp 또는 프리즘에서 사용할 RTMP 대상을 관리하세요</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowAddDest(!showAddDest)}
                    variant="outline"
                    className="text-[13px] h-9"
                  >
                    {showAddDest ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
                    {showAddDest ? '닫기' : '플랫폼 추가'}
                  </Button>
                </div>

                {/* Add form */}
                {showAddDest && (
                  <div className="bg-[#f5f5f7] rounded-xl p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PLATFORM_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setDestForm(f => ({ ...f, platform: opt.value, label: opt.label }))}
                          className={`p-2.5 rounded-lg text-center text-[12px] font-medium transition-all border-2 ${
                            destForm.platform === opt.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-transparent bg-white hover:border-gray-300'
                          }`}
                        >
                          <span className="text-lg block mb-1">{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={destForm.label}
                      onChange={e => setDestForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="표시 이름 (예: 틱톡 메인 계정)"
                      className="w-full px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      value={destForm.rtmp_url}
                      onChange={e => setDestForm(f => ({ ...f, rtmp_url: e.target.value }))}
                      placeholder="RTMP 서버 URL (예: rtmp://live.tiktok.com/...)"
                      className="w-full px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      value={destForm.rtmp_key}
                      onChange={e => setDestForm(f => ({ ...f, rtmp_key: e.target.value }))}
                      placeholder="스트림 키"
                      className="w-full px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <Button
                      onClick={addRtmpDestination}
                      disabled={savingDest || !destForm.label.trim() || !destForm.rtmp_url.trim() || !destForm.rtmp_key.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10"
                    >
                      {savingDest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      저장
                    </Button>
                  </div>
                )}

                {/* Saved destinations */}
                {rtmpDestinations.length > 0 ? (
                  <div className="space-y-2">
                    {rtmpDestinations.map(dest => {
                      const platformInfo = PLATFORM_OPTIONS.find(p => p.value === dest.platform) || PLATFORM_OPTIONS[PLATFORM_OPTIONS.length - 1]
                      return (
                        <div key={dest.id} className="flex items-center gap-3 bg-white border border-[#e5e5ea] rounded-lg p-3">
                          <span className="text-xl">{platformInfo.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">{dest.label}</p>
                            <p className="text-[11px] text-[#6e6e73] font-mono truncate">{dest.rtmp_url}</p>
                          </div>
                          <button
                            onClick={() => { navigator.clipboard.writeText(`URL: ${dest.rtmp_url}\nKey: ${dest.rtmp_key}`); toast.success('RTMP 정보 복사됨') }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="RTMP 정보 복사"
                          >
                            <Copy className="h-4 w-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => removeRtmpDestination(dest.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  !showAddDest && (
                    <div className="text-center py-6 text-[#6e6e73]">
                      <Tv className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-[13px]">등록된 플랫폼이 없습니다</p>
                      <p className="text-[11px] mt-1">각 플랫폼 대시보드에서 RTMP URL과 스트림 키를 받아 추가하세요</p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* New Stream Success Modal */}
            {newStream && (
              <div className="apple-card p-6 sm:p-8 mb-8 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500/20">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[21px] font-bold text-[#1d1d1f] mb-2">
                      방송 준비 완료!
                    </h3>
                    <p className="text-[15px] text-[#6e6e73]">
                      방송 방식을 선택하고 스트리밍을 시작하세요.
                    </p>
                  </div>
                </div>

                {/* 방송 방식 선택 */}
                <div className="mb-6">
                  <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-3">
                    방송 방식 선택
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setStreamingMethod('web')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        streamingMethod === 'web'
                          ? 'border-[#007aff] bg-[#007aff]/5'
                          : 'border-[#e5e5ea] bg-white hover:border-[#007aff]/30'
                      }`}
                    >
                      <Monitor className="h-7 w-7 mx-auto mb-2 text-[#007aff]" />
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">브라우저</p>
                      <p className="text-[11px] text-[#6e6e73] mt-1">바로 시작</p>
                    </button>
                    <button
                      onClick={() => setStreamingMethod('obs')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        streamingMethod === 'obs'
                          ? 'border-[#007aff] bg-[#007aff]/5'
                          : 'border-[#e5e5ea] bg-white hover:border-[#007aff]/30'
                      }`}
                    >
                      <VideoIcon className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">OBS</p>
                      <p className="text-[11px] text-[#6e6e73] mt-1">자막/오버레이</p>
                    </button>
                    <button
                      onClick={() => setStreamingMethod('prism')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        streamingMethod === 'prism'
                          ? 'border-[#007aff] bg-[#007aff]/5'
                          : 'border-[#e5e5ea] bg-white hover:border-[#007aff]/30'
                      }`}
                    >
                      <Smartphone className="h-7 w-7 mx-auto mb-2 text-orange-600" />
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">프리즘</p>
                      <p className="text-[11px] text-[#6e6e73] mt-1">모바일 방송</p>
                    </button>
                  </div>
                </div>

                {/* 방송 방식별 가이드 */}
                <div className="space-y-4">

                  {/* 브라우저 방송 */}
                  {streamingMethod === 'web' && (
                    <div className="bg-white border border-[#e5e5ea] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Monitor className="h-5 w-5 text-[#007aff]" />
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">브라우저에서 바로 방송</h4>
                      </div>
                      <p className="text-[13px] text-[#6e6e73] mb-4">
                        별도 프로그램 없이 웹캠으로 바로 방송합니다. 가장 간편한 방법입니다.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => startStream(newStream.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 text-[15px] font-semibold"
                        >
                          <Radio className="h-5 w-5 mr-2" />
                          방송 시작
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* OBS 방송 */}
                  {streamingMethod === 'obs' && (
                    <div className="bg-white border border-[#e5e5ea] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <VideoIcon className="h-5 w-5 text-purple-600" />
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">OBS Studio로 방송</h4>
                      </div>

                      {channels.some(ch => ch.has_persistent_key) ? (
                        <>
                          {/* 고정 키가 있으면 간단 안내만 */}
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <p className="text-[13px] font-semibold text-green-800">RTMP 설정 완료</p>
                            </div>
                            <p className="text-[13px] text-green-700">
                              OBS에 이미 RTMP 키가 설정되어 있다면, OBS에서 <strong>방송 시작</strong>만 클릭하세요.
                              자동으로 라이브가 시작됩니다.
                            </p>
                          </div>

                          {/* 동시 송출 가이드 */}
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">멀티 플랫폼 동시 송출</p>
                            <p className="text-[12px] text-[#6e6e73] mb-3">
                              <strong>obs-multi-rtmp</strong> 플러그인(무료)을 설치하면 여러 플랫폼에 동시 송출할 수 있습니다.
                            </p>
                            <p className="text-[11px] font-semibold text-[#1d1d1f] mb-1.5">송출 가능 플랫폼 (RTMP 키 필요)</p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#6e6e73]">
                              <span>• TikTok 라이브</span>
                              <span>• Instagram 라이브</span>
                              <span>• Twitch</span>
                              <span>• 페이스북 라이브</span>
                              <span>• 카카오TV</span>
                              <span>• 네이버 쇼핑라이브</span>
                              <span>• 아프리카TV</span>
                              <span>• X (트위터) 라이브</span>
                              <span>• Kick</span>
                              <span>• LinkedIn 라이브</span>
                            </div>
                            <p className="text-[11px] text-purple-600 mt-2">
                              각 플랫폼 대시보드에서 RTMP URL + 키를 받아 OBS에 추가하세요.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 처음 설정 가이드 */}
                          <p className="text-[13px] text-[#6e6e73] mb-4">
                            자막, 로고, 오버레이 등을 자유롭게 설정할 수 있습니다.
                          </p>
                          <div className="bg-[#f5f5f7] rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">최초 1회 설정</p>
                            <ol className="text-[13px] text-[#6e6e73] space-y-1.5 list-decimal list-inside">
                              <li>OBS 실행 → 설정 → 방송</li>
                              <li>서비스: <strong>사용자 지정</strong> 선택</li>
                              <li>아래 서버 URL과 스트림 키를 붙여넣기</li>
                              <li>다음 방송부터는 OBS에서 <strong>방송 시작</strong>만 클릭!</li>
                            </ol>
                          </div>

                          {/* 동시 송출 가이드 */}
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">멀티 플랫폼 동시 송출</p>
                            <p className="text-[12px] text-[#6e6e73] mb-3">
                              <strong>obs-multi-rtmp</strong> 플러그인(무료)을 설치하면 여러 플랫폼에 동시 송출할 수 있습니다.
                            </p>
                            <p className="text-[11px] font-semibold text-[#1d1d1f] mb-1.5">송출 가능 플랫폼 (각 플랫폼에서 RTMP 키 발급)</p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#6e6e73]">
                              <span>• TikTok 라이브</span>
                              <span>• Instagram 라이브</span>
                              <span>• Twitch</span>
                              <span>• 페이스북 라이브</span>
                              <span>• 카카오TV</span>
                              <span>• 네이버 쇼핑라이브</span>
                              <span>• 아프리카TV</span>
                              <span>• X (트위터) 라이브</span>
                              <span>• Kick</span>
                              <span>• LinkedIn 라이브</span>
                            </div>
                            <p className="text-[11px] text-purple-600 mt-2">
                              각 플랫폼 대시보드에서 RTMP URL + 키를 받아 OBS에 추가하세요.
                            </p>
                          </div>

                          {/* RTMP 정보 */}
                          <div className="space-y-3 mb-4">
                            <div>
                              <label className="text-[11px] font-semibold text-[#6e6e73]">서버 URL</label>
                              <div className="flex gap-2 mt-1">
                                <code className="flex-1 px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg text-[13px] font-mono truncate">
                                  {newStream.rtmp_url}
                                </code>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(newStream.rtmp_url || ''); toast.success('복사됨') }}
                                  className="px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg hover:bg-[#e5e5ea] transition-colors"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-[#6e6e73]">스트림 키</label>
                              <div className="flex gap-2 mt-1">
                                <code className="flex-1 px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg text-[13px] font-mono truncate">
                                  {newStream.rtmp_key}
                                </code>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(newStream.rtmp_key || ''); toast.success('복사됨') }}
                                  className="px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg hover:bg-[#e5e5ea] transition-colors"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-purple-600 flex items-center gap-1">
                              <Key className="h-3 w-3" />
                              이 키는 영구적입니다. 한 번 입력하면 다시 입력할 필요 없습니다.
                            </p>
                          </div>
                        </>
                      )}

                      <div className="flex gap-3">
                        <Button
                          onClick={() => startStream(newStream.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 text-[15px] font-semibold"
                        >
                          <Radio className="h-5 w-5 mr-2" />
                          방송 시작
                        </Button>
                        <a
                          href={newStream.youtube_url || `https://youtube.com/watch?v=${newStream.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 flex items-center gap-2 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#f5f5f7] transition-colors text-[13px] font-medium"
                        >
                          <ExternalLink className="h-4 w-4" />
                          YouTube
                        </a>
                      </div>
                    </div>
                  )}

                  {/* 프리즘 방송 */}
                  {streamingMethod === 'prism' && (
                    <div className="bg-white border border-[#e5e5ea] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Smartphone className="h-5 w-5 text-orange-600" />
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">프리즘 라이브로 방송</h4>
                      </div>

                      {channels.some(ch => ch.has_persistent_key) ? (
                        <>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <p className="text-[13px] font-semibold text-green-800">RTMP 설정 완료</p>
                            </div>
                            <p className="text-[13px] text-green-700">
                              프리즘에 이미 RTMP 키가 설정되어 있다면, 프리즘에서 <strong>방송 시작</strong>만 하세요.
                              자동으로 라이브가 시작됩니다.
                            </p>
                          </div>

                          <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">멀티 플랫폼 동시 송출 (무료)</p>
                            <p className="text-[12px] text-[#6e6e73] mb-2">
                              프리즘 앱 설정에서 플랫폼 계정을 연동하면 동시 송출됩니다.
                            </p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#6e6e73]">
                              <span>• TikTok 라이브</span>
                              <span>• Instagram 라이브</span>
                              <span>• Twitch</span>
                              <span>• 페이스북 라이브</span>
                              <span>• 카카오TV</span>
                              <span>• 네이버 쇼핑라이브</span>
                              <span>• 아프리카TV</span>
                              <span>• X (트위터) 라이브</span>
                            </div>
                            <p className="text-[11px] text-orange-600 mt-2">
                              프리즘 앱 → 설정 → 플랫폼 추가에서 계정 연동 또는 외부 RTMP 추가
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-[13px] text-[#6e6e73] mb-4">
                            스마트폰에서 간편하게 방송합니다. 오버레이, 꾸미기, 동시 송출 기능을 지원합니다.
                          </p>

                          <div className="bg-[#f5f5f7] rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">최초 1회 설정</p>
                            <ol className="text-[13px] text-[#6e6e73] space-y-1.5 list-decimal list-inside">
                              <li>QR 코드를 스캔하거나 아래 RTMP 정보를 복사</li>
                              <li>프리즘 앱 → 외부 RTMP → 붙여넣기</li>
                              <li>다음 방송부터는 프리즘에서 <strong>방송 시작</strong>만!</li>
                            </ol>
                          </div>

                          <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">멀티 플랫폼 동시 송출 (무료)</p>
                            <p className="text-[12px] text-[#6e6e73] mb-2">
                              프리즘 앱에서 계정 연동 또는 외부 RTMP로 동시 송출이 가능합니다.
                            </p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#6e6e73]">
                              <span>• TikTok 라이브</span>
                              <span>• Instagram 라이브</span>
                              <span>• Twitch</span>
                              <span>• 페이스북 라이브</span>
                              <span>• 카카오TV</span>
                              <span>• 네이버 쇼핑라이브</span>
                              <span>• 아프리카TV</span>
                              <span>• X (트위터) 라이브</span>
                            </div>
                            <p className="text-[11px] text-orange-600 mt-2">
                              프리즘 앱 → 설정 → 플랫폼 추가에서 계정 연동 또는 외부 RTMP 추가
                            </p>
                          </div>
                        </>
                      )}

                      {newStream.rtmp_url && newStream.rtmp_key && !channels.some(ch => ch.has_persistent_key) && (
                        <PrismQRCode
                          rtmpUrl={newStream.rtmp_url}
                          rtmpKey={newStream.rtmp_key}
                          streamTitle={newStream.title}
                        />
                      )}
                    </div>
                  )}

                  {/* 닫기 버튼 */}
                  <Button
                    onClick={() => setNewStream(null)}
                    variant="outline"
                    className="w-full h-10"
                  >
                    닫기
                  </Button>
                </div>
              </div>
            )}

            {/* Create Live Stream Section */}
            {!showSetup && !newStream && (
              <div className="apple-card p-6 sm:p-8 mb-8">
                <h2 className="text-[24px] font-bold text-[#1d1d1f] mb-2 text-center">
                  새 라이브 방송 시작
                </h2>
                <p className="text-[14px] text-[#6e6e73] mb-6 text-center">
                  방송 방식을 선택하고 시작하세요
                </p>

                {/* 방송 방식 선택 */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <button
                    onClick={() => { setStreamingMethod('web'); setShowSetup(true) }}
                    className="p-5 rounded-xl border-2 border-[#e5e5ea] bg-white hover:border-[#007aff] hover:bg-[#007aff]/5 transition-all text-center"
                  >
                    <Monitor className="h-8 w-8 mx-auto mb-2 text-[#007aff]" />
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">브라우저</p>
                    <p className="text-[11px] text-[#6e6e73] mt-1">웹캠으로 바로 시작</p>
                  </button>
                  <button
                    onClick={() => { setStreamingMethod('obs'); setShowSetup(true) }}
                    className="p-5 rounded-xl border-2 border-[#e5e5ea] bg-white hover:border-purple-500 hover:bg-purple-50 transition-all text-center"
                  >
                    <VideoIcon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">OBS Studio</p>
                    <p className="text-[11px] text-[#6e6e73] mt-1">자막/오버레이/동시송출</p>
                  </button>
                  <button
                    onClick={() => { setStreamingMethod('prism'); setShowSetup(true) }}
                    className="p-5 rounded-xl border-2 border-[#e5e5ea] bg-white hover:border-orange-500 hover:bg-orange-50 transition-all text-center"
                  >
                    <Smartphone className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">프리즘 라이브</p>
                    <p className="text-[11px] text-[#6e6e73] mt-1">모바일/동시송출</p>
                  </button>
                </div>
              </div>
            )}

            {/* Setup Form */}
            {showSetup && !newStream && (
              <div className="apple-card p-6 sm:p-8 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="text-[21px] font-bold text-[#1d1d1f]">
                    방송 정보 입력
                  </h3>
                  <Badge className={`text-[12px] ${
                    streamingMethod === 'web' ? 'bg-[#007aff] text-white' :
                    streamingMethod === 'obs' ? 'bg-purple-600 text-white' :
                    'bg-orange-500 text-white'
                  }`}>
                    {streamingMethod === 'web' ? '브라우저' : streamingMethod === 'obs' ? 'OBS' : '프리즘'}
                  </Badge>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-2">
                      방송 제목 *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="예: 신상품 특가 라이브!"
                      className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-2">
                      방송 설명
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="방송에 대한 간단한 설명을 입력하세요"
                      className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007aff] resize-none"
                      rows={4}
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-3">
                      판매 상품 선택 *
                    </label>
                    {products.length === 0 ? (
                      <div className="text-center py-8 text-[#6e6e73]">
                        <p className="mb-3">등록된 상품이 없습니다</p>
                        <Button
                          onClick={() => navigate('/seller/products/new')}
                          variant="outline"
                        >
                          상품 등록하기
                        </Button>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                        {products.map(product => (
                          <button
                            key={product.id}
                            onClick={() => toggleProduct(product.id)}
                            className={`
                              p-4 rounded-lg border-2 transition-all text-left
                              ${selectedProducts.includes(product.id)
                                ? 'border-[#007aff] bg-[#007aff]/5'
                                : 'border-[#e5e5ea] bg-white hover:border-[#007aff]/30'
                              }
                            `}
                          >
                            <div className="flex gap-3">
                              {product.image_url && product.image_url.trim() !== '' ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                    const placeholder = e.currentTarget.nextElementSibling as HTMLElement
                                    if (placeholder) placeholder.style.display = 'flex'
                                  }}
                                />
                              ) : null}
                              <div
                                className="w-16 h-16 rounded-lg bg-[#f5f5f7] flex-shrink-0 items-center justify-center"
                                style={{ display: (product.image_url && product.image_url.trim() !== '') ? 'none' : 'flex' }}
                              >
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                                  {product.name}
                                </h4>
                                <p className="text-[15px] font-bold text-[#007aff]">
                                  {product.price.toLocaleString()}원
                                </p>
                                <p className="text-[11px] text-[#6e6e73]">
                                  재고: {product.stock}개
                                </p>
                              </div>
                              {selectedProducts.includes(product.id) && (
                                <CheckCircle2 className="h-5 w-5 text-[#007aff] flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[13px] text-[#6e6e73] mt-2">
                      선택된 상품: {selectedProducts.length}개
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={createLiveStream}
                      disabled={creating || !title.trim() || selectedProducts.length === 0}
                      className="flex-1 bg-[#007aff] hover:bg-[#0051d5] text-white h-12 text-[15px] font-semibold"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5 mr-2" />
                          방송 생성하기
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowSetup(false)}
                      variant="outline"
                      className="px-8 h-12"
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Streams */}
            {streams.filter(s => s.status === 'ended').length > 0 && (
              <div>
                <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-4">
                  지난 방송
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {streams.filter(s => s.status === 'ended').slice(0, 4).map(stream => (
                    <div key={stream.id} className="apple-card p-4">
                      <h4 className="text-[15px] font-semibold text-[#1d1d1f] mb-2">
                        {stream.title}
                      </h4>
                      <div className="flex items-center gap-3 text-[13px] text-[#6e6e73] mb-3">
                        <div className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {stream.viewer_count.toLocaleString()}
                        </div>
                        {stream.ended_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatKSTDate(stream.ended_at)}
                          </div>
                        )}
                      </div>
                      <a
                        href={stream.youtube_url || `https://youtube.com/watch?v=${stream.youtube_video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-[#007aff] hover:opacity-60 transition-opacity flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        다시보기
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SellerLayout>
  )
}
