/**
 * 🧭 2026-06-10 (사용자 결정 — 홈 재구성): 일반상품 6개 레일 — 교환권/동네딜 아래.
 * 뷰포트 600px 선행 진입 시에만 fetch (홈 첫 페인트/LCP 불변). 쇼핑 전체 탐색은 /browse.
 * 🎨 2026-06-10 (사용자 요청): 카드는 쇼핑 페이지(BrowseProductCard) 그대로 —
 *   할인%·취소선 원가·별점·리뷰 수·구매 수까지 동일. 별도 미니카드 사용 금지.
 * 🎨 2026-06-10 (사용자 레퍼런스 — 알약형 카테고리 칩): 섹션 상단에 전체/식품/패션/뷰티/리빙/디지털
 *   칩(선택=검정 채움) — /browse 와 동일 카테고리 키·동일 /api/products 필터. 카테고리별 결과는
 *   세션 내 메모리 캐시(재클릭 즉시 표시).
 */
import { useEffect, useRef, useState, useCallback } from 'react'
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
  const [cat, setCat] = useState('all')
  // 카테고리별 결과 캐시 — 칩 재클릭 시 refetch 없이 즉시 표시.
  const cacheRef = useRef<Record<string, Product[]>>({})
  const startedRef = useRef(false)

  // /browse 카테고리 칩과 동일 키 + 동일 i18n 키 (이용권/교환권 제외 = 실물 상품만).
  const categories = [
    { key: 'all', label: t('browse.categoryAll', { defaultValue: '전체' }) },
    { key: 'food', label: t('browse.categoryFood', { defaultValue: '식품' }) },
    { key: 'fashion', label: t('browse.categoryFashion', { defaultValue: '패션' }) },
    { key: 'beauty', label: t('browse.categoryBeauty', { defaultValue: '뷰티' }) },
    { key: 'living', label: t('browse.categoryLiving', { defaultValue: '리빙' }) },
    { key: 'digital', label: t('browse.categoryDigital', { defaultValue: '디지털' }) },
  ]

  const loadCategory = useCallback((key: string) => {
    const cached = cacheRef.current[key]
    if (cached) { setItems(cached); return }
    setItems(null)
    // 🛡️ 2026-06-10 (사용자 신고 — 기프트카드 뒤죽박죽): /browse 와 동일 필터 미러.
    //   exclude_deal_only=1 = 교환권/딜 제외(실물 배송 상품만), sort=popular = 인기순.
    const params: Record<string, string | number> = { limit: 6, exclude_deal_only: '1', sort: 'popular' }
    if (key !== 'all') params.category = key
    api.get('/api/products', { params })
      .then((r) => {
        const arr: Product[] = Array.isArray(r.data?.data) ? r.data.data.slice(0, 6) : []
        cacheRef.current[key] = arr
        setItems(arr)
      })
      .catch(() => setItems([]))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const ob = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || startedRef.current) return
      startedRef.current = true
      loadCategory('all')
    }, { rootMargin: '600px' })
    ob.observe(el)
    return () => ob.disconnect()
  }, [loadCategory])

  const onSelectCat = (key: string) => {
    if (key === cat) return
    setCat(key)
    startedRef.current = true
    loadCategory(key)
  }

  return (
    <section ref={ref} className="ur-content-wide px-4 lg:px-8 mt-8 mb-2">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[16px] font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4 text-gray-500 dark:text-gray-400" /> {t('home.shopRailTitle', { defaultValue: '지금 인기 상품' })}
        </h2>
        <Link to="/browse" className="text-[12px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
          {t('home.shopRailMore', { defaultValue: '쇼핑 전체보기' })} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-3">
        {t('home.shopRailSubtitle', { defaultValue: '리뷰·별점으로 검증된 인기 상품만 골랐어요' })}
      </p>

      {/* 알약형 카테고리 칩 — 레퍼런스 패턴: 선택=검정 채움, 나머지=흰 배경+회색 테두리 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 pb-3">
        {categories.map((c) => {
          const active = cat === c.key
          return (
            <button
              key={c.key}
              onClick={() => onSelectCat(c.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                active
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-white text-gray-700 border border-gray-200 dark:bg-[#121212] dark:text-gray-300 dark:border-[#2A2A2A]'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {items === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-2.5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-gray-100 dark:bg-[#121212] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        cat === 'all' ? null : (
          <p className="text-[13px] text-gray-500 dark:text-gray-400 py-8 text-center">
            {t('home.shopRailEmpty', { defaultValue: '이 카테고리 상품을 준비 중이에요' })}
          </p>
        )
      ) : (
        /* /browse 본 페이지와 동일 그리드 — PC 프레임(약 720px) 안에서 뷰포트 기준 lg/xl 브레이크포인트가
           6열까지 곱해져 카드가 과도하게 좁아지던 문제 수정. BrowsePage 와 동일하게 최대 3열로 cap. */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2.5 items-stretch">
          {items.map((p) => (
            <BrowseProductCard key={p.id} product={p} aboveFold={false} />
          ))}
        </div>
      )}
    </section>
  )
}
