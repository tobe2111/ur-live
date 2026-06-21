/**
 * 🛡️ 2026-05-01: TD-018 1387줄 분할 — RestaurantMapPage 의 FilterSheet 분리.
 *
 * 모바일 bottom sheet UI 로 지역(도시) 필터 선택.
 * 🛍️ 2026-06-20 (대표 — 구조 정리): 식당 cuisine 카테고리(한식/일식/중식) 섹션 제거.
 *   동네딜 카테고리 축은 상단 voucherType 칩(식사/뷰티/헬스/숙박/반려/액티비티)이 담당 → 여기선 '지역'만.
 * PC 에선 max-w-[430px] 중앙 정렬 (모바일 앱 프레임 일관성).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { REGIONS } from './constants'

interface Props {
  region: string
  onApply: (region: string) => void
  onClose: () => void
}

export default function FilterSheet({ region: initialRegion, onApply, onClose }: Props) {
  useEscapeKey(onClose)
  const { t } = useTranslation()
  const [r, setR] = useState(initialRegion)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose} role="presentation">
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-t-3xl w-full max-w-[430px] max-h-[80dvh] overflow-y-auto sm:rounded-3xl sm:my-auto sm:mb-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('map.filter.ariaLabel', { defaultValue: '필터 설정' })}
      >
        <div className="sticky top-0 bg-white dark:bg-[#0A0A0A] px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('map.filter.title', { defaultValue: '지역 선택' })}</h3>
          <button
            onClick={() => setR('')}
            className="text-xs font-semibold text-gray-500 dark:text-gray-400"
            aria-label={t('map.filter.resetAria', { defaultValue: '필터 초기화' })}
          >
            {t('map.filter.reset', { defaultValue: '초기화' })}
          </button>
        </div>

        <div className="p-5">
          <section>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">{t('map.filter.region', { defaultValue: '지역' })}</p>
            <div className="grid grid-cols-3 gap-2">
              {REGIONS.map(reg => (
                <button
                  key={reg.key}
                  onClick={() => setR(reg.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    r === reg.key
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'bg-gray-50 dark:bg-[#121212] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2A2A2A]'
                  }`}
                >
                  <span>{reg.emoji}</span>
                  <span>{reg.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-[#0A0A0A] px-5 py-4 border-t border-gray-100 dark:border-[#1A1A1A]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => onApply(r)}
            className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold rounded-2xl active:scale-[0.98] transition-transform"
          >
            {t('map.filter.apply', { defaultValue: '적용' })}
          </button>
        </div>
      </div>
    </div>
  )
}
