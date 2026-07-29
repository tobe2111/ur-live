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
import { ensureKakaoMaps } from '@/lib/kakao-sdk'
import { attachKakaoTouchShim } from '@/lib/kakao-touch-shim'

interface VoucherMapItem {
  id: number | string
  product_name: string
  restaurant_name?: string
  restaurant_lat?: number
  restaurant_lng?: number
  expires_at?: string
}

export default function VoucherMap<T extends VoucherMapItem>({
  vouchers, onMarkerClick, userLocation, focus,
}: {
  vouchers: T[]
  onMarkerClick: (v: T) => void
  userLocation?: { lat: number; lng: number } | null
  focus?: { lat: number; lng: number } | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  // 🗺️ 2026-07-25 (전수조사 M5): 마커/오버레이 레이어 registry + bounds-fit 이력.
  //   기존엔 deps(vouchers 배열 identity/userLocation GPS 도착) 변경마다 같은 컨테이너에
  //   `new kakao.maps.Map` 을 다시 생성 — 지도 조작 중 전체 재초기화(뷰 리셋·깜빡임) + 이전 인스턴스/
  //   리스너 미정리 누적. → 지도는 1회만 생성, 변경 시 마커 레이어만 갈아끼우고 뷰포트는 보존.
  const layerRef = useRef<any[]>([])
  const fittedKeyRef = useRef('')
  const shimCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => { shimCleanupRef.current?.(); shimCleanupRef.current = null }, [])

  useEffect(() => {
    if (!containerRef.current || vouchers.length === 0) return

    // D-N 라벨용 남은 일수
    const daysLeft = (iso?: string): number | null => {
      if (!iso) return null
      const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
      return Number.isFinite(d) ? Math.max(0, d) : null
    }

    let cancelled = false
    // 🗺️ M5 동반: 자체 로더 제거 → 공용 ensureKakaoMaps(kakao-sdk.ts) — 기존 로더는 `w.kakao.maps`
    //   존재만 보고 maps.load() 완료 전 resolve 될 수 있는 레이스 보유(공용 로더가 load 완료 보장).
    ensureKakaoMaps().then(() => {
      if (cancelled || !containerRef.current) return
      const w = window as any
      const pts = vouchers.filter(v => Number.isFinite(Number(v.restaurant_lat)) && Number.isFinite(Number(v.restaurant_lng)) && v.restaurant_lat && v.restaurant_lng)
      if (pts.length === 0) return
      if (!mapRef.current) {
        const centerLat = pts.reduce((a, v) => a + Number(v.restaurant_lat), 0) / pts.length
        const centerLng = pts.reduce((a, v) => a + Number(v.restaurant_lng), 0) / pts.length
        mapRef.current = new w.kakao.maps.Map(containerRef.current, {
          center: new w.kakao.maps.LatLng(centerLat, centerLng),
          level: 7,
        })
        // 🗺️ 2026-07-27: 데스크톱 Chrome UA+터치(DevTools Responsive 에뮬·터치 노트북)에선 카카오가
        //   마우스 모드로 바인딩돼 터치 팬 불능 — 해당 환경에서만 터치→마우스 어댑터(그 외 no-op).
        shimCleanupRef.current = attachKakaoTouchShim(containerRef.current)
      }
      const map = mapRef.current

      // 이전 마커 레이어만 제거(지도 인스턴스/뷰포트는 유지)
      layerRef.current.forEach(o => { try { o.setMap?.(null) } catch { /* silent */ } })
      layerRef.current = []

      const bounds = new w.kakao.maps.LatLngBounds()
      pts.forEach((v) => {
        const pos = new w.kakao.maps.LatLng(v.restaurant_lat, v.restaurant_lng)
        bounds.extend(pos)
        const marker = new w.kakao.maps.Marker({ position: pos, map })
        // 🎨 핀 위 라벨 — "가게 · D-N" (시안)
        const dN = daysLeft(v.expires_at)
        const safeName = (v.restaurant_name || v.product_name).replace(/</g, '&lt;')
        const labelHtml = `<div style="transform:translateY(-46px);background:#0F151D;color:#fff;font:600 11px 'Pretendard',sans-serif;padding:5px 9px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.2)">${safeName}${dN !== null ? ` · D-${dN}` : ''}</div>`
        const overlay = new w.kakao.maps.CustomOverlay({ position: pos, content: labelHtml, yAnchor: 1, zIndex: 3 })
        overlay.setMap(map)
        w.kakao.maps.event.addListener(marker, 'click', () => onMarkerClick(v))
        layerRef.current.push(marker, overlay)
      })

      // 🎨 현위치 마커 — GPS 도착 시 점만 추가(뷰포트 리셋 없음)
      if (userLocation) {
        const upos = new w.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
        const dotHtml = `<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.25)"></div>`
        const dot = new w.kakao.maps.CustomOverlay({ position: upos, content: dotHtml, zIndex: 5 })
        dot.setMap(map)
        layerRef.current.push(dot)
      }

      // bounds fit 은 '이용권 구성이 실제로 바뀐 첫 렌더'만 — 조작 중 refetch(동일 목록)로 뷰가 튀지 않게.
      const idsKey = pts.map(v => v.id).join(',')
      if (fittedKeyRef.current !== idsKey) {
        fittedKeyRef.current = idsKey
        if (userLocation) bounds.extend(new w.kakao.maps.LatLng(userLocation.lat, userLocation.lng))
        if (pts.length > 1 || userLocation) map.setBounds(bounds, 56, 40, 100, 40)
      }
    }).catch((err) => {
      if (import.meta.env.DEV) console.error('[VoucherMap]', err)
    })
    return () => { cancelled = true }
  }, [vouchers, onMarkerClick, userLocation])

  // 🎨 2026-06-21 (개선 #1): 하단 캐러셀에서 카드 탭 시 해당 매장으로 부드럽게 이동 (재초기화 X).
  useEffect(() => {
    const w = window as any
    if (!focus || !mapRef.current || !w.kakao?.maps) return
    mapRef.current.setCenter(new w.kakao.maps.LatLng(focus.lat, focus.lng))
    mapRef.current.setLevel(4)
  }, [focus?.lat, focus?.lng])

  function recenter() {
    const w = window as any
    if (!mapRef.current || !userLocation || !w.kakao?.maps) return
    mapRef.current.setCenter(new w.kakao.maps.LatLng(userLocation.lat, userLocation.lng))
    mapRef.current.setLevel(4)
  }

  if (vouchers.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0F151D] rounded-xl border border-gray-200 dark:border-[#2A3446] p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">지도에 표시할 미사용 이용권이 없어요</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A3446]" style={{ height: 400 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* 🎨 현위치 재중심 버튼 (시안 우상단) */}
      {userLocation && (
        <button
          type="button"
          onClick={recenter}
          aria-label="내 위치로 이동"
          className="absolute right-3 top-3 z-[2] w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#1A2334] text-gray-900 dark:text-white shadow-md active:scale-95 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4.2" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      )}
    </div>
  )
}
