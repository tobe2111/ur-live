import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Users, ShoppingBag, Store, Search, Bell, Heart, Zap, TrendingUp, Gift } from 'lucide-react'

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
    <div className="min-h-screen bg-white">
      {/* Mobile-First Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="gradient-pink flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg">
                <Play className="h-5 w-5 text-white fill-white" />
              </div>
              <span className="text-xl font-black bg-gradient-to-r from-[#FF0080] to-[#FF6B9D] bg-clip-text text-transparent">
                유어 라이브
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link to="/" className="text-sm font-semibold text-gray-900 hover:text-[#FF0080] transition-colors">
                라이브
              </Link>
              <Link to="/categories" className="text-sm font-semibold text-gray-600 hover:text-[#FF0080] transition-colors">
                카테고리
              </Link>
              <Link to="/my-orders" className="text-sm font-semibold text-gray-600 hover:text-[#FF0080] transition-colors">
                주문내역
              </Link>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-pink-50">
                <Search className="h-5 w-5 text-gray-600" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-pink-50">
                <Bell className="h-5 w-5 text-gray-600" />
              </Button>
              <Button className="hidden md:flex gradient-pink text-white font-bold rounded-full px-6 hover:shadow-lg transition-all">
                판매자 시작하기
              </Button>
            </div>
          </div>

          {/* Mobile Categories Bar */}
          <div className="mt-3 flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            <Badge className="gradient-pink text-white border-0 px-4 py-2 whitespace-nowrap cursor-pointer">
              🔥 전체
            </Badge>
            <Badge variant="outline" className="border-gray-200 bg-white text-gray-700 px-4 py-2 whitespace-nowrap cursor-pointer hover:border-[#FF0080]">
              패션
            </Badge>
            <Badge variant="outline" className="border-gray-200 bg-white text-gray-700 px-4 py-2 whitespace-nowrap cursor-pointer hover:border-[#FF0080]">
              뷰티
            </Badge>
            <Badge variant="outline" className="border-gray-200 bg-white text-gray-700 px-4 py-2 whitespace-nowrap cursor-pointer hover:border-[#FF0080]">
              푸드
            </Badge>
            <Badge variant="outline" className="border-gray-200 bg-white text-gray-700 px-4 py-2 whitespace-nowrap cursor-pointer hover:border-[#FF0080]">
              리빙
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero Banner - Mobile First */}
      <section className="gradient-purple relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        <div className="relative mx-auto max-w-7xl px-4 py-12 md:py-16">
          <div className="text-center">
            <Badge className="mb-4 inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm text-white border-0 px-4 py-2 pulse-glow">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="font-bold">지금 LIVE 중</span>
            </Badge>
            <h1 className="mb-4 text-4xl md:text-6xl font-black text-white leading-tight">
              보는 순간,
              <br />
              <span className="inline-block">바로 산다! 🛍️</span>
            </h1>
            <p className="mb-8 text-lg md:text-xl text-white/90 font-medium">
              실시간 라이브 쇼핑의 새로운 경험
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
              <Button size="lg" className="w-full sm:w-auto bg-white text-[#FF0080] hover:bg-gray-50 font-bold rounded-full px-8 shadow-xl">
                <Play className="mr-2 h-5 w-5 fill-current" />
                라이브 보러가기
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-white text-white hover:bg-white/10 font-bold rounded-full px-8">
                판매자 신청
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-100">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl md:text-3xl font-black gradient-pink bg-clip-text text-transparent">
                10K+
              </div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">누적 시청자</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-black gradient-pink bg-clip-text text-transparent">
                50+
              </div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">진행 중 라이브</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-black gradient-pink bg-clip-text text-transparent">
                99%
              </div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">만족도</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Streams Section */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-1">
              🔥 지금 라이브 중
            </h2>
            <p className="text-sm text-gray-500">
              {streams.length}개의 라이브가 진행 중입니다
            </p>
          </div>
          <Button
            onClick={loadStreams}
            variant="outline"
            className="rounded-full border-2 border-gray-200 hover:border-[#FF0080] hover:text-[#FF0080]"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse overflow-hidden rounded-3xl border-0 shadow-md">
                <div className="aspect-[9/16] bg-gray-200"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
            <CardContent>
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-purple-100 float">
                <Play className="h-12 w-12 text-[#FF0080]" />
              </div>
              <h3 className="mb-2 text-2xl font-bold text-gray-900">
                곧 라이브가 시작됩니다! 🎬
              </h3>
              <p className="mb-6 text-gray-500">
                새로운 라이브 방송을 준비 중입니다. 조금만 기다려주세요!
              </p>
              <Button className="gradient-pink text-white font-bold rounded-full px-8 shadow-lg hover:shadow-xl transition-all">
                <Gift className="mr-2 h-5 w-5" />
                알림 받기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {streams.map((stream) => (
              <Link key={stream.id} to={`/live/${stream.id}`} className="group">
                <Card className="overflow-hidden rounded-3xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                  <CardContent className="p-0">
                    {/* Vertical Video Thumbnail */}
                    <div className="relative aspect-[9/16] overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100">
                      <img
                        src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                        alt={stream.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = 'https://via.placeholder.com/405x720/FF0080/FFFFFF?text=LIVE'
                        }}
                      />
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 gradient-overlay"></div>

                      {/* ON AIR Badge */}
                      <div className="absolute left-3 top-3">
                        <Badge className="gradient-pink text-white border-0 px-3 py-1 font-bold pulse-glow">
                          <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                          </span>
                          ON AIR
                        </Badge>
                      </div>

                      {/* Viewer Count */}
                      {stream.viewer_count && (
                        <div className="absolute right-3 top-3">
                          <Badge className="bg-black/50 backdrop-blur-sm text-white border-0 px-3 py-1">
                            <Users className="mr-1 h-3 w-3" />
                            {stream.viewer_count.toLocaleString()}
                          </Badge>
                        </div>
                      )}

                      {/* Bottom Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-center mb-2">
                          <img
                            src={stream.seller_profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(stream.seller_name)}&background=FF0080&color=fff&size=128`}
                            alt={stream.seller_name}
                            className="h-10 w-10 rounded-full border-2 border-white shadow-lg mr-3"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm truncate">
                              {stream.seller_name}
                            </p>
                            <p className="text-white/80 text-xs">라이브 방송 중</p>
                          </div>
                        </div>
                        <h3 className="text-white font-bold text-base line-clamp-2 mb-2">
                          {stream.title}
                        </h3>
                        {stream.description && (
                          <p className="text-white/80 text-xs line-clamp-1">
                            {stream.description}
                          </p>
                        )}
                      </div>

                      {/* Hover Action Button */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
                        <Button className="gradient-pink text-white font-bold rounded-full px-8 py-6 shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="mr-2 h-5 w-5 fill-white" />
                          지금 입장하기
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Features Section */}
      <section className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              왜 유어 라이브일까요? ✨
            </h2>
            <p className="text-lg text-gray-600">
              라이브 쇼핑의 모든 것이 여기에
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white overflow-hidden">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full gradient-pink shadow-lg">
                  <Zap className="h-10 w-10 text-white" />
                </div>
                <h3 className="mb-3 text-xl font-black text-gray-900">
                  실시간 소통
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  판매자와 실시간으로 대화하며
                  <br />
                  궁금한 점을 바로 해결하세요
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white overflow-hidden">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full gradient-purple shadow-lg">
                  <ShoppingBag className="h-10 w-10 text-white" />
                </div>
                <h3 className="mb-3 text-xl font-black text-gray-900">
                  원클릭 구매
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  마음에 드는 상품을
                  <br />
                  클릭 한 번으로 바로 구매
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white overflow-hidden">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 shadow-lg">
                  <Heart className="h-10 w-10 text-white fill-white" />
                </div>
                <h3 className="mb-3 text-xl font-black text-gray-900">
                  특별 혜택
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  라이브 전용 할인과
                  <br />
                  깜짝 이벤트를 만나보세요
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="gradient-purple py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
            당신도 라이브 셀러가 될 수 있어요! 🚀
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8">
            지금 시작하면 첫 달 수수료 무료! 간편한 시작으로 성공적인 판매를 경험하세요.
          </p>
          <Button size="lg" className="bg-white text-[#FF0080] hover:bg-gray-50 font-bold rounded-full px-10 py-6 text-lg shadow-2xl">
            <Store className="mr-2 h-6 w-6" />
            무료로 시작하기
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0">
              <div className="flex items-center space-x-2 mb-2">
                <div className="gradient-pink flex h-8 w-8 items-center justify-center rounded-xl">
                  <Play className="h-4 w-4 text-white fill-white" />
                </div>
                <span className="text-lg font-black gradient-pink bg-clip-text text-transparent">
                  유어 라이브
                </span>
              </div>
              <p className="text-sm text-gray-500">
                © 2026 유어 라이브. All rights reserved.
              </p>
            </div>
            <div className="flex space-x-6">
              <Link to="/about" className="text-sm text-gray-600 hover:text-[#FF0080] transition-colors">
                회사소개
              </Link>
              <Link to="/terms" className="text-sm text-gray-600 hover:text-[#FF0080] transition-colors">
                이용약관
              </Link>
              <Link to="/privacy" className="text-sm text-gray-600 hover:text-[#FF0080] transition-colors">
                개인정보처리방침
              </Link>
              <Link to="/contact" className="text-sm text-gray-600 hover:text-[#FF0080] transition-colors">
                고객센터
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl">
        <div className="flex items-center justify-around py-3">
          <Link to="/" className="flex flex-col items-center space-y-1">
            <Play className="h-6 w-6 text-[#FF0080] fill-[#FF0080]" />
            <span className="text-xs font-bold text-[#FF0080]">홈</span>
          </Link>
          <Link to="/categories" className="flex flex-col items-center space-y-1">
            <ShoppingBag className="h-6 w-6 text-gray-400" />
            <span className="text-xs text-gray-600">쇼핑</span>
          </Link>
          <Link to="/search" className="flex flex-col items-center space-y-1">
            <Search className="h-6 w-6 text-gray-400" />
            <span className="text-xs text-gray-600">검색</span>
          </Link>
          <Link to="/my-orders" className="flex flex-col items-center space-y-1">
            <Heart className="h-6 w-6 text-gray-400" />
            <span className="text-xs text-gray-600">MY</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
