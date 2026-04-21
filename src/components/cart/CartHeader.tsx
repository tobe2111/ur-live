import React from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 py-3">
          <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center">
            <X size={22} className="text-gray-900" />
          </button>
          <h1 className="text-[16px] font-extrabold text-gray-900">
            장바구니{' '}
            {itemCount > 0 && <span className="text-pink-500">{itemCount}</span>}
          </h1>
          <div className="w-9" />
        </div>
      </div>

      {/* v4 select-all row */}
      {itemCount > 0 && (
        <div className="mx-auto max-w-md flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <span
              onClick={onToggleSelectAll}
              className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-colors ${
                allSelected
                  ? 'bg-pink-500 border-pink-500'
                  : 'bg-white border-gray-300'
              }`}
            >
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-[13px] font-medium text-gray-700">
              전체선택 ({selectedCount}/{itemCount})
            </span>
          </label>

          {selectedCount > 0 && (
            <button
              onClick={onDeleteSelected}
              className="text-[13px] font-medium text-gray-500 hover:text-gray-700"
            >
              선택삭제
            </button>
          )}
        </div>
      )}
    </>
  )
})
