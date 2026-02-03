import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Eye, Tv, ShoppingBag, Store } from 'lucide-react'

interface LiveStream {
  id: number
  title: string
  description?: string
  youtube_video_id: string
  seller_name?: string
  seller_profile_image?: string
  viewer_count?: number
}

export default function HomePage() {
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStreams()
  }, [])

  const loadStreams = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/streams')
      const data = await response.json()
      if (data.success && data.data) {
        setStreams(data.data)
      }
    } catch (error) {
      console.error('Failed to load streams:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary">
              <Tv className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">유어 라이브</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="font-semibold">
              <Link to="/my-orders">
                <ShoppingBag className="mr-2 h-4 w-4" />
                주문내역
              </Link>
            </Button>
            <Button size="sm" asChild className="font-bold">
              <Link to="/seller-login">
                <Store className="mr-2 h-4 w-4" />
                셀러 시작하기
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-24 text-center">
        <div className="mx-auto max-w-4xl space-y-8">
          <Badge variant="secondary" className="px-5 py-2 text-sm font-bold">
            🔥 지금 라이브 중
          </Badge>
          <h1 className="text-6xl font-black leading-tight tracking-tighter lg:text-7xl">
            보는 순간
            <br />
            <span className="text-primary">바로 산다</span>
          </h1>
          <p className="text-xl font-medium text-muted-foreground">
            실시간 라이브 쇼핑으로 빠르고 재미있게 쇼핑하세요
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Button size="lg" className="h-14 px-8 text-base font-bold" onClick={() => document.getElementById('streams')?.scrollIntoView({ behavior: 'smooth' })}>
              <Play className="mr-2 h-5 w-5" />
              라이브 보러가기
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-base font-bold" asChild>
              <Link to="/seller-login">판매자 가입하기</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Streams Section */}
      <section id="streams" className="container py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="mb-2 text-4xl font-black tracking-tight">지금 라이브 중 🔥</h2>
            <p className="text-lg font-medium text-muted-foreground">실시간으로 진행되는 라이브 쇼핑</p>
          </div>
          <Button variant="outline" className="font-bold" onClick={loadStreams}>
            새로고침
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="h-48 animate-pulse bg-muted" />
                <CardHeader>
                  <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <Tv className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-2xl font-bold">현재 진행 중인 라이브가 없어요</h3>
            <p className="mb-6 text-muted-foreground">곧 새로운 라이브가 시작될 예정입니다</p>
            <Button size="lg" asChild>
              <Link to="/seller-login">셀러로 라이브 시작하기</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {streams.map((stream) => (
              <Link key={stream.id} to={`/live/${stream.id}`}>
                <Card className="group cursor-pointer overflow-hidden border-2 transition-all hover:border-primary hover:shadow-xl">
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    <img
                      src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
                      alt={stream.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/1280x720/FEE500/191919?text=Your+Live'
                      }}
                    />
                    <Badge className="absolute left-4 top-4 bg-red-500 px-3 py-1.5 text-xs font-bold hover:bg-red-500">
                      <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-white" />
                      LIVE
                    </Badge>
                    {stream.viewer_count && (
                      <Badge variant="secondary" className="absolute right-4 top-4 bg-black/80 px-3 py-1.5 text-xs font-bold text-white">
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        {stream.viewer_count.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                  <CardHeader className="space-y-3 pb-4">
                    <CardTitle className="line-clamp-2 text-xl font-bold leading-tight">{stream.title}</CardTitle>
                    <CardDescription className="line-clamp-2 text-base">
                      {stream.description || '실시간 라이브 쇼핑을 즐겨보세요!'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {stream.seller_name && (
                          <>
                            <div className="h-10 w-10 overflow-hidden rounded-full bg-muted ring-2 ring-border">
                              <img
                                src={stream.seller_profile_image || 'https://via.placeholder.com/40'}
                                alt={stream.seller_name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://via.placeholder.com/40'
                                }}
                              />
                            </div>
                            <span className="text-sm font-bold">{stream.seller_name}</span>
                          </>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" className="font-bold group-hover:text-primary">
                        입장하기 →
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
      <section className="border-t bg-muted/30 py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-black tracking-tight">더 쉽고 빠르게</h2>
            <p className="text-lg font-medium text-muted-foreground">유어 라이브만의 특별한 경험</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-2 text-center transition-all hover:border-primary hover:shadow-lg">
              <CardHeader className="space-y-4 pb-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-yellow-400 to-orange-500">
                  <Play className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-2xl font-black">원클릭 구매</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  복잡한 절차 없이 클릭 한 번으로
                  <br />
                  장바구니 담고 바로 결제
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-2 text-center transition-all hover:border-primary hover:shadow-lg">
              <CardHeader className="space-y-4 pb-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-400 to-cyan-500">
                  <ShoppingBag className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-2xl font-black">안전한 결제</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  나이스페이먼츠 연동으로
                  <br />
                  안전하고 편리한 결제 경험
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-2 text-center transition-all hover:border-primary hover:shadow-lg">
              <CardHeader className="space-y-4 pb-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-green-400 to-emerald-500">
                  <Tv className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-2xl font-black">실시간 소통</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  채팅으로 다른 구매자들과
                  <br />
                  실시간으로 소통하며 쇼핑
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="text-center md:text-left">
              <p className="font-medium text-muted-foreground">
                © 2026 유어 라이브 커머스. All rights reserved.
              </p>
            </div>
            <div className="flex gap-8">
              <Link to="/admin" className="font-semibold text-muted-foreground transition-colors hover:text-foreground">
                관리자
              </Link>
              <Link to="/seller-login" className="font-semibold text-muted-foreground transition-colors hover:text-foreground">
                셀러
              </Link>
              <Link to="/my-orders" className="font-semibold text-muted-foreground transition-colors hover:text-foreground">
                내 주문
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
