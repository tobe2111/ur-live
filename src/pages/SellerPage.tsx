import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import NotificationBell from '@/components/NotificationBell'
import { isKorea } from '@/config/region'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { getSellerToken, isSellerAuthenticated, getSellerId, redirectToLogin, logoutSeller } from '@/lib/seller-auth'
import { 
  ArrowLeft, 
  TrendingUp,
  Package,
  DollarSign,
  Users,
  Play,
  Pause,
  Settings,
  BarChart3,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  ChevronRight,
  Building2,
  FileText,
  Copy,
  ExternalLink,
  CheckCheck,
  LogOut
} from 'lucide-react'

interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  activeStreams: number
  totalViewers: number
}

interface LiveStream {
  id: number
  title: string
  description: string
  youtube_video_id: string
  platform?: string
  thumbnail_url?: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count: number
  created_at: string
}

interface Product {
  id: number
  name: string
  price: number
  stock: number
  image_url: string
  is_active: boolean
}

export default function SellerPage() {
  const navigate = useNavigate()
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  const isAuthReady = useAuth(state => state.isAuthReady)  // ✅ Direct Zustand selector
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    activeStreams: 0,
    totalViewers: 0
  })
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [sellerId, setSellerId] = useState<number | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Mock seller info (in production, get from session)
  const sellerName = '리스터코퍼레이션 셀러'
  const sellerEmail = 'seller@listercorp.com'

  useEffect(() => {
    // ⏳ 인증 초기화가 완료될 때까지 대기
    if (!isAuthReady) {
      console.log('[SellerPage] ⏳ 인증 초기화 대기 중...')
      return
    }
    
    // ✅ JWT 기반 인증 확인
    if (!isSellerAuthenticated()) {
      console.log('[SellerPage] ❌ Not authenticated')
      redirectToLogin(navigate)
      return
    }
    
    const token = getSellerToken()
    const sellerIdStr = getSellerId()
    
    console.log('[SellerPage] ✅ JWT Auth success:', {
      hasToken: !!token,
      sellerId: sellerIdStr,
      userType: localStorage.getItem('user_type')
    })
    
    loadDashboardData()
  }, [navigate, isAuthReady])

  async function loadDashboardData() {
    try {
      // ✅ JWT 토큰 사용
      const token = getSellerToken()
      const userId = getSellerId()
      
      if (userId) {
        setSellerId(parseInt(userId))
      }

      if (token) {
        try {
          const statsResponse = await api.get('/api/seller/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          
          if (statsResponse.data.success) {
            setStats(statsResponse.data.data)
          }
        } catch (error) {
          console.error('Failed to load stats:', error)
          setStats({
            totalRevenue: 0,
            totalOrders: 0,
            activeStreams: 0,
            totalViewers: 0
          })
        }
      }

      // Load streams
      const streamsResponse = await api.get('/api/seller/streams', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (streamsResponse.data.success) {
        setStreams(streamsResponse.data.data || [])
      }

      // Load products from first stream
      if (streamsResponse.data.success && streamsResponse.data.data.length > 0) {
        const firstStream = streamsResponse.data.data[0]
        try {
          const productsResponse = await api.get(`/api/streams/${firstStream.id}/products`)
          if (productsResponse.data.success) {
            setProducts(productsResponse.data.data || [])
          }
        } catch (error) {
          console.error('Failed to load products:', error)
          setProducts([])
        }
      } else {
        setProducts([])
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    logoutSeller(navigate)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto mb-4"></div>
          <p className="text-[17px] text-[#6e6e73]">대시보드 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <Link 
              to="/"
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal hidden sm:inline">홈으로</span>
            </Link>
            <h1 className="text-[17px] font-semibold text-[#1d1d1f]">
              셀러 대시보드
            </h1>
            <div className="flex items-center gap-3">
              <NotificationBell userType="seller" />
              <button 
                onClick={() => navigate('/seller/live-control')}
                className="flex items-center gap-1.5 text-[#007aff] hover:opacity-60 transition-opacity"
                title="라이브 컨트롤"
              >
                <Play className="h-5 w-5" />
                <span className="text-[14px] font-medium hidden sm:inline">라이브 컨트롤</span>
              </button>
              <button 
                onClick={() => navigate('/seller/profile')}
                className="text-[#1d1d1f] hover:opacity-60 transition-opacity"
                title="프로필 편집"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button 
                onClick={logout}
                className="flex items-center gap-1.5 text-[#ff3b30] hover:opacity-60 transition-opacity"
                title="로그아웃"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-[14px] font-medium hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] mb-2">
            안녕하세요, {sellerName}님! 👋
          </h2>
          <p className="text-[15px] sm:text-[17px] text-[#6e6e73] mb-4">
            오늘도 성공적인 라이브 쇼핑을 시작해보세요
          </p>
          
          {/* 셀러 공개 페이지 링크 */}
          {sellerId && (
            <div className="apple-card p-4 sm:p-6 bg-gradient-to-r from-[#007aff]/5 to-[#5856d6]/5 border-2 border-[#007aff]/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="h-5 w-5 text-[#007aff]" />
                    <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                      내 셀러 공개 페이지
                    </h3>
                  </div>
                  <p className="text-[13px] text-[#6e6e73] mb-3">
                    이 링크를 SNS에 공유해서 고객들을 내 페이지로 초대하세요!
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="flex-1 min-w-[200px] px-3 py-2 bg-white rounded-lg text-[13px] text-[#007aff] font-mono border border-[#e5e5ea]">
                      https://live.ur-team.com/s/{sellerId}
                    </code>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`https://live.ur-team.com/s/${sellerId}`)
                          setCopiedLink(true)
                          setTimeout(() => setCopiedLink(false), 2000)
                        }}
                        className="px-4 py-2 bg-[#007aff] text-white rounded-lg hover:bg-[#0051d5] transition-colors flex items-center gap-2 text-[13px] font-medium"
                      >
                        {copiedLink ? (
                          <>
                            <CheckCheck className="h-4 w-4" />
                            복사완료!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            링크 복사
                          </>
                        )}
                      </button>
                      <a
                        href={`/s/${sellerId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-white text-[#007aff] border border-[#007aff] rounded-lg hover:bg-[#007aff]/5 transition-colors flex items-center gap-2 text-[13px] font-medium"
                      >
                        <ExternalLink className="h-4 w-4" />
                        미리보기
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[#34c759]" />
              </div>
              <TrendingUp className="h-4 w-4 text-[#34c759]" />
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">총 매출</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {(stats.totalRevenue || 0).toLocaleString()}원
            </p>
          </div>

          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#007aff]/10 rounded-full flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-[#007aff]" />
              </div>
              <TrendingUp className="h-4 w-4 text-[#007aff]" />
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">총 주문</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {stats.totalOrders || 0}건
            </p>
          </div>

          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#ff3b30]/10 rounded-full flex items-center justify-center">
                <Play className="h-5 w-5 text-[#ff3b30]" />
              </div>
              <Badge className="bg-[#ff3b30] text-white border-0 px-2 py-0.5">
                <span className="text-[11px] font-semibold">LIVE</span>
              </Badge>
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">활성 라이브</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {stats.activeStreams || 0}개
            </p>
          </div>

          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#ff9500]/10 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-[#ff9500]" />
              </div>
              <Eye className="h-4 w-4 text-[#ff9500]" />
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">총 시청자</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {(stats.totalViewers || 0).toLocaleString()}명
            </p>
          </div>
        </div>

        {/* Quick Access Section */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => navigate('/seller/live-control')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left bg-gradient-to-br from-red-50 to-orange-50"
          >
            <div className="w-10 h-10 bg-[#ff3b30]/10 rounded-full flex items-center justify-center mb-3">
              <Play className="h-5 w-5 text-[#ff3b30]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">🔴 라이브 컨트롤</p>
            <p className="text-[13px] text-[#6e6e73]">상품 실시간 전환</p>
          </button>

          <button
            onClick={() => navigate('/seller/dashboard')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left bg-gradient-to-br from-blue-50 to-indigo-50"
          >
            <div className="w-10 h-10 bg-blue-600/10 rounded-full flex items-center justify-center mb-3">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">📊 통계 대시보드</p>
            <p className="text-[13px] text-[#6e6e73]">매출 및 상품 분석</p>
          </button>

          <button
            onClick={() => navigate('/seller/business-info')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-[#5856d6]/10 rounded-full flex items-center justify-center mb-3">
              <Building2 className="h-5 w-5 text-[#5856d6]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">사업자 정보</p>
            <p className="text-[13px] text-[#6e6e73]">정보 등록 및 관리</p>
          </button>

          <button
            onClick={() => navigate('/seller/tax-invoices')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-[#32ade6]/10 rounded-full flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-[#32ade6]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">세금계산서</p>
            <p className="text-[13px] text-[#6e6e73]">발행 내역 조회</p>
          </button>

          <button
            onClick={() => navigate('/seller/orders')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-[#ff9500]/10 rounded-full flex items-center justify-center mb-3">
              <Package className="h-5 w-5 text-[#ff9500]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">주문 관리</p>
            <p className="text-[13px] text-[#6e6e73]">주문 확인 및 배송</p>
          </button>

          <button
            onClick={() => navigate('/seller/products')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center mb-3">
              <ShoppingBag className="h-5 w-5 text-[#34c759]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">상품 관리</p>
            <p className="text-[13px] text-[#6e6e73]">상품 등록 및 수정</p>
          </button>

          <button
            onClick={() => navigate('/seller/live-control')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-[#ff3b30] to-[#ff9500] rounded-full flex items-center justify-center mb-3">
              <Play className="h-5 w-5 text-white" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">🎥 라이브 컨트롤</p>
            <p className="text-[13px] text-[#6e6e73]">실시간 상품 전환</p>
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Live Streams Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                내 라이브 스트림
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/seller/streams/new')}
                  className="text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity"
                >
                  + 새 라이브
                </button>
                {streams.length > 3 && (
                  <button 
                    onClick={() => navigate('/seller/streams')}
                    className="text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center"
                  >
                    더보기
                    <ChevronRight className="h-4 w-4 ml-0.5" />
                  </button>
                )}
              </div>
            </div>

            {streams.length === 0 ? (
              <div className="apple-card p-12 text-center">
                <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="h-10 w-10 text-[#6e6e73]" />
                </div>
                <p className="text-[15px] text-[#6e6e73] mb-4">
                  라이브가 없습니다
                </p>
                <button 
                  onClick={() => navigate('/seller/streams/new')}
                  className="apple-button px-6 py-2.5"
                >
                  라이브 시작하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {streams.slice(0, 3).map(stream => (
                  <div key={stream.id} className="apple-card p-4 hover:shadow-lg transition-shadow">
                    <div className="flex gap-4">
                      {stream.thumbnail_url ? (
                        <img
                          src={stream.thumbnail_url}
                          alt={stream.title}
                          className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = 'w-24 h-24 rounded-xl bg-gradient-to-br from-[#ff3b30] to-[#ff9500] flex items-center justify-center flex-shrink-0';
                              fallback.innerHTML = '<svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <img
                          src={`https://img.youtube.com/vi/${stream.youtube_video_id}/mqdefault.jpg`}
                          alt={stream.title}
                          className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = 'w-24 h-24 rounded-xl bg-gradient-to-br from-[#ff3b30] to-[#ff9500] flex items-center justify-center flex-shrink-0';
                              fallback.innerHTML = '<svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-1">
                            {stream.title}
                          </h4>
                          <Badge 
                            className={`
                              border-0 px-2 py-0.5 ml-2 flex-shrink-0
                              ${stream.status === 'live' 
                                ? 'bg-[#ff3b30] text-white' 
                                : stream.status === 'scheduled'
                                ? 'bg-[#ff9500] text-white'
                                : 'bg-[#8e8e93] text-white'
                              }
                            `}
                          >
                            <span className="text-[11px] font-semibold">
                              {stream.status === 'live' 
                                ? 'LIVE' 
                                : stream.status === 'scheduled'
                                ? '예정'
                                : '종료'
                              }
                            </span>
                          </Badge>
                        </div>
                        <p className="text-[13px] text-[#6e6e73] mb-2 line-clamp-1">
                          {stream.description || '설명 없음'}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-[13px] text-[#6e6e73]">
                            <div className="flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              {(stream.viewer_count || 0).toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(stream.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <button 
                            onClick={() => navigate(`/seller/streams/${stream.id}`)}
                            className="text-[13px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center"
                          >
                            관리
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Products Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                상품 관리
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/seller/products/new')}
                  className="text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity"
                >
                  + 상품 추가
                </button>
                {products.length > 3 && (
                  <button 
                    onClick={() => navigate('/seller/products')}
                    className="text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center"
                  >
                    더보기
                    <ChevronRight className="h-4 w-4 ml-0.5" />
                  </button>
                )}
              </div>
            </div>

            {products.length === 0 ? (
              <div className="apple-card p-12 text-center">
                <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-[#6e6e73]" />
                </div>
                <p className="text-[15px] text-[#6e6e73] mb-4">
                  등록된 상품이 없습니다
                </p>
                <button 
                  onClick={() => navigate('/seller/products/new')}
                  className="apple-button px-6 py-2.5"
                >
                  상품 추가하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {products.slice(0, 3).map(product => (
                  <div key={product.id} className="apple-card p-4 hover:shadow-lg transition-shadow">
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-1">
                            {product.name}
                          </h4>
                          {product.is_active ? (
                            <Badge className="bg-[#34c759] text-white border-0 px-2 py-0.5 ml-2 flex-shrink-0">
                              <span className="text-[11px] font-semibold">판매중</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-[#8e8e93] text-white border-0 px-2 py-0.5 ml-2 flex-shrink-0">
                              <span className="text-[11px] font-semibold">품절</span>
                            </Badge>
                          )}
                        </div>
                        <p className="text-[17px] font-bold text-[#1d1d1f] mb-2">
                          {(product.price || 0).toLocaleString()}원
                        </p>
                        <div className="flex items-center justify-between">
                          <div className={`
                            text-[13px] font-medium
                            ${product.stock > 10 
                              ? 'text-[#34c759]' 
                              : product.stock > 0 
                              ? 'text-[#ff9500]' 
                              : 'text-[#ff3b30]'
                            }
                          `}>
                            {product.stock > 0 
                              ? `재고 ${product.stock}개` 
                              : '품절'
                            }
                          </div>
                          <button 
                            onClick={() => navigate(`/seller/products/${product.id}/edit`)}
                            className="text-[13px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center"
                          >
                            수정
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>



        {/* Recent Activity */}
        <section className="mt-8">
          <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-6">
            최근 활동
          </h3>
          <div className="apple-card divide-y divide-[#e5e5ea]">
            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-[#34c759]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-[#1d1d1f]">
                  <span className="font-semibold">신규 주문</span> 3건이 접수되었습니다
                </p>
                <p className="text-[13px] text-[#6e6e73]">2시간 전</p>
              </div>
            </div>

            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#007aff]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Play className="h-5 w-5 text-[#007aff]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-[#1d1d1f]">
                  <span className="font-semibold">라이브 스트림</span>이 시작되었습니다
                </p>
                <p className="text-[13px] text-[#6e6e73]">5시간 전</p>
              </div>
            </div>

            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#ff9500]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-[#ff9500]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-[#1d1d1f]">
                  <span className="font-semibold">재고 부족</span> 상품이 3개 있습니다
                </p>
                <p className="text-[13px] text-[#6e6e73]">어제</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
