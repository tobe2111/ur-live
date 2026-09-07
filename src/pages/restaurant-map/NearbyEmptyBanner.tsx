/**
 * 🗺️ 2026-07-19 (대표 — 거리 표시 로직): "내 주변 · 거리순"인데 반경(5km) 안에 딜이 0개면
 *   원거리 딜(42km)이 최상단에 그대로 떠 "동네딜" 컨셉·신규 지역 유저 첫인상과 충돌 →
 *   리스트 상단 안내 배너 + 지역선택 유도. 가장 가까운 딜 거리(좌표 보유 딜 기준)만 계산 —
 *   정렬/필터/노출 자체는 불변(안내만 추가). 조건 미충족이면 null(렌더 0).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { distanceKm } from './utils'
import type { Restaurant } from './types'

const NEAR_RADIUS_KM = 5

export default function NearbyEmptyBanner({ loading, userLoc, sortBy, list, onOpenRegion }: {
  loading: boolean
  userLoc: { lat: number; lng: number } | null
  sortBy: string
  list: Restaurant[]
  /** "지역 선택" CTA — 필터/지역 시트 열기 */
  onOpenRegion: () => void
}) {
  const { t } = useTranslation()
  const nearestKm = useMemo(() => {
    if (!userLoc) return null
    let min = Infinity
    for (const r of list) {
      if (r.restaurant_lat && r.restaurant_lng) {
        const d = distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng)
        if (d < min) min = d
      }
    }
    return Number.isFinite(min) ? min : null
  }, [list, userLoc])

  const show = !loading && !!userLoc && sortBy === 'distance' && list.length > 0
    && nearestKm != null && nearestKm > NEAR_RADIUS_KM
  if (!show) return null

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-[#1D1F29] border border-gray-100 dark:border-[#2C2F35] px-3.5 py-3">
      <p className="text-[12.5px] leading-snug text-gray-500 dark:text-gray-400 min-w-0">
        <span className="block font-bold text-gray-900 dark:text-white">
          {t('restaurantMap.farBannerTitle', { defaultValue: '내 주변엔 아직 딜이 없어요' })}
        </span>
        {t('restaurantMap.farBannerDesc', { defaultValue: '가까운 순으로 보여드릴게요' })}
      </p>
      <button
        onClick={onOpenRegion}
        className="shrink-0 px-3 py-2 rounded-lg bg-white dark:bg-[#11141C] border border-gray-200 dark:border-[#2C2F35] text-[12px] font-bold text-gray-900 dark:text-white active:scale-95 transition-transform"
      >
        {t('restaurantMap.farBannerCta', { defaultValue: '지역 선택' })}
      </button>
    </div>
  )
}
