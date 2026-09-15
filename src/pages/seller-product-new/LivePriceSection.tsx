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
    <div className="p-4 bg-white border border-rule rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="live_price_enabled"
          checked={formData.live_price_enabled}
          onChange={e => onToggle(e.target.checked)}
          className="rounded border-rule text-tone-warn"
        />
        <label htmlFor="live_price_enabled" className="text-sm font-semibold text-tone-warn">
          {t('seller.liveOnly')}
        </label>
        <span className="text-xs text-tone-warn bg-tone-warn-bg px-2 py-0.5 rounded-full">{t('seller.liveOnlyDuring')}</span>
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
            className="w-full px-3 py-2 border border-rule rounded-lg text-gray-900 focus:ring-2 focus:ring-orange-500 bg-white"
          />
          <p className="text-xs text-tone-warn mt-1">{t('seller.liveOnlyPriceDesc')}</p>
        </div>
      )}
    </div>
  )
}
