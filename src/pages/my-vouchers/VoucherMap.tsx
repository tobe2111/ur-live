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
import { parseUTCDate } from '@/utils/date'

/** 지도 아래쪽을 덮는 이용권 카드 줄 높이(카드 76 + 바닥 여백 12 + 숨 12) — 처음 맞춤(setBounds)의 아래 여백과 같은 값. */
export const FOCUS_BOTTOM_COVER = 100
/** 카카오 기본 핀 그림 높이(35)의 절반 — 핀은 아래 끝이 좌표라 그림이 위로 솟는다. */
export const PIN_HALF_HEIGHT = 17

interface VoucherMapItem {
  id: number | string
  product_name: string
  restaurant_name?: string
  restaurant_lat?: number
  restaurant_lng?: number
  expires_at?: string
}

export default function VoucherMap<T extends VoucherMapItem>({
  vouchers, onMarkerClick, userLocation, focus, focusKey = 0,
}: {
  vouchers: T[]
  onMarkerClick: (v: T) => void
  userLocation?: { lat: number; lng: number } | null
  focus?: { lat: number; lng: number } | null
  /** 카드를 누를 때마다 바뀌는 값 — 같은 이용권을 다시 눌러도(지도를 손으로 옮긴 뒤) 핀으로 돌아가게 한다. */
  focusKey?: number
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
      const d = Math.ceil((parseUTCDate(iso).getTime() - Date.now()) / 86400000)  // UTC-naive(expires_at)
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
        const labelHtml = `<div style="transform:translateY(-46px);background:#11141C;color:#fff;font:600 11px system-ui,sans-serif;padding:5px 9px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.2)">${safeName}${dN !== null ? ` · D-${dN}` : ''}</div>`
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
        if (pts.length > 1 || userLocation) map.setBounds(bounds, 56, 40, FOCUS_BOTTOM_COVER, 40)
      }
    }).catch((err) => {
      if (import.meta.env.DEV) console.error('[VoucherMap]', err)
    })
    return () => { cancelled = true }
  }, [vouchers, onMarkerClick, userLocation])

  // 📐 2026-10-12 (대표 *"이용권 클릭하면 지도의 핀? 매장 위치가 지도 정중앙에 있지 않아"*):
  //   지도 칸이 화면 높이(dvh)를 따라가므로 주소창이 접히고 펴질 때마다 칸 크기가 바뀐다. 카카오 지도는
  //   칸 크기가 바뀐 걸 스스로 모르고 **옛 크기 기준으로** 가운데를 잡는다 → `relayout()` 을 불러 알린다.
  //   보던 가운데는 그대로 둔다(크기만 바뀌었지 사람이 옮긴 게 아니다).
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const map = mapRef.current
      if (!map) return
      const c = map.getCenter()
      map.relayout()
      map.setCenter(c)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 🎨 2026-06-21 (개선 #1): 하단 캐러셀에서 카드 탭 시 해당 매장으로 이동 (재초기화 X).
  // 📐 2026-10-12: 핀을 **보이는 칸의 한가운데**에 — 지도 아래쪽은 이용권 카드 줄이 덮고 있어서(처음 맞춤의
  //   아래 여백 100 과 같은 값) 기하학적 가운데에 두면 핀이 아래로 치우쳐 보였다. 그리고 핀은 끝(뾰족한 아래)이
  //   좌표라 그림은 그 위로 솟는다 → 그림 높이의 절반만큼 내려 핀 **몸통**이 가운데 오게 한다.
  useEffect(() => {
    const w = window as any
    const map = mapRef.current
    if (!focus || !map || !w.kakao?.maps) return
    map.relayout()
    map.setLevel(4)
    const target = new w.kakao.maps.LatLng(focus.lat, focus.lng)
    // 홈 지도(`useKakaoMap.panToProduct`)와 같은 방식 — 세계 좌표로 옮겨 계산(지도 칸 위치와 무관).
    try {
      const proj = map.getProjection()
      const p = proj.pointFromCoords(target)
      const dy = FOCUS_BOTTOM_COVER / 2 - PIN_HALF_HEIGHT
      map.panTo(proj.coordsFromPoint(new w.kakao.maps.Point(p.x, p.y + dy)))
    } catch { map.setCenter(target) /* 투영 실패 — 좌표 그대로 가운데(종전 동작) */ }
  }, [focus?.lat, focus?.lng, focusKey])

  function recenter() {
    const w = window as any
    if (!mapRef.current || !userLocation || !w.kakao?.maps) return
    mapRef.current.setCenter(new w.kakao.maps.LatLng(userLocation.lat, userLocation.lng))
    mapRef.current.setLevel(4)
  }

  if (vouchers.length === 0) {
    return (
      <div className="rounded-xl p-12 text-center">
        <p className="text-[15px] text-gray-500 dark:text-gray-400">지도에 표시할 미사용 이용권이 없어요</p>
      </div>
    )
  }

  return (
    // 🗺️ 2026-10-11 대표 신고(지도로 보기 화면이 깨짐): ① 높이를 부모에 맞춘다 — 400 고정이라 460 칸 아래 60px 가
    //   비었고 그 자리에 깔린 이용권 카드가 지도 밑으로 들어가 반쯤 가려졌다. ② `isolation` 으로 카카오 지도 내부의
    //   z-index 를 이 상자 안에 가둔다 — 안 가두면 위에 올린 카드보다 지도 타일이 앞에 그려진다.
    <div className="relative rounded-xl overflow-hidden" style={{ height: '100%', minHeight: 400, isolation: 'isolate' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* 🎨 현위치 재중심 버튼 (시안 우상단) */}
      {userLocation && (
        <button
          type="button"
          onClick={recenter}
          aria-label="내 위치로 이동"
          className="absolute right-3 top-3 z-[2] w-10 h-10 flex items-center justify-center rounded-xl bg-surface text-gray-900 dark:text-white shadow-md active:scale-95 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4.2" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      )}
    </div>
  )
}
