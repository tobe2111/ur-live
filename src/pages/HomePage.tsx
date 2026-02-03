import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Users, ChevronRight, Circle } from 'lucide-react'

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
      {/* Apple-style Navigation Bar with Glass Effect */}
      <header className="sticky top-0 z-50 apple-glass border-b border-black/5">
        <div className="mx-auto max-w-[980px] px-6">
          <div className="flex h-[52px] items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#007aff] to-[#0051d5]">
                <Play className="h-4 w-4 text-white fill-white" />
              </div>
              <span className="text-[21px] font-semibold tracking-tight text-[#1d1d1f]">
                유어 라이브
              </span>
            </Link>

            {/* Navigation Links - Apple style */}
            <nav className="hidden md:flex items-center space-x-8">
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

            {/* CTA */}
            <Button className="hidden md:flex apple-button h-9 border-0 shadow-none">
              판매 시작하기
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section - Apple style with large typography */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-[980px] px-6 py-20 md:py-28">
          <div className="text-center smooth-appear">
            {/* Eyebrow */}
            <div className="mb-4">
              <Badge className="inline-flex items-center space-x-2 bg-[#007aff]/10 text-[#007aff] border-0 px-3 py-1.5 rounded-full font-normal">
                <Circle className="h-2 w-2 fill-[#007aff] text-[#007aff] animate-pulse" />
                <span className="text-[12px] font-semibold tracking-tight">라이브 진행 중</span>
              </Badge>
            </div>

            {/* Large Headline - Apple style */}
            <h1 className="mb-4 text-[48px] md:text-[64px] font-semibold leading-[1.0625] tracking-tight text-[#1d1d1f]">
              보는 순간,
              <br />
              바로 산다.
            </h1>

            {/* Subheadline */}
            <p className="mb-8 text-[21px] md:text-[24px] leading-[1.381] font-normal text-[#6e6e73]">
              실시간 라이브 쇼핑의 새로운 경험을 만나보세요.
            </p>

            {/* CTA Buttons - Apple style */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="apple-button">
                라이브 보러가기
              </button>
              <Link to="/seller-login" className="apple-link text-[17px] font-normal">
                판매자 알아보기
                <ChevronRight className="inline-block ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="bg-[#fbfbfd] py-16">
        <div className="mx-auto max-w-[980px] px-6">
          {/* Section Header - Apple style */}
          <div className="mb-10">
            <h2 className="mb-2 text-[40px] md:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
              지금 라이브 중
            </h2>
            <p className="text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
              {streams.length > 0 ? `${streams.length}개의 라이브 방송이 진행 중입니다.` : '곧 새로운 라이브가 시작됩니다.'}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="apple-card animate-pulse overflow-hidden">
                  <div className="aspect-video bg-[#e8e8ed]"></div>
                  <div className="p-6 space-y-3">
                    <div className="h-6 bg-[#e8e8ed] rounded w-3/4"></div>
                    <div className="h-4 bg-[#e8e8ed] rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : streams.length === 0 ? (
            <div className="apple-card p-16 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#f5f5f7]">
                <Play className="h-10 w-10 text-[#6e6e73]" />
              </div>
              <h3 className="mb-2 text-[28px] font-semibold leading-[1.14286] tracking-tight text-[#1d1d1f]">
                곧 라이브가 시작됩니다
              </h3>
              <p className="mb-6 text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                새로운 라이브 방송을 준비 중입니다.
              </p>
              <button className="apple-button">
                알림 받기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      
                      {/* Live Indicator - Simple and clear */}
                      <div className="absolute left-4 top-4">
                        <div className="flex items-center space-x-2 rounded-full bg-[#ff3b30] px-3 py-1.5">
                          <Circle className="h-2 w-2 fill-white text-white animate-pulse" />
                          <span className="text-[12px] font-semibold text-white tracking-tight">
                            LIVE
                          </span>
                        </div>
                      </div>

                      {/* Viewer Count */}
                      {stream.viewer_count && (
                        <div className="absolute right-4 top-4">
                          <div className="flex items-center space-x-1.5 rounded-full bg-black/30 backdrop-blur-md px-3 py-1.5">
                            <Users className="h-3 w-3 text-white" />
                            <span className="text-[12px] font-semibold text-white tracking-tight">
                              {stream.viewer_count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      {/* Title */}
                      <h3 className="mb-2 text-[21px] font-semibold leading-[1.19048] tracking-tight text-[#1d1d1f] line-clamp-2 group-hover:text-[#007aff] transition-colors">
                        {stream.title}
                      </h3>

                      {/* Description */}
                      {stream.description && (
                        <p className="mb-4 text-[14px] leading-[1.42859] font-normal text-[#6e6e73] line-clamp-2">
                          {stream.description}
                        </p>
                      )}

                      {/* Seller Info */}
                      <div className="flex items-center">
                        <img
                          src={stream.seller_profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(stream.seller_name)}&background=007aff&color=fff&size=64`}
                          alt={stream.seller_name}
                          className="h-8 w-8 rounded-full mr-3"
                        />
                        <span className="text-[14px] font-normal text-[#1d1d1f]">
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

      {/* Features Section - Apple's three-up layout */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-[980px] px-6">
          <h2 className="mb-12 text-center text-[40px] md:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
            유어 라이브를 선택하는 이유
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007aff] to-[#0051d5]">
                <Play className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-3 text-[24px] font-semibold leading-[1.16667] tracking-tight text-[#1d1d1f]">
                실시간 소통
              </h3>
              <p className="text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                판매자와 실시간으로 대화하며 궁금한 점을 바로 해결하세요.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#34c759] to-[#248a3d]">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mb-3 text-[24px] font-semibold leading-[1.16667] tracking-tight text-[#1d1d1f]">
                간편한 구매
              </h3>
              <p className="text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                마음에 드는 상품을 클릭 한 번으로 바로 구매하세요.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9500] to-[#c93400]">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <h3 className="mb-3 text-[24px] font-semibold leading-[1.16667] tracking-tight text-[#1d1d1f]">
                특별한 혜택
              </h3>
              <p className="text-[17px] leading-[1.47059] font-normal text-[#6e6e73]">
                라이브 전용 할인과 깜짝 이벤트를 만나보세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Apple style */}
      <section className="bg-[#fbfbfd] py-20">
        <div className="mx-auto max-w-[692px] px-6 text-center">
          <h2 className="mb-4 text-[40px] md:text-[48px] font-semibold leading-[1.0834933333] tracking-tight text-[#1d1d1f]">
            지금 바로 판매를 시작하세요.
          </h2>
          <p className="mb-8 text-[21px] leading-[1.381] font-normal text-[#6e6e73]">
            간편한 시작으로 성공적인 판매를 경험하세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="apple-button">
              무료로 시작하기
            </button>
            <Link to="/learn-more" className="apple-link text-[17px] font-normal">
              자세히 알아보기
              <ChevronRight className="inline-block ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer - Apple style */}
      <footer className="border-t border-black/5 bg-[#f5f5f7]">
        <div className="mx-auto max-w-[980px] px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="mb-4 md:mb-0 text-[12px] leading-[1.33337] font-normal text-[#6e6e73]">
              © 2026 유어 라이브. All rights reserved.
            </p>
            <div className="flex items-center space-x-6">
              <Link to="/privacy" className="text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                개인정보 처리방침
              </Link>
              <Link to="/terms" className="text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                이용 약관
              </Link>
              <Link to="/contact" className="text-[12px] leading-[1.33337] font-normal text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                고객센터
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
