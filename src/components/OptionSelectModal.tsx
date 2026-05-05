import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Check, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { formatNumber } from '@/utils/format'

interface ProductOption {
  id: number
  product_id: number
  option_type: string
  option_value: string
  price_adjustment: number
  stock: number
}

interface OptionSelectModalProps {
  isOpen: boolean
  onClose: () => void
  productId: number
  productName: string
  currentOptionId?: number
  currentOptionValue?: string
  onOptionSelected: (optionId: number, optionValue: string) => void
}

export default function OptionSelectModal({
  isOpen,
  onClose,
  productId,
  productName,
  currentOptionId,
  currentOptionValue,
  onOptionSelected,
}: OptionSelectModalProps) {
  const { t } = useTranslation()
  const [options, setOptions] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState<number | undefined>(currentOptionId)
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen)

  // 옵션 타입별로 그룹화
  const optionsByType = options.reduce((acc, option) => {
    if (!acc[option.option_type]) {
      acc[option.option_type] = []
    }
    acc[option.option_type].push(option)
    return acc
  }, {} as Record<string, ProductOption[]>)

  useEffect(() => {
    if (isOpen && productId) {
      loadOptions()
    }
  }, [isOpen, productId])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  async function loadOptions() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/api/products/${productId}/options`)
      if (response.data.success) {
        setOptions(response.data.data || [])
        if (response.data.data.length === 0) {
          setError(t('product.optionNone', { defaultValue: '사용 가능한 옵션이 없습니다.' }))
        }
      } else {
        setError(t('product.optionLoadFail', { defaultValue: '옵션을 불러올 수 없습니다.' }))
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Failed to load options:', err)
      setError(t('product.optionLoadError', { defaultValue: '옵션 조회 중 오류가 발생했습니다.' }))
    } finally {
      setLoading(false)
    }
  }

  const handleOptionSelect = (option: ProductOption) => {
    setSelectedOptionId(option.id)
  }

  const handleConfirm = () => {
    if (!selectedOptionId) return
    
    const selectedOption = options.find(opt => opt.id === selectedOptionId)
    if (selectedOption) {
      onOptionSelected(selectedOption.id, selectedOption.option_value)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="bg-white dark:bg-[#0A0A0A] rounded-t-3xl shadow-2xl max-w-md w-full max-h-[80dvh] flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('product.optionSelectAria', { name: productName, defaultValue: '{{name}} 옵션 선택' })}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-[#2A2A2A] px-6 py-4 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {productName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('product.optionSelect', { defaultValue: '옵션 선택' })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-900 transition-colors ml-2"
              aria-label={t('product.optionCloseAria', { defaultValue: '옵션 선택 닫기' })}
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-900 border-r-transparent"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(optionsByType).map(([type, optionsForType]) => (
                <div key={type}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-3">
                    {type}
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {optionsForType.map((option) => {
                      const isSelected = selectedOptionId === option.id
                      const isOutOfStock = option.stock === 0
                      const isCurrent = currentOptionId === option.id

                      return (
                        <button
                          key={option.id}
                          onClick={() => !isOutOfStock && handleOptionSelect(option)}
                          disabled={isOutOfStock}
                          className={`
                            relative flex flex-col items-center justify-center
                            border-2 rounded-lg py-3 px-2
                            transition-all duration-200
                            ${isSelected 
                              ? 'border-gray-900 bg-gray-50 dark:bg-[#121212]' 
                              : isOutOfStock
                                ? 'border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#121212] opacity-40 cursor-not-allowed'
                                : 'border-gray-200 dark:border-[#2A2A2A] hover:border-gray-400'
                            }
                          `}
                        >
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5">
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-900">
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                              </div>
                            </div>
                          )}
                          
                          {isCurrent && !isSelected && (
                            <div className="absolute top-1.5 right-1.5">
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
                                <span className="text-[8px] text-white font-bold">{t('product.optionCurrent', { defaultValue: '현재' })}</span>
                              </div>
                            </div>
                          )}

                          <span className={`text-xs font-medium text-center line-clamp-2 ${
                            isOutOfStock ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                          }`}>
                            {option.option_value}
                          </span>
                          
                          {option.price_adjustment !== 0 && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                              {(option.price_adjustment || 0) > 0 ? '+' : ''}{formatNumber(option.price_adjustment || 0)}{t('common.won', { defaultValue: '원' })}
                            </span>
                          )}
                          
                          {isOutOfStock && (
                            <span className="text-[10px] text-red-500 font-medium mt-1">
                              {t('product.optionSoldOut', { defaultValue: '품절' })}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Current Selection Info */}
              {currentOptionValue && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900">
                    <span className="font-bold">{t('product.optionCurrentLabel', { defaultValue: '현재 선택:' })}</span> {currentOptionValue}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="sticky bottom-0 bg-white dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-[#2A2A2A] px-6 py-4">
            <button
              onClick={handleConfirm}
              disabled={!selectedOptionId}
              className="w-full rounded-lg bg-gray-900 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {selectedOptionId === currentOptionId ? t('common.confirm', { defaultValue: '확인' }) : t('product.optionChange', { defaultValue: '옵션 변경' })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
