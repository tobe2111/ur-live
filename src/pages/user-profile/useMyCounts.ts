/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 의 카운트 fetch 훅.
 *
 * /api/wishlists, /api/coupons/my 는 직접 fetch.
 * voucher 는 useMyVouchers (React Query) 재사용 — /my-vouchers 페이지와 cache 공유.
 *
 * 🛡️ 2026-05-27: 이전엔 /api/vouchers/my 를 별도로 호출했고, RQ cache 와 동기화 안 돼
 *   /user/profile 카운트와 /my-vouchers 목록이 어긋나는 사고 발생. useMyVouchers 로 통합.
 */
import { useEffect, useState } from 'react'
import type { MyCounts } from './types'
import { useMyVouchers } from '@/hooks/queries'

export function useMyCounts(): MyCounts {
  const [counts, setCounts] = useState<Pick<MyCounts, 'wish' | 'coupon'>>({ wish: null, coupon: null })
  const { data: vouchers } = useMyVouchers()

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
    })
  }, [])

  return { ...counts, voucher: vouchers ? vouchers.length : null }
}
