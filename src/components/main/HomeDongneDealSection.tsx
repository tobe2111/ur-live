/**
 * 🧭 2026-06-10 (포털형 홈): 홈 하단 '우리 동네딜' 섹션 — 주력 사업의 홈 첫 노출.
 *
 * 성능: 뷰포트 600px 선행 진입 시에만 fetch (홈 첫 페인트/LCP 영향 0 — 잠금 표면 불변).
 * 데이터: 동네딜 탭과 같은 키(prewarm/엣지캐시 적중) — 상위 6개만 미니 카드로.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { cfImage } from '@/utils/cf-image'

type GBItem = {
  id: number
  name: string
  price: number
  image_url?: string | null
  restaurant_name?: string | null
  current_price?: number | null
  dominant_color?: string | null
}

export default function HomeDongneDealSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<GBItem[] | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const ob = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || fetchedRef.current) return
      fetchedRef.current = true
      // 동네딜 탭과 동일 키 — cron prewarm + 엣지캐시 적중 (cold D1 회피)
      api.get('/api/group-buy/products?status=active&limit=200')
        .then((r) => { if (r.data?.success) setItems((r.data.data || []).slice(0, 6)) })
        .catch(() => setItems([]))
    }, { rootMargin: '600px' })
    ob.observe(el)
    return () => ob.disconnect()
  }, [])

  return (
    <section ref={ref} className="ur-content-wide px-4 lg:px-8 mt-8 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-extrabold text-white flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-400" /> {t('home.dongneTitle', { defaultValue: '우리 동네딜' })}
        </h2>
        <Link to="/group-buy" className="text-[12px] font-bold text-gray-400 flex items-center gap-0.5">
          {t('home.dongneMore', { defaultValue: '더보기' })} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {items === null ? (
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-[#121212] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Link
          to="/community-group-buy/new"
          className="flex items-center justify-between rounded-2xl px-5 py-4 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/20"
        >
          <div>
            <p className="text-[13px] font-bold text-white">{t('home.dongneEmptyTitle', { defaultValue: '아직 우리 동네 공구가 없어요' })}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{t('home.dongneEmptyDesc', { defaultValue: '원하는 가게를 제안하면 모아서 열어드려요' })}</p>
          </div>
          <span className="text-[12px] font-bold text-emerald-400">{t('home.dongnePropose', { defaultValue: '제안하기 →' })}</span>
        </Link>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/group-buy/${p.id}`)}
              className="text-left rounded-xl overflow-hidden bg-[#121212] active:scale-[0.98] transition-transform"
            >
              <div className="aspect-square bg-[#1A1A1A]">
                {p.image_url && (
                  <img
                    src={cfImage(p.image_url, { width: 200, format: 'auto' }) || p.image_url}
                    alt={p.name}
                    width={200}
                    height={200}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-2">
                <p className="text-[11px] text-white leading-tight line-clamp-1">{p.restaurant_name || p.name}</p>
                <p className="text-[12px] font-extrabold text-white mt-0.5">
                  {(p.current_price ?? p.price).toLocaleString('ko-KR')}원
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
