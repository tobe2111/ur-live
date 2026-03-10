/**
 * Seller Live Broadcast Page
 * Prism-style zero-setup YouTube live streaming
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Youtube, 
  Link as LinkIcon, 
  Settings, 
  Eye, 
  Clock,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Radio,
  VideoIcon,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2
} from 'lucide-react'
import { getSellerToken, isSellerAuthenticated } from '@/lib/seller-auth'

interface YouTubeChannel {
  id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  google_email: string
  is_active: boolean
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

      // Load YouTube channels
      const channelsRes = await api.get('/api/youtube/channels')
      if (channelsRes.data.success) {
        setChannels(channelsRes.data.data || [])
      }

      // Load products
      const productsRes = await api.get('/api/seller/products')
      if (productsRes.data.success) {
        setProducts(productsRes.data.data || [])
      }

      // Load streams
      const streamsRes = await api.get('/api/seller/streams')
      if (streamsRes.data.success) {
        setStreams(streamsRes.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function connectYouTube() {
    try {
      const response = await api.get('/api/youtube/auth-url')
      if (response.data.success) {
        // Open OAuth window
        window.location.href = response.data.data.authUrl
      }
    } catch (error: any) {
      console.error('Failed to get auth URL:', error)
      alert('YouTube 연동에 실패했습니다.')
    }
  }

  async function createLiveStream() {
    if (!title.trim()) {
      alert('방송 제목을 입력해주세요.')
      return
    }

    if (selectedProducts.length === 0) {
      alert('최소 1개 이상의 상품을 선택해주세요.')
      return
    }

    try {
      setCreating(true)

      const response = await api.post('/api/youtube/live/create', {
        title: title.trim(),
        description: description.trim(),
        product_ids: selectedProducts,
        scheduled_start_time: new Date().toISOString()
      })

      if (response.data.success) {
        setNewStream(response.data.data)
        setShowSetup(false)
        setTitle('')
        setDescription('')
        setSelectedProducts([])
        await loadData()
      }
    } catch (error: any) {
      console.error('Failed to create stream:', error)
      if (error.response?.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
        alert('YouTube 연동이 필요합니다. 먼저 YouTube 계정을 연동해주세요.')
      } else {
        alert('라이브 생성에 실패했습니다: ' + (error.response?.data?.error || error.message))
      }
    } finally {
      setCreating(false)
    }
  }

  async function startStream(streamId: number) {
    try {
      await api.post(`/api/youtube/live/${streamId}/start`)
      await loadData()
      alert('방송이 시작되었습니다!')
    } catch (error: any) {
      console.error('Failed to start stream:', error)
      alert('방송 시작에 실패했습니다.')
    }
  }

  async function endStream(streamId: number) {
    if (!confirm('방송을 종료하시겠습니까?')) return

    try {
      await api.post(`/api/youtube/live/${streamId}/end`)
      await loadData()
      setNewStream(null)
      alert('방송이 종료되었습니다.')
    } catch (error: any) {
      console.error('Failed to end stream:', error)
      alert('방송 종료에 실패했습니다.')
    }
  }

  async function disconnectYouTube(channelId: number) {
    if (!confirm('YouTube 연동을 해제하시겠습니까?')) return

    try {
      await api.delete(`/api/youtube/oauth/${channelId}`)
      await loadData()
    } catch (error) {
      console.error('Failed to disconnect:', error)
      alert('연동 해제에 실패했습니다.')
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
          <p className="text-[17px] text-[#6e6e73]">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <button
              onClick={() => navigate('/seller')}
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal">대시보드</span>
            </button>
            <h1 className="text-[17px] font-semibold text-[#1d1d1f]">
              YouTube 라이브 방송
            </h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
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
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-[17px] font-semibold h-auto"
            >
              <Youtube className="h-5 w-5 mr-2" />
              YouTube 계정 연동하기
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
                    <img
                      src={channel.channel_thumbnail}
                      alt={channel.channel_title}
                      className="w-16 h-16 rounded-full flex-shrink-0"
                    />
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

            {/* New Stream Success Modal */}
            {newStream && (
              <div className="apple-card p-6 sm:p-8 mb-8 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500/20">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[21px] font-bold text-[#1d1d1f] mb-2">
                      🎉 방송 준비 완료!
                    </h3>
                    <p className="text-[15px] text-[#6e6e73] mb-4">
                      YouTube 라이브 방송이 생성되었습니다. OBS나 Prism으로 스트리밍을 시작하세요.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">
                      YouTube 방송 링크
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newStream.youtube_url || `https://youtube.com/watch?v=${newStream.youtube_video_id}`}
                        readOnly
                        className="flex-1 px-4 py-2 bg-white border border-[#e5e5ea] rounded-lg text-[13px] font-mono"
                      />
                      <a
                        href={newStream.youtube_url || `https://youtube.com/watch?v=${newStream.youtube_video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-[#007aff] text-white rounded-lg hover:bg-[#0051d5] transition-colors flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        열기
                      </a>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">
                      RTMP 설정 (OBS/Prism)
                    </label>
                    <div className="bg-white border border-[#e5e5ea] rounded-lg p-4 space-y-2">
                      <div>
                        <span className="text-[11px] font-semibold text-[#6e6e73]">URL:</span>
                        <code className="block text-[13px] font-mono text-[#1d1d1f] mt-1">
                          {newStream.rtmp_url}
                        </code>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-[#6e6e73]">Stream Key:</span>
                        <code className="block text-[13px] font-mono text-[#1d1d1f] mt-1 break-all">
                          {newStream.rtmp_key}
                        </code>
                      </div>
                    </div>
                    <button
                      onClick={copyRTMP}
                      className="mt-2 w-full px-4 py-2 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:bg-[#e5e5ea] transition-colors flex items-center justify-center gap-2 text-[13px] font-medium"
                    >
                      {copiedRTMP ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          복사완료!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          RTMP 정보 복사
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => startStream(newStream.id)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 text-[15px] font-semibold"
                    >
                      <Radio className="h-5 w-5 mr-2" />
                      방송 시작
                    </Button>
                    <Button
                      onClick={() => setNewStream(null)}
                      variant="outline"
                      className="px-6 h-12"
                    >
                      닫기
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Create Live Stream Section */}
            {!showSetup && !newStream && (
              <div className="apple-card p-8 sm:p-12 text-center mb-8 bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Play className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-[28px] font-bold text-[#1d1d1f] mb-3">
                  새 라이브 방송 시작
                </h2>
                <p className="text-[15px] text-[#6e6e73] mb-6 max-w-md mx-auto">
                  한 번의 클릭으로 YouTube 라이브 방송을 시작하세요.
                  상품을 선택하고 방송을 시작하면 자동으로 RTMP 스트림이 생성됩니다.
                </p>
                <Button
                  onClick={() => setShowSetup(true)}
                  className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-10 py-6 text-[19px] font-bold h-auto shadow-lg"
                >
                  <Play className="h-6 w-6 mr-3" />
                  라이브 방송 만들기
                </Button>
              </div>
            )}

            {/* Setup Form */}
            {showSetup && !newStream && (
              <div className="apple-card p-6 sm:p-8 mb-8">
                <h3 className="text-[21px] font-bold text-[#1d1d1f] mb-6">
                  방송 정보 입력
                </h3>

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
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                              />
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

            {/* Active Streams */}
            {streams.filter(s => s.status !== 'ended').length > 0 && (
              <div className="mb-8">
                <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-4">
                  진행 중인 방송
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
                              {stream.status === 'live' ? 'LIVE' : '예정'}
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
                                시작: {new Date(stream.started_at).toLocaleTimeString('ko-KR')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {stream.status === 'scheduled' && (
                          <Button
                            onClick={() => startStream(stream.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            <Radio className="h-4 w-4 mr-2" />
                            방송 시작
                          </Button>
                        )}
                        {stream.status === 'live' && (
                          <Button
                            onClick={() => endStream(stream.id)}
                            variant="destructive"
                          >
                            방송 종료
                          </Button>
                        )}
                        <a
                          href={stream.youtube_url || `https://youtube.com/watch?v=${stream.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-white border border-[#e5e5ea] rounded-lg hover:bg-[#f5f5f7] transition-colors flex items-center gap-2 text-[13px] font-medium"
                        >
                          <ExternalLink className="h-4 w-4" />
                          YouTube에서 보기
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
                            {new Date(stream.ended_at).toLocaleDateString('ko-KR')}
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
      </main>
    </div>
  )
}
