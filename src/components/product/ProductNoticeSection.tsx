import { useTranslation } from 'react-i18next'

export function ProductNoticeSection() {
  const { t } = useTranslation()

  const notices = [
    {
      title: t('product.noticeInspectionTitle', { defaultValue: '검수 포함' }),
      description: t('product.noticeInspectionDesc', { defaultValue: '모든 상품은 철저한 검수 과정을 거칩니다' }),
    },
    {
      title: t('product.noticeShippingTitle', { defaultValue: '배송 기간 5-7 영업일' }),
      description: t('product.noticeShippingDesc', { defaultValue: '판매자 발송 및 검수 완료 후 배송됩니다' }),
    },
    {
      title: t('product.noticeReturnTitle', { defaultValue: '교환/반품 안내' }),
      description: t('product.noticeReturnDesc', { defaultValue: '상품 수령 후 7일 이내 교환/반품 가능합니다' }),
    },
  ]

  return (
    <div className="space-y-3">
      {notices.map((notice, index) => (
        <div key={index} className="flex items-start gap-3">
          <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-foreground">
              {notice.title}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {notice.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
