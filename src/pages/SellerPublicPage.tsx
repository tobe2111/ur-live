import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, ArrowLeft, Share2, Star, MessageCircle, Heart, ChevronRight, Eye, Play, Clock, MapPin } from 'lucide-react'
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
  image_url?: string; sold_count?: number
}
interface Short {
  id: number; title: string; youtube_video_id?: string; view_count: number; thumbnail_url?: string
}

type Tab = 'home' | 'products' | 'live' | 'shorts' | 'info'

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

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)
    Promise.all([
      api.get(`/api/sellers/${sellerId}/public`).catch(() => ({ data: { data: null } })),
      api.get(`/api/products?seller_id=${sellerId}&limit=20`).catch(() => ({ data: { data: [] } })),
      api.get(`/api/streams?seller_id=${sellerId}&limit=20`).catch(() => ({ data: { data: [] } })),
    ]).then(([sellerRes, productsRes, streamsRes]) => {
      setSeller(sellerRes.data.data)
      setProducts(productsRes.data.data || [])
      setStreams(streamsRes.data.data || [])
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

  const TABS: { key: Tab; label: string }[] = [
    { key: 'home', label: t('seller.tabHome') },
    { key: 'products', label: t('seller.tabProducts') },
    { key: 'live', label: t('seller.tabLive') },
    { key: 'shorts', label: t('seller.tabShorts') },
    { key: 'info', label: t('seller.tabInfo') },
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
        <h1 className="text-xl font-extrabold text-gray-900">{seller.name}</h1>
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

        {/* CTA 버튼 */}
        <div className="flex gap-2 mt-4">
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
          <div className="space-y-8">
            {/* 다가오는 라이브 */}
            {streams.filter(s => s.status === 'scheduled').length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-900 mb-3">{t('seller.upcomingLiveSchedule')}</h2>
                {streams.filter(s => s.status === 'scheduled').slice(0, 2).map(s => (
                  <button key={s.id} onClick={() => navigate(`/live/${s.id}`)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2 text-left active:scale-[0.98]">
                    <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                      {s.youtube_video_id && <img src={`https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                      {s.scheduled_at && <p className="text-xs text-gray-500 mt-0.5">{new Date(s.scheduled_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                    </div>
                  </button>
                ))}
              </section>
            )}

            {/* BEST 상품 */}
            {bestProducts.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">{t('seller.recommendBest')}</h2>
                  <button onClick={() => setTab('products')} className="text-xs text-gray-500 flex items-center">{t('seller.seeMore')} <ChevronRight className="w-3 h-3" /></button>
                </div>
                {bestProducts.slice(0, 3).map(p => {
                  const disc = p.discount_rate || (p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0)
                  return (
                    <button key={p.id} onClick={() => navigate(`/products/${p.id}`)}
                      className="w-full flex items-center gap-3 py-3 border-b border-gray-50 text-left active:scale-[0.99]">
                      <img src={p.image_url || ''} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 line-clamp-2">{p.name}</p>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          {disc > 0 && <span className="text-sm font-extrabold text-red-500">{disc}%</span>}
                          <span className="text-sm font-extrabold text-gray-900">{p.price.toLocaleString()}{t('common.won')}</span>
                        </div>
                        {(p.sold_count ?? 0) > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{t('seller.purchased', { count: p.sold_count })}</p>}
                      </div>
                    </button>
                  )
                })}
              </section>
            )}

            {/* 라이브 목록 */}
            {recentStreams.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">{t('seller.tabLive')} <span className="text-pink-500">{streams.length}</span></h2>
                  <button onClick={() => setTab('live')} className="text-xs text-gray-500 flex items-center">{t('seller.seeMore')} <ChevronRight className="w-3 h-3" /></button>
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

        {/* ═══ 상품 탭 ═══ */}
        {tab === 'products' && (
          products.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">{t('seller.noProducts')}</div>
          ) : (
            <div className="grid grid-cols-3 gap-x-3 gap-y-5">
              {products.map(p => {
                const disc = p.discount_rate || (p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0)
                return (
                  <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="text-left active:scale-[0.98]">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <p className="text-[11px] text-gray-800 mt-1.5 line-clamp-2">{p.name}</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      {disc > 0 && <span className="text-[12px] font-extrabold text-red-500">{disc}%</span>}
                      <span className="text-[12px] font-extrabold text-gray-900">{p.price.toLocaleString()}{t('common.won')}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        )}

        {/* ═══ 라이브 탭 ═══ */}
        {tab === 'live' && (
          streams.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">{t('seller.noLiveRecord')}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {streams.map(s => (
                <StreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
              ))}
            </div>
          )
        )}

        {/* ═══ 쇼츠 탭 ═══ */}
        {tab === 'shorts' && (
          shorts.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">{t('seller.noShortsPublic')}</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {shorts.map(s => (
                <button key={s.id} onClick={() => navigate(`/shorts`)} className="text-left active:scale-[0.98]">
                  <div className="aspect-[9/16] rounded-lg overflow-hidden bg-gray-100 relative">
                    {s.youtube_video_id ? (
                      <img src={`https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                    ) : s.thumbnail_url ? (
                      <img src={s.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                    <div className="absolute bottom-1 left-1 flex items-center gap-0.5 text-white text-[10px]">
                      <Eye className="w-3 h-3" /> {s.view_count}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-800 mt-1 line-clamp-1">{s.title}</p>
                </button>
              ))}
            </div>
          )
        )}

        {/* ═══ 정보 탭 ═══ */}
        {tab === 'info' && (
          <div className="space-y-6">
            <section>
              <h3 className="text-base font-bold text-gray-900 mb-2">{t('seller.storeIntro')}</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {seller.bio || t('seller.noBioYet')}
              </p>
              {seller.sns_instagram && (
                <a href={seller.sns_instagram} target="_blank" rel="noopener" className="text-sm text-pink-500 mt-2 block">{t('seller.instagramLink')} →</a>
              )}
              {seller.sns_youtube && (
                <a href={seller.sns_youtube} target="_blank" rel="noopener" className="text-sm text-red-500 mt-1 block">{t('seller.youtubeLink')} →</a>
              )}
            </section>
            <section>
              <h3 className="text-base font-bold text-gray-900 mb-2">{t('seller.shippingReturnInfo')}</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <div className="flex"><span className="w-16 text-gray-500 shrink-0">{t('seller.shippingMethod')}</span><span>{t('seller.shippingMethodValue')}</span></div>
                <div className="flex"><span className="w-16 text-gray-500 shrink-0">{t('seller.shippingFeeLabel')}</span><span>{t('seller.shippingFeeValue')}</span></div>
                <div className="flex"><span className="w-16 text-gray-500 shrink-0">{t('seller.shippingStart')}</span><span>{t('seller.shippingStartValue')}</span></div>
                <div className="flex"><span className="w-16 text-gray-500 shrink-0">{t('seller.returnExchange')}</span><span>{t('seller.returnExchangeValue')}</span></div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
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
