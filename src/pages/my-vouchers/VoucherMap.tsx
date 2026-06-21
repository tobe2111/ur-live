/**
 * 🛡️ 2026-05-15: 미사용 voucher 매장들을 카카오 지도에 멀티 마커로 표시.
 * 각 마커 클릭 시 onMarkerClick(voucher) 호출 → QR 모달 오픈.
 *
 * 🛡️ 2026-05-27 (loading P1): MyVouchersPage 에서 별도 파일로 분리 + lazy import.
 *   Kakao Maps SDK (~150KB) 가 사용자가 '지도 보기' 토글 시만 로드.
 *
 * 🎨 2026-06-20 흑백 리디자인 화면2: 핀 라벨("가게 · D-N") + 현위치 마커 + 현위치 재중심 버튼.
 */
import { useEffect, useRef } from 'react'

interface VoucherMapItem {
  id: number | string
  product_name: string
  restaurant_name?: string
  restaurant_lat?: number
  restaurant_lng?: number
  expires_at?: string
}

export default function VoucherMap<T extends VoucherMapItem>({
  vouchers, onMarkerClick, userLocation,
}: {
  vouchers: T[]
  onMarkerClick: (v: T) => void
  userLocation?: { lat: number; lng: number } | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || vouchers.length === 0) return
    const KAKAO_KEY = (import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || '') as string
    if (!KAKAO_KEY) {
      if (import.meta.env.DEV) console.warn('[VoucherMap] Kakao JS key missing')
      return
    }

    function ensureSdkLoaded(): Promise<void> {
      return new Promise((resolve, reject) => {
        const w = window as any
        if (w.kakao && w.kakao.maps) { resolve(); return }
        const existingScript = document.querySelector(`script[src*="dapi.kakao.com"]`)
        if (existingScript) {
          existingScript.addEventListener('load', () => w.kakao?.maps?.load(() => resolve()))
          existingScript.addEventListener('error', () => reject(new Error('kakao sdk load failed')))
          return
        }
        const s = document.createElement('script')
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`
        s.async = true
        s.onload = () => w.kakao.maps.load(() => resolve())
        s.onerror = () => reject(new Error('kakao sdk load failed'))
        document.head.appendChild(s)
      })
    }

    // D-N 라벨용 남은 일수
    const daysLeft = (iso?: string): number | null => {
      if (!iso) return null
      const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
      return Number.isFinite(d) ? Math.max(0, d) : null
    }

    let cancelled = false
    ensureSdkLoaded().then(() => {
      if (cancelled || !containerRef.current) return
      const w = window as any
      const lats = vouchers.map(v => Number(v.restaurant_lat))
      const lngs = vouchers.map(v => Number(v.restaurant_lng))
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length
      const map = new w.kakao.maps.Map(containerRef.current, {
        center: new w.kakao.maps.LatLng(centerLat, centerLng),
        level: 7,
      })
      mapRef.current = map

      const bounds = new w.kakao.maps.LatLngBounds()
      vouchers.forEach((v) => {
        if (!v.restaurant_lat || !v.restaurant_lng) return
        const pos = new w.kakao.maps.LatLng(v.restaurant_lat, v.restaurant_lng)
        bounds.extend(pos)
        const marker = new w.kakao.maps.Marker({ position: pos, map })
        // 🎨 핀 위 라벨 — "가게 · D-N" (시안)
        const dN = daysLeft(v.expires_at)
        const safeName = (v.restaurant_name || v.product_name).replace(/</g, '&lt;')
        const labelHtml = `<div style="transform:translateY(-46px);background:#0A0A0A;color:#fff;font:600 11px 'Pretendard',sans-serif;padding:5px 9px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.2)">${safeName}${dN !== null ? ` · D-${dN}` : ''}</div>`
        const overlay = new w.kakao.maps.CustomOverlay({ position: pos, content: labelHtml, yAnchor: 1, zIndex: 3 })
        overlay.setMap(map)
        w.kakao.maps.event.addListener(marker, 'click', () => onMarkerClick(v))
      })

      // 🎨 현위치 마커 + bounds 포함
      if (userLocation) {
        const upos = new w.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
        bounds.extend(upos)
        const dotHtml = `<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.25)"></div>`
        new w.kakao.maps.CustomOverlay({ position: upos, content: dotHtml, zIndex: 5 }).setMap(map)
      }

      if (vouchers.length > 1 || userLocation) map.setBounds(bounds, 56, 40, 100, 40)
    }).catch((err) => {
      if (import.meta.env.DEV) console.error('[VoucherMap]', err)
    })
    return () => { cancelled = true }
  }, [vouchers, onMarkerClick, userLocation])

  function recenter() {
    const w = window as any
    if (!mapRef.current || !userLocation || !w.kakao?.maps) return
    mapRef.current.setCenter(new w.kakao.maps.LatLng(userLocation.lat, userLocation.lng))
    mapRef.current.setLevel(4)
  }

  if (vouchers.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">지도에 표시할 미사용 식사권이 없어요</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A]" style={{ height: 400 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* 🎨 현위치 재중심 버튼 (시안 우상단) */}
      {userLocation && (
        <button
          type="button"
          onClick={recenter}
          aria-label="내 위치로 이동"
          className="absolute right-3 top-3 z-[2] w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-md active:scale-95 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4.2" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      )}
    </div>
  )
}
