import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Users, ChevronRight, Circle, Sparkles, Zap, Gift, ShoppingBag, Clock, TrendingUp, Award, Star, Filter, ArrowUpDown, Tag, Heart, Package } from 'lucide-react'
import { CustomModal, useModal } from '@/components/CustomModal'

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
}

export default function HomePage() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<Stream[]>([])
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('viewers')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<{name: string, email: string} | null>(null)
  const { modal, showAlert, closeModal } = useModal()

  // No callback handling needed for Kakao Sync
  // Authentication is handled directly in the browser

  useEffect(() => {
    loadStreams()
    loadScheduledStreams()
    loadPopularProducts()
    loadUserInfo()
  }, [])

  function loadUserInfo() {
    // localStorage에서 사용자 정보 읽기
    const userName = localStorage.getItem('user_name') || localStorage.getItem('userName')
    const userId = localStorage.getItem('user_id')
    const session = localStorage.getItem('session')
    
    if (userName && (userId || session)) {
      setUser({
        name: userName,
        email: ''
      })
    }
  }

  function handleLogout() {
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_name')
    localStorage.removeItem('session')
    localStorage.removeItem('userId')
    localStorage.removeItem('userName')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('access_token')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('hasCartItems')
    
    setUser(null)
    showAlert('로그아웃되었습니다.', 'success', '로그아웃 완료')
    setTimeout(() => navigate('/'), 1500)
  }

  async function loadStreams() {
    try {
      setLoading(true)
      const response = await axios.get('/api/streams')
      if (response.data.success) {
        const liveStreams = (response.data.data || []).filter(
          (s: Stream) => !s.status || s.status === 'live'
        )
        setStreams(liveStreams)
      }
    } catch (error) {
      console.error('Failed to load streams:', error)
    } finally {
      setLoading(false)
    }
  }

  // Sort streams based on selected sort option
  const sortedStreams = [...streams].sort((a, b) => {
    if (sortBy === 'viewers') {
      return (b.viewer_count || 0) - (a.viewer_count || 0)
    } else if (sortBy === 'recent') {
      return b.id - a.id
    }
    return 0
  })

  async function loadScheduledStreams() {
    try {
      const response = await axios.get('/api/streams?status=scheduled')
      if (response.data.success) {
        const scheduled = (response.data.data || [])
          .filter((s: Stream) => s.status === 'scheduled')
          .slice(0, 4)
        setScheduledStreams(scheduled)
      }
    } catch (error) {
      console.error('Failed to load scheduled streams:', error)
    }
  }

  async function loadPopularProducts() {
    try {
      setProductsLoading(true)
      const response = await axios.get('/api/products/popular')
      if (response.data.success) {
        setPopularProducts((response.data.data || []).slice(0, 10))
      }
    } catch (error) {
      console.error('Failed to load popular products:', error)
    } finally {
      setProductsLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Custom Modal */}
      <CustomModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Toon.at Style Navigation - Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 sm:h-20 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] shadow-lg">
                <Play className="h-5 w-5 sm:h-6 sm:w-6 text-white fill-white" />
              </div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                유어 쇼핑
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => {
                  const liveSection = document.getElementById('live-section')
                  liveSection?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                쇼핑 영상
              </button>
              <Link to="/my-orders" className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">
                주문내역
              </Link>
              {user && (
                <Link to="/mypage" className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  마이페이지
                </Link>
              )}
            </nav>

            {/* Right Side Buttons */}
            <div className="flex items-center space-x-3">
              {user ? (
                <>
                  {/* Desktop: User Profile */}
                  <Link 
                    to="/mypage"
                    className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-white text-sm font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {user.name}
                    </span>
                  </Link>
                  
                  <Button 
                    onClick={handleLogout}
                    className="hidden sm:flex h-10 px-5 bg-gray-100 hover:bg-gray-200 text-gray-900 border-0 rounded-full text-sm font-medium"
                  >
                    로그아웃
                  </Button>
                  
                  {/* Mobile: User Profile */}
                  <Link 
                    to="/mypage"
                    className="sm:hidden flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-white text-sm font-bold"
                  >
                    {user.name.charAt(0)}
                  </Link>
                </>
              ) : (
                <Button 
                  onClick={() => {
                    // Save current URL as return destination
                    localStorage.setItem('loginReturnUrl', window.location.pathname)
                    navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname))
                  }}
                  className="hidden sm:flex h-10 px-5 bg-gray-100 hover:bg-gray-200 text-gray-900 border-0 rounded-full text-sm font-medium"
                >
                  로그인
                </Button>
              )}
              
              <Button className="h-10 px-5 sm:px-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFC700] hover:to-[#FF9500] text-gray-900 border-0 rounded-full text-sm font-bold shadow-lg hover:shadow-xl transition-all" asChild>
                <Link to="/seller">대시보드</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Toon.at Style with Big Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-yellow-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(138,90,205,0.08),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(255,215,0,0.08),transparent_50%)]"></div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 md:py-28 lg:py-36">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="text-left space-y-8">
              {/* Eyebrow */}
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-[#6A5ACD]/10 to-[#FFD700]/10 px-4 py-2 rounded-full border border-[#6A5ACD]/20">
                <Sparkles className="h-4 w-4 text-[#6A5ACD]" />
                <span className="text-sm font-bold text-[#6A5ACD]">
                  새로운 쇼핑 경험
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight">
                <span className="text-gray-900">누구나 쉽고</span>
                <br />
                <span className="text-gray-900">간편하게</span>
                <br />
                <span className="bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#6A5ACD] bg-clip-text text-transparent">
                  라이브 커머스 시작
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl sm:text-2xl text-gray-600 font-medium leading-relaxed">
                YouTube & TikTok 영상으로<br className="sm:hidden" /> 보는 순간 바로 구매!
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <button 
                  onClick={() => {
                    const liveSection = document.getElementById('live-section')
                    liveSection?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="group relative w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFC700] hover:to-[#FF9500] text-gray-900 font-bold text-lg rounded-2xl shadow-2xl hover:shadow-[0_20px_50px_rgba(255,215,0,0.4)] transition-all duration-300 transform hover:scale-105"
                >
                  <span className="flex items-center justify-center space-x-2">
                    <Play className="h-5 w-5 fill-current" />
                    <span>영상 쇼핑 시작하기</span>
                  </span>
                </button>
                
                <Link 
                  to="/seller/login"
                  className="group w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-[#6A5ACD] font-bold text-lg rounded-2xl border-2 border-[#6A5ACD] transition-all duration-300 flex items-center justify-center space-x-2"
                >
                  <Zap className="h-5 w-5" />
                  <span>판매자 시작하기</span>
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-8 pt-4">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 animate-pulse">
                    <Circle className="h-5 w-5 text-white fill-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{streams.length}</div>
                    <div className="text-sm text-gray-600">라이브 진행 중</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500]">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">1,000+</div>
                    <div className="text-sm text-gray-600">활성 사용자</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-[#6A5ACD] to-[#9370DB]">
                    <ShoppingBag className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">5,000+</div>
                    <div className="text-sm text-gray-600">성공 거래</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: 3D Illustration Placeholder */}
            <div className="relative hidden lg:block">
              <div className="relative w-full aspect-square max-w-xl mx-auto">
                {/* 3D Style Background Elements */}
                <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-3xl transform rotate-12 opacity-20 blur-xl animate-pulse"></div>
                <div className="absolute bottom-10 left-10 w-40 h-40 bg-gradient-to-br from-[#6A5ACD] to-[#9370DB] rounded-3xl transform -rotate-12 opacity-20 blur-xl animate-pulse delay-75"></div>
                
                {/* Main 3D Card */}
                <div className="relative z-10 w-full h-full bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-8 transform hover:scale-105 transition-all duration-300">
                  <div className="flex flex-col items-center justify-center h-full space-y-6">
                    {/* Icon Cluster */}
                    <div className="relative">
                      <div className="flex items-center justify-center h-32 w-32 rounded-3xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] shadow-2xl">
                        <Play className="h-16 w-16 text-white fill-white" />
                      </div>
                      <div className="absolute -top-4 -right-4 flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#6A5ACD] to-[#9370DB] shadow-xl">
                        <ShoppingBag className="h-8 w-8 text-white" />
                      </div>
                      <div className="absolute -bottom-4 -left-4 flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-500 to-red-500 shadow-xl">
                        <Gift className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-bold text-gray-900">영상 쇼핑</h3>
                      <p className="text-gray-600">보는 순간 바로 구매</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Card Layout with Rounded Corners & Shadows */}
      <section className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              유어 쇼핑을 선택하는 이유
            </h2>
            <p className="text-xl text-gray-600">
              플랫폼의 모든 것이 당신을 위해 준비되어 있습니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group relative bg-gradient-to-br from-purple-50 to-white rounded-3xl p-8 border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2">
              <div className="flex items-center justify-center h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#6A5ACD] to-[#9370DB] shadow-xl">
                <Play className="h-10 w-10 text-white fill-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                멀티 플랫폼 지원
              </h3>
              <p className="text-gray-600 text-center leading-relaxed">
                YouTube, TikTok 등 익숙한 플랫폼에서 실시간 쇼핑을 즐기세요
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative bg-gradient-to-br from-yellow-50 to-white rounded-3xl p-8 border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2">
              <div className="flex items-center justify-center h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] shadow-xl">
                <Zap className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                간편한 구매
              </h3>
              <p className="text-gray-600 text-center leading-relaxed">
                클릭 한 번으로 마음에 드는 상품을 바로 구매하세요
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative bg-gradient-to-br from-pink-50 to-white rounded-3xl p-8 border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2">
              <div className="flex items-center justify-center h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-500 to-red-500 shadow-xl">
                <Gift className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                특별한 혜택
              </h3>
              <p className="text-gray-600 text-center leading-relaxed">
                라이브 전용 할인과 깜짝 이벤트를 만나보세요
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="py-8 bg-white border-y border-gray-100 sticky top-16 sm:top-20 z-40 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center space-x-4 overflow-x-auto scrollbar-hide">
            {['all', 'fashion', 'beauty', 'electronics', 'food', 'home', 'sports'].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex-shrink-0 px-6 py-3 rounded-full font-semibold text-sm transition-all ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-[#6A5ACD] to-[#9370DB] text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category === 'all' && '전체'}
                {category === 'fashion' && '👗 패션'}
                {category === 'beauty' && '💄 뷰티'}
                {category === 'electronics' && '📱 가전'}
                {category === 'food' && '🍕 식품'}
                {category === 'home' && '🏠 홈/리빙'}
                {category === 'sports' && '⚽ 스포츠'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Live Streams Section */}
      <section id="live-section" className="py-16 sm:py-20 md:py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-2">
                지금 방송 중! 🔥
              </h2>
              <p className="text-xl text-gray-600">
                {streams.length > 0 ? `${streams.length}개의 라이브 진행 중` : '곧 새로운 라이브가 시작됩니다'}
              </p>
            </div>
            
            {/* Sort Options */}
            {streams.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSortBy('viewers')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    sortBy === 'viewers'
                      ? 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-gray-900 shadow-lg'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>인기순</span>
                </button>
                <button
                  onClick={() => setSortBy('recent')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    sortBy === 'recent'
                      ? 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-gray-900 shadow-lg'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span>최신순</span>
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video bg-gray-200 rounded-3xl mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : streams.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl shadow-lg">
              <div className="flex items-center justify-center h-24 w-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200">
                <Clock className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                곧 새로운 라이브가 시작됩니다
              </h3>
              <p className="text-gray-600 mb-6">
                멋진 쇼핑 콘텐츠를 준비 중입니다
              </p>
              <button className="px-6 py-3 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-gray-900 font-bold rounded-full shadow-lg hover:shadow-xl transition-all">
                알림 받기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedStreams.map((stream) => (
                <Link 
                  key={stream.id} 
                  to={`/live/${stream.id}`}
                  className="group block"
                >
                  <div className="relative bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                    {/* Thumbnail */}
                    <div className="relative aspect-video overflow-hidden bg-gray-100">
                      {stream.thumbnail_url ? (
                        <img
                          src={stream.thumbnail_url}
                          alt={stream.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <img
                          src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                          alt={stream.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      )}
                      
                      {/* Live Badge */}
                      <div className="absolute top-4 left-4">
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-500 rounded-full">
                          <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
                          <span className="text-xs font-bold text-white uppercase">LIVE</span>
                        </div>
                      </div>

                      {/* Viewer Count */}
                      {stream.viewer_count && (
                        <div className="absolute top-4 right-4">
                          <div className="flex items-center space-x-1 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
                            <Users className="h-3 w-3 text-white" />
                            <span className="text-xs font-bold text-white">
                              {stream.viewer_count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-[#6A5ACD] transition-colors">
                        {stream.title}
                      </h3>
                      {stream.description && (
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {stream.description}
                        </p>
                      )}
                      {stream.seller_name && (
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center mr-2">
                            <span className="text-xs font-bold text-white">
                              {stream.seller_name.charAt(0)}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {stream.seller_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Popular Products Section */}
      <section className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              인기 상품 🏆
            </h2>
            <p className="text-xl text-gray-600">
              지금 가장 많이 판매되는 상품을 만나보세요
            </p>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-2xl mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : popularProducts.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-3xl">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 text-lg">등록된 상품이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {popularProducts.map((product, index) => (
                <div key={product.id} className="group relative">
                  <div className="relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                    {/* Rank Badge */}
                    {index < 3 && (
                      <div className="absolute top-3 left-3 z-10">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-full font-bold text-sm shadow-lg ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                          index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                          'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                        }`}>
                          {index + 1}
                        </div>
                      </div>
                    )}

                    {/* Product Image */}
                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                      <img
                        src={product.image_url || 'https://via.placeholder.com/300'}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      
                      {/* Stock Badge */}
                      {product.stock === 0 ? (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="bg-red-500 text-white px-4 py-2 rounded-full font-bold text-sm">
                            품절
                          </div>
                        </div>
                      ) : product.stock <= 10 && (
                        <div className="absolute bottom-2 left-2">
                          <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                            재고 {product.stock}개
                          </div>
                        </div>
                      )}

                      {/* Discount Badge */}
                      {product.discount_rate > 0 && (
                        <div className="absolute top-2 right-2">
                          <div className="bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold">
                            {product.discount_rate}%
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-3 sm:p-4">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-[#6A5ACD] transition-colors">
                        {product.name}
                      </h3>
                      
                      {/* Price */}
                      <div className="flex flex-col space-y-1">
                        {product.discount_rate > 0 && product.original_price && (
                          <div className="text-xs text-gray-400 line-through">
                            {product.original_price.toLocaleString()}원
                          </div>
                        )}
                        <div className="flex items-baseline space-x-2">
                          <span className="text-lg sm:text-xl font-bold text-gray-900">
                            {product.current_price.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-600">원</span>
                        </div>
                      </div>

                      {/* Sales Count */}
                      {product.sold_count && product.sold_count > 0 && (
                        <div className="mt-2 flex items-center space-x-1 text-xs text-gray-500">
                          <ShoppingBag className="h-3 w-3" />
                          <span>{product.sold_count.toLocaleString()}개 판매</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Scheduled Streams */}
      {scheduledStreams.length > 0 && (
        <section className="py-16 sm:py-20 md:py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
                곧 시작하는 라이브 ⏰
              </h2>
              <p className="text-xl text-gray-600">
                놓치지 마세요!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {scheduledStreams.map((stream) => (
                <div key={stream.id} className="bg-gradient-to-br from-purple-50 to-white rounded-3xl overflow-hidden shadow-lg border border-gray-100">
                  <div className="relative aspect-video overflow-hidden bg-gray-100">
                    {stream.thumbnail_url ? (
                      <img
                        src={stream.thumbnail_url}
                        alt={stream.title}
                        className="h-full w-full object-cover opacity-75"
                      />
                    ) : (
                      <img
                        src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                        alt={stream.title}
                        className="h-full w-full object-cover opacity-75"
                      />
                    )}
                    
                    <div className="absolute top-4 left-4">
                      <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#6A5ACD] rounded-full">
                        <Clock className="h-3 w-3 text-white" />
                        <span className="text-xs font-bold text-white">
                          {stream.scheduled_start_time ? new Date(stream.scheduled_start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '곧 시작'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                      {stream.title}
                    </h3>
                    {stream.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {stream.description}
                      </p>
                    )}
                    <div className="flex items-center">
                      <img
                        src={stream.seller_profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(stream.seller_name)}&background=FFD700&color=000&size=64`}
                        alt={stream.seller_name}
                        className="h-8 w-8 rounded-full mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {stream.seller_name}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Platform Roles - Creator vs Viewer */}
      <section className="py-16 sm:py-20 md:py-24 bg-gradient-to-br from-purple-50 via-white to-yellow-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              당신의 역할을 선택하세요
            </h2>
            <p className="text-xl text-gray-600">
              창작자든 시청자든, 모두를 위한 플랫폼
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Creator Card */}
            <div className="relative bg-white rounded-3xl p-10 shadow-2xl border-2 border-[#6A5ACD] transform hover:scale-105 transition-all duration-300">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#6A5ACD] to-[#9370DB] shadow-xl">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
              </div>
              
              <div className="text-center mt-8">
                <h3 className="text-3xl font-extrabold text-gray-900 mb-4">
                  판매자 / 창작자
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  당신의 상품과 콘텐츠로 수익을 창출하세요
                </p>
                
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#6A5ACD]/10 flex items-center justify-center mt-0.5">
                      <svg className="h-3 w-3 text-[#6A5ACD]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">무료로 시작하는 라이브 커머스</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#6A5ACD]/10 flex items-center justify-center mt-0.5">
                      <svg className="h-3 w-3 text-[#6A5ACD]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">YouTube & TikTok 멀티 플랫폼</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#6A5ACD]/10 flex items-center justify-center mt-0.5">
                      <svg className="h-3 w-3 text-[#6A5ACD]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">실시간 판매 대시보드</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#6A5ACD]/10 flex items-center justify-center mt-0.5">
                      <svg className="h-3 w-3 text-[#6A5ACD]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">간편한 상품 관리</span>
                  </li>
                </ul>

                <Button className="w-full py-6 bg-gradient-to-r from-[#6A5ACD] to-[#9370DB] hover:from-[#5A4ABD] hover:to-[#8360CB] text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all" asChild>
                  <Link to="/seller/login">판매자로 시작하기</Link>
                </Button>
              </div>
            </div>

            {/* Viewer Card */}
            <div className="relative bg-white rounded-3xl p-10 shadow-2xl border-2 border-[#FFD700] transform hover:scale-105 transition-all duration-300">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] shadow-xl">
                  <ShoppingBag className="h-8 w-8 text-white" />
                </div>
              </div>
              
              <div className="text-center mt-8">
                <h3 className="text-3xl font-extrabold text-gray-900 mb-4">
                  구매자 / 시청자
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  재미있는 영상 쇼핑으로 특별한 상품을 만나세요
                </p>
                
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#FFD700]/20 flex items-center justify-center mt-0.5">
                      <svg className="h-3 w-3 text-[#FFA500]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">실시간 라이브 쇼핑</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#FFD700]/20 flex items-center justify-center mt-0.5">
                      <svg className="h-3 w-3 text-[#FFA500]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">라이브 전용 특가 할인</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#FFD700]/20 flex items-center justify-center mt-0.5">
                      <svg className="h-3 w-3 text-[#FFA500]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">간편 결제 시스템</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[#FFD700]/20 flex items-center justify-center mt-0.5">
                      <svg className="h-3 w-3 text-[#FFA500]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">안전한 구매 보호</span>
                  </li>
                </ul>

                <button 
                  onClick={() => {
                    const liveSection = document.getElementById('live-section')
                    liveSection?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="w-full py-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFC700] hover:to-[#FF9500] text-gray-900 font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all"
                >
                  쇼핑 시작하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 md:py-24 bg-gradient-to-r from-[#6A5ACD] to-[#9370DB]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center h-20 w-20 mb-8 rounded-3xl bg-white/20 backdrop-blur-sm">
            <Star className="h-10 w-10 text-white" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl sm:text-2xl text-purple-100 mb-10 leading-relaxed">
            무료로 시작하고, 성공적인 판매를 경험하세요
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button className="w-full sm:w-auto px-10 py-6 bg-white hover:bg-gray-100 text-[#6A5ACD] font-bold text-lg rounded-2xl shadow-2xl hover:shadow-[0_20px_50px_rgba(255,255,255,0.3)] transition-all" asChild>
              <Link to="/seller/login">무료로 시작하기</Link>
            </Button>
            <Link 
              to="/seller/login"
              className="group w-full sm:w-auto px-10 py-6 bg-transparent border-2 border-white hover:bg-white/10 text-white font-bold text-lg rounded-2xl transition-all flex items-center justify-center space-x-2"
            >
              <span>자세히 알아보기</span>
              <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <div className="flex items-center flex-wrap justify-center gap-6 mb-8">
            <a href="/terms" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              서비스 이용약관
            </a>
            <a href="/privacy" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              개인정보처리방침
            </a>
            <a href="/shipping-policy" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              배송 및 환불 정책
            </a>
          </div>

          <div className="text-center text-sm text-gray-600 space-y-2 mb-6">
            <div>
              <span className="font-semibold">서비스명:</span> 유어 라이브 | 
              <span className="font-semibold"> 대표자:</span> 정지원
            </div>
            <div>
              <span className="font-semibold">사업자등록번호:</span> 479-09-02930 | 
              <span className="font-semibold"> 통신판매업신고:</span> 2025-부산금정-0540
            </div>
            <div>
              <span className="font-semibold">고객센터:</span> <a href="tel:0507-0177-0432" className="hover:text-gray-900">0507-0177-0432</a> | 
              <span className="font-semibold"> 이메일:</span> <a href="mailto:jiwon@ur-team.com" className="hover:text-gray-900">jiwon@ur-team.com</a>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              © 2026 유어 라이브. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
