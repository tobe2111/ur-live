import React from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface CartHeaderProps {
  itemCount: number
  allSelected: boolean
  selectedCount: number
  onToggleSelectAll: () => void
  onDeleteSelected: () => void
}

export const CartHeader = React.memo(function CartHeader({
  itemCount,
  allSelected,
  selectedCount,
  onToggleSelectAll,
  onDeleteSelected
}: CartHeaderProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <>
      {/* v4 sticky white header: X left, title center, spacer right */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 py-3">
          <button type="button" onClick={handleBack} aria-label={t('common.back', { defaultValue: '뒤로 가기' })} className="w-9 h-9 flex items-center justify-center">
            <X size={22} className="text-gray-900 dark:text-white" aria-hidden="true" />
          </button>
          <h1 className="text-[16px] font-extrabold text-gray-900 dark:text-white">
            {t('cart.title', { defaultValue: '장바구니' })}{' '}
            {itemCount > 0 && <span className="text-pink-500">{itemCount}</span>}
          </h1>
          <div className="w-9" />
        </div>
      </div>

      {/* Select-all row */}
      {itemCount > 0 && (
        <div className="bg-gray-50 dark:bg-[#121212] border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="mx-auto max-w-md flex items-center justify-between px-4 py-2.5">
            <button
              type="button"
              onClick={onToggleSelectAll}
              aria-pressed={allSelected}
              className="flex items-center gap-2.5 select-none group"
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${
                  allSelected
                    ? 'bg-pink-500 border-pink-500'
                    : 'bg-white dark:bg-[#0A0A0A] border-gray-300 dark:border-[#3A3A3A] group-hover:border-gray-400'
                }`}
              >
                {allSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
                {t('cart.selectAll', { defaultValue: '전체선택' })}
              </span>
              <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                {selectedCount}/{itemCount}
              </span>
            </button>

            <button
              onClick={onDeleteSelected}
              disabled={selectedCount === 0}
              className="text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {t('cart.deleteSelected', { defaultValue: '선택삭제' })}
              {selectedCount > 0 && (
                <span className="ml-1 text-gray-400 dark:text-gray-500">({selectedCount})</span>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
})
