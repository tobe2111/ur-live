/**
 * 🛡️ 2026-05-17: 매장 위치 미니 지도 (공구 상세 / 이용권 상세 페이지).
 *
 * 사용:
 *   <RestaurantMiniMap name={...} address={...} lat={...} lng={...} />
 *
 * 동작:
 *   - lat/lng 이 주어지면 즉시 지도 렌더 + 마커.
 *   - 없고 address 만 있으면 Kakao Geocoder (Maps SDK services 라이브러리) 로 변환.
 *   - 변환 실패 시 주소 텍스트만 표시.
 *   - "카카오맵에서 보기" 버튼 → kakao map URL (모바일은 앱, PC 는 웹) 새 탭.
 *
 * 라이트/다크 테마 모두 지원.
 */

import { useEffect, useRef, useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'
import { ensureKakaoMaps } from '@/lib/kakao-sdk'
import { escapeHtml } from '@/shared/utils/html'
import { normalizeKakaoPlaceUrl } from '@/shared/kakao-place-url'

declare global {
  interface Window { kakao: any }
}

interface Props {
  name?: string
  address?: string
  lat?: number | null
  lng?: number | null
  /** 🎯 2026-07-01: 카카오 장소 페이지 URL(place.map.kakao.com/{id}) — 등록 시 캡처. 있으면 매장 페이지 직접 연결. */
  placeUrl?: string | null
  /** 지도 높이 (px). 기본 220px */
  height?: number
}

export default function RestaurantMiniMap({ name, address, lat, lng, placeUrl, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const [resolvedCoord, setResolvedCoord] = useState<{ lat: number; lng: number } | null>(
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat: Number(lat), lng: Number(lng) } : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  // 🛡️ 2026-05-27 (loading P0): IntersectionObserver lazy load — 지도 영역이 viewport
  //   진입할 때만 Kakao Maps SDK fetch (~100-300KB). 페이지 mount 시 즉시 안 부름.
  //   사용자가 스크롤로 지도까지 안 오면 SDK 0 fetch.
  //   효과: 공구 상세 페이지 첫 paint 부터 다른 chunk 와 SDK 경쟁 제거 (LCP 50-150ms ↓).
  const [shouldLoadSdk, setShouldLoadSdk] = useState(false)

  // IntersectionObserver — viewport 진입 시 shouldLoadSdk=true
  /**
   * 🗺️ 2026-09-02 [UNLOCK_LOADING] (대표 "모두 다 진행" — 로딩 후속 ④): **히어로 사진과 같은 순간에 지도를 받지 않는다.**
   *
   * 클릭 프로브 실측(iPhone 에뮬, 홈 카드 탭 → 상세): 카카오 지도 SDK 가 **0.28초**, 타일 6장이 **1.3초**에 내려왔다 —
   * 히어로 사진이 아직 오는 중인 바로 그 시간이다. 이유는 둘: ① 폰에서 지도 칸이 첫 화면 바로 아래(매장 정보 밑)라
   * `rootMargin: 300px` 면 마운트 즉시 교차 판정 ② 교차하자마자 SDK 를 불렀다.
   * ⇒ 여백을 120px 로 줄이고, 교차해도 **브라우저가 한가할 때**(`requestIdleCallback`, 최대 2.5초 대기) 부른다.
   *   지도는 사용자가 내려와야 보는 것이라 이 지연은 체감 0 이고, 히어로가 먼저 대역폭을 다 쓴다.
   * ⚠️ lazy 자체(스크롤 안 오면 SDK 0 fetch)는 그대로다 — 잠금표의 보호 대상은 이 구조이고 여기선 강화만 했다.
   */
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShouldLoadSdk(true)  // 미지원 환경 fallback — 즉시 load
      return
    }
    let idle: number | undefined
    const arm = () => {
      const run = () => setShouldLoadSdk(true)
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(run, { timeout: 2500 })
      else idle = window.setTimeout(run, 600)
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            arm()
            obs.disconnect()
            break
          }
        }
      },
      { rootMargin: '120px' },  // viewport 120px 이전부터(300 은 폰 첫 화면에서 즉시 발화했다)
    )
    obs.observe(el)
    const cleanup = () => {
      obs.disconnect()
      if (idle != null) { if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idle); else clearTimeout(idle) }
    }
    return cleanup
  }, [])

  // SDK 로드 + 좌표 변환 (필요 시) — viewport 진입 후만 동작
  useEffect(() => {
    if (!shouldLoadSdk) return
    let cancelled = false
    ensureKakaoMaps()
      .then(() => {
        if (cancelled) return
        setLoaded(true)
        // 좌표가 없고 주소만 있으면 geocoding
        if (!resolvedCoord && address) {
          try {
            const geocoder = new window.kakao.maps.services.Geocoder()
            geocoder.addressSearch(address, (result: any[], status: string) => {
              if (cancelled) return
              if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
                setResolvedCoord({ lat: Number(result[0].y), lng: Number(result[0].x) })
              } else {
                setError('주소를 지도에서 찾을 수 없습니다')
              }
            })
          } catch (e) {
            setError('지도 로드 실패')
          }
        }
      })
      .catch(() => {
        if (cancelled) return
        setError('지도 로드 실패')
      })
    return () => { cancelled = true }
  }, [shouldLoadSdk, address, resolvedCoord])

  // 좌표 확정 후 지도 렌더
  useEffect(() => {
    if (!loaded || !resolvedCoord || !mapRef.current || mapInstance.current) return
    try {
      const pos = new window.kakao.maps.LatLng(resolvedCoord.lat, resolvedCoord.lng)
      // 🗺️ 2026-07-25 (전수조사 M4): 터치 기기는 draggable=false — 기존엔 컨테이너 touch-action:pan-y
      //   (세로는 페이지 스크롤)와 카카오 드래그가 동시에 활성이라, 대각선 제스처에서 지도가 찔끔
      //   움직이다 페이지가 스크롤되는 지터 + 한 손가락 세로 팬 불가(가로만 됨). 미니맵은 위치 확인용 —
      //   모바일 탐색은 "카카오맵" 링크로 유도(구글맵 cooperative 철학). PC(마우스) 드래그는 유지.
      const coarsePointer = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
      mapInstance.current = new window.kakao.maps.Map(mapRef.current, {
        center: pos,
        level: 4,
        draggable: !coarsePointer,
        scrollwheel: false, // 미니맵은 페이지 스크롤 보호 (사용자가 카카오맵 앱으로 이동 가능)
      })
      mapInstance.current.setZoomable(true)
      // 마커 + InfoWindow (매장명 표시)
      const marker = new window.kakao.maps.Marker({ position: pos, map: mapInstance.current })
      if (name) {
        const info = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:12px;font-weight:700;color:#111;white-space:nowrap">${escapeHtml(name)}</div>`,
        })
        info.open(mapInstance.current, marker)
      }
    } catch (e) {
      setError('지도 표시 실패')
    }
  }, [loaded, resolvedCoord, name])

  // 카카오맵 외부 링크 URL
  // 🛡️ 2026-07-01 (대표 신고 — "카카오맵에 매장 페이지가 안 나옴"): `link/map/{name},{lat},{lng}` 는
  //   좌표에 핀만 찍고 등록된 장소 페이지(정보/리뷰 카드)를 안 엶 + 좌표 오차 시 빈자리 핀.
  //   → 매장명+주소로 `link/search` — 카카오에 등록된 실제 장소가 떠서 매장 페이지로 연결(좌표 정밀도 무관).
  // 🎯 2026-07-01 (대표 "매장의 카카오맵 페이지와 연결"): 우선순위 —
  //   ① 등록 시 캡처한 place_url(정확한 매장 페이지 직접 열림) ② 매장명+주소 link/search(등록 장소 surfacing)
  //   ③ 좌표 map(폴백). place_url 은 place.map.kakao.com/{id} 형식만 허용(임의 URL 주입 방지).
  const normalizedPlaceUrl = normalizeKakaoPlaceUrl(placeUrl)  // place.map.kakao.com / map.kakao.com / kko.to 만
  const kakaoSearchQuery = [name, address].filter(Boolean).join(' ').trim()
  const kakaoMapUrl = normalizedPlaceUrl
    ? normalizedPlaceUrl
    : kakaoSearchQuery
    ? `https://map.kakao.com/link/search/${encodeURIComponent(kakaoSearchQuery)}`
    : resolvedCoord
    ? `https://map.kakao.com/link/map/${resolvedCoord.lat},${resolvedCoord.lng}`
    : null

  if (!address && !resolvedCoord) return null

  return (
    <div ref={containerRef} className="rounded-2xl border border-gray-100 dark:border-[#2C2F35] bg-white dark:bg-[#11141C] overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="flex items-start gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            {name && <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{name}</p>}
            {address && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{address}</p>}
          </div>
        </div>
        {kakaoMapUrl && (
          <a
            href={kakaoMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            카카오맵 <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* 지도 영역 */}
      <div className="relative" style={{ height }}>
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#111]">
            <p className="text-xs text-gray-400">{error}</p>
          </div>
        ) : !resolvedCoord ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#111]">
            <p className="text-xs text-gray-400">지도 로딩 중...</p>
          </div>
        ) : (
          <div ref={mapRef} className="absolute inset-0" style={{ touchAction: 'pan-y' }} />
        )}
      </div>
    </div>
  )
}

