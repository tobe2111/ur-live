/**
 * 🛒 쇼핑 섹션 — `/vouchers` 에서 교환권 '더보기' 버튼 아래로 이어지는 일반 상품 그리드.
 *
 * 2026-09-13 에 `VouchersPage.tsx` 에서 **이동만** 했다(로직 불변). 그 파일이 파일크기 동결값
 * (980줄)에 닿아 있었고, CLAUDE.md 가 "600줄 넘으면 같은이름 폴더로 추출"을 요구한다 —
 * 동결값을 올리는 대신 자기완결 컴포넌트를 꺼냈다.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigationType } from 'react-router-dom'
import { saveListView, readListView } from '@/lib/list-view-cache'
import api from '@/lib/api'
import BrandLoader from '@/components/brand/BrandLoader'
import { SHOP_CATEGORIES } from './constants'
import BrowseProductCard from '../browse/BrowseProductCard'
import type { Product } from '../browse/types'

/** 🔙 2026-09-13: 뒤로 왔을 때 되살릴 쇼핑 목록 상태. 근거: `src/lib/list-view-cache.ts` */
export type ShopViewState = { items: Product[]; page: number; hasMore: boolean; shopCategory: string }

// 🛒 2026-06-20 (사용자 결정 — 교환권/쇼핑 상단 탭 분리) → 2026-06-23 연속 스크롤로 전환: 쇼핑 섹션 =
//   일반 상품(exclude_deal_only=1) 그리드. /browse 와 동일 데이터·카드(BrowseProductCard)·카테고리.
//   교환권 더보기 버튼 아래에 이어짐. 카테고리 칩 선택 시 해당 카테고리로 재조회(무한 스크롤 유지).
export default function ShoppingGrid() {
  // 🔙 2026-09-13: 뒤로(POP) 로 돌아온 경우에만 직전 목록을 되살린다. 하단바로 새로 들어온
  //   사람(PUSH)은 맨 위·첫 페이지를 기대하므로 복원하지 않는다.
  const navType = useNavigationType()
  const shopRestoredRef = useRef<ShopViewState | null | undefined>(undefined)
  if (shopRestoredRef.current === undefined) {
    shopRestoredRef.current = navType === 'POP' ? readListView<ShopViewState>('vouchers:shop') : null
  }
  const shopRestored = shopRestoredRef.current
  const [shopCategory, setShopCategory] = useState(() => shopRestored?.shopCategory ?? 'all')
  const [items, setItems] = useState<Product[]>(() => shopRestored?.items ?? [])
  const [loading, setLoading] = useState(() => shopRestored == null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(() => shopRestored?.page ?? 1)
  const [hasMore, setHasMore] = useState(() => shopRestored?.hasMore ?? true)
  // 🛒 2026-06-23 (대표 '적응형 카테고리'): 실제 상품이 있는 카테고리만 칩 노출. null=로딩(전체만), []=조회완료.
  //   /api/products/count(카테고리별, edge 15분 캐시) 병렬 조회 → 0개 카테고리 자동 숨김(인벤토리 적든 많든 깔끔).
  const [availableShopCats, setAvailableShopCats] = useState<string[] | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // 🗑️ 2026-07-07 [UNLOCK_LOADING] (로딩 낭비 감사): 쇼핑 그리드는 교환권 리스트 + '더보기' 아래(폴드 밖).
  //   마운트 즉시 상품 fetch + 카테고리 count 5개 병렬을 하던 것을 IntersectionObserver 로 게이팅 —
  //   사용자가 쇼핑 섹션 근처(600px)까지 스크롤할 때만 로드(HomeProductsRail 동일 패턴). SSR seed·교환권
  //   리스트·default sort 전부 불변(이 컴포넌트는 리스트 아래 별도 섹션 — additive 게이트 1개).
  const [inView, setInView] = useState(() => shopRestored != null)
  const gateRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = gateRef.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setInView(true); io.disconnect() }
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [inView])
  const load = useCallback((pageNum: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true)
    const params = new URLSearchParams({ page: String(pageNum), limit: '20', exclude_deal_only: '1', sort: 'popular' })
    if (shopCategory !== 'all') params.set('category', shopCategory)
    api.get(`/api/products?${params.toString()}`)
      .then(r => {
        if (r.data?.success) {
          const ni: Product[] = r.data.data || []
          setItems(prev => reset ? ni : [...prev, ...ni])
          setHasMore(ni.length === 20)
          if (reset) setPage(1)
        }
      })
      .catch(() => { /* graceful */ })
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }, [shopCategory])
  // 카테고리 변경(load identity 변경) 시 1페이지부터 리셋 로드. (폴드 밖 → inView 후에만 최초 로드)
  // 🔙 2026-09-13: 되살린 경우 **첫 실행만** 건너뛴다 — 그대로 두면 복원한 목록을 1페이지로 도로 줄여
  //   고치려던 증상(목록 축소·문서 높이 붕괴)이 그대로 재발한다. 이후 카테고리 변경은 정상 리셋.
  const shopSkipFirstLoadRef = useRef(shopRestored != null)
  useEffect(() => {
    if (shopSkipFirstLoadRef.current) { shopSkipFirstLoadRef.current = false; return }
    if (inView) load(1, true)
  }, [load, inView])

  // 🔙 2026-09-13: 현재 목록을 보관 — 상세로 떠났다 돌아오면 이 값으로 되살아난다.
  useEffect(() => {
    if (loading || items.length === 0) return
    saveListView<ShopViewState>('vouchers:shop', { items, page, hasMore, shopCategory })
  }, [items, page, hasMore, shopCategory, loading])
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore || loading) return
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { const n = page + 1; setPage(n); load(n, false) }
    }, { threshold: 0.1 })
    ob.observe(sentinelRef.current)
    return () => ob.disconnect()
  }, [hasMore, loadingMore, loading, page, load])
  // 🛒 2026-06-23: 카테고리별 상품 수 조회 → 비어있는 카테고리 칩 제거. 마운트 1회(전역 카탈로그 기준).
  //   localStorage 캐시(1h) 우선 → 재진입 0-RTT + '전체→확장' 플래시 방지(교환권 카테고리와 동일 패턴).
  useEffect(() => {
    let cancelled = false
    // localStorage 캐시는 inView 무관 즉시 반영(요청 아님) — 재진입 0-RTT 유지.
    try {
      const raw = localStorage.getItem('shop_cats_v1')
      if (raw) {
        const cached = JSON.parse(raw) as { ts: number; data: string[] }
        if (Date.now() - cached.ts < 60 * 60_000 && Array.isArray(cached.data)) setAvailableShopCats(cached.data)
      }
    } catch { /* localStorage 손상 — 무시 */ }
    if (!inView) return  // 폴드 밖 — count 5종 병렬 요청은 섹션 근처 스크롤 시에만
    const cats = SHOP_CATEGORIES.filter(c => c.key !== 'all')
    Promise.all(cats.map(c =>
      api.get(`/api/products/count?exclude_deal_only=1&category=${encodeURIComponent(c.key)}`)
        .then(r => (r.data?.success && Number(r.data.total) > 0) ? c.key : null)
        .catch(() => null)
    )).then(results => {
      if (cancelled) return
      const avail = results.filter((k): k is string => !!k)
      setAvailableShopCats(avail)
      try { localStorage.setItem('shop_cats_v1', JSON.stringify({ ts: Date.now(), data: avail })) } catch { /* quota */ }
    })
    return () => { cancelled = true }
  }, [inView])
  // 노출 칩: 로딩 중(null)엔 '전체'만 → 조회되면 '전체' + 상품 있는 카테고리.
  const visibleShopCats = SHOP_CATEGORIES.filter(c => c.key === 'all' || (availableShopCats?.includes(c.key) ?? false))
  return (
    <div className="pb-4">
      {/* 🗑️ 2026-07-07 폴드-아래 게이트 센티넬: 뷰포트 600px 안에 들어오면 상품/카테고리 count 로드. */}
      <div ref={gateRef} aria-hidden style={{ height: 1 }} />
      {/* 🛒 2026-06-23 (대표 '가장 이상적으로'): 쇼핑 카테고리 = sticky 바(top-[45px], 탭 바로 아래) —
          쇼핑 섹션에 있는 동안 상단에 따라붙어 어디서든 카테고리 전환 가능. 교환권 reveal 그룹은 이때 숨김(슬롯 공유). */}
      <div className="sticky top-[45px] z-20 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="ur-content-wide px-4 lg:px-8 py-2.5">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {visibleShopCats.map(c => {
              const active = shopCategory === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setShopCategory(c.key)}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                    active
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                      : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2C2F35]'
                  }`}
                >
                  {c.Icon && <c.Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="ur-content-wide px-4 lg:px-8 pt-3">
      {loading ? (
        <BrandLoader />
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">쇼핑 상품이 없습니다</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2.5 items-stretch">
            {items.map((p, idx) => (
              <BrowseProductCard key={p.id} product={p} aboveFold={idx < 4} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
            {loadingMore && <div className="text-[11px] text-gray-400 dark:text-gray-500">로드 중...</div>}
            {!hasMore && items.length > 0 && <div className="text-[11px] text-gray-400 dark:text-gray-500">— 마지막 —</div>}
          </div>
        </>
      )}
      </div>
    </div>
  )
}
