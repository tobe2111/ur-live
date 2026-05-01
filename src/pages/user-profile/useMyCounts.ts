/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 의 카운트 fetch 훅.
 *
 * /api/wishlists, /api/coupons/my, /api/vouchers/my 를 1회만 호출하여
 * CouponVoucherStats / ShoppingGroup 두 컴포넌트가 공유.
 */
import { useEffect, useState } from 'react'
import type { MyCounts } from './types'

export function useMyCounts(): MyCounts {
  const [counts, setCounts] = useState<MyCounts>({ wish: null, coupon: null, voucher: null })

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      const extract = (r: { data?: { success?: boolean; data?: unknown } }) => {
        if (!r.data?.success) return 0
        const d = r.data.data as unknown
        if (Array.isArray(d)) return d.length
        const items = (d as { items?: unknown[] })?.items
        return Array.isArray(items) ? items.length : 0
      }
      api.get('/api/wishlists').then(r => setCounts(c => ({ ...c, wish: extract(r) }))).catch(() => setCounts(c => ({ ...c, wish: 0 })))
      api.get('/api/coupons/my').then(r => setCounts(c => ({ ...c, coupon: extract(r) }))).catch(() => setCounts(c => ({ ...c, coupon: 0 })))
      api.get('/api/vouchers/my').then(r => setCounts(c => ({ ...c, voucher: extract(r) }))).catch(() => setCounts(c => ({ ...c, voucher: 0 })))
    })
  }, [])

  return counts
}
