/**
 * 🏠 홈 상단 헤더 (2026-07-01 대표 시안) — 검색 바 + 위치 행.
 *   1행: [원형 UR 로고] · [검색 pill "우선입장을 검색해 보세요!"] · [기록] · [알림 벨(미읽음 점)]
 *   2행: [📍 내 동네 ⌄] ······ [⊕ 현재 위치로]
 *
 * - 검색 pill 탭 → /search (입력은 검색 페이지에서). 벨 → /notifications, 기록 → /browse.
 * - 위치: localStorage `ur_home_region`(name,guCode) 라벨 + GPS(`/api/region/resolve`) → /group-buy?gucode=…
 *   (GroupBuyListPage 의 GPS 로직과 동일 SSOT 엔드포인트 재사용.)
 * - 테마: 라이트/다크 모두 지원(홈은 테마 토글 대상).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Clock, MapPin, ChevronDown, LocateFixed } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useUnreadCount } from '@/hooks/queries'

const REGION_KEY = 'ur_home_region'

function readRegion(): { name: string; guCode: string } | null {
  try {
    const raw = localStorage.getItem(REGION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    return p && p.name ? { name: String(p.name), guCode: String(p.guCode || '') } : null
  } catch { return null }
}

export default function HomeTopHeader() {
  const navigate = useNavigate()
  const { data: unreadCount = 0 } = useUnreadCount()
  const [region, setRegion] = useState<{ name: string; guCode: string } | null>(() => readRegion())
  const [detecting, setDetecting] = useState(false)

  const goRegion = () => {
    navigate(region?.guCode ? `/group-buy?gucode=${encodeURIComponent(region.guCode)}&guname=${encodeURIComponent(region.name)}` : '/group-buy')
  }

  const detectMyRegion = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('위치를 지원하지 않는 브라우저예요')
      return
    }
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await api.get('/api/region/resolve', { params: { lat: latitude, lng: longitude } })
          const d = res.data?.success ? (res.data.data as { region_gu?: string; region_si?: string; gu_code?: string }) : null
          if (d?.gu_code) {
            const name = d.region_gu || d.region_si || '내 동네'
            const next = { name, guCode: d.gu_code }
            setRegion(next)
            try { localStorage.setItem(REGION_KEY, JSON.stringify(next)) } catch { /* ignore */ }
            toast.success(`${name} 동네딜만 봐요`)
            api.post('/api/me/region', { lat: latitude, lng: longitude }).catch(() => { /* 비로그인/실패 무시 */ })
            navigate(`/group-buy?gucode=${encodeURIComponent(d.gu_code)}&guname=${encodeURIComponent(name)}`)
          } else {
            toast.error('동네를 찾지 못했어요')
          }
        } catch {
          toast.error('동네를 찾지 못했어요')
        } finally {
          setDetecting(false)
        }
      },
      () => { setDetecting(false); toast.error('위치 권한이 필요해요') },
      { timeout: 8000, maximumAge: 300000 },
    )
  }

  return (
    <div className="md:hidden lg:block sticky top-0 inset-x-0 z-30 bg-white/95 dark:bg-[#020202]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#1A1A1A]">
      <div className="ur-content-wide px-4 lg:px-8 pt-2 pb-2.5 space-y-2">
        {/* 1행: 로고 + 검색 + 기록 + 알림 */}
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/')} aria-label="홈" className="shrink-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 dark:bg-white">
              <span className="text-white dark:text-gray-900 font-black italic text-[13px] tracking-tight">UR</span>
            </span>
          </button>

          <button
            onClick={() => navigate('/search')}
            className="flex-1 min-w-0 flex items-center gap-2 h-10 px-3.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A] text-left"
            aria-label="검색"
          >
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" strokeWidth={2} />
            <span className="text-[13px] text-gray-400 dark:text-gray-500 truncate">우선입장을 검색해 보세요!</span>
          </button>

          <button onClick={() => navigate('/browse')} aria-label="최근 본" className="shrink-0 p-1.5 text-gray-700 dark:text-gray-200">
            <Clock className="w-[22px] h-[22px]" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => navigate('/notifications')}
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림'}
            className="shrink-0 p-1.5 relative text-gray-700 dark:text-gray-200"
          >
            <Bell className="w-[22px] h-[22px]" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* 2행: 위치 선택 + 현재 위치 */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={goRegion} className="flex items-center gap-1 min-w-0 text-gray-900 dark:text-white" aria-label="동네 선택">
            <MapPin className="w-4 h-4 text-red-500 shrink-0" strokeWidth={2.25} fill="currentColor" />
            <span className="text-[15px] font-bold truncate">{region?.name || '동네 선택'}</span>
            <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" strokeWidth={2.5} />
          </button>
          <button
            onClick={detectMyRegion}
            disabled={detecting}
            className="flex items-center gap-1 shrink-0 text-[12px] font-semibold text-gray-500 dark:text-gray-400 disabled:opacity-50"
          >
            <LocateFixed className="w-3.5 h-3.5" strokeWidth={2} />
            {detecting ? '찾는 중…' : '현재 위치로'}
          </button>
        </div>
      </div>
    </div>
  )
}
