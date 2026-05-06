import { useTranslation } from 'react-i18next'
import type { ProductFormData } from './types'

interface Props {
  formData: ProductFormData
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onKindChange: (kind: ProductFormData['product_kind'], deliveryType: ProductFormData['delivery_type'], contentFormat: ProductFormData['content_format']) => void
}

export default function DigitalProductSection({ formData, onChange, onKindChange }: Props) {
  const { t } = useTranslation()

  const kinds: { value: ProductFormData['product_kind']; label: string; desc: string }[] = [
    { value: 'physical', label: t('seller.products.kindPhysical', { defaultValue: '📦 실물 배송' }), desc: t('seller.products.kindPhysicalDesc', { defaultValue: '의류·식품·생활용품' }) },
    { value: 'digital', label: t('seller.products.kindDigital', { defaultValue: '📄 디지털 파일' }), desc: t('seller.products.kindDigitalDesc', { defaultValue: 'PDF·이미지·전자책' }) },
    { value: 'video_course', label: t('seller.products.kindVideoCourse', { defaultValue: '🎬 영상 강의' }), desc: t('seller.products.kindVideoCourseDesc', { defaultValue: '운동·뷰티·노하우' }) },
    { value: 'pdf_guide', label: t('seller.products.kindPdfGuide', { defaultValue: '📚 정보 가이드' }), desc: t('seller.products.kindPdfGuideDesc', { defaultValue: '가이드·노하우 문서' }) },
  ]

  return (
    <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-sm font-bold text-purple-900 mb-2">
          {t('seller.products.productKindLabel', { defaultValue: '상품 유형' })} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {kinds.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onKindChange(
                opt.value,
                opt.value === 'physical' ? 'shipping' : opt.value === 'video_course' ? 'unlock' : 'instant_url',
                opt.value === 'video_course' ? 'video' : (opt.value === 'digital' || opt.value === 'pdf_guide') ? 'pdf' : '',
              )}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                formData.product_kind === opt.value
                  ? 'bg-white border-purple-500 ring-2 ring-purple-200'
                  : 'bg-white border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="text-sm font-bold text-gray-900">{opt.label}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {formData.product_kind !== 'physical' && (
        <>
          <div>
            <label className="block text-xs font-medium text-purple-900 mb-1.5">
              {t('seller.products.contentUrlLabel', { defaultValue: '콘텐츠 URL' })} <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              name="content_url"
              value={formData.content_url}
              onChange={onChange}
              placeholder={t('seller.products.contentUrlPlaceholder', { defaultValue: 'https://r2.ur-team.com/digital/abc.pdf 또는 YouTube/Vimeo 링크' })}
              className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 bg-white"
            />
            <p className="text-[11px] text-purple-700 mt-1">{t('seller.products.contentUrlHint', { defaultValue: '⚠️ R2 또는 외부 CDN URL. 구매자만 접근 가능한 signed URL이 자동 발급됩니다.' })}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-purple-900 mb-1.5">{t('seller.products.contentFormatLabel', { defaultValue: '파일 형식' })}</label>
              <select
                name="content_format"
                value={formData.content_format}
                onChange={onChange}
                className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="">{t('seller.products.contentFormatSelect', { defaultValue: '선택' })}</option>
                <option value="pdf">{t('seller.products.contentFormatPdf', { defaultValue: 'PDF (전자책/가이드)' })}</option>
                <option value="video">{t('seller.products.contentFormatVideo', { defaultValue: '동영상' })}</option>
                <option value="zip">{t('seller.products.contentFormatZip', { defaultValue: 'ZIP (다중 파일)' })}</option>
                <option value="audio">{t('seller.products.contentFormatAudio', { defaultValue: '음성/팟캐스트' })}</option>
                <option value="image">{t('seller.products.contentFormatImage', { defaultValue: '이미지/그래픽' })}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-900 mb-1.5">{t('seller.products.accessDaysLabel', { defaultValue: '접근 기간 (일)' })}</label>
              <input
                type="number"
                name="access_duration_days"
                value={formData.access_duration_days}
                onChange={onChange}
                placeholder={t('seller.products.accessDaysPlaceholder', { defaultValue: '비워두면 영구' })}
                min="1"
                className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-purple-900 mb-1.5">
              {t('seller.products.previewUrlLabel', { defaultValue: '미리보기 URL (선택)' })}
            </label>
            <input
              type="url"
              name="preview_url"
              value={formData.preview_url}
              onChange={onChange}
              placeholder={t('seller.products.previewUrlPlaceholder', { defaultValue: '무료 샘플 PDF 또는 강의 첫 강 (구매 전 노출)' })}
              className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-[11px] text-amber-800">
            {t('seller.products.digitalLegalNotice', { defaultValue: '📌 디지털 상품은 「전자상거래법」상 청약철회 제한 가능. 약관에 명시되며, 구매자는 결제 즉시 마이페이지 → 디지털 보관함에서 다운로드 가능합니다.' })}
          </div>
        </>
      )}
    </div>
  )
}
