import React from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Checkbox } from '@/components/ui/checkbox'

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

  return (
    <>
      {/* 상단 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft size={24} />
          </button>
          
          <h1 className="text-lg font-bold text-gray-900">
            장바구니 {itemCount > 0 && `(${itemCount})`}
          </h1>
          
          <div className="w-6" /> {/* Spacer for center alignment */}
        </div>
      </div>

      {/* 전체 선택 & 삭제 */}
      {itemCount > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={allSelected}
              onCheckedChange={onToggleSelectAll}
            />
            <span className="text-sm font-medium text-gray-700">
              전체 선택 ({selectedCount}/{itemCount})
            </span>
          </div>
          
          {selectedCount > 0 && (
            <button
              onClick={onDeleteSelected}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <X size={16} />
              선택 삭제
            </button>
          )}
        </div>
      )}
    </>
  )
})
