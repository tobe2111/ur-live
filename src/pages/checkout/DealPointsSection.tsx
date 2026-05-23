/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 의 딜 포인트 입력 섹션.
 *
 * 사용자가 보유한 딜 포인트 일부 / 전액 차감.
 */
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'

interface Props {
  dealBalance: number
  dealToUse: number
  setDealToUse: (v: number) => void
  totalBeforeDeal: number
  totalAmount: number
}

export default function DealPointsSection({ dealBalance, dealToUse, setDealToUse, totalBeforeDeal, totalAmount }: Props) {
  const { t } = useTranslation()
  return (
    <div className="bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] px-5 py-5 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('checkout.deal.title', { defaultValue: '딜 포인트' })}</h3>
        <span className="text-[13px] text-gray-500 dark:text-gray-400">
          {t('checkout.deal.balancePrefix', { defaultValue: '보유' })} <span className="font-bold text-pink-500">{formatNumber(dealBalance)}</span>{t('checkout.summary.dealSuffix', { defaultValue: '딜' })}
        </span>
      </div>
      {/* 🛡️ 2026-05-23 영구 fix: flex children min-width:0 (min-w-0) — input 이 content 크기 유지하며
            shrink-0 '전액' 버튼을 viewport 밖으로 밀어내던 사고 (모바일 narrow 화면). */}
      <div className="flex items-center gap-2 w-full min-w-0">
        <input
          type="number"
          inputMode="numeric"
          value={dealToUse || ''}
          onChange={e => {
            const v = Math.min(Math.max(0, Number(e.target.value)), Math.min(dealBalance, totalBeforeDeal))
            setDealToUse(v)
          }}
          placeholder={t('checkout.deal.inputPlaceholder', { defaultValue: '사용할 딜 입력' })}
          aria-label={t('checkout.deal.inputAriaLabel', { defaultValue: '사용할 딜 포인트 입력' })}
          className="flex-1 min-w-0 px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-lg text-sm text-gray-900 dark:text-white text-right font-medium placeholder:text-gray-400 dark:text-gray-500"
        />
        <button
          onClick={() => setDealToUse(Math.min(dealBalance, totalBeforeDeal))}
          className="px-3 py-3 bg-gray-900 text-white rounded-lg text-[11px] font-bold shrink-0 whitespace-nowrap"
        >{t('checkout.deal.useAll', { defaultValue: '전액' })}</button>
      </div>
      {dealToUse > 0 && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#2A2A2A]">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500 dark:text-gray-400">{t('checkout.deal.productAmount', { defaultValue: '상품 금액' })}</span>
            <span className="text-gray-700 dark:text-gray-200">{formatNumber(totalBeforeDeal)}{t('checkout.summary.wonSuffix', { defaultValue: '원' })}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] mt-1">
            <span className="text-pink-500 font-medium">{t('checkout.deal.dealDeduct', { defaultValue: '딜 포인트 차감' })}</span>
            <span className="text-pink-500 font-bold">-{formatNumber(dealToUse)}{t('checkout.summary.dealSuffix', { defaultValue: '딜' })}</span>
          </div>
          <div className="border-t border-gray-200 dark:border-[#2A2A2A] mt-2 pt-2 flex items-center justify-between">
            <span className="text-[13px] font-bold text-gray-900 dark:text-white">{t('checkout.deal.cardAmount', { defaultValue: '카드 결제 금액' })}</span>
            <span className="text-[15px] font-bold text-gray-900 dark:text-white">{Math.max(0, totalAmount)}{t('checkout.summary.wonSuffix', { defaultValue: '원' })}</span>
          </div>
        </div>
      )}
    </div>
  )
}
