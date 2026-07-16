import { useEffect, useRef, useState } from 'react'
import { MapPin, ChevronDown, LocateFixed, Loader2, X } from 'lucide-react'
import { KOREA_REGIONS, findRegionByKey } from '@/shared/constants/korea-regions'
import { toast } from '@/hooks/useToast'

/**
 * 🗺️ 2026-07-16 (대표 — PC 홈 위치 필터): "현재 위치 어디인지 + 장소 설정 + 가까운 이용권 필터".
 *   카테고리 위(홈 상단)에 지역 표시/선택 바. 선택 지역(시/도 key + 세부지역 key)을 상위(PcHomePage)로 올려
 *   GroupBuyFeed 가 business_address 텍스트 매칭(matchAddress)으로 그 지역 딜만 노출.
 *   - "현 위치로 설정": 브라우저 GPS → Kakao coord2Address → 주소를 KOREA_REGIONS 키워드에 매칭해 지역 자동 선택.
 *   - 선택은 localStorage(ur_home_region_v1)에 저장 → 재방문 시 유지(지도와 별개 홈 전용 키).
 *   라이트 기본 + dark: 대응(홈 테마 정합).
 */

export interface HomeRegion { regionKey?: string; districtKey?: string }

const LS_KEY = 'ur_home_region_v1'

export function readHomeRegion(): HomeRegion {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (raw && typeof raw === 'object') return { regionKey: raw.regionKey || undefined, districtKey: raw.districtKey || undefined }
  } catch { /* ignore */ }
  return {}
}

function labelFor(r: HomeRegion): string {
  if (!r.regionKey) return '전국'
  const region = findRegionByKey(r.regionKey)
  if (!region) return '전국'
  if (r.districtKey) {
    const dg = region.districtGroups.find(g => g.key === r.districtKey)
    if (dg) return `${region.label} · ${dg.label.split('/')[0]}`
  }
  return region.label
}

export default function PcHomeLocationBar({
  value,
  onChange,
  onLocate,
  located = false,
}: {
  value: HomeRegion
  onChange: (r: HomeRegion) => void
  // 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): GPS 성공 시 실좌표를 상위로 → 피드 거리순 정렬.
  onLocate?: (loc: { lat: number; lng: number }) => void
  // 거리순(near) 모드 활성 여부 — 라벨을 '내 주변'으로 표시.
  located?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  // 피커에서 펼쳐볼 시/도(우측 세부지역 표시용) — 선택 지역 또는 첫 항목.
  const [activeSido, setActiveSido] = useState<string>(value.regionKey || KOREA_REGIONS[0]?.key || '')
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const apply = (r: HomeRegion) => {
    onChange(r)
    try { localStorage.setItem(LS_KEY, JSON.stringify(r)) } catch { /* ignore */ }
    setOpen(false)
  }

  const useMyLocation = async () => {
    if (!('geolocation' in navigator)) { toast.error('이 브라우저는 위치를 지원하지 않아요'); return }
    setLocating(true)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 })
      )
      const { latitude: lat, longitude: lng } = pos.coords
      try { localStorage.setItem('ur_last_loc_v1', JSON.stringify({ lat, lng })) } catch { /* ignore */ }
      // 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): 실좌표를 상위로 → 피드를 '가까운 순' 정렬(지역 필터 아님,
      //   숨기지 않고 거리순 재배열). 역지오코딩/지역세팅은 하지 않음(빈 화면·Kakao 의존 제거).
      onLocate?.({ lat, lng })
      toast.success('현 위치 기준 가까운 순으로 정렬했어요')
    } catch {
      toast.error('위치 권한이 필요해요 — 지역을 직접 선택할 수 있어요')
      setOpen(true)
    } finally {
      setLocating(false)
    }
  }

  const sido = KOREA_REGIONS.find(r => r.key === activeSido) || KOREA_REGIONS[0]

  return (
    <div ref={boxRef} className="relative inline-block">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-2 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          aria-expanded={open}
        >
          <MapPin className="w-[18px] h-[18px] text-gray-900 dark:text-white shrink-0" />
          <span className="text-[15px] font-extrabold text-gray-900 dark:text-white max-w-[220px] truncate">{located ? '내 주변' : labelFor(value)}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/[0.04] text-[13px] font-bold text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-60"
        >
          {locating ? <Loader2 className="w-[15px] h-[15px] animate-spin" /> : <LocateFixed className="w-[15px] h-[15px]" />}
          현 위치로 설정
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[10500] w-[520px] max-w-[90vw] rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] shadow-[0_12px_40px_rgba(0,0,0,0.18)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
            <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">지역 선택</span>
            <div className="flex items-center gap-2">
              <button onClick={() => apply({})} className="text-[12px] font-bold text-gray-500 dark:text-gray-400 hover:underline">전국</button>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex h-[320px]">
            {/* 시/도 */}
            <div className="w-[42%] overflow-y-auto border-r border-gray-100 dark:border-[#1A1A1A] py-1">
              {KOREA_REGIONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => { if (r.districtGroups.length === 0) apply({ regionKey: r.key }); else setActiveSido(r.key) }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                    activeSido === r.key
                      ? 'bg-gray-100 dark:bg-white/[0.06] font-bold text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {/* 세부지역 */}
            <div className="flex-1 overflow-y-auto py-1">
              <button
                onClick={() => apply({ regionKey: sido?.key })}
                className="w-full text-left px-4 py-2.5 text-[13px] font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/[0.03]"
              >
                {sido?.label} 전체
              </button>
              {sido?.districtGroups.map(dg => (
                <button
                  key={dg.key}
                  onClick={() => apply({ regionKey: sido.key, districtKey: dg.key })}
                  className={`w-full text-left px-4 py-2.5 text-[13px] whitespace-pre-line leading-tight transition-colors ${
                    value.districtKey === dg.key
                      ? 'bg-gray-100 dark:bg-white/[0.06] font-bold text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  {dg.label}
                </button>
              ))}
              {sido && sido.districtGroups.length === 0 && (
                <p className="px-4 py-3 text-[12px] text-gray-400 dark:text-gray-500">세부 지역은 준비 중이에요.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
