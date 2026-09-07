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
import { isFailedGifticon, isGifticonVoucher, isStoreVoucher } from '@/shared/voucher-wallet'

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
      // 🛡️ 2026-07-02: 실패 시 null 유지(배지 미표시) — 네트워크 오류를 "0개"로 위장하지 않음.
      api.get('/api/wishlists').then(r => setCounts(c => ({ ...c, wish: extract(r) }))).catch(() => { /* null 유지 */ })
      api.get('/api/coupons/my').then(r => setCounts(c => ({ ...c, coupon: extract(r) }))).catch(() => { /* null 유지 */ })
    })
  }, [])

  // 🎟️ 2026-08-31 (지갑 분리): 한 배열에 섞여 오는 것을 지갑별로 나눠 센다 — 마이의 두 행이
  //   각자 목적지(/my-vouchers · /my-gifticons)의 실제 개수와 일치해야 한다.
  // 🩸 2026-09-04 (대표 결정): 발송 실패분은 **안 센다** — 문자조차 못 받은 것을 "내 교환권 1" 로
  //   말하면 거짓이다. 카드는 지갑에 '발송 실패' 로 계속 보인다(숨기는 게 아니라 안 세는 것).
  return {
    ...counts,
    voucher: vouchers ? vouchers.filter(isStoreVoucher).length : null,
    gifticon: vouchers ? vouchers.filter(v => isGifticonVoucher(v) && !isFailedGifticon(v)).length : null,
  }
}
