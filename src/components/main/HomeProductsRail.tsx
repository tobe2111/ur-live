/**
 * 🧭 2026-06-10 (사용자 결정 — 홈 재구성): 일반상품 6개 레일 — 교환권/동네딜 아래.
 * 뷰포트 600px 선행 진입 시에만 fetch (홈 첫 페인트/LCP 불변). 쇼핑 전체 탐색은 /browse.
 * 🎨 2026-06-10 (사용자 요청): 카드는 쇼핑 페이지(BrowseProductCard) 그대로 —
 *   할인%·취소선 원가·별점·리뷰 수·구매 수까지 동일. 별도 미니카드 사용 금지.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShoppingBag, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import BrowseProductCard from '@/pages/browse/BrowseProductCard'
import type { Product } from '@/pages/browse/types'

export default function HomeProductsRail() {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<Product[] | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const ob = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || fetchedRef.current) return
      fetchedRef.current = true
      // 🛡️ 2026-06-10 (사용자 신고 — 기프트카드 뒤죽박죽): /browse 와 동일 필터 미러.
      //   exclude_deal_only=1 = 교환권/딜 제외(실물 배송 상품만), sort=popular = 인기순.
      api.get('/api/products', { params: { limit: 6, exclude_deal_only: '1', sort: 'popular' } })
        .then((r) => {
          const arr = Array.isArray(r.data?.data) ? r.data.data : []
          setItems(arr.slice(0, 6))
        })
        .catch(() => setItems([]))
    }, { rootMargin: '600px' })
    ob.observe(el)
    return () => ob.disconnect()
  }, [])

  return (
    <section ref={ref} className="ur-content-wide px-4 lg:px-8 mt-8 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4 text-gray-500 dark:text-gray-400" /> {t('home.shopRailTitle', { defaultValue: '일반 상품' })}
        </h2>
        <Link to="/browse" className="text-[12px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
          {t('home.shopRailMore', { defaultValue: '쇼핑 전체보기' })} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {items === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-2.5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-gray-100 dark:bg-[#121212] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? null : (
        /* /browse 본 페이지와 동일 그리드 (2열 기본) — 카드 컴포넌트 자체도 동일 */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-2 gap-y-2.5 items-stretch">
          {items.map((p) => (
            <BrowseProductCard key={p.id} product={p} aboveFold={false} />
          ))}
        </div>
      )}
    </section>
  )
}
