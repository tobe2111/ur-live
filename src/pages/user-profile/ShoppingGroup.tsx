/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 쇼핑 InsetGroup (찜/바우처/쿠폰함/주문).
 */
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { MyCounts } from './types'

export default function ShoppingGroup({ counts }: { counts: MyCounts }) {
  const navigate = useNavigate()

  const items = [
    { icon: '❤️', label: '찜한 상품', count: counts.wish, path: '/wishlist' },
    { icon: '🎟️', label: '내 바우처', sub: '식사권·이용권', count: counts.voucher, path: '/my-vouchers' },
    { icon: '🎫', label: '쿠폰함', count: counts.coupon, path: '/my-coupons' },
    { icon: '📦', label: '주문 내역', sub: '최근 3개월', path: '/my-orders' },
  ]

  return (
    <div className="px-4 pt-5">
      <p className="text-[12px] font-bold text-white mb-2">쇼핑</p>
      <div className="rounded-2xl overflow-hidden bg-white/[0.04]">
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-3 px-3.5 py-3.5 text-left active:bg-white/[0.06]"
            style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <span className="text-lg" aria-hidden="true">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white font-medium">{item.label}</p>
              {item.sub && <p className="text-[10px] text-white/45 mt-0.5">{item.sub}</p>}
            </div>
            {item.count !== undefined && item.count !== null && (
              <span className="text-[12px] text-white/55 font-semibold">{item.count}</span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
