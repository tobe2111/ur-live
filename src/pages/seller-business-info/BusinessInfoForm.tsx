import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, Search } from 'lucide-react'
import type { BusinessInfo, BusinessFormData } from './types'

// 🛡️ 2026-06-10: SellerBusinessInfoPage 탭화 분해 — 사업자 정보 폼 (동작 변화 0, 순수 이동).
export default function BusinessInfoForm({
  businessInfo,
  formData,
  editMode,
  submitting,
  onSubmit,
  onChange,
  onAddressSearch,
  onEnterEditMode,
  onCancelEdit,
}: {
  businessInfo: BusinessInfo | null
  formData: BusinessFormData
  editMode: boolean
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onAddressSearch: () => void
  onEnterEditMode: () => void
  onCancelEdit: () => void
}) {
  const { t } = useTranslation()

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('seller.businessNumber')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="business_number"
          value={formData.business_number}
          onChange={onChange}
          placeholder="000-00-00000"
          maxLength={12}
          required
          disabled={businessInfo?.is_verified && !editMode}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-500 mt-1">{t('seller.businessNumberHint')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('seller.businessName')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="business_name"
          value={formData.business_name}
          onChange={onChange}
          placeholder={t('seller.businessNamePlaceholder')}
          required
          disabled={businessInfo?.is_verified && !editMode}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('seller.representative')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="ceo_name"
          value={formData.ceo_name}
          onChange={onChange}
          placeholder={t('seller.representativePlaceholder')}
          required
          disabled={businessInfo?.is_verified && !editMode}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('seller.businessType')}
          </label>
          <input
            type="text"
            name="business_type"
            value={formData.business_type}
            onChange={onChange}
            placeholder={t('seller.businessTypePlaceholder')}
            disabled={businessInfo?.is_verified && !editMode}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('seller.businessCategory')}
          </label>
          <input
            type="text"
            name="business_category"
            value={formData.business_category}
            onChange={onChange}
            placeholder={t('seller.businessCategoryPlaceholder')}
            disabled={businessInfo?.is_verified && !editMode}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('seller.businessAddress')} <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              name="postal_code"
              value={formData.postal_code}
              onChange={onChange}
              placeholder={t('seller.postalCode')}
              required
              readOnly
              disabled={businessInfo?.is_verified && !editMode}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {(!businessInfo?.is_verified || editMode) && (
              <Button
                type="button"
                onClick={onAddressSearch}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                {t('seller.addressSearch')}
              </Button>
            )}
          </div>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={onChange}
            placeholder={t('seller.baseAddress')}
            required
            readOnly
            disabled={businessInfo?.is_verified && !editMode}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <input
            type="text"
            name="address_detail"
            value={formData.address_detail}
            onChange={onChange}
            placeholder={t('seller.detailAddress')}
            disabled={businessInfo?.is_verified && !editMode}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('seller.phoneNumber')} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={onChange}
            placeholder="02-1234-5678"
            maxLength={13}
            required
            disabled={businessInfo?.is_verified && !editMode}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">{t('seller.phoneNumberHint')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('seller.emailLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={onChange}
            placeholder="business@example.com"
            required
            disabled={businessInfo?.is_verified && !editMode}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {(!businessInfo?.is_verified || editMode) ? (
        <div className="pt-4 space-y-3">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('seller.savingInfo')}
              </span>
            ) : editMode ? (
              t('seller.requestEdit')
            ) : businessInfo ? (
              t('seller.editInfo')
            ) : (
              t('seller.registerBusinessInfo')
            )}
          </Button>
          {editMode && (
            <Button
              type="button"
              onClick={onCancelEdit}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </Button>
          )}
        </div>
      ) : (
        <div className="pt-4">
          <Button
            type="button"
            onClick={onEnterEditMode}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            {t('seller.requestInfoEdit')}
          </Button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {t('seller.requestInfoEditNote')}
          </p>
        </div>
      )}

      {/* Help Text */}
      <div className="pt-4 border-t">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">{t('seller.infoNotice')}</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>{t('seller.infoNotice1')}</li>
              <li>{t('seller.infoNotice2')}</li>
              <li>{t('seller.infoNotice3')}</li>
              <li>{t('seller.infoNotice4')}</li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  )
}
