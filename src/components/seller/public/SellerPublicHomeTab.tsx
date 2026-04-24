import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin, ChevronRight, Plus, Play, Eye } from 'lucide-react'
import SellerStreamCard from '@/components/seller/public/SellerStreamCard'
import { Product, Short, LiveStream, Tab, ThemeClasses } from '@/components/seller/public/seller-public-types'

interface SellerPublicHomeTabProps {
  mealVouchers: Product[]
  shorts: Short[]
  recentStreams: LiveStream[]
  streams: LiveStream[]
  isOwner: boolean
  T: ThemeClasses
  setTab: (t: Tab) => void
}

export default function SellerPublicHomeTab({
  mealVouchers, shorts, recentStreams, streams, isOwner, T, setTab,
}: SellerPublicHomeTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      {/* 식사권 하이라이트 (있을 때) */}
      {mealVouchers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-base font-bold ${T.text}`}>🍽️ {t('seller.publicPage.recommendedVouchers')}</h2>
            <button onClick={() => setTab('vouchers')} className="text-xs text-gray-500 flex items-center">{t('seller.seeMore')} <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {mealVouchers.slice(0, 4).map(p => {
              const disc = p.original_price && p.original_price > 0 ? Math.round((1 - (p.price || 0) / p.original_price) * 100) : 0
              const progress = (p.group_buy_target ?? 0) > 0 ? Math.min(100, ((p.group_buy_current || 0) / (p.group_buy_target || 1)) * 100) : 0
              const isAchieved = (p.group_buy_current || 0) > 0 && (p.group_buy_target || 0) > 0 && p.group_buy_current! >= p.group_buy_target!
              return (
                <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="shrink-0 w-44 text-left active:scale-[0.97]">
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#1A1A1A]">
                    {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    {disc > 0 && <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">-{disc}%</span>}
                    {isAchieved && <span className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{t('seller.publicPage.achieved')}</span>}
                  </div>
                  <div className="mt-2">
                    <p className={`text-[12px] font-medium ${T.text} line-clamp-1`}>{p.name}</p>
                    {p.restaurant_name && <p className="text-[10px] text-gray-500 flex items-center gap-0.5 mt-0.5"><MapPin className="w-2.5 h-2.5" />{p.restaurant_name}</p>}
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-[13px] font-extrabold text-red-500">{(p.price || 0).toLocaleString()}원</span>
                      {p.original_price && p.original_price > p.price && (
                        <span className="text-[10px] text-gray-500 line-through">{(p.original_price || 0).toLocaleString()}</span>
                      )}
                    </div>
                    {(p.group_buy_target ?? 0) > 0 && (
                      <div className="mt-1.5">
                        <div className="w-full bg-gray-700 rounded-full h-1.5"><div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[9px] text-gray-400">{p.group_buy_current || 0}/{p.group_buy_target}명</p>
                          {!isAchieved && <p className="text-[9px] text-pink-400 font-medium">{t('seller.publicPage.joinGroupBuy')}</p>}
                        </div>
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
            <h2 className={`text-base font-bold ${T.text}`}>📹 {t('seller.publicPage.reviewVideos')}</h2>
            {isOwner && <button onClick={() => navigate('/seller/shorts')} className="text-xs text-blue-500 flex items-center gap-0.5"><Plus className="w-3 h-3" /> {t('seller.publicPage.addVideo')}</button>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {shorts.slice(0, 4).map(s => (
              <div key={s.id} className="rounded-xl overflow-hidden bg-[#1A1A1A]">
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
                  <p className={`text-[11px] font-medium ${T.text} line-clamp-1`}>{s.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{s.view_count}</span>
                    {s.product_name && <span className="text-[10px] text-pink-500 font-medium">{s.product_name}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {shorts.length > 4 && (
            <button onClick={() => setTab('shorts')} className="w-full mt-3 py-2.5 text-sm text-gray-500 bg-[#121212] rounded-xl font-medium">
              {t('seller.publicPage.moreVideos', { count: shorts.length })}
            </button>
          )}
        </section>
      )}

      {/* 라이브 */}
      {recentStreams.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-base font-bold ${T.text}`}>{t('seller.tabLive')} <span className="text-pink-500">{streams.length}</span></h2>
            <button onClick={() => setTab('live')} className="text-xs text-gray-500 flex items-center">{t('seller.seeMore')} <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recentStreams.slice(0, 4).map(s => (
              <SellerStreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
