import { useState } from 'react'
import { Plus, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ProductOption {
  id?: number
  option_type: string
  option_value: string
  price_adjustment: number
  stock: number
}

interface ProductOptionFormProps {
  options: ProductOption[]
  onChange: (options: ProductOption[]) => void
  disabled?: boolean
}

export default function ProductOptionForm({ 
  options, 
  onChange, 
  disabled = false 
}: ProductOptionFormProps) {
  const [newOption, setNewOption] = useState<ProductOption>({
    option_type: '',
    option_value: '',
    price_adjustment: 0,
    stock: 0,
  })

  const handleAddOption = () => {
    if (!newOption.option_type.trim() || !newOption.option_value.trim()) {
      alert('옵션 타입과 값을 입력해주세요.')
      return
    }

    if (newOption.stock < 0) {
      alert('재고는 0 이상이어야 합니다.')
      return
    }

    onChange([...options, { ...newOption }])
    
    // Reset form
    setNewOption({
      option_type: '',
      option_value: '',
      price_adjustment: 0,
      stock: 0,
    })
  }

  const handleRemoveOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index))
  }

  const handleUpdateOption = (index: number, field: keyof ProductOption, value: any) => {
    const updated = [...options]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            상품 옵션 관리
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            색상, 사이즈 등 다양한 옵션을 추가하세요
          </p>
        </div>
      </div>

      {/* Existing Options */}
      {options.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">
            등록된 옵션 ({options.length}개)
          </p>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">
                      타입
                    </label>
                    <input
                      type="text"
                      value={option.option_type}
                      onChange={(e) => handleUpdateOption(index, 'option_type', e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                      placeholder="예: 색상"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">
                      값
                    </label>
                    <input
                      type="text"
                      value={option.option_value}
                      onChange={(e) => handleUpdateOption(index, 'option_value', e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                      placeholder="예: 블랙"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">
                      가격 조정
                    </label>
                    <input
                      type="number"
                      value={option.price_adjustment}
                      onChange={(e) => handleUpdateOption(index, 'price_adjustment', Number(e.target.value))}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">
                      재고
                    </label>
                    <input
                      type="number"
                      value={option.stock}
                      onChange={(e) => handleUpdateOption(index, 'stock', Number(e.target.value))}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveOption(index)}
                  disabled={disabled}
                  className="flex h-7 w-7 items-center justify-center text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  aria-label="옵션 제거"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Option Form */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs font-medium text-gray-700 mb-3">
          새 옵션 추가
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                옵션 타입 *
              </label>
              <input
                type="text"
                value={newOption.option_type}
                onChange={(e) => setNewOption({ ...newOption, option_type: e.target.value })}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                placeholder="예: 색상, 사이즈"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                같은 타입끼리 그룹화됩니다
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                옵션 값 *
              </label>
              <input
                type="text"
                value={newOption.option_value}
                onChange={(e) => setNewOption({ ...newOption, option_value: e.target.value })}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                placeholder="예: 블랙, M"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                가격 조정 (원)
              </label>
              <input
                type="number"
                value={newOption.price_adjustment}
                onChange={(e) => setNewOption({ ...newOption, price_adjustment: Number(e.target.value) })}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                placeholder="0"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                음수 입력 시 할인 적용
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                재고 수량 *
              </label>
              <input
                type="number"
                value={newOption.stock}
                onChange={(e) => setNewOption({ ...newOption, stock: Number(e.target.value) })}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleAddOption}
            disabled={disabled || !newOption.option_type.trim() || !newOption.option_value.trim()}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
            옵션 추가
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
        <div className="text-xs text-blue-900">
          <p className="font-medium">옵션 설정 팁</p>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            <li>같은 타입(예: "색상")끼리 자동 그룹화됩니다</li>
            <li>가격 조정: 프리미엄 옵션에 추가 금액 설정</li>
            <li>재고: 옵션별 독립적인 재고 관리 가능</li>
            <li>옵션이 없으면 기본 상품 재고가 사용됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
