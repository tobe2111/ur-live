import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Search, X, Bell, ShoppingCart, Navigation, SlidersHorizontal } from 'lucide-react'
import { storage } from '@/shared/utils/storage'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { type MapVoucherType, MAP_VOUCHER_DEFS } from './voucher-types'

interface Props {
  search: string
  setSearch: (v: string) => void
  /** 🔎 2026-07-20: 검색 제출(Enter/최근검색 선택) — 지역/장소명이면 지도 재중심. */
  onSubmitSearch?: (q: string) => void
  searchFocused: boolean
  setSearchFocused: (v: boolean) => void
  searchHistory: string[]
  setSearchHistory: (v: string[]) => void
  pushSearchHistory: (q: string) => void
  voucherType: MapVoucherType
  setVoucherType: (v: MapVoucherType) => void
  nearMeMode: boolean
  requestNearMe: () => void
  activeFilterCount: number
  onOpenFilter: () => void
  home?: boolean
  /**
   * 🗺️ 2026-08-19 (대표 — "지도 위 검색·버튼들을 왼쪽 상품 리스트 상단으로"):
   *   `overlay` = 지도 위 플로팅(모바일 — 리스트가 시트로 접혀 있어 여기 말고 둘 데가 없다)
   *   `panel`   = PC 좌측 400px 리스트 패널의 헤더(지도는 지도만 보이게)
   *   ⚠️ 마크업은 **한 벌**이다. 두 벌로 두면 칩 하나 추가할 때 한쪽만 고쳐져 반드시 갈린다.
   */
  variant?: 'overlay' | 'panel'
}

/**
 * 🗺️ 2026-06-22 (대표 시안 — 야놀자식): 지도 위 상단 플로팅 바.
 *   Row1 = 깔끔한 **흰 네모(둥근 사각) 검색 박스**(레퍼런스 룩) + (홈)알림/장바구니.
 *   Row2 = 카테고리 칩(내 주변 + 전체/식사/뷰티/…) 흰 알약 가로 스크롤 + 필터.
 *   기존 full MapSearchHeader + 시트 내 칩(SheetFilterBar)을 대체. 정렬은 FilterSheet 위임.
 */
export default function MapTopBar({
  search,
  setSearch,
  onSubmitSearch,
  searchFocused,
  setSearchFocused,
  searchHistory,
  setSearchHistory,
  pushSearchHistory,
  voucherType,
  setVoucherType,
  nearMeMode,
  requestNearMe,
  activeFilterCount,
  onOpenFilter,
  home = false,
  variant = 'overlay',
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const panel = variant === 'panel'

  return (
    /* 🗺️ 2026-08-19 (대표 확정): PC(lg+)는 이 바가 **왼쪽 리스트 패널 안**(variant='panel')으로 들어가고,
       지도 위 오버레이(variant='overlay')는 `lg:hidden` 으로 모바일 전용이 된다. 이전엔 오버레이가
       지도 상단을 가로로 덮어(96px) 지도의 그 부분을 못 봤다. */
    <div className={panel
      ? 'hidden lg:block px-3 pt-3 pb-2.5 space-y-2 border-b border-gray-100 dark:border-[#2C2F35]'
      : 'lg:hidden absolute top-0 left-0 right-0 z-40 px-3 pt-3 pointer-events-none'}>
      <div className={panel ? 'space-y-2' : 'ur-content-wide pointer-events-auto space-y-2'}>
        {/* ── Row 1: 흰 네모박스 검색바 ── */}
        <div className="flex items-center gap-2">
          {panel ? null : home ? (
            <Link
              to="/"
              aria-label={t('nav.home', { defaultValue: '홈' })}
              /* 🎨 2026-07-19 (대표 — "로고 뒤 흰색 카드 없애줘, 투명하게"): 알약 카드(bg/border/shadow) 제거.
                 지도 위 가독성은 MapSearchHeader 와 동일한 옅은 드롭섀도로. h-11 터치 타깃 유지. */
              className="h-11 px-1 flex items-center justify-center shrink-0"
            >
              <span className="drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)] dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                <UrDealLogo size={18} />
              </span>
            </Link>
          ) : (
            <button
              onClick={() => navigate(-1)}
              aria-label={t('map.search.back', { defaultValue: '뒤로가기' })}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-[#0D0F12] border border-gray-200 dark:border-[#2C2F35] shadow-sm shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
          )}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') { pushSearchHistory(search); onSubmitSearch?.(search); (e.target as HTMLInputElement).blur() } }}
              placeholder={t('restaurantMap.searchPlaceholder')}
              aria-label={t('map.search.ariaLabel', { defaultValue: '검색' })}
              className="w-full h-11 pl-11 pr-9 bg-white dark:bg-[#0D0F12] rounded-2xl border border-gray-200 dark:border-[#2C2F35] text-sm text-ellipsis text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label={t('map.search.clearAria', { defaultValue: '검색어 지우기' })} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </button>
            )}
            {/* 최근 검색어 dropdown */}
            {searchFocused && !search && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0D0F12] rounded-2xl shadow-xl border border-gray-100 dark:border-[#2C2F35] overflow-hidden z-10">
                <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-[#2C2F35]">
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t('restaurantMap.recentSearch')}</span>
                  <button
                    onClick={() => { setSearchHistory([]); storage.setJSON('restaurant_search_history', []) }}
                    className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {t('map.search.deleteAll', { defaultValue: '전체 삭제' })}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchHistory.map((q) => (
                    <button
                      key={q}
                      onMouseDown={(e) => { e.preventDefault(); setSearch(q); pushSearchHistory(q); onSubmitSearch?.(q) }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1A1C21] flex items-center gap-2"
                    >
                      <Search className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {home && !panel && (
            <>
              <button
                onClick={() => navigate('/notifications')}
                aria-label={t('mainHome.ariaNotifications', { defaultValue: '알림' })}
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-[#0D0F12] border border-gray-200 dark:border-[#2C2F35] shadow-sm shrink-0"
              >
                <Bell className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              </button>
              <button
                onClick={() => navigate('/cart')}
                aria-label={t('mainHome.ariaCart', { defaultValue: '장바구니' })}
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-[#0D0F12] border border-gray-200 dark:border-[#2C2F35] shadow-sm shrink-0"
              >
                <ShoppingCart className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              </button>
            </>
          )}
        </div>

        {/* ── Row 2: 카테고리 ──
            🖥️ 2026-08-19 (대표 시안 — 카카오맵): 패널(PC 400px)은 **7칸을 한 줄**에 넣는다.
               [아이콘 위 · 라벨 아래]의 작은 버튼 7개를 균등 분배(grid-cols-7) — 카카오맵 하단
               '주변 탐색'(음식점·카페·버스·지하철·숙박·은행·편의점)과 같은 형태다.
               ⚠️ 이전 판은 알약 칩을 **줄바꿈**했다(2줄). 대표가 한 줄을 원했고, 알약으로는
                 400px 에 7개가 안 들어간다 — 그래서 모양 자체를 바꾼다.
               지도 오버레이(모바일)는 폭이 넓어 기존 알약 + 가로 스크롤 그대로. */}
        <div className={panel ? 'grid grid-cols-7 gap-0.5' : 'flex gap-1.5 items-center overflow-x-auto no-scrollbar'}>
          {/* 필터 */}
          <button
            data-testid="open-filter"
            onClick={onOpenFilter}
            aria-label={t('map.sheet.filterAria', { defaultValue: '지역·카테고리 필터 열기' })}
            className={panel
              ? `relative flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
                  activeFilterCount > 0 ? 'text-brand' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05]'}`
              : `flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-sm border transition-all ${
                  activeFilterCount > 0
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white dark:bg-[#0D0F12] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#2C2F35]'}`}
          >
            <SlidersHorizontal className={panel ? 'w-[17px] h-[17px]' : 'w-3.5 h-3.5'} />
            {panel && <span className="text-[10.5px] font-semibold leading-none">필터</span>}
            {activeFilterCount > 0 && (
              panel
                ? <span className="absolute top-0.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand" aria-hidden="true" />
                : <span className="inline-flex items-center justify-center min-w-[15px] h-3.5 px-1 rounded-full bg-white/25 text-[10px] font-bold">{activeFilterCount}</span>
            )}
          </button>
          {/* 내 주변 */}
          <button
            onClick={requestNearMe}
            aria-pressed={nearMeMode}
            className={panel
              ? `flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
                  nearMeMode ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05]'}`
              : `flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-sm border transition-all ${
                  nearMeMode
                    ? 'bg-gray-900 text-white border-blue-600'
                    : 'bg-white dark:bg-[#0D0F12] text-blue-600 dark:text-blue-400 border-gray-200 dark:border-[#2C2F35]'}`}
          >
            <Navigation className={panel ? 'w-[17px] h-[17px]' : 'w-3 h-3'} />
            <span className={panel ? 'text-[10.5px] font-semibold leading-none' : undefined}>{t('restaurantMap.nearMe')}</span>
          </button>
          {/* 카테고리 칩 */}
          {MAP_VOUCHER_DEFS.map(v => {
            const on = voucherType === v.key
            // 패널은 칸당 ~53px 라 긴 라벨이 잘린다 → shortLabel(있으면). 오버레이는 긴 라벨 그대로.
            const label = panel && v.shortLabel ? v.shortLabel : t(v.labelKey, { defaultValue: v.defaultLabel })
            return (
              <button
                key={v.key}
                onClick={() => setVoucherType(v.key)}
                aria-pressed={on}
                className={panel
                  ? `flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
                      on ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-white/[0.09] font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05]'}`
                  : `flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-sm border transition-all ${
                      on
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                        : 'bg-white dark:bg-[#0D0F12] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2C2F35]'}`}
              >
                <span className={panel ? 'text-[16px] leading-none' : undefined}>{v.emoji}</span>
                <span className={panel ? 'text-[10.5px] leading-none whitespace-nowrap' : undefined}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
