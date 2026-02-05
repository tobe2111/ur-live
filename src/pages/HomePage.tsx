import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Users, ChevronRight, Circle, Menu } from 'lucide-react'

interface Stream {
  id: number
  title: string
  description: string
  youtube_video_id: string
  seller_name: string
  seller_profile_image?: string
  viewer_count?: number
}

export default function HomePage() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Handle Kakao login callback
  useEffect(() => {
    const loginSuccess = searchParams.get('login')
    const sessionToken = searchParams.get('session')
    const userId = searchParams.get('userId')
    const userName = searchParams.get('userName')
    const error = searchParams.get('error')
    const errorDetail = searchParams.get('detail')

    // Handle error
    if (error) {
      console.error('[HomePage] Kakao login error:', error, errorDetail)
      
      // Clean URL to prevent infinite loop
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      
      // Show error message
      alert(`로그인 실패: ${errorDetail || error}\n\n카카오 개발자 콘솔 설정을 확인해주세요.`)
      return
    }

    // Handle success
    if (loginSuccess === 'success' && sessionToken && userId) {
      console.log('[HomePage] Kakao login callback detected')
      
      // Save login info to localStorage
      localStorage.setItem('access_token', sessionToken)
      localStorage.setItem('user_id', userId)
      if (userName) {
        localStorage.setItem('user_name', decodeURIComponent(userName))
      }
      
      console.log('[HomePage] Login info saved, user_id:', userId)
      
      // Clean URL parameters
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      
      // Show success message
      alert('로그인 되었습니다!')
      
      // Check if user has items in cart and redirect to checkout
      axios.get(`/api/cart/${userId}`).then(response => {
        if (response.data.success && response.data.data.length > 0) {
          console.log('[HomePage] Cart has items, redirecting to checkout')
          navigate('/checkout')
        }
      }).catch(error => {
        console.error('[HomePage] Failed to check cart:', error)
      })
    }
  }, [searchParams, navigate])

  useEffect(() => {
    loadStreams()
  }, [])

  async function loadStreams() {
    try {
      setLoading(true)
      const response = await axios.get('/api/streams')
      if (response.data.success) {
        setStreams(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load streams:', error)
    } finally {
      setLoading(false)
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

            {/* Navigation Links - Desktop only */}
            <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
              <Link to="/" className="text-[14px] font-normal text-[#1d1d1f] hover:text-[#007aff] transition-colors">
                라이브
              </Link>
              <Link to="/categories" className="text-[14px] font-normal text-[#1d1d1f] hover:text-[#007aff] transition-colors">
                카테고리
              </Link>
              <Link to="/my-orders" className="text-[14px] font-normal text-[#1d1d1f] hover:text-[#007aff] transition-colors">
                주문내역
              </Link>
            </nav>

            {/* Right side buttons */}
            <div className="flex items-center space-x-2">
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
              보는 순간,
              <br />
              바로 산다.
            </h1>

            {/* Subheadline - Responsive */}
            <p className="mb-6 sm:mb-8 text-[17px] sm:text-[19px] md:text-[21px] lg:text-[24px] leading-[1.381] font-normal text-[#6e6e73] px-4 sm:px-0">
              실시간 라이브 쇼핑의 새로운 경험을 만나보세요.
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

      {/* Content Section - Mobile Optimized */}
      <section id="live-streams-section" className="bg-[#fbfbfd] py-10 sm:py-12 md:py-16">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6">
          {/* Section Header - Responsive */}
          <div className="mb-6 sm:mb-8 md:mb-10">
            <h2 className="mb-2 text-[28px] sm:text-[32px] md:text-[40px] lg:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
              지금 라이브 중
            </h2>
            <p className="text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
              {streams.length > 0 ? `${streams.length}개의 라이브 방송이 진행 중입니다.` : '곧 새로운 라이브가 시작됩니다.'}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="apple-card animate-pulse overflow-hidden">
                  <div className="aspect-video bg-[#e8e8ed]"></div>
                  <div className="p-4 sm:p-5 md:p-6 space-y-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {streams.map((stream) => (
                <Link 
                  key={stream.id} 
                  to={`/live/${stream.id}`}
                  className="group"
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
                      
                      {/* Live Indicator - Mobile Optimized */}
                      <div className="absolute left-3 sm:left-4 top-3 sm:top-4">
                        <div className="flex items-center space-x-1.5 sm:space-x-2 rounded-full bg-[#ff3b30] px-2.5 py-1 sm:px-3 sm:py-1.5">
                          <Circle className="h-1.5 w-1.5 sm:h-2 sm:w-2 fill-white text-white animate-pulse" />
                          <span className="text-[11px] sm:text-[12px] font-semibold text-white tracking-tight">
                            LIVE
                          </span>
                        </div>
                      </div>

                      {/* Viewer Count - Mobile Optimized */}
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

                      {/* Seller Info - Mobile Optimized */}
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Section - Mobile Optimized */}
      <section className="bg-white py-10 sm:py-12 md:py-16">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6">
          <h2 className="mb-8 sm:mb-10 md:mb-12 text-center text-[28px] sm:text-[32px] md:text-[40px] lg:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
            유어 라이브를 선택하는 이유
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-7 md:gap-8">
            {/* Feature 1 */}
            <div className="text-center px-4 sm:px-0">
              <div className="mx-auto mb-4 sm:mb-5 md:mb-6 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007aff] to-[#0051d5]">
                <Play className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="mb-2 sm:mb-3 text-[19px] sm:text-[21px] md:text-[24px] font-semibold leading-[1.16667] tracking-tight text-[#1d1d1f]">
                실시간 소통
              </h3>
              <p className="text-[15px] sm:text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                판매자와 실시간으로 대화하며 궁금한 점을 바로 해결하세요.
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
        <div className="mx-auto max-w-[980px] px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
            <p className="text-[11px] sm:text-[12px] leading-[1.33337] font-normal text-[#6e6e73] text-center sm:text-left">
              © 2026 유어 라이브. All rights reserved.
            </p>
            <div className="flex items-center flex-wrap justify-center gap-4 sm:gap-6">
              <Link to="/privacy" className="text-[11px] sm:text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors whitespace-nowrap">
                개인정보 처리방침
              </Link>
              <Link to="/terms" className="text-[11px] sm:text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors whitespace-nowrap">
                이용 약관
              </Link>
              <a href="http://pf.kakao.com/_AITdn/chat" target="_blank" rel="noopener noreferrer" className="text-[11px] sm:text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors whitespace-nowrap">
                고객센터
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
