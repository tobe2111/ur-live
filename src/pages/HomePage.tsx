import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Users, ChevronRight, Circle, Sparkles, Zap, Gift, ShoppingBag, Clock, TrendingUp, Award, Star, Filter, ArrowUpDown, Tag, Heart, Package, Search } from 'lucide-react'
import { CustomModal, useModal } from '@/components/CustomModal'
import { LazyImage } from '@/components/LazyImage'
import { getUserName, getUserId, logout } from '@/utils/auth'
import NotificationDropdown from '@/components/NotificationDropdown'
import { useLiveStreams } from '@/hooks/useLiveStream'
import { BannerSection } from '@/components/home/BannerSection'
import { HeroSection } from '@/components/home/HeroSection'
import { FeaturesSection } from '@/components/home/FeaturesSection'
import { CTASection } from '@/components/home/CTASection'

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

interface SearchSuggestion {
  type: 'product' | 'seller'
  text: string
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

export default function HomePage() {
  // React Query로 스트림 데이터 가져오기 (30초마다 자동 갱신)
  const { data: liveStreamsData, isLoading: streamsLoading } = useLiveStreams()
  
  const [scheduledStreams, setScheduledStreams] = useState<Stream[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('viewers')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<{name: string, email: string} | null>(null)
  const { modal, showAlert, closeModal } = useModal()
  
  // 검색 자동완성 상태
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // React Query 데이터를 로컬 형식으로 변환
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

  // ✅ URL 파라미터 정리 및 초기 데이터 로드
  useEffect(() => {
    // 레거시 로그인 파라미터 정리
    const legacyParams = ['login', 'session', 'userId', 'userName', 'access_token', 'refresh_token']
    
    if (legacyParams.some(param => searchParams.has(param))) {
      console.log('[HomePage] 🧹 레거시 URL 파라미터 정리 중...')
      window.history.replaceState({}, '', window.location.pathname)
      console.log('[HomePage] ✅ URL 파라미터 정리 완료')
    }
    
    // React Query가 자동으로 스트림 로딩 & 30초마다 갱신
    loadScheduledStreams()
    loadBanners()
    loadUserInfo()
  }, [searchParams])

  async function loadUserInfo() {
    // Firebase Custom Claims에서 사용자 정보 읽기
    try {
      const userName = await getUserName()
      const userId = await getUserId()
      
      if (userName && userId) {
        setUser({
          name: userName,
          email: ''
        })
        console.log('[HomePage] User info loaded:', { userName, userId })
      } else {
        console.log('[HomePage] No user info found')
      }
    } catch (error) {
      console.error('[HomePage] Failed to load user info:', error)
    }
  }

  function handleLogout() {
    // ✅ auth.ts의 표준 logout 함수 사용
    logout()
    
    // 추가 장바구니 관련 키 삭제
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
      } else {
        console.error('[HomePage] Failed to load banners:', response.data.error)
      }
    } catch (error) {
      console.error('[HomePage] Failed to load banners:', error)
      // 배너는 필수가 아니므로 조용히 실패 처리
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
      const response = await api.get('/api/streams?status=scheduled')
      if (response.data.success) {
        const scheduled = (response.data.data || [])
          .filter((s: Stream) => s.status === 'scheduled')
          .slice(0, 4)
        setScheduledStreams(scheduled)
      } else {
        console.error('[HomePage] Failed to load scheduled streams:', response.data.error)
      }
    } catch (error) {
      console.error('[HomePage] Failed to load scheduled streams:', error)
      // 예약 방송은 필수가 아니므로 조용히 실패 처리
    }
  }

  // 검색 자동완성 디바운스
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const response = await api.get(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`)
        if (response.data.success) {
          setSuggestions(response.data.data.suggestions || [])
          setShowSuggestions(true)
        }
      } catch (error) {
        console.error('Failed to load suggestions:', error)
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  function handleShopNowClick() {
    const liveSection = document.getElementById('live-section')
    liveSection?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white">
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
                <Link to="/user/profile" className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  마이페이지
                </Link>
              )}
            </nav>

            {/* Right Side Buttons */}
            <div className="flex items-center space-x-3">
              {/* Search Button */}
              <Link 
                to="/search"
                className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"
                aria-label="검색"
              >
                <Search className="w-5 h-5 text-gray-600" />
              </Link>
              
              {user ? (
                <>
                  {/* Notification Bell */}
                  <NotificationDropdown userId={getUserId() || ''} />
                  {/* Desktop: User Profile */}
                  <Link 
                    to="/user/profile"
                    className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-white text-sm font-bold">
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
                    to="/user/profile"
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

      {/* Main Banner Section */}
      <BannerSection banners={banners} />

      {/* Hero Section */}
      <HeroSection liveStreamCount={streams.length} onShopNowClick={handleShopNowClick} />

      {/* Features Section */}
      <FeaturesSection />

      {/* Category Navigation */}
      <section className="py-8 bg-white border-y border-gray-100 sticky top-16 sm:top-20 z-40 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center space-x-4 overflow-x-auto scrollbar-hide">
            {['all', 'fashion', 'beauty', 'electronics', 'food', 'home', 'sports'].map((category) => (
              <Link
                key={category}
                to={category === 'all' ? '/browse' : `/browse?category=${category}`}
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
              </Link>
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
                지금 판매 중! 🔥
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

          {streamsLoading ? (
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
                        <LazyImage
                          src={stream.thumbnail_url}
                          alt={stream.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <LazyImage
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
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center mr-2">
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

      {/* CTA Section */}
      <CTASection />

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
              <span className="font-semibold">상호명:</span> 리스터코퍼레이션 | 
              <span className="font-semibold"> 대표자:</span> 정지원
            </div>
            <div>
              <span className="font-semibold">사업자등록번호:</span> 479-09-02930 | 
              <span className="font-semibold"> 통신판매업신고:</span> 2025-부산금정-0540
            </div>
            <div>
              <span className="font-semibold">사업장주소:</span> 부산광역시 금정구 놀이마당로26 1402
            </div>
            <div>
              <span className="font-semibold">대표전화:</span> <a href="tel:0507-0177-0432" className="hover:text-gray-900">0507-0177-0432</a> | 
              <span className="font-semibold"> 대표이메일:</span> <a href="mailto:jiwon@ur-team.com" className="hover:text-gray-900">jiwon@ur-team.com</a>
            </div>
            <div className="pt-2 border-t border-gray-300 mt-4">
              <span className="font-semibold">서비스 제공 기간:</span> 상품 구매 후 평균 7일 이내 배송 완료
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              © 2026 리스터코퍼레이션. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
