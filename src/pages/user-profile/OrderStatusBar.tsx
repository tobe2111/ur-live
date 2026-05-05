/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 주문 현황 바.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function OrderStatusBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/orders').then(r => {
        if (r.data.success) {
          const orders = Array.isArray(r.data.data) ? r.data.data : (r.data.data?.items || r.data.data?.orders || [])
          const c: Record<string, number> = {}
          orders.forEach((o: { status?: string }) => {
            const s = (o.status || '').toUpperCase()
            if (s === 'PAID' || s === 'DONE') c.paid = (c.paid || 0) + 1
            else if (s === 'PREPARING') c.preparing = (c.preparing || 0) + 1
            else if (s === 'SHIPPING') c.shipping = (c.shipping || 0) + 1
            else if (s === 'DELIVERED') c.delivered = (c.delivered || 0) + 1
          })
          setCounts(c)
        }
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
    })
  }, [])

  const items = [
    { label: t('orderStatus.paid', { defaultValue: '결제완료' }), key: 'paid', path: '/my-orders' },
    { label: t('orderStatus.preparing', { defaultValue: '배송준비' }), key: 'preparing', path: '/my-orders' },
    { label: t('orderStatus.shipping', { defaultValue: '배송중' }), key: 'shipping', path: '/my-orders' },
    { label: t('orderStatus.delivered', { defaultValue: '배송완료' }), key: 'delivered', path: '/my-orders' },
    { label: t('orderStatus.review', { defaultValue: '리뷰' }), key: 'review', path: '/my-orders' },
  ]

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-3">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-3">{t('orderStatus.sectionTitle', { defaultValue: '주문 현황' })}</p>
      <div className="flex items-center justify-between rounded-2xl px-2 py-4 bg-gray-100 dark:bg-white/[0.04]">
        {items.map(o => (
          <button key={o.label} onClick={() => navigate(o.path)} className="flex-1 text-center">
            <p className={`text-[18px] font-extrabold ${counts[o.key] ? 'text-pink-400' : 'text-gray-900 dark:text-white/20'}`} style={{ letterSpacing: '-0.02em' }}>
              {counts[o.key] || 0}
            </p>
            <p className="text-[9px] text-gray-900 dark:text-white/55 mt-0.5">{o.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
