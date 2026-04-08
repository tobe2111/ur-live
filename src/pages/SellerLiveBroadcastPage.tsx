import { useTranslation } from 'react-i18next'
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
  Key
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
  youtube_broadcast_id?: string
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

// 스텝 가이드 컴포넌트
function Step({ num, text, done }: { num: string; text: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{num}</span>
      <p className="text-sm text-gray-700">{text}</p>
    </div>
  )
}

export default function SellerLiveBroadcastPage() {
  const { t } = useTranslation()
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

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

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
      const [channelsRes, productsRes, streamsRes] = await Promise.allSettled([
        api.get('/api/seller/youtube/channels'),
        api.get('/api/seller/products'),
        api.get('/api/seller/streams'),
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
    } catch (error: any) {
      console.error('[LiveBroadcast] Failed to load data:', error)
      setLoadError(t('common.dataLoadFailed'))
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
        const errMsg = response.data.error || t('seller.youtubeApiNotConfigured')
        toast.error(t('seller.youtubeApiNotConfigured'))
      }
    } catch (error: any) {
      console.error('Failed to get auth URL:', error)
      const errMsg = error.response?.data?.error || error.message || ''
      toast.error(t('common.disconnectFailed'))
    } finally {
      setConnectingYouTube(false)
    }
  }

  async function createLiveStream() {
    if (!title.trim()) {
      toast.error(t('seller.broadcastTitleRequired'))
      return
    }

    if (selectedProducts.length === 0) {
      toast.error(t('seller.selectMinProducts'))
      return
    }

    try {
      setCreating(true)

      let scheduledStartTime = new Date().toISOString()
      if (isScheduled && scheduledDate && scheduledTime) {
        scheduledStartTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        product_ids: selectedProducts,
        scheduled_start_time: scheduledStartTime
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
        const errMsg = response.data.error || t('seller.broadcastCreateFailed')
        if (response.data.error_code === 'YOUTUBE_AUTH_REQUIRED') {
          toast.error(t('seller.youtubeAuthRequired'))
        } else if (response.data.error === 'YouTube API not configured') {
          toast.error(t('seller.youtubeApiNotConfigured'))
        } else {
          toast.error(`${t('seller.broadcastCreateFailed')}: ${errMsg}`)
        }
      } else {
        // Empty response - API not configured or route mismatch
        console.warn('[LiveBroadcast] Empty response - checking YouTube API configuration')
        toast.error(t('seller.broadcastCreateFailed'))
      }
    } catch (error: any) {
      console.error('[LiveBroadcast] Failed to create stream:', error)
      if (error.response?.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
        toast.error(t('seller.youtubeAuthRequired'))
      } else {
        const errMsg = error.response?.data?.error || error.message || ''
        toast.error(t('seller.broadcastCreateFailed') + ': ' + errMsg)
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
        toast.success(t('seller.broadcastStarted'))
      } else {
        toast.error(t('seller.broadcastStartFailed') + ': ' + (res.data.error || ''))
      }
    } catch (error: any) {
      console.error('Failed to start stream:', error)
      toast.error(t('seller.broadcastStartFailed') + ': ' + (error.response?.data?.error || error.message))
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
            toast.success(`"${stream.title}" ${t('seller.broadcastAutoStarted')}`)
            await loadData()
            return
          }
        } catch {
          // Polling error는 무시
        }
      }
    }

    // 10초마다 상태 확인
    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [streams])

  async function endStream(streamId: number) {
    if (!confirm(t('seller.endBroadcastConfirm'))) return

    try {
      const res = await api.post(`/api/seller/youtube/live/${streamId}/end`)
      await loadData()
      setNewStream(null)
      if (res.data.success) {
        toast.success(t('seller.broadcastEnded'))
      } else {
        toast.error(t('seller.broadcastEndFailed') + ': ' + (res.data.error || ''))
      }
    } catch (error: any) {
      console.error('Failed to end stream:', error)
      toast.error(t('seller.broadcastEndFailed') + ': ' + (error.response?.data?.error || error.message))
    }
  }

  async function disconnectYouTube(channelId: number) {
    if (!confirm(t('seller.disconnectConfirm'))) return

    try {
      await api.delete(`/api/seller/youtube/oauth/${channelId}`)
      await loadData()
    } catch (error) {
      console.error('Failed to disconnect:', error)
      toast.error(t('common.disconnectFailed'))
    }
  }

  function copyRTMP() {
    if (!newStream?.rtmp_url || !newStream?.rtmp_key) return
    const rtmpText = `URL: ${newStream.rtmp_url}\nKey: ${newStream.rtmp_key}`
    navigator.clipboard.writeText(rtmpText)
    setCopiedRTMP(true)
    setTimeout(() => setCopiedRTMP(false), 2000)
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
          <p className="text-[17px] text-[#6e6e73]">{t('common.loading')}</p>
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
            {t('common.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SellerLayout title={t('seller.liveBroadcast')}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Step 0: YouTube 연동 필요 ── */}
        {channels.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Youtube className="h-7 w-7 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">YouTube 계정을 연동하세요</h2>
            <p className="text-sm text-gray-500 mb-6">라이브 방송을 시작하려면 YouTube 계정 연동이 필요합니다</p>
            <Button onClick={connectYouTube} disabled={connectingYouTube} className="bg-red-600 hover:bg-red-700 text-white px-6">
              {connectingYouTube ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Youtube className="h-4 w-4 mr-2" />}
              YouTube 연동하기
            </Button>
          </div>
        ) : (
          <>
            {/* ── 연동된 채널 (간결) ── */}
            <div className="flex items-center gap-3 bg-white rounded-xl p-4 border border-gray-200">
              {channels[0]?.channel_thumbnail ? (
                <img src={channels[0].channel_thumbnail} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><Youtube className="h-5 w-5 text-red-500" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{channels[0]?.channel_title}</p>
                <p className="text-xs text-gray-500">구독자 {channels[0]?.subscriber_count?.toLocaleString()}명</p>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">연동됨</span>
            </div>

            {/* ── 새 방송 생성 ── */}
            {!newStream && !showSetup && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6 text-center">
                  <h3 className="text-base font-bold text-gray-900 mb-1">새 라이브 방송</h3>
                  <p className="text-xs text-gray-500 mb-5">방송 방식을 선택하고 시작하세요</p>
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                    {[
                      { key: 'web' as const, icon: Monitor, label: 'YouTube Studio', desc: '가장 간편', color: 'text-red-600', bg: 'bg-red-50' },
                      { key: 'obs' as const, icon: VideoIcon, label: 'OBS Studio', desc: 'PC 방송', color: 'text-purple-600', bg: 'bg-purple-50' },
                      { key: 'prism' as const, icon: Smartphone, label: '프리즘', desc: '모바일', color: 'text-orange-600', bg: 'bg-orange-50' },
                    ].map(m => (
                      <button
                        key={m.key}
                        onClick={() => { setStreamingMethod(m.key); setShowSetup(true) }}
                        className="p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 transition-all text-center active:scale-[0.97]"
                      >
                        <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                          <m.icon className={`h-5 w-5 ${m.color}`} />
                        </div>
                        <p className="text-xs font-semibold text-gray-900">{m.label}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── 방송 설정 폼 ── */}
            {showSetup && !newStream && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-gray-900">방송 정보 입력</h3>
                  <button onClick={() => setShowSetup(false)} className="text-sm text-gray-500">취소</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">방송 제목 *</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예) 오늘의 맛집 라이브"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" maxLength={100} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="방송 내용을 간단히 소개해주세요" rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" maxLength={500} />
                  </div>
                  {/* 예약 */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">방송 예약</p>
                      <p className="text-xs text-gray-500">{isScheduled ? '예약 시간에 방송을 시작합니다' : '즉시 방송을 시작합니다'}</p>
                    </div>
                    <button onClick={() => setIsScheduled(!isScheduled)} className={`relative w-11 h-6 rounded-full transition-colors ${isScheduled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isScheduled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {isScheduled && (
                    <div className="flex gap-3">
                      <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  )}
                  {/* 상품 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">판매 상품 선택 *</label>
                    {products.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500 mb-2">등록된 상품이 없습니다</p>
                        <button onClick={() => navigate('/seller/products/new')} className="text-sm text-blue-600 font-medium">상품 등록하기 →</button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                        {products.filter((p: any) => !p.is_supply_product).map(p => (
                          <button key={p.id} onClick={() => toggleProduct(p.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                              selectedProducts.includes(p.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                            }`}>
                            {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                            <span className="truncate">{p.name}</span>
                            {selectedProducts.includes(p.id) && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 생성 버튼 */}
                  <Button onClick={createLiveStream} disabled={creating || !title.trim() || selectedProducts.length === 0}
                    className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base font-semibold">
                    {creating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Radio className="h-5 w-5 mr-2" />}
                    {creating ? '생성 중...' : '방송 생성하기'}
                  </Button>
                </div>
              </div>
            )}

            {/* ── 방송 생성 완료 → 가이드 ── */}
            {newStream && (
              <div className="bg-white rounded-2xl border-2 border-green-200 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <h3 className="text-base font-bold text-gray-900">방송 준비 완료!</h3>
                </div>

                {/* 방송 방식별 가이드 */}
                {streamingMethod === 'web' && (
                  <div className="space-y-3 mb-5">
                    <Step num="1" text="아래 버튼으로 YouTube Studio를 여세요" />
                    <Step num="2" text="YouTube Studio에서 '라이브 시작' 클릭" />
                    <Step num="✓" text="유어딜이 자동으로 감지합니다" done />
                    <Button onClick={async () => {
                      await startStream(newStream.id)
                      const vid = newStream.youtube_video_id || newStream.youtube_broadcast_id
                      window.open(vid ? `https://studio.youtube.com/video/${vid}/livestreaming` : 'https://studio.youtube.com/channel/UC/livestreaming', '_blank')
                    }} className="w-full bg-red-600 hover:bg-red-700 text-white h-11">
                      <ExternalLink className="h-4 w-4 mr-2" /> YouTube Studio 열기
                    </Button>
                  </div>
                )}

                {streamingMethod === 'obs' && (
                  <div className="space-y-3 mb-5">
                    {channels.some(ch => ch.has_persistent_key) ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" /> RTMP 설정 완료 — OBS에서 방송 시작만 클릭하세요!
                      </div>
                    ) : (
                      <>
                        <Step num="1" text="아래 RTMP 정보를 복사하세요" />
                        <Step num="2" text="OBS → 설정 → 방송 → 사용자 지정에 붙여넣기" />
                        <Step num="3" text="OBS에서 방송 시작 클릭" />
                        <Step num="✓" text="유어딜이 자동으로 감지합니다" done />
                      </>
                    )}
                    {newStream.rtmp_url && (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="flex gap-2">
                          <code className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-mono truncate">{newStream.rtmp_url}</code>
                          <button onClick={() => { navigator.clipboard.writeText(newStream.rtmp_url || ''); toast.success('URL 복사됨') }} className="px-2 py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100"><Copy className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="flex gap-2">
                          <code className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-mono truncate">{newStream.rtmp_key}</code>
                          <button onClick={() => { navigator.clipboard.writeText(newStream.rtmp_key || ''); toast.success('Key 복사됨') }} className="px-2 py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100"><Copy className="h-3.5 w-3.5" /></button>
                        </div>
                        <button onClick={copyRTMP} className="w-full py-2 bg-purple-600 text-white text-xs font-bold rounded-lg">
                          {copiedRTMP ? '✓ 복사됨!' : 'URL + Key 전체 복사'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {streamingMethod === 'prism' && (
                  <div className="space-y-3 mb-5">
                    {channels.some(ch => ch.has_persistent_key) ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" /> RTMP 설정 완료 — 프리즘에서 방송 시작만 누르세요!
                      </div>
                    ) : (
                      <>
                        <Step num="1" text="아래 RTMP 정보를 복사하세요" />
                        <Step num="2" text="프리즘 → 외부 RTMP → 붙여넣기 (최초 1회)" />
                        <Step num="3" text="프리즘에서 방송 시작 클릭" />
                        <Step num="✓" text="유어딜이 자동으로 감지합니다" done />
                      </>
                    )}
                    {newStream.rtmp_url && !channels.some(ch => ch.has_persistent_key) && (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="flex gap-2">
                          <code className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-mono truncate">{newStream.rtmp_url}</code>
                          <button onClick={() => { navigator.clipboard.writeText(newStream.rtmp_url || ''); toast.success('URL 복사됨') }} className="px-2 py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100"><Copy className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="flex gap-2">
                          <code className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-mono truncate">{newStream.rtmp_key}</code>
                          <button onClick={() => { navigator.clipboard.writeText(newStream.rtmp_key || ''); toast.success('Key 복사됨') }} className="px-2 py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100"><Copy className="h-3.5 w-3.5" /></button>
                        </div>
                        <button onClick={copyRTMP} className="w-full py-2 bg-orange-500 text-white text-xs font-bold rounded-lg">
                          {copiedRTMP ? '✓ 복사됨!' : 'URL + Key 전체 복사'}
                        </button>
                      </div>
                    )}
                    {newStream.rtmp_url && newStream.rtmp_key && !channels.some(ch => ch.has_persistent_key) && (
                      <PrismQRCode rtmpUrl={newStream.rtmp_url} rtmpKey={newStream.rtmp_key} streamTitle={newStream.title || ''} />
                    )}
                  </div>
                )}

                <button onClick={() => { setNewStream(null); setShowSetup(false); loadData() }} className="w-full py-2 text-sm text-gray-500 mt-2">
                  다른 방송 생성하기
                </button>
              </div>
            )}

            {/* ── 진행 중 / 예정 방송 ── */}
            {streams.filter(s => s.status !== 'ended').length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">진행 중인 방송</h3>
                <div className="space-y-3">
                  {streams.filter(s => s.status !== 'ended').map(stream => (
                    <div key={stream.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stream.status === 'live' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                          {stream.status === 'live' ? '● LIVE' : '예정'}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900 truncate flex-1">{stream.title}</h4>
                        {stream.status === 'live' && (
                          <span className="text-xs text-gray-500 flex items-center gap-1"><Eye className="h-3 w-3" />{stream.viewer_count}</span>
                        )}
                      </div>

                      {/* 상품 표시 모드 토글 */}
                      <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg mb-3">
                        <div>
                          <p className="text-xs font-medium text-gray-900">상품 표시</p>
                          <p className="text-[10px] text-gray-500">{(stream as any).product_display_mode === 'all' ? '전체 상품' : '현재 상품만'}</p>
                        </div>
                        <button onClick={async () => {
                          const newMode = (stream as any).product_display_mode === 'all' ? 'current_only' : 'all'
                          try {
                            await api.put(`/api/seller/streams/${stream.id}/product-display`, { mode: newMode }, { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })
                            toast.success(newMode === 'all' ? '전체 상품 표시' : '현재 상품만 표시')
                            ;(stream as any).product_display_mode = newMode
                            setStreams([...streams])
                          } catch { toast.error('변경 실패') }
                        }} className={`relative w-9 h-5 rounded-full transition-colors ${(stream as any).product_display_mode === 'all' ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(stream as any).product_display_mode === 'all' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>

                      <div className="flex gap-2">
                        {stream.status === 'scheduled' && (
                          <Button onClick={() => startStream(stream.id)} size="sm" className="bg-red-600 hover:bg-red-700 text-white flex-1">
                            <Radio className="h-3.5 w-3.5 mr-1" /> 방송 시작
                          </Button>
                        )}
                        {stream.status === 'live' && (
                          <>
                            <Button onClick={() => { setShowControlPanel(true); setNewStream(stream) }} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
                              <Settings className="h-3.5 w-3.5 mr-1" /> 관리
                            </Button>
                            <Button onClick={() => endStream(stream.id)} size="sm" variant="destructive" className="flex-1">종료</Button>
                          </>
                        )}
                        <a href={`/live/${stream.id}`} target="_blank" className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <ExternalLink className="h-4 w-4 text-gray-500" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 최근 방송 ── */}
            {streams.filter(s => s.status === 'ended').length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">최근 방송</h3>
                <div className="space-y-2">
                  {streams.filter(s => s.status === 'ended').slice(0, 5).map(stream => (
                    <div key={stream.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {stream.youtube_video_id && <img src={`https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{stream.title}</p>
                        <p className="text-xs text-gray-500">{stream.ended_at ? formatKSTDate(stream.ended_at) : ''}</p>
                      </div>
                      <a href={`/seller/live-analytics/${stream.id}`} className="text-xs text-blue-600 font-medium shrink-0">분석</a>
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
