import React from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-lite'
import { useSafeBack } from '@/hooks/useSafeBack'
import { CART_CLS, CART_COPY, CART_BACK_ICON } from '@/shared/cart-page' // 🧺 2026-11-10 서버 첫 화면(worker/utils/cart-first-screen.ts)과 같은 머리줄

interface CartHeaderProps {
  itemCount: number
  allSelected: boolean
  selectedCount: number
  // 🛡️ 2026-05-20: 판매종료 (product_is_active === 0) 항목 일괄 삭제. 0 이면 버튼 숨김.
  inactiveCount?: number
  onToggleSelectAll: () => void
  onDeleteSelected: () => void
  onDeleteInactive?: () => void
}

export const CartHeader = React.memo(function CartHeader({
  itemCount,
  allSelected,
  selectedCount,
  inactiveCount = 0,
  onToggleSelectAll,
  onDeleteSelected,
  onDeleteInactive,
}: CartHeaderProps) {
  const { t } = useTranslation()

  // ← 판정은 useSafeBack 한 곳(history.length 는 앱 밖 칸도 센다 — 2026-11-03).
  const handleBack = useSafeBack('/')

  return (
    <>
      {/* v4 sticky white header: X left, title center, spacer right */}
      <div className={CART_CLS.header}>
        {/* 🖥️ 2026-09-02 (대표 "PC 버전도 확인"): 본문 `<main>` 이 lg 에서 1020px 인데 이 줄만 448px(max-w-md) 이라
            닫기 버튼·제목이 본문과 다른 축에 섰다. 같은 폭으로. */}
        <div className={CART_CLS.headerRow}>
          <button type="button" onClick={handleBack} aria-label={t('common.back', { defaultValue: CART_COPY.back })} className={CART_CLS.back}>
            <X size={CART_BACK_ICON} className={CART_CLS.backIcon} aria-hidden="true" />
          </button>
          <h1 className={CART_CLS.title}>
            {t('cart.title', { defaultValue: CART_COPY.title })}{' '}
            {itemCount > 0 && <span className={CART_CLS.count}>{itemCount}</span>}
          </h1>
          <div className={CART_CLS.spacer} />
        </div>
      </div>

      {/* Select-all row */}
      {itemCount > 0 && (
        <div className="bg-gray-50 dark:bg-[#1D1F29] border-b border-gray-100 dark:border-[#2C2F35]">
          <div className="mx-auto max-w-md lg:max-w-[1020px] flex items-center justify-between px-5 py-2">
            <button
              type="button"
              onClick={onToggleSelectAll}
              aria-pressed={allSelected}
              className="flex items-center gap-2 select-none group"
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${
                  allSelected
                    ? 'bg-brand border-brand'
                    : 'bg-white dark:bg-[#1D1F29] border-rule-strong group-hover:border-gray-400'
                }`}
              >
                {allSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-[13px] font-medium text-gray-900 dark:text-white">
                {t('cart.selectAll', { defaultValue: '전체선택' })}
              </span>
              <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                {selectedCount}/{itemCount}
              </span>
            </button>

            <div className="flex items-center gap-3">
              {inactiveCount > 0 && onDeleteInactive && (
                <button
                  onClick={onDeleteInactive}
                  className="text-[13px] font-medium text-orange-500 dark:text-orange-400 hover:text-orange-600 transition-colors whitespace-nowrap"
                  title={t('cart.deleteInactiveHint', { defaultValue: '판매가 종료된 상품을 한 번에 삭제합니다' })}
                >
                  {t('cart.deleteInactive', { defaultValue: '판매종료 삭제' })}
                  <span className="ml-1 text-gray-400 tabular-nums">({inactiveCount})</span>
                </button>
              )}
              <button
                onClick={onDeleteSelected}
                disabled={selectedCount === 0}
                className="text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {t('cart.deleteSelected', { defaultValue: '선택삭제' })}
                {selectedCount > 0 && (
                  <span className="ml-1 text-gray-400 dark:text-gray-500">({selectedCount})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})
