/**
 * 🗺️ 매장 위치 미니 지도 — **외국어 손님용 네이버 지도** (2026-11-02 대표 확정 "외국어일 때만 네이버맵").
 *
 * `RestaurantMiniMap`(카카오, 로딩 잠금)과 **같은 모양·같은 지연 로드**를 따른다:
 *   - 지도 칸이 화면 120px 앞에 오고, 브라우저가 한가할 때만 SDK 를 받는다(스크롤 안 오면 0 fetch).
 *   - 지도만 그리는 `bare` 모양(그 칸의 제목·주소는 감싸는 `StoreLocation` 이 말한다).
 *   - 터치 기기는 드래그·확대를 끄고 투명 덮개를 깔아 페이지 스크롤을 지킨다.
 * 차이는 지명이 손님 언어(영어·일본어·중국어)로 나온다는 것 하나다.
 *
 * 호출부는 `isNaverMapAvailable(lang)` 이 true 일 때만 이 컴포넌트를 쓴다(키 없음·한국어 → 카카오).
 */
import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-lite'
import { ensureNaverMaps } from '@/lib/naver-maps'
import { escapeHtml } from '@/shared/utils/html'

interface Props {
  name?: string
  address?: string
  lat?: number | null
  lng?: number | null
  /** 지도 높이 (px). 기본 220px */
  height?: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type NaverWindow = Window & { naver?: any }

export default function NaverMiniMap({ name, address, lat, lng, height = 220 }: Props) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat: Number(lat), lng: Number(lng) } : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [shouldLoad, setShouldLoad] = useState(false)

  // 화면 진입 + 한가할 때만 SDK — RestaurantMiniMap 과 같은 규칙.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setShouldLoad(true); return }
    let idle: number | undefined
    const arm = () => {
      const run = () => setShouldLoad(true)
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(run, { timeout: 2500 })
      else idle = window.setTimeout(run, 600)
    }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { arm(); obs.disconnect() }
    }, { rootMargin: '120px' })
    obs.observe(el)
    return () => {
      obs.disconnect()
      if (idle != null) { if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idle); else clearTimeout(idle) }
    }
  }, [])

  useEffect(() => {
    if (!shouldLoad) return
    let cancelled = false
    ensureNaverMaps(i18n.language)
      .then(() => {
        if (cancelled) return
        setLoaded(true)
        if (!coord && address) {
          const naver = (window as NaverWindow).naver
          try {
            naver.maps.Service.geocode({ query: address }, (status: unknown, res: any) => {
              if (cancelled) return
              const hit = res?.v2?.addresses?.[0]
              if (status === naver.maps.Service.Status.OK && hit) setCoord({ lat: Number(hit.y), lng: Number(hit.x) })
              else setError(t('map.addressNotFound', { defaultValue: '주소를 지도에서 찾을 수 없습니다' }))
            })
          } catch {
            setError(t('map.loadFailed', { defaultValue: '지도 로드 실패' }))
          }
        }
      })
      .catch(() => { if (!cancelled) setError(t('map.loadFailed', { defaultValue: '지도 로드 실패' })) })
    return () => { cancelled = true }
  }, [shouldLoad, address, coord, i18n.language, t])

  useEffect(() => {
    if (!loaded || !coord || !mapRef.current || mapInstance.current) return
    const naver = (window as NaverWindow).naver
    try {
      const coarse = !!window.matchMedia?.('(pointer: coarse)').matches
      const pos = new naver.maps.LatLng(coord.lat, coord.lng)
      mapInstance.current = new naver.maps.Map(mapRef.current, {
        center: pos, zoom: 16, draggable: !coarse, pinchZoom: !coarse, scrollWheel: false,
        scaleControl: false, logoControl: true, mapDataControl: false,
      })
      const marker = new naver.maps.Marker({ position: pos, map: mapInstance.current })
      if (name) {
        const info = new naver.maps.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:12px;font-weight:700;color:#111;white-space:nowrap">${escapeHtml(name)}</div>`,
        })
        info.open(mapInstance.current, marker)
      }
    } catch {
      setError(t('map.showFailed', { defaultValue: '지도 표시 실패' }))
    }
  }, [loaded, coord, name, t])

  const query = [name, address].filter(Boolean).join(' ').trim()
  const naverUrl = query
    ? `https://map.naver.com/p/search/${encodeURIComponent(query)}`
    : coord ? `https://map.naver.com/p?c=${coord.lng},${coord.lat},16,0,0,0,dh` : null

  if (!address && !coord) return null

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {naverUrl && (
        // 🗺️ 지도 위 UI 는 테마를 따르지 않는다(2026-09-02) — 흰 표면 고정.
        <a href={naverUrl} target="_blank" rel="noopener noreferrer"
          className="light-island absolute right-2 top-2 z-[3] inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-medium text-gray-900 ring-1 ring-black/10">
          {t('map.openNaver', { defaultValue: '네이버 지도' })} <ExternalLink className="w-3 h-3" />
        </a>
      )}
      <div className="relative" style={{ height }}>
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#111]">
            <p className="text-[12px] text-gray-400">{error}</p>
          </div>
        ) : !coord ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#111]">
            <p className="text-[12px] text-gray-400">{t('map.loading', { defaultValue: '지도 로딩 중...' })}</p>
          </div>
        ) : (
          <>
            <div ref={mapRef} className="absolute inset-0" style={{ touchAction: 'pan-y' }} />
            <div className="absolute inset-0 hidden [@media(pointer:coarse)]:block" style={{ touchAction: 'pan-y', zIndex: 2 }} aria-hidden="true" data-map-scroll-guard />
          </>
        )}
      </div>
    </div>
  )
}
