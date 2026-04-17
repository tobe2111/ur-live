import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { Play, Users, Search, ShoppingCart, User, Clock, ChevronRight, ShoppingBag } from 'lucide-react'
import { CustomModal, useModal } from '@/components/CustomModal'
import { LazyImage } from '@/components/LazyImage'
import { getUserName, getUserId, getUserIdSync, logout } from '@/utils/auth'
import { useLiveStreams } from '@/hooks/useLiveStream'
import { BannerSection } from '@/components/home/BannerSection'

interface Stream {
  id: number
  title: string
  description: string
  youtube_video_id: string
  platform?: string
  tiktok_username?: string
  thumbnail_url?: string
  seller_name: string
  seller_profile_image?: string
  viewer_count?: number
  status: 'live' | 'scheduled' | 'ended'
  scheduled_start_time?: string
}

interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  sold_count?: number
  stock: number
  is_new?: boolean
  is_popular?: boolean
  seller_name?: string
}

interface Banner {
  id: number
  title: string
  image_url: string
  link_url?: string
  description?: string
  is_active: boolean
  display_order: number
  start_date?: string
  end_date?: string
}

type CategoryTab = '추천' | '베스트' | '신상품' | '할인중'

export default function HomePage() {
  const { data: liveStreamsData, isLoading: streamsLoading } = useLiveStreams()

  const [banners, setBanners] = useState<Banner[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CategoryTab>('추천')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const { modal, showAlert, closeModal } = useModal()

  const streams = (liveStreamsData || []).map((s: any) => ({
    id: parseInt(s.id) || 0,
    title: s.title || '',
    description: s.description || '',
    youtube_video_id: s.stream_url || '',
    platform: 'youtube',
    thumbnail_url: s.thumbnail_url,
    seller_name: s.seller_name || '',
    seller_profile_image: '',
    viewer_count: s.viewer_count || 0,
    status: s.status as 'live' | 'scheduled' | 'ended',
    scheduled_start_time: s.scheduled_at,
  })) as Stream[]

  useEffect(() => {
    const legacyParams = ['login', 'session', 'userId', 'userName', 'access_token', 'refresh_token']
    if (legacyParams.some(param => searchParams.has(param))) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    Promise.all([loadBanners(), loadUserInfo(), loadProducts()])
  }, [searchParams])

  async function loadUserInfo() {
    try {
      const userName = await getUserName()
      const userId = await getUserId()
      if (userName && userId) {
        setUser({ name: userName, email: '' })
      }
    } catch (error) {
      console.error('[HomePage] Failed to load user info:', error)
    }
  }

  function handleLogout() {
    logout()
    localStorage.removeItem('hasCartItems')
    setUser(null)
    showAlert('로그아웃되었습니다.', 'success', '로그아웃 완료')
    setTimeout(() => navigate('/'), 1500)
  }

  async function loadBanners() {
    try {
      const response = await api.get('/api/banners')
      if (response.data.success) {
        setBanners(response.data.data || [])
      }
    } catch (error) {
      console.error('[HomePage] Failed to load banners:', error)
    }
  }

  async function loadProducts() {
    try {
      const response = await api.get('/api/products?limit=9&sort=popular&featured=true')
      if (response.data.success && Array.isArray(response.data.data)) {
        setProducts(response.data.data)
      } else {
        setProducts([])
      }
    } catch (error) {
      console.error('[HomePage] Failed to load products:', error)
      setProducts([
        { id: 1, name: '프리미엄 무선 헤드폰', price: 89000, current_price: 89000, original_price: 149000, discount_rate: 40, image_url: '', seller_name: 'Nike', is_popular: true, sold_count: 0, stock: 10 },
        { id: 2, name: '클래식 화이트 스니커즈', price: 120000, current_price: 120000, discount_rate: 0, image_url: '', seller_name: 'Adidas', sold_count: 0, stock: 10 },
        { id: 3, name: '가죽 백팩', price: 75000, current_price: 75000, original_price: 110000, discount_rate: 32, image_url: '', seller_name: 'Brand', is_new: true, sold_count: 0, stock: 10 },
        { id: 4, name: '스포츠 워치', price: 189000, current_price: 189000, discount_rate: 0, image_url: '', seller_name: 'Jordan', sold_count: 0, stock: 10 },
        { id: 5, name: '디자이너 선글라스', price: 125000, current_price: 125000, discount_rate: 0, image_url: '', seller_name: 'ASICS', is_new: true, sold_count: 0, stock: 10 },
        { id: 6, name: '캔버스 토트백', price: 45000, current_price: 45000, discount_rate: 0, image_url: '', seller_name: 'Converse', sold_count: 0, stock: 10 },
      ])
    } finally {
      setProductsLoading(false)
    }
  }

  const categoryTabs: CategoryTab[] = ['추천', '베스트', '신상품', '할인중']

  const filteredProducts = products.filter((p) => {
    if (activeTab === '베스트') return p.is_popular || (p.sold_count && p.sold_count > 0)
    if (activeTab === '신상품') return p.is_new
    if (activeTab === '할인중') return p.discount_rate > 0
    return true
  })

  // Show all products if filter returns empty (data may not have flags)
  const displayProducts = filteredProducts.length > 0 ? filteredProducts : products

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white relative pb-16">
      <SEO title="유어딜 - 라이브 커머스" description="라이브 방송으로 만나는 최저가 특가 상품" url="/" />
      <CustomModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="flex items-center h-12 px-3 gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF4500]">
              <Play className="h-3.5 w-3.5 text-white fill-white" />
            </div>
            <span className="text-base font-bold text-gray-900">유어쇼핑</span>
          </Link>

          {/* Search Bar */}
          <button
            onClick={() => navigate('/search')}
            className="flex-1 flex items-center h-8 px-3 bg-gray-100 rounded-full gap-1.5"
          >
            <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 truncate">상품을 검색해보세요</span>
          </button>

          {/* Cart */}
          <Link to="/cart" className="flex-shrink-0 p-1.5">
            <ShoppingCart className="h-5 w-5 text-gray-700" />
          </Link>

          {/* Profile */}
          {user ? (
            <Link to="/user/profile" className="flex-shrink-0 p-1.5">
              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF4500] text-white text-[10px] font-bold">
                {user.name.charAt(0)}
              </div>
            </Link>
          ) : (
            <button
              onClick={() => {
                localStorage.setItem('loginReturnUrl', window.location.pathname)
                navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname))
              }}
              className="flex-shrink-0 p-1.5"
            >
              <User className="h-5 w-5 text-gray-700" />
            </button>
          )}
        </div>
      </header>

      {/* Banner Carousel */}
      <BannerSection banners={banners} />

      {/* Category Tabs */}
      <div className="sticky top-12 z-40 bg-white border-b border-gray-100">
        <div className="flex overflow-x-auto scrollbar-hide">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-5 py-2.5 text-sm font-semibold transition-colors relative ${
                activeTab === tab
                  ? 'text-gray-900'
                  : 'text-gray-400'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gray-900 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Live Streams Section */}
      <section className="px-4 pt-5 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              지금 라이브 중! <span className="inline-block h-2 w-2 bg-red-500 rounded-full animate-pulse align-middle" />
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {streams.length > 0 ? `${streams.length}개 방송 중` : '곧 새로운 라이브가 시작됩니다'}
            </p>
          </div>
          <Link to="/browse" className="text-xs text-gray-400 flex items-center gap-0.5">
            전체보기 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {streamsLoading ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-36 animate-pulse">
                <div className="aspect-[3/4] bg-gray-200 rounded-xl mb-2" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">곧 새로운 라이브가 시작됩니다</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
            {streams.map((stream) => (
              <Link
                key={stream.id}
                to={`/live/${stream.id}`}
                className="flex-shrink-0 w-36 group"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100">
                  {stream.thumbnail_url ? (
                    <LazyImage
                      src={stream.thumbnail_url}
                      alt={stream.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <LazyImage
                      src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                      alt={stream.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {/* Live badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-red-500 rounded">
                    <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-white">LIVE</span>
                  </div>
                  {/* Viewer count */}
                  {stream.viewer_count != null && stream.viewer_count > 0 && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/50 rounded">
                      <Users className="h-2.5 w-2.5 text-white" />
                      <span className="text-[10px] text-white font-medium">{stream.viewer_count.toLocaleString()}</span>
                    </div>
                  )}
                  {/* Gradient overlay at bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                <p className="mt-1.5 text-xs font-medium text-gray-900 line-clamp-2 leading-tight">
                  {stream.title}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">{stream.seller_name}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="h-2 bg-gray-50" />

      {/* Hot Deal Products Section */}
      <section className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">ur특가 상품 🔥</h2>
            <p className="text-xs text-gray-500 mt-0.5">놓치면 후회할 특가 모음</p>
          </div>
          <Link to="/browse" className="text-xs text-gray-400 flex items-center gap-0.5">
            전체보기 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-1.5" />
                <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {displayProducts.slice(0, 9).map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="group"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <ShoppingBag className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  {/* Cart icon overlay */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      navigate(`/product/${product.id}`)
                    }}
                    className="absolute bottom-1.5 right-1.5 p-1 bg-white/90 rounded-full shadow-sm"
                  >
                    <ShoppingCart className="h-3.5 w-3.5 text-gray-600" />
                  </button>
                </div>
                <div className="mt-1.5">
                  <p className="text-[11px] text-gray-900 line-clamp-2 leading-tight font-medium">
                    {product.name}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    {product.discount_rate > 0 && (
                      <span className="text-xs font-bold text-red-500">{product.discount_rate}%</span>
                    )}
                    <span className="text-xs font-bold text-gray-900">
                      {(product.current_price || product.price).toLocaleString()}원
                    </span>
                  </div>
                  {product.original_price && product.original_price > (product.current_price || product.price) && (
                    <span className="text-[10px] text-gray-400 line-through">
                      {product.original_price.toLocaleString()}원
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="h-2 bg-gray-50" />

      {/* Seller Dashboard Link (for sellers) */}
      <section className="px-4 py-4">
        <Link
          to="/seller"
          className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF4500]">
              <Play className="h-4 w-4 text-white fill-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">셀러 대시보드</p>
              <p className="text-[10px] text-gray-500">라이브 방송 시작하기</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50 px-4 py-6">
        <div className="flex items-center flex-wrap justify-center gap-4 mb-4">
          <a href="/terms" className="text-[10px] text-gray-500 hover:text-gray-700">이용약관</a>
          <a href="/privacy" className="text-[10px] text-gray-500 hover:text-gray-700">개인정보처리방침</a>
          <a href="/shipping-policy" className="text-[10px] text-gray-500 hover:text-gray-700">배송/환불</a>
        </div>
        <div className="text-center text-[10px] text-gray-400 space-y-1">
          <p>리스터코퍼레이션 | 대표: 정지원</p>
          <p>사업자등록번호: 479-09-02930</p>
          <p>부산광역시 금정구 놀이마당로26 1402</p>
          <p>© 2026 리스터코퍼레이션</p>
        </div>
        {user && (
          <button
            onClick={handleLogout}
            className="block mx-auto mt-4 text-[10px] text-gray-400 underline"
          >
            로그아웃
          </button>
        )}
      </footer>

      {/* BottomNav is rendered globally in App.tsx — removed duplicate here */}
    </div>
  )
}
