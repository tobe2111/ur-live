import { useTranslation } from 'react-i18next'
import { ImageIcon, Lightbulb } from 'lucide-react'
import { formatWon } from '@/utils/format'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import type { ProductFormData } from './types'

interface Props {
  formData: Pick<ProductFormData, 'name' | 'price' | 'image_url' | 'category' | 'live_price_enabled' | 'live_only_price'>
  categoryLabel: string
}

/**
 * 🛡️ PC 우측 sticky 미리보기 레일 — 넓은 화면을 활용해 실제 카드 노출 모습 + 등록 팁 상시 표시.
 *   모바일에선 렌더하지 않음(hidden lg:block, 부모에서 제어). 폼 입력이 즉시 반영돼 안심하고 등록.
 */
export default function ProductPreviewRail({ formData, categoryLabel }: Props) {
  const { t } = useTranslation()
  const hasContent = !!(formData.name?.trim() || formData.image_url || formData.price)
  const price = Number(formData.price) || 0

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-bold text-gray-400">
          {t('seller.products.previewTitle', { defaultValue: '미리보기' })}
        </p>

        {hasContent ? (
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <div className="relative aspect-square w-full bg-gray-100">
              {formData.image_url ? (
                <img
                  src={cfImage(formData.image_url, { width: 480, height: 480, fit: 'cover' })}
                  alt={formData.name || ''}
                  className="h-full w-full object-cover"
                  onError={(e) => cfImageOnError(e.currentTarget, formData.image_url)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
              {categoryLabel && (
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {categoryLabel}
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-gray-900">
                {formData.name || t('seller.productNamePlaceholderForm')}
              </p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-lg font-extrabold text-gray-900">{formatWon(price)}</span>
                {formData.live_price_enabled && Number(formData.live_only_price) > 0 && (
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                    {t('seller.liveOnly')} {formatWon(Number(formData.live_only_price))}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 py-10 text-center">
            <ImageIcon className="h-8 w-8 text-gray-300" />
            <p className="px-4 text-xs text-gray-400">
              {t('seller.products.previewEmpty', { defaultValue: '상품 정보를 입력하면 실제 노출 모습이 여기에 표시됩니다' })}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-800">
          <Lightbulb className="h-4 w-4" />
          {t('seller.products.tipsTitle', { defaultValue: '등록 팁' })}
        </div>
        <ul className="space-y-1.5 text-xs text-amber-900/80">
          <li>• {t('seller.products.tip1', { defaultValue: '이미지는 정사각형(1:1)이 가장 예쁘게 나와요' })}</li>
          <li>• {t('seller.products.tip2', { defaultValue: '상품명 앞쪽에 핵심 키워드를 넣으세요' })}</li>
          <li>• {t('seller.products.tip3', { defaultValue: '등록 후에도 언제든 수정할 수 있어요' })}</li>
        </ul>
      </div>
    </div>
  )
}
