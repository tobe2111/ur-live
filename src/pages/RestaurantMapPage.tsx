import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { isKorea } from '@/shared/config/region'
import { storage } from '@/shared/utils/storage'

// 🛡️ 2026-05-02: TD-018 추가 분할 — types/utils/HeroCarousel 추출.
// 🛡️ 2026-05-05: TD-006 추가 분할 — RestaurantList / SelectedPeekCard / SelectedDetailCard 추출.
// 🛡️ 2026-05-06: TD-006 추가 분할 — MapSearchHeader / SheetFilterBar 추출.
import { CATEGORIES, REGIONS } from './restaurant-map/constants'
import FilterSheet from './restaurant-map/FilterSheet'
import SuggestionModal from './restaurant-map/SuggestionModal'
import HeroCarousel from './restaurant-map/HeroCarousel'
import RestaurantList from './restaurant-map/RestaurantList'
import SelectedPeekCard from './restaurant-map/SelectedPeekCard'
import SelectedDetailCard from './restaurant-map/SelectedDetailCard'
import MapSearchHeader from './restaurant-map/MapSearchHeader'
import SheetFilterBar from './restaurant-map/SheetFilterBar'
import { useKakaoMap } from './restaurant-map/useKakaoMap'
import { distanceKm } from './restaurant-map/utils'
import type { Restaurant, KakaoPlace, SortBy } from './restaurant-map/types'

// re-export so that any callers importing KakaoPlace from RestaurantMapPage 가 깨지지 않음
export type { KakaoPlace }

// Window.kakao is declared in KakaoCallbackPage.tsx or similar global declaration

export default function RestaurantMapPage() {
  const { t } = useTranslation()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('')
  const [search, setSearch] = useState('')
  const [mapView, setMapView] = useState(true)
  // 🛡️ 2026-04-28: Recommended Pack — 거리/카테고리/정렬
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [category, setCategory] = useState<string>('')
  // 🛡️ 2026-04-28: 공구권 카테고리 (식사/뷰티/헬스) — meal_voucher 인프라 재활용
  const [voucherType, setVoucherType] = useState<'all' | 'meal_voucher' | 'beauty_voucher' | 'health_voucher' | 'pet_voucher' | 'stay_voucher' | 'activity_voucher'>('all')
  const [sortBy, setSortBy] = useState<SortBy>('discount')
  // 옵션 B: 카카오 일반 맛집 + 클릭 시 수요 신호 모달
  const [kakaoPlaces, setKakaoPlaces] = useState<KakaoPlace[]>([])
  const [suggestionFor, setSuggestionFor] = useState<KakaoPlace | null>(null)
  // 즐겨찾기 (localStorage) + 라이브 셀러 ID 집합
  const [favorites, setFavorites] = useState<number[]>(() => storage.getJSON<number[]>('restaurant_favorites', []))
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [liveSellerIds, setLiveSellerIds] = useState<Set<number>>(new Set())
  // 🛡️ 2026-04-30: UX 개선 — 필터 시트 (지역 + 카테고리 통합)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const activeFilterCount = (region ? 1 : 0) + (category ? 1 : 0)
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'mid' | 'full'>('mid')
  // 🛡️ 2026-04-30 Phase 5: '내 주변' 모드 (GPS 권한 요청 + 거리순 자동)
  const [nearMeMode, setNearMeMode] = useState(false)
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

  // 데이터 로드 — voucherType 으로 카테고리 필터 (all / meal / beauty / health)
  useEffect(() => {
    api.get('/api/group-buy/products', { params: { category: voucherType === 'all' ? 'all' : voucherType } })
      .then(r => {
        if (r.data.success) {
          setRestaurants(r.data.data || [])
        }
      })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [voucherType])

  // 🛡️ 2026-04-28: 옵션 B — 사용자 위치 기반 카카오 일반 맛집 자동 로드.
  //  식사권 적은 단계에 빈 지도 문제 해결 + 수요 신호 (영입 신청) 수집.
  //  핀 색상으로 구분 — 식사권 (분홍) / 일반 (회색).
  useEffect(() => {
    if (!userLoc || !kr) return
    const cat = CATEGORIES.find(c => c.key === category)
    const url = cat && cat.keywords.length > 0
      ? `/api/kakao/place/search?query=${encodeURIComponent(cat.keywords[0] + ' 맛집')}&category_group_code=FD6&size=15`
      : `/api/kakao/place/nearby?lat=${userLoc.lat}&lng=${userLoc.lng}&radius=1500&category=FD6&size=15`
    api.get(url)
      .then(r => {
        if (r.data?.success && r.data.data?.documents) {
          setKakaoPlaces(r.data.data.documents.slice(0, 15))
        }
      })
      .catch(() => { /* silent */ })
  }, [userLoc, kr, category])

  // 🛡️ 2026-04-28: 좌표 없는 식사권 자동 geocoding (카카오 주소 → lat/lng).
  //   셀러가 카카오 장소검색을 안 거치고 등록한 식사권은 lat/lng 비어 있어 핀 X.
  //   여기서 클라이언트 fallback 으로 보강 → 핀 표시 누락 방지.
  //   (서버 cron 으로 일괄 보강하는 게 더 깔끔하지만 즉시 효과 큼)
  useEffect(() => {
    if (restaurants.length === 0 || !kr) return
    const missingCoords = restaurants.filter(r => r.restaurant_address && (!r.restaurant_lat || !r.restaurant_lng))
    if (missingCoords.length === 0) return
    let cancelled = false
    Promise.all(
      missingCoords.slice(0, 10).map(async (r) => {
        try {
          const res = await api.get(`/api/kakao/place/address?query=${encodeURIComponent(r.restaurant_address)}`)
          const doc = res.data?.data?.documents?.[0]
          if (doc?.x && doc?.y) {
            return { id: r.id, lat: Number(doc.y), lng: Number(doc.x) }
          }
        } catch { /* silent — 위치 없어도 목록엔 표시 */ }
        return null
      })
    ).then(updates => {
      if (cancelled) return
      const map = new Map(updates.filter(Boolean).map(u => [u!.id, u!]))
      if (map.size === 0) return
      setRestaurants(prev => prev.map(r => {
        const u = map.get(r.id)
        return u ? { ...r, restaurant_lat: u.lat, restaurant_lng: u.lng } : r
      }))
    })
    return () => { cancelled = true }
  }, [restaurants.length, kr])


  const filtered = useMemo(() => {
    let items = restaurants.filter(r => {
      if (showFavoritesOnly && !favorites.includes(r.id)) return false
      if (region && !r.restaurant_address?.includes(region)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(r.restaurant_name?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.restaurant_address?.toLowerCase().includes(q))) return false
      }
      // 카테고리 필터: name/category/address 에 키워드 포함 여부
      if (category) {
        const cat = CATEGORIES.find(c => c.key === category)
        if (cat && cat.keywords.length > 0) {
          const haystack = `${r.name || ''} ${r.category || ''} ${r.restaurant_name || ''}`.toLowerCase()
          if (!cat.keywords.some(kw => haystack.includes(kw.toLowerCase()))) return false
        }
      }
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
  }, [restaurants, region, search, category, sortBy, userLoc, showFavoritesOnly, favorites])

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

  const { mapRef, mapInstance, sdkLoaded, sdkError } = useKakaoMap({
    kr,
    withCoords,
    coordGroupSize,
    selected,
    setSelected,
    kakaoPlaces,
    setSuggestionFor,
    userLoc,
    liveSellerIds,
    favorites,
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLoc(loc)
        setNearMeMode(true)
        setSortBy('distance')
        if (mapInstance.current && window.kakao?.maps) {
          mapInstance.current.panTo(new window.kakao.maps.LatLng(loc.lat, loc.lng))
          mapInstance.current.setLevel(5)
        }
      },
      () => toast.error(t('restaurantMap.geoPermissionDenied')),
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 }
    )
  }, [userLoc])

  const selectAndPan = (r: Restaurant) => {
    setSelected(r)
    if (mapInstance.current && window.kakao?.maps && r.restaurant_lat && r.restaurant_lng) {
      mapInstance.current.panTo(new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng))
      mapInstance.current.setLevel(4)
    }
    setMapView(true)
  }

  // 🛡️ 2026-04-30 v3 bottom-sheet: 시트 snap 별 transform 값
  //   peek = 12vh 만 보임 (결과 카운트 + 첫 카드 일부)
  //   peek = 28vh (필터 + 첫 결과 한 줄 보임)
  //   mid  = 60vh
  //   full = 92vh (거의 풀스크린)
  // 🛡️ 2026-04-30 v2: peek 18vh → 28vh — 결과 카드 안 보이던 문제 (사용자 신고).
  // 🛡️ 2026-05-04 (iOS Safari fix): 100vh → 100dvh. iOS 주소창 토글 시 viewport 점프 회피.
  const sheetTopByState: Record<typeof sheetSnap, string> = {
    peek: 'calc(100dvh - 28dvh)',
    mid: 'calc(100dvh - 60dvh)',
    full: 'calc(100dvh - 92dvh)',
  }

  return (
    <div className="relative h-screen w-full bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden pb-16">
      <SEO title={t('restaurantMap.seoTitle', { defaultValue: '맛집 지도' })} description={t('restaurantMap.seoDesc', { defaultValue: '유어딜 바우처 사용 가능 맛집을 지도에서 찾아보세요. 인플루언서 추천 맛집 최대 70% 할인' })} url="/restaurant-map" />

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

      {/* ═══ 상단 floating glass 검색바 ═══ */}
      <MapSearchHeader
        search={search}
        setSearch={setSearch}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
        searchHistory={searchHistory}
        setSearchHistory={setSearchHistory}
        pushSearchHistory={pushSearchHistory}
      />

      {/* ═══ 선택된 맛집 카드 (지도 위 floating, sheet peek 일 때만 표시) ═══ */}
      {selected && sheetSnap === 'peek' && (
        <SelectedPeekCard
          selected={selected}
          liveSellerIds={liveSellerIds}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ═══ Bottom Sheet (드래그 가능, 3-snap) ═══
          🛡️ 2026-04-30 v2: 실시간 드래그 팔로잉 — translateY 로 손가락 따라가기.
          dragDeltaY 가 양수면 아래로 (시트 축소), 음수면 위로 (시트 확장). */}
      <div
        className="absolute left-0 right-0 bottom-0 z-30 bg-white dark:bg-[#0A0A0A] rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] flex flex-col"
        style={{
          top: sheetTopByState[sheetSnap],
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

        {/* Sticky filter row + count + sort */}
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

        {/* ═══ 시트 안 스크롤 가능한 결과 리스트 ═══ */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-24" style={{ overscrollBehavior: 'contain' }}>
          {selected && (
            /* 선택된 맛집 디테일 카드 (sheet mid/full 일 때 list 위에 표시) */
            <SelectedDetailCard
              selected={selected}
              userLoc={userLoc}
              liveSellerIds={liveSellerIds}
              favorites={favorites}
              onClose={() => setSelected(null)}
              onToggleFavorite={toggleFavorite}
            />
          )}

          {/* 🛡️ 2026-04-30 Phase 3: hero carousel — 할인율 TOP5 (선택 카드 없을 때만) */}
          {!loading && !selected && (
            <HeroCarousel
              heroDeals={heroDeals}
              userLoc={userLoc}
              liveSellerIds={liveSellerIds}
              onSelect={selectAndPan}
            />
          )}

          <RestaurantList
            loading={loading}
            filtered={filtered}
            selected={selected}
            userLoc={userLoc}
            onSelect={selectAndPan}
          />
          </div>
        </div>

      {/* 🛡️ 옵션 B — 회색 핀 (일반 맛집) 클릭 모달 */}
      {suggestionFor && (
        <SuggestionModal
          place={suggestionFor}
          onClose={() => setSuggestionFor(null)}
        />
      )}

      {/* 🛡️ 2026-04-30: 필터 시트 — 지역 + 카테고리 (한 화면) */}
      {filterSheetOpen && (
        <FilterSheet
          region={region}
          category={category}
          onApply={(r, c) => {
            setRegion(r)
            setCategory(c)
            setMapView(true)
            const target = REGIONS.find(x => x.key === r) || REGIONS[0]
            if (mapInstance.current && window.kakao?.maps) {
              mapInstance.current.panTo(new window.kakao.maps.LatLng(target.lat, target.lng))
              mapInstance.current.setLevel(target.level)
            }
            setFilterSheetOpen(false)
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </div>
  )
}

// FilterSheet 는 ./restaurant-map/FilterSheet 에서 import.

