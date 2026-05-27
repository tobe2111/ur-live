/**
 * 🛡️ 2026-05-20: 홈 공구 피드 (당근식).
 *
 * 단일 통합 피드 — 카테고리 필터 + 정렬 옵션.
 * 광고/배너/최근본/카테고리섹션 없음. 오롯이 공구만.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from '@/hooks/queries'
import GroupBuyFeedCard from './GroupBuyFeedCard'
import GroupBuyGuideCard from './GroupBuyGuideCard'
import type { Product } from './types'

interface FeedProduct extends Product {
  group_buy_current?: number
  group_buy_target?: number
  group_buy_status?: string
  expires_at?: string | null
  seller_name?: string
  seller_avatar?: string
  category?: string
  business_address?: string
  discount_rate?: number
  current_price?: number
  created_at?: string
}

const CATEGORIES = [
  { key: 'all',             label: '전체' },
  { key: 'meal_voucher',    label: '🍽️ 식사' },
  { key: 'stay_voucher',    label: '🏨 숙소' },
  { key: 'beauty_voucher',  label: '💇 뷰티' },
  { key: 'etc_voucher',     label: '🎯 기타' },
] as const

const SORTS = [
  { key: 'popular',  label: '🔥 인기순' },
  { key: 'deadline', label: '⏰ 마감임박' },
  { key: 'discount', label: '🏷️ 할인율' },
  { key: 'newest',   label: '🆕 최신순' },
] as const

type SortKey = typeof SORTS[number]['key']
type CategoryKey = typeof CATEGORIES[number]['key']

export default function GroupBuyFeed() {
  const [category, setCategory] = useState<CategoryKey>('all')
  const [sort, setSort] = useState<SortKey>('popular')

  // 🛡️ 2026-05-22 Phase 2 (100% 영구): React Query + hydration.
  //   목록 fetch 직후 각 product 를 individual detail cache 에 hydrate →
  //   카드 클릭 시 server hit 0 (placeholderData + cache hit).
  const qc = useQueryClient()

  // 🛡️ 2026-05-25 (loading P0): SSR inline — worker HTMLRewriter 가 KV cache 에서
  //   메인 페이지 데이터를 <script id="__SSR_INITIAL_MAIN__"> 로 inject.
  //   category='all' 첫 mount 시 즉시 사용 → 첫 API fetch waterfall 제거.
  //   miss/만료 시 useQuery 가 정상 fetch (fallback 안전).
  const ssrInitial = useMemo<FeedProduct[] | undefined>(() => {
    if (category !== 'all') return undefined
    try {
      if (typeof document === 'undefined') return undefined
      const el = document.getElementById('__SSR_INITIAL_MAIN__')
      if (!el?.textContent) return undefined
      const parsed = JSON.parse(el.textContent)
      const arr = Array.isArray(parsed?.data) ? parsed.data : null
      return arr || undefined
    } catch { return undefined }
  }, [category])

  // 🛡️ 2026-05-24 (loading P0): staleTime/gcTime override 제거 → global default (30분/1h) 적용.
  //   refetchOnWindowFocus 는 유지 false (홈 피드는 잦은 변경 안 함 — 카테고리 칩 클릭 시 새 카테고리 fetch).
  const { data: items = [], isLoading: loading } = useQuery<FeedProduct[]>({
    queryKey: queryKeys.groupBuyList('active', category),
    queryFn: async () => {
      const res = await api.get(`/api/group-buy/products?status=active&category=${category}`)
      const arr: FeedProduct[] = Array.isArray(res.data?.data) ? res.data.data : []
      // hydrate individual detail cache (idempotent).
      for (const p of arr) {
        if (p?.id != null) qc.setQueryData(queryKeys.groupBuyProduct(p.id), p)
      }
      return arr
    },
    initialData: ssrInitial,
    initialDataUpdatedAt: ssrInitial ? Date.now() - 60_000 : 0,  // SSR 데이터를 1분 stale 로 표시 → useQuery 가 background refetch
    refetchOnWindowFocus: false,
  })

  // 클라이언트 사이드 정렬 — 50개 cap 이므로 비용 무시 가능.
  const sorted = useMemo(() => {
    const arr = [...items]
    switch (sort) {
      case 'popular':
        return arr.sort((a, b) => (b.group_buy_current ?? 0) - (a.group_buy_current ?? 0))
      case 'deadline':
        return arr.sort((a, b) => {
          const ax = a.expires_at ? new Date(a.expires_at).getTime() : Infinity
          const bx = b.expires_at ? new Date(b.expires_at).getTime() : Infinity
          return ax - bx
        })
      case 'discount':
        return arr.sort((a, b) => (b.discount_rate ?? 0) - (a.discount_rate ?? 0))
      case 'newest':
        return arr.sort((a, b) => {
          const ax = a.created_at ? new Date(a.created_at).getTime() : 0
          const bx = b.created_at ? new Date(b.created_at).getTime() : 0
          return bx - ax
        })
    }
  }, [items, sort])

  return (
    <>
      {/* 🛡️ 2026-05-20: 공구 → 딜 적립 가이드 카드 (예전 + 버튼 시절 플로우 복원).
          dismissible — 한 번 닫으면 영구 숨김 (localStorage). */}
      <GroupBuyGuideCard />

      {/* 카테고리 칩 — sticky 한 단계 아래 (헤더는 페이지에서 sticky 처리) */}
      <div className="bg-white dark:bg-[#020202] border-b border-gray-100 dark:border-[#1A1A1A] sticky top-12 z-10">
        <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => {
            const active = c.key === category
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                  active
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2A2A2A]'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 정렬 옵션 + 카운트 */}
      <div className="flex items-center justify-between px-4 py-2.5 text-[12px] text-gray-600 dark:text-gray-400">
        <span>{loading ? '불러오는 중…' : `${sorted.length}개 공구`}</span>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          aria-label="공구 정렬 기준"
          className="bg-transparent border-0 text-[12px] font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
        >
          {SORTS.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* 피드 — 2열 그리드 (당근식) */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 px-4 pb-8">
          {/* 🛡️ 2026-05-27 (사용자 요청): 카드 모양 shimmer skeleton — 이미지 + 텍스트 2줄 + 가격. */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="aspect-square rounded-xl skeleton-shimmer" />
              <div className="h-3 w-3/4 rounded skeleton-shimmer mt-1" />
              <div className="h-4 w-1/2 rounded skeleton-shimmer" />
              <div className="h-2.5 w-1/3 rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        // 🛡️ 2026-05-20: 사용자 요청 — 빈 상태에서 인접 지역 공구 자동 노출.
        //   선택 카테고리에 결과 없으면 전체 카테고리로 자동 fallback fetch.
        <EmptyStateWithFallback category={category} onReset={() => setCategory('all')} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 px-4 pb-8">
          {/* 🛡️ 2026-05-24 (loading P0): 첫 4개 카드 = above-fold → eager + fetchpriority=high (LCP 단축).
              나머지는 lazy 유지 (scroll 시 자연 로드). */}
          {sorted.map((p, idx) => (
            <GroupBuyFeedCard key={p.id} p={p} aboveFold={idx < 4} />
          ))}
        </div>
      )}

      {/* 하단 — 전체 보기 링크 */}
      {!loading && sorted.length >= 50 && (
        <div className="px-4 pb-8 text-center">
          <Link
            to="/vouchers"
            className="inline-block px-5 py-3 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-full text-sm font-bold text-gray-900 dark:text-white"
          >
            모든 공구 보기 →
          </Link>
        </div>
      )}
    </>
  )
}

/**
 * 🛡️ 2026-05-20: 카테고리에 결과 0건 → 자동으로 "전체 카테고리" 공구 fetch 해서 노출.
 *   사용자 의도: "다른 지역 보기 버튼만" 보다 "인접 공구 자동 노출" 이 마찰 ↓.
 *   (백엔드 region 필터 미지원 → category 만 'all' 로 폴백. 향후 region 도입 시 동일 패턴 확장.)
 */
function EmptyStateWithFallback({ category, onReset }: { category: CategoryKey; onReset: () => void }) {
  // 🛡️ 2026-05-22: useQuery — 메인 피드에서 'all' fetch 되면 캐시 hit (중복 호출 X).
  //   메인 GroupBuyFeed 가 category='all' 이미 fetch 했으면 즉시 사용.
  const { data: fallback = [], isLoading: fbLoading } = useQuery<FeedProduct[]>({
    queryKey: ['group-buy-products', 'active', 'all'],
    queryFn: async () => {
      const res = await api.get('/api/group-buy/products?status=active&category=all')
      return Array.isArray(res.data?.data) ? res.data.data : []
    },
    enabled: category !== 'all',
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    select: (data) =>
      [...data].sort((a, b) => (b.group_buy_current ?? 0) - (a.group_buy_current ?? 0)).slice(0, 6),
  })

  return (
    <div className="px-4 pt-2 pb-8">
      <div className="py-10 text-center">
        <p className="text-4xl mb-3">🤷</p>
        <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          {category === 'all' ? '진행 중인 공구가 없어요' : '이 카테고리에 진행 중인 공구가 없어요'}
        </p>
        {category !== 'all' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            대신 다른 인기 공구를 추천드려요
          </p>
        )}
        {category !== 'all' && (
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-xs font-bold"
          >
            전체 공구 보기
          </button>
        )}
      </div>

      {/* 인접 카테고리 공구 노출 (전체에서 인기 6개) */}
      {category !== 'all' && (
        <>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wide">
              💡 다른 인기 공구
            </span>
          </div>
          {fbLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-gray-100 dark:bg-[#121212] animate-pulse" />
              ))}
            </div>
          ) : fallback && fallback.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {fallback.map(p => <GroupBuyFeedCard key={p.id} p={p} />)}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
