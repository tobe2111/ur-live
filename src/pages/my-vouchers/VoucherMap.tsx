/**
 * 🛡️ 2026-05-15: 미사용 voucher 매장들을 카카오 지도에 멀티 마커로 표시.
 * 각 마커 클릭 시 onMarkerClick(voucher) 호출 → QR 모달 오픈.
 *
 * 🛡️ 2026-05-27 (loading P1): MyVouchersPage 에서 별도 파일로 분리 + lazy import.
 *   Kakao Maps SDK (~150KB) 가 사용자가 '지도 보기' 토글 시만 로드.
 */
import { useEffect, useRef } from 'react'

interface VoucherMapItem {
  id: number | string
  product_name: string
  restaurant_name?: string
  restaurant_lat?: number
  restaurant_lng?: number
}

export default function VoucherMap<T extends VoucherMapItem>({
  vouchers, onMarkerClick,
}: {
  vouchers: T[]
  onMarkerClick: (v: T) => void
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
        const iw = new w.kakao.maps.InfoWindow({
          content: `<div style="padding:8px 12px;font-size:12px;font-weight:700;color:#111;">${(v.restaurant_name || v.product_name).replace(/</g, '&lt;')}</div>`,
        })
        w.kakao.maps.event.addListener(marker, 'mouseover', () => iw.open(map, marker))
        w.kakao.maps.event.addListener(marker, 'mouseout', () => iw.close())
        w.kakao.maps.event.addListener(marker, 'click', () => onMarkerClick(v))
      })
      if (vouchers.length > 1) map.setBounds(bounds, 40, 40, 40, 40)
    }).catch((err) => {
      if (import.meta.env.DEV) console.error('[VoucherMap]', err)
    })
    return () => { cancelled = true }
  }, [vouchers, onMarkerClick])

  if (vouchers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-12 text-center">
        <p className="text-sm text-gray-500">지도에 표시할 미사용 식사권이 없어요</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A]" style={{ height: 400 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
