/**
 * 🛡️ 2026-05-20: 홈 공구 피드 (당근식).
 *
 * 단일 통합 피드 — 카테고리 필터 + 정렬 옵션.
 * 광고/배너/최근본/카테고리섹션 없음. 오롯이 공구만.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from '@/hooks/queries'
import { useFcfsMap } from '@/features/group-buy/useFcfs'
import GroupBuyFeedCard from './GroupBuyFeedCard'
import type { Product } from './types'
import { matchAddress } from '@/shared/constants/korea-regions'

interface FeedProduct extends Product {
  group_buy_current?: number
  group_buy_target?: number
  group_buy_status?: string
  expires_at?: string | null
  seller_name?: string
  seller_avatar?: string
  category?: string
  business_address?: string
  // restaurant_address 는 base Product 에 이미 있음(string|undefined) — 재선언 금지(TS2430 extends 충돌).
  restaurant_lat?: number | null
  restaurant_lng?: number | null
  discount_rate?: number
  current_price?: number
  original_price?: number
  sold_count?: number
  created_at?: string
}

// 🖥️ 2026-07-16 (대표 신고 — PC 정렬 무반응): 정렬 필드가 sparse(group_buy_current/discount_rate 대부분
//   null·0)라 인기순/할인율순이 서버 기본순(최신)과 동일해 보였음. 실제 값 기반으로 견고화.
function soldOf(p: FeedProduct): number {
  return p.sold_count ?? p.group_buy_current ?? 0
}
function discountOf(p: FeedProduct): number {
  if (p.discount_rate != null && p.discount_rate > 0) return p.discount_rate
  const price = p.current_price ?? p.price ?? 0
  const orig = p.original_price ?? 0
  return orig > price && orig > 0 ? Math.round(((orig - price) / orig) * 100) : 0
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

// 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): 'near' = userLoc 기준 거리순(내부 SORTS 칩엔 없음 — PcHomePage 가 구동).
type SortKey = typeof SORTS[number]['key'] | 'near'
type CategoryKey = typeof CATEGORIES[number]['key']

// 🖥️ 2026-07-15 (대표 — PC 홈 당근 스타일): 같은 피드를 PC 풀너비 홈(PcHomePage)에서도 재사용.
//   `pc` = 4~5열 그리드 + 내부 카테고리칩/정렬셀렉트/카운트 숨김(좌측 레일 + 정렬칩이 대신 구동).
//   category/sort 는 controlled(props) 또는 uncontrolled(내부 state) 겸용 — props 미전달 시 기존 모바일
//   동작 byte-불변(홈 <GroupBuyFeed/> 무변경). 데이터/SSR시드/prefetch/페이지네이션 전부 공유.
export default function GroupBuyFeed({
  pc = false,
  category: categoryProp,
  onCategoryChange,
  sort: sortProp,
  onSortChange,
  regionKey,
  districtKey,
  userLoc,
}: {
  pc?: boolean
  category?: CategoryKey
  onCategoryChange?: (c: CategoryKey) => void
  sort?: SortKey
  onSortChange?: (s: SortKey) => void
  // 🗺️ 2026-07-16 (대표 — PC 홈 위치 필터): 선택 지역(시/도 key + 세부지역 key)으로 피드를 클라이언트
  //   주소-텍스트 매칭 필터(matchAddress). 미지정이면 matchAddress 가 true → 기존 동작 byte-불변.
  regionKey?: string
  districtKey?: string
  // 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): sort='near' 일 때 이 좌표 기준 거리순 정렬(좌표 없는 딜은 뒤로).
  userLoc?: { lat: number; lng: number } | null
} = {}) {
  const [categoryState, setCategoryState] = useState<CategoryKey>('all')
  const [sortState, setSortState] = useState<SortKey>('popular')
  const category = categoryProp ?? categoryState
  const sort = sortProp ?? sortState
  const setCategory = (c: CategoryKey) => { if (onCategoryChange) onCategoryChange(c); else setCategoryState(c) }
  const setSort = (s: SortKey) => { if (onSortChange) onSortChange(s); else setSortState(s) }
  // 🖥️ PC 홈(pc)은 한 줄 4개(대표 요청 — 카드 크게), 모바일은 기존 2~3열. PcHomePage 는 lg+ 에서만
  //   렌더되므로 grid-cols-4 고정으로 충분(레일 옆 flex-1 폭에서 카드가 그만큼 커짐). 로딩/본문/더보기 공통.
  const gridCls = pc
    ? 'grid grid-cols-4 gap-5 pb-10'
    : 'grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 pb-8'

  // 🎯 2026-07-01 (대표 — 동네딜 추첨 응모): 활성 추첨 상품 Map(공개, 60s 캐시) → 카드에 배지 노출.
  const { fcfsMap } = useFcfsMap()

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
  const { data: items = [], isLoading: loading, isError, refetch } = useQuery<FeedProduct[]>({
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

  // 📄 2026-07-08 (대표 "전체 상품이 안 나옴 — 50곳밖에"): 서버 기본 피드는 LIMIT 50(캐시/SSR 고정).
  //   50개 초과분은 페이지네이션으로 이어 로드(page=2,3…, 같은 정렬 = DEMO_LAST,created_at DESC → 중복/누락 0).
  //   1페이지는 기존 SSR/캐시 fast-path 유지, 이후만 라이브 fetch — 무한스크롤로 전체 노출.
  const [extraPages, setExtraPages] = useState<FeedProduct[][]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  // 카테고리 변경 시 누적분 리셋
  useEffect(() => { setExtraPages([]); setReachedEnd(false) }, [category])

  // 🗺️ 2026-07-16 (대표 신고 — 스크롤 로드 시 이용권 배치가 제멋대로 바뀜): '누적 전체 재정렬'이 아니라
  //   페이지(밴드)별로 정렬 → 이미 보인 카드는 위치 고정, 새 페이지만 아래로 append(재정렬 없음).
  // 지역 필터: restaurant_address 텍스트 매칭(주소 없으면 표시=전국) + 매칭 0 이면 전체 폴백(빈 화면 방지).
  const inRegion = (p: FeedProduct) => {
    if (!regionKey) return true
    const a = p.restaurant_address || p.business_address
    return !a || matchAddress(a, regionKey, districtKey)
  }
  const sortBand = (arr: FeedProduct[]) => {
    const a = [...arr]
    switch (sort) {
      case 'near': {
        if (!userLoc) return a
        const d2 = (p: FeedProduct) => {
          const la = p.restaurant_lat, ln = p.restaurant_lng
          if (la == null || ln == null || !Number.isFinite(la) || !Number.isFinite(ln)) return Infinity
          const dy = la - userLoc.lat, dx = ln - userLoc.lng
          return dy * dy + dx * dx
        }
        return a.sort((x, y) => d2(x) - d2(y))
      }
      case 'popular': return a.sort((x, y) => soldOf(y) - soldOf(x))
      case 'deadline': return a.sort((x, y) => {
        const ax = x.expires_at ? new Date(x.expires_at).getTime() : Infinity
        const bx = y.expires_at ? new Date(y.expires_at).getTime() : Infinity
        return ax - bx
      })
      case 'discount': return a.sort((x, y) => discountOf(y) - discountOf(x))
      case 'newest': return a.sort((x, y) => {
        const ax = x.created_at ? new Date(x.created_at).getTime() : 0
        const bx = y.created_at ? new Date(y.created_at).getTime() : 0
        return bx - ax
      })
      default: return a
    }
  }

  const loadMore = async () => {
    if (loadingMore || reachedEnd) return
    setLoadingMore(true)
    try {
      const nextPage = extraPages.length + 2  // page1 = items → 다음은 2부터
      const res = await api.get(`/api/group-buy/products?status=active&category=${category}&page=${nextPage}&limit=50`)
      const arr: FeedProduct[] = Array.isArray(res.data?.data) ? res.data.data : []
      for (const p of arr) { if (p?.id != null) qc.setQueryData(queryKeys.groupBuyProduct(p.id), p) }
      setExtraPages(prev => [...prev, arr])
      if (arr.length < 50) setReachedEnd(true)
    } catch { /* 실패 시 버튼 유지 — 다음 시도 가능 */ } finally { setLoadingMore(false) }
  }

  // 무한 스크롤 센티넬 — 바닥 근처 도달 시 다음 페이지 로드. page1 이 꽉 찼을 때(50개)만 활성.
  const canLoadMore = items.length >= 50 && !reachedEnd
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!canLoadMore) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadMore, extraPages.length, loadingMore])

  // 🗺️ 2026-07-16 (대표 신고 — 스크롤 로드 시 재정렬): 페이지(밴드)별로 정렬해 이어붙임 → page1 은 page2 가
  //   로드돼도 위치 고정(재정렬 없음), 새 페이지만 아래로. 밴드 안에서만 정렬(정렬칩 의미 유지) + id dedup.
  const sorted = useMemo(() => {
    const bands = [items, ...extraPages]
    const seen = new Set<number | string>()
    const out: FeedProduct[] = []
    const pushBand = (band: FeedProduct[], filterRegion: boolean) => {
      const src = filterRegion ? band.filter(inRegion) : band
      for (const p of sortBand(src)) {
        if (p?.id != null && !seen.has(p.id)) { seen.add(p.id); out.push(p) }
      }
    }
    for (const band of bands) pushBand(band, true)
    // 지역 매칭 0(전부 필터로 사라짐) → 지역 무시 전체 폴백(빈 화면 방지).
    if (regionKey && out.length === 0) { seen.clear(); out.length = 0; for (const band of bands) pushBand(band, false) }
    return out
    // inRegion/sortBand 는 매 렌더 재생성(아래 deps 를 클로저) → deps 에 원천값만 나열.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, extraPages, sort, userLoc, regionKey, districtKey])

  return (
    <>
      {/* 🧹 2026-06-19 (대표 신고 — 홈 번잡): 상단 '공구로 딜 얻는 법' 가이드 카드 제거.
          하단 DealEarnStrip('딜 모으는 법') + /help/deal-guide 가 동일 교육을 담당 → 중복.
          상단을 비워 카테고리 칩 + 딜 카드가 즉시(첫 화면) 보이도록. */}

      {/* 카테고리 칩 — sticky 한 단계 아래 (헤더는 페이지에서 sticky 처리).
          🖥️ PC 홈에선 좌측 레일이 카테고리를 담당 → 내부 칩 숨김. */}
      {!pc && (
      <div className="bg-white dark:bg-[#0F151D] border-b border-gray-100 dark:border-[#2A3446] sticky top-12 z-10">
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
                    : 'bg-gray-100 dark:bg-[#1A2334] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2A3446]'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>
      )}

      {/* 정렬 옵션 + 카운트 — 🖥️ PC 홈에선 정렬칩이 대신 구동 → 숨김. */}
      {!pc && (
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
      )}

      {/* 피드 — 2열 그리드 (당근식) */}
      {loading ? (
        <div className={gridCls}>
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
      ) : isError && sorted.length === 0 ? (
        // 🛡️ 2026-06-26 (소비자 감사 P0): fetch 실패를 '공구 없음'(죽은 마켓)으로 위장하지 않음 — 재시도 노출.
        <div className="px-4 py-16 text-center">
          <p className="text-4xl mb-3">📡</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">공구를 불러오지 못했어요</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">네트워크 상태를 확인해주세요.</p>
          <button onClick={() => refetch()} className="inline-block px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm font-bold">다시 시도</button>
        </div>
      ) : sorted.length === 0 ? (
        // 🛡️ 2026-05-20: 사용자 요청 — 빈 상태에서 인접 지역 공구 자동 노출.
        //   선택 카테고리에 결과 없으면 전체 카테고리로 자동 fallback fetch.
        <EmptyStateWithFallback category={category} onReset={() => setCategory('all')} />
      ) : (
        <div className={gridCls}>
          {/* 🛡️ 2026-05-24 (loading P0): 첫 4개 카드 = above-fold → eager + fetchpriority=high (LCP 단축).
              나머지는 lazy 유지 (scroll 시 자연 로드). */}
          {/* 🎯 2026-07-02 (대표 "첫 페인트에 응모/추첨 배지 늦게 등장"): 피드 응답에 서버 enrich 된
              p.fcfs 를 첫 페인트 시드로 사용, 클라 훅(fcfsMap — 신선 카운트)이 도착하면 그 값 우선. */}
          {sorted.map((p, idx) => {
            const emb = (p as { fcfs?: { enabled?: boolean; prelaunch?: boolean; spots?: number; appliedDisplay?: number; deadline?: string | null } }).fcfs
            const seed = emb?.enabled ? { spots: emb.spots || 0, appliedDisplay: emb.appliedDisplay || 0, deadline: emb.deadline ?? null, prelaunch: !!emb.prelaunch } : undefined
            return <GroupBuyFeedCard key={p.id} p={p} aboveFold={idx < 4} fcfs={fcfsMap.get(p.id) ?? seed} pc={pc} userLoc={userLoc} />
          })}
        </div>
      )}

      {/* 📄 무한 스크롤 — 50개 초과분 이어 로드(센티넬 도달 시 자동). 실패/대기 시 수동 버튼. */}
      {!loading && sorted.length > 0 && canLoadMore && (
        <div ref={sentinelRef} className="px-4 pb-6 flex justify-center">
          {loadingMore ? (
            <div className={`${gridCls} w-full`}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="aspect-square rounded-xl skeleton-shimmer" />
                  <div className="h-3 w-3/4 rounded skeleton-shimmer mt-1" />
                  <div className="h-4 w-1/2 rounded skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={loadMore}
              className="px-5 py-3 bg-white dark:bg-[#1A2334] border border-gray-200 dark:border-[#2A3446] rounded-full text-sm font-bold text-gray-900 dark:text-white"
            >
              더 보기
            </button>
          )}
        </div>
      )}

      {/* 하단 — 전체 동네딜(지역/검색) 페이지 링크.
          🧭 2026-06-19: 홈은 동네딜 '피드'(카테고리+정렬)라 지역필터/검색은 /group-buy 허브에. 링크 대상 /vouchers→/group-buy 정정.
          하단바 5탭에서 동네딜 탭이 교환권으로 바뀌므로(홈=동네딜이라 중복), 이 링크가 전체 동네딜 페이지의 상시 진입점. */}
      {!loading && sorted.length > 0 && (
        <div className="px-4 pb-8 text-center">
          <Link
            to="/group-buy"
            className="inline-block px-5 py-3 bg-white dark:bg-[#1A2334] border border-gray-200 dark:border-[#2A3446] rounded-full text-sm font-bold text-gray-900 dark:text-white"
          >
            전체 동네딜 보기 →
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-gray-100 dark:bg-[#1A2334] animate-pulse" />
              ))}
            </div>
          ) : fallback && fallback.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {fallback.map(p => <GroupBuyFeedCard key={p.id} p={p} />)}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
