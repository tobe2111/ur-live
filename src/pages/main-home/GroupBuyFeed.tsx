/**
 * 🛡️ 2026-05-20: 홈 공구 피드 (당근식).
 *
 * 단일 통합 피드 — 카테고리 필터 + 정렬 옵션.
 * 광고/배너/최근본/카테고리섹션 없음. 오롯이 공구만.
 */

import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'
import { SearchX, Flame, Tag, Clock, Store } from 'lucide-react'
import { DEAL_CATS } from '@/pages/pc-home/PcHomeRail'
import { SortMenu, type SortOptionItem } from '@/components/ui/sort-menu'
import { useMediaQuery } from '@/hooks/useMediaQuery'
// 🖼️ 폭·중단점은 워커의 카드 preload 와 같은 값이어야 한다(`shared/home-card-image` SSOT).
import { HOME_CARD_IMG_WIDTH_LG, HOME_CARD_IMG_WIDTH_BASE, HOME_CARD_LG_QUERY } from '@/shared/home-card-image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from '@/hooks/queries'
import { useFcfsMap } from '@/features/group-buy/useFcfs'
import GroupBuyFeedCard from './GroupBuyFeedCard'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { sellerEntryPath } from '@/utils/seller-entry'
import type { Product } from './types'
import { matchAddress, matchRegionCoords } from '@/shared/constants/korea-regions'
import { addressInRegion, type RegionRef } from '@/shared/constants/region-slugs'
import { parseUTCDate } from '@/utils/date'

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

/**
 * 🏷️ 카테고리는 **`DEAL_CATS` 한 표만 읽는다** (2026-08-30).
 *
 *   ⚠️ 이 화면이 자기 표를 따로 갖고 있어서 **같은 분류가 한 화면에 두 번, 다르게** 떴다 —
 *      상단 탭은 `전체·식사·미용·숙소·기타`, 바로 아래 칩은 `전체·식사·숙소·뷰티·기타`.
 *      **같은 것을 두 이름(미용/뷰티)으로 부르고 순서도 달랐다.** 사용자에겐 두 분류
 *      체계가 있는 것처럼 보이고, 그게 "조립한 화면" 인상의 큰 몫이다.
 *   🩸 더 뼈아픈 건 `PcHomeRail` 이 자기 주석에 *"카테고리 라벨 SSOT — 문구가 갈리면
 *      반드시 어긋난다"* 고 **미리 적어 뒀는데도** 두 번째 표가 생겨 그대로 어긋난 것이다.
 *      SSOT 는 선언이 아니라 **다른 표가 없을 때** 성립한다.
 */
const CATEGORIES = DEAL_CATS

/**
 * 🖊️ 2026-08-30: 이모지 라벨 → 선 아이콘 + **공용 `SortMenu` 로 통일**.
 *   이 화면만 네이티브 `<select>` 를 쓰고 있었다 — 그래서 라벨에 SVG 를 못 넣어 이모지가
 *   박혀 있었고, 동시에 같은 일을 하는 컨트롤이 앱에 두 종류가 되었다(교환권·쇼핑·공구는
 *   전부 `SortMenu`). `sort-menu.tsx` 의 주석이 스스로 밝히듯 그 컴포넌트의 존재 이유가
 *   "네이티브 select 대체" 인데, 정작 홈이 예외로 남아 있었다.
 */
// 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): '마감임박' 칩 제거. 이용권은 모여야 열리는 공동구매가
//   아니라 즉시 구매라 마감이 개념으로 없다. 라이브 실측으로도 활성 338건 중 마감이 박힌 건 1건뿐이라
//   그 칩은 사실상 아무 순서도 만들지 못했다. 구매 후 사용 기간은 `voucher_expiry`(별개 필드)가 맡는다.
const SORTS: Array<SortOptionItem<'popular' | 'discount' | 'newest'>> = [
  { key: 'popular',  label: '인기순',   Icon: Flame },
  { key: 'discount', label: '할인율',   Icon: Tag },
  { key: 'newest',   label: '최신순',   Icon: Clock },
]

// 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): 'near' = userLoc 기준 거리순(내부 SORTS 칩엔 없음 — PcHomePage 가 구동).
type SortKey = typeof SORTS[number]['key'] | 'near'
type CategoryKey = typeof CATEGORIES[number]['key']

// 🖥️ 2026-07-15 (대표 — PC 홈 당근 스타일): 같은 피드를 PC 풀너비 홈(PcHomePage)에서도 재사용.
//   `pc` = 4~5열 그리드 + 내부 카테고리칩/정렬셀렉트/카운트 숨김(좌측 레일 + 정렬칩이 대신 구동).
//   category/sort 는 controlled(props) 또는 uncontrolled(내부 state) 겸용 — props 미전달 시 기존 모바일
//   동작 byte-불변(홈 <GroupBuyFeed/> 무변경). 데이터/SSR시드/prefetch/페이지네이션 전부 공유.
export default function GroupBuyFeed({
  pc = false,
  firstScreen = true,
  category: categoryProp,
  onCategoryChange,
  sort: sortProp,
  onSortChange,
  regionKey,
  districtKey,
  regionRef,
  userLoc,
}: {
  pc?: boolean
  /**
   * 이 피드의 **첫 행이 첫 화면에 보이는가**. 보일 때만 앞 4장을 eager + fetchPriority=high 로
   * 받는다(잠긴 aboveFold 계약 — `GroupBuyFeedCard`).
   *
   * 🔴 2026-08-22 라이브 실측: 홈에서 이 피드는 [히어로 → 편성 섹션 2개] **아래 세 번째 블록**이라
   *    첫 행이 모바일 1,605px / PC 1,385px 에 있다(뷰포트 844 / 1,080). 그런데 위치와 무관하게
   *    앞 4장을 무조건 최우선으로 받고 있었다 — 낭비일 뿐 아니라 fetchPriority=high 라
   *    **진짜 첫 화면 이미지(259·516px)와 대역폭을 다퉜다.** 레티나 PC 기준 그 4장이 약 240KB.
   * ⚠️ 기본값 `true` = 기존 동작(지역 페이지 등 피드가 최상단인 호출부 불변). 홈 2곳만 false.
   *    레이아웃을 바꿔 피드를 위로 올리면 **이 값을 되돌려야 한다.**
   */
  firstScreen?: boolean
  category?: CategoryKey
  onCategoryChange?: (c: CategoryKey) => void
  sort?: SortKey
  onSortChange?: (s: SortKey) => void
  // 🗺️ 2026-07-16 (대표 — PC 홈 위치 필터): 선택 지역(시/도 key + 세부지역 key)으로 피드를 클라이언트
  //   주소-텍스트 매칭 필터(matchAddress). 미지정이면 matchAddress 가 true → 기존 동작 byte-불변.
  regionKey?: string
  districtKey?: string
  // 🗺️ 2026-08-03 (대표 — 도시별 색인 페이지): 행정 시군구 필터(`/region/*`). 상권(regionKey)과 별개 축 —
  //   전달되면 상권 필터보다 **우선**하고, 미전달이면 기존 경로 그대로(홈 무영향).
  regionRef?: RegionRef
  // 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): sort='near' 일 때 이 좌표 기준 거리순 정렬(좌표 없는 딜은 뒤로).
  userLoc?: { lat: number; lng: number } | null
} = {}) {
  const navigate = useNavigate()
  const [categoryState, setCategoryState] = useState<CategoryKey>('all')
  const [sortState, setSortState] = useState<SortKey>('popular')
  const category = categoryProp ?? categoryState
  const sort = sortProp ?? sortState
  const setCategory = (c: CategoryKey) => { if (onCategoryChange) onCategoryChange(c); else setCategoryState(c) }
  const setSort = (s: SortKey) => { if (onSortChange) onSortChange(s); else setSortState(s) }
  // 🖥️ PC 홈(pc): 모바일은 기존 2~3열. lg 미만 값은 `/region/*`(PC·모바일 공용 페이지)이 쓴다.
  // 📐 2026-08-17 (대표 — "카드가 커, 컴팩트하게" → 재지시 "1줄에 이용권 5개"): 2026-07-15 의
  //   "4열 카드 크게"를 **대체** — PC 는 **5열 고정**(xl+), lg(좁은 노트북)만 4열, gap 축소.
  //   컨테이너 1440(PcHomePage)과 짝 → 카드 ~260px. 2xl 6열은 대표 재지시로 제거(5개가 기준).
/**
   * 🖼️ 카드 사진 해상도 — **열 수를 아는 쪽**이 정한다(2026-08-27).
   *   lg+ 는 4열이라 카드가 322px, 그 미만은 모바일 2열·태블릿 4열 모두 175~190px 다.
   *   `cfSrcSet` 이 x-디스크립터라 base 가 곧 1x CSS 폭 — 크게 잡으면 3x 에서 그대로 증폭된다.
   *   ⚠️ 카드마다 `useMediaQuery` 를 부르면 리스너가 카드 수만큼(50+) 붙는다. 여기서 한 번만.
   */
  const isLgViewport = useMediaQuery(HOME_CARD_LG_QUERY)
  const cardImgWidth = isLgViewport ? HOME_CARD_IMG_WIDTH_LG : HOME_CARD_IMG_WIDTH_BASE

  const gridCls = pc
    // 📐 2026-08-19 (대표 — "한 줄에 이용권 5개에서 4개로"): xl 5열을 뺀다. 카드가 커져 사진·가격이
    //   읽히고, 위 섹션 그리드(lg:grid-cols-4)와도 열 수가 같아진다(같은 화면에서 열이 갈리지 않는다).
    // 📐 2026-08-24: md(768~1023, 태블릿)가 `sm` 규칙에 걸려 **3열**이었다. 편성 섹션은 4개를
    //   뿌리므로 마지막 하나가 줄에 혼자 남아 오른쪽이 텅 비었다 — 태블릿도 4열로 맞춘다.
    ? `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${DEAL_GRID_GAP} pb-8`
    : `grid grid-cols-2 sm:grid-cols-3 ${DEAL_GRID_GAP} px-4 pb-8`

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
  /**
   * 🚦 2026-09-03 (대표 "마저 다 해줘"): **정렬을 서버로.** 이전엔 서버가 준 최신 50개(+스크롤분) 안에서만
   *   정렬해 "인기순"이 사실은 "최근 50개 중 인기순"이었다 — 전체가 338건인데. 이제 서버가 전체에서
   *   정렬해 상위부터 준다(정의는 서버 ALLOWED_GB_SORT 가 클라 soldOf/discountOf 를 미러).
   *   거리순은 `sort` 가 아니라 `near`(서버 거리 랭킹)가 담당한다.
   *   ⚠️ 좌표는 **서버 캐시키 단위(0.02°≈2km)로 반올림**해 보낸다 — 몇 m 움직일 때마다 캐시가 갈리면
   *      엣지 적중이 무너진다. 화면에 보이는 최종 순서는 아래 `sortBand` 가 정확한 좌표로 다시 매긴다.
   */
  const nearKey = sort === 'near' && userLoc
    ? `${(Math.round(userLoc.lat / 0.02) * 0.02).toFixed(2)},${(Math.round(userLoc.lng / 0.02) * 0.02).toFixed(2)}`
    : ''
  const serverSort = sort === 'near' ? '' : sort
  const feedParams = `${serverSort ? `&sort=${serverSort}` : ''}${nearKey ? `&near=${nearKey}` : ''}`
  const { data: items = [], isLoading: loading, isError, refetch } = useQuery<FeedProduct[]>({
    queryKey: queryKeys.groupBuyList('active', category, serverSort || (nearKey && `near:${nearKey}`) || ''),
    queryFn: async () => {
      const res = await api.get(`/api/group-buy/products?status=active&category=${category}${feedParams}`)
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
    // 🚦 2026-09-03: 정렬을 바꾸면 캐시키가 갈리므로 그대로 두면 **빈 화면 → 스켈레톤**이 된다.
    //   직전 결과를 유지한 채 새 정렬을 받아 온다(그 사이 sortBand 가 로드된 것만이라도 즉시 재정렬).
    placeholderData: (prev) => prev,
  })

  // 📄 2026-07-08 (대표 "전체 상품이 안 나옴 — 50곳밖에"): 서버 기본 피드는 LIMIT 50(캐시/SSR 고정).
  //   50개 초과분은 페이지네이션으로 이어 로드(page=2,3…, 같은 정렬 = DEMO_LAST,created_at DESC → 중복/누락 0).
  //   1페이지는 기존 SSR/캐시 fast-path 유지, 이후만 라이브 fetch — 무한스크롤로 전체 노출.
  const [extraPages, setExtraPages] = useState<FeedProduct[][]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  // 카테고리·정렬 변경 시 누적분 리셋 (🚦 2026-09-03: 정렬이 서버로 갔으므로 옛 순서로 받은 페이지가
  //   새 정렬 결과와 섞이면 중복·누락이 생긴다 — 밴드를 통째로 버리고 page2 부터 다시 쌓는다.)
  useEffect(() => { setExtraPages([]); setReachedEnd(false) }, [category, serverSort, nearKey])

  // 🗺️ 2026-07-16 (대표 신고 — 스크롤 로드 시 이용권 배치가 제멋대로 바뀜): '누적 전체 재정렬'이 아니라
  //   페이지(밴드)별로 정렬 → 이미 보인 카드는 위치 고정, 새 페이지만 아래로 append(재정렬 없음).
  // 지역 필터: restaurant_address 텍스트 매칭. 🗺️ 2026-07-19 (대표 신고 — 부산 선택인데 연남버거 상단):
  //   주소 없는 딜을 통과(`!a ||`)시키던 것이 지역 필터 누수의 원인 → 지역 선택 시 주소-미상 딜은 제외.
  //   (매칭 0 이면 아래 폴백이 '전체' 로 전환 + 안내 문구 — 조용한 오표시 대신 명시.)
  const inRegion = (p: FeedProduct) => {
    // 🗺️ 2026-08-03 (대표 — 도시별 색인 페이지): 행정 시군구 필터(`/region/*` 전용, additive).
    //   상권(regionKey)과 **다른 축**이라 별도 분기다 — 상권 택소노미엔 서울 서대문구·부산 연제구처럼
    //   상품이 많은데 빠진 지역이 있어서(2026-08-03 실측), 색인 페이지는 주소 파싱 기반으로 거른다.
    //   미전달이면 아래 기존 경로가 그대로 실행 → 홈 동작 byte-불변.
    if (regionRef) return addressInRegion(p.restaurant_address || p.business_address, regionRef)
    if (!regionKey) return true
    const a = p.restaurant_address || p.business_address
    if (a) return matchAddress(a, regionKey, districtKey)
    // 🗺️ 2026-07-20 (좌표 고도화): 주소-미상 딜은 좌표가 있으면 시/도 반경(matchRegionCoords)으로 판정 —
    //   주소 없이도 지역 필터에 정확히 포함/제외. 좌표까지 없으면 제외(누수 방지). district 는 텍스트 전용.
    if (districtKey) return false
    const la = p.restaurant_lat, ln = p.restaurant_lng
    if (la != null && ln != null) return matchRegionCoords(la, ln, regionKey) === true
    return false
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
      case 'discount': return a.sort((x, y) => discountOf(y) - discountOf(x))
      case 'newest': return a.sort((x, y) => {
        const ax = x.created_at ? parseUTCDate(x.created_at).getTime() : 0
        const bx = y.created_at ? parseUTCDate(y.created_at).getTime() : 0
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
      const res = await api.get(`/api/group-buy/products?status=active&category=${category}&page=${nextPage}&limit=50${feedParams}`)
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
  const { list: sorted, regionFallback } = useMemo(() => {
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
    // 지역 매칭 0(전부 필터로 사라짐) → 지역 무시 전체 폴백(빈 화면 방지) + 🗺️ 2026-07-19 안내 플래그
    //   (조용히 전체를 보여주면 "부산인데 서울 딜이 왜?" 오해 — 명시 문구로 전환 사실을 알림).
    let fb = false
    // ⚠️ 조건에 `regionRef` 를 **넣지 말 것**(2026-08-03). 홈은 빈 화면을 피하려고 전체로 폴백하지만,
    //    `/region/*` 색인 페이지가 같은 짓을 하면 모든 도시 페이지가 '전국 전체 목록'이라는 **동일 콘텐츠**가
    //    되어 중복 콘텐츠로 색인된다 — 도시 페이지를 만든 이유가 통째로 사라진다. 지역 페이지는 0건이면 0건.
    if (regionKey && out.length === 0) { fb = true; seen.clear(); out.length = 0; for (const band of bands) pushBand(band, false) }
    return { list: out, regionFallback: fb }
    // inRegion/sortBand 는 매 렌더 재생성(아래 deps 를 클로저) → deps 에 원천값만 나열.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // regionRef 는 객체라 참조가 매 렌더 바뀔 수 있어 원시값으로 분해해 넣는다(무한 재계산 방지).
  }, [items, extraPages, sort, userLoc, regionKey, districtKey, regionRef?.sido, regionRef?.sigungu])

  return (
    <>
      {/* 🧹 2026-06-19 (대표 신고 — 홈 번잡): 상단 '공구로 딜 얻는 법' 가이드 카드 제거.
          하단 DealEarnStrip('딜 모으는 법') + /help/deal-guide 가 동일 교육을 담당 → 중복.
          상단을 비워 카테고리 칩 + 딜 카드가 즉시(첫 화면) 보이도록. */}

      {/* 카테고리 칩 — sticky 한 단계 아래 (헤더는 페이지에서 sticky 처리).
          🖥️ PC 홈에선 좌측 레일이 카테고리를 담당 → 내부 칩 숨김. */}
      {/* 🧹 2026-08-30 (대표 — "카테고리 UI 디자인이 문제"): 칩 행은 **부모가 카테고리를
          안 가질 때만** 그린다.
          🩸 이전엔 `!pc` 만 보고 그려서, 모바일 홈에서 카테고리가 **두 번** 떴다 —
             위에 `MobileHomePage` 의 아이콘 탭(전체·식사·미용·숙소·기타)이 있고
             바로 아래 같은 것이 pill 칩으로 또 있었다. 부모는 `category` +
             `onCategoryChange` 로 이미 그 컨트롤을 **소유**하고 있었으므로,
             이 안의 칩은 처음부터 그 화면에선 군더더기였다.
          ⇒ 라벨을 맞추는 걸로는 부족했다. 중복은 **컨트롤 자체**였다. */}
      {!pc && !onCategoryChange && (
      <div className="bg-white dark:bg-[#11141C] border-b border-gray-100 dark:border-[#2C2F35] sticky top-12 z-10">
        <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map(c => {
            const active = c.key === category
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                  active
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2C2F35]'
                }`}
              >
                {c.key !== 'all' && <c.icon className="w-3.5 h-3.5" aria-hidden="true" />}
                {c.label}
              </button>
            )
          })}
        </div>
      </div>
      )}

      {/* 정렬 옵션 + 카운트 — 🖥️ PC 홈에선 정렬칩이 대신 구동 → 숨김.
          🔢 2026-08-31: 0 일 때 "0개" 를 굳이 보여주지 않는다. 바로 아래 빈 상태가 같은 말을
          더 잘 하고 있어 **같은 사실을 두 번** 말하던 자리였다(대기업 앱은 0을 세지 않는다). */}
      {/* 🔇 정렬할 것이 없으면 정렬도 내린다. 카운트를 감추고 나니 이 알약만 오른쪽에
          홀로 떠서 **빈 줄 하나**처럼 보였다 — 컨트롤은 쓸 데가 있을 때만 자리를 갖는다. */}
      {!pc && (loading || sorted.length > 0) && (
      <div className="flex items-center justify-between px-4 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">
        <span>{loading ? '불러오는 중…' : `딜 ${sorted.length}개`}</span>
        <SortMenu value={sort as typeof SORTS[number]['key']} options={SORTS} onChange={(v) => setSort(v)} />
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
        <>
        {/* 🗺️ 2026-07-19: 지역 매칭 0 → 전체 폴백 사실을 명시(조용한 오표시 방지 — "부산인데 서울 딜?" 오해 차단). */}
        {regionFallback && (
          <div className={pc ? 'mb-4' : 'mx-4 mb-3'}>
            <p className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[13px] font-semibold">
              선택한 지역에 아직 등록된 딜이 없어요 — 전체 지역 딜을 보여드릴게요.
            </p>
          </div>
        )}
        <div className={gridCls}>
          {/* 🛡️ 2026-05-24 (loading P0): 첫 4개 카드 = above-fold → eager + fetchpriority=high (LCP 단축).
              나머지는 lazy 유지 (scroll 시 자연 로드). */}
          {/* 🎯 2026-07-02 (대표 "첫 페인트에 응모/추첨 배지 늦게 등장"): 피드 응답에 서버 enrich 된
              p.fcfs 를 첫 페인트 시드로 사용, 클라 훅(fcfsMap — 신선 카운트)이 도착하면 그 값 우선. */}
          {sorted.map((p, idx) => {
            const emb = (p as { fcfs?: { enabled?: boolean; prelaunch?: boolean; spots?: number; appliedDisplay?: number; deadline?: string | null } }).fcfs
            const seed = emb?.enabled ? { spots: emb.spots || 0, appliedDisplay: emb.appliedDisplay || 0, deadline: emb.deadline ?? null, prelaunch: !!emb.prelaunch } : undefined
            return <GroupBuyFeedCard key={p.id} p={p} aboveFold={firstScreen && idx < 4} fcfs={fcfsMap.get(p.id) ?? seed} imgWidth={cardImgWidth} userLoc={userLoc} />
          })}
        </div>
        </>
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
              className="px-5 py-3 bg-white dark:bg-[#1D1F29] border border-gray-200 dark:border-[#2C2F35] rounded-full text-sm font-bold text-gray-900 dark:text-white"
            >
              더 보기
            </button>
          )}
        </div>
      )}

      {/* 하단 — 🏪 2026-08-31 (대표 — "모바일로도 '판매하세요' 가 있어야 하지 않을까? PC버전처럼").
          ■ 왜 여기인가: PC 는 상단 네비에 이 진입점이 있는데(`DesktopTopNav` — 로고+"에서 판매하세요")
            **모바일엔 어디에도 없었다.** 매장 사장님이 소비자 홈에서 우리를 처음 볼 때 들어올 문이
            폰에는 없었다는 뜻이다.
          ■ 왜 새 줄을 안 만들었나: 이 자리에 있던 "지도에서 전체 동네딜 보기"는 2026-08-30 에
            상단 [목록|지도] 전환이 생기면서 **같은 곳으로 가는 두 번째 버튼**이 됐다. 그 중복을
            치우고 그 자리를 쓴다 — 줄은 그대로고 없던 문이 생긴다.
          ■ 목적지는 `sellerEntryPath()` SSOT: 셀러면 대시보드, 아니면 입점 안내(/partners).
            2026-08-26 에 PC 에서 겪은 그 문제(아직 셀러가 아닌 사람이 로그인 벽으로 튕김)를 반복하지 않는다. */}
      {!loading && sorted.length > 0 && (
        <div className="px-4 pb-8 text-center">
          <button
            type="button"
            onClick={() => navigate(sellerEntryPath())}
            aria-label="유어딜에서 판매하세요"
            className="inline-flex items-center gap-1.5 px-5 py-3 bg-white dark:bg-[#1D1F29] border border-gray-200 dark:border-[#2C2F35] rounded-full text-sm font-bold text-gray-900 dark:text-white"
          >
            <Store className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="flex items-center gap-1"><UrDealLogo size={13} />에서 판매하세요</span>
          </button>
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
        {/* 🏷️ 2026-08-30: 어깨 으쓱 이모지(🤷) → 선 아이콘.
            이모지 빈 화면은 "아직 안 만든 자리"처럼 읽힌다 — 실제로는 정상 상태인데도.
            같은 화면의 '내 주변 지도로 보기' 원형 처리와 같은 언어로 맞춘다. */}
        <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-gray-100 dark:bg-[#1D1F29] flex items-center justify-center">
          <SearchX className="w-6 h-6 text-gray-400" aria-hidden="true" />
        </div>
        <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">
          {category === 'all' ? '이 지역엔 아직 진행 중인 딜이 없어요' : '이 카테고리엔 진행 중인 딜이 없어요'}
        </p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-5">
          {category === 'all' ? '교환권은 지역과 상관없이 바로 살 수 있어요' : '대신 다른 인기 딜을 추천드려요'}
        </p>
        {/* 🚪 2026-08-31 (대표 "더 대기업 수준의 완성도"): 여기는 **막다른 길**이었다.
            `category === 'all'` 이면 문구 한 줄만 있고 다음 행동이 아무것도 없었다 —
            그리고 그게 데이터가 적은 지금 **신규 사용자가 가장 많이 보는 화면**이다.
            빈 화면의 값어치는 "없다"고 말하는 데 있지 않고 **갈 곳을 주는 데** 있다.
            교환권은 지역과 무관하게 항상 재고가 있으므로 실제로 살 수 있는 출구다. */}
        <div className="flex items-center justify-center gap-2">
          {category === 'all' ? (
            <>
              <Link
                to="/vouchers"
                className="ur-btn ur-btn-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4"
              >
                교환권 보러가기
              </Link>
              <Link
                to="/map"
                className="ur-btn ur-btn-md border border-gray-200 dark:border-[#2C2F35] text-gray-700 dark:text-gray-200 px-4"
              >
                지도에서 찾기
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={onReset}
              className="ur-btn ur-btn-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4"
            >
              전체 딜 보기
            </button>
          )}
        </div>
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
            <div className={`grid grid-cols-2 sm:grid-cols-3 ${DEAL_GRID_GAP}`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-gray-100 dark:bg-[#1D1F29] animate-pulse" />
              ))}
            </div>
          ) : fallback && fallback.length > 0 ? (
            <div className={`grid grid-cols-2 sm:grid-cols-3 ${DEAL_GRID_GAP}`}>
              {fallback.map(p => <GroupBuyFeedCard key={p.id} p={p} />)}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
