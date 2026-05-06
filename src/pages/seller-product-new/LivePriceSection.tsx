import { useTranslation } from 'react-i18next'
import type { ProductFormData } from './types'

interface Props {
  formData: Pick<ProductFormData, 'live_price_enabled' | 'live_only_price'>
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onToggle: (enabled: boolean) => void
}

export default function LivePriceSection({ formData, onChange, onToggle }: Props) {
  const { t } = useTranslation()

  return (
    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="live_price_enabled"
          checked={formData.live_price_enabled}
          onChange={e => onToggle(e.target.checked)}
          className="rounded border-orange-300 text-orange-600"
        />
        <label htmlFor="live_price_enabled" className="text-sm font-semibold text-orange-800">
          {t('seller.liveOnly')}
        </label>
        <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{t('seller.liveOnlyDuring')}</span>
      </div>
      {formData.live_price_enabled && (
        <div>
          <input
            type="number"
            name="live_only_price"
            value={formData.live_only_price}
            onChange={onChange}
            placeholder={t('seller.liveOnlyPricePlaceholder')}
            min="0"
            className="w-full px-3 py-2 border border-orange-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-orange-500 bg-white"
          />
          <p className="text-xs text-orange-600 mt-1">{t('seller.liveOnlyPriceDesc')}</p>
        </div>
      )}
    </div>
  )
}
