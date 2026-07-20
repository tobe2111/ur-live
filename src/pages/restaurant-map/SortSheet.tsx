/**
 * 🗺️ 2026-07-15 (대표 — "할인율 순 버튼 누르면 우리 서비스 팝업으로"): 지도/리스트 정렬 선택을
 *   OS 네이티브 `<select>` 대신 **인앱 바텀시트 팝업**으로. (배민/야놀자/토스식.)
 */
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import type { SortBy } from './types'
import { Z } from '@/constants/z-index'

const OPTIONS: { key: SortBy; labelKey: string; def: string; needsLoc?: boolean }[] = [
  { key: 'distance', labelKey: 'restaurantMap.sort.distance', def: '가까운 순', needsLoc: true },
  { key: 'discount', labelKey: 'restaurantMap.sort.discount', def: '할인율 순' },
  { key: 'price', labelKey: 'restaurantMap.sort.price', def: '낮은 가격 순' },
  { key: 'rating', labelKey: 'restaurantMap.sort.rating', def: '평점 순' },
]

export default function SortSheet({
  sortBy,
  setSortBy,
  hasUserLoc,
  onClose,
}: {
  sortBy: SortBy
  setSortBy: (v: SortBy) => void
  hasUserLoc: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const opts = OPTIONS.filter((o) => !o.needsLoc || hasUserLoc)

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ zIndex: Z.SHEET_BODY }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-[#0F151D] rounded-t-3xl sm:rounded-3xl p-4 pb-8 sm:pb-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white">{t('map.sheet.sortAria', { defaultValue: '정렬' })}</h3>
          <button onClick={onClose} aria-label={t('common.close', { defaultValue: '닫기' })} className="p-1.5 rounded-full bg-gray-100 dark:bg-[#1A2334] text-gray-500 dark:text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1">
          {opts.map((o) => {
            const sel = sortBy === o.key
            return (
              <button
                key={o.key}
                onClick={() => { setSortBy(o.key); onClose() }}
                aria-pressed={sel}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-[14px] transition-colors ${
                  sel
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-bold'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1A2334]'
                }`}
              >
                <span>{t(o.labelKey, { defaultValue: o.def })}</span>
                {sel && <Check className="w-4 h-4" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
