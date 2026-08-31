/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 주문 현황 바.
 * 🛡️ 2026-07-02: ① 별도 api.get → useMyOrders 재사용(RQ 캐시 공유 — /my-orders 와 동일 데이터).
 *   ② 5칸이 전부 무필터 /my-orders 로 가던 것 → 상태 필터(?status=) 전달, '리뷰'는 /my-reviews 로.
 *   ③ '리뷰' 카운트가 항상 0이던 죽은 지표 → 리뷰 작성 가능 주문 수(배송완료·구매확정 — /my-reviews 와 동일 기준).
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMyOrders } from '@/hooks/queries/useMyData'

export default function OrderStatusBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: ordersRaw = [] } = useMyOrders()

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const o of ordersRaw as { status?: string }[]) {
      const s = (o.status || '').toUpperCase()
      if (s === 'PAID' || s === 'DONE') c.paid = (c.paid || 0) + 1
      else if (s === 'PREPARING') c.preparing = (c.preparing || 0) + 1
      else if (s === 'SHIPPING') c.shipping = (c.shipping || 0) + 1
      else if (s === 'DELIVERED') c.delivered = (c.delivered || 0) + 1
      // 리뷰 작성 가능 = 배송완료/구매확정 (MyReviewsPage 필터와 동일 기준)
      if (s === 'DELIVERED' || s === 'DONE') c.review = (c.review || 0) + 1
    }
    return c
  }, [ordersRaw])

  // 🧭 2026-06-10 (쇼핑 잠정 보류): 배송 주문이 하나도 없으면 바 자체를 숨김 —
  //   동네딜/교환권 중심 사용자에게 빈 배송 현황(0 0 0 0 0)을 보여주지 않음. 주문 있으면 기존 그대로.
  const hasAnyOrder = Object.values(counts).some((n) => n > 0)
  if (!hasAnyOrder) return null

  const items = [
    { label: t('orderStatus.paid', { defaultValue: '결제완료' }), key: 'paid', path: '/my-orders?status=paid' },
    { label: t('orderStatus.preparing', { defaultValue: '배송준비' }), key: 'preparing', path: '/my-orders?status=preparing' },
    { label: t('orderStatus.shipping', { defaultValue: '배송중' }), key: 'shipping', path: '/my-orders?status=shipping' },
    { label: t('orderStatus.delivered', { defaultValue: '배송완료' }), key: 'delivered', path: '/my-orders?status=delivered' },
    { label: t('orderStatus.review', { defaultValue: '리뷰' }), key: 'review', path: '/my-reviews' },
  ]

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-3">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-3">{t('orderStatus.sectionTitle', { defaultValue: '주문 현황' })}</p>
      <div className="flex items-center justify-between rounded-2xl px-2 py-4 bg-white dark:bg-[#1A1C21]">
        {items.map(o => (
          <button key={o.label} onClick={() => navigate(o.path)} className="flex-1 text-center">
            <p className={`text-[18px] font-extrabold ${counts[o.key] ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-white/20'}`} style={{ letterSpacing: '-0.02em' }}>
              {counts[o.key] || 0}
            </p>
            <p className="text-[9px] text-gray-900 dark:text-white/55 mt-0.5">{o.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
