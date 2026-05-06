import { useTranslation } from 'react-i18next'
import type { ProductFormData } from './types'

interface Props {
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}

export default function MealVoucherFields({ onChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-orange-800">{t('seller.products.mealVoucherInfo')}</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.restaurantName')} *</label>
        <input name="restaurant_name" onChange={onChange} placeholder={t('seller.products.restaurantNamePlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.restaurantAddress')}</label>
        <input name="restaurant_address" onChange={onChange} placeholder={t('seller.products.restaurantAddressPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.restaurantPhone')}</label>
        <input name="restaurant_phone" onChange={onChange} placeholder="02-1234-5678"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.voucherTerms')}</label>
        <input name="voucher_terms" onChange={onChange} placeholder={t('seller.products.voucherTermsPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.expiryDate')}</label>
          <input type="date" name="voucher_expiry" onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.groupBuyTarget')}</label>
          <input type="number" name="group_buy_target" onChange={onChange} placeholder="50"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.groupBuyDeadline')}</label>
        <input type="datetime-local" name="group_buy_deadline" onChange={onChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.storeVerifyPin')} *</label>
        <input name="store_verify_pin" onChange={onChange} placeholder={t('seller.products.storeVerifyPinPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
        <p className="text-xs text-gray-400 mt-1">{t('seller.products.storeVerifyPinDesc')}</p>
      </div>
    </div>
  )
}
