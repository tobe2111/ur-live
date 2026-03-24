import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Home, Heart, User, ChevronDown, Play, Users, ChevronRight, Sparkles, Clock, ShoppingBag, X, Package, LogOut } from 'lucide-react'
import { getUserId, getUserIdSync, getUserNameSync, isLoggedInSync } from '@/utils/auth'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import MobileFooter from '@/components/MobileFooter'

interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  seller_name: string
  stock: number
  sold_count?: number
  category?: string
}

interface Stream {
  id: number
  title: string
  description: string
  thumbnail_url?: string
  seller_name: string
  viewer_count?: number
  status: string
  scheduled_start_time?: string
}

export default function ShortFormPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [filterTab, setFilterTab] = useState('popularity')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(8)
  const navigate = useNavigate()
  const userName = getUserNameSync()
  const loggedIn = isLoggedInSync()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    console.log('[ShortFormPage] State updated - Streams:', streams.length, 'Products:', products.length, 'DisplayedProducts:', displayedProducts.length)
  }, [streams, products, displayedProducts])

  async function loadData() {
    try {
      console.log('[ShortFormPage] Starting to load data...')
      setLoading(true)
      
      // Load products - only from approved sellers
      const productsRes = await api.get('/api/products?limit=100')
      console.log('[ShortFormPage] Products response:', JSON.stringify(productsRes.data))
      if (productsRes.data.success) {
        const allProducts = productsRes.data.data
        console.log('[ShortFormPage] Loaded products:', allProducts.length)
        setProducts(allProducts)
        setDisplayedProducts(allProducts.slice(0, 8))
      } else {
        console.warn('[ShortFormPage] Products API failed:', productsRes.data)
      }

      // Load live streams
      const streamsRes = await api.get('/api/streams?status=live')
      console.log('[ShortFormPage] Streams response:', JSON.stringify(streamsRes.data))
      if (streamsRes.data.success) {
        console.log('[ShortFormPage] Live streams:', streamsRes.data.data?.length || 0)
        setStreams(streamsRes.data.data || [])
      } else {
        console.warn('[ShortFormPage] Streams API failed:', streamsRes.data)
      }

      // Load scheduled streams
      const scheduledRes = await api.get('/api/streams?status=scheduled')
      console.log('[ShortFormPage] Scheduled response:', JSON.stringify(scheduledRes.data))
      if (scheduledRes.data.success) {
        const scheduled = (scheduledRes.data.data || [])
          .filter((s: Stream) => s.status === 'scheduled')
          .slice(0, 4)
        console.log('[ShortFormPage] Scheduled streams:', scheduled.length)
        setScheduledStreams(scheduled)
      } else {
        console.warn('[ShortFormPage] Scheduled API failed:', scheduledRes.data)
      }
    } catch (error) {
      console.error('[ShortFormPage] Failed to load data:', error)
    } finally {
      setLoading(false)
      console.log('[ShortFormPage] Loading complete. Streams:', streams.length, 'Products:', products.length)
    }
  }

  function handleLoadMore() {
    const nextCount = visibleCount + 8
    setDisplayedProducts(products.slice(0, nextCount))
    setVisibleCount(nextCount)
  }

  async function handleAddToCart(productId: number, e: React.MouseEvent) {
    e.stopPropagation()
    const userId = getUserId()
    if (!userId) {
      if (confirm('로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?')) {
        navigate('/login')
      }
      return
    }

    try {
      await api.post('/api/cart', {
        userId: Number(userId),
        productId: productId,
        quantity: 1
      })
      toast.success('장바구니에 추가되었습니다!')
    } catch (error) {
      console.error('Failed to add to cart:', error)
      toast.error('장바구니 추가에 실패했습니다.')
    }
  }

  function handleProductClick(productId: number) {
    navigate(`/product/${productId}`)
  }

  function handleStreamClick(streamId: number) {
    navigate(`/live/${streamId}`)
  }

  function handleLogout() {
    localStorage.clear()
    toast.info('\ub85c\uadf8\uc544\uc6c3\ub418\uc5c8\uc2b5\ub2c8\ub2e4.')
    setIsSidebarOpen(false)
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />
      )}
      
      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
        <div className="flex flex-col h-full">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">메뉴</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            {loggedIn && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{userName}</p>
                  <p className="text-purple-100 text-xs">환영합니다!</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {loggedIn ? (
              <div className="space-y-2">
                <button onClick={() => { setIsSidebarOpen(false); navigate('/user/profile'); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg">
                  <User className="w-5 h-5 text-purple-600" />
                  <span className="font-medium">마이페이지</span>
                </button>
                <button onClick={() => { setIsSidebarOpen(false); navigate('/my-orders'); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg">
                  <Package className="w-5 h-5 text-indigo-600" />
                  <span className="font-medium">주문내역</span>
                </button>
                <button onClick={() => { setIsSidebarOpen(false); navigate('/cart'); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">장바구니</span>
                </button>
                <div className="border-t my-2"></div>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 hover:bg-red-50 rounded-lg text-red-600">
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">로그아웃</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => { setIsSidebarOpen(false); navigate('/login'); }} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition">
                  로그인
                </button>
                <p className="text-center text-sm text-gray-500 py-4">로그인하여 더 많은 서비스를 이용하세요</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header - 리스터코퍼레이션 Branding */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => setIsSidebarOpen(true)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
            
            <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              리스터코퍼레이션
            </h1>
            
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => navigate('/search')}>
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => navigate('/cart')}>
                <ShoppingBag className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => navigate('/user/profile')}>
                <User className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setFilterTab('live')}
              className={`text-sm font-semibold transition-all duration-200 ${
                filterTab === 'live' 
                  ? 'text-purple-600 scale-105' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              라이브 중
            </button>
            <button
              onClick={() => setFilterTab('popularity')}
              className={`flex items-center gap-1 text-sm font-semibold transition-all duration-200 ${
                filterTab === 'popularity' 
                  ? 'text-purple-600 scale-105' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              인기순 <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFilterTab('newest')}
              className={`flex items-center gap-1 text-sm font-semibold transition-all duration-200 ${
                filterTab === 'newest' 
                  ? 'text-purple-600 scale-105' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              최신순 <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 px-4 py-8">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-xs font-bold text-yellow-300 uppercase tracking-wide">Special Offer</span>
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              실시간 라이브 쇼핑
            </h2>
            <p className="text-sm text-purple-100 mb-4">
              지금 바로 라이브 방송에서 특별한 상품을 만나보세요
            </p>
            <button 
              onClick={() => {
                const liveSection = document.getElementById('live-section')
                liveSection?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="bg-white text-purple-600 font-bold text-sm px-6 py-2.5 rounded-full hover:bg-purple-50 transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2"
            >
              라이브 보러가기
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
        </div>

        {/* Scheduled Streams Section */}
        {scheduledStreams.length > 0 && (
          <div className="mt-4 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">예정된 라이브</h3>
              </div>
              <button 
                onClick={() => navigate('/')}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                더보기
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50">
              {scheduledStreams.map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => handleStreamClick(stream.id)}
                  className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
                >
                  <div className="relative aspect-square bg-gray-900">
                    {stream.thumbnail_url ? (
                      <img
                        src={stream.thumbnail_url}
                        alt={stream.title}
                        className="w-full h-full object-cover opacity-90"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Clock className="w-16 h-16 text-white opacity-50" />
                      </div>
                    )}
                    
                    {/* Scheduled Badge */}
                    <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <Clock className="w-3 h-3" />
                      예정
                    </div>

                    {/* Scheduled Time */}
                    {stream.scheduled_start_time && (
                      <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded text-center">
                        {new Date(stream.scheduled_start_time).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                      {stream.title}
                    </h4>
                    <p className="text-xs text-gray-600">{stream.seller_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section Header - UR Special Deals */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-purple-100 mt-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="text-purple-600">💎</span>
            유어 특가
          </h3>
        </div>

        {/* Product Grid - 2 Columns */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50">
          {displayedProducts.map((product, index) => (
            <div
              key={product.id}
              onClick={() => handleProductClick(product.id)}
              className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
            >
              {/* Product Image */}
              <div className="relative aspect-square bg-gray-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-16 h-16 text-gray-300" />
                  </div>
                )}
                
                {/* Badges */}
                {product.discount_rate > 0 && (
                  <div className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    {product.discount_rate}%
                  </div>
                )}
                
                {product.sold_count && product.sold_count > 100 && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    인기
                  </div>
                )}

                {/* Ranking Badge for top 3 */}
                {index < 3 && (
                  <div className="absolute bottom-2 left-2 w-7 h-7 bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                    {index + 1}
                  </div>
                )}

                {/* Like Button */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    const userId = getUserIdSync()
                    if (!userId) { navigate('/login'); return }
                    try {
                      await api.post('/api/wishlists', { product_id: product.id })
                    } catch {
                      // 이미 찜한 상품이면 무시
                    }
                  }}
                  className="absolute bottom-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white hover:scale-110 transition-all duration-200"
                >
                  <Heart className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <p className="text-xs text-gray-500 mb-1">{product.seller_name}</p>
                <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 leading-snug">
                  {product.name}
                </h4>
                
                <div className="flex items-center gap-2 mb-3">
                  {product.original_price && product.original_price > (product.current_price || product.price) && (
                    <span className="text-xs text-gray-400 line-through">
                      ₩{product.original_price.toLocaleString()}
                    </span>
                  )}
                  <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    ₩{((product.current_price || product.price) ?? 0).toLocaleString()}
                  </span>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={(e) => handleAddToCart(product.id, e)}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm py-2.5 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02]"
                >
                  장바구니 담기
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {visibleCount < products.length && (
          <div className="px-4 py-3 bg-gray-50">
            <button
              onClick={handleLoadMore}
              className="w-full bg-white text-purple-600 font-bold text-sm py-3 rounded-xl border-2 border-purple-600 hover:bg-purple-50 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              더보기 ({visibleCount} / {products.length})
            </button>
          </div>
        )}

        {/* Live Streams Section */}
        {streams.length > 0 && (
          <div id="live-section" className="mt-4 bg-white pb-6">
            <div className="bg-gradient-to-r from-red-50 to-pink-50 px-4 py-3 border-b border-red-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-bold text-gray-900">지금 LIVE 중</h3>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50">
              {streams.slice(0, 6).map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => handleStreamClick(stream.id)}
                  className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
                >
                  <div className="relative aspect-square bg-gray-900">
                    {stream.thumbnail_url ? (
                      <img
                        src={stream.thumbnail_url}
                        alt={stream.title}
                        className="w-full h-full object-cover opacity-90"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-16 h-16 text-white opacity-50" />
                      </div>
                    )}
                    
                    {/* LIVE Badge */}
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </div>

                    {/* Viewer Count */}
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {stream.viewer_count || 0}
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-200">
                        <Play className="w-6 h-6 text-white fill-white" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                      {stream.title}
                    </h4>
                    <p className="text-xs text-gray-600">{stream.seller_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Footer */}
        <MobileFooter />
      </div>
  )
}
