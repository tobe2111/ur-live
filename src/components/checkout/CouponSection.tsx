import api from '@/lib/api'
import { getUserFriendlyError } from '@/lib/errorHandler'
import { toast } from '@/hooks/useToast'

interface CouponSectionProps {
  couponCode: string
  couponDiscount: number
  totalAmount: number
  onCouponCodeChange: (code: string) => void
  onCouponApplied: (discount: number, couponId: number) => void
}

export function CouponSection({
  couponCode,
  couponDiscount,
  totalAmount,
  onCouponCodeChange,
  onCouponApplied,
}: CouponSectionProps) {
  const handleApply = async () => {
    if (!couponCode.trim()) return
    try {
      const res = await api.post('/api/coupons/apply', { code: couponCode.trim(), order_amount: totalAmount })
      if (res.data.success) {
        onCouponApplied(res.data.data.discount, res.data.data.coupon_id)
        toast.success(`${res.data.data.name}: ${res.data.data.discount.toLocaleString()}원 할인`)
      } else {
        toast.error(res.data.error)
      }
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err, '쿠폰 적용 실패'))
    }
  }

  return (
    <section className="bg-white px-5 py-4 border-t border-gray-100">
      <h2 className="text-[15px] font-bold text-gray-900 mb-2">할인 쿠폰</h2>
      <div className="flex gap-2">
        <input
          value={couponCode}
          onChange={e => onCouponCodeChange(e.target.value.toUpperCase())}
          placeholder="쿠폰 코드 입력"
          aria-label="쿠폰 코드 입력"
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
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
          <span className="text-sm font-bold text-green-700">-{couponDiscount.toLocaleString()}원</span>
        </div>
      )}
    </section>
  )
}
