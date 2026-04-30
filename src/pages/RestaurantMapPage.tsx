import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Search, Ticket, Phone, X, Navigation, ArrowUpDown, Heart, Radio, SlidersHorizontal } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { isKorea } from '@/shared/config/region'
import { storage } from '@/shared/utils/storage'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { escapeHtml } from '@/shared/utils/html'
import { formatNumber } from '@/utils/format'

interface Restaurant {
  id: number; name: string; restaurant_name: string; restaurant_address: string
  restaurant_phone: string; restaurant_lat: number; restaurant_lng: number
  price: number; original_price: number; image_url: string
  discount_percent: number; rating: number
  category?: string
  seller_id?: number
}

// 카카오맵 길찾기 외부 링크 — 사용자 위치에서 매장까지
function kakaoDirectionsUrl(r: { restaurant_name?: string; restaurant_lat?: number; restaurant_lng?: number }): string {
  const name = encodeURIComponent(r.restaurant_name || '맛집')
  return `https://map.kakao.com/link/to/${name},${r.restaurant_lat},${r.restaurant_lng}`
}

// Haversine 거리 계산 (km)
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const CATEGORIES: { key: string; emoji: string; label: string; keywords: string[] }[] = [
  { key: '', emoji: '🍽️', label: '전체', keywords: [] },
  { key: 'korean', emoji: '🍚', label: '한식', keywords: ['한식', '국밥', '비빔밥', '백반', '찌개', '삼겹살'] },
  { key: 'japanese', emoji: '🍱', label: '일식', keywords: ['일식', '스시', '돈까스', '라멘', '우동', '초밥'] },
  { key: 'chinese', emoji: '🍜', label: '중식', keywords: ['중식', '짜장', '짬뽕', '탕수육', '마라'] },
  { key: 'cafe', emoji: '☕', label: '카페', keywords: ['카페', '커피', '디저트', '베이커리'] },
  { key: 'western', emoji: '🥩', label: '양식', keywords: ['양식', '파스타', '스테이크', '피자', '버거'] },
  { key: 'snack', emoji: '🥟', label: '분식', keywords: ['분식', '떡볶이', '김밥', '튀김'] },
]

type SortBy = 'distance' | 'discount' | 'price' | 'rating'

// 🛡️ 2026-04-28: 옵션 B — 카카오 Places 일반 맛집 (식사권 미출시)
interface KakaoPlace {
  id: string
  place_name: string
  category_name: string
  phone: string
  road_address_name: string
  address_name: string
  x: string // longitude (string)
  y: string // latitude (string)
  place_url: string
  distance?: string // meters
}

// Window.kakao is declared in KakaoCallbackPage.tsx or similar global declaration

const REGIONS = [
  { key: '', label: '전체', emoji: '📍', lat: 36.5, lng: 127.8, level: 13 },
  { key: '서울', label: '서울', emoji: '🏙️', lat: 37.5665, lng: 126.978, level: 8 },
  { key: '경기', label: '경기', emoji: '🌳', lat: 37.4138, lng: 127.5183, level: 10 },
  { key: '인천', label: '인천', emoji: '⚓', lat: 37.4563, lng: 126.7052, level: 9 },
  { key: '부산', label: '부산', emoji: '🌊', lat: 35.1796, lng: 129.0756, level: 8 },
  { key: '대구', label: '대구', emoji: '🍎', lat: 35.8714, lng: 128.6014, level: 8 },
  { key: '광주', label: '광주', emoji: '💡', lat: 35.1595, lng: 126.8526, level: 8 },
  { key: '대전', label: '대전', emoji: '🧪', lat: 36.3504, lng: 127.3845, level: 8 },
  { key: '제주', label: '제주', emoji: '🍊', lat: 33.4890, lng: 126.4983, level: 9 },
]

export default function RestaurantMapPage() {
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const overlaysRef = useRef<any[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('')
  const [search, setSearch] = useState('')
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState(false)
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
  // 🛡️ 2026-04-30: bottom-sheet 3-snap (peek=결과만 / mid=절반 / full=거의 풀스크린)
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'mid' | 'full'>('mid')
  // 🛡️ 2026-04-30 Phase 5: '내 주변' 모드 (GPS 권한 요청 + 거리순 자동)
  const [nearMeMode, setNearMeMode] = useState(false)
  // 🛡️ 2026-04-30 Phase 5: 검색 히스토리 (localStorage)
  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    storage.getJSON<string[]>('restaurant_search_history', [])
  )
  const [searchFocused, setSearchFocused] = useState(false)
  // 🛡️ 2026-04-30 Phase 5: zoom-aware clustering
  const [mapLevel, setMapLevel] = useState<number>(7)
  const dragStartY = useRef<number | null>(null)
  const dragStartSnap = useRef<'peek' | 'mid' | 'full'>('mid')

  // 🛡️ 2026-04-30 Phase 5: '내 주변' 클릭 — GPS 요청 + 거리순 + 위치로 pan
  const requestNearMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('이 기기는 위치 서비스를 지원하지 않습니다.')
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
      () => toast.error('위치 권한이 필요합니다. 브라우저 설정에서 허용해주세요.'),
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 }
    )
  }, [userLoc])

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

  // 지도 SDK 로드 (한국: 카카오맵 / 글로벌: 목록만)
  useEffect(() => {
    if (!kr) {
      setSdkLoaded(false)
      setMapView(false)
      return
    }
    import('@/lib/kakao-sdk').then(({ ensureKakaoMaps }) => {
      ensureKakaoMaps()
        .then(() => setSdkLoaded(true))
        .catch((e) => {
          if (import.meta.env.DEV) console.error('[RestaurantMap] Kakao Maps load failed:', e)
          setSdkLoaded(false)
          setSdkError(true)
          setMapView(false)
        })
    })
  }, [kr])

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

  // 지도 초기화 + 마커
  const initMap = useCallback(() => {
    if (!sdkLoaded || !mapRef.current || !window.kakao?.maps) return

    const center = withCoords.length > 0
      ? new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng)
      : new window.kakao.maps.LatLng(37.5665, 126.978)

    if (!mapInstance.current) {
      mapInstance.current = new window.kakao.maps.Map(mapRef.current, {
        center,
        level: 7,
      })
      // 줌 컨트롤
      const zoomControl = new window.kakao.maps.ZoomControl()
      mapInstance.current.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT)
      // 🛡️ 2026-04-30 Phase 5: zoom 변경 리스너 → 클러스터링 재계산
      window.kakao.maps.event.addListener(mapInstance.current, 'zoom_changed', () => {
        if (mapInstance.current) setMapLevel(mapInstance.current.getLevel())
      })
    }

    // 기존 마커/오버레이 제거
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []

    // 🛡️ 2026-04-30 Phase 5: zoom-aware grid clustering
    //   level 1-3 (가까이): 클러스터 없음 (개별 핀)
    //   level 4-5: 0.001° (~100m)
    //   level 6-7: 0.005° (~500m)
    //   level 8+ (멀리): 0.02° (~2km)
    const gridSize = mapLevel <= 3 ? 0 : mapLevel <= 5 ? 0.001 : mapLevel <= 7 ? 0.005 : 0.02
    const clusters = new Map<string, Restaurant[]>()
    if (gridSize > 0) {
      withCoords.forEach(r => {
        const gx = Math.floor(r.restaurant_lng / gridSize)
        const gy = Math.floor(r.restaurant_lat / gridSize)
        const key = `${gx}_${gy}`
        if (!clusters.has(key)) clusters.set(key, [])
        clusters.get(key)!.push(r)
      })
    }

    // 클러스터 핀 렌더 (2+ 개) — gridSize > 0 일 때만
    if (gridSize > 0) {
      clusters.forEach((items) => {
        if (items.length < 2) return // 1개면 individual 렌더로 떨어짐 (아래)
        // centroid
        const sumLat = items.reduce((s, x) => s + x.restaurant_lat, 0)
        const sumLng = items.reduce((s, x) => s + x.restaurant_lng, 0)
        const cx = sumLat / items.length
        const cy = sumLng / items.length
        const minPrice = Math.min(...items.map(x => x.price || 0))
        const cPos = new window.kakao.maps.LatLng(cx, cy)
        const cContent = document.createElement('div')
        cContent.innerHTML = `
          <div style="
            background: linear-gradient(135deg,#ec4899,#f43f5e);
            color: #fff;
            border: 3px solid #fff;
            border-radius: 999px;
            min-width: 44px;
            height: 44px;
            padding: 0 12px;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            box-shadow: 0 4px 14px rgba(236,72,153,0.4);
            cursor: pointer;
            transform: translate(-50%, -50%);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          ">
            <span>${items.length}</span>
            <span style="font-size:9px;opacity:0.9;font-weight:600;">${formatNumber(minPrice)}원~</span>
          </div>
        `
        cContent.addEventListener('click', () => {
          if (mapInstance.current) {
            mapInstance.current.panTo(cPos)
            // 줌 인 — 한 단계당 큰 변화이므로 -2 로 한 번에 더 가까이
            const newLevel = Math.max(1, mapInstance.current.getLevel() - 2)
            mapInstance.current.setLevel(newLevel)
          }
        })
        const cOverlay = new window.kakao.maps.CustomOverlay({
          position: cPos,
          content: cContent,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: 5,
          map: mapInstance.current,
        })
        overlaysRef.current.push(cOverlay)
      })
    }

    // 개별 핀 렌더 — 클러스터 멤버 (2+) 는 skip
    const clusteredKeys = new Set<string>()
    if (gridSize > 0) {
      clusters.forEach((items, key) => {
        if (items.length >= 2) clusteredKeys.add(key)
      })
    }

    withCoords.forEach(r => {
      // 클러스터에 속한 핀이면 skip
      if (gridSize > 0) {
        const gx = Math.floor(r.restaurant_lng / gridSize)
        const gy = Math.floor(r.restaurant_lat / gridSize)
        if (clusteredKeys.has(`${gx}_${gy}`)) return
      }
      const pos = new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)

      // 🛡️ 2026-04-30 v2: 가격 라벨 → 카테고리 이모지 동그란 핀 (사용자 신고 — 가격 라벨이 시각적으로 부담)
      //   기본 핀: 음식/뷰티/헬스 등 카테고리 emoji + 작은 동그라미. 선택 시 큰 카드로 가격 표시.
      //   할인/LIVE/즐겨찾기 등은 작은 dot/badge 로만 표시.
      const hasDiscount = r.original_price > r.price
      const isLive = r.seller_id ? liveSellerIds.has(r.seller_id) : false
      const isFav = favorites.includes(r.id)
      const isSelected = selected?.id === r.id

      // 카테고리 → 이모지 매핑 (간단)
      const cat = (r.category || '').toLowerCase()
      const emoji = cat.includes('beauty') ? '💇'
        : cat.includes('health') ? '💪'
        : cat.includes('pet') ? '🐶'
        : cat.includes('stay') ? '🏨'
        : cat.includes('activity') ? '🎯'
        : '🍽️' // default: 식사

      const groupKey = `${r.restaurant_lat.toFixed(5)}_${r.restaurant_lng.toFixed(5)}`
      const groupSize = coordGroupSize.get(groupKey) || 1
      // 동그라미 핀 우상단에 작은 배지 (LIVE > 할인 > 즐겨찾기 > 그룹 +N 우선순위)
      const cornerBadge = isLive
        ? `<span style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:14px;height:14px;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;animation:live-pulse 1.2s infinite;">●</span>`
        : hasDiscount
        ? `<span style="position:absolute;top:-6px;right:-8px;background:#ef4444;color:#fff;border-radius:8px;padding:1px 4px;font-size:9px;font-weight:800;line-height:1.2;">-${Math.round((1 - r.price / r.original_price) * 100)}%</span>`
        : isFav
        ? `<span style="position:absolute;top:-3px;right:-3px;color:#ef4444;font-size:11px;line-height:1;">❤</span>`
        : groupSize > 1
        ? `<span style="position:absolute;top:-4px;right:-6px;background:#3b82f6;color:#fff;border-radius:9px;padding:0 4px;font-size:9px;font-weight:800;line-height:1.4;">+${groupSize - 1}</span>`
        : ''

      // 색상: 선택됨 > LIVE > 일반
      const bg = isSelected ? '#ec4899' : isLive ? '#fff5f5' : '#ffffff'
      const borderColor = isSelected ? '#ec4899' : isLive ? '#ef4444' : '#e5e7eb'
      const size = isSelected ? 36 : 32

      const content = document.createElement('div')
      content.innerHTML = `
        <div style="
          background: ${bg};
          border: 2px solid ${borderColor};
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          font-size: ${isSelected ? 18 : 16}px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
          cursor: pointer;
          transform: translate(-50%, -50%) scale(${isSelected ? 1.05 : 1});
          transition: transform 0.15s, background 0.15s;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        ">
          <span style="filter:${isSelected ? 'brightness(0) invert(1)' : 'none'};">${emoji}</span>
          ${cornerBadge}
        </div>
      `
      content.addEventListener('click', () => {
        setSelected(r)
        mapInstance.current.panTo(pos)
      })

      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 0.5,
        xAnchor: 0.5,
        map: mapInstance.current,
      })
      overlaysRef.current.push(overlay)
    })

    // 🛡️ 2026-04-28: 옵션 B — 카카오 일반 맛집 회색 핀 (식사권 미출시 표시)
    kakaoPlaces.forEach(p => {
      const lat = Number(p.y), lng = Number(p.x)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const safeName = escapeHtml(p.place_name || '')
      const grayContent = document.createElement('div')
      grayContent.innerHTML = `
        <div style="
          background: rgba(255,255,255,0.92);
          color: #6b7280;
          border: 1.5px dashed #d1d5db;
          border-radius: 10px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          cursor: pointer;
          transform: translateY(-50%);
        ">
          ${safeName}
          <span style="color:#9ca3af; margin-left:3px; font-size:9px;">+</span>
        </div>
      `
      grayContent.addEventListener('click', () => setSuggestionFor(p))
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(lat, lng),
        content: grayContent,
        yAnchor: 1.3,
        zIndex: 1, // 식사권 핀 (default 2) 보다 아래
        map: mapInstance.current,
      })
      overlaysRef.current.push(overlay)
    })

    // 범위 맞추기 (식사권 우선, 없으면 일반 맛집)
    if (withCoords.length > 1) {
      const bounds = new window.kakao.maps.LatLngBounds()
      withCoords.forEach(r => bounds.extend(new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)))
      mapInstance.current.setBounds(bounds)
    } else if (withCoords.length === 1) {
      mapInstance.current.setCenter(new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng))
      mapInstance.current.setLevel(5)
    } else if (kakaoPlaces.length > 0 && userLoc) {
      // 식사권 0건 → 사용자 위치 중심으로
      mapInstance.current.setCenter(new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng))
      mapInstance.current.setLevel(4)
    }
  }, [sdkLoaded, withCoords, selected?.id, kakaoPlaces, userLoc, liveSellerIds, favorites, coordGroupSize, mapLevel])

  useEffect(() => { initMap() }, [initMap])

  // 🛡️ 2026-04-30: Kakao 맵 인스턴스 cleanup — 페이지 unmount 시 오버레이 / 줌 리스너 해제.
  //   memory leak 방지 (Kakao SDK global 이 React 컴포넌트 closure 를 잡고 있음).
  useEffect(() => {
    return () => {
      try {
        overlaysRef.current.forEach(o => o.setMap?.(null))
        overlaysRef.current = []
        markersRef.current.forEach(m => m.setMap?.(null))
        markersRef.current = []
        if (mapInstance.current && window.kakao?.maps?.event) {
          // Kakao 는 listener 해제용 ref 가 없어 removeListener(target, type) 패턴
          //   타겟 자체를 GC 가능하게 mapInstance.current = null 만으로도 충분
        }
        mapInstance.current = null
      } catch { /* ignore */ }
    }
  }, [])

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
  const sheetTopByState: Record<typeof sheetSnap, string> = {
    peek: 'calc(100vh - 28vh)',
    mid: 'calc(100vh - 60vh)',
    full: 'calc(100vh - 92vh)',
  }

  return (
    <div className="relative h-screen w-full bg-gray-100 overflow-hidden pb-16">
      <SEO title="맛집 지도" description="유어딜 바우처 사용 가능 맛집을 지도에서 찾아보세요. 인플루언서 추천 맛집 최대 70% 할인" url="/restaurant-map" />

      {/* ═══ 풀스크린 카카오맵 (배경) ═══
          🛡️ 2026-04-30 CLS: mapRef 컨테이너 항상 렌더 → SDK load 시 placeholder
            swap 없이 inset-0 에 카카오맵이 그려짐. layout shift 0. */}
      <div ref={mapRef} className="absolute inset-0 bg-gray-100" />
      {!(sdkLoaded && window.kakao?.maps) && (
        <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center pointer-events-none">
          <MapPin className="w-12 h-12 text-gray-300 mb-3" />
          {sdkError ? (
            <>
              <p className="text-sm text-gray-500 font-medium">지도를 불러올 수 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">아래 시트에서 맛집을 확인하세요</p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 font-medium">지도를 불러오는 중...</p>
              <p className="text-xs text-gray-400 mt-1">카카오맵 SDK 로딩 중</p>
            </>
          )}
        </div>
      )}

      {/* ═══ 상단 floating glass 검색바 ═══ */}
      <div className="absolute top-0 left-0 right-0 z-40 px-3 pt-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/95 backdrop-blur-md shadow-md shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') { pushSearchHistory(search); (e.target as HTMLInputElement).blur() } }}
              placeholder="맛집 이름·지역 검색"
              aria-label="검색"
              className="w-full pl-10 pr-9 py-2.5 bg-white/95 backdrop-blur-md rounded-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-md"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="검색어 지우기" className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            {/* 🛡️ Phase 5: 검색 히스토리 dropdown — focus 시 + 입력값 비어있을 때만 */}
            {searchFocused && !search && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-10">
                <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">최근 검색</span>
                  <button
                    onClick={() => { setSearchHistory([]); storage.setJSON('restaurant_search_history', []) }}
                    className="text-[11px] text-gray-400 hover:text-gray-600"
                  >
                    전체 삭제
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchHistory.map((q) => (
                    <button
                      key={q}
                      onMouseDown={(e) => { e.preventDefault(); setSearch(q); pushSearchHistory(q) }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Search className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 선택된 맛집 카드 (지도 위 floating, sheet peek 일 때만 표시) ═══ */}
      {selected && sheetSnap === 'peek' && (
        <div className="absolute left-3 right-3 z-30" style={{ bottom: 'calc(18vh + 80px)' }}>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3.5 relative">
            <button onClick={() => setSelected(null)} aria-label="닫기" className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <div className="flex gap-3 pr-6">
              {selected.image_url ? (
                <img src={selected.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" loading="lazy" decoding="async" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                  <span className="text-xl">🍽️</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="truncate">{selected.restaurant_name}</span>
                  {selected.seller_id && liveSellerIds.has(selected.seller_id) && (
                    <span className="inline-flex items-center gap-0.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                      <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                    </span>
                  )}
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-base font-extrabold text-gray-900">{selected.price?.toLocaleString()}원</span>
                  {selected.original_price > selected.price && (
                    <span className="text-[10px] bg-red-500 text-white font-bold px-1 py-0.5 rounded">
                      -{Math.round((1 - selected.price / selected.original_price) * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/products/${selected.id}`)}
                className="self-center px-3 py-2 bg-pink-500 text-white text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-transform"
              >
                구매
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bottom Sheet (드래그 가능, 3-snap) ═══
          🛡️ 2026-04-30 v2: 실시간 드래그 팔로잉 — translateY 로 손가락 따라가기.
          dragDeltaY 가 양수면 아래로 (시트 축소), 음수면 위로 (시트 확장). */}
      <div
        className="absolute left-0 right-0 bottom-0 z-30 bg-white rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] flex flex-col"
        style={{
          top: sheetTopByState[sheetSnap],
          transform: dragStartY.current != null ? `translateY(${Math.max(-200, Math.min(400, dragDeltaY))}px)` : 'none',
          transition: dragStartY.current == null ? 'top 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        }}
        role="dialog"
        aria-label="맛집 목록"
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
          aria-label="시트 크기 조절"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={sheetSnap === 'peek' ? 0 : sheetSnap === 'mid' ? 1 : 2}
          tabIndex={0}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Sticky filter row + count + sort */}
        <div className="px-3 pb-2 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterSheetOpen(true)}
              aria-label="지역·카테고리 필터 열기"
              className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold shrink-0 transition-all ${
                activeFilterCount > 0
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/25 text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar">
              {/* 🛡️ Phase 5: '내 주변' 퀵필터 — GPS prompt + 거리순 자동 */}
              <button
                onClick={requestNearMe}
                aria-pressed={nearMeMode}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold shrink-0 transition-all ${
                  nearMeMode
                    ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                    : 'bg-pink-50 text-pink-600 border border-pink-200'
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span>내 주변</span>
              </button>
              {[
                { key: 'all', label: '전체', emoji: '✨' },
                { key: 'meal_voucher', label: '식사', emoji: '🍽️' },
                { key: 'beauty_voucher', label: '뷰티', emoji: '💇' },
                { key: 'health_voucher', label: '헬스', emoji: '💪' },
                { key: 'pet_voucher', label: '반려', emoji: '🐶' },
                { key: 'stay_voucher', label: '숙박', emoji: '🏨' },
                { key: 'activity_voucher', label: '액티비티', emoji: '🎯' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setVoucherType(t.key as typeof voucherType)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold shrink-0 transition-all ${
                    voucherType === t.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500">
                <span className="font-bold text-gray-900">{filtered.length}</span>곳
                {userLoc && sortBy === 'distance' && <span className="ml-1 text-pink-500">📍 내 위치 기준</span>}
              </span>
              {favorites.length > 0 && (
                <button
                  onClick={() => setShowFavoritesOnly(v => !v)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                    showFavoritesOnly
                      ? 'bg-pink-500 text-white border-pink-500'
                      : 'bg-white text-pink-500 border-pink-200'
                  }`}
                >
                  <Heart className="w-2.5 h-2.5" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
                  {favorites.length}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                aria-label="정렬"
                className="text-[12px] font-semibold text-gray-700 bg-transparent focus:outline-none"
              >
                {userLoc && <option value="distance">거리순</option>}
                <option value="discount">할인율순</option>
                <option value="price">가격 낮은순</option>
                <option value="rating">평점순</option>
              </select>
            </div>
          </div>
        </div>

        {/* ═══ 시트 안 스크롤 가능한 결과 리스트 ═══ */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-24" style={{ overscrollBehavior: 'contain' }}>
          {selected && (
            /* 선택된 맛집 디테일 카드 (sheet mid/full 일 때 list 위에 표시) */
            <div className="bg-pink-50 border-2 border-pink-300 rounded-2xl p-4 mb-3 relative">
              <button onClick={() => setSelected(null)} aria-label="선택 해제" className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-white/80">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <div className="flex gap-3 pr-6">
                {selected.image_url ? (
                  <img src={selected.image_url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-white flex items-center justify-center shrink-0">
                    <span className="text-2xl">🍽️</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-[15px] flex items-center gap-1.5">
                    <span className="truncate">{selected.restaurant_name}</span>
                    {selected.seller_id && liveSellerIds.has(selected.seller_id) && (
                      <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                        <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {selected.restaurant_address}
                    {userLoc && selected.restaurant_lat && selected.restaurant_lng && (
                      <span className="ml-1 font-semibold text-pink-500">
                        · {distanceKm(userLoc.lat, userLoc.lng, selected.restaurant_lat, selected.restaurant_lng).toFixed(1)}km
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg font-extrabold text-gray-900">{selected.price?.toLocaleString()}원</span>
                    {selected.original_price > selected.price && (
                      <>
                        <span className="text-xs text-gray-400 line-through">{formatNumber(selected.original_price)}원</span>
                        <span className="text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md">
                          -{Math.round((1 - selected.price / selected.original_price) * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => toggleFavorite(selected.id)}
                  aria-label={favorites.includes(selected.id) ? '즐겨찾기 해제' : '즐겨찾기'}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                    favorites.includes(selected.id) ? 'bg-pink-100 text-pink-500' : 'bg-white text-gray-400'
                  }`}
                >
                  <Heart className="w-4 h-4" fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />
                </button>
                {selected.restaurant_phone && (
                  <a href={`tel:${selected.restaurant_phone}`} aria-label="전화" className="flex items-center justify-center w-10 h-10 bg-white rounded-xl text-gray-700">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {selected.restaurant_lat && selected.restaurant_lng && (
                  <a
                    href={kakaoDirectionsUrl(selected)}
                    target="_blank" rel="noopener noreferrer"
                    aria-label="카카오맵 길찾기"
                    className="flex items-center justify-center gap-1 px-3 h-10 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold"
                  >
                    <Navigation className="w-3.5 h-3.5" /> 길찾기
                  </a>
                )}
                <button
                  onClick={() => navigate(`/products/${selected.id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 bg-pink-500 text-white rounded-xl text-sm font-bold active:scale-[0.97] transition-transform"
                >
                  <Ticket className="w-4 h-4" /> 바우처 구매
                </button>
              </div>
            </div>
          )}

          {/* 🛡️ 2026-04-30 Phase 3: hero carousel — 할인율 TOP5 (선택 카드 없을 때만) */}
          {!loading && !selected && heroDeals.length > 0 && (
            <div className="mb-3 -mx-3 px-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <span className="text-amber-500">⚡</span> 오늘의 핫딜
                </p>
                <span className="text-[10px] text-gray-400">{heroDeals.length}곳</span>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {heroDeals.map(r => {
                  const discount = Math.round((1 - r.price / r.original_price) * 100)
                  return (
                    <button
                      key={`hero-${r.id}`}
                      onClick={() => selectAndPan(r)}
                      className="shrink-0 w-[140px] rounded-2xl bg-white border border-gray-100 overflow-hidden text-left active:scale-[0.97] transition-transform"
                    >
                      <div className="relative aspect-square bg-pink-50">
                        {r.image_url ? (
                          <img src={r.image_url} alt="" loading="lazy" decoding="async"
                            className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><span className="text-3xl">🍽️</span></div>
                        )}
                        <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                          -{discount}%
                        </span>
                        {r.seller_id && liveSellerIds.has(r.seller_id) && (
                          <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                            <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] font-bold text-gray-900 truncate">{r.restaurant_name}</p>
                        <p className="text-[10px] text-gray-400 truncate flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {userLoc && r.restaurant_lat && r.restaurant_lng
                            ? `${distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng).toFixed(1)}km`
                            : (r.restaurant_address || '주소 미등록')}
                        </p>
                        <p className="text-[12px] font-extrabold text-gray-900 mt-1">{r.price?.toLocaleString()}원</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {loading ? (
              /* 🛡️ 2026-04-30 CLS: 단일 스피너 → 카드 skeleton 으로 교체.
                 실제 결과 카드와 같은 높이 (90px) 를 유지해 layout shift 0 */
              <div className="space-y-3 pb-8" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3.5 rounded-2xl bg-white border border-gray-100">
                    <div className="w-[72px] h-[72px] rounded-xl bg-gray-100 animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                      <div className="h-3.5 w-2/3 rounded bg-gray-100 animate-pulse" />
                      <div className="h-3 w-4/5 rounded bg-gray-100 animate-pulse" />
                      <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <MapPin className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-900 font-bold">맛집을 찾지 못했어요</p>
                <p className="text-sm text-gray-400 mt-1">다른 지역이나 검색어를 시도해보세요</p>
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {filtered.map(r => {
                  const discount = r.original_price > r.price ? Math.round((1 - r.price / r.original_price) * 100) : 0
                  return (
                    <button
                      key={r.id}
                      onClick={() => selectAndPan(r)}
                      className={`w-full flex gap-3 p-3.5 rounded-2xl text-left transition-all ${
                        selected?.id === r.id
                          ? 'bg-pink-50 border-2 border-pink-300 shadow-sm'
                          : 'bg-white border border-gray-100 hover:shadow-md'
                      }`}
                    >
                      {r.image_url ? (
                        <img src={r.image_url} alt="" className="w-[72px] h-[72px] rounded-xl object-cover shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-[72px] h-[72px] rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                          <span className="text-2xl">🍽️</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-gray-900 text-sm truncate">{r.restaurant_name}</p>
                          {discount > 0 && (
                            <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md shrink-0">
                              -{discount}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {r.restaurant_address || '주소 미등록'}
                          {userLoc && r.restaurant_lat && r.restaurant_lng && (
                            <span className="ml-1 font-semibold text-pink-500 shrink-0">
                              · {distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng).toFixed(1)}km
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{r.name}</p>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-base font-extrabold text-gray-900">{r.price?.toLocaleString()}원</span>
                          {r.original_price > r.price && (
                            <span className="text-xs text-gray-400 line-through">{formatNumber(r.original_price)}원</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/products/${r.id}`) }}
                        className="self-center px-3.5 py-2 bg-pink-500 text-white text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-transform"
                      >
                        구매
                      </button>
                    </button>
                  )
                })}
              </div>
            )}
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

// ── 지역 + 카테고리 필터 시트 (mobile bottom sheet)
function FilterSheet({
  region: initialRegion, category: initialCategory, onApply, onClose,
}: {
  region: string; category: string;
  onApply: (region: string, category: string) => void;
  onClose: () => void;
}) {
  useEscapeKey(onClose)
  const [r, setR] = useState(initialRegion)
  const [c, setC] = useState(initialCategory)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose} role="presentation">
      <div
        className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="필터 설정"
      >
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">필터</h3>
          <button
            onClick={() => { setR(''); setC('') }}
            className="text-xs font-semibold text-gray-500"
            aria-label="필터 초기화"
          >
            초기화
          </button>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">지역</p>
            <div className="grid grid-cols-3 gap-2">
              {REGIONS.map(reg => (
                <button
                  key={reg.key}
                  onClick={() => setR(reg.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    r === reg.key
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                      : 'bg-gray-50 text-gray-700 border border-gray-200'
                  }`}
                >
                  <span>{reg.emoji}</span>
                  <span>{reg.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">카테고리</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key || 'all'}
                  onClick={() => setC(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    c === cat.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 text-gray-700 border border-gray-200'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => onApply(r, c)}
            className="w-full py-3.5 bg-pink-500 text-white text-sm font-bold rounded-2xl active:scale-[0.98] transition-transform"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 일반 맛집 클릭 시 모달 — 알림/영입 신청 + 길찾기 ─────────────────
function SuggestionModal({ place, onClose }: { place: KakaoPlace; onClose: () => void }) {
  useEscapeKey(onClose)
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'invite' | 'notify' | null>(null)

  async function submit(kind: 'invite' | 'notify') {
    if (kind === 'notify' && !/^010-?\d{3,4}-?\d{4}$/.test(phone.replace(/-/g, ''))) {
      toast.error('전화번호 형식: 010-0000-0000')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/api/restaurant-suggestions', {
        kakao_place_id: place.id,
        place_name: place.place_name,
        category_name: place.category_name,
        road_address: place.road_address_name || place.address_name,
        phone: place.phone,
        lat: Number(place.y),
        lng: Number(place.x),
        kind,
        user_phone: kind === 'notify' ? phone.replace(/-/g, '') : undefined,
      })
      if (res.data?.success) {
        setDone(kind)
        toast.success(kind === 'notify' ? '출시 시 알림드릴게요!' : '영입 신청 완료!')
      } else {
        toast.error(res.data?.error || '신청 실패')
      }
    } catch {
      toast.error('네트워크 오류')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose} role="presentation">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${place.place_name} 추천 보내기`}>
        <div>
          <p className="text-xs text-gray-500">{place.category_name?.split('>').slice(-1)[0]?.trim() || '맛집'}</p>
          <h3 className="text-lg font-bold text-gray-900">{place.place_name}</h3>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {place.road_address_name || place.address_name}
            {place.distance && <span className="ml-1 text-pink-500">· {Math.round(Number(place.distance))}m</span>}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
          ⓘ 이 매장은 <strong>아직 식사권이 출시되지 않았어요</strong>. 출시되면 알려드릴까요?
        </div>

        {done === 'notify' ? (
          <div className="text-center py-2 text-sm text-green-600 font-bold">✅ 출시 시 {phone} 로 알림드릴게요!</div>
        ) : done === 'invite' ? (
          <div className="text-center py-2 text-sm text-green-600 font-bold">✅ 영입 신청이 어드민에 전달됐어요!</div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">📨 출시 알림 받기 (선택)</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-400 focus:outline-none"
                />
                <button
                  onClick={() => submit('notify')}
                  disabled={submitting || !phone.trim()}
                  className="px-4 py-2.5 bg-pink-500 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                >알림</button>
              </div>
            </div>

            <button
              onClick={() => submit('invite')}
              disabled={submitting}
              className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-xl disabled:opacity-50"
            >
              🤝 이 매장 셀러 영입 신청
            </button>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <a
            href={`https://map.kakao.com/link/to/${encodeURIComponent(place.place_name)},${place.y},${place.x}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold"
          >
            <Navigation className="w-4 h-4" /> 카카오맵 길찾기
          </a>
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">닫기</button>
        </div>
      </div>
    </div>
  )
}
