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
import { REGIONS } from './restaurant-map/constants'
import FilterSheet, { type PriceRange } from './restaurant-map/FilterSheet'
import SuggestionModal from './restaurant-map/SuggestionModal'
import HeroCarousel from './restaurant-map/HeroCarousel'
import RestaurantList from './restaurant-map/RestaurantList'
import SelectedDealCard from './restaurant-map/SelectedDealCard'
import MapTopBar from './restaurant-map/MapTopBar'
import SheetFilterBar from './restaurant-map/SheetFilterBar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Screen } from '@/components/ui/screen'
import { useKakaoMap } from './restaurant-map/useKakaoMap'
import { distanceKm } from './restaurant-map/utils'
import type { Restaurant, KakaoPlace, SortBy } from './restaurant-map/types'
import { useMapProducts } from '@/hooks/queries/useMapProducts'
import { matchAddress, findRegionByKey, findDistrictGroup } from '@/shared/constants/korea-regions'

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
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  // 🛡️ 2026-04-28: 공구권 카테고리 (식사/뷰티/헬스) — meal_voucher 인프라 재활용
  const [voucherType, setVoucherType] = useState<'all' | 'meal_voucher' | 'beauty_voucher' | 'health_voucher' | 'pet_voucher' | 'stay_voucher' | 'activity_voucher'>('all')
  // 🛡️ 2026-06-01 Tier2: products fetch 만 React Query(카테고리별 캐시). live-poller 는 유지.
  const { data: restaurants = [], isLoading: loading } = useMapProducts(voucherType === 'all' ? 'all' : voucherType)
  // 🗺️ 2026-06-20 (대표 — 상품 클릭 시 위치 이동/핀 표시 안 됨): 좌표 없는 딜(주소만 있음)을 클라이언트에서
  //   주소→좌표 지오코딩(/api/kakao/place/address)으로 보강. 서버 cron(restaurant-geocode)이 채우기 전/
  //   누락분도 즉시 지도 핀 + 클릭 이동 가능. sessionStorage 캐시 + 딜당 1회 시도 + 최대 12개(레이트리밋 보호).
  const [geoCache, setGeoCache] = useState<Record<number, { lat: number; lng: number }>>(() => {
    try { return JSON.parse(sessionStorage.getItem('ur_geocache_v1') || '{}') } catch { return {} }
  })
  const geoAttempted = useRef<Set<number>>(new Set())
  useEffect(() => {
    const missing = restaurants.filter(r => !r.restaurant_lat && r.restaurant_address && !geoAttempted.current.has(r.id)).slice(0, 12)
    if (missing.length === 0) return
    missing.forEach(r => geoAttempted.current.add(r.id))
    let cancelled = false
    ;(async () => {
      const next: Record<number, { lat: number; lng: number }> = {}
      for (const r of missing) {
        try {
          const res = await api.get('/api/kakao/place/address', { params: { query: r.restaurant_address } })
          const d = res.data?.data?.documents?.[0]
          const lat = Number(d?.y), lng = Number(d?.x)
          if (Number.isFinite(lat) && Number.isFinite(lng)) next[r.id] = { lat, lng }
        } catch { /* skip */ }
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setGeoCache(prev => {
          const merged = { ...prev, ...next }
          try { sessionStorage.setItem('ur_geocache_v1', JSON.stringify(merged)) } catch { /* ignore */ }
          return merged
        })
      }
    })()
    return () => { cancelled = true }
  }, [restaurants])
  const enrichedRestaurants = useMemo(
    () => restaurants.map(r => (!r.restaurant_lat && geoCache[r.id])
      ? { ...r, restaurant_lat: geoCache[r.id].lat, restaurant_lng: geoCache[r.id].lng }
      : r),
    [restaurants, geoCache]
  )
  // 🎯 2026-06-20 선착순: 활성 선착순 상품 config(상위노출·배지·지원용). id→{spots,appliedDisplay}.
  const [fcfsMap, setFcfsMap] = useState<Map<number, { spots: number; appliedDisplay: number }>>(new Map())
  useEffect(() => {
    api.get('/api/fcfs/active')
      .then(r => {
        const m = new Map<number, { spots: number; appliedDisplay: number }>()
        for (const p of (r.data?.data || [])) {
          if (p?.fcfs?.enabled) m.set(p.id, { spots: p.fcfs.spots || 0, appliedDisplay: p.fcfs.appliedDisplay || 0 })
        }
        setFcfsMap(m)
      })
      .catch(() => { /* silent */ })
  }, [])
  const applyFcfs = useCallback(async (productId: number) => {
    try {
      const res = await api.post(`/api/fcfs/${productId}/apply`)
      toast.success(res.data?.data?.already ? '이미 지원했어요' : '🎉 지원 완료! 선정 시 알림으로 안내드려요')
    } catch {
      toast.error('지원하려면 로그인이 필요해요')
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
  const [liveSellerIds, setLiveSellerIds] = useState<Set<number>>(new Set())
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
  // 🛡️ 2026-04-30 Phase 5: 검색 히스토리 (localStorage)
  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    storage.getJSON<string[]>('restaurant_search_history', [])
  )
  const [searchFocused, setSearchFocused] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const dragStartSnap = useRef<'peek' | 'mid' | 'full'>('mid')

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

  // 라이브 셀러 폴링 — 식사권 셀러가 라이브 중이면 핀에 LIVE 배지
  // 🛡️ 2026-04-30 UX: 30초 → 90초로 완화 + 탭 숨김 시 일시 정지 (배터리·네트워크 절약).
  //   "자동으로 새로고침되며 긴 로딩" 사용자 신고 대응.
  useEffect(() => {
    let cancelled = false
    let id: ReturnType<typeof setInterval> | null = null

    const fetchLive = async () => {
      if (document.visibilityState !== 'visible') return // 백그라운드면 skip
      try {
        const res = await api.get('/api/streams', { params: { status: 'live', limit: 50 } })
        if (cancelled) return
        if (res.data?.success && Array.isArray(res.data.data)) {
          const ids = new Set<number>(res.data.data.map((s: { seller_id?: number }) => s.seller_id).filter(Boolean) as number[])
          setLiveSellerIds(ids)
        }
      } catch { /* silent */ }
    }

    const startPolling = () => {
      if (id) clearInterval(id)
      id = setInterval(fetchLive, 90_000)
    }

    fetchLive()
    startPolling()
    // 탭 복귀 시 즉시 1회 fetch + 폴링 재시작
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLive()
        startPolling()
      } else if (id) {
        clearInterval(id)
        id = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      if (id) clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // 사용자 위치 자동 감지 (1회) — 거리순 정렬용
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* 거부/실패 — 거리순 비활성 */ },
      { timeout: 5000, enableHighAccuracy: false, maximumAge: 600000 }
    )
  }, [])

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

  // 🛡️ 2026-05-19: 클라이언트 geocoding loop 제거.
  //   이전: 사용자 1명당 카카오 API ~10 호출 (페이지 진입 시마다).
  //   현재: 서버 cron (worker/cron/restaurant-geocode.ts) 매일 03:00 UTC 일괄 처리.
  //         새 식사권 등록 후 다음 cron 까지 (최대 24h) 핀 표시 없을 수 있으나,
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

  const filtered = useMemo(() => {
    let items = enrichedRestaurants.filter(r => {
      if (showFavoritesOnly && !favorites.includes(r.id)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(r.restaurant_name?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.restaurant_address?.toLowerCase().includes(q))) return false
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
  }, [enrichedRestaurants, region, district, search, sortBy, radiusKm, priceRange, matchesFilter, showFavoritesOnly, favorites])

  // 🎯 2026-06-20 선착순 상위노출 — 선착순 상품을 리스트 최상단으로(나머지 순서 보존).
  const displayList = useMemo(() => {
    if (fcfsMap.size === 0) return filtered
    return [...filtered].sort((a, b) => (fcfsMap.has(b.id) ? 1 : 0) - (fcfsMap.has(a.id) ? 1 : 0))
  }, [filtered, fcfsMap])

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

  // 🛡️ 2026-04-28: 동일 좌표 식사권 그룹화 (핀 겹침 방지).
  //   같은 매장에 식사권 여러 개 등록 시 핀 1개 + 개수 배지.
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
  })

  // 🛡️ 2026-04-30 Phase 5: '내 주변' 클릭 — GPS 요청 + 거리순 + 위치로 pan
  const requestNearMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error(t('restaurantMap.geoNotSupported'))
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
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLoc(loc)
        setNearMeMode(true)
        setSortBy('distance')
        if (mapInstance.current && window.kakao?.maps) {
          mapInstance.current.panTo(new window.kakao.maps.LatLng(loc.lat, loc.lng))
          mapInstance.current.setLevel(5)
        }
      },
      () => { setLocating(false); toast.error(t('restaurantMap.geoPermissionDenied')) },
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 }
    )
  }, [userLoc])

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
      : '전국'
    return (
      <div className="bg-white dark:bg-[#020202] min-h-[100dvh]">
        <SEO title={t('seo.home.title', { defaultValue: '유어딜 — 내 주변 동네딜' })} description={t('seo.home.description', { defaultValue: '내 주변 동네딜을 한눈에. 식사·뷰티·헬스·숙소·반려·액티비티 공구권.' })} url="/" />
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
            setVoucherType={setVoucherType}
            filteredCount={filtered.length}
            userLoc={userLoc}
            sortBy={sortBy}
            setSortBy={setSortBy}
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
        {/* 플로팅 '지도' 버튼 — 하단 네비 위 중앙 */}
        <button
          onClick={() => navigate('/map')}
          className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full pl-4 pr-5 py-3 shadow-xl active:scale-95 transition-transform"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom,0px) + 16px)' }}
          aria-label={t('map.viewMap', { defaultValue: '지도로 보기' })}
        >
          <MapIcon className="w-4 h-4" />
          <span className="text-[14px] font-bold">{t('map.viewMap', { defaultValue: '지도' })}</span>
        </button>
        {filterSheetOpen && (
          <FilterSheet
            region={region} district={district} sortBy={sortBy} radiusKm={radiusKm} priceRange={priceRange}
            hasUserLoc={!!userLoc} countFor={countFor}
            onApply={(rg, dist, sort, radius, price) => {
              setRegion(rg); setDistrict(dist); setSortBy(sort); setRadiusKm(radius); setPriceRange(price); setFilterSheetOpen(false)
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
        description={home ? t('seo.home.description', { defaultValue: '내 주변 동네딜을 지도에서 한눈에. 식사·숙소·뷰티 공구권을 가까운 순으로.' }) : t('restaurantMap.seoDesc', { defaultValue: '유어딜 바우처 사용 가능 맛집을 지도에서 찾아보세요. 인플루언서 추천 맛집 최대 70% 할인' })}
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
        setVoucherType={setVoucherType}
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
        aria-label={t('restaurantMap.myLocation', { defaultValue: '현위치로 이동' })}
        className={`absolute right-3 z-20 w-11 h-11 flex items-center justify-center rounded-full shadow-lg border border-gray-100 dark:border-[#1A1A1A] active:scale-95 transition-all disabled:opacity-70 ${
          nearMeMode ? 'bg-pink-500 text-white border-pink-500' : 'bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-gray-200'
        }`}
        style={{ bottom: 'calc(240px + 16px)' }}
      >
        {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
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
            filteredCount={filtered.length}
            userLoc={userLoc}
            sortBy={sortBy}
            setSortBy={setSortBy}
            favorites={favorites}
            showFavoritesOnly={showFavoritesOnly}
            setShowFavoritesOnly={setShowFavoritesOnly}
            hideChips
          />

          {/* ═══ 시트 안 스크롤 결과 리스트 (ScrollArea = flex-1 min-h-0 overflow 내장 → 하단 잘림 함정 제거) ═══ */}
          <ScrollArea className="px-3 pt-3 pb-24" style={{ overscrollBehavior: 'contain' }}>
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
              filtered={displayList}
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
            setSortBy(sort)
            setRadiusKm(radius)
            setPriceRange(price)
            setMapView(true)
            // 시/도 중심으로 지도 이동(좌표 있는 주요 시/도만). 세부지역/미좌표 시/도는 리스트·핀 필터로 반영.
            const target = REGIONS.find(x => x.key === rg)
            if (target && mapInstance.current && window.kakao?.maps) {
              mapInstance.current.panTo(new window.kakao.maps.LatLng(target.lat, target.lng))
              mapInstance.current.setLevel(target.level)
            }
            setFilterSheetOpen(false)
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </Screen>
  )
}

// FilterSheet 는 ./restaurant-map/FilterSheet 에서 import.

