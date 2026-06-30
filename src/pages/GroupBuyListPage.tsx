import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  Sparkles,
  Plus,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import api from '@/lib/api'
import { safeTime } from '@/utils/safe-date'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import type { GroupBuyProduct, CommunityGroupBuy, MainTab, CategoryFilter, SortOption } from './group-buy-list/types'
import GroupBuyGridCard from './group-buy-list/GroupBuyGridCard'
import CurationStrip from './group-buy-list/CurationStrip'
import CommunityGroupBuyCard from './group-buy-list/CommunityGroupBuyCard'
import EmptyShowcase from './group-buy-list/EmptyShowcase'
import SortBar from './group-buy-list/SortBar'
import CategoryTabs from './group-buy-list/CategoryTabs'
import SearchBar from './group-buy-list/SearchBar'
import RegionBar from './group-buy-list/RegionBar'
import MainTabs from './group-buy-list/MainTabs'
import LiveTicker from '@/components/group-buy/LiveTicker'
import RegionPickerModal from '@/components/RegionPickerModal'
import { matchAddress, findRegionByKey, findDistrictGroup } from '@/shared/constants/korea-regions'
import { COMMUNITY_PROPOSAL_HIDDEN } from '@/shared/feature-flags'

// 🛡️ 2026-05-02: TD-018 분할 — types/constants/utils 를 ./group-buy-list/ 로 추출.

// 🏭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — "동네딜 카드 로딩 고질적"): 모듈 메모리 캐시 + 진입 전 워밍.
//   문제: 하단바 탭 진입은 SPA 라우팅이라 SSR 주입이 없음 → 매 마운트 cold fetch + 스켈레톤 재노출(탭 왕복마다).
//   해법: (1) 같은 세션 재진입은 메모리 캐시로 0ms 페인트(+60s 넘으면 백그라운드 갱신만, 스켈레톤 X)
//        (2) 하단바 pointerdown(누르는 순간) `warmGroupBuyList()` 가 데이터를 선요청 — 클릭→마운트 사이 ~200ms 선점.
//        in-flight 공유로 중복 요청 0. SSR 주입 경로/기존 fetch 동작 불변(additive).
const GB_LIST_URL = '/api/group-buy/products?status=active&limit=200'
const GB_CACHE_TTL = 60_000
let _gbListCache: { items: GroupBuyProduct[]; at: number } | null = null
let _gbListInflight: Promise<GroupBuyProduct[] | null> | null = null

function fetchGroupBuyList(): Promise<GroupBuyProduct[] | null> {
  if (_gbListInflight) return _gbListInflight
  _gbListInflight = api
    .get(GB_LIST_URL)
    .then((r) => {
      if (r.data?.success) {
        const items = (r.data.data || []) as GroupBuyProduct[]
        _gbListCache = { items, at: Date.now() }
        return items
      }
      return null
    })
    .catch(() => null)
    .finally(() => { _gbListInflight = null })
  return _gbListInflight
}

/** 하단바 prefetch 에서 호출 — 누르는 순간 데이터 선요청 (신선하면 no-op). */
export function warmGroupBuyList(): void {
  if (_gbListCache && Date.now() - _gbListCache.at < GB_CACHE_TTL) return
  void fetchGroupBuyList()
}

// 🗺️ 2026-06-18: GPS '내 동네'(정확한 시군구 코드) 서버 필터. 모듈 캐시 미오염(기본 피드와 분리).
function fetchGroupBuyByRegion(guCode: string): Promise<GroupBuyProduct[] | null> {
  return api
    .get(`${GB_LIST_URL}&region=${encodeURIComponent(guCode)}`)
    .then((r) => (r.data?.success ? ((r.data.data || []) as GroupBuyProduct[]) : null))
    .catch(() => null)
}

// 🛡️ 2026-06-04 [LOADING_ADDITIVE]: 동네딜 SSR 주입(__SSR_INITIAL_GROUPBUY__) 즉시 소비 → 마운트 fetch 워터폴 제거.
//   consume-once(el.remove) — 클라 재진입 시엔 script 없음 → 정상 fetch.
function readSsrGroupBuy(): GroupBuyProduct[] | null {
  if (typeof document === 'undefined') return null
  const el = document.getElementById('__SSR_INITIAL_GROUPBUY__')
  if (!el?.textContent) return null
  try {
    const parsed = JSON.parse(el.textContent) as { success?: boolean; data?: GroupBuyProduct[] }
    el.remove()
    return parsed?.success ? (parsed.data || []) : null
  } catch { return null }
}


// 🧭 2026-06-17 (사용자 요청 A): 빈 화면을 선택 카테고리에 맞춰 — 부제목 + "곧 오픈" 쇼케이스 카드.
//   특정 카테고리 선택 시 해당 카드 1개만(+카테고리 부제목), 전체/일반은 4종 전부 노출.
const CAT_EMPTY_META: Partial<Record<CategoryFilter, { noun: string; card: { emoji: string; label: string; desc: string } }>> = {
  meal_voucher:     { noun: '맛집', card: { emoji: '🍽️', label: '이용권 공구', desc: '맛집 단체 할인' } },
  beauty_voucher:   { noun: '미용', card: { emoji: '💇', label: '뷰티 공구', desc: '시술 공동 예약' } },
  health_voucher:   { noun: '미용', card: { emoji: '💇', label: '뷰티 공구', desc: '시술 공동 예약' } },
  stay_voucher:     { noun: '숙소', card: { emoji: '🏨', label: '숙박 공구', desc: '펜션·호텔 단체' } },
  etc_voucher:      { noun: '기타', card: { emoji: '🎯', label: '기타 공구', desc: '헬스·펫·액티비티' } },
  pet_voucher:      { noun: '기타', card: { emoji: '🎯', label: '기타 공구', desc: '헬스·펫·액티비티' } },
  activity_voucher: { noun: '기타', card: { emoji: '🎯', label: '기타 공구', desc: '헬스·펫·액티비티' } },
}
const DEFAULT_SHOWCASE = [
  { emoji: '🍽️', label: '이용권 공구', desc: '맛집 단체 할인' },
  { emoji: '💇', label: '뷰티 공구', desc: '시술 공동 예약' },
  { emoji: '💪', label: '헬스 PT 공구', desc: '월 회원권 공동' },
  { emoji: '🏨', label: '숙박 공구', desc: '펜션·호텔 단체' },
]

export default function GroupBuyListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-05-16: URL ?category= 처리 — 메인 hero 의 8 카테고리 각각 정확 필터
  //   voucher 6종 (meal/beauty/health/pet/stay/activity) + general + all 모두 직접 매칭
  const [searchParams, setSearchParams] = useSearchParams()
  const urlCategory = (searchParams.get('category') || '').toLowerCase()
  const urlSort = (searchParams.get('sort') || '').toLowerCase()
  const VALID_CATEGORIES: CategoryFilter[] = ['all', 'general', 'meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher', 'health_voucher', 'pet_voucher', 'activity_voucher']
  const initialCategory: CategoryFilter = VALID_CATEGORIES.includes(urlCategory as CategoryFilter)
    ? (urlCategory as CategoryFilter)
    : 'all'
  const initialSort: SortOption = urlSort === 'discount' ? 'discount' : 'popular'
  // 🛡️ 2026-05-17: 지역 필터 (?region=서울&district=gangnam) — 당근 스타일 picker
  const urlRegion = searchParams.get('region') || null
  const urlDistrict = searchParams.get('district') || null

  const [mainTab, setMainTab] = useState<MainTab>('seller')
  // SSR 주입 1회 캡처 (lazy init → 첫 렌더에만 읽음). null = 미주입(클라 재진입) → 정상 fetch.
  const ssrInitialRef = useRef<GroupBuyProduct[] | null | undefined>(undefined)
  if (ssrInitialRef.current === undefined) ssrInitialRef.current = readSsrGroupBuy()
  const [items, setItems] = useState<GroupBuyProduct[]>(ssrInitialRef.current || [])
  const [communityItems, setCommunityItems] = useState<CommunityGroupBuy[]>([])
  const [loading, setLoading] = useState(ssrInitialRef.current == null)
  const [communityLoading, setCommunityLoading] = useState(true)
  const [category, setCategory] = useState<CategoryFilter>(initialCategory)
  const [sortBy, setSortBy] = useState<SortOption>(initialSort)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [interestedIds, setInterestedIds] = useState<Set<number>>(new Set())
  // 🛡️ 2026-05-17: 지역 필터 상태 + 모달 (큐레이션 택소노미 — 수동 선택용)
  const [regionKey, setRegionKey] = useState<string | null>(urlRegion)
  const [districtKey, setDistrictKey] = useState<string | null>(urlDistrict)
  const [regionPickerOpen, setRegionPickerOpen] = useState(false)
  // 🗺️ 2026-06-18: GPS '내 동네' — 정확한 시군구 코드(전국 커버, 큐레이션 목록 의존 X).
  //   regionKey(큐레이션)와 상호배타 — 하나 켜면 다른 거 해제. URL ?gucode=&guname= 로 공유/뒤로가기.
  const [gpsRegion, setGpsRegion] = useState<{ guCode: string; name: string } | null>(
    searchParams.get('gucode') ? { guCode: searchParams.get('gucode')!, name: searchParams.get('guname') || '내 동네' } : null,
  )

  // 큐레이션 지역 변경 시 URL 동기화 + GPS 모드 해제 (상호배타).
  function applyRegion(r: string | null, d: string | null) {
    setRegionKey(r)
    setDistrictKey(d)
    setGpsRegion(null)
    const next = new URLSearchParams(searchParams)
    if (r) next.set('region', r); else next.delete('region')
    if (d) next.set('district', d); else next.delete('district')
    next.delete('gucode'); next.delete('guname')
    setSearchParams(next, { replace: true })
  }

  // GPS '내 동네'(정확한 코드) 적용 + URL 동기화 + 큐레이션 필터 해제.
  function applyGpsRegion(g: { guCode: string; name: string } | null) {
    setGpsRegion(g)
    setRegionKey(null)
    setDistrictKey(null)
    const next = new URLSearchParams(searchParams)
    if (g) { next.set('gucode', g.guCode); next.set('guname', g.name) } else { next.delete('gucode'); next.delete('guname') }
    next.delete('region'); next.delete('district')
    setSearchParams(next, { replace: true })
  }

  // 🗺️ 2026-06-18: GPS "내 동네 자동 감지" — 좌표 → /api/region/resolve(카카오 행정동) → 정확한 시군구
  //   코드로 서버 필터(전국 커버, "준비 전" 없음). 로그인 시 user_regions 저장(fire-and-forget).
  const [detectingRegion, setDetectingRegion] = useState(false)
  const detectMyRegion = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error(t('groupBuy.geoUnsupported', { defaultValue: '위치를 지원하지 않는 브라우저예요' }))
      return
    }
    setDetectingRegion(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await api.get('/api/region/resolve', { params: { lat: latitude, lng: longitude } })
          const d = res.data?.success ? (res.data.data as { region_gu?: string; region_si?: string; gu_code?: string }) : null
          if (d?.gu_code) {
            const name = d.region_gu || d.region_si || '내 동네'
            applyGpsRegion({ guCode: d.gu_code, name })
            toast.success(t('groupBuy.regionDetected', { defaultValue: '{{name}} 동네딜만 봐요', name }))
            api.post('/api/me/region', { lat: latitude, lng: longitude }).catch(() => { /* 비로그인/실패 무시 */ })
          } else {
            toast.error(t('groupBuy.regionDetectFail', { defaultValue: '동네를 찾지 못했어요' }))
          }
        } catch {
          toast.error(t('groupBuy.regionDetectFail', { defaultValue: '동네를 찾지 못했어요' }))
        } finally {
          setDetectingRegion(false)
        }
      },
      () => {
        setDetectingRegion(false)
        toast.error(t('groupBuy.geoPermission', { defaultValue: '위치 권한이 필요해요' }))
      },
      { timeout: 8000, maximumAge: 300000 },
    )
  }

  const activeRegion = findRegionByKey(regionKey)
  const activeDistrict = findDistrictGroup(regionKey, districtKey)
  const regionButtonLabel = activeDistrict
    ? activeDistrict.label
    : activeRegion
    ? `${activeRegion.label.replace('\n', ' ')} 전체`
    : '전체 지역'

  const toggleInterest = (e: React.MouseEvent, productId: number, restaurantName?: string) => {
    e.stopPropagation()
    e.preventDefault()
    const isAdding = !interestedIds.has(productId)
    setInterestedIds(prev => {
      const next = new Set(prev)
      if (isAdding) next.add(productId)
      else next.delete(productId)
      return next
    })
    if (isAdding) {
      api.post('/api/interest/add', {
        restaurant_name: restaurantName || '',
        product_id: productId,
        type: 'group_buy',
      }).catch(() => {
        setInterestedIds(prev => { const next = new Set(prev); next.delete(productId); return next })
      })
      toast.success(t('common.interestAdded'))
    } else {
      api.post('/api/interest/remove', { product_id: productId, type: 'group_buy' }).catch(() => {
        setInterestedIds(prev => { const next = new Set(prev); next.add(productId); return next })
      })
      toast.info(t('common.interestRemoved'))
    }
  }

  // 셀러 공구 로딩
  useEffect(() => {
    // SSR 주입 데이터로 이미 시드됨(prewarm fresh) → 마운트 cold fetch 스킵(워터폴 제거).
    //   + 2026-06-10: SSR 50개는 첫페인트용 — 메모리 캐시에 안 넣고 백그라운드로 limit=200 전체본 갱신
    //     (50개 cap 이 필터/정렬에 다시 생기는 것 방지, 화면은 SSR 본으로 이미 그려져 스켈레톤 X).
    if (ssrInitialRef.current !== null) {
      ssrInitialRef.current = null
      void fetchGroupBuyList().then((fresh) => { if (fresh) setItems(fresh) })
      return
    }
    // 🏭 2026-06-10 [LOADING_ADDITIVE]: 메모리 캐시 즉시 페인트 — 탭 왕복 시 스켈레톤 재노출 제거.
    //   신선(<60s)하면 그대로, 오래됐으면 화면 유지 + 백그라운드 갱신.
    if (_gbListCache) {
      setItems(_gbListCache.items)
      setLoading(false)
      if (Date.now() - _gbListCache.at >= GB_CACHE_TTL) {
        void fetchGroupBuyList().then((fresh) => { if (fresh) setItems(fresh) })
      }
      return
    }
    // 🏭 2026-06-05 [UNLOCK_LOADING] (사용자 승인 — 동네딜 50개 cap 근본수정): limit=200.
    //   하단바 pointerdown 워밍(warmGroupBuyList)과 in-flight 공유 — 중복 요청 0.
    setLoading(true)
    void fetchGroupBuyList()
      .then((items) => {
        if (items) setItems(items)
        else toast.error(t('common.networkError', { defaultValue: '네트워크 오류가 발생했습니다' }))
      })
      .finally(() => setLoading(false))
  }, [])

  // 🗺️ 2026-06-18: GPS '내 동네'(시군구 코드) 변경 시 서버 region 필터로 재조회.
  //   기본(코드 없음)은 위 마운트 effect 가 담당 — 정상 마운트(코드 0)에선 null===null 으로 skip(중복 fetch 0).
  //   gucode 가 켜지면 서버필터 결과로, 비우면 기본 목록으로 setItems. 모듈 캐시(_gbListCache)는 미오염.
  const regionFetchRef = useRef<string | null>(null)
  useEffect(() => {
    const code = gpsRegion?.guCode || ''
    if (regionFetchRef.current === (code || null)) return
    regionFetchRef.current = code || null
    setLoading(true)
    void (code ? fetchGroupBuyByRegion(code) : fetchGroupBuyList())
      .then((fresh) => { if (fresh) setItems(fresh) })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsRegion?.guCode])

  // 유저 공구 로딩 — 🛡️ 2026-06-04 [LOADING_ADDITIVE]: 기본탭은 '셀러 공구'라
  //   유저공구(uncached) fetch 를 마운트마다 하던 것 → '유저 공구' 탭 첫 진입 시 1회만 로드(워밍 낭비 제거).
  const communityFetchedRef = useRef(false)
  useEffect(() => {
    if (mainTab !== 'community' || communityFetchedRef.current) return
    communityFetchedRef.current = true
    setCommunityLoading(true)
    api
      .get('/api/community-group-buy/list?status=proposed&sort=popular&limit=20')
      .then((r) => {
        if (r.data?.success) setCommunityItems(r.data.data || [])
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[GroupBuy] community list failed:', e) })
      .finally(() => setCommunityLoading(false))
  }, [mainTab])

  useEffect(() => {
    if (!showSortDropdown) return
    const handler = () => setShowSortDropdown(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showSortDropdown])

  // 🧭 2026-06-17: URL ?category= 를 카테고리 상태와 동기화 — PC 사이드바/딥링크에서 (이미 이 페이지에
  //   머문 상태에서도) 카테고리 전환이 반영되도록. 인페이지 탭은 아래에서 URL 도 함께 갱신해 양방향 일치.
  useEffect(() => {
    const c = (searchParams.get('category') || '').toLowerCase()
    const nextCat = (VALID_CATEGORIES.includes(c as CategoryFilter) ? c : 'all') as CategoryFilter
    setCategory((prev) => (prev === nextCat ? prev : nextCat))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const filtered = useMemo(() => {
    let result = [...items]

    // 🛡️ 2026-05-17: 카테고리 필터 — voucher 4종 (신규) + 레거시 3종 호환 매칭.
    //   beauty 탭은 health 도 매칭 (마이그레이션 0255 가 row 자동 변환하지만 graceful).
    //   etc 탭은 pet/activity 도 매칭.
    const VOUCHER_CATEGORIES = ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher', 'health_voucher', 'pet_voucher', 'activity_voucher']
    const LEGACY_TO_NEW: Record<string, string> = {
      health_voucher: 'beauty_voucher',
      pet_voucher: 'etc_voucher',
      activity_voucher: 'etc_voucher',
    }
    const normalizeCat = (c: string | undefined | null) => (c && LEGACY_TO_NEW[c]) || c || ''
    // 🛡️ 2026-06-17: 숙소(stay_voucher)는 전용 /stays 페이지(객실·날짜·가격 join)에서만 표시.
    //   products.price=0 + 위치/평점이 product_stay_info 별도 테이블이라 동네딜 그리드 카드엔 ₩0·정보누락으로
    //   부적합 → 그리드(전체 포함) 전역 제외. 숙소 탭은 /stays 로 리다이렉트.
    result = result.filter((p) => normalizeCat(p.category) !== 'stay_voucher')
    if (category === 'general') {
      result = result.filter((p) => !VOUCHER_CATEGORIES.includes(p.category || ''))
    } else if (category !== 'all') {
      // 특정 voucher 카테고리 — 신규 + 레거시 row 모두 매칭 (정규화 후 비교).
      result = result.filter((p) => normalizeCat(p.category) === category)
    }

    // 🛡️ 2026-05-16: 텍스트 검색 (상품명 / 매장명)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((p) =>
        (p.name || '').toLowerCase().includes(q) ||
        ((p as { restaurant_name?: string }).restaurant_name || '').toLowerCase().includes(q)
      )
    }

    // 🛡️ 2026-05-17: 지역 필터 — voucher 카테고리에만 적용 (general 은 배송이라 위치 무관).
    //   사용자 결정: "이용권/숙소권/헬스장 등에 필요" → general 탭은 region 무시.
    //   category='all' 일 때: voucher 류만 region 필터, general 아이템은 통과.
    if (regionKey && category !== 'general') {
      result = result.filter((p) => {
        const isVoucher = VOUCHER_CATEGORIES.includes(p.category || '')
        if (category === 'all' && !isVoucher) return true  // 전체 탭에서 general 은 region 무관 통과
        const addr = (p as { restaurant_address?: string; restaurant_name?: string }).restaurant_address
          || (p as { restaurant_name?: string }).restaurant_name
          || ''
        return matchAddress(addr, regionKey, districtKey)
      })
    }

    // 정렬
    switch (sortBy) {
      case 'popular':
        result.sort(
          (a, b) =>
            (b.group_buy_current || b.sold_count || 0) -
            (a.group_buy_current || a.sold_count || 0)
        )
        break
      // 🏭 2026-06-05 (사용자 신고 — 공구 낮은 가격순 없음): 가격 정렬(공구가 = current_price ?? price).
      case 'price_low':
        result.sort((a, b) => (Number((a as { current_price?: number }).current_price ?? a.price) || 0) - (Number((b as { current_price?: number }).current_price ?? b.price) || 0))
        break
      case 'price_high':
        result.sort((a, b) => (Number((b as { current_price?: number }).current_price ?? b.price) || 0) - (Number((a as { current_price?: number }).current_price ?? a.price) || 0))
        break
      case 'deadline': {
        const getTs = (p: GroupBuyProduct) =>
          p.group_buy_deadline
            ? safeTime(p.group_buy_deadline)
            : Number.MAX_SAFE_INTEGER
        result.sort((a, b) => getTs(a) - getTs(b))
        break
      }
      // 🛡️ 2026-05-16: 'discount' 정렬 — 메인 hero "특가" 카테고리 진입 시
      // 🛡️ 2026-05-18: TS type 호환 — items union type 처리 (CommunityGroupBuy 등).
      case 'discount': {
        const discPct = (p: unknown) => {
          const r = (p ?? {}) as { original_price?: number | string | null; price?: number | string | null }
          const op = Number(r.original_price) || 0
          const pr = Number(r.price) || 0
          if (op > 0 && op > pr) return Math.round((1 - pr / op) * 100)
          return 0
        }
        result.sort((a, b) => discPct(b) - discPct(a))
        break
      }
      case 'newest':
        result.sort((a, b) => {
          const aTs = a.created_at ? safeTime(a.created_at) : 0
          const bTs = b.created_at ? safeTime(b.created_at) : 0
          return bTs - aTs
        })
        break
    }

    return result
  }, [items, category, sortBy, searchQuery, regionKey, districtKey])

  // 🏭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — 카드 로딩 체감): 점진 렌더.
  //   limit=200 데이터를 한 번에 200카드 마운트 → 중저가 폰 TBT/버벅임(데이터는 빨라졌지만 렌더가 병목).
  //   첫 30개만 마운트 → 하단 sentinel 600px 선행 감지로 +30씩 — 스크롤 도달 전에 미리 붙어 끊김 없음.
  //   필터/탭/검색 변경 시 30으로 리셋. 데이터는 이미 메모리에 있어 네트워크 0.
  const GB_PAGE = 30
  const [visibleCount, setVisibleCount] = useState(GB_PAGE)
  useEffect(() => { setVisibleCount(GB_PAGE) }, [category, sortBy, searchQuery, regionKey, districtKey, mainTab])
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const ob = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + GB_PAGE)
    }, { rootMargin: '600px' })
    ob.observe(el)
    return () => ob.disconnect()
  }, [loading, mainTab])

  // 🛡️ 2026-06-04: 큐레이션 3종 — filtered 변경 시에만 재계산(매 렌더/스크롤 재계산 방지).
  // 🧭 2026-06-17: 즉시판매 단일가 모델 정합(design/groupbuy-instant-sale.md) — 인원은 '가격 게이트'가
  //   아니라 소셜 증거. 기존 '1명 남음 / 거의 성공(70%)' 임계 큐레이션은 "더 모으면 싸진다"는 기만 소지라
  //   '인기(함께 구매 중) / 오늘 마감(긴장감) / 목표 달성(연출 배지)' 으로 정직하게 전환.
  const curation = useMemo(() => {
    const popular = [...filtered]
      .filter(p => (p.group_buy_current ?? 0) > 0)
      .sort((a, b) => (b.group_buy_current ?? 0) - (a.group_buy_current ?? 0))
      .slice(0, 4)
    const closingToday = filtered.filter(p => {
      if (!p.group_buy_deadline) return false
      const ms = safeTime(p.group_buy_deadline) - Date.now()
      return ms > 0 && ms < 24 * 3600 * 1000
    }).slice(0, 4)
    const goalReached = filtered.filter(p => (p.group_buy_target ?? 0) > 0 && (p.group_buy_current ?? 0) >= (p.group_buy_target ?? 0)).slice(0, 4)
    return { popular, closingToday, goalReached }
  }, [filtered])

  const filteredCommunity = useMemo(() => {
    let result = [...communityItems]

    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => b.current_count - a.current_count)
        break
      // 🏭 2026-06-05 (사용자 신고 — 공구 가격 정렬): 커뮤니티 공구가 = confirmed_price ?? proposed_price.
      case 'price_low':
        result.sort((a, b) => (Number((a as { confirmed_price?: number }).confirmed_price ?? a.proposed_price) || 0) - (Number((b as { confirmed_price?: number }).confirmed_price ?? b.proposed_price) || 0))
        break
      case 'price_high':
        result.sort((a, b) => (Number((b as { confirmed_price?: number }).confirmed_price ?? b.proposed_price) || 0) - (Number((a as { confirmed_price?: number }).confirmed_price ?? a.proposed_price) || 0))
        break
      case 'deadline': {
        const getTs = (p: CommunityGroupBuy) =>
          p.expires_at
            ? safeTime(p.expires_at)
            : Number.MAX_SAFE_INTEGER
        result.sort((a, b) => getTs(a) - getTs(b))
        break
      }
      // 🛡️ 2026-05-16: 'discount' 정렬 — 메인 hero "특가" 카테고리 진입 시
      // 🛡️ 2026-05-18: TS type 호환 — items union type 처리 (CommunityGroupBuy 등).
      case 'discount': {
        const discPct = (p: unknown) => {
          const r = (p ?? {}) as { original_price?: number | string | null; price?: number | string | null }
          const op = Number(r.original_price) || 0
          const pr = Number(r.price) || 0
          if (op > 0 && op > pr) return Math.round((1 - pr / op) * 100)
          return 0
        }
        result.sort((a, b) => discPct(b) - discPct(a))
        break
      }
      case 'newest':
        result.sort((a, b) => {
          const aTs = a.created_at ? safeTime(a.created_at) : 0
          const bTs = b.created_at ? safeTime(b.created_at) : 0
          return bTs - aTs
        })
        break
    }

    return result
  }, [communityItems, sortBy])

  const currentCount = mainTab === 'seller' ? filtered.length : filteredCommunity.length
  const isCurrentLoading = mainTab === 'seller' ? loading : communityLoading

  // 🧭 2026-06-17 (사용자 신고): 빈 화면 CTA 버튼이 선택 카테고리와 무관하게 항상 "맛집 공구 시작"
  //   으로 떠 — 숙소/미용/기타 탭에서도 "맛집"이라고 표기되던 문제. 선택 카테고리를 반영하도록.
  const startCtaLabel = (() => {
    switch (category) {
      case 'meal_voucher':
        return t('groupBuy.ctaStartMeal', { defaultValue: '맛집 공구 시작' })
      case 'beauty_voucher':
      case 'health_voucher':
        return t('groupBuy.ctaStartBeauty', { defaultValue: '미용 공구 시작' })
      case 'stay_voucher':
        return t('groupBuy.ctaStartStay', { defaultValue: '숙소 공구 시작' })
      case 'etc_voucher':
      case 'pet_voucher':
      case 'activity_voucher':
        return t('groupBuy.ctaStartEtc', { defaultValue: '기타 공구 시작' })
      case 'general':
        return t('groupBuy.ctaStartGeneral', { defaultValue: '공구 시작' })
      default:
        return t('groupBuy.ctaStartNeighborhood', { defaultValue: '동네 공구 시작' })
    }
  })()

  // 🧭 2026-06-17 (A): 빈 화면 부제목/쇼케이스를 선택 카테고리에 맞춤. (B): 등록 플로우에 카테고리 전달.
  const catEmpty = CAT_EMPTY_META[category]
  const showcaseCards = catEmpty ? [catEmpty.card] : DEFAULT_SHOWCASE
  const createPath = catEmpty ? `/community-group-buy/new?category=${category}` : '/community-group-buy/new'

  return (
    <div className="bg-white dark:bg-[#0A0A0A] min-h-screen">
      <SEO
        title={t('groupBuy.seoTitle', { defaultValue: '공동구매 — 이용권 / 뷰티 / 헬스 / 펫 / 숙박 / 액티비티' })}
        description={t('groupBuy.seoDesc', { defaultValue: '맛집 이용권, 뷰티 시술, 헬스 PT, 펜션, 액티비티까지 — 함께 모이면 더 싸게! 진행 중인 공동구매를 한 눈에 확인하세요.' })}
        url="/group-buy"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: '유어딜 공동구매',
            description: '맛집·뷰티·헬스·펫·숙박·액티비티 공동구매 모음',
            url: 'https://live.ur-team.com/group-buy',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '홈', item: 'https://live.ur-team.com/' },
              { '@type': 'ListItem', position: 2, name: '공동구매', item: 'https://live.ur-team.com/group-buy' },
            ],
          },
          // 진행 중 공구가 있으면 ItemList 로 노출 (SERP rich result)
          ...(items.length > 0 ? [{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: items.slice(0, 10).map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.name,
              url: `https://live.ur-team.com/group-buy/${p.id}`,
              ...(p.image_url ? { image: p.image_url } : {}),
            })),
          }] : []),
        ]}
      />

      {/* 🗺️ 2026-06-20 (대표 — 홈=리스트 / 지도는 강조 버튼으로): 지도(RestaurantMapPage)로 가는 강조 CTA.
          잉크 풀폭 버튼 — 리스트 위에서 시각적으로 가장 두드러지게. */}
      <div className="ur-content-wide px-4 lg:px-8 pt-4">
        <button
          onClick={() => navigate('/map')}
          className="w-full flex items-center gap-3 rounded-2xl bg-gray-900 dark:bg-white px-4 py-4 active:scale-[0.99] transition-transform shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-white/15 dark:bg-gray-900/10 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-white dark:text-gray-900" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[15px] font-extrabold text-white dark:text-gray-900">
              {t('groupBuy.mapEntryTitle', { defaultValue: '지도로 내 주변 동네딜 보기' })}
            </p>
            <p className="text-[12px] text-white/70 dark:text-gray-900/70 mt-0.5">
              {t('groupBuy.mapEntryDesc', { defaultValue: '가까운 딜을 지도에서 한눈에' })}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70 dark:text-gray-900/70 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* 🛡️ 2026-06-07 (사용자 요청): 동네딜 탭은 BottomNav/DesktopTopNav 로 직접 진입하는
          primary destination 이므로 뒤로가기 + "공동구매" 타이틀 상단바 제거. DesktopTopNav(sticky,
          md+)가 normal flow 로 상단을 차지하므로 아래 배너가 자연히 그 밑에 위치 — 별도 top offset 불필요.
          모바일은 배너의 pt-4 로 상단 여백 확보. */}

      {/* 배너 — 동네 공구 제안 CTA. 🚫 2026-06-18 COMMUNITY_PROPOSAL_HIDDEN 으로 숨김(셸브). */}
      {!COMMUNITY_PROPOSAL_HIDDEN && (
      <div className="ur-content-wide px-4 lg:px-8 pt-4">
        <div className="bg-gray-900 rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-[15px] font-extrabold">
              <Sparkles className="inline w-4 h-4 mr-1 -mt-0.5" />
              {t('groupBuy.bannerHeadline', { defaultValue: '함께라서 더 좋은 가격' })}
            </p>
            <p className="text-white/90 text-[11px] mt-1">
              {t('groupBuy.bannerSubline', { defaultValue: '지금 바로 공동구매가로 구매하세요' })}
            </p>
          </div>
          <button
            onClick={() => navigate(createPath)}
            className="shrink-0 flex items-center gap-1 bg-white dark:bg-white text-gray-900 dark:text-gray-900 px-3 py-2 rounded-full text-[12px] font-extrabold shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('groupBuy.startCta', { defaultValue: '시작' })}
          </button>
        </div>
      </div>
      )}

      {/* 메인 탭: 셀러 공구 | 유저 공구. 🚫 2026-06-18 제안 숨김 시 '같이 모으기' 탭 제거 →
          탭 1개뿐이라 스위처 자체 숨김(기본 mainTab='seller' 그대로 동네딜 그리드 렌더). */}
      {!COMMUNITY_PROPOSAL_HIDDEN && (
        <MainTabs mainTab={mainTab} setMainTab={setMainTab} setCategory={setCategory} setSortBy={setSortBy} />
      )}

      {/* 카테고리 탭 (셀러 공구 전용) */}
      {mainTab === 'seller' && (
        <CategoryTabs
          category={category}
          setCategory={setCategory}
          navigate={navigate}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
        />
      )}

      {/* 🛡️ 2026-05-17: 지역 필터 버튼 — voucher 류 한정 (general 탭에선 숨김).
            사용자 결정: "이용권에는 필요. 이용권/숙소권/헬스장 등에." */}
      <RegionBar
        category={category}
        regionKey={regionKey}
        gpsRegion={gpsRegion}
        regionButtonLabel={regionButtonLabel}
        detectingRegion={detectingRegion}
        setRegionPickerOpen={setRegionPickerOpen}
        detectMyRegion={detectMyRegion}
        applyRegion={applyRegion}
      />

      {/* 🛡️ 2026-05-16: 텍스트 검색 input */}
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* 정렬 pills */}
      <SortBar
        mainTab={mainTab}
        currentCount={currentCount}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showSortDropdown={showSortDropdown}
        setShowSortDropdown={setShowSortDropdown}
      />

      {/* 🛡️ 2026-04-27: 맛집 공구 시작 FAB 제거.
          기존엔 우측 하단 floating 버튼이 카카오 상담 버튼과 겹치고 우측 벽에 붙어 어색했음.
          현재는 hero banner 우측 '시작' 버튼 + empty state CTA 로 자연스럽게 통합. */}

      {/* 🛡️ 2026-05-15: 실시간 ticker — "지금 이 사람이 참여" SNS 흐름 */}
      <div className="ur-content-wide px-4 lg:px-8 mt-3">
        <LiveTicker />
      </div>

      {/* 콘텐츠 영역 */}
      <div className="ur-content-wide px-4 lg:px-8 py-4 pb-20">
        {mainTab === 'seller' ? (
          /* ── 셀러 공구 상품 그리드 (2열) ── */
          <>
            {/* 🛡️ 2026-06-04 (사용자 요청): '최근 본 공구' 제거. */}

            {/* 🧭 2026-06-17: 큐레이션 섹션 — 인기 / 오늘 마감 / 목표 달성 (즉시판매 단일가 정합) */}
            {!loading && filtered.length > 0 && (
              <>
                {curation.popular.length > 0 && (
                  <CurationStrip
                    title={t('groupBuy.curPopular', { defaultValue: '🔥 지금 인기 공구' })}
                    subtitle={t('groupBuy.curPopularSub', { defaultValue: '많은 분이 함께 구매 중' })}
                    items={curation.popular}
                    navigate={navigate}
                    accent="red"
                  />
                )}
                {curation.closingToday.length > 0 && (
                  <CurationStrip
                    title={t('groupBuy.curClosing', { defaultValue: '⏰ 오늘 마감' })}
                    subtitle={t('groupBuy.curClosingSub', { defaultValue: '마감 전 한정 공구' })}
                    items={curation.closingToday}
                    navigate={navigate}
                    accent="amber"
                  />
                )}
                {curation.goalReached.length > 0 && (
                  <CurationStrip
                    title={t('groupBuy.curGoal', { defaultValue: '🎉 목표 달성 공구' })}
                    subtitle={t('groupBuy.curGoalSub', { defaultValue: '목표 인원을 채운 인기 공구' })}
                    items={curation.goalReached}
                    navigate={navigate}
                    accent="neutral"
                  />
                )}
              </>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A] animate-pulse rounded-xl" />
                    <div className="mt-2 h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
                    <div className="mt-1 h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse w-2/3" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              (category !== 'all' || !!regionKey || !!searchQuery.trim()) ? (
                /* 🧭 2026-06-17 (대표 신고 — 빈 카테고리 UX): 카테고리/지역/검색으로 0건이면 '곧 오픈' 대신
                   '이 조건만 없음 + 초기화' — 다른 카테고리엔 공구가 있을 수 있음을 알려 이탈 방지. */
                <div className="py-14 text-center">
                  <p className="text-[34px] mb-2">🔍</p>
                  <p className="text-gray-900 dark:text-white font-bold text-[15px]">
                    {(category === 'meal_voucher' ? '식사 ' : category === 'beauty_voucher' ? '미용 ' : category === 'etc_voucher' ? '기타 ' : category === 'general' ? '온라인 ' : '')}
                    {t('groupBuy.emptyFilteredTitle', { defaultValue: '공구가 아직 없어요' })}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-[12px] mt-1">
                    {t('groupBuy.emptyFilteredSub', { defaultValue: '다른 카테고리나 지역도 둘러보세요' })}
                  </p>
                  <div className="mt-4 flex gap-2 justify-center flex-wrap">
                    <button
                      onClick={() => { setCategory('all'); setSearchQuery(''); applyRegion(null, null); const n = new URLSearchParams(searchParams); n.delete('category'); setSearchParams(n, { replace: true }) }}
                      className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold rounded-full"
                    >
                      {t('groupBuy.resetToAll', { defaultValue: '전체 공구 보기' })}
                    </button>
                    {regionKey && (
                      <button
                        onClick={() => applyRegion(null, null)}
                        className="px-5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-[13px] font-semibold rounded-full"
                      >
                        {t('groupBuy.clearRegion', { defaultValue: '지역 해제' })}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
              <EmptyShowcase
                catEmpty={catEmpty}
                showcaseCards={showcaseCards}
                createPath={createPath}
                startCtaLabel={startCtaLabel}
                navigate={navigate}
              />
              )
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-2.5">
                {filtered.slice(0, visibleCount).map((p, idx) => (
                  <GroupBuyGridCard
                    key={p.id}
                    p={p}
                    idx={idx}
                    interested={interestedIds.has(p.id)}
                    onToggleInterest={toggleInterest}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── 유저 공구 (Community Group Buys) ── */
          <>
            {communityLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border border-gray-100 dark:border-[#1A1A1A] rounded-2xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-100 dark:bg-[#1A1A1A] rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded w-1/2 mt-2" />
                    <div className="h-8 bg-gray-100 dark:bg-[#1A1A1A] rounded mt-3" />
                  </div>
                ))}
              </div>
            ) : filteredCommunity.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[36px] mb-3">🙋</p>
                <p className="text-gray-900 dark:text-white font-semibold text-[14px]">
                  {t('groupBuy.emptyCommunity', { defaultValue: '진행 중인 유저 공구가 없습니다' })}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-[12px] mt-1">
                  {t('groupBuy.emptyCommunitySub', { defaultValue: '원하는 공구를 직접 제안해보세요!' })}
                </p>
                <button
                  onClick={() => navigate(createPath)}
                  className="mt-5 px-5 py-2.5 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
                >
                  {t('groupBuy.ctaStart', { defaultValue: '공구 시작하기' })}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCommunity.map((g) => (
                  <CommunityGroupBuyCard
                    key={g.id}
                    g={g}
                    interested={interestedIds.has(g.id)}
                    onToggleInterest={toggleInterest}
                    navigate={navigate}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 🛡️ 2026-05-17: 지역 선택 모달 (당근 스타일) */}
      <RegionPickerModal
        open={regionPickerOpen}
        regionKey={regionKey}
        districtKey={districtKey}
        onClose={() => setRegionPickerOpen(false)}
        onSelect={(r, d) => applyRegion(r, d)}
      />
    </div>
  )
}

