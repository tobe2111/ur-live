import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import { distanceKm } from './utils'
import { attachKakaoTouchShim } from '@/lib/kakao-touch-shim'
import { buildAggContent, buildClusterContent, buildPinContent, buildPlaceContent, buildMeContent, applyPinTierStyle } from './map-overlays'
import { mapMarkerTier, shouldShowMarkerLabel, setMapHighlightPct, mapHighlightPct } from '@/shared/map-marker'
import { priceDisplay } from '@/shared/price-display'
import { readRecentlyViewedIds } from '@/components/group-buy/RecentlyViewedStrip'
import type { Restaurant, KakaoPlace } from './types'
import { ensureKakaoMapsCore } from '@/lib/kakao-sdk'
import { injectMotionCss } from '@/lib/motion-css'
// 🎬 이 부품이 쓰는 움직임 CSS 만 — 불러올 때 한 번 꽂는다(lib/motion-css.ts 머리말)
injectMotionCss('ur-m-pin', `@keyframes ur-pin-pop { 0% { transform: scale(1); } 45% { transform: scale(1.22) translateY(-4px); } 100% { transform: scale(1); } }.ur-pin-pop { animation: ur-pin-pop .4s cubic-bezier(.3,1.4,.5,1); transform-origin: 50% 100%; }@media (prefers-reduced-motion: reduce){.ur-pin-pop{animation:none!important}}`)

// 🗺️ 2026-06-22 (대표 — "중앙 기준이 하단 시트 크기에 따라 달라진다"): 선택 핀을 *보이는 지도 영역*
//   (상단 검색바 아래 ~ 하단 시트 위)의 중앙으로 끌어올릴 px 오프셋을 시트 snap 별로 동적 계산.
//   ⚠️ 시트 snap top 설계값은 useSheetDrag.ts(SHEET_SNAP_TRANSLATE 주석)와 미러 — 그쪽 변경 시 함께 갱신.
const SHEET_TOP_SEARCH_INSET = 76 // 상단 floating glass 검색바 대략 높이(px)
function centerOffsetForSheet(snap: 'peek' | 'mid' | 'full' | 'card', mapH?: number): number {
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
  // 양수 = 핀을 지도 칸의 중앙에서 이만큼 위로 끌어올림 → 보이는 영역 중앙에 위치.
  //   지도 칸은 첫 화면에서 시트 위까지만일 수 있다(releaseHiddenBottom) — 그래서 화면 높이가 아니라 칸 높이의 중앙.
  return Math.max(0, (mapH && mapH > 0 ? mapH : H) / 2 - visibleCenter)
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
  favorites: number[]
  /** 현재 바텀시트 snap — 핀 클릭 시 보이는 영역 중앙 오프셋 계산에 사용. */
  sheetSnap?: 'peek' | 'mid' | 'full'
  /** 🌍 줌아웃 시 서버 집계(레이어 3). non-null·비어있지 않으면 개별 핀 대신 이것만 렌더. */
  serverClusters?: ServerCluster[] | null
  /** 🗺️ 2026-10-15 첫 목록이 도착했는가(실패해도 true). 지도는 이게 true 가 된 뒤에 만든다 — 아래 initMap 주석. */
  dataReady?: boolean
  /** 🗺️ 2026-10-15 첫 화면에서 시트가 가리는 아래 높이(px, 모바일 peek). 0 이면 미룰 것 없음(PC). — releaseHiddenBottom 주석. */
  hiddenBottomPx?: number
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
  favorites,
  sheetSnap = 'peek',
  serverClusters = null,
  dataReady = true,
  hiddenBottomPx = 0,
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
  /** 선택 restyle 이 무게 3단계를 다시 계산하려면 그 핀의 원본 값이 필요하다(가격·할인율). */
  const pinDataRef = useRef(new Map<number, Restaurant>())
  // ⚡ 뷰포트 컬링: 지도 idle(이동/줌 멈춤)마다 rev 를 올려 보이는 영역만 다시 그림(diff 라 무변경 핀은 무접촉).
  const [viewportRev, setViewportRev] = useState(0)
  // 🛡️ 2026-06-20 (대표 — 줌 전수조사): 초기 fit(setBounds/setLevel)은 데이터 로드 후 '한 번만'.
  //   기존엔 initMap 의존성에 mapLevel 이 있어 zoom_changed→setMapLevel→initMap 재실행→fit 재호출로
  //   매 줌마다 setLevel(5)/setBounds 가 사용자 줌을 원위치시켜 "줌이 안 먹는" 근본 원인이었음.
  const didInitialFit = useRef(false)

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState(false)
  // 터치→마우스 어댑터 해제 함수(부착 환경에서만 non-noop) — kakao-touch-shim.ts 참조.
  const shimCleanupRef = useRef<(() => void) | null>(null)
  // 🗺️ 2026-07-25 (전수조사 M3): mapLevel state + zoom_changed 리스너 제거 — 핀치 중 zoom_changed 가
  //   여러 번 발화해 매번 페이지 전체 리렌더를 일으켰음. 클러스터 gridSize 는 initMap 안에서
  //   map.getLevel() 로 직접 계산(idle → viewportRev 가 이미 initMap 을 재실행하므로 상태 불필요).

  // SDK loading — 🗺️ 2026-07-25 (전수조사 L1): deps 에 enabled 포함(리스트→지도 모드 전환 시 로드 보장).
  useEffect(() => {
    if (!kr || !enabled) {
      setSdkLoaded(false)
      return
    }
    // ⚡ 2026-10-14: 정적 import — 동적 import 는 지도 청크 다음에 SDK 래퍼(1KB) 청크를 **한 번 더** 받으러 갔다
    //   (라이브 실측 4.6초 출발 → 지도 생성 5.8초). 지도 표면 미리받기 묶음에 같이 실려 그 왕복이 사라진다.
    // 🗺️ 2026-10-14: 본체(kakao.js)만 실행되면 지도를 만든다 — services.js 를 기다리던 2.2초(느린 4G·CPU×4)를 뺀다.
    //   지오코더를 쓰는 곳(`useViewportRegion`·`pan-to-region`)은 `ensureKakaoMaps()`(전체 준비)를 따로 기다린다.
    ensureKakaoMapsCore()
      .then(() => setSdkLoaded(true))
      .catch((e) => {
        if (import.meta.env.DEV) console.error('[RestaurantMap] Kakao Maps load failed:', e)
        setSdkLoaded(false)
        setSdkError(true)
      })
  }, [kr, enabled])

  // 🗺️ 2026-06-22 (대표 — "공구 상품을 누르면 지도 한가운데로" + "중앙 기준이 시트 크기 따라 달라짐"):
  //   선택 상품이 *보이는 지도 영역*의 중앙에 오도록 pan. 하단 바텀시트가 화면 아래를 가리므로 단순
  //   panTo(기하학적 중앙)만 하면 핀이 시트 근처(아래쪽)에 박힘. projection 으로 중심좌표를 남쪽으로 옮겨
  //   핀을 위로 끌어올림 → 시각적 중앙 배치. 오프셋은 시트 snap(현재 또는 호출자 지정)에 따라 동적 계산.
  //   projection 미지원/실패 시 plain panTo 폴백.
  // 🗺️ 2026-10-15 (대표 "지도 속도" — 1번 승인): **시트에 가려진 타일은 받지 않는다.** 첫 화면의 아래 240px 는
  //   peek 시트가 덮고 있어서, 지도 칸을 화면 끝까지 두면 아무도 못 보는 타일을 함께 받았다(아이폰 12장 중 3장,
  //   안드로이드 15장 중 6장 — 느린 회선에서 보이는 타일과 회선을 나눈다). 그래서 지도를 만들 때 칸의 아래를
  //   시트 위까지만 둔다(`style.bottom`). 시트는 peek 아래로 안 내려가므로 그 영역이 보이는 건 **이용권을 골라
  //   납작한 카드로 바뀔 때뿐**이고, 그때 여기서 칸을 화면 끝까지 펴면서 **위쪽 내용이 한 픽셀도 안 움직이게**
  //   중심을 아래로 보정한다(칸이 d 만큼 아래로 자라면 화면 중심이 d/2 내려가므로 지도 중심도 d/2 내린다).
  //   React 상태가 아니라 DOM 스타일을 직접 다루는 이유: 선택 클릭 → panToProduct 가 **같은 동기 흐름에서**
  //   넓어진 칸을 기준으로 오프셋을 계산해야 해서다(상태로 하면 pan 애니메이션 도중 relayout 이 끼어든다).
  const hiddenBottomRef = useRef(false)
  const hiddenBottomPxRef = useRef(hiddenBottomPx)
  hiddenBottomPxRef.current = hiddenBottomPx
  /** 마지막으로 relayout 한 칸 높이 — 페이지의 ResizeObserver 가 이 값과 같으면 다시 하지 않는다(진행 중인 pan 보호). */
  const layoutHeightRef = useRef<number | null>(null)
  const releaseHiddenBottom = useCallback(() => {
    if (!hiddenBottomRef.current) return
    hiddenBottomRef.current = false
    const el = mapRef.current
    if (!el) return
    const oldH = el.clientHeight
    el.style.bottom = ''
    const newH = el.clientHeight
    layoutHeightRef.current = newH
    const map = mapInstance.current
    const delta = newH - oldH
    if (!map || !window.kakao?.maps || delta <= 0) { try { map?.relayout?.() } catch { /* */ } return }
    try {
      const proj = map.getProjection()
      const pt = proj.pointFromCoords(map.getCenter())
      const target = proj.coordsFromPoint(new window.kakao.maps.Point(pt.x, pt.y + delta / 2))
      map.relayout()
      map.setCenter(target)
    } catch {
      try { map.relayout() } catch { /* silent */ }
    }
  }, [])
  // 🗺️ 2026-10-15 (2차, 대표 "그렇게 할게" — 보이는 곳 먼저, 가려진 곳은 그다음): 카드를 열 때까지 아래를
  //   안 받으면 느린 회선에서 카드를 여는 순간 아래 216px 가 회색으로 비었다. 그래서 **보이는 타일이 다 뜬 뒤
  //   한가할 때** 칸을 미리 편다 — 첫 화면 이득은 그대로이고, 카드를 열 땐 이미 받아 둔 타일이 보인다.
  //   지도가 움직이는 중(드래그·줌·이동 애니메이션)이면 setCenter 가 끼어들지 않게 다음 idle 까지 미룬다.
  //   데이터 절약 모드는 미리 받지 않는다(카드를 열 때만 — 종전 동작).
  const movingRef = useRef(false)
  const pendingReleaseRef = useRef(false)
  const releaseHiddenBottomRef = useRef(releaseHiddenBottom)
  releaseHiddenBottomRef.current = releaseHiddenBottom
  const prefetchHiddenBottom = useCallback(() => {
    if (!hiddenBottomRef.current || prefersDataSaving()) return
    if (movingRef.current) { pendingReleaseRef.current = true; return }
    releaseHiddenBottomRef.current()
  }, [])

  const panToProduct = useCallback((lat: number, lng: number, level?: number, snap?: 'peek' | 'mid' | 'full' | 'card') => {
    const map = mapInstance.current
    if (!map || !window.kakao?.maps || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    if (snap === 'card') releaseHiddenBottom()
    if (typeof level === 'number') map.setLevel(level)
    const latlng = new window.kakao.maps.LatLng(lat, lng)
    const offsetY = centerOffsetForSheet(snap ?? sheetSnapRef.current, mapRef.current?.clientHeight)
    try {
      const proj = map.getProjection()
      const pt = proj.pointFromCoords(latlng)
      const offsetCenter = proj.coordsFromPoint(new window.kakao.maps.Point(pt.x, pt.y + offsetY))
      map.panTo(offsetCenter)
    } catch {
      map.panTo(latlng)
    }
  }, [releaseHiddenBottom])

  // 🗺️ 2026-10-15 (대표 "지도 속도"): 홈이 SDK 를 미리 받아 두면 SDK 가 목록보다 먼저 준비된다. 그때 지도를
  //   바로 만들면 [기본 중심·레벨 7 타일 12장] 을 받은 뒤, 목록이 오자 초기 맞춤(아래 didInitialFit)이 중심·레벨을
  //   옮겨 **타일을 한 벌 더** 받는다(실측 12 → 24장 — 느린 회선에서 가장 비싼 바이트다). 그래서 첫 목록이
  //   도착할 때까지 생성을 미룬다 — 생성과 맞춤이 같은 실행에서 일어나 타일이 한 벌만 나간다.
  //   목록이 영영 안 오면(회선 멈춤) 4초 뒤 그냥 만든다 — 빈 회색보다 지도가 낫다.
  const [createGateExpired, setCreateGateExpired] = useState(false)
  useEffect(() => {
    if (!sdkLoaded || dataReady || createGateExpired) return
    const id = setTimeout(() => setCreateGateExpired(true), 4000)
    return () => clearTimeout(id)
  }, [sdkLoaded, dataReady, createGateExpired])

  const initMap = useCallback(() => {
    if (!sdkLoaded || !mapRef.current || !window.kakao?.maps) return
    if (!mapInstance.current && !dataReady && !createGateExpired) return

    // 🏘️ 생성 시점 중심 = 내 위치(캐시 포함) 우선 → 데이터 도착 전에도 첫 프레임부터 내 동네(점프 없음).
    const center = (userLoc && Number.isFinite(userLoc.lat) && Number.isFinite(userLoc.lng))
      ? new window.kakao.maps.LatLng(userLoc.lat, userLoc.lng)
      : withCoords.length > 0
      ? new window.kakao.maps.LatLng(withCoords[0].restaurant_lat, withCoords[0].restaurant_lng)
      : new window.kakao.maps.LatLng(37.5665, 126.978)

    if (!mapInstance.current) {
      const hb = hiddenBottomPxRef.current
      if (hb > 0 && sheetSnapRef.current === 'peek' && selectedIdRef.current == null) {
        mapRef.current.style.bottom = `${hb}px`
        hiddenBottomRef.current = true
      }
      layoutHeightRef.current = mapRef.current.clientHeight
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
        movingRef.current = false
        if (pendingReleaseRef.current) { pendingReleaseRef.current = false; prefetchHiddenBottom() }
      })
      const markMoving = () => { movingRef.current = true }
      for (const ev of ['dragstart', 'zoom_start', 'center_changed']) {
        window.kakao.maps.event.addListener(mapInstance.current, ev, markMoving)
      }
      // 🗺️ 2026-07-27 (대표 신고 "F12 모바일 에뮬레이션에서 지도 스와이프 아예 안 됨"): 카카오 SDK 는
      //   "데스크톱 Chrome UA + 터치"(DevTools Responsive 에뮬·Windows 터치 노트북) 환경에서 마우스
      //   핸들러만 바인딩해 터치 팬이 완전 불능 — 그 환경에서만 터치→마우스 어댑터 부착(그 외 no-op).
      shimCleanupRef.current = attachKakaoTouchShim(mapRef.current)
      // 🗺️ 2026-10-15 첫 타일을 다 받으면 한 번 알린다 — main.tsx 가 `/map` 에서 GTM(153KB)을 그 뒤로 미룬다.
      const onTiles = () => {
        try { window.kakao.maps.event.removeListener(mapInstance.current, 'tilesloaded', onTiles) } catch { /* */ }
        window.dispatchEvent(new Event('ur:map-tiles-loaded'))
        whenIdle(prefetchHiddenBottom)
      }
      window.kakao.maps.event.addListener(mapInstance.current, 'tilesloaded', onTiles)
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

    // 🗺️ 2026-09-09 (안 D4): 이름 라벨 솎아내기용 — **개별로 그려질 핀**이 차지한 격자 칸.
    //   클러스터로 접히는 칸은 넣지 않는다(그 칸엔 개별 핀이 없다).
    const occupiedCells = new Set<string>()
    if (!aggMode && gridSize > 0) {
      visible.forEach(r => {
        const gx = Math.floor(r.restaurant_lng / gridSize)
        const gy = Math.floor(r.restaurant_lat / gridSize)
        const k = `${gx}_${gy}`
        if (!clusteredKeys.has(k)) occupiedCells.add(k)
      })
    }
    // 이미 본 이용권(localStorage) — 무게 3단계의 가운데 층.
    const seenIds = readRecentlyViewedIds()

    ;(aggMode ? [] : visible).forEach(r => {
      if (gridSize > 0) {
        const gx = Math.floor(r.restaurant_lng / gridSize)
        const gy = Math.floor(r.restaurant_lat / gridSize)
        if (clusteredKeys.has(`${gx}_${gy}`)) return
      }
      const isFav = favorites.includes(r.id)
      const groupKey = `${r.restaurant_lat.toFixed(5)}_${r.restaurant_lng.toFixed(5)}`
      const groupSize = coordGroupSize.get(groupKey) || 1
      // 🗺️ 2026-09-09 (안 D4): 이름 라벨은 **옆 칸이 비었을 때만** — 규칙은 shared/map-marker SSOT.
      const cellKey = gridSize > 0
        ? `${Math.floor(r.restaurant_lng / gridSize)}_${Math.floor(r.restaurant_lat / gridSize)}`
        : null
      const showLabel = shouldShowMarkerLabel(cellKey, occupiedCells)
      const isSeen = seenIds.has(r.id)
      // 마커 모양에 영향 주는 값만 key 에 — 값이 같으면(팬/줌/검색 재실행) 기존 핀 무접촉(깜빡임 0, L4:
      //   즐겨찾기 토글도 해당 핀 1개만 교체). 선택 강조는 key 무관 — 아래 restyle effect 가 DOM 직접 갱신.
      const key = `pin:${r.id}:${isFav ? 1 : 0}:${groupSize}:${r.price ?? 0}:${isSeen ? 1 : 0}:${showLabel ? 1 : 0}`
      desired.set(key, () => {
        const pos = new window.kakao.maps.LatLng(r.restaurant_lat, r.restaurant_lng)
        const content = buildPinContent(r, { isFav, isSelected: selectedIdRef.current === r.id, groupSize, isSeen, showLabel })
        content.addEventListener('click', () => {
          setSelected(r)
          // 🗺️ 2026-06-22: 핀 클릭 시 납작한 선택 카드가 뜨므로 'card' 기준으로 넓은 지도 중앙에 배치. 줌 유지.
          panToProduct(r.restaurant_lat, r.restaurant_lng, undefined, 'card')
        })
        // 🗺️ 2026-08-17 (UX 전수검사 P1 — 핀·가격버블 상호 가림): 개별 핀에 기본 zIndex(3: 회색 장소 1 ↑,
        //   클러스터 5 ↓) + 호버/터치 시 최상위(9)로 — 겹친 핀도 가리키면 온전히 드러나 클릭 가능.
        // 🗺️ 2026-09-09 (안 D4): yAnchor 0.5 → 1. 종전 원형 핀은 좌표 위에 '얹혀' 있었는데,
        //   꼬리가 달린 핀은 **바닥이 그 자리를 가리켜야** 한다(안 그러면 꼬리가 엉뚱한 곳을 짚는다).
        const overlay = new window.kakao.maps.CustomOverlay({
          position: pos, content, yAnchor: 1, xAnchor: 0.5, zIndex: 3, map: mapInstance.current,
        })
        content.addEventListener('mouseenter', () => { try { overlay.setZIndex(9) } catch { /* SDK 구버전 */ } })
        content.addEventListener('mouseleave', () => { try { overlay.setZIndex(3) } catch { /* SDK 구버전 */ } })
        // ⚡ 선택 restyle 용 registry — 핀 루트 div 기억(선택 변경 시 전량 재빌드 없이 이 노드만 갱신).
        const rootEl = content.firstElementChild as HTMLElement | null
        if (rootEl) pinElsRef.current.set(r.id, rootEl)
        pinDataRef.current.set(r.id, r)
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
        if (key.startsWith('pin:')) {
          const pid = Number(key.split(':')[1])
          pinElsRef.current.delete(pid)
          pinDataRef.current.delete(pid)
        }
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
  }, [sdkLoaded, withCoords, kakaoPlaces, userLoc, favorites, coordGroupSize, setSelected, setSuggestionFor, panToProduct, viewportRev, serverClusters, dataReady, createGateExpired])

  useEffect(() => { initMap() }, [initMap])

  /**
   * 🎛️ 2026-09-09: 할인 강조 임계값의 **어드민 조정값**을 받아 온다.
   *
   * 🔴 **첫 화면을 막지 않는다** — 마커는 이미 코드 상수로 그려져 있고, 값이 도착하면 색만 다시
   *   칠한다. 실패·지연이면 상수 그대로라 오늘과 완전히 같은 동작이다(로딩 규칙: 새 블로킹 왕복 0).
   * 🔴 값이 실제로 **달라졌을 때만** 다시 칠한다 — 매번 칠하면 선택 상태가 깜빡인다.
   */
  useEffect(() => {
    if (!enabled) return
    let alive = true
    import('@/lib/api').then(({ default: api }) => api.get('/api/consumer-settings'))
      .then((r) => {
        if (!alive) return
        const v = (r.data as { data?: { map_highlight_discount_pct?: number } })?.data?.map_highlight_discount_pct
        if (v == null) return
        const before = mapHighlightPct()
        setMapHighlightPct(v)
        if (mapHighlightPct() === before) return
        const seen = readRecentlyViewedIds()
        pinElsRef.current.forEach((el, id) => {
          const r2 = pinDataRef.current.get(id)
          applyPinTierStyle(el, mapMarkerTier({
            discount: r2 ? priceDisplay(r2).discount : 0,
            isSelected: selectedIdRef.current === id,
            isSeen: seen.has(id),
          }))
        })
      })
      .catch(() => { /* 조정값 없음 = 코드 상수 유지(현행과 동일) */ })
    return () => { alive = false }
  }, [enabled])

  // ⚡ 2026-07-08 (레이어 4의 핫패스): 선택 변경 시 해당 핀 DOM 만 직접 restyle — 전량 재빌드 0.
  useEffect(() => {
    // 🗺️ 2026-09-09 (안 D4): 값을 여기 또 적지 않는다 — 빌드와 **같은** `applyPinTierStyle` 을 부른다.
    //   종전엔 크기·그림자 숫자가 빌더와 여기 두 곳에 있어 한쪽만 고치면 조용히 갈렸다.
    const seen = readRecentlyViewedIds()
    pinElsRef.current.forEach((el, id) => {
      const r = pinDataRef.current.get(id)
      const tier = mapMarkerTier({
        discount: r ? priceDisplay(r).discount : 0,
        isSelected: selected?.id === id,
        isSeen: seen.has(id),
      })
      applyPinTierStyle(el, tier)
    })
    // 🎬 2026-11-02 시안 3차: 고른 핀만 톡 튀어 오른다(index.css .ur-pin-pop · 동작 줄이기면 CSS 가 끈다).
    const pill = selected ? pinElsRef.current.get(selected.id)?.querySelector('.ur-pin-pill') : null
    if (pill) { pill.classList.remove('ur-pin-pop'); void (pill as HTMLElement).offsetWidth; pill.classList.add('ur-pin-pop') }
  }, [selected?.id])

  useEffect(() => {
    return () => {
      try {
        shimCleanupRef.current?.()
        shimCleanupRef.current = null
        overlayRegistryRef.current.forEach(o => o.setMap?.(null))
        overlayRegistryRef.current.clear()
        pinElsRef.current.clear()
        pinDataRef.current.clear()
        mapInstance.current = null
      } catch { /* ignore */ }
    }
  }, [])

  // 선택(카드)이 생기거나 PC 폭이 되면 가려진 아래가 드러난다 — 칸을 편다. 그리기 전에(layout effect) 해서 회색 틈이 안 보이게.
  useLayoutEffect(() => {
    if (selected || hiddenBottomPx === 0) releaseHiddenBottom()
  }, [selected, hiddenBottomPx, releaseHiddenBottom])

  return { mapRef, mapInstance, sdkLoaded, sdkError, panToProduct, layoutHeightRef }
}

/** 데이터 절약 모드면 화면 밖 타일을 미리 받지 않는다. */
function prefersDataSaving(): boolean {
  const c = (typeof navigator !== 'undefined' ? (navigator as { connection?: { saveData?: boolean } }).connection : undefined)
  return !!c?.saveData
}

/** 한가할 때 실행(사파리는 requestIdleCallback 이 없어 짧은 지연으로 대신한다). */
function whenIdle(cb: () => void): void {
  const ric = (window as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (ric) ric(cb, { timeout: 3000 })
  else setTimeout(cb, 300)
}
