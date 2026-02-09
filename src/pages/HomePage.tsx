import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Users, ChevronRight, Circle, Menu, User } from 'lucide-react'

interface Stream {
  id: number
  title: string
  description: string
  youtube_video_id: string
  seller_name: string
  seller_profile_image?: string
  viewer_count?: number
  status: 'live' | 'scheduled' | 'ended'
  scheduled_start_time?: string
}

interface Product {
  id: number
  name: string
  current_price: number
  image_url: string
  sold_count?: number
}

export default function HomePage() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<Stream[]>([])
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<{name: string, email: string} | null>(null)

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
    const userName = localStorage.getItem('userName')
    const userEmail = localStorage.getItem('userEmail')
    
    if (userName) {
      setUser({
        name: userName,
        email: userEmail || ''
      })
    }
  }

  function handleLogout() {
    // localStorage 정리
    localStorage.removeItem('userId')
    localStorage.removeItem('userName')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('accessToken')
    
    // 상태 업데이트
    setUser(null)
    
    // 알림 표시
    alert('로그아웃되었습니다.')
  }

  async function loadStreams() {
    try {
      setLoading(true)
      const response = await axios.get('/api/streams')
      if (response.data.success) {
        // 진행 중인 라이브만 필터링
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

  async function loadScheduledStreams() {
    try {
      const response = await axios.get('/api/streams?status=scheduled')
      if (response.data.success) {
        const scheduled = (response.data.data || [])
          .filter((s: Stream) => s.status === 'scheduled')
          .slice(0, 4) // 최대 4개만 표시
        setScheduledStreams(scheduled)
      }
    } catch (error) {
      console.error('Failed to load scheduled streams:', error)
    }
  }

  async function loadPopularProducts() {
    try {
      const response = await axios.get('/api/products/popular')
      if (response.data.success) {
        setPopularProducts((response.data.data || []).slice(0, 6))
      }
    } catch (error) {
      console.error('Failed to load popular products:', error)
      // 폴백: 빈 배열
      setPopularProducts([])
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Apple-style Navigation Bar with Glass Effect - Mobile Optimized */}
      <header className="sticky top-0 z-50 apple-glass border-b border-black/5">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6">
          <div className="flex h-[44px] sm:h-[52px] items-center justify-between">
            {/* Logo - Responsive */}
            <Link to="/" className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#007aff] to-[#0051d5]">
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white fill-white" />
              </div>
              <span className="text-[17px] sm:text-[21px] font-semibold tracking-tight text-[#1d1d1f]">
                유어 라이브
              </span>
            </Link>

            {/* Search Bar - Desktop only */}
            <div className="hidden md:block flex-1 max-w-[480px] mx-8">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="상품 또는 판매자 검색"
                    className="w-full h-9 pl-9 pr-4 text-[14px] bg-[#f5f5f7] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff] transition-all"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </form>
            </div>

            {/* Navigation Links - Desktop only */}
            <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 mr-6 lg:mr-8">
              <button 
                onClick={() => {
                  const liveSection = document.getElementById('live-section')
                  liveSection?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-[14px] font-normal text-[#1d1d1f] hover:text-[#007aff] transition-colors"
              >
                라이브
              </button>
              <Link to="/my-orders" className="text-[14px] font-normal text-[#1d1d1f] hover:text-[#007aff] transition-colors">
                주문내역
              </Link>
            </nav>

            {/* Right side buttons */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {user ? (
                // 로그인된 상태
                <>
                  <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-[#f5f5f7] rounded-lg">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-[#007aff] to-[#0051d5] text-white text-[12px] font-semibold">
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-[14px] text-[#1d1d1f] font-medium">
                      {user.name}
                    </span>
                  </div>
                  <Button 
                    onClick={handleLogout}
                    className="hidden sm:flex h-9 border-0 shadow-none text-[14px] px-4 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"
                  >
                    로그아웃
                  </Button>
                  {/* Mobile: 아바타만 표시 */}
                  <div className="sm:hidden flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-[#007aff] to-[#0051d5] text-white text-[14px] font-semibold">
                    {user.name.charAt(0)}
                  </div>
                </>
              ) : (
                // 로그인되지 않은 상태
                <>
                  <Button 
                    onClick={() => navigate('/login')}
                    className="hidden sm:flex h-9 border-0 shadow-none text-[14px] px-4 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"
                  >
                    로그인
                  </Button>
                </>
              )}
              
              {/* Desktop CTA */}
              <Button className="hidden md:flex apple-button h-9 border-0 shadow-none text-[14px] px-4" asChild>
                <Link to="/seller/login">판매 시작하기</Link>
              </Button>
              
              {/* Mobile Menu Button */}
              <button className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg hover:bg-black/5 transition-colors">
                <Menu className="h-5 w-5 text-[#1d1d1f]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Mobile Optimized */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6 py-12 sm:py-16 md:py-20 lg:py-28">
          <div className="text-center smooth-appear">
            {/* Eyebrow */}
            <div className="mb-3 sm:mb-4">
              <Badge className="inline-flex items-center space-x-1.5 sm:space-x-2 bg-[#007aff]/10 text-[#007aff] border-0 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full font-normal">
                <Circle className="h-1.5 w-1.5 sm:h-2 sm:w-2 fill-[#007aff] text-[#007aff] animate-pulse" />
                <span className="text-[11px] sm:text-[12px] font-semibold tracking-tight">라이브 진행 중</span>
              </Badge>
            </div>

            {/* Large Headline - Responsive */}
            <h1 className="mb-3 sm:mb-4 text-[32px] sm:text-[40px] md:text-[48px] lg:text-[64px] font-semibold leading-[1.0625] tracking-tight text-[#1d1d1f] px-4 sm:px-0">
              <span className="bg-gradient-to-r from-[#ff3b30] to-[#ff9500] bg-clip-text text-transparent">YouTube Live</span>로
              <br />
              보는 순간 바로 산다.
            </h1>

            {/* Subheadline - Responsive */}
            <p className="mb-6 sm:mb-8 text-[17px] sm:text-[19px] md:text-[21px] lg:text-[24px] leading-[1.381] font-normal text-[#6e6e73] px-4 sm:px-0">
              실시간 YouTube 라이브 방송과 함께하는 새로운 쇼핑 경험.
            </p>

            {/* CTA Buttons - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
              <button 
                onClick={() => {
                  const liveSection = document.getElementById('live-streams-section')
                  liveSection?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="apple-button w-full sm:w-auto text-[15px] sm:text-[17px] py-3 sm:py-3"
              >
                라이브 보러가기
              </button>
                <Link to="/seller/login" className="apple-link text-[15px] sm:text-[17px] font-normal flex items-center">
                판매자 알아보기
                <ChevronRight className="inline-block ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Search - Mobile Only */}
      <section className="md:hidden bg-white border-b border-black/5 py-4">
        <div className="mx-auto max-w-[980px] px-4">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품 또는 판매자 검색"
                className="w-full h-10 pl-10 pr-4 text-[15px] bg-[#f5f5f7] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff] transition-all"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </form>
        </div>
      </section>

      {/* Live Streams Section - Horizontal Scroll */}
      <section id="live-section" className="bg-[#fbfbfd] py-10 sm:py-12 md:py-16">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6">
          {/* Section Header */}
          <div className="mb-6 sm:mb-8 md:mb-10">
            <h2 className="mb-2 text-[28px] sm:text-[32px] md:text-[40px] lg:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
              지금 라이브 중
            </h2>
            <p className="text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
              {streams.length > 0 ? `${streams.length}개의 라이브 방송이 진행 중입니다.` : '곧 새로운 라이브가 시작됩니다.'}
            </p>
          </div>

          {loading ? (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="apple-card animate-pulse overflow-hidden flex-shrink-0 w-[280px] sm:w-[320px]">
                  <div className="aspect-video bg-[#e8e8ed]"></div>
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="h-5 sm:h-6 bg-[#e8e8ed] rounded w-3/4"></div>
                    <div className="h-4 bg-[#e8e8ed] rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : streams.length === 0 ? (
            <div className="apple-card p-8 sm:p-12 md:p-16 text-center">
              <div className="mx-auto mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-[#f5f5f7]">
                <Play className="h-8 w-8 sm:h-10 sm:w-10 text-[#6e6e73]" />
              </div>
              <h3 className="mb-2 text-[21px] sm:text-[24px] md:text-[28px] font-semibold leading-[1.14286] tracking-tight text-[#1d1d1f]">
                곧 라이브가 시작됩니다
              </h3>
              <p className="mb-4 sm:mb-6 text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73] px-4 sm:px-0">
                새로운 라이브 방송을 준비 중입니다.
              </p>
              <button className="apple-button text-[15px] sm:text-[17px]">
                알림 받기
              </button>
            </div>
          ) : (
            <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {streams.map((stream) => (
                <Link 
                  key={stream.id} 
                  to={`/live/${stream.id}`}
                  className="group flex-shrink-0 w-[280px] sm:w-[320px]"
                >
                  <div className="apple-card overflow-hidden">
                    {/* Thumbnail */}
                    <div className="relative aspect-video overflow-hidden bg-[#f5f5f7]">
                      <img
                        src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                        alt={stream.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = 'https://via.placeholder.com/640x360/f5f5f7/6e6e73?text=Live'
                        }}
                      />
                      
                      {/* Live Indicator */}
                      <div className="absolute left-3 sm:left-4 top-3 sm:top-4">
                        <div className="flex items-center space-x-1.5 sm:space-x-2 rounded-full bg-[#ff3b30] px-2.5 py-1 sm:px-3 sm:py-1.5">
                          <Circle className="h-1.5 w-1.5 sm:h-2 sm:w-2 fill-white text-white animate-pulse" />
                          <span className="text-[11px] sm:text-[12px] font-semibold text-white tracking-tight">
                            LIVE
                          </span>
                        </div>
                      </div>

                      {/* Viewer Count */}
                      {stream.viewer_count && (
                        <div className="absolute right-3 sm:right-4 top-3 sm:top-4">
                          <div className="flex items-center space-x-1 sm:space-x-1.5 rounded-full bg-black/30 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5">
                            <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                            <span className="text-[11px] sm:text-[12px] font-semibold text-white tracking-tight">
                              {stream.viewer_count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content - Mobile Optimized */}
                    <div className="p-4 sm:p-5 md:p-6">
                      {/* Title - Responsive */}
                      <h3 className="mb-2 text-[17px] sm:text-[19px] md:text-[21px] font-semibold leading-[1.19048] tracking-tight text-[#1d1d1f] line-clamp-2 group-hover:text-[#007aff] transition-colors">
                        {stream.title}
                      </h3>

                      {/* Description - Responsive */}
                      {stream.description && (
                        <p className="mb-3 sm:mb-4 text-[13px] sm:text-[14px] leading-[1.42859] font-normal text-[#6e6e73] line-clamp-2">
                          {stream.description}
                        </p>
                      )}

                      {/* Seller Info */}
                      {stream.seller_name && (
                        <div className="flex items-center">
                          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#f5f5f7] flex items-center justify-center mr-2.5 sm:mr-3">
                            <User className="h-4 w-4 text-[#6e6e73]" />
                          </div>
                          <span className="text-[13px] sm:text-[14px] font-normal text-[#1d1d1f]">
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

      {/* Scheduled Streams Section */}
      {scheduledStreams.length > 0 && (
        <section className="bg-white py-10 sm:py-12 md:py-16">
          <div className="mx-auto max-w-[980px] px-4 sm:px-6">
            <div className="mb-6 sm:mb-8 md:mb-10">
              <h2 className="mb-2 text-[28px] sm:text-[32px] md:text-[40px] lg:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
                곧 시작하는 라이브
              </h2>
              <p className="text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                놓치지 마세요! 곧 시작됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {scheduledStreams.map((stream) => (
                <div key={stream.id} className="apple-card overflow-hidden opacity-90">
                  <div className="relative aspect-video overflow-hidden bg-[#f5f5f7]">
                    <img
                      src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                      alt={stream.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = 'https://via.placeholder.com/640x360/f5f5f7/6e6e73?text=Coming+Soon'
                      }}
                    />
                    
                    {/* Scheduled Badge */}
                    <div className="absolute left-3 sm:left-4 top-3 sm:top-4">
                      <div className="flex items-center space-x-1.5 sm:space-x-2 rounded-full bg-[#007aff] px-2.5 py-1 sm:px-3 sm:py-1.5">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[11px] sm:text-[12px] font-semibold text-white tracking-tight">
                          {stream.scheduled_start_time ? new Date(stream.scheduled_start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '곧 시작'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 md:p-6">
                    <h3 className="mb-2 text-[17px] sm:text-[19px] md:text-[21px] font-semibold leading-[1.19048] tracking-tight text-[#1d1d1f] line-clamp-2">
                      {stream.title}
                    </h3>
                    {stream.description && (
                      <p className="mb-3 sm:mb-4 text-[13px] sm:text-[14px] leading-[1.42859] font-normal text-[#6e6e73] line-clamp-2">
                        {stream.description}
                      </p>
                    )}
                    <div className="flex items-center">
                      <img
                        src={stream.seller_profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(stream.seller_name)}&background=007aff&color=fff&size=64`}
                        alt={stream.seller_name}
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-full mr-2.5 sm:mr-3"
                      />
                      <span className="text-[13px] sm:text-[14px] font-normal text-[#1d1d1f]">
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

      {/* Popular Products Section */}
      {popularProducts.length > 0 && (
        <section className="bg-[#fbfbfd] py-10 sm:py-12 md:py-16">
          <div className="mx-auto max-w-[980px] px-4 sm:px-6">
            <div className="mb-6 sm:mb-8 md:mb-10">
              <h2 className="mb-2 text-[28px] sm:text-[32px] md:text-[40px] lg:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
                라이브에서 인기 상품
              </h2>
              <p className="text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                많은 분들이 선택한 베스트 아이템
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
              {popularProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="group"
                >
                  <div className="apple-card overflow-hidden">
                    <div className="relative aspect-square overflow-hidden bg-[#f5f5f7]">
                      <img
                        src={product.image_url || 'https://via.placeholder.com/400x400/f5f5f7/6e6e73?text=Product'}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = 'https://via.placeholder.com/400x400/f5f5f7/6e6e73?text=Product'
                        }}
                      />
                      {product.sold_count && product.sold_count > 0 && (
                        <div className="absolute right-2 sm:right-3 top-2 sm:top-3">
                          <div className="rounded-full bg-black/70 backdrop-blur-md px-2 py-1 sm:px-2.5 sm:py-1">
                            <span className="text-[10px] sm:text-[11px] font-semibold text-white">
                              {product.sold_count}개 판매
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-4">
                      <h3 className="mb-1 sm:mb-2 text-[14px] sm:text-[15px] font-normal leading-[1.2] text-[#1d1d1f] line-clamp-2 group-hover:text-[#007aff] transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-[15px] sm:text-[17px] font-semibold text-[#1d1d1f]">
                        {product.current_price.toLocaleString()}원
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section - Mobile Optimized */}
      <section className="bg-white py-10 sm:py-12 md:py-16">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6">
          <h2 className="mb-8 sm:mb-10 md:mb-12 text-center text-[28px] sm:text-[32px] md:text-[40px] lg:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
            유어 라이브를 선택하는 이유
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-7 md:gap-8">
            {/* Feature 1 - YouTube Live 강조 */}
            <div className="text-center px-4 sm:px-0">
              <div className="mx-auto mb-4 sm:mb-5 md:mb-6 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff0000] to-[#cc0000]">
                <svg className="h-7 w-7 sm:h-8 sm:w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <h3 className="mb-2 sm:mb-3 text-[19px] sm:text-[21px] md:text-[24px] font-semibold leading-[1.16667] tracking-tight text-[#1d1d1f]">
                YouTube Live 연동
              </h3>
              <p className="text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                익숙한 YouTube 라이브로 실시간 쇼핑을 즐기세요.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center px-4 sm:px-0">
              <div className="mx-auto mb-4 sm:mb-5 md:mb-6 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#34c759] to-[#248a3d]">
                <svg className="h-7 w-7 sm:h-8 sm:w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mb-2 sm:mb-3 text-[19px] sm:text-[21px] md:text-[24px] font-semibold leading-[1.16667] tracking-tight text-[#1d1d1f]">
                간편한 구매
              </h3>
              <p className="text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                마음에 드는 상품을 클릭 한 번으로 바로 구매하세요.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center px-4 sm:px-0 sm:col-span-2 md:col-span-1">
              <div className="mx-auto mb-4 sm:mb-5 md:mb-6 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9500] to-[#c93400]">
                <svg className="h-7 w-7 sm:h-8 sm:w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <h3 className="mb-2 sm:mb-3 text-[19px] sm:text-[21px] md:text-[24px] font-semibold leading-[1.16667] tracking-tight text-[#1d1d1f]">
                특별한 혜택
              </h3>
              <p className="text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                라이브 전용 할인과 깜짝 이벤트를 만나보세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Mobile Optimized */}
      <section className="bg-[#fbfbfd] py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-[692px] px-4 sm:px-6 text-center">
          <h2 className="mb-3 sm:mb-4 text-[28px] sm:text-[32px] md:text-[40px] lg:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
            지금 바로 판매를 시작하세요.
          </h2>
          <p className="mb-6 sm:mb-8 text-[17px] sm:text-[19px] md:text-[21px] leading-[1.381] font-normal text-[#6e6e73] px-4 sm:px-0">
            간편한 시작으로 성공적인 판매를 경험하세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
            <Button className="apple-button w-full sm:w-auto text-[15px] sm:text-[17px] py-3 sm:py-3" asChild>
              <Link to="/seller/login">무료로 시작하기</Link>
            </Button>
            <Link to="/seller/login" className="apple-link text-[15px] sm:text-[17px] font-normal flex items-center">
              자세히 알아보기
              <ChevronRight className="inline-block ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer - Mobile Optimized */}
      <footer className="border-t border-black/5 bg-[#f5f5f7]">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6 py-8 sm:py-10">
          {/* Footer Links - Mobile Optimized */}
          <div className="flex items-center flex-wrap justify-center gap-4 sm:gap-6 mb-6">
            <a href="/terms" className="text-[11px] sm:text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors whitespace-nowrap">
              서비스 이용약관
            </a>
            <a href="/privacy" className="text-[11px] sm:text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors whitespace-nowrap">
              개인정보처리방침
            </a>
            <a href="/shipping-policy" className="text-[11px] sm:text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors whitespace-nowrap">
              배송 및 환불 정책
            </a>
          </div>

          {/* Company Information */}
          <div className="text-center text-[11px] sm:text-[12px] leading-[1.6] text-[#6e6e73] space-y-2 mb-4">
            <div>
              <span className="font-medium">서비스명:</span> 유어 라이브 | 
              <span className="font-medium"> 대표자:</span> 정지원
            </div>
            <div>
              <span className="font-medium">사업자등록번호:</span> 479-09-02930 | 
              <span className="font-medium"> 통신판매업신고:</span> 2025-부산금정-0540
            </div>
            <div>
              <span className="font-medium">고객센터:</span> <a href="tel:0507-0177-0432" className="hover:text-[#1d1d1f] transition-colors">0507-0177-0432</a> | 
              <span className="font-medium"> 이메일:</span> <a href="mailto:jiwon@ur-team.com" className="hover:text-[#1d1d1f] transition-colors">jiwon@ur-team.com</a>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center">
            <p className="text-[11px] sm:text-[12px] leading-[1.33337] font-normal text-[#6e6e73]">
              © 2026 유어 라이브. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
