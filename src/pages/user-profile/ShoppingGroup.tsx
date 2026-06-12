/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 쇼핑 InsetGroup (찜/바우처/쿠폰함/주문).
 */
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import type { MyCounts } from './types'

export default function ShoppingGroup({ counts }: { counts: MyCounts }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // 🧭 2026-06-10 (쇼핑 잠정 보류 — 동네딜 집중): 동네딜 자산(바우처/숙소/쿠폰)을 위로,
  //   쇼핑성 항목(찜/주문/디지털)을 아래로 재정렬. 전 항목 유지 — 구매 이력/자산은 CS 상 제거 불가.
  const items = [
    { icon: '🎟️', label: t('shopping.voucher', { defaultValue: '내 교환권' }), sub: t('shopping.voucherSub', { defaultValue: '식사권·이용권' }), count: counts.voucher, path: '/my-vouchers' },
    { icon: '🏨', label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), sub: t('shopping.myStaysSub', { defaultValue: '체크인 코드 / voucher 유효기간' }), path: '/my-stays' },
    { icon: '🎫', label: t('shopping.coupons', { defaultValue: '쿠폰함' }), count: counts.coupon, path: '/my-coupons' },
    { icon: '⭐', label: t('shopping.myFollows', { defaultValue: '내 단골 셀러' }), sub: t('shopping.myFollowsSub', { defaultValue: '셀러별 알림 설정' }), path: '/my/follows' },
    // 🏁 2026-06-12 (4차 감사 D5): /interest-list 고아 라우트 진입점 — 관심 맛집(공구 알림 신청) 목록.
    { icon: '🔔', label: t('shopping.interestList', { defaultValue: '관심 맛집' }), sub: t('shopping.interestListSub', { defaultValue: '공구 오픈 알림 신청 목록' }), path: '/interest-list' },
    { icon: '❤️', label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), count: counts.wish, path: '/wishlist' },
    { icon: '📦', label: t('shopping.orders', { defaultValue: '주문 내역' }), sub: t('shopping.ordersSub', { defaultValue: '최근 3개월' }), path: '/my-orders' },
    { icon: '📚', label: t('shopping.digitalLibrary', { defaultValue: '디지털 보관함' }), sub: t('shopping.digitalLibrarySub', { defaultValue: '전자책·강의·가이드' }), path: '/my/digital' },
  ]

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('shopping.sectionTitle', { defaultValue: '쇼핑' })}</p>
      <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-3 px-3.5 py-3.5 text-left active:bg-gray-200 dark:active:bg-white/[0.06]"
            style={{ borderTop: i ? '1px solid' : 'none', borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <span className="text-lg" aria-hidden="true">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-gray-900 dark:text-white font-medium">{item.label}</p>
              {item.sub && <p className="text-[10px] text-gray-900 dark:text-white/45 mt-0.5">{item.sub}</p>}
            </div>
            {item.count !== undefined && item.count !== null && (
              <span className="text-[12px] text-gray-900 dark:text-white/55 font-semibold">{item.count}</span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-gray-900 dark:text-white/30" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
