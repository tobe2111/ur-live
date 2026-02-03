import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Users, ShoppingBag, Store } from 'lucide-react'

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
    <div className="min-h-screen bg-[#151517]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/15 bg-[#151517]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-8">
          <Link to="/" className="flex items-center space-x-2">
            <div className="flex h-10 items-center justify-center rounded-sm bg-[#00A0FF] px-4">
              <span className="text-lg font-bold text-white">유어 라이브</span>
            </div>
          </Link>
          <nav className="flex items-center space-x-6">
            <Link to="/" className="text-[#f2f2f2] hover:opacity-80">
              홈
            </Link>
            <Link to="/my-orders" className="text-[#f2f2f2] hover:opacity-80">
              주문내역
            </Link>
            <Link to="/seller-login" className="text-[#f2f2f2] hover:opacity-80">
              셀러 로그인
            </Link>
            <Button className="ml-2 h-9 bg-[#00A0FF] text-white hover:bg-[#0090E0]">
              판매자 가입하기
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00A0FF]/10 to-transparent"></div>
        <div className="relative mx-auto max-w-7xl px-8 py-24">
          <div className="flex flex-col space-y-8 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div className="max-w-2xl">
              <Badge className="mb-4 inline-block rounded bg-black/30 px-3 py-1 text-sm text-white backdrop-blur-sm">
                🔴 지금 라이브 중
              </Badge>
              <h1 className="mb-6 whitespace-pre-line text-[42px] font-semibold leading-[50px] text-[#f2f2f2]">
                보는 순간{' '}
                <span className="text-[#00A0FF]">바로 산다</span>
              </h1>
              <p className="mb-8 whitespace-pre-line text-lg leading-[25px] text-[#f2f2f2]">
                실시간 라이브 쇼핑으로 특별한 쇼핑 경험을 만나보세요.
                지금 바로 라이브에 참여하세요.
              </p>
              <div className="flex items-center space-x-4">
                <Button className="h-12 bg-[#00A0FF] px-8 text-white hover:bg-[#0090E0]">
                  라이브 보러가기
                </Button>
                <Button
                  variant="outline"
                  className="h-12 border-white/20 bg-transparent px-8 text-[#f2f2f2] hover:bg-white/5"
                >
                  판매자 가입하기
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Streams Section */}
      <section className="mx-auto max-w-7xl px-8 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-semibold text-[#f2f2f2]">
              진행 중인 라이브
            </h2>
            <p className="text-base text-[#979797]">
              지금 실시간으로 진행되는 라이브 쇼핑을 만나보세요
            </p>
          </div>
          <Button
            onClick={loadStreams}
            variant="outline"
            className="border-white/20 bg-transparent text-[#f2f2f2] hover:bg-white/5"
          >
            새로고침
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card
                key={i}
                className="animate-pulse border-white/10 bg-[#1f1f23]"
              >
                <CardContent className="p-0">
                  <div className="h-48 bg-[#2f2f33]"></div>
                  <div className="space-y-3 p-4">
                    <div className="h-4 rounded bg-[#2f2f33]"></div>
                    <div className="h-4 w-2/3 rounded bg-[#2f2f33]"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <Card className="border-white/10 bg-[#1f1f23] p-12 text-center">
            <CardContent>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2f2f33]">
                <Play className="h-8 w-8 text-[#979797]" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-[#f2f2f2]">
                현재 진행 중인 라이브가 없어요
              </h3>
              <p className="mb-6 text-[#979797]">
                곧 새로운 라이브가 시작될 예정입니다
              </p>
              <Button className="bg-[#00A0FF] text-white hover:bg-[#0090E0]">
                셀러로 라이브 시작하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {streams.map((stream) => (
              <Link key={stream.id} to={`/live/${stream.id}`}>
                <Card className="group overflow-hidden border-white/10 bg-[#1f1f23] transition-all hover:border-[#00A0FF] hover:shadow-xl hover:shadow-[#00A0FF]/20">
                  <CardContent className="p-0">
                    <div className="relative aspect-video w-full overflow-hidden">
                      <img
                        src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                        alt={stream.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src =
                            'https://via.placeholder.com/400x225/1f1f23/979797?text=Live'
                        }}
                      />
                      <div className="absolute left-3 top-3">
                        <Badge className="animate-pulse bg-red-500 text-white">
                          🔴 LIVE
                        </Badge>
                      </div>
                      {stream.viewer_count && (
                        <div className="absolute right-3 top-3">
                          <Badge className="bg-black/50 text-white backdrop-blur-sm">
                            <Users className="mr-1 h-3 w-3" />
                            {stream.viewer_count.toLocaleString()}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="mb-2 text-xl font-bold text-[#f2f2f2] group-hover:text-[#00A0FF]">
                        {stream.title}
                      </h3>
                      <p className="mb-3 line-clamp-2 text-sm text-[#979797]">
                        {stream.description}
                      </p>
                      <div className="flex items-center">
                        <img
                          src={
                            stream.seller_profile_image ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(stream.seller_name)}&background=00A0FF&color=fff&size=128`
                          }
                          alt={stream.seller_name}
                          className="mr-2 h-8 w-8 rounded-full ring-2 ring-white/10"
                        />
                        <span className="text-sm font-medium text-[#f2f2f2]">
                          {stream.seller_name}
                        </span>
                      </div>
                      <Button className="mt-4 w-full bg-[#00A0FF] text-white hover:bg-[#0090E0]">
                        입장하기
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Features Section */}
      <section className="border-t border-white/10 bg-[#1a1a1c] py-16">
        <div className="mx-auto max-w-7xl px-8">
          <h2 className="mb-12 text-center text-3xl font-semibold text-[#f2f2f2]">
            왜 유어 라이브인가요?
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Card className="border-white/10 bg-[#1f1f23] p-6 text-center transition-all hover:border-[#00A0FF]">
              <CardContent>
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#00A0FF]/10">
                  <Play className="h-10 w-10 text-[#00A0FF]" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-[#f2f2f2]">
                  실시간 라이브
                </h3>
                <p className="text-base text-[#979797]">
                  판매자와 실시간으로 소통하며 상품을 확인하세요
                </p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-[#1f1f23] p-6 text-center transition-all hover:border-[#00A0FF]">
              <CardContent>
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#00A0FF]/10">
                  <ShoppingBag className="h-10 w-10 text-[#00A0FF]" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-[#f2f2f2]">
                  원클릭 구매
                </h3>
                <p className="text-base text-[#979797]">
                  마음에 드는 상품을 클릭 한 번으로 바로 구매하세요
                </p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-[#1f1f23] p-6 text-center transition-all hover:border-[#00A0FF]">
              <CardContent>
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#00A0FF]/10">
                  <Store className="h-10 w-10 text-[#00A0FF]" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-[#f2f2f2]">
                  검증된 셀러
                </h3>
                <p className="text-base text-[#979797]">
                  신뢰할 수 있는 판매자들의 엄선된 상품만 만나보세요
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#151517] py-8">
        <div className="mx-auto max-w-7xl px-8">
          <div className="text-center text-sm text-[#979797]">
            © 2026 유어 라이브. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
