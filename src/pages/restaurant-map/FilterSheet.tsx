/**
 * 🛡️ 2026-05-01: TD-018 1387줄 분할 — RestaurantMapPage 의 FilterSheet 분리.
 *
 * 🛍️ 2026-06-20 (대표 — 필터 팝업 개선 A안): 식당 cuisine(한식/일식) 제거.
 *   카테고리 축은 상단 voucherType 칩(식사/뷰티/헬스/숙소/반려/액티비티)이 담당하고,
 *   팝업은 '상세 조건' = 지역(도시) + 정렬 + 거리반경 + 가격대 에 집중.
 *   (지역 시→군/구→동 계층은 행정구역 데이터 확보 후 후속 — 현재는 시/도 단위 flat.)
 * PC 에선 max-w-[430px] 중앙 정렬 (모바일 앱 프레임 일관성).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { REGIONS } from './constants'
import type { SortBy } from './types'

export type PriceRange = 'all' | 'under10' | '10to30' | 'over30'

interface Props {
  region: string
  sortBy: SortBy
  radiusKm: number
  priceRange: PriceRange
  hasUserLoc: boolean
  onApply: (region: string, sortBy: SortBy, radiusKm: number, priceRange: PriceRange) => void
  onClose: () => void
}

const RADIUS_OPTS: Array<{ v: number; label: string }> = [
  { v: 0, label: '전체' },
  { v: 1, label: '1km' },
  { v: 3, label: '3km' },
  { v: 5, label: '5km' },
]
const PRICE_OPTS: Array<{ v: PriceRange; label: string }> = [
  { v: 'all', label: '전체' },
  { v: 'under10', label: '1만원 이하' },
  { v: '10to30', label: '1~3만원' },
  { v: 'over30', label: '3만원 이상' },
]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        active
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
          : 'bg-gray-50 dark:bg-[#121212] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2A2A2A]'
      }`}
    >
      {children}
    </button>
  )
}

export default function FilterSheet({ region: initialRegion, sortBy: initialSort, radiusKm: initialRadius, priceRange: initialPrice, hasUserLoc, onApply, onClose }: Props) {
  useEscapeKey(onClose)
  const { t } = useTranslation()
  const [r, setR] = useState(initialRegion)
  const [sort, setSort] = useState<SortBy>(initialSort)
  const [radius, setRadius] = useState(initialRadius)
  const [price, setPrice] = useState<PriceRange>(initialPrice)

  const sortOpts: Array<{ v: SortBy; label: string }> = [
    ...(hasUserLoc ? [{ v: 'distance' as SortBy, label: t('restaurantMap.sort.distance', { defaultValue: '거리순' }) }] : []),
    { v: 'discount', label: t('restaurantMap.sort.discount', { defaultValue: '할인율순' }) },
    { v: 'price', label: t('restaurantMap.sort.price', { defaultValue: '가격순' }) },
    { v: 'rating', label: t('restaurantMap.sort.rating', { defaultValue: '평점순' }) },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose} role="presentation">
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-t-3xl w-full max-w-[430px] max-h-[85dvh] overflow-y-auto sm:rounded-3xl sm:my-auto sm:mb-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('map.filter.ariaLabel', { defaultValue: '필터 설정' })}
      >
        <div className="sticky top-0 bg-white dark:bg-[#0A0A0A] px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between z-10">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('map.filter.title', { defaultValue: '필터' })}</h3>
          <button
            onClick={() => { setR(''); setSort(hasUserLoc ? 'distance' : 'discount'); setRadius(0); setPrice('all') }}
            className="text-xs font-semibold text-gray-500 dark:text-gray-400"
            aria-label={t('map.filter.resetAria', { defaultValue: '필터 초기화' })}
          >
            {t('map.filter.reset', { defaultValue: '초기화' })}
          </button>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">{t('map.filter.region', { defaultValue: '지역' })}</p>
            <div className="grid grid-cols-3 gap-2">
              {REGIONS.map(reg => (
                <Chip key={reg.key} active={r === reg.key} onClick={() => setR(reg.key)}>
                  <span>{reg.emoji}</span><span>{reg.label}</span>
                </Chip>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">{t('map.filter.sort', { defaultValue: '정렬' })}</p>
            <div className="grid grid-cols-3 gap-2">
              {sortOpts.map(o => (
                <Chip key={o.v} active={sort === o.v} onClick={() => setSort(o.v)}>{o.label}</Chip>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">
              {t('map.filter.radius', { defaultValue: '거리 반경' })}
              {!hasUserLoc && <span className="ml-1.5 normal-case text-[10px] font-medium text-gray-400">{t('map.filter.radiusNeedLoc', { defaultValue: '· 위치 허용 필요' })}</span>}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {RADIUS_OPTS.map(o => (
                <Chip key={o.v} active={radius === o.v} onClick={() => hasUserLoc && setRadius(o.v)}>{o.label}</Chip>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">{t('map.filter.price', { defaultValue: '가격대' })}</p>
            <div className="grid grid-cols-2 gap-2">
              {PRICE_OPTS.map(o => (
                <Chip key={o.v} active={price === o.v} onClick={() => setPrice(o.v)}>{o.label}</Chip>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-[#0A0A0A] px-5 py-4 border-t border-gray-100 dark:border-[#1A1A1A]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => onApply(r, sort, radius, price)}
            className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold rounded-2xl active:scale-[0.98] transition-transform"
          >
            {t('map.filter.apply', { defaultValue: '적용' })}
          </button>
        </div>
      </div>
    </div>
  )
}
