/**
 * 💸 이용권 등록 — 정가 · 할인 [원 / %] · 판매가 (2026-10-07 대표 *"3000원 할인 이렇게도 선택해서"* → 1번 확정)
 *
 * 순서가 곧 사장님의 생각 순서다: **원래 얼마 → 얼마 깎아 줄까 → 그래서 얼마에 판다.**
 * 할인 칸은 판매가를 쓰는 손잡이일 뿐이고 진실은 판매가 하나다(`discount-input.ts` 머리말).
 * 정가를 안 쓰는 사장님은 종전처럼 판매가만 넣으면 된다(할인 칸은 정가가 없으면 잠긴다).
 *
 * 셀러 대시보드 = 라이트 고정(dark: 금지).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { priceFromDiscount, discountFromPrices, type DiscountMode } from './discount-input'

interface Props {
  price: number
  originalPrice: number
  update: (key: string, value: string | number | string[]) => void
}

const INPUT = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none disabled:bg-gray-50 disabled:text-gray-400'
const LABEL = 'block text-sm font-medium text-gray-700 mb-1'

export default function DiscountPriceFields({ price, originalPrice, update }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<DiscountMode>('pct')
  const hasList = originalPrice > 0
  const shown = discountFromPrices(originalPrice, price, mode)

  const onDiscount = (raw: string) => {
    if (!hasList) return
    update('price', raw === '' ? originalPrice : priceFromDiscount(originalPrice, mode, Number(raw)))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          {/* 라벨 줄 높이를 옆 칸(원/% 토글)과 맞춘다 — 안 맞추면 두 입력칸이 어긋나 보인다. */}
          <div className="mb-1 flex h-7 items-center">
            <label className="text-sm font-medium text-gray-700">{t('seller.mealVoucher.originalPrice')}</label>
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={originalPrice || ''}
            onChange={e => update('original_price', Number(e.target.value))}
            placeholder="50000"
            className={INPUT}
          />
        </div>
        <div>
          <div className="mb-1 flex h-7 items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{t('seller.mealVoucher.discountLabel', { defaultValue: '할인' })}</label>
            {/* 원 / % — 고르는 것은 **입력 방식**뿐이다. 손님 화면은 늘 % 로 보인다. */}
            <div role="radiogroup" aria-label={t('seller.mealVoucher.discountMode', { defaultValue: '할인 입력 방식' })}
              className="inline-flex rounded-md bg-gray-100 p-0.5 text-xs font-semibold">
              {(['pct', 'won'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-w-[32px] rounded px-2 py-1 ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  {m === 'pct' ? '%' : t('seller.mealVoucher.discountWon', { defaultValue: '원' })}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={mode === 'pct' ? 99 : undefined}
              disabled={!hasList}
              value={shown || ''}
              onChange={e => onDiscount(e.target.value)}
              placeholder={hasList ? (mode === 'pct' ? '20' : '3000') : t('seller.mealVoucher.discountNeedsList', { defaultValue: '정가 먼저' })}
              className={`${INPUT} pr-9`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {mode === 'pct' ? '%' : t('seller.mealVoucher.discountWon', { defaultValue: '원' })}
            </span>
          </div>
        </div>
      </div>

      <div>
        <label className={LABEL}>{t('seller.mealVoucher.sellingPrice')} *</label>
        <input
          type="number"
          inputMode="numeric"
          value={price || ''}
          onChange={e => update('price', Number(e.target.value))}
          placeholder="25000"
          className={INPUT}
          required
        />
        {hasList && (
          <p className="mt-1 text-xs text-gray-500">
            {t('seller.mealVoucher.salePriceAuto', { defaultValue: '할인을 넣으면 판매가가 자동으로 채워져요. 직접 고쳐도 돼요.' })}
          </p>
        )}
      </div>
    </div>
  )
}
