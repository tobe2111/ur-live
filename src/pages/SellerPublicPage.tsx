import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { 
  Instagram, 
  Youtube, 
  Facebook, 
  Twitter,
  Globe,
  Play,
  Clock,
  Users,
  Package,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Calendar,
  TrendingUp
} from 'lucide-react'

interface SellerProfile {
  id: number
  username: string
  name: string
  email: string
  phone?: string
  business_name?: string
  business_number?: string
  profile_image?: string
  bio?: string
  sns_instagram?: string
  sns_youtube?: string
  sns_facebook?: string
  sns_twitter?: string
  website_url?: string
  is_active: boolean
  status: string
  created_at: string
}

interface LiveStream {
  id: number
  title: string
  description?: string
  youtube_video_id: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count?: number
  scheduled_at?: string
  created_at: string
}

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  discount_rate?: number
  stock: number
  image_url?: string
  category?: string
  is_active: boolean
}

export default function SellerPublicPage() {
  const { sellerId } = useParams<{ sellerId: string }>()
  const navigate = useNavigate()
  
  const [seller, setSeller] = useState<SellerProfile | null>(null)
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'live' | 'products'>('live')

  useEffect(() => {
    loadSellerData()
  }, [sellerId])

  async function loadSellerData() {
    try {
      // Load seller profile
      const sellerResponse = await axios.get(`/api/seller/public/${sellerId}`)
      if (sellerResponse.data.success) {
        setSeller(sellerResponse.data.data)
      }

      // Load seller's live streams
      const streamsResponse = await axios.get(`/api/seller/${sellerId}/streams`)
      if (streamsResponse.data.success) {
        setStreams(streamsResponse.data.data || [])
      }

      // Load seller's products
      const productsResponse = await axios.get(`/api/seller/${sellerId}/products-public`)
      if (productsResponse.data.success) {
        setProducts(productsResponse.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load seller data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto mb-4"></div>
          <p className="text-[17px] text-[#6e6e73]">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-[#ff3b30] mx-auto mb-4" />
          <h2 className="text-[21px] font-bold text-[#1d1d1f] mb-2">
            판매자를 찾을 수 없습니다
          </h2>
          <p className="text-[15px] text-[#6e6e73] mb-6">
            요청하신 판매자 페이지를 찾을 수 없습니다.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-[#007aff] text-white rounded-full hover:bg-[#0051d5] transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const liveStreams = streams.filter(s => s.status === 'live')
  const scheduledStreams = streams.filter(s => s.status === 'scheduled')
  const endedStreams = streams.filter(s => s.status === 'ended')

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal hidden sm:inline">홈으로</span>
            </button>
            <h1 className="text-[17px] font-semibold text-[#1d1d1f]">
              {seller.business_name || seller.name}
            </h1>
            <div className="w-10" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[980px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Profile Section */}
        <div className="apple-card p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Profile Image */}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#007aff] to-[#5856d6] flex items-center justify-center text-white text-5xl font-bold flex-shrink-0">
              {seller.profile_image ? (
                <img 
                  src={seller.profile_image} 
                  alt={seller.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                seller.name.charAt(0)
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                <h2 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f]">
                  {seller.business_name || seller.name}
                </h2>
                {seller.status === 'approved' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#34c759]/10 text-[#34c759] rounded-full text-[13px] font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    인증 셀러
                  </span>
                )}
              </div>

              {seller.bio && (
                <p className="text-[15px] text-[#6e6e73] mb-4 leading-relaxed">
                  {seller.bio}
                </p>
              )}

              {/* SNS Links */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                {seller.sns_instagram && (
                  <a
                    href={seller.sns_instagram.startsWith('http') ? seller.sns_instagram : `https://instagram.com/${seller.sns_instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] flex items-center justify-center text-white hover:scale-110 transition-transform"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {seller.sns_youtube && (
                  <a
                    href={seller.sns_youtube.startsWith('http') ? seller.sns_youtube : `https://youtube.com/@${seller.sns_youtube}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#ff0000] flex items-center justify-center text-white hover:scale-110 transition-transform"
                  >
                    <Youtube className="h-5 w-5" />
                  </a>
                )}
                {seller.sns_facebook && (
                  <a
                    href={seller.sns_facebook.startsWith('http') ? seller.sns_facebook : `https://facebook.com/${seller.sns_facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#1877f2] flex items-center justify-center text-white hover:scale-110 transition-transform"
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                )}
                {seller.sns_twitter && (
                  <a
                    href={seller.sns_twitter.startsWith('http') ? seller.sns_twitter : `https://twitter.com/${seller.sns_twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#1da1f2] flex items-center justify-center text-white hover:scale-110 transition-transform"
                  >
                    <Twitter className="h-5 w-5" />
                  </a>
                )}
                {seller.website_url && (
                  <a
                    href={seller.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#6e6e73] flex items-center justify-center text-white hover:scale-110 transition-transform"
                  >
                    <Globe className="h-5 w-5" />
                  </a>
                )}
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-[21px] font-bold text-[#1d1d1f]">
                    {streams.length}
                  </p>
                  <p className="text-[13px] text-[#6e6e73]">라이브</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[21px] font-bold text-[#1d1d1f]">
                    {products.length}
                  </p>
                  <p className="text-[13px] text-[#6e6e73]">상품</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[21px] font-bold text-[#1d1d1f]">
                    {streams.reduce((sum, s) => sum + (s.viewer_count || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-[13px] text-[#6e6e73]">총 시청자</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-3 px-6 rounded-xl text-[15px] font-medium transition-all ${
              activeTab === 'live'
                ? 'bg-[#007aff] text-white shadow-lg shadow-[#007aff]/30'
                : 'bg-white text-[#6e6e73] hover:bg-[#f5f5f7]'
            }`}
          >
            <Play className="inline h-5 w-5 mr-2" />
            라이브 방송
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-3 px-6 rounded-xl text-[15px] font-medium transition-all ${
              activeTab === 'products'
                ? 'bg-[#007aff] text-white shadow-lg shadow-[#007aff]/30'
                : 'bg-white text-[#6e6e73] hover:bg-[#f5f5f7]'
            }`}
          >
            <Package className="inline h-5 w-5 mr-2" />
            판매 상품
          </button>
        </div>

        {/* Content Area */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            {/* Live Streams */}
            {liveStreams.length > 0 && (
              <div>
                <h3 className="text-[21px] font-bold text-[#1d1d1f] mb-4">
                  🔴 진행 중인 라이브
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {liveStreams.map(stream => (
                    <div
                      key={stream.id}
                      onClick={() => navigate(`/live/${stream.id}`)}
                      className="apple-card overflow-hidden cursor-pointer hover:shadow-2xl transition-all group"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-black">
                        <img 
                          src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                          alt={stream.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3">
                          <span className="px-3 py-1 bg-[#ff3b30] text-white rounded-full text-[11px] font-bold flex items-center gap-1 animate-pulse">
                            <span className="w-2 h-2 bg-white rounded-full"></span>
                            LIVE
                          </span>
                        </div>
                        {stream.viewer_count && stream.viewer_count > 0 && (
                          <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-sm text-white rounded-full text-[11px] font-medium flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {stream.viewer_count.toLocaleString()}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="p-4">
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f] mb-1 line-clamp-2 group-hover:text-[#007aff] transition-colors">
                          {stream.title}
                        </h4>
                        {stream.description && (
                          <p className="text-[13px] text-[#6e6e73] line-clamp-1">
                            {stream.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Streams */}
            {scheduledStreams.length > 0 && (
              <div>
                <h3 className="text-[21px] font-bold text-[#1d1d1f] mb-4">
                  📅 예정된 라이브
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {scheduledStreams.map(stream => (
                    <div
                      key={stream.id}
                      className="apple-card overflow-hidden"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-gradient-to-br from-[#007aff]/10 to-[#5856d6]/10 flex items-center justify-center">
                        <Calendar className="h-16 w-16 text-[#007aff]/30" />
                        {stream.scheduled_at && (
                          <div className="absolute bottom-3 left-3 right-3 px-3 py-2 bg-white rounded-lg">
                            <div className="flex items-center gap-2 text-[13px] text-[#1d1d1f]">
                              <Clock className="h-4 w-4 text-[#007aff]" />
                              {new Date(stream.scheduled_at).toLocaleString('ko-KR')}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="p-4">
                        <h4 className="text-[15px] font-semibold text-[#1d1d1f] mb-1 line-clamp-2">
                          {stream.title}
                        </h4>
                        {stream.description && (
                          <p className="text-[13px] text-[#6e6e73] line-clamp-1">
                            {stream.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {liveStreams.length === 0 && scheduledStreams.length === 0 && (
              <div className="text-center py-16">
                <Play className="h-16 w-16 text-[#6e6e73]/30 mx-auto mb-4" />
                <p className="text-[17px] text-[#6e6e73]">
                  예정된 라이브가 없습니다
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            {products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map(product => (
                  <div
                    key={product.id}
                    className="apple-card overflow-hidden hover:shadow-2xl transition-all cursor-pointer group"
                  >
                    {/* Product Image */}
                    <div className="relative aspect-square bg-[#f5f5f7]">
                      {product.image_url ? (
                        <img 
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-[#6e6e73]/30" />
                        </div>
                      )}
                      {product.discount_rate && product.discount_rate > 0 && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-[#ff3b30] text-white rounded-full text-[11px] font-bold">
                          {product.discount_rate}%
                        </div>
                      )}
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                          <span className="text-white font-bold text-[15px]">품절</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Product Info */}
                    <div className="p-3">
                      <h4 className="text-[13px] font-medium text-[#1d1d1f] mb-1 line-clamp-2 group-hover:text-[#007aff] transition-colors">
                        {product.name}
                      </h4>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[15px] font-bold text-[#1d1d1f]">
                          {product.price.toLocaleString()}원
                        </span>
                        {product.original_price && product.original_price > product.price && (
                          <span className="text-[11px] text-[#6e6e73] line-through">
                            {product.original_price.toLocaleString()}원
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6e6e73] mt-1">
                        재고 {product.stock}개
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Package className="h-16 w-16 text-[#6e6e73]/30 mx-auto mb-4" />
                <p className="text-[17px] text-[#6e6e73]">
                  등록된 상품이 없습니다
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
