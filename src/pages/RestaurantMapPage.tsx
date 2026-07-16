import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Map as MapIcon, ChevronDown, Search, Bell, ShoppingCart, LocateFixed, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { isKorea } from '@/shared/config/region'
import { storage } from '@/shared/utils/storage'

// 🛡️ 2026-05-02: TD-018 추가 분할 — types/utils/HeroCarousel 추출.
// 🛡️ 2026-05-05: TD-006 추가 분할 — RestaurantList / SelectedPeekCard / SelectedDetailCard 추출.
// 🛡️ 2026-05-06: TD-006 추가 분할 — MapSearchHeader / SheetFilterBar 추출.
import FilterSheet, { type PriceRange } from './restaurant-map/FilterSheet'
import SuggestionModal from './restaurant-map/SuggestionModal'
import HeroCarousel from './restaurant-map/HeroCarousel'
import RestaurantList from './restaurant-map/RestaurantList'
import { useGeocodeMissing } from './restaurant-map/useGeocodeMissing'
import { useNearMeAuto } from './restaurant-map/useNearMeAuto'
import SelectedDealCard from './restaurant-map/SelectedDealCard'
import MapTopBar from './restaurant-map/MapTopBar'
import SheetFilterBar from './restaurant-map/SheetFilterBar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Screen } from '@/components/ui/screen'
import { type MapVoucherType } from './restaurant-map/voucher-types'
import { useKakaoMap, type ServerCluster } from './restaurant-map/useKakaoMap'
import { distanceKm } from './restaurant-map/utils'
import type { Restaurant, KakaoPlace, SortBy } from './restaurant-map/types'
import { useMapProducts } from '@/hooks/queries/useMapProducts'
import { matchAddress, findRegionByKey, findDistrictGroup } from '@/shared/constants/korea-regions'
import { panToRegionAccurate } from './restaurant-map/pan-to-region'
import GeoHelpSheet, { type GeoHelpReason } from './restaurant-map/GeoHelpSheet'
import { detectInAppBrowser } from '@/lib/in-app-browser'
import { checkPermission } from '@/lib/in-app-warning'

// re-export so that any callers importing KakaoPlace from RestaurantMapPage 가 깨지지 않음
export type { KakaoPlace }

// Window.kakao is declared in KakaoCallbackPage.tsx or similar global declaration

export default function RestaurantMapPage({ home = false, mode = 'map' }: { home?: boolean; mode?: 'map' | 'list' } = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [region, setRegion] = useState('')
  // 🛍️ 2026-06-20 (대표 — 세부 지역): KOREA_REGIONS 계층 — 시/도(region) + 세부 지역그룹(district, 해운대/경성대…).
  const [district, setDistrict] = useState('')
  const [search, setSearch] = useState('')
  const [mapView, setMapView] = useState(true)
  // 🛡️ 2026-04-28: Recommended Pack — 거리/카테고리/정렬
  // 📍 2026-07-02 (대표 "첫 화면과 완성 화면이 달라 헷갈림"): 거리(km)는 GPS 측위 후에만 계산돼
  //   1~5초 늦게 나타나던 것 — 마지막 측위를 localStorage 에 캐시해 **재방문부터는 첫 페인트에 즉시**
  //   표시(수십 m 오차는 km 단위 표시에 무해), fresh GPS 도착 시 조용히 갱신. 첫 방문(캐시 없음)만 기존과 동일.
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const c = JSON.parse(localStorage.getItem('ur_last_loc_v1') || 'null')
      return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat, lng: c.lng } : null
    } catch { return null }
  })
  // 🛡️ 2026-04-28: 이용권 카테고리 (식사/뷰티/헬스) — meal_voucher 인프라 재활용
  const [voucherType, setVoucherType] = useState<MapVoucherType>('all')
  // 🛡️ 2026-06-01 Tier2: products fetch 만 React Query(카테고리별 캐시). live-poller 는 유지.
  // 🌍 2026-07-08 (대표 "수천개 대비 — 업체 근본 방식"): 내 위치(near) 거리순 + 근접 바운드 로딩.
  const { data: baseRestaurants = [], isLoading: loading } = useMapProducts(voucherType === 'all' ? 'all' : voucherType, userLoc)
  // 뷰포트(지도 pan)로 추가 로드된 딜 병합(bbox effect ↓). 초기 바운드 밖 영역 커버. 비어있으면 기존과 동일(무회귀).
  const [viewportDeals, setViewportDeals] = useState<Restaurant[]>([])
  // 🌍 줌아웃 서버 집계(레이어 3) — non-null 이면 지도는 개별 핀 대신 격자 버블만 렌더.
  const [aggClusters, setAggClusters] = useState<ServerCluster[] | null>(null)
  // 🔎 2026-07-12 (스케일 검색): 검색어 입력 시 서버 q 검색 결과 병합 — 근접 바운드 밖 먼 매장도 검색에 잡힘.
  const [searchDeals, setSearchDeals] = useState<Restaurant[]>([])
  const restaurants = useMemo(() => {
    if (viewportDeals.length === 0 && searchDeals.length === 0) return baseRestaurants
    const seen = new Set<number | string>(); const out: Restaurant[] = []
    for (const p of [...baseRestaurants, ...viewportDeals, ...searchDeals]) {
      const id = (p as { id?: number | string }).id
      if (id != null && !seen.has(id)) { seen.add(id); out.push(p) }
    }
    return out
  }, [baseRestaurants, viewportDeals, searchDeals])
  // 🗺️ 2026-06-20 좌표 없는 딜 지오코딩 보강 → 🚑 2026-07-02 429 폭주 수리와 함께 훅으로 추출
  //   (캐시 보유분 재요청 금지 + 동일 주소 1회만 + 429 시 배치 중단 — useGeocodeMissing.ts 참조).
  const enrichedRestaurants = useGeocodeMissing(restaurants)
  // 🎯 2026-06-20 선착순: 활성 선착순 상품 config(상위노출·배지·지원용). id→{spots,appliedDisplay}.
  // 🎯 2026-07-02 (대표 "첫 페인트에 응모 버튼 늦게 등장"): 목록 응답에 서버 enrich 된 r.fcfs 를
  //   첫 페인트 시드로 즉시 사용 — 별도 /api/fcfs/active 도착 전에도 응모 버튼·배지가 함께 그려짐.
  //   fetch 결과가 오면 그 값(신선 카운트) 우선.
  // 🎯 2026-07-04 (대표 "데모 이용권 노출은 항상 후순위"): demo 플래그 동반 — '상위노출' boost 는
  //   실(non-demo) 선착순만. 데모는 base 순서(서버가 이미 데모-후순위 정렬) 그대로 뒤에 남음.
  const [liveFcfsMap, setLiveFcfsMap] = useState<Map<number, { spots: number; appliedDisplay: number; demo?: boolean; prelaunch?: boolean }>>(new Map())
  useEffect(() => {
    api.get('/api/fcfs/active')
      .then(r => {
        const m = new Map<number, { spots: number; appliedDisplay: number; demo?: boolean; prelaunch?: boolean }>()
        for (const p of (r.data?.data || [])) {
          if (p?.fcfs?.enabled) m.set(p.id, { spots: p.fcfs.spots || 0, appliedDisplay: p.fcfs.appliedDisplay || 0, demo: !!(p.is_demo || p.fcfs.demo), prelaunch: !!p.fcfs.prelaunch })
        }
        setLiveFcfsMap(m)
      })
      .catch(() => { /* silent */ })
  }, [])
  const fcfsMap = useMemo(() => {
    const m = new Map(liveFcfsMap)
    for (const r of restaurants as Array<{ id: number; fcfs?: { enabled?: boolean; spots?: number; appliedDisplay?: number; demo?: boolean; prelaunch?: boolean } }>) {
      if (!m.has(r.id) && r.fcfs?.enabled) m.set(r.id, { spots: r.fcfs.spots || 0, appliedDisplay: r.fcfs.appliedDisplay || 0, demo: !!r.fcfs.demo, prelaunch: !!r.fcfs.prelaunch })
    }
    return m
  }, [liveFcfsMap, restaurants])
  const applyFcfs = useCallback(async (productId: number) => {
    try {
      const res = await api.post(`/api/fcfs/${productId}/apply`)
      toast.success(res.data?.data?.already ? '이미 응모했어요' : '🎉 응모 완료! 당첨 시 안내드려요')
    } catch {
      toast.error('응모하려면 로그인이 필요해요')
    }
  }, [])
  const [sortBy, setSortBy] = useState<SortBy>('discount')
  // 🛍️ 2026-06-20 (필터 팝업 A안): 거리반경(km, 0=전체) + 가격대.
  const [radiusKm, setRadiusKm] = useState<number>(0)
  const [priceRange, setPriceRange] = useState<PriceRange>('all')
  // 옵션 B: 카카오 일반 맛집 + 클릭 시 수요 신호 모달
  const [kakaoPlaces, setKakaoPlaces] = useState<KakaoPlace[]>([])
  const [suggestionFor, setSuggestionFor] = useState<KakaoPlace | null>(null)
  // 즐겨찾기 (localStorage) + 라이브 셀러 ID 집합
  const [favorites, setFavorites] = useState<number[]>(() => storage.getJSON<number[]>('restaurant_favorites', []))
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [liveSellerIds] = useState<Set<number>>(new Set())  // 라이브커머스 영구중단 → 항상 빈 Set(LIVE 배지 미표시)
  // 🛡️ 2026-04-30: UX 개선 — 필터 시트 (지역 + 카테고리 통합)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const activeFilterCount = ((region || district) ? 1 : 0) + (radiusKm > 0 ? 1 : 0) + (priceRange !== 'all' ? 1 : 0)
  // 🗺️ 2026-06-20 (대표 — 홈=지도 / "상품 1개일 때 공백 남음"): 기본 snap 을 peek 으로 → 지도 우선 +
  //   콘텐츠 적을 때 큰 흰 공백 제거(컴팩트). 더 보려면 시트를 위로 드래그(mid/full).
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'mid' | 'full'>('peek')
  // 🛡️ 2026-04-30 Phase 5: '내 주변' 모드 (GPS 권한 요청 + 거리순 자동)
  const [nearMeMode, setNearMeMode] = useState(false)
  // 🗺️ 2026-06-23 (대표 — 현위치 버튼): GPS 조회 중 로딩 표시.
  const [locating, setLocating] = useState(false)
  // 🗺️ 2026-07-15 (대표 — "지도 보는 위치에 따라 그 지역 이용권이 떠야 해"): 현재 지도 뷰포트 bounds.
  //   map idle 마다 갱신 → 리스트를 보이는 영역으로 좁힘(viewportList). 줌아웃 집계 모드/리스트 모드엔 미적용.
  const [mapBounds, setMapBounds] = useState<{ swLat: number; swLng: number; neLat: number; neLng: number } | null>(null)
  // 🗺️ 2026-07-15 (대표 — "내 주변 누르니 권한 필요 뜨면?"): 위치 실패 시 상황별 안내 시트 사유.
  const [geoHelp, setGeoHelp] = useState<GeoHelpReason | null>(null)
  // 🛡️ 2026-04-30 Phase 5: 검색 히스토리 (localStorage)
  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    storage.getJSON<string[]>('restaurant_search_history', [])
  )
  const [searchFocused, setSearchFocused] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const dragStartSnap = useRef<'peek' | 'mid' | 'full'>('mid')
  // 🗺️ idle/dragend 리스너가 재구독 없이 현재 지역필터를 읽도록 ref 미러(사용자 드래그 시 필터 해제 판단용).
  const regionRef = useRef(region); regionRef.current = region
  const districtRef = useRef(district); districtRef.current = district
  const listScrollRef = useRef<HTMLDivElement>(null)  // 📜 지도모드 바텀시트 ScrollArea — 카테고리 전환 시 최상단

  // 🛡️ 2026-04-30 Phase 5: 검색어 확정 시 히스토리 저장
  function pushSearchHistory(query: string) {
    const q = query.trim()
    if (!q) return
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 8)
      storage.setJSON('restaurant_search_history', next)
      return next
    })
  }

  // 🛡️ 2026-04-30 v2: 실시간 드래그 따라가기 + snap (사용자 신고 — 스크롤 조절 불편)
  const [dragDeltaY, setDragDeltaY] = useState(0) // 드래그 중 손가락 위치 (px)
  function handleSheetDragStart(clientY: number) {
    dragStartY.current = clientY
    dragStartSnap.current = sheetSnap
    setDragDeltaY(0)
  }
  function handleSheetDragMove(clientY: number) {
    if (dragStartY.current == null) return
    setDragDeltaY(clientY - dragStartY.current)
  }
  function handleSheetDragEnd(clientY: number) {
    if (dragStartY.current == null) return
    const dy = clientY - dragStartY.current
    dragStartY.current = null
    setDragDeltaY(0)
    const order: Array<'peek' | 'mid' | 'full'> = ['peek', 'mid', 'full']
    const idx = order.indexOf(dragStartSnap.current)
    // 50px 이상 드래그 시 한 단계 이동, 150px 이상이면 두 단계 점프
    if (Math.abs(dy) < 30) return
    let next: typeof sheetSnap
    if (dy > 0) {
      // 아래로 드래그 → 시트 작아짐
      next = Math.abs(dy) > 150 ? order[0] : order[Math.max(0, idx - 1)]
    } else {
      // 위로 드래그 → 시트 커짐
      next = Math.abs(dy) > 150 ? order[2] : order[Math.min(2, idx + 1)]
    }
    setSheetSnap(next)
  }

  const kr = isKorea()

  // 즐겨찾기 토글 + 영속 저장
  const toggleFavorite = useCallback((id: number) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      storage.setJSON('restaurant_favorites', next)
      return next
    })
  }, [])

  // 🗑️ 2026-07-08 (대표 신고 — `/api/streams` 404 콘솔/Sentry 노이즈): 라이브 셀러 폴링 제거.
  //   라이브커머스 영구중단(LIVE_COMMERCE_SUSPENDED) 으로 `/api/streams` endpoint 자체가 없어 90초마다
  //   404 를 발생시키던 dead 폴러. liveSellerIds 는 빈 Set 유지 → 핀 LIVE 배지 미표시(중단 상태와 정합).

  // 사용자 위치 자동 감지 (1회) — 거리순 정렬용
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLoc(loc)
        try { localStorage.setItem('ur_last_loc_v1', JSON.stringify(loc)) } catch { /* quota */ }
      },
      () => { /* 거부/실패 — 캐시 위치(있으면) 유지, 없으면 거리 비표시 */ },
      { timeout: 5000, enableHighAccuracy: false, maximumAge: 600000 }
    )
  }, [])

  // 🧭 2026-07-07 (대표 — 홈 '내 주변' 기준): 위치 확보 시 자동 '가까운 순' + 동네 라벨(useNearMeAuto).
  const { nearDong, setSortByUser } = useNearMeAuto({ userLoc, region, district, setSortBy, setNearMeMode })

  // 🛡️ 2026-06-20 (대표 — "미리 업체들 나오는거 별로"): 옵션B 카카오 일반 업체(회색 '+' 추천핀)를
  //   기본 지도에 자동으로 깔던 것 제거 → 기본 화면엔 '실제 딜'만. 사용자가 직접 검색했을 때만 표시
  //   (수요신호/추천 보내기 기능은 검색 결과에서 유지). 빈 검색이면 회색핀 0.
  useEffect(() => {
    if (!userLoc || !kr) return
    const q = search.trim()
    if (!q) { setKakaoPlaces([]); return }
    // 🛡️ 2026-06-20 (대표 — 검색 최적화): 타이핑마다 카카오 프록시 호출하던 것 → 300ms 디바운스(레이트리밋 보호).
    const handle = setTimeout(() => {
      api.get(`/api/kakao/place/search?query=${encodeURIComponent(q)}&category_group_code=FD6&size=15`)
        .then(r => {
          if (r.data?.success && r.data.data?.documents) {
            setKakaoPlaces(r.data.data.documents.slice(0, 15))
          }
        })
        .catch(() => { /* silent */ })
    }, 300)
    return () => clearTimeout(handle)
  }, [userLoc, kr, search])

  // 🔎 2026-07-12 (스케일 검색): 검색어 입력 시 서버 q 검색(이름/매장명 LIKE)도 병행 — 근접 바운드/뷰포트
  //   로딩에 안 실린 먼 매장까지 지도·리스트 검색에 잡힘. 300ms 디바운스, 실패 무해(로드분 클라 필터는 그대로).
  useEffect(() => {
    const q = search.trim()
    if (!q) { setSearchDeals([]); return }
    const handle = setTimeout(() => {
      const cat = voucherType === 'all' ? 'all' : voucherType
      api.get('/api/group-buy/products', { params: { category: cat, q, limit: 100 } })
        .then(r => { if (r.data?.success && Array.isArray(r.data.data)) setSearchDeals(r.data.data) })
        .catch(() => { /* silent — 로드분 필터만으로 동작 */ })
    }, 300)
    return () => clearTimeout(handle)
  }, [search, voucherType])

  // 🛡️ 2026-05-19: 클라이언트 geocoding loop 제거.
  //   이전: 사용자 1명당 카카오 API ~10 호출 (페이지 진입 시마다).
  //   현재: 서버 cron (worker/cron/restaurant-geocode.ts) 매일 03:00 UTC 일괄 처리.
  //         새 이용권 등록 후 다음 cron 까지 (최대 24h) 핀 표시 없을 수 있으나,
  //         /api/kakao/place/* 호출은 0 — 페이지 로딩 속도 ~1-3초 개선.


  // 🛍️ 2026-06-20: 지역(계층)/반경/가격 공통 필터 술어 — filtered + 팝업 실시간 카운트가 공유(검색/즐겨찾기 제외).
  const matchesFilter = useCallback((r: Restaurant, rg: string, dist: string, rad: number, price: PriceRange): boolean => {
    if (!matchAddress(r.restaurant_address, rg, dist)) return false
    if (rad > 0 && userLoc) {
      if (!r.restaurant_lat || !r.restaurant_lng) return false
      if (distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng) > rad) return false
    }
    if (price !== 'all') {
      const p = r.price || 0
      if (price === 'under10' && p >= 10000) return false
      if (price === '10to30' && (p < 10000 || p >= 30000)) return false
      if (price === 'over30' && p < 30000) return false
    }
    return true
  }, [userLoc])
  // 팝업 적용 전 실시간 결과 수 (검색/즐겨찾기 제외).
  const countFor = useCallback((rg: string, dist: string, rad: number, price: PriceRange) =>
    enrichedRestaurants.reduce((n, r) => n + (matchesFilter(r, rg, dist, rad, price) ? 1 : 0), 0),
    [enrichedRestaurants, matchesFilter])

  // 🔎 2026-07-15 (대표 신고 — "피자 검색해도 결과 안 나옴"): 서버 q검색은 딜 이름뿐 아니라 메뉴/설명까지
  //   넓게 매칭(피자 8건)하는데, 클라가 이름/매장/주소 글자만 재검색해 그 결과를 버렸음. → 서버가 매칭한
  //   딜 id(searchDeals)는 클라 글자매칭 실패해도 살린다(합집합).
  const searchDealIds = useMemo(() => new Set(searchDeals.map(d => (d as { id: number }).id)), [searchDeals])

  const filtered = useMemo(() => {
    let items = enrichedRestaurants.filter(r => {
      if (showFavoritesOnly && !favorites.includes(r.id)) return false
      if (search) {
        const q = search.toLowerCase()
        const textMatch = r.restaurant_name?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.restaurant_address?.toLowerCase().includes(q)
        if (!textMatch && !searchDealIds.has(r.id)) return false // 서버 q검색 매칭분(메뉴/설명 등)은 이름 불일치여도 유지
      }
      if (!matchesFilter(r, region, district, radiusKm, priceRange)) return false
      return true
    })

    // 정렬
    items = [...items].sort((a, b) => {
      if (sortBy === 'distance' && userLoc) {
        const da = a.restaurant_lat ? distanceKm(userLoc.lat, userLoc.lng, a.restaurant_lat, a.restaurant_lng) : Infinity
        const db = b.restaurant_lat ? distanceKm(userLoc.lat, userLoc.lng, b.restaurant_lat, b.restaurant_lng) : Infinity
        return da - db
      }
      if (sortBy === 'discount') {
        const dA = a.original_price > a.price ? (1 - a.price / a.original_price) : 0
        const dB = b.original_price > b.price ? (1 - b.price / b.original_price) : 0
        return dB - dA
      }
      if (sortBy === 'price') return (a.price || 0) - (b.price || 0)
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
      return 0
    })
    return items
  }, [enrichedRestaurants, region, district, search, sortBy, radiusKm, priceRange, matchesFilter, showFavoritesOnly, favorites, searchDealIds])

  // 🎯 2026-06-20 선착순 상위노출 — 선착순 상품을 리스트 최상단으로(나머지 순서 보존).
  // 🎯 2026-07-04 (대표 "데모 항상 후순위"): boost 는 실(non-demo) 선착순만 — 데모는 끌어올리지 않음.
  const displayList = useMemo(() => {
    if (fcfsMap.size === 0) return filtered
    const boost = (id: number) => { const f = fcfsMap.get(id); return f && !f.demo ? 1 : 0 }
    return [...filtered].sort((a, b) => boost(b.id) - boost(a.id))
  }, [filtered, fcfsMap])

  // 🗺️ 2026-07-15 (대표 — "지도 보는 위치에 따라 그 지역 이용권이 떠야 해" + 신고 "왜 18곳만?"):
  //   지도 모드에서 **현재 보이는 지도 영역의 딜을 리스트 위로** 올린다(당근/야놀자식 '이 지역 먼저').
  //   ⚠️ 숨기지 않음 — 처음엔 뷰포트로 딱 잘라 82곳(전체 100)이 사라져 "왜 18곳만" 혼란 → 보이는 딜을
  //   앞으로, 나머지는 뒤에 붙여 전체가 다 보이되 현 지역이 먼저 뜨게. (엄격한 '이 지역만'은 지역 필터가 담당.)
  //   줌아웃 집계 모드(aggClusters)·bounds 미확정(초기)·리스트 모드에선 전체(displayList) 그대로.
  const { viewportList, viewportInCount } = useMemo(() => {
    // 🔎 검색 중엔 뷰포트 재정렬 끄기 — 검색 결과(먼 지역 포함)를 지도 밖이라고 뒤로 밀지 않게(관련도 순 유지).
    if (mode !== 'map' || !mapBounds || search || (aggClusters && aggClusters.length > 0)) return { viewportList: displayList, viewportInCount: null as number | null }
    const { swLat, swLng, neLat, neLng } = mapBounds
    const mLat = (neLat - swLat) * 0.1, mLng = (neLng - swLng) * 0.1 // 경계 약간 여유
    const inView = (r: Restaurant) => !!(r.restaurant_lat && r.restaurant_lng &&
      r.restaurant_lat >= swLat - mLat && r.restaurant_lat <= neLat + mLat &&
      r.restaurant_lng >= swLng - mLng && r.restaurant_lng <= neLng + mLng)
    const inB: Restaurant[] = []; const rest: Restaurant[] = []
    for (const r of displayList) (inView(r) ? inB : rest).push(r)
    // 보이는 딜 먼저, 나머지 뒤에(숨김 없음) + 이 지역(뷰포트) 딜 수 = inB.length(카운트 "이 지역 N · 전체 M"용)
    return { viewportList: inB.length ? [...inB, ...rest] : displayList, viewportInCount: inB.length }
  }, [mode, mapBounds, aggClusters, displayList, search])

  // 🛡️ 2026-04-30 Phase 3: hero carousel — 인기 (할인율 높은 순) 상위 5개
  const heroDeals = useMemo(() => {
    return [...filtered]
      .filter(r => r.original_price > r.price)
      .sort((a, b) => {
        const dA = 1 - a.price / a.original_price
        const dB = 1 - b.price / b.original_price
        return dB - dA
      })
      .slice(0, 5)
  }, [filtered])

  // 🛡️ 2026-04-28: 동일 좌표 이용권 그룹화 (핀 겹침 방지).
  //   같은 매장에 이용권 여러 개 등록 시 핀 1개 + 개수 배지.
  //   그룹 대표 = 첫 번째 (정렬 순서 따름).
  const withCoords = useMemo(() => {
    const list = filtered.filter(r => r.restaurant_lat && r.restaurant_lng)
    const groups = new Map<string, Restaurant[]>()
    for (const r of list) {
      // 5자리 반올림 → ~1m 정밀도 (효과적으로 동일 매장)
      const key = `${r.restaurant_lat.toFixed(5)}_${r.restaurant_lng.toFixed(5)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    // 그룹 대표만 반환 (count 별도로 노출은 핀 markup 에서)
    return Array.from(groups.values()).map(g => g[0])
  }, [filtered])

  // 좌표 키 → 그룹 size 매핑 (핀 markup 에서 배지 표시용)
  const coordGroupSize = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filtered.filter(x => x.restaurant_lat && x.restaurant_lng)) {
      const key = `${r.restaurant_lat.toFixed(5)}_${r.restaurant_lng.toFixed(5)}`
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [filtered])

  const { mapRef, mapInstance, sdkLoaded, sdkError, panToProduct } = useKakaoMap({
    kr,
    enabled: mode === 'map',
    withCoords,
    coordGroupSize,
    selected,
    setSelected,
    kakaoPlaces,
    setSuggestionFor,
    userLoc,
    liveSellerIds,
    favorites,
    sheetSnap,
    serverClusters: aggClusters,
  })

  // 🛡️ 2026-04-30 Phase 5: '내 주변' 클릭 — GPS 요청 + 거리순 + 위치로 pan
  // 🗺️ 2026-06-23 (대표 — 취소 가능): 이미 활성이면 다시 누르면 토글 off(거리순 → 기본 정렬 복귀).
  const requestNearMe = useCallback(() => {
    if (nearMeMode) {
      setNearMeMode(false)
      setSortBy('discount')
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoHelp('unavailable')
      return
    }
    if (userLoc) {
      // 이미 위치 있음 — 즉시 적용
      setNearMeMode(true)
      setSortBy('distance')
      if (mapInstance.current && window.kakao?.maps) {
        mapInstance.current.panTo(new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng))
        mapInstance.current.setLevel(5)
      }
      return
    }
    // 🗺️ 2026-07-15 (대표 — "내 주변 누르니 권한 필요 뜨면?"): 원인별 처리 + 타임아웃 저정밀 재시도.
    const applyLoc = (loc: { lat: number; lng: number }) => {
      setLocating(false)
      setUserLoc(loc)
      try { localStorage.setItem('ur_last_loc_v1', JSON.stringify(loc)) } catch { /* quota */ }
      setNearMeMode(true)
      setSortBy('distance')
      if (mapInstance.current && window.kakao?.maps) {
        mapInstance.current.panTo(new window.kakao.maps.LatLng(loc.lat, loc.lng))
        mapInstance.current.setLevel(5)
      }
    }
    const opts = (hi: boolean): PositionOptions => ({ timeout: hi ? 8000 : 6000, enableHighAccuracy: hi, maximumAge: 60000 })
    const onErr = async (err: GeolocationPositionError, triedLow: boolean) => {
      // 타임아웃(code 3) + 고정밀만 시도 → 저정밀 1회 재시도(빠르고 실내서도 잘 잡힘).
      if (err.code === 3 && !triedLow) {
        navigator.geolocation.getCurrentPosition(
          (pos) => applyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (e2) => { void onErr(e2, true) },
          opts(false),
        )
        return
      }
      setLocating(false)
      // 인앱 브라우저(카톡/인스타 등)면 최우선 — 위치 제한이라 '외부 브라우저로 열기' 유도.
      if (detectInAppBrowser()) { setGeoHelp('inapp'); return }
      // 🗺️ 2026-07-15 (대표 — "권한 필요만 뜨지 말고 실제로 수정되게"): 실제 권한 상태를 조회해
      //   '아직 거부 아님(prompt)' 이면 재시도 = 네이티브 권한창 재요청(설정 안 가도 그 자리서 허용).
      //   진짜 'denied' 일 때만 설정 안내(+ 아래 effect 가 설정 변경을 감지해 자동 복구).
      const perm = await checkPermission('geolocation')
      if (perm === 'denied') setGeoHelp('denied')
      else if (perm === 'prompt') setGeoHelp('prompt')          // 재요청 가능 — '위치 허용' 버튼이 권한창 재호출
      else if (err.code === 1) setGeoHelp('denied')             // unknown(iOS 등)+거부코드 → 설정
      else if (err.code === 3) setGeoHelp('timeout')            // TIMEOUT — 재시도
      else setGeoHelp('unavailable')                            // POSITION_UNAVAILABLE 등
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => applyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => { void onErr(err, false) },
      opts(true),
    )
  }, [userLoc, nearMeMode])

  // 🗺️ 2026-07-15 (대표 — "권한 필요만 뜨지 말고 실제로 수정되게"): 안내 시트가 떠 있는 동안 위치 권한이
  //   'granted' 로 바뀌면(사용자가 설정/권한창에서 허용) **자동으로** 시트를 닫고 내 주변을 켠다 — 다시 안 눌러도 됨.
  useEffect(() => {
    if (!geoHelp || typeof navigator === 'undefined' || !navigator.permissions?.query) return
    let status: PermissionStatus | null = null
    let cancelled = false
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((s) => {
      if (cancelled) return
      status = s
      s.onchange = () => { if (s.state === 'granted') { setGeoHelp(null); requestNearMe() } }
    }).catch(() => { /* 미지원(iOS 등) — onchange 없이 사용자가 '위치 허용/다시 시도'로 재요청 */ })
    return () => { cancelled = true; if (status) status.onchange = null }
  }, [geoHelp, requestNearMe])

  // 📜 2026-07-08 (대표 "카테고리 버튼 누를 때마다 상단으로"): 카테고리 전환 시 리스트 최상단으로 스크롤.
  const selectVoucherType = useCallback((v: MapVoucherType) => {
    setVoucherType(v)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      listScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })  // 지도 모드 바텀시트 ScrollArea
    }
  }, [])

  // 🌍 2026-07-08 (대표 "가장 이상적으로" — 레이어 2+3): 줌-인지형 뷰포트 로딩.
  //   · 줌아웃(level ≥ 9, 시/전국): 서버 **집계**(/products/map-clusters)만 받아 격자 버블 렌더 —
  //     매장 수만 개여도 다운로드·오버레이가 격자 수(수십 개)로 고정.
  //   · 동네 줌(level < 9): 집계 해제 + (로드분이 바운드에 도달했을 때만) 보이는 영역 bbox 딜 로드·병합.
  //   실패 시 기존 딜 렌더 유지(graceful) — 집계 fetch 가 죽어도 지도는 동작.
  const AGG_LEVEL = 9
  useEffect(() => { setViewportDeals([]); setAggClusters(null) }, [voucherType])  // 카테고리 전환 시 리셋
  // 🔎 집계 모드 진입(줌아웃) 시 선택 해제 — 핀이 사라졌는데 하단 선택 카드만 남던 잔존 UX 제거.
  useEffect(() => { if (aggClusters && aggClusters.length > 0) setSelected(null) }, [aggClusters])
  useEffect(() => {
    if (!mapView || !sdkLoaded) return
    const map = mapInstance.current
    if (!map || !window.kakao?.maps) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const onIdle = () => {
      // 🗺️ 2026-07-15: 뷰포트 bounds 를 즉시 갱신 → 리스트(viewportList)가 지도 이동을 바로 따라감. fetch 는 아래 디바운스.
      try {
        const bb = map.getBounds()
        if (bb) {
          const s = bb.getSouthWest(), n = bb.getNorthEast()
          setMapBounds({ swLat: s.getLat(), swLng: s.getLng(), neLat: n.getLat(), neLng: n.getLng() })
        }
      } catch { /* */ }
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          const b = map.getBounds(); if (!b) return
          const sw = b.getSouthWest(), ne = b.getNorthEast()
          const bbox = `${sw.getLat()},${sw.getLng()},${ne.getLat()},${ne.getLng()}`
          const cat = voucherType === 'all' ? 'all' : voucherType
          const level = map.getLevel()
          if (level >= AGG_LEVEL) {
            // 줌아웃 — 서버 격자 집계(레벨별 격자 크기)
            const cell = level >= 12 ? 1 : level >= 11 ? 0.5 : level >= 10 ? 0.25 : 0.1
            const res = await api.get('/api/group-buy/products/map-clusters', { params: { category: cat, bbox, cell } })
            const arr = (res.data?.success ? (res.data.data || []) : []) as ServerCluster[]
            if (arr.length) setAggClusters(arr)  // 빈 응답이면 기존 렌더 유지(깜빡임 방지)
          } else {
            setAggClusters(null)
            // 🗺️ 2026-07-15 (대표 — "지도 보는 위치의 이용권이 떠야 해" + "물량 많아지면?"): 동네 줌에선
            //   항상 보이는 영역(bbox) 딜을 로드·병합 → 초기 근접 로드 밖(다른 동네로 패닝)도 그 지역 딜이 뜸.
            //   서버 응답은 edge-cache(300s)·limit 500 이라 스케일 안전. (기존: 로드분 500개 넘을 때만 발동.)
            const res = await api.get('/api/group-buy/products', { params: { category: cat, bbox, limit: 500 } })
            const arr = (res.data?.success ? (res.data.data || []) : []) as Restaurant[]
            if (arr.length) setViewportDeals(prev => {
              const seen = new Set(prev.map(p => (p as { id?: number | string }).id))
              const add = arr.filter(p => !seen.has((p as { id?: number | string }).id))
              return add.length ? [...prev, ...add] : prev
            })
          }
        } catch { /* graceful — 기존 딜 렌더 유지 */ }
      }, 400)
    }
    // 🗺️ 2026-07-15: 사용자가 지도를 **직접 드래그**하면 뷰포트가 위치를 지배 → 남은 지역 필터 해제
    //   (패닝해 간 동네가 이전 필터에 가려지지 않게). dragend 는 프로그램적 panTo/setBounds/핀클릭엔 미발화 →
    //   필터/‘내 주변’/핀 선택 이동은 필터 유지, 손으로 끈 것만 해제.
    const onDragEnd = () => {
      if (regionRef.current || districtRef.current) { setRegion(''); setDistrict('') }
    }
    window.kakao.maps.event.addListener(map, 'idle', onIdle)
    window.kakao.maps.event.addListener(map, 'dragend', onDragEnd)
    return () => {
      if (timer) clearTimeout(timer)
      try {
        window.kakao.maps.event.removeListener(map, 'idle', onIdle)
        window.kakao.maps.event.removeListener(map, 'dragend', onDragEnd)
      } catch { /* */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapView, sdkLoaded, baseRestaurants.length, voucherType])

  // 🗺️ 2026-06-22 (대표 시안 — 야놀자식): 상품 선택 시 하단은 납작한 가로 카드(SelectedDealCard)로
  //   바뀌고 지도가 넓어짐. 그 넓은 지도의 중앙('card' 오프셋)에 핀을 배치 + level 4 확대.
  const selectAndPan = (r: Restaurant) => {
    setSelected(r)
    setMapView(true)
    if (r.restaurant_lat && r.restaurant_lng) {
      panToProduct(r.restaurant_lat, r.restaurant_lng, 4, 'card')
    }
  }

  // 선택 카드 좌우 스와이프/버튼 → 인접 딜로 이동 + 지도 recenter.
  const selectedIndex = selected ? displayList.findIndex(r => r.id === selected.id) : -1
  const goAdjacent = (dir: 1 | -1) => {
    if (selectedIndex < 0) return
    const next = displayList[selectedIndex + dir]
    if (next) selectAndPan(next)
  }

  // 🛡️ 2026-04-30 v3 bottom-sheet: 시트 snap 별 transform 값
  //   peek = 12vh 만 보임 (결과 카운트 + 첫 카드 일부)
  //   peek = 28vh (필터 + 첫 결과 한 줄 보임)
  //   mid  = 60vh
  //   full = 92vh (거의 풀스크린)
  // 🛡️ 2026-04-30 v2: peek 18vh → 28vh — 결과 카드 안 보이던 문제 (사용자 신고).
  // 🛡️ 2026-05-04 (iOS Safari fix): 100vh → 100dvh. iOS 주소창 토글 시 viewport 점프 회피.
  // 🛡️ 2026-05-17 (PC wheel zoom 영역 확보): 데스크톱에서 lg+ 클래스로 더 작게 — wheel zoom 영역 확보.
  const sheetTopByState: Record<typeof sheetSnap, string> = {
    // 🗺️ 2026-06-22 (대표 — "하단 상품 섹션 높이 줄이기"): 칩이 상단(MapTopBar)으로 빠져 시트엔
    //   드래그핸들+카운트/정렬+리스트만 → peek 을 320→240px 로 낮춰 지도 영역 확대. 네비(56) 위로
    //   카운트/정렬 + 카드 1개가 보이고, 더 보려면 위로 드래그(mid/full).
    peek: 'calc(100dvh - 240px)',
    mid: 'calc(100dvh - 60dvh)',
    // 🗺️ 2026-06-23 (대표 — 스크롤 시 상단 버튼과 겹침): full 을 상단 플로팅바(검색+칩 ~100px) 아래로
    //   제한(8dvh→고정 104px+노치). 시트가 상단바를 덮어 겹쳐 보이던 것 차단.
    full: 'calc(env(safe-area-inset-top, 0px) + 104px)',
  }
  // 🛡️ 2026-05-17: PC (lg+) 에서는 sheet 더 작게 (peek 16dvh, mid 40dvh, full 80dvh)
  //   → 지도 영역 60~84% 확보 → wheel zoom UX 정상.
  const sheetTopByStateLg: Record<typeof sheetSnap, string> = {
    peek: 'calc(100dvh - 240px)',
    mid: 'calc(100dvh - 40dvh)',
    full: 'calc(100dvh - 80dvh)',
  }
  const [isLgViewport, setIsLgViewport] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsLgViewport(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const currentSheetTop = (isLgViewport ? sheetTopByStateLg : sheetTopByState)[sheetSnap]

  // 🏠 2026-06-20 (대표 — 홈=당근식 1줄 리스트 + 지도 강조버튼): 리스트 모드. 데이터/지오코딩/정렬/필터는
  //   동일(위 hooks 공유), 지도 대신 1줄 리스트(RestaurantList) 풀페이지 + 상단 지역선택 + 하단 플로팅 '지도' 버튼.
  if (mode === 'list') {
    const regionLabel = district
      ? (findDistrictGroup(region, district)?.label.split('/')[0] || '지역')
      : region
      ? (findRegionByKey(region)?.label.replace('\n', ' ') || '지역')
      : nearMeMode
      // 🧭 2026-07-07 (대표 — '내 주변' 기준): 지역 미선택 + 내 주변 모드면 감지된 동네(폴백 '내 주변').
      ? (nearDong || '내 주변')
      : '전국'
    return (
      <div className="bg-white dark:bg-[#020202] min-h-[100dvh]">
        <SEO title={t('seo.home.title', { defaultValue: '유어딜 — 내 주변 동네딜' })} description={t('seo.home.description', { defaultValue: '내 주변 동네딜을 한눈에. 식사·뷰티·헬스·숙소·반려·액티비티 이용권.' })} url="/" />
        {/* 상단: 로고 + 지역선택 + 알림/장바구니 */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020202]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="ur-content-wide px-4 lg:px-8 h-12 flex items-center justify-between gap-2">
            {/* 🗺️ 2026-06-22 (대표 — 위치 교체): 로고를 좌측으로, 지역선택(전국)을 우측 그룹으로. */}
            <Link to="/" aria-label="홈" className="shrink-0 flex items-center">
              <UrDealLogo size={18} />
            </Link>
            <div className="flex items-center gap-1 text-gray-700 dark:text-gray-200 min-w-0">
              <button onClick={() => setFilterSheetOpen(true)} className="flex items-center gap-0.5 min-w-0 text-left mr-1">
                <MapPin className="w-4 h-4 text-gray-900 dark:text-white shrink-0" />
                <span className="text-[15px] font-extrabold text-gray-900 dark:text-white truncate">{regionLabel}</span>
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />
              </button>
              <button onClick={() => navigate('/search')} aria-label="검색" className="p-1.5 shrink-0"><Search className="h-5 w-5" strokeWidth={1.5} /></button>
              <button onClick={() => navigate('/notifications')} aria-label="알림" className="p-1.5 shrink-0"><Bell className="h-5 w-5" strokeWidth={1.5} /></button>
              <button onClick={() => navigate('/cart')} aria-label="장바구니" className="p-1.5 shrink-0"><ShoppingCart className="h-5 w-5" strokeWidth={1.5} /></button>
            </div>
          </div>
          {/* 카테고리 칩 + 필터/정렬 */}
          <SheetFilterBar
            activeFilterCount={activeFilterCount}
            onOpenFilter={() => setFilterSheetOpen(true)}
            nearMeMode={nearMeMode}
            requestNearMe={requestNearMe}
            voucherType={voucherType}
            setVoucherType={selectVoucherType}
            filteredCount={filtered.length}
            userLoc={userLoc}
            sortBy={sortBy}
            setSortBy={setSortByUser}
            favorites={favorites}
            showFavoritesOnly={showFavoritesOnly}
            setShowFavoritesOnly={setShowFavoritesOnly}
          />
        </div>
        {/* 1줄 리스트 */}
        <div className="ur-content-wide px-3 lg:px-8 pt-3 pb-28">
          <RestaurantList
            loading={loading}
            filtered={displayList}
            selected={null}
            userLoc={userLoc}
            onSelect={(r) => navigate(`/products/${r.id}`)}
            fcfsMap={fcfsMap}
            onApplyFcfs={applyFcfs}
            voucherType={voucherType}
          />
        </div>
        {/* 플로팅 '지도로 보기' 버튼 — 하단 네비 위 중앙.
            🎨 2026-07-03 (대표 시안 A 선택): 이모지(📍/기기별 편차) → lucide Map(접힌 지도) 라인 아이콘.
            전역 Map(생성자) 가림 방지 위해 `Map as MapIcon` 별칭. 아이콘 색 = 알약 글자색(currentColor). */}
        <button
          onClick={() => navigate('/map')}
          className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-blue-600 text-white rounded-full pl-3.5 pr-4 py-2.5 shadow-lg active:scale-95 transition-transform"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom,0px) + 16px)' }}
          aria-label={t('map.viewMap', { defaultValue: '지도로 보기' })}
        >
          <MapIcon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
          <span className="text-[14px] font-bold">{t('map.viewMap', { defaultValue: '지도로 보기' })}</span>
        </button>
        {filterSheetOpen && (
          <FilterSheet
            region={region} district={district} sortBy={sortBy} radiusKm={radiusKm} priceRange={priceRange}
            hasUserLoc={!!userLoc} countFor={countFor}
            onApply={(rg, dist, sort, radius, price) => {
              setRegion(rg); setDistrict(dist); setSortByUser(sort); setRadiusKm(radius); setPriceRange(price); setFilterSheetOpen(false)
            }}
            onClose={() => setFilterSheetOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <Screen fixed className="relative w-full bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden pb-16">
      <SEO
        title={home ? t('seo.home.title', { defaultValue: '유어딜 — 내 주변 동네딜 지도' }) : t('restaurantMap.seoTitle', { defaultValue: '맛집 지도' })}
        description={home ? t('seo.home.description', { defaultValue: '내 주변 동네딜을 지도에서 한눈에. 식사·숙소·뷰티 이용권을 가까운 순으로.' }) : t('restaurantMap.seoDesc', { defaultValue: '유어딜 바우처 사용 가능 맛집을 지도에서 찾아보세요. 인플루언서 추천 맛집 최대 70% 할인' })}
        url={home ? '/' : '/map'}
      />

      {/* ═══ 풀스크린 카카오맵 (배경) ═══
          🛡️ 2026-04-30 CLS: mapRef 컨테이너 항상 렌더 → SDK load 시 placeholder
            swap 없이 inset-0 에 카카오맵이 그려짐. layout shift 0. */}
      {/* 🛡️ 2026-05-16: touchAction='none' — 카카오 SDK 가 핀치/패닝 제스처 완전 take-over.
            기존엔 부모(pb-16) 의 scroll touch 가 핀치 제스처 가로채 줌 안 됨. */}
      <div ref={mapRef} className="absolute inset-0 bg-gray-100 dark:bg-[#1A1A1A]" style={{ touchAction: 'none' }} />
      {!(sdkLoaded && window.kakao?.maps) && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-[#1A1A1A] flex flex-col items-center justify-center pointer-events-none">
          <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
          {sdkError ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('restaurantMap.mapErrorTitle')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('restaurantMap.mapErrorSub')}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('restaurantMap.mapLoading')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('restaurantMap.sdkLoading')}</p>
            </>
          )}
        </div>
      )}

      {/* ═══ 상단 floating 바 — 카테고리 칩(상단 이동) + 검색 아이콘 버튼 ═══ */}
      <MapTopBar
        search={search}
        setSearch={setSearch}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
        searchHistory={searchHistory}
        setSearchHistory={setSearchHistory}
        pushSearchHistory={pushSearchHistory}
        voucherType={voucherType}
        setVoucherType={selectVoucherType}
        nearMeMode={nearMeMode}
        requestNearMe={requestNearMe}
        activeFilterCount={activeFilterCount}
        onOpenFilter={() => setFilterSheetOpen(true)}
        home={home}
      />

      {/* 🗺️ 2026-06-23 (대표 — 현위치 버튼): 누르면 GPS 현위치로 지도 이동(+파란 점 표시).
          peek 시트(240px) 위로 떠 있게 배치. nearMe 활성 시 강조, 조회 중 스피너. */}
      <button
        onClick={requestNearMe}
        disabled={locating}
        aria-label={nearMeMode ? t('restaurantMap.myLocationOff', { defaultValue: '내 위치 해제' }) : t('restaurantMap.myLocation', { defaultValue: '현위치로 이동' })}
        aria-pressed={nearMeMode}
        className={`absolute right-3 z-20 w-10 h-10 flex items-center justify-center rounded-full shadow-lg border active:scale-95 transition-all ${
          (nearMeMode || locating) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#0A0A0A] text-blue-600 dark:text-blue-400 border-gray-100 dark:border-[#1A1A1A]'
        }`}
        style={{ bottom: selected ? 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 150px)' : 'calc(240px + 16px)' }}
      >
        {locating ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <LocateFixed className="w-[18px] h-[18px]" />}
      </button>

      {/* 🗺️ 2026-06-22 (대표 시안 — 야놀자식): 선택 시 하단은 납작한 가로 카드(SelectedDealCard) →
          지도 넓게 + 좌우 스와이프 캐러셀. 미선택 시에만 드래그 리스트 시트. (둘은 배타) */}
      {selected ? (
        <SelectedDealCard
          selected={selected}
          userLoc={userLoc}
          onClose={() => setSelected(null)}
          onPrev={() => goAdjacent(-1)}
          onNext={() => goAdjacent(1)}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < displayList.length - 1}
          position={selectedIndex + 1}
          total={displayList.length}
        />
      ) : (
        /* ═══ Bottom Sheet (드래그 가능, 3-snap) — 칩은 상단 MapTopBar 로 이동, 시트는 리스트만 ═══ */
        <div
          className="absolute left-0 right-0 bottom-0 z-30 bg-white dark:bg-[#0A0A0A] rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] flex flex-col"
          style={{
            top: currentSheetTop,
            transform: dragStartY.current != null ? `translateY(${Math.max(-200, Math.min(400, dragDeltaY))}px)` : 'none',
            transition: dragStartY.current == null ? 'top 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          }}
          role="dialog"
          aria-label={t('restaurantMap.listAria', { defaultValue: '맛집 목록' })}
        >
          {/* Drag handle — 실시간 추적 + snap */}
          <div
            className="flex justify-center py-3 cursor-grab active:cursor-grabbing select-none touch-none"
            onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
            onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
            onTouchEnd={(e) => handleSheetDragEnd(e.changedTouches[0].clientY)}
            onMouseDown={(e) => handleSheetDragStart(e.clientY)}
            onMouseMove={(e) => { if (dragStartY.current != null) handleSheetDragMove(e.clientY) }}
            onMouseUp={(e) => handleSheetDragEnd(e.clientY)}
            onMouseLeave={(e) => { if (dragStartY.current != null) handleSheetDragEnd(e.clientY) }}
            role="slider"
            aria-label={t('restaurantMap.sheetResizeAria', { defaultValue: '시트 크기 조절' })}
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={sheetSnap === 'peek' ? 0 : sheetSnap === 'mid' ? 1 : 2}
            tabIndex={0}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* count + sort (칩은 상단으로 — hideChips) */}
          <SheetFilterBar
            activeFilterCount={activeFilterCount}
            onOpenFilter={() => setFilterSheetOpen(true)}
            nearMeMode={nearMeMode}
            requestNearMe={requestNearMe}
            voucherType={voucherType}
            setVoucherType={setVoucherType}
            filteredCount={displayList.length}
            viewportCount={viewportInCount}
            userLoc={userLoc}
            sortBy={sortBy}
            setSortBy={setSortByUser}
            favorites={favorites}
            showFavoritesOnly={showFavoritesOnly}
            setShowFavoritesOnly={setShowFavoritesOnly}
            hideChips
          />

          {/* ═══ 시트 안 스크롤 결과 리스트 (ScrollArea = flex-1 min-h-0 overflow 내장 → 하단 잘림 함정 제거) ═══ */}
          <ScrollArea ref={listScrollRef} className="px-3 pt-3 pb-24" style={{ overscrollBehavior: 'contain' }}>
            {/* 🛡️ 2026-04-30 Phase 3: hero carousel — 할인율 TOP5 */}
            {!loading && (
              <HeroCarousel
                heroDeals={heroDeals}
                userLoc={userLoc}
                liveSellerIds={liveSellerIds}
                onSelect={selectAndPan}
              />
            )}
            <RestaurantList
              loading={loading}
              filtered={viewportList}
              selected={selected}
              userLoc={userLoc}
              onSelect={selectAndPan}
              fcfsMap={fcfsMap}
              onApplyFcfs={applyFcfs}
              voucherType={voucherType}
            />
          </ScrollArea>
        </div>
      )}

      {/* 🛡️ 옵션 B — 회색 핀 (일반 맛집) 클릭 모달 */}
      {suggestionFor && (
        <SuggestionModal
          place={suggestionFor}
          onClose={() => setSuggestionFor(null)}
        />
      )}

      {/* 🛍️ 2026-06-20 필터 시트 A안 — 지역 + 정렬 + 거리반경 + 가격대 */}
      {filterSheetOpen && (
        <FilterSheet
          region={region}
          district={district}
          sortBy={sortBy}
          radiusKm={radiusKm}
          priceRange={priceRange}
          hasUserLoc={!!userLoc}
          countFor={countFor}
          onApply={(rg, dist, sort, radius, price) => {
            setRegion(rg)
            setDistrict(dist)
            setSortByUser(sort)
            setRadiusKm(radius)
            setPriceRange(price)
            setMapView(true)
            setFilterSheetOpen(false)
            // 🗺️ 2026-07-15 (대표 — "필터로 위치 설정하면 그거에 맞게 지도가 최대한 정확하게"):
            //   선택 지역에 매칭되는 딜 핀에 fit(가장 정확) → 없으면 지오코딩 → 시/도표 폴백. (기존 REGIONS 9개
            //   시/도 중심 pan 은 세부지역·미등록 시/도를 못 맞췄음.) 좌표 없는 rg 는 no-op(가드 내부 처리).
            if (rg && mapInstance.current && window.kakao?.maps) {
              const pins = enrichedRestaurants
                .filter(r => matchesFilter(r, rg, dist, radius, price) && r.restaurant_lat && r.restaurant_lng)
                .map(r => ({ lat: r.restaurant_lat, lng: r.restaurant_lng }))
              void panToRegionAccurate(mapInstance.current, rg, dist, pins)
            }
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}

      {/* 🗺️ 2026-07-15 (대표 — "내 주변 누르니 권한 필요 뜨면?"): 위치 실패 상황별 안내 시트. */}
      {geoHelp && (
        <GeoHelpSheet
          reason={geoHelp}
          onClose={() => setGeoHelp(null)}
          onRetry={requestNearMe}
        />
      )}
    </Screen>
  )
}

// FilterSheet 는 ./restaurant-map/FilterSheet 에서 import.

