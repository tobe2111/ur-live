/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 의 쿠폰 적용 섹션 추출.
 */
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserFriendlyError } from '@/lib/errorHandler'
import { formatNumber } from '@/utils/format'

interface Props {
  couponCode: string
  setCouponCode: (v: string) => void
  couponDiscount: number
  totalAmount: number
  onApplied: (discount: number, couponId: number) => void
}

export default function CouponSection({ couponCode, setCouponCode, couponDiscount, totalAmount, onApplied }: Props) {
  async function handleApply() {
    if (!couponCode.trim()) return
    try {
      const res = await api.post('/api/coupons/apply', { code: couponCode.trim(), order_amount: totalAmount })
      if (res.data.success) {
        onApplied(res.data.data.discount, res.data.data.coupon_id)
        toast.success(`${res.data.data.name}: ${formatNumber(res.data.data.discount)}원 할인`)
      } else {
        toast.error(res.data.error)
      }
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err, '쿠폰 적용 실패'))
    }
  }

  return (
    <section className="bg-white dark:bg-[#0A0A0A] px-5 py-4 border-t border-gray-100 dark:border-[#1A1A1A]">
      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-2">할인 쿠폰</h2>
      <div className="flex gap-2">
        <input
          value={couponCode}
          onChange={e => setCouponCode(e.target.value.toUpperCase())}
          placeholder="쿠폰 코드 입력"
          aria-label="쿠폰 코드 입력"
          className="flex-1 px-3 py-2.5 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-gray-500 focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={handleApply}
          className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg shrink-0"
        >
          적용
        </button>
      </div>
      {couponDiscount > 0 && (
        <div className="flex items-center justify-between mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
          <span className="text-sm text-green-700 font-medium">✓ 쿠폰 할인 적용됨</span>
          <span className="text-sm font-bold text-green-700">-{formatNumber(couponDiscount)}원</span>
        </div>
      )}
    </section>
  )
}
