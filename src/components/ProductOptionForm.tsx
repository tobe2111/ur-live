import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [newOption, setNewOption] = useState<ProductOption>({
    option_type: '',
    option_value: '',
    price_adjustment: 0,
    stock: 0,
  })

  const handleAddOption = () => {
    if (!newOption.option_type.trim() || !newOption.option_value.trim()) {
      alert(t('productOption.alertTypeValue', { defaultValue: '옵션 타입과 값을 입력해주세요.' }))
      return
    }
    if (newOption.stock < 0) {
      alert(t('productOption.alertStock', { defaultValue: '재고는 0 이상이어야 합니다.' }))
      return
    }
    onChange([...options, { ...newOption }])
    setNewOption({ option_type: '', option_value: '', price_adjustment: 0, stock: 0 })
  }

  const handleRemoveOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index))
  }

  const handleUpdateOption = (index: number, field: keyof ProductOption, value: string | number) => {
    const updated = [...options]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            {t('productOption.title', { defaultValue: '상품 옵션 관리' })}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('productOption.subtitle', { defaultValue: '색상, 사이즈 등 다양한 옵션을 추가하세요' })}
          </p>
        </div>
      </div>

      {options.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">
            {t('productOption.registeredCount', { count: options.length, defaultValue: '등록된 옵션 ({{count}}개)' })}
          </p>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div
                key={option.id ?? `${option.option_type}__${option.option_value}__${index}`}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">
                      {t('productOption.typeLabel', { defaultValue: '타입' })}
                    </label>
                    <input
                      type="text"
                      value={option.option_type}
                      onChange={(e) => handleUpdateOption(index, 'option_type', e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                      placeholder={t('productOption.typePlaceholder', { defaultValue: '예: 색상' })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">
                      {t('productOption.valueLabel', { defaultValue: '값' })}
                    </label>
                    <input
                      type="text"
                      value={option.option_value}
                      onChange={(e) => handleUpdateOption(index, 'option_value', e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                      placeholder={t('productOption.valuePlaceholder', { defaultValue: '예: 블랙' })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">
                      {t('productOption.priceAdjLabel', { defaultValue: '가격 조정' })}
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
                      {t('productOption.stockLabel', { defaultValue: '재고' })}
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
                  aria-label={t('productOption.removeAriaLabel', { defaultValue: '옵션 제거' })}
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs font-medium text-gray-700 mb-3">
          {t('productOption.newOptionTitle', { defaultValue: '새 옵션 추가' })}
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('productOption.optionTypeStar', { defaultValue: '옵션 타입 *' })}
              </label>
              <input
                type="text"
                value={newOption.option_type}
                onChange={(e) => setNewOption({ ...newOption, option_type: e.target.value })}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                placeholder={t('productOption.typeGroupPlaceholder', { defaultValue: '예: 색상, 사이즈' })}
              />
              <p className="text-[10px] text-gray-500 mt-1">
                {t('productOption.typeGroupHint', { defaultValue: '같은 타입끼리 그룹화됩니다' })}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('productOption.optionValueStar', { defaultValue: '옵션 값 *' })}
              </label>
              <input
                type="text"
                value={newOption.option_value}
                onChange={(e) => setNewOption({ ...newOption, option_value: e.target.value })}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
                placeholder={t('productOption.valueGroupPlaceholder', { defaultValue: '예: 블랙, M' })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('productOption.priceAdjWon', { defaultValue: '가격 조정 (원)' })}
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
                {t('productOption.priceDiscountHint', { defaultValue: '음수 입력 시 할인 적용' })}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('productOption.stockQuantityStar', { defaultValue: '재고 수량 *' })}
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
            {t('productOption.addBtn', { defaultValue: '옵션 추가' })}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
        <div className="text-xs text-blue-900">
          <p className="font-medium">{t('productOption.tipTitle', { defaultValue: '옵션 설정 팁' })}</p>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            <li>{t('productOption.tip1', { defaultValue: '같은 타입(예: "색상")끼리 자동 그룹화됩니다' })}</li>
            <li>{t('productOption.tip2', { defaultValue: '가격 조정: 프리미엄 옵션에 추가 금액 설정' })}</li>
            <li>{t('productOption.tip3', { defaultValue: '재고: 옵션별 독립적인 재고 관리 가능' })}</li>
            <li>{t('productOption.tip4', { defaultValue: '옵션이 없으면 기본 상품 재고가 사용됩니다' })}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
