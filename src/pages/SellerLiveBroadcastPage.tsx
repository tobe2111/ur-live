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
      <div className="max-w-[1280px] mx-auto">
        {/* YouTube Connection Status */}
        {channels.length === 0 ? (
          <div className="apple-card p-8 sm:p-12 text-center mb-8 bg-gradient-to-br from-red-50 to-orange-50">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Youtube className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-[24px] font-bold text-[#1d1d1f] mb-2">
              {t('seller.youtubeAccountNeeded')}
            </h2>
            <p className="text-[15px] text-[#6e6e73] mb-6 max-w-md mx-auto">
              {t('seller.youtubeAccountNeededDesc')}
            </p>
            <Button
              onClick={connectYouTube}
              disabled={connectingYouTube}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-[17px] font-semibold h-auto"
            >
              {connectingYouTube ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {t('common.connecting')}
                </>
              ) : (
                <>
                  <Youtube className="h-5 w-5 mr-2" />
                  {t('seller.connectYouTube')}
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Connected YouTube Channels */}
            <div className="mb-8">
              <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-4">
                {t('seller.linkedYouTubeChannels')}
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
                        {t('seller.subscribers')} {channel.subscriber_count.toLocaleString()}{t('common.person')}
                      </p>
                    </div>
                    <button
                      onClick={() => disconnectYouTube(channel.id)}
                      className="p-2 text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-lg transition-colors"
                      title={t("seller.disconnect")}
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
                    <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{t('seller.persistentRtmpSettings')}</h3>
                    <p className="text-[12px] text-[#6e6e73]">{t('seller.persistentRtmpDesc')}</p>
                  </div>
                </div>
                {channels.filter(ch => ch.has_persistent_key).map(channel => (
                  <div key={channel.id} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide">{t('seller.serverUrl')}</label>
                      <div className="flex gap-2 mt-1">
                        <code className="flex-1 px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg text-[13px] font-mono truncate select-all">
                          {channel.default_rtmp_url}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(channel.default_rtmp_url || ''); toast.success(t('seller.urlCopied')) }}
                          className="px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#e5e5ea] transition-colors flex-shrink-0"
                          title={t("common.copy")}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide">{t('seller.streamKey')}</label>
                      <div className="flex gap-2 mt-1">
                        <code className="flex-1 px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg text-[13px] font-mono truncate select-all">
                          {channel.default_rtmp_key}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(channel.default_rtmp_key || ''); toast.success(t('seller.keyCopied')) }}
                          className="px-3 py-2.5 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#e5e5ea] transition-colors flex-shrink-0"
                          title={t("common.copy")}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-purple-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('seller.persistentKeyNote')}
                    </p>
                  </div>
                ))}
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
                      {t('seller.broadcastReady')}
                    </h3>
                    <p className="text-[15px] text-[#6e6e73]">
                      {t('seller.broadcastMethodGuide')}
                    </p>
                  </div>
                </div>

                {/* {t('seller.broadcastMethod')} */}
                <div className="mb-6">
                  <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-3">
                    {t('seller.broadcastMethod')}
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
                      <Monitor className="h-7 w-7 mx-auto mb-2 text-red-600" />
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">YouTube Studio</p>
                      <p className="text-[11px] text-[#6e6e73] mt-1">{t('seller.startNow')}</p>
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
                      <p className="text-[11px] text-[#6e6e73] mt-1">{t('seller.captionOverlay')}</p>
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
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">{t('seller.prismLive')}</p>
                      <p className="text-[11px] text-[#6e6e73] mt-1">{t('seller.mobileBroadcast')}</p>
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
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">{t('seller.browserDirect')}</h4>
                      </div>
                      <p className="text-[13px] text-[#6e6e73] mb-4">
                        {t('seller.browserDirectDesc')}
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => startStream(newStream.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 text-[15px] font-semibold"
                        >
                          <Radio className="h-5 w-5 mr-2" />
                          {t('seller.startBroadcast')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* OBS 방송 */}
                  {streamingMethod === 'obs' && (
                    <div className="bg-white border border-[#e5e5ea] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <VideoIcon className="h-5 w-5 text-purple-600" />
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">{t('seller.obsBroadcast')}</h4>
                      </div>

                      {channels.some(ch => ch.has_persistent_key) ? (
                        <>
                          {/* 고정 키가 있으면 간단 안내만 */}
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <p className="text-[13px] font-semibold text-green-800">{t('seller.rtmpSetupComplete')}</p>
                            </div>
                            <p className="text-[13px] text-green-700">
                              {t('seller.obsRtmpAlreadySet')}
                            </p>
                          </div>

                          {/* 동시 송출 가이드 */}
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">{t('seller.multiPlatformSimulcast')}</p>
                            <p className="text-[12px] text-[#6e6e73] mb-3">
                              {t('seller.multiPlatformObs')}
                            </p>
                            <p className="text-[11px] font-semibold text-[#1d1d1f] mb-1.5">{t('seller.availablePlatforms')}</p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#6e6e73]">
                              <span>• TikTok Live</span>
                              <span>• Instagram Live</span>
                              <span>• Twitch</span>
                              <span>• Facebook Live</span>
                              <span>• KakaoTV</span>
                              <span>• Naver Shopping Live</span>
                              <span>• AfreecaTV</span>
                              <span>• X (Twitter) Live</span>
                              <span>• Kick</span>
                              <span>• LinkedIn Live</span>
                            </div>
                            <p className="text-[11px] text-purple-600 mt-2">
                              {t('seller.addPlatformRtmp')}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 처음 설정 가이드 */}
                          <p className="text-[13px] text-[#6e6e73] mb-4">
                            {t('seller.subtitleOverlayFreeSetup')}
                          </p>
                          <div className="bg-[#f5f5f7] rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">{t('seller.firstTimeSetup')}</p>
                            <ol className="text-[13px] text-[#6e6e73] space-y-1.5 list-decimal list-inside">
                              <li>{t('seller.obsGuideCustomService')}</li>
                              <li>{t('seller.obsGuideSelectCustom')}</li>
                              <li>{t('seller.obsGuidePasteKeys')}</li>
                              <li>{t('seller.obsGuideNextTime')}</li>
                            </ol>
                          </div>

                          {/* 동시 송출 가이드 */}
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">{t('seller.multiPlatformSimulcast')}</p>
                            <p className="text-[12px] text-[#6e6e73] mb-3">
                              {t('seller.multiPlatformObs')}
                            </p>
                            <p className="text-[11px] font-semibold text-[#1d1d1f] mb-1.5">{t('seller.availablePlatforms')}</p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#6e6e73]">
                              <span>• TikTok Live</span>
                              <span>• Instagram Live</span>
                              <span>• Twitch</span>
                              <span>• Facebook Live</span>
                              <span>• KakaoTV</span>
                              <span>• Naver Shopping Live</span>
                              <span>• AfreecaTV</span>
                              <span>• X (Twitter) Live</span>
                              <span>• Kick</span>
                              <span>• LinkedIn Live</span>
                            </div>
                            <p className="text-[11px] text-purple-600 mt-2">
                              {t('seller.addPlatformRtmp')}
                            </p>
                          </div>

                          {/* RTMP 정보 */}
                          <div className="space-y-3 mb-4">
                            <div>
                              <label className="text-[11px] font-semibold text-[#6e6e73]">{t('seller.serverUrl')}</label>
                              <div className="flex gap-2 mt-1">
                                <code className="flex-1 px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg text-[13px] font-mono truncate">
                                  {newStream.rtmp_url}
                                </code>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(newStream.rtmp_url || ''); toast.success(t('common.copied')) }}
                                  className="px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg hover:bg-[#e5e5ea] transition-colors"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-[#6e6e73]">{t('seller.streamKey')}</label>
                              <div className="flex gap-2 mt-1">
                                <code className="flex-1 px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg text-[13px] font-mono truncate">
                                  {newStream.rtmp_key}
                                </code>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(newStream.rtmp_key || ''); toast.success(t('common.copied')) }}
                                  className="px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg hover:bg-[#e5e5ea] transition-colors"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-purple-600 flex items-center gap-1">
                              <Key className="h-3 w-3" />
                              {t('seller.persistentKeyShort')}
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
                          {t('seller.startBroadcast')}
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
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f]">{t('seller.prismLiveBroadcast')}</h4>
                      </div>

                      {channels.some(ch => ch.has_persistent_key) ? (
                        <>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <p className="text-[13px] font-semibold text-green-800">{t('seller.rtmpSetupComplete')}</p>
                            </div>
                            <p className="text-[13px] text-green-700">
                              {t('seller.prismRtmpAlreadySet')}
                            </p>
                          </div>

                          <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">{t('seller.prismMultiSimulcast')}</p>
                            <p className="text-[12px] text-[#6e6e73] mb-2">
                              {t('seller.prismMultiDesc')}
                            </p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#6e6e73]">
                              <span>• TikTok Live</span>
                              <span>• Instagram Live</span>
                              <span>• Twitch</span>
                              <span>• Facebook Live</span>
                              <span>• KakaoTV</span>
                              <span>• Naver Shopping Live</span>
                              <span>• AfreecaTV</span>
                              <span>• X (Twitter) Live</span>
                            </div>
                            <p className="text-[11px] text-orange-600 mt-2">
                              {t('seller.prismAddPlatform')}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-[13px] text-[#6e6e73] mb-4">
                            {t('seller.prismMobileDesc')}
                          </p>

                          <div className="bg-[#f5f5f7] rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">{t('seller.firstTimeSetup')}</p>
                            <ol className="text-[13px] text-[#6e6e73] space-y-1.5 list-decimal list-inside">
                              <li>{t('seller.prismFirstSetup')}</li>
                              <li>{t('seller.prismPasteRtmp')}</li>
                              <li>{t('seller.prismNextTime')}</li>
                            </ol>
                          </div>

                          <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-lg p-4 mb-4">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2">{t('seller.prismMultiSimulcast')}</p>
                            <p className="text-[12px] text-[#6e6e73] mb-2">
                              {t('seller.prismMultiExternal')}
                            </p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#6e6e73]">
                              <span>• TikTok Live</span>
                              <span>• Instagram Live</span>
                              <span>• Twitch</span>
                              <span>• Facebook Live</span>
                              <span>• KakaoTV</span>
                              <span>• Naver Shopping Live</span>
                              <span>• AfreecaTV</span>
                              <span>• X (Twitter) Live</span>
                            </div>
                            <p className="text-[11px] text-orange-600 mt-2">
                              {t('seller.prismAddPlatform')}
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
                    {t('common.close')}
                  </Button>
                </div>
              </div>
            )}

            {/* Create Live Stream Section */}
            {!showSetup && !newStream && (
              <div className="apple-card p-6 sm:p-8 mb-8">
                <h2 className="text-[24px] font-bold text-[#1d1d1f] mb-2 text-center">
                  {t('seller.newLiveBroadcast')}
                </h2>
                <p className="text-[14px] text-[#6e6e73] mb-6 text-center">
                  {t('seller.selectMethodAndStart')}
                </p>

                {/* {t('seller.broadcastMethod')} */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <button
                    onClick={() => { setStreamingMethod('web'); setShowSetup(true) }}
                    className="p-5 rounded-xl border-2 border-[#e5e5ea] bg-white hover:border-[#007aff] hover:bg-[#007aff]/5 transition-all text-center"
                  >
                    <Monitor className="h-8 w-8 mx-auto mb-2 text-[#007aff]" />
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">{t('seller.browser')}</p>
                    <p className="text-[11px] text-[#6e6e73] mt-1">{t('seller.browserStartNow')}</p>
                  </button>
                  <button
                    onClick={() => { setStreamingMethod('obs'); setShowSetup(true) }}
                    className="p-5 rounded-xl border-2 border-[#e5e5ea] bg-white hover:border-purple-500 hover:bg-purple-50 transition-all text-center"
                  >
                    <VideoIcon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">OBS Studio</p>
                    <p className="text-[11px] text-[#6e6e73] mt-1">{t('seller.obsSubtitle')}</p>
                  </button>
                  <button
                    onClick={() => { setStreamingMethod('prism'); setShowSetup(true) }}
                    className="p-5 rounded-xl border-2 border-[#e5e5ea] bg-white hover:border-orange-500 hover:bg-orange-50 transition-all text-center"
                  >
                    <Smartphone className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">{t('seller.prismLive')}</p>
                    <p className="text-[11px] text-[#6e6e73] mt-1">{t('seller.prismMobile')}</p>
                  </button>
                </div>
              </div>
            )}

            {/* Setup Form */}
            {showSetup && !newStream && (
              <div className="apple-card p-6 sm:p-8 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="text-[21px] font-bold text-[#1d1d1f]">
                    {t('seller.broadcastInfoInput')}
                  </h3>
                  <Badge className={`text-[12px] ${
                    streamingMethod === 'web' ? 'bg-[#007aff] text-white' :
                    streamingMethod === 'obs' ? 'bg-purple-600 text-white' :
                    'bg-orange-500 text-white'
                  }`}>
                    {streamingMethod === 'web' ? t('seller.browserLabel') : streamingMethod === 'obs' ? 'OBS' : t('seller.prismLive')}
                  </Badge>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-2">
                      {t('seller.broadcastTitleLabel')}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("seller.broadcastTitlePlaceholderAlt")}
                      className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-2">
                      {t('seller.broadcastDesc')}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("seller.broadcastDescPlaceholderAlt")}
                      className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007aff] resize-none"
                      rows={4}
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-3">
                      {t('seller.selectSaleProducts')} *
                    </label>
                    {products.length === 0 ? (
                      <div className="text-center py-8 text-[#6e6e73]">
                        <p className="mb-3">{t('seller.noProducts')}</p>
                        <Button
                          onClick={() => navigate('/seller/products/new')}
                          variant="outline"
                        >
                          {t('seller.registerProduct')}
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
                                  {product.price.toLocaleString()}{t('common.won')}
                                </p>
                                <p className="text-[11px] text-[#6e6e73]">
                                  {t('common.stock')}: {product.stock}{t('common.count')}
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
                      {t('seller.selectedProducts')}: {selectedProducts.length}{t('common.count')}
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
                          {t('common.creating')}
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5 mr-2" />
                          {t('seller.createBroadcast')}
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowSetup(false)}
                      variant="outline"
                      className="px-8 h-12"
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Streams */}
            {streams.filter(s => s.status !== 'ended').length > 0 && (
              <div className="mb-8">
                <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-4">
                  {t('seller.activeBroadcasts')}
                </h3>
                <div className="space-y-4">
                  {streams.filter(s => s.status !== 'ended').map(stream => (
                    <div key={stream.id} className="apple-card p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-[17px] font-semibold text-[#1d1d1f]">
                              {stream.title}
                            </h4>
                            <Badge
                              className={`
                                ${stream.status === 'live'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-orange-500 text-white'
                                }
                              `}
                            >
                              {stream.status === 'live' ? 'LIVE' : t('common.scheduled')}
                            </Badge>
                          </div>
                          <p className="text-[13px] text-[#6e6e73] mb-3">
                            {stream.description}
                          </p>
                          <div className="flex items-center gap-4 text-[13px] text-[#6e6e73]">
                            <div className="flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              {stream.viewer_count.toLocaleString()}
                            </div>
                            {stream.started_at && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {t('seller.startedAt')}: {formatKSTTime(stream.started_at)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* RTMP 정보 (예정 상태일 때 표시 - OBS/프리즘 설정용) */}
                      {stream.status === 'scheduled' && stream.rtmp_url && stream.rtmp_key && (
                        <div className="bg-[#f5f5f7] rounded-lg p-4 mb-4">
                          <p className="text-[11px] font-semibold text-[#6e6e73] mb-2">{t('seller.rtmpSettings')}</p>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <code className="flex-1 px-2 py-1.5 bg-white border border-[#e5e5ea] rounded text-[12px] font-mono truncate">{stream.rtmp_url}</code>
                              <button onClick={() => { navigator.clipboard.writeText(stream.rtmp_url || ''); toast.success(t('seller.urlCopied')) }} className="px-2 py-1.5 bg-white border border-[#e5e5ea] rounded hover:bg-[#e5e5ea] transition-colors"><Copy className="h-3.5 w-3.5" /></button>
                            </div>
                            <div className="flex gap-2">
                              <code className="flex-1 px-2 py-1.5 bg-white border border-[#e5e5ea] rounded text-[12px] font-mono truncate">{stream.rtmp_key}</code>
                              <button onClick={() => { navigator.clipboard.writeText(stream.rtmp_key || ''); toast.success(t('seller.keyCopied')) }} className="px-2 py-1.5 bg-white border border-[#e5e5ea] rounded hover:bg-[#e5e5ea] transition-colors"><Copy className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 상품 표시 설정 */}
                      <div className="bg-[#f5f5f7] rounded-lg p-3 mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-[12px] font-semibold text-[#1d1d1f]">{t('seller.productDisplayMode')}</p>
                          <p className="text-[11px] text-[#6e6e73]">
                            {(stream as any).product_display_mode === 'all' ? t('seller.showAllProducts') : t('seller.currentProductOnly')}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            const newMode = (stream as any).product_display_mode === 'all' ? 'current_only' : 'all'
                            try {
                              const token = localStorage.getItem('seller_token')
                              await api.put(`/api/seller/streams/${stream.id}/product-display`, { mode: newMode }, {
                                headers: { Authorization: `Bearer ${token}` }
                              })
                              toast.success(newMode === 'all' ? t('seller.showAllProductsToast') : t('seller.showCurrentOnlyToast'))
                              ;(stream as any).product_display_mode = newMode
                              setStreams([...streams])
                            } catch { toast.error(t('common.settingChangeFailed')) }
                          }}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            (stream as any).product_display_mode === 'all' ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            (stream as any).product_display_mode === 'all' ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {stream.status === 'scheduled' && (
                          <Button
                            onClick={() => startStream(stream.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            <Radio className="h-4 w-4 mr-2" />
                            {t('seller.startBroadcast')}
                          </Button>
                        )}
                        {stream.status === 'live' && (
                          <>
                            <Button
                              onClick={() => {
                                setShowControlPanel(true)
                                setNewStream(stream)
                              }}
                              className="bg-[#007aff] hover:bg-[#0051d5] text-white"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              {t('seller.broadcastManage')}
                            </Button>
                            <Button
                              onClick={() => endStream(stream.id)}
                              variant="destructive"
                            >
                              {t('seller.endBroadcast')}
                            </Button>
                          </>
                        )}
                        <a
                          href={stream.youtube_url || `https://youtube.com/watch?v=${stream.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#f5f5f7] transition-colors flex items-center gap-2 text-[13px] font-medium"
                        >
                          <ExternalLink className="h-4 w-4" />
                          YouTube
                        </a>
                        <a
                          href={`/live/${stream.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#f5f5f7] transition-colors flex items-center gap-2 text-[13px] font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          Ur Live
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Streams */}
            {streams.filter(s => s.status === 'ended').length > 0 && (
              <div>
                <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-4">
                  {t('seller.recentBroadcasts')}
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
                        {t('common.replay')}
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
