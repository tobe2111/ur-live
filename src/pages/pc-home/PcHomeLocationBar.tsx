import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
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
  locatedLabel,
  tone = 'panel',
}: {
  value: HomeRegion
  onChange: (r: HomeRegion) => void
  // 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): GPS 성공 시 실좌표를 상위로 → 피드 거리순 정렬.
  onLocate?: (loc: { lat: number; lng: number }) => void
  // 거리순(near) 모드 활성 여부 — 라벨을 '내 주변'으로 표시.
  located?: boolean
  /** 🧭 2026-08-30 (대표 "홈에선 현재 위치가 어딘지도 나와야지"): GPS 로 잡은 **동네 이름**.
   *  없으면 기존처럼 '내 주변' — 위치 이름을 못 얻었다고 화면이 깨지면 안 된다. */
  locatedLabel?: string
  /**
   * 🎨 2026-08-19 (대표 확정 — 통합형 히어로): 이 바가 **잉크 히어로 안**으로 들어갔다.
   *   `panel` = 예전처럼 흰 패널 위(라이트 테두리) · `hero` = 잉크 색면 위(반투명 흰 칩).
   *   ⚠️ 바뀌는 건 **트리거 버튼 두 개의 색뿐**이다 — 드롭다운 패널은 어느 tone 이든 흰색으로
   *   둔다(지역 목록은 17개 시/도 × 세부지역이라, 반투명 위에 얹으면 읽기가 나빠진다).
   */
  tone?: 'panel' | 'hero'
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
  /**
   * 📱 2026-08-27 (대표 폰 스크린샷 — "화면에서 나가고 있어"):
   *   패널이 `absolute left-0` 로 **버튼**에 붙어 있었는데, 모바일 헤더에서 그 버튼은 오른쪽에 있다.
   *   그래서 폭 520px(또는 90vw) 패널이 화면 오른쪽으로 삐져나가 **문서를 화면보다 넓게** 만들었다
   *   (실측 360px 기기: 문서폭 360 → **420**. 그래서 로고가 왼쪽으로 잘려 보였다).
   *   ⚠️ `max-w-[90vw]` 는 이걸 못 막는다 — 문서가 넓어지면 vw 도 같이 커져 자기 자신을 못 잡는다.
   *   ⇒ 좁은 화면에서는 버튼 좌표계를 벗어나 **뷰포트에 고정**한다(좌우 8px 여백). 넓은 화면은 종전 그대로.
   */
  /**
   * ⚠️ 640 이 아니라 **768** 이다 (2026-08-29 대표 스크린샷 — 640~767 구간에서 또 밀렸다).
   *   이 바가 **오른쪽에 놓이는 모바일 헤더**(`MobileHomePage`)는 768px 까지 쓰이고, 그 위에서야
   *   PC 헤더(`DesktopTopNav`, `hidden md:block`)로 바뀌며 바가 왼쪽으로 간다.
   *   게이트를 640 으로 두면 **640~767 구간만** 옛 `absolute left-0` 로 돌아가 문서가 다시 넓어진다
   *   (실측: 700px 뷰포트에서 문서폭 +179). 폰을 가로로 눕히면 바로 이 구간이다.
   *   ⇒ 중단점은 **레이아웃이 실제로 바뀌는 곳**과 같아야 한다. 임의로 고르면 반드시 틈이 생긴다.
   */
  const isWide = useMediaQuery('(min-width: 768px)')
  const [panelTop, setPanelTop] = useState(0)
  useEffect(() => {
    if (!open || isWide) return
    const measure = () => {
      const el = boxRef.current
      if (el) setPanelTop(el.getBoundingClientRect().bottom + 8)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, isWide])

  const hero = tone === 'hero'
  // 히어로(잉크 색면) 위에서는 흰 테두리 칩, 흰 패널 위에서는 기존 라이트 버튼.
  const chip = hero
    ? 'border-white/30 bg-white/[0.13] hover:bg-white/20 text-white'
    : 'border-gray-200 dark:border-[#2A3446] bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/[0.04]'

  return (
    <div ref={boxRef} className="relative inline-block">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(o => !o)}
          className={`inline-flex items-center gap-1.5 ${hero ? 'pl-3 pr-2.5 py-2 rounded-full' : 'pl-2.5 pr-2 py-2 rounded-xl'} border transition-colors ${chip}`}
          aria-expanded={open}
        >
          <MapPin className={`${hero ? 'w-4 h-4' : 'w-[18px] h-[18px]'} shrink-0 ${hero ? 'text-white' : 'text-gray-900 dark:text-white'}`} />
          <span className={`${hero ? 'text-[13px] font-bold text-white' : 'text-[15px] font-extrabold text-gray-900 dark:text-white'} max-w-[220px] truncate`}>{located ? (locatedLabel || '내 주변') : labelFor(value)}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${hero ? 'text-white/70' : 'text-gray-400'} ${open ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={useMyLocation}
          disabled={locating}
          className={`inline-flex items-center gap-1.5 ${hero ? 'px-4 py-2 rounded-full' : 'px-3 py-2 rounded-xl'} border text-[13px] font-bold whitespace-nowrap transition-colors disabled:opacity-60 ${chip} ${hero ? '' : 'text-gray-700 dark:text-gray-200'}`}
        >
          {locating ? <Loader2 className="w-[15px] h-[15px] animate-spin" /> : <LocateFixed className="w-[15px] h-[15px]" />}
          {/* 📱 2026-08-19: 좁은 폭(<640)에서는 **아이콘만**. 360px 기기에서 이 라벨이 세 줄로 터져
              헤더가 무너졌다(모바일 홈이 이 바를 쓰게 되면서 드러났다). PC 히어로는 항상 sm 이상이라
              라벨이 그대로 보인다. `whitespace-nowrap` 으로 어떤 폭에서도 줄바꿈은 금지. */}
          <span className="hidden sm:inline whitespace-nowrap">현 위치로 설정</span>
        </button>
      </div>

      {open && (
        <div
          className={`z-[10500] rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] shadow-[0_12px_40px_rgba(0,0,0,0.18)] overflow-hidden ${
            isWide ? 'absolute left-0 top-[calc(100%+8px)] w-[520px]' : 'fixed left-2 right-2'
          }`}
          style={isWide ? undefined : { top: panelTop }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#2A3446]">
            <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">지역 선택</span>
            <div className="flex items-center gap-2">
              <button onClick={() => apply({})} className="text-[12px] font-bold text-gray-500 dark:text-gray-400 hover:underline">전국</button>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {/* 좁은 화면에서는 화면 높이를 넘지 않게 — 넘으면 아래 항목을 영영 못 고른다. */}
          <div className="flex h-[320px] max-h-[calc(100dvh-160px)]">
            {/* 시/도 */}
            <div className="w-[42%] overflow-y-auto border-r border-gray-100 dark:border-[#2A3446] py-1">
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
