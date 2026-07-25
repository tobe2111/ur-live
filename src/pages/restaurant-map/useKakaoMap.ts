import { useRef, useState, useCallback, useEffect } from 'react'
import { distanceKm } from './utils'
import { buildAggContent, buildClusterContent, buildPinContent, buildPlaceContent, buildMeContent } from './map-overlays'
import type { Restaurant, KakaoPlace } from './types'

// 🗺️ 2026-06-22 (대표 — "중앙 기준이 하단 시트 크기에 따라 달라진다"): 선택 핀을 *보이는 지도 영역*
//   (상단 검색바 아래 ~ 하단 시트 위)의 중앙으로 끌어올릴 px 오프셋을 시트 snap 별로 동적 계산.
//   ⚠️ 시트 snap top 설계값은 useSheetDrag.ts(SHEET_SNAP_TRANSLATE 주석)와 미러 — 그쪽 변경 시 함께 갱신.
const SHEET_TOP_SEARCH_INSET = 76 // 상단 floating glass 검색바 대략 높이(px)
function centerOffsetForSheet(snap: 'peek' | 'mid' | 'full' | 'card'): number {
  if (typeof window === 'undefined') return 150
  const H = window.innerHeight
  const isLg = !!window.matchMedia?.('(min-width: 1024px)').matches
  // 시트 top(px) = 시트가 가리기 시작하는 y. 이 위가 보이는 지도 영역.
  const sheetTop =
    snap === 'card' ? H - 210 // 야놀자식 납작한 선택 카드(~132px + 하단 네비 + 여백)
    : snap === 'peek' ? H - 240 // calc(100dvh - 240px) — 2026-06-22 하단 섹션 축소

    : snap === 'mid' ? (isLg ? H * 0.6 : H * 0.4) // calc(100dvh - 40dvh/60dvh)
    // 🗺️ 2026-07-25 (전수조사 L3): full 모바일은 safe-area+104px 고정(useSheetDrag SHEET_BASE_TOP) —
    //   옛 92dvh 기준(H*0.08) 잔재를 실제값 104px 로 정합(safe-area 는 수십 px 라 근사 무해).
    : (isLg ? H * 0.2 : 104)
  const visibleCenter = (SHEET_TOP_SEARCH_INSET + sheetTop) / 2
  // 양수 = 핀을 기하학적 중앙(H/2)에서 이만큼 위로 끌어올림 → 보이는 영역 중앙에 위치.
  return Math.max(0, H / 2 - visibleCenter)
}

/** 🌍 2026-07-08 (레이어 3): 서버 집계 셀 — 줌아웃에선 개별 딜 대신 격자별 개수·최저가·대표사진만 렌더. */
export interface ServerCluster {
  lat: number
  lng: number
  count: number
  min_price: number
  image_url: string | null
}

interface UseKakaoMapParams {
  kr: boolean
  /** 리스트 모드 등 지도를 안 쓰는 화면에선 false → Kakao SDK 미로드(홈 피드 perf). */
  enabled?: boolean
  withCoords: Restaurant[]
  coordGroupSize: Map<string, number>
  selected: Restaurant | null
  setSelected: (r: Restaurant | null) => void
  kakaoPlaces: KakaoPlace[]
  setSuggestionFor: (p: KakaoPlace | null) => void
  userLoc: { lat: number; lng: number } | null
  liveSellerIds: Set<number>
  favorites: number[]
  /** 현재 바텀시트 snap — 핀 클릭 시 보이는 영역 중앙 오프셋 계산에 사용. */
  sheetSnap?: 'peek' | 'mid' | 'full'
  /** 🌍 줌아웃 시 서버 집계(레이어 3). non-null·비어있지 않으면 개별 핀 대신 이것만 렌더. */
  serverClusters?: ServerCluster[] | null
}

export function useKakaoMap({
  kr,
  enabled = true,
  withCoords,
  coordGroupSize,
  selected,
  setSelected,
  kakaoPlaces,
  setSuggestionFor,
  userLoc,
  liveSellerIds,
  favorites,
  sheetSnap = 'peek',
  serverClusters = null,
}: UseKakaoMapParams) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  // panToProduct 가 stale 없이 현재 snap 을 읽도록 ref 동기화(의존성 churn 방지 — panToProduct 는 stable).
  const sheetSnapRef = useRef(sheetSnap)
  sheetSnapRef.current = sheetSnap
  // 🗺️ 2026-07-25 (전수조사 H3): 오버레이는 [key → overlay] registry 로 유지·diff 재조정 —
  //   기존 '매 initMap 마다 전량 setMap(null)+재생성'(팬/줌/검색/즐겨찾기마다 innerHTML 파싱 + <img>
  //   재생성 → 핀 깜빡임/팬 종료 직후 버벅) 제거. 같은 key 는 무접촉, 빠진 key 만 제거, 새 key 만 생성.
  const overlayRegistryRef = useRef(new Map<string, any>())
  // ⚡ 2026-07-08 (대표 "매장 많아지니 렉" — 레이어 1/4): 선택 변경은 전량 재빌드 대신 해당 핀만 직접 restyle.
  //   initMap 은 selectedIdRef 로 현재값만 읽고(의존성 X), 별도 effect 가 registry 의 DOM 을 갱신.
  const selectedIdRef = useRef<number | null>(null)
  selectedIdRef.current = selected?.id ?? null
  const pinElsRef = useRef(new Map<number, HTMLElement>())
  // ⚡ 뷰포트 컬링: 지도 idle(이동/줌 멈춤)마다 rev 를 올려 보이는 영역만 다시 그림(diff 라 무변경 핀은 무접촉).
  const [viewportRev, setViewportRev] = useState(0)
  // 🛡️ 2026-06-20 (대표 — 줌 전수조사): 초기 fit(setBounds/setLevel)은 데이터 로드 후 '한 번만'.
  //   기존엔 initMap 의존성에 mapLevel 이 있어 zoom_changed→setMapLevel→initMap 재실행→fit 재호출로
  //   매 줌마다 setLevel(5)/setBounds 가 사용자 줌을 원위치시켜 "줌이 안 먹는" 근본 원인이었음.
  const didInitialFit = useRef(false)

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState(false)
  // 🗺️ 2026-07-25 (전수조사 M3): mapLevel state + zoom_changed 리스너 제거 — 핀치 중 zoom_changed 가
  //   여러 번 발화해 매번 페이지 전체 리렌더를 일으켰음. 클러스터 gridSize 는 initMap 안에서
  //   map.getLevel() 로 직접 계산(idle → viewportRev 가 이미 initMap 을 재실행하므로 상태 불필요).

  // SDK loading — 🗺️ 2026-07-25 (전수조사 L1): deps 에 enabled 포함(리스트→지도 모드 전환 시 로드 보장).
  useEffect(() => {
    if (!kr || !enabled) {
      setSdkLoaded(false)
      return
    }
    import('@/lib/kakao-sdk').then(({ ensureKakaoMaps }) => {
      ensureKakaoMaps()
        .then(() => setSdkLoaded(true))
        .catch((e) => {
          if (import.meta.env.DEV) console.error('[RestaurantMap] Kakao Maps load failed:', e)
          setSdkLoaded(false)
          setSdkError(true)
        })
    })
  }, [kr, enabled])

  // 🗺️ 2026-06-22 (대표 — "공구 상품을 누르면 지도 한가운데로" + "중앙 기준이 시트 크기 따라 달라짐"):
  //   선택 상품이 *보이는 지도 영역*의 중앙에 오도록 pan. 하단 바텀시트가 화면 아래를 가리므로 단순
  //   panTo(기하학적 중앙)만 하면 핀이 시트 근처(아래쪽)에 박힘. projection 으로 중심좌표를 남쪽으로 옮겨
  //   핀을 위로 끌어올림 → 시각적 중앙 배치. 오프셋은 시트 snap(현재 또는 호출자 지정)에 따라 동적 계산.
  //   projection 미지원/실패 시 plain panTo 폴백.
  const panToProduct = useCallback((lat: number, lng: number, level?: number, snap?: 'peek' | 'mid' | 'full' | 'card') => {
    const map = mapInstance.current
    if (!map || !window.kakao?.maps || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    if (typeof level === 'number') map.setLevel(level)
    const latlng = new window.kakao.maps.LatLng(lat, lng)
    const offsetY = centerOffsetForSheet(snap ?? sheetSnapRef.current)
    try {
      const proj = map.getProjection()
      const pt = proj.pointFromCoords(latlng)
      const offsetCenter = proj.coordsFromPoint(new window.kakao.maps.Point(pt.x, pt.y + offsetY))
      map.panTo(offsetCenter)
    } catch {
      map.panTo(latlng)
    }
  }, [])

  const initMap = useCallback(() => {
    if (!sdkLoaded || !mapRef.current || !window.kakao?.maps) return

    // 🏘️ 생성 시점 중심 = 내 위치(캐시 포함) 우선 → 데이터 도착 전에도 첫 프레임부터 내 동네(점프 없음).
    const center = (userLoc && Number.isFinite(userLoc.lat) && Number.isFinite(userLoc.lng))
      ? new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng)
      : withCoords.length > 0
      ? new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng)
      : new window.kakao.maps.LatLng(37.5665, 126.978)

    if (!mapInstance.current) {
      mapInstance.current = new window.kakao.maps.Map(mapRef.current, {
        center,
        level: 7,
        // 🛡️ 2026-06-20 (대표 신고 — 스크롤/핀치 줌 잘 안됨): Kakao 네이티브 스크롤휠 줌 명시 활성화.
        //   기존 커스텀 wheel 핸들러(capture+stopImmediatePropagation, 1레벨/tick)가 네이티브 부드러운
        //   커서기준 줌·트랙패드 핀치를 가로채 오히려 뻑뻑했음 → 제거하고 네이티브에 위임.
        scrollwheel: true,
      })
      // 🛡️ 2026-05-16: 명시적 줌/팬 활성화 — 기본값이지만 명시로 안전
      mapInstance.current.setDraggable(true)
      mapInstance.current.setZoomable(true)
      // 🛡️ 2026-05-17: 줌 레벨 명시 — 너무 깊거나 얕은 줌 차단
      mapInstance.current.setMinLevel(1)
      mapInstance.current.setMaxLevel(14)
      // 🛡️ 2026-06-20 (대표 — "버튼과 줌 슬라이더 계속 겹침"): Kakao ZoomControl(+/− 슬라이더) 제거.
      //   스크롤휠·핀치·더블클릭 줌은 그대로 동작(setZoomable+scrollwheel) → 슬라이더 없어도 줌 가능 + 겹침 해소.
      // 🗺️ 2026-07-25 (M3): zoom_changed 리스너 제거 — 핀치 도중 리렌더 0. 레벨 반영은 idle(아래)로 충분.
      // ⚡ 2026-07-08 (레이어 1 — 뷰포트 컬링): 이동/줌 멈춤(idle)마다 보이는 영역 기준으로 다시 그림.
      window.kakao.maps.event.addListener(mapInstance.current, 'idle', () => {
        setViewportRev(v => v + 1)
      })
      // 🛡️ 2026-06-20: 커스텀 wheel 핸들러 제거 — 네이티브 scrollwheel 줌(위 옵션)에 위임(커서기준·트랙패드 핀치 부드럽게).
    }

    // 🗺️ 2026-07-25 (M3): 클러스터 gridSize 는 현재 줌 레벨에서 직접 계산(state 경유 X — 핀치 중 리렌더 0).
    const level: number = mapInstance.current.getLevel?.() ?? 7
    const gridSize = level <= 3 ? 0 : level <= 5 ? 0.001 : level <= 7 ? 0.005 : 0.02

    // 🌍 레이어 3 — 줌아웃 서버 집계 모드: 페이지가 집계를 내려주면 개별 핀/로컬 클러스터 대신 집계 버블만.
    //   전국 뷰에서도 오버레이 수가 격자 수(수십 개)로 고정 → 매장 수만 개여도 지도 가벼움.
    const aggMode = !!(serverClusters && serverClusters.length > 0)

    // 🗺️ 2026-07-25 (H3): 이번 렌더에서 '있어야 할' 오버레이를 [key → 생성자]로 수집한 뒤 registry 와 diff.
    const desired = new Map<string, () => any>()

    // ⚡ 레이어 1 — 뷰포트 컬링: 보이는 지도 영역(+35% 마진)의 딜만 오버레이 생성.
    //   맵 생성 직후(bounds 미확정 첫 run)엔 전체 렌더 → 곧 idle 이 재컬링. 컬링 후 회당 수십 개 = 저렴.
    let visible = withCoords
    if (!aggMode) {
      try {
        const b = mapInstance.current.getBounds()
        if (b) {
          const sw = b.getSouthWest(), ne = b.getNorthEast()
          const mLat = (ne.getLat() - sw.getLat()) * 0.35
          const mLng = (ne.getLng() - sw.getLng()) * 0.35
          const lo = sw.getLat() - mLat, hi = ne.getLat() + mLat
          const lo2 = sw.getLng() - mLng, hi2 = ne.getLng() + mLng
          visible = withCoords.filter(r => r.restaurant_lat >= lo && r.restaurant_lat <= hi && r.restaurant_lng >= lo2 && r.restaurant_lng <= hi2)
        }
      } catch { /* bounds 실패 — 전체 렌더 폴백 */ }
    }

    // 🌍 서버 집계 버블 (클러스터 시안 ③과 동일 비주얼 — 사진+카운트+최저가)
    if (aggMode) {
      for (const sc of serverClusters!) {
        if (!Number.isFinite(sc.lat) || !Number.isFinite(sc.lng)) continue
        const key = `agg:${sc.lat.toFixed(4)},${sc.lng.toFixed(4)}:${sc.count}:${sc.min_price}`
        desired.set(key, () => {
          const aPos = new window.kakao.maps.LatLng(sc.lat, sc.lng)
          const aContent = buildAggContent(sc)
          aContent.addEventListener('click', () => {
            if (mapInstance.current) {
              mapInstance.current.panTo(aPos)
              mapInstance.current.setLevel(Math.max(1, mapInstance.current.getLevel() - 2))
            }
          })
          return new window.kakao.maps.CustomOverlay({
            position: aPos, content: aContent, yAnchor: 0.5, xAnchor: 0.5, zIndex: 5, map: mapInstance.current,
          })
        })
      }
    }

    const clusters = new Map<string, Restaurant[]>()
    if (!aggMode && gridSize > 0) {
      visible.forEach(r => {
        const gx = Math.floor(r.restaurant_lng / gridSize)
        const gy = Math.floor(r.restaurant_lat / gridSize)
        const key = `${gx}_${gy}`
        if (!clusters.has(key)) clusters.set(key, [])
        clusters.get(key)!.push(r)
      })
    }

    if (!aggMode && gridSize > 0) {
      clusters.forEach((items, gkey) => {
        if (items.length < 2) return
        const minPrice = Math.min(...items.map(x => x.price || 0))
        const cRep = items.find(x => x.image_url) || items[0]
        // gridSize(줌 구간)를 key 에 포함 — 구간 전환 시에만 클러스터 교체(같은 구간 팬은 무접촉).
        const key = `cl:${gridSize}:${gkey}:${items.length}:${minPrice}:${cRep?.id ?? 0}`
        desired.set(key, () => {
          const sumLat = items.reduce((s, x) => s + x.restaurant_lat, 0)
          const sumLng = items.reduce((s, x) => s + x.restaurant_lng, 0)
          const cPos = new window.kakao.maps.LatLng(sumLat / items.length, sumLng / items.length)
          const cContent = buildClusterContent(items, minPrice)
          cContent.addEventListener('click', () => {
            if (mapInstance.current) {
              mapInstance.current.panTo(cPos)
              mapInstance.current.setLevel(Math.max(1, mapInstance.current.getLevel() - 2))
            }
          })
          return new window.kakao.maps.CustomOverlay({
            position: cPos, content: cContent, yAnchor: 0.5, xAnchor: 0.5, zIndex: 5, map: mapInstance.current,
          })
        })
      })
    }

    const clusteredKeys = new Set<string>()
    if (!aggMode && gridSize > 0) {
      clusters.forEach((items, key) => {
        if (items.length >= 2) clusteredKeys.add(key)
      })
    }

    ;(aggMode ? [] : visible).forEach(r => {
      if (gridSize > 0) {
        const gx = Math.floor(r.restaurant_lng / gridSize)
        const gy = Math.floor(r.restaurant_lat / gridSize)
        if (clusteredKeys.has(`${gx}_${gy}`)) return
      }
      const isLive = r.seller_id ? liveSellerIds.has(r.seller_id) : false
      const isFav = favorites.includes(r.id)
      const groupKey = `${r.restaurant_lat.toFixed(5)}_${r.restaurant_lng.toFixed(5)}`
      const groupSize = coordGroupSize.get(groupKey) || 1
      // 배지에 영향 주는 값만 key 에 — 값이 같으면(팬/줌/검색 재실행) 기존 핀 무접촉(깜빡임 0, L4:
      //   즐겨찾기 토글도 해당 핀 1개만 교체). 선택 강조는 key 무관 — 아래 restyle effect 가 DOM 직접 갱신.
      const key = `pin:${r.id}:${isFav ? 1 : 0}:${groupSize}:${isLive ? 1 : 0}:${r.price ?? 0}`
      desired.set(key, () => {
        const pos = new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)
        const content = buildPinContent(r, { isLive, isFav, isSelected: selectedIdRef.current === r.id, groupSize })
        content.addEventListener('click', () => {
          setSelected(r)
          // 🗺️ 2026-06-22: 핀 클릭 시 납작한 선택 카드가 뜨므로 'card' 기준으로 넓은 지도 중앙에 배치. 줌 유지.
          panToProduct(r.restaurant_lat, r.restaurant_lng, undefined, 'card')
        })
        const overlay = new window.kakao.maps.CustomOverlay({
          position: pos, content, yAnchor: 0.5, xAnchor: 0.5, map: mapInstance.current,
        })
        // ⚡ 선택 restyle 용 registry — 핀 루트 div 기억(선택 변경 시 전량 재빌드 없이 이 노드만 갱신).
        const rootEl = content.firstElementChild as HTMLElement | null
        if (rootEl) pinElsRef.current.set(r.id, rootEl)
        return overlay
      })
    })

    kakaoPlaces.forEach(p => {
      const lat = Number(p.y), lng = Number(p.x)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const key = `kp:${p.id || `${p.x},${p.y}`}`
      desired.set(key, () => {
        const grayContent = buildPlaceContent(p)
        grayContent.addEventListener('click', () => setSuggestionFor(p))
        return new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(lat, lng),
          content: grayContent, yAnchor: 1.3, zIndex: 1, map: mapInstance.current,
        })
      })
    })

    // 🗺️ 2026-06-23 (대표 — 현위치): 내 위치 파란 점(GPS). userLoc 있을 때만.
    if (userLoc && Number.isFinite(userLoc.lat) && Number.isFinite(userLoc.lng)) {
      const key = `me:${userLoc.lat.toFixed(5)},${userLoc.lng.toFixed(5)}`
      desired.set(key, () => new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng),
        content: buildMeContent(), yAnchor: 0.5, xAnchor: 0.5, zIndex: 2, map: mapInstance.current,
      }))
    }

    // 🗺️ 2026-07-25 (H3): diff 재조정 — 빠진 key 만 제거, 새 key 만 생성, 같은 key 는 무접촉.
    //   팬/줌/검색 타이핑/즐겨찾기 토글에서 실제 변한 오버레이만 DOM 작업 → 핀 깜빡임·팬 종료 버벅 제거.
    const registry = overlayRegistryRef.current
    for (const [key, ov] of Array.from(registry)) {
      if (!desired.has(key)) {
        try { ov.setMap?.(null) } catch { /* silent */ }
        registry.delete(key)
        if (key.startsWith('pin:')) pinElsRef.current.delete(Number(key.split(':')[1]))
      }
    }
    desired.forEach((build, key) => {
      if (!registry.has(key)) {
        try { registry.set(key, build()) } catch { /* 개별 오버레이 실패가 지도 전체를 안 깨뜨리게 */ }
      }
    })

    // 🛡️ 2026-06-20 (대표 — 줌 전수조사): 초기 뷰 맞춤은 데이터가 처음 들어온 시점 '한 번만'.
    //   이후(줌/마커 재빌드)엔 절대 재-fit 안 함 → 사용자 줌/이동 보존.
    // 🏘️ 2026-07-08 (레이어 1 — 대표 "전국 다 보여서 렉"): 전국 setBounds → **내 동네 레벨**로 시작.
    //   내 위치(캐시 포함) 있으면 그 중심 level 6(동네·구), 없으면 가장 가까운/첫 딜 중심 level 7.
    //   전국 뷰는 사용자가 줌아웃하면 서버 집계(레이어 3)가 가볍게 커버.
    if (!didInitialFit.current) {
      // ⚠️ userLoc 분기도 딜 도착 후에만 확정 — 데이터 이전에 fit 을 확정하면 '가까운 딜 폴백'이 영영 안 돎.
      if (userLoc && Number.isFinite(userLoc.lat) && Number.isFinite(userLoc.lng) && withCoords.length > 0) {
        // 🏘️ 내 동네(level 6, 반경 ~3km)에 딜이 없으면 텅 빈 첫 화면 — 가장 가까운 딜까지 화면에 포함(자동 폴백).
        let nearest: Restaurant | null = null
        let nearestKm = Infinity
        for (const r of withCoords) {
          const d = distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng)
          if (d < nearestKm) { nearestKm = d; nearest = r }
        }
        if (nearest && nearestKm > 3) {
          const b = new window.kakao.maps.LatLngBounds()
          b.extend(new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng))
          b.extend(new window.kakao.maps.LatLng(nearest.restaurant_lat, nearest.restaurant_lng))
          mapInstance.current.setBounds(b)
        } else {
          mapInstance.current.setCenter(new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng))
          mapInstance.current.setLevel(6)
        }
        didInitialFit.current = true
      } else if (withCoords.length >= 1) {
        mapInstance.current.setCenter(new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng))
        mapInstance.current.setLevel(withCoords.length > 1 ? 7 : 5)
        didInitialFit.current = true
      } else if (kakaoPlaces.length > 0 && userLoc) {
        mapInstance.current.setCenter(new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng))
        mapInstance.current.setLevel(4)
        didInitialFit.current = true
      }
    }
    // ⚡ selected?.id 를 의존성에서 제거(핀 탭 = 전량 재빌드이던 렉 근본 원인) — 선택 반영은 아래 restyle effect.
    //   viewportRev(idle)·serverClusters 추가 — diff 재조정이라 재실행 비용은 '변한 오버레이'만.
    //   gridSize 는 initMap 내부에서 map.getLevel() 로 직접 계산(M3 — 상태 경유 X).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkLoaded, withCoords, kakaoPlaces, userLoc, liveSellerIds, favorites, coordGroupSize, setSelected, setSuggestionFor, panToProduct, viewportRev, serverClusters])

  useEffect(() => { initMap() }, [initMap])

  // ⚡ 2026-07-08 (레이어 4의 핫패스): 선택 변경 시 해당 핀 DOM 만 직접 restyle — 전량 재빌드 0.
  useEffect(() => {
    pinElsRef.current.forEach((el, id) => {
      const sel = selected?.id === id
      const size = sel ? 50 : 42
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.boxShadow = `0 4px 12px rgba(0,0,0,0.30)${sel ? ', 0 0 0 3px rgba(224,82,107,0.9)' : ''}`
      el.style.transform = `translate(-50%, -50%) scale(${sel ? 1.08 : 1})`
    })
  }, [selected?.id])

  useEffect(() => {
    return () => {
      try {
        overlayRegistryRef.current.forEach(o => o.setMap?.(null))
        overlayRegistryRef.current.clear()
        pinElsRef.current.clear()
        mapInstance.current = null
      } catch { /* ignore */ }
    }
  }, [])

  return { mapRef, mapInstance, sdkLoaded, sdkError, panToProduct }
}
