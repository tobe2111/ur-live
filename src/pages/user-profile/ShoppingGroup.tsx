/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 쇼핑 InsetGroup (찜/바우처/쿠폰함/주문).
 * 🧹 2026-06-21 (대표 — 마이 추가 정리):
 *   ① 통합으로 길어진 10개 평면 리스트를 이용권·자산 / 관심 / 주문·배송 3개 소그룹으로
 *      묶어 훑기 쉽게(한 카드 안 sub-label + 그룹 구분선).
 *   ② 명칭 SSOT: '내 단골 셀러/셀러별 알림' → '내 단골 가게/가게별 알림'
 *      (사람 지칭 '셀러' 제거 — 가게 맥락은 허용).
 *   데이터/라우트/카운트 로직 불변, 표시 그룹핑·라벨만 변경.
 */
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import type { MyCounts } from './types'

type Item = { icon: string; label: string; sub?: string; count?: number | null; path: string }

export default function ShoppingGroup({ counts }: { counts: MyCounts }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const groups: { key: string; label: string; items: Item[] }[] = [
    {
      key: 'assets',
      label: t('shopping.groupAssets', { defaultValue: '이용권·자산' }),
      items: [
        { icon: '🎟️', label: t('shopping.voucher', { defaultValue: '내 교환권' }), sub: t('shopping.voucherSub', { defaultValue: '이용권·이용권' }), count: counts.voucher, path: '/my-vouchers' },
        { icon: '🎫', label: t('shopping.coupons', { defaultValue: '쿠폰함' }), count: counts.coupon, path: '/my-coupons' },
        { icon: '🏨', label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), sub: t('shopping.myStaysSub', { defaultValue: '체크인 코드 / 유효기간' }), path: '/my-stays' },
        { icon: '📚', label: t('shopping.digitalLibrary', { defaultValue: '디지털 보관함' }), sub: t('shopping.digitalLibrarySub', { defaultValue: '전자책·강의·가이드' }), path: '/my/digital' },
      ],
    },
    {
      key: 'interest',
      label: t('shopping.groupInterest', { defaultValue: '관심' }),
      items: [
        { icon: '❤️', label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), count: counts.wish, path: '/wishlist' },
        { icon: '⭐', label: t('shopping.myFollows', { defaultValue: '내 단골 가게' }), sub: t('shopping.myFollowsSub', { defaultValue: '가게별 알림 설정' }), path: '/my/follows' },
        { icon: '🔔', label: t('shopping.interestList', { defaultValue: '관심 맛집' }), sub: t('shopping.interestListSub', { defaultValue: '공구 오픈 알림 신청 목록' }), path: '/interest-list' },
      ],
    },
    {
      key: 'orders',
      label: t('shopping.groupOrders', { defaultValue: '주문·배송' }),
      items: [
        { icon: '📦', label: t('shopping.orders', { defaultValue: '주문 내역' }), sub: t('shopping.ordersSub', { defaultValue: '최근 3개월' }), path: '/my-orders' },
        { icon: '📍', label: t('userProfile.addressManage', { defaultValue: '배송지 관리' }), path: '/mypage/addresses' },
        { icon: '📝', label: t('userProfile.myReviews', { defaultValue: '내 리뷰' }), path: '/my-reviews' },
      ],
    },
  ]

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('shopping.sectionTitle', { defaultValue: '나의 이용 내역' })}</p>
      <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
        {groups.map((g, gi) => (
          <div key={g.key}>
            <p
              className="px-3.5 pt-3 pb-1.5 text-[10px] font-bold tracking-wide text-gray-400 dark:text-white/35"
              style={{ borderTop: gi ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
            >
              {g.label}
            </p>
            {g.items.map((item, i) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-gray-200 dark:active:bg-white/[0.06]"
                style={{ borderTop: i ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
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
        ))}
      </div>
    </div>
  )
}
