import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, ArrowLeft, Share2, Star, MessageCircle, Heart, ChevronRight, Eye, Play, Clock, MapPin, Pencil, Plus, Settings, Trophy } from 'lucide-react'
import SupporterRanking from '@/components/live/SupporterRanking'
import { toast } from '@/hooks/useToast'

interface Seller {
  id: number; name: string; business_name?: string; profile_image?: string; bio?: string
  sns_instagram?: string; sns_youtube?: string; kakao_chat_link?: string; created_at: string
}
interface LiveStream {
  id: number; title: string; youtube_video_id?: string; status: string; viewer_count?: number
  scheduled_at?: string; created_at: string
}
interface Product {
  id: number; name: string; price: number; original_price?: number; discount_rate?: number
  image_url?: string; sold_count?: number; category?: string
  restaurant_name?: string; restaurant_address?: string
  group_buy_target?: number; group_buy_current?: number; group_buy_deadline?: string
}
interface Short {
  id: number; title: string; youtube_video_id?: string; view_count: number; thumbnail_url?: string
  product_id?: number; product_name?: string; product_price?: number
}

type Tab = 'home' | 'vouchers' | 'shorts' | 'live' | 'info'

export default function SellerPublicPage() {
  const { t } = useTranslation()
  const { sellerId } = useParams<{ sellerId: string }>()
  const navigate = useNavigate()
  const [seller, setSeller] = useState<Seller | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [shorts, setShorts] = useState<Short[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('home')

  // 셀러 본인인지 확인 (편집 버튼 표시용)
  const isOwner = (() => {
    const userType = localStorage.getItem('user_type')
    const storedSellerId = localStorage.getItem('seller_id')
    return userType === 'seller' && storedSellerId === sellerId
  })()

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)
    Promise.all([
      api.get(`/api/sellers/${sellerId}/public`).catch(() => ({ data: { data: null } })),
      api.get(`/api/products?seller_id=${sellerId}&limit=20`).catch(() => ({ data: { data: [] } })),
      api.get(`/api/streams?seller_id=${sellerId}&limit=20`).catch(() => ({ data: { data: [] } })),
      api.get(`/api/shorts/feed?limit=20`).catch(() => ({ data: { data: [] } })),
    ]).then(([sellerRes, productsRes, streamsRes, shortsRes]) => {
      setSeller(sellerRes.data.data)
      setProducts(productsRes.data.data || [])
      setStreams(streamsRes.data.data || [])
      // 셀러의 쇼츠만 필터 (seller_id 매칭)
      const allShorts = shortsRes.data.data || []
      setShorts(allShorts.filter((s: any) => String(s.seller_id) === sellerId))
    }).finally(() => setLoading(false))
  }, [sellerId])

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
    </div>
  )

  if (!seller) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <p className="text-gray-500">{t('seller.sellerNotFound')}</p>
      <button onClick={() => navigate('/')} className="mt-3 text-sm text-pink-500">{t('seller.goToHome')}</button>
    </div>
  )

  const liveNow = streams.find(s => s.status === 'live')
  const bestProducts = products.slice(0, 6)
  const recentStreams = streams.slice(0, 6)

  const mealVouchers = products.filter(p => p.category === 'meal_voucher')
  const regularProducts = products.filter(p => p.category !== 'meal_voucher')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'home', label: '홈' },
    { key: 'vouchers', label: `식사권 ${mealVouchers.length}` },
    { key: 'shorts', label: `영상 ${shorts.length}` },
    { key: 'live', label: `라이브 ${streams.length}` },
    { key: 'info', label: '정보' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* 커버 + 프로필 */}
      <div className="relative">
        {/* 커버 이미지 */}
        <div className="h-44 bg-gradient-to-br from-pink-200 via-purple-100 to-orange-100" />

        {/* 상단 네비 */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-safe pb-2 z-10">
          <button onClick={() => navigate(-1)} className="p-2 bg-black/20 rounded-full backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex gap-2">
            <button onClick={() => {
              const url = window.location.href
              if (navigator.share) navigator.share({ title: seller.name, url })
              else { navigator.clipboard?.writeText(url); toast.success(t('seller.linkCopiedToast')) }
            }} className="p-2 bg-black/20 rounded-full backdrop-blur-sm">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* 프로필 아바타 */}
        <div className="absolute -bottom-10 left-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-white bg-gray-200 overflow-hidden shadow-lg">
              {seller.profile_image ? (
                <img src={seller.profile_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{seller.name.charAt(0)}</span>
                </div>
              )}
            </div>
            {liveNow && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
            )}
          </div>
        </div>
      </div>

      {/* 셀러 정보 */}
      <div className="pt-14 px-5 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-gray-900">{seller.name}</h1>
          {isOwner && (
            <button onClick={() => navigate('/seller/profile')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600 font-medium hover:bg-gray-200">
              <Pencil className="w-3 h-3" /> 프로필 편집
            </button>
          )}
        </div>
        {seller.business_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">{seller.business_name}</span>
          </div>
        )}
        {seller.bio && (
          <p className="text-sm text-gray-600 mt-2 leading-relaxed line-clamp-2">{seller.bio}</p>
        )}

        {/* 통계 */}
        <div className="flex items-center gap-6 mt-4 py-3 border-y border-gray-100">
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.tabProducts')}</p>
            <p className="text-sm font-bold text-gray-900">{products.length}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.tabLive')}</p>
            <p className="text-sm font-bold text-gray-900">{streams.length}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.rating')}</p>
            <p className="text-sm font-bold text-gray-900 flex items-center justify-center gap-0.5">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> 5.0
            </p>
          </div>
        </div>

        {/* 팔로우 + CTA */}
        <FollowButton sellerId={sellerId!} />
        <div className="flex gap-2 mt-2">
          {seller.kakao_chat_link && (
            <a href={seller.kakao_chat_link} target="_blank" rel="noopener" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700">
              <MessageCircle className="w-4 h-4" /> {t('seller.oneOnOneInquiry')}
            </a>
          )}
          <button
            onClick={() => liveNow ? navigate(`/live/${liveNow.id}`) : toast.info(t('seller.noLiveNow'))}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700"
          >
            <Heart className="w-4 h-4" /> {t('seller.donateButton')}
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="px-4 py-5">
        {/* ═══ 홈 탭 ═══ */}
        {tab === 'home' && (
          <div className="space-y-6">
            {/* 식사권 하이라이트 (있을 때) */}
            {mealVouchers.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">🍽️ 추천 식사권</h2>
                  <button onClick={() => setTab('vouchers')} className="text-xs text-gray-500 flex items-center">전체보기 <ChevronRight className="w-3 h-3" /></button>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {mealVouchers.slice(0, 4).map(p => {
                    const disc = p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0
                    const progress = (p.group_buy_target ?? 0) > 0 ? Math.min(100, ((p.group_buy_current || 0) / p.group_buy_target!) * 100) : 0
                    return (
                      <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="shrink-0 w-44 text-left active:scale-[0.97]">
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
                          {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                          {disc > 0 && <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{disc}%</span>}
                        </div>
                        <div className="mt-2">
                          <p className="text-[12px] font-medium text-gray-900 line-clamp-1">{p.name}</p>
                          {p.restaurant_name && <p className="text-[10px] text-gray-500 flex items-center gap-0.5 mt-0.5"><MapPin className="w-2.5 h-2.5" />{p.restaurant_name}</p>}
                          <span className="text-[13px] font-extrabold text-red-500">{p.price.toLocaleString()}원</span>
                          {(p.group_buy_target ?? 0) > 0 && (
                            <div className="mt-1">
                              <div className="w-full bg-gray-200 rounded-full h-1"><div className="h-full bg-pink-500 rounded-full" style={{ width: `${progress}%` }} /></div>
                              <p className="text-[9px] text-gray-400 mt-0.5">{p.group_buy_current || 0}/{p.group_buy_target}명</p>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* 최신 영상 (YouTube 임베드 2열) */}
            {shorts.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">📹 맛집 리뷰 영상</h2>
                  {isOwner && <button onClick={() => navigate('/seller/shorts')} className="text-xs text-blue-500 flex items-center gap-0.5"><Plus className="w-3 h-3" /> 영상 추가</button>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {shorts.slice(0, 4).map(s => (
                    <div key={s.id} className="rounded-xl overflow-hidden bg-gray-100">
                      {s.youtube_video_id ? (
                        <div className="aspect-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${s.youtube_video_id}`}
                            title={s.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gray-200 flex items-center justify-center"><Play className="w-6 h-6 text-gray-400" /></div>
                      )}
                      <div className="p-2">
                        <p className="text-[11px] font-medium text-gray-900 line-clamp-1">{s.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{s.view_count}</span>
                          {s.product_name && <span className="text-[10px] text-pink-500 font-medium">{s.product_name}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {shorts.length > 4 && (
                  <button onClick={() => setTab('shorts')} className="w-full mt-3 py-2.5 text-sm text-gray-500 bg-gray-50 rounded-xl font-medium">
                    영상 더보기 ({shorts.length}개)
                  </button>
                )}
              </section>
            )}

            {/* 라이브 */}
            {recentStreams.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">라이브 <span className="text-pink-500">{streams.length}</span></h2>
                  <button onClick={() => setTab('live')} className="text-xs text-gray-500 flex items-center">더보기 <ChevronRight className="w-3 h-3" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {recentStreams.slice(0, 4).map(s => (
                    <StreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ═══ 식사권 탭 ═══ */}
        {tab === 'vouchers' && (
          mealVouchers.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">등록된 식사권이 없습니다</p>
              {isOwner && <button onClick={() => navigate('/seller/products/new')} className="mt-3 text-sm text-pink-500 font-medium">식사권 등록하기</button>}
            </div>
          ) : (
            <div className="space-y-3">
              {mealVouchers.map(p => {
                const disc = p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0
                const progress = (p.group_buy_target ?? 0) > 0 ? Math.min(100, ((p.group_buy_current || 0) / p.group_buy_target!) * 100) : 0
                return (
                  <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="w-full flex gap-3 p-3 bg-gray-50 rounded-xl text-left active:scale-[0.98]">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                      {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">{p.name}</p>
                      {p.restaurant_name && <p className="text-xs text-gray-500 flex items-center gap-0.5 mt-0.5"><MapPin className="w-3 h-3" />{p.restaurant_name}</p>}
                      {p.restaurant_address && <p className="text-[10px] text-gray-400 mt-0.5">{p.restaurant_address}</p>}
                      <div className="flex items-baseline gap-1.5 mt-1.5">
                        {disc > 0 && <span className="text-sm font-extrabold text-red-500">{disc}%</span>}
                        <span className="text-sm font-extrabold text-gray-900">{p.price.toLocaleString()}원</span>
                        {p.original_price && <span className="text-xs text-gray-400 line-through">{p.original_price.toLocaleString()}원</span>}
                      </div>
                      {(p.group_buy_target ?? 0) > 0 && (
                        <div className="mt-1.5">
                          <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="h-full bg-pink-500 rounded-full" style={{ width: `${progress}%` }} /></div>
                          <p className="text-[10px] text-gray-500 mt-0.5">{p.group_buy_current || 0}/{p.group_buy_target}명 참여</p>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        )}

        {/* ═══ 영상 탭 (YouTube 임베드 2열) ═══ */}
        {tab === 'shorts' && (
          shorts.length === 0 ? (
            <div className="text-center py-16">
              <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">등록된 영상이 없습니다</p>
              {isOwner && <button onClick={() => navigate('/seller/shorts')} className="mt-3 text-sm text-blue-500 font-medium">영상 등록하기</button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {shorts.map(s => (
                <div key={s.id} className="rounded-xl overflow-hidden bg-gray-100">
                  {s.youtube_video_id ? (
                    <div className="aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${s.youtube_video_id}`}
                        title={s.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-200 flex items-center justify-center"><Play className="w-6 h-6 text-gray-400" /></div>
                  )}
                  <div className="p-2">
                    <p className="text-[11px] font-medium text-gray-900 line-clamp-2">{s.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{s.view_count}</span>
                      {s.product_name && (
                        <button onClick={() => s.product_id && navigate(`/products/${s.product_id}`)} className="text-[10px] text-pink-500 font-medium">
                          🍽️ {s.product_name}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ═══ 라이브 탭 ═══ */}
        {tab === 'live' && (
          streams.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">라이브 기록이 없습니다</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {streams.map(s => (
                <StreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
              ))}
            </div>
          )
        )}

        {/* ═══ 정보 탭 ═══ */}
        {tab === 'info' && (
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-gray-900">소개</h3>
                {isOwner && <button onClick={() => navigate('/seller/profile')} className="text-xs text-blue-500 flex items-center gap-0.5"><Pencil className="w-3 h-3" /> 수정</button>}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{seller.bio || '소개글이 없습니다.'}</p>
              {seller.sns_instagram && <a href={seller.sns_instagram} target="_blank" rel="noopener" className="text-sm text-pink-500 mt-2 block">Instagram →</a>}
              {seller.sns_youtube && <a href={seller.sns_youtube} target="_blank" rel="noopener" className="text-sm text-red-500 mt-1 block">YouTube →</a>}
            </section>
            {/* 서포터 랭킹 */}
            <section>
              <SupporterRanking sellerId={sellerId!} />
            </section>

            <section>
              <h3 className="text-base font-bold text-gray-900 mb-2">식사권 이용안내</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">이용방법</span><span>구매 후 발급되는 바우처 코드를 식당에서 제시</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">유효기간</span><span>상품별 상이 (상세 페이지 확인)</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">환불</span><span>미사용 바우처에 한해 공동구매 마감 전 환불 가능</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">문의</span><span>인플루언서에게 직접 문의</span></div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* 셀러 본인: 플로팅 대시보드 버튼 */}
      {isOwner && (
        <button
          onClick={() => navigate('/seller')}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-600/30 text-sm font-bold active:scale-95"
        >
          <Settings className="w-4 h-4" />
          대시보드
        </button>
      )}
    </div>
  )
}

function FollowButton({ sellerId }: { sellerId: string }) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get(`/api/social/follow/${sellerId}`).then(r => {
      if (r.data.success) setFollowing(r.data.data.following)
    }).catch(() => {})
  }, [sellerId])

  return (
    <button
      onClick={async () => {
        setLoading(true)
        try {
          const res = await api.post(`/api/social/follow/${sellerId}`)
          if (res.data.success) setFollowing(res.data.data.following)
        } catch { /* 로그인 필요 */ }
        finally { setLoading(false) }
      }}
      disabled={loading}
      className={`w-full py-3 rounded-xl text-sm font-bold mt-4 transition-all active:scale-[0.98] ${
        following
          ? 'bg-gray-100 text-gray-600 border border-gray-200'
          : 'bg-pink-500 text-white'
      }`}
    >
      {following ? '✓ 팔로잉' : '+ 팔로우'}
    </button>
  )
}

function StreamCard({ stream, onClick }: { stream: LiveStream; onClick: () => void }) {
  const { t } = useTranslation()
  const isLive = stream.status === 'live'
  const thumb = stream.youtube_video_id ? `https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg` : null

  return (
    <button onClick={onClick} className="text-left active:scale-[0.98] transition-transform">
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-gray-100">
        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />}
        {isLive ? (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />LIVE
          </span>
        ) : stream.status === 'scheduled' ? (
          <span className="absolute top-2 left-2 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded">{t('seller.scheduledLabel')}</span>
        ) : null}
        {isLive && stream.viewer_count !== undefined && (
          <span className="absolute bottom-2 left-2 text-white text-[10px] flex items-center gap-0.5 drop-shadow-lg">
            <Eye className="w-3 h-3" /> {stream.viewer_count.toLocaleString()}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-800 mt-1.5 line-clamp-2 font-medium">{stream.title}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {stream.viewer_count !== undefined ? `👁 ${stream.viewer_count.toLocaleString()}` : ''}
        {stream.created_at ? ` · ${new Date(stream.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}` : ''}
      </p>
    </button>
  )
}
