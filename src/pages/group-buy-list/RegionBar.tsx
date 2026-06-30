// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 지역 필터 바(verbatim 추출). 동작 불변.
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, ChevronDown } from 'lucide-react'
import type { CategoryFilter } from './types'

export default function RegionBar({ category, regionKey, gpsRegion, regionButtonLabel, detectingRegion, setRegionPickerOpen, detectMyRegion, applyRegion }: {
  category: CategoryFilter
  regionKey: string | null
  gpsRegion: { guCode: string; name: string } | null
  regionButtonLabel: string
  detectingRegion: boolean
  setRegionPickerOpen: Dispatch<SetStateAction<boolean>>
  detectMyRegion: () => void
  applyRegion: (r: string | null, d: string | null) => void
}) {
  const { t } = useTranslation()
  return (
      <div className={`ur-content-wide px-4 lg:px-8 mt-3 ${category === 'general' ? 'hidden' : 'flex items-center gap-2'}`}>
        <button
          onClick={() => setRegionPickerOpen(true)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-semibold border transition-colors ${
            (regionKey || gpsRegion)
              ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900'
              : 'bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300'
          }`}
          aria-label="지역 선택"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="max-w-[150px] truncate">{gpsRegion ? `📍 ${gpsRegion.name}` : regionButtonLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>
        {/* 🗺️ GPS 내 동네 자동 감지 */}
        <button
          onClick={detectMyRegion}
          disabled={detectingRegion}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-full text-[13px] font-semibold border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 disabled:opacity-50"
          aria-label={t('groupBuy.detectMyRegion', { defaultValue: '내 동네 자동 감지' })}
        >
          {detectingRegion
            ? t('groupBuy.detecting', { defaultValue: '감지 중…' })
            : `📍 ${t('groupBuy.myNeighborhood', { defaultValue: '내 동네' })}`}
        </button>
        {(regionKey || gpsRegion) && (
          <button
            onClick={() => applyRegion(null, null)}
            className="text-[12px] text-gray-500 dark:text-gray-400 underline underline-offset-2"
            aria-label={t('groupBuy.clearRegion', { defaultValue: '지역 필터 해제' })}
          >
            {t('groupBuy.clearRegionShort', { defaultValue: '해제' })}
          </button>
        )}
      </div>
  )
}
