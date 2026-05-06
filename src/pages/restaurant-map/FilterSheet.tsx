/**
 * 🛡️ 2026-05-01: TD-018 1387줄 분할 — RestaurantMapPage 의 FilterSheet 분리.
 *
 * 모바일 bottom sheet UI 로 지역 + 카테고리 필터 선택.
 * PC 에선 max-w-[430px] 중앙 정렬 (모바일 앱 프레임 일관성).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { REGIONS, CATEGORIES } from './constants'

interface Props {
  region: string
  category: string
  onApply: (region: string, category: string) => void
  onClose: () => void
}

export default function FilterSheet({ region: initialRegion, category: initialCategory, onApply, onClose }: Props) {
  useEscapeKey(onClose)
  const { t } = useTranslation()
  const [r, setR] = useState(initialRegion)
  const [c, setC] = useState(initialCategory)

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
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('map.filter.title', { defaultValue: '필터' })}</h3>
          <button
            onClick={() => { setR(''); setC('') }}
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
                <button
                  key={reg.key}
                  onClick={() => setR(reg.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    r === reg.key
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                      : 'bg-gray-50 dark:bg-[#121212] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2A2A2A]'
                  }`}
                >
                  <span>{reg.emoji}</span>
                  <span>{reg.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">{t('map.filter.category', { defaultValue: '카테고리' })}</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key || 'all'}
                  onClick={() => setC(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    c === cat.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 dark:bg-[#121212] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2A2A2A]'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-[#0A0A0A] px-5 py-4 border-t border-gray-100 dark:border-[#1A1A1A]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => onApply(r, c)}
            className="w-full py-3.5 bg-pink-500 text-white text-sm font-bold rounded-2xl active:scale-[0.98] transition-transform"
          >
            {t('map.filter.apply', { defaultValue: '적용' })}
          </button>
        </div>
      </div>
    </div>
  )
}
