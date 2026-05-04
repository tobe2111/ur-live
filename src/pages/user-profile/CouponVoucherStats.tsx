/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 쿠폰/바우처 카운트 카드.
 */
import { useNavigate } from 'react-router-dom'
import type { MyCounts } from './types'

export default function CouponVoucherStats({ counts }: { counts: MyCounts }) {
  const navigate = useNavigate()

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigate('/my-coupons')}
          className="rounded-2xl px-4 py-3.5 bg-gray-100 dark:bg-white/[0.04] active:bg-white/[0.08] transition-colors text-left"
        >
          <p className="text-[10px] text-gray-900 dark:text-white/55">쿠폰</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[20px] font-extrabold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>
              {counts.coupon ?? '-'}
            </span>
            <span className="text-[11px] text-gray-900 dark:text-white/55">장</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => navigate('/my-vouchers')}
          className="rounded-2xl px-4 py-3.5 bg-gray-100 dark:bg-white/[0.04] active:bg-white/[0.08] transition-colors text-left"
        >
          <p className="text-[10px] text-gray-900 dark:text-white/55">바우처</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[20px] font-extrabold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>
              {counts.voucher ?? '-'}
            </span>
            <span className="text-[11px] text-gray-900 dark:text-white/55">장</span>
          </div>
        </button>
      </div>
    </div>
  )
}
