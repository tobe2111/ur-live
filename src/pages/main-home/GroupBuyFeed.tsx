/**
 * 🛡️ 2026-05-20: 홈 공구 피드 (당근식).
 *
 * 단일 통합 피드 — 카테고리 필터 + 정렬 옵션.
 * 광고/배너/최근본/카테고리섹션 없음. 오롯이 공구만.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
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
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<FeedProduct[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/api/group-buy/products?status=active&category=${category}`)
      .then(res => {
        if (cancelled) return
        const data: FeedProduct[] = Array.isArray(res.data?.data) ? res.data.data : []
        setItems(data)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [category])

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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-gray-100 dark:bg-[#121212] animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        // 🛡️ 2026-05-20: 사용자 요청 — 빈 상태에서 인접 지역 공구 자동 노출.
        //   선택 카테고리에 결과 없으면 전체 카테고리로 자동 fallback fetch.
        <EmptyStateWithFallback category={category} onReset={() => setCategory('all')} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 px-4 pb-8">
          {sorted.map(p => (
            <GroupBuyFeedCard key={p.id} p={p} />
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
  const [fallback, setFallback] = useState<FeedProduct[] | null>(null)
  const [fbLoading, setFbLoading] = useState(false)

  useEffect(() => {
    if (category === 'all') { setFallback([]); return }
    let cancelled = false
    setFbLoading(true)
    api.get('/api/group-buy/products?status=active&category=all')
      .then(res => {
        if (cancelled) return
        const data: FeedProduct[] = Array.isArray(res.data?.data) ? res.data.data : []
        // 인기순 상위 6개만 (인접 공구 추천)
        const top = [...data].sort((a, b) => (b.group_buy_current ?? 0) - (a.group_buy_current ?? 0)).slice(0, 6)
        setFallback(top)
      })
      .catch(() => { if (!cancelled) setFallback([]) })
      .finally(() => { if (!cancelled) setFbLoading(false) })
    return () => { cancelled = true }
  }, [category])

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
