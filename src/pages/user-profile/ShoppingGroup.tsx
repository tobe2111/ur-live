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
import { ChevronRight, Ticket, TicketPercent, Gift, BedDouble, BookOpen, Heart, Star, Bell, Package, MapPin, PenLine, type LucideIcon } from 'lucide-react'
import type { MyCounts } from './types'

/** 🖊️ 2026-08-30: `icon` 이모지 문자열 → lucide 컴포넌트.
 *  이 목록은 마이페이지의 주 메뉴다 — 11칸이 전부 이모지라 같은 행 오른쪽의
 *  `ChevronRight`(선 아이콘)와 언어가 갈렸고, OS 마다 다른 그림이 나왔다. */
type Item = { Icon: LucideIcon; label: string; sub?: string; count?: number | null; path: string }

export default function ShoppingGroup({ counts }: { counts: MyCounts }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const groups: { key: string; label: string; items: Item[] }[] = [
    {
      key: 'assets',
      label: t('shopping.groupAssets', { defaultValue: '이용권·자산' }),
      items: [
        // 🎟️ 2026-08-31 (대표 — 지갑 분리): 이용권/교환권은 서로 다른 보관함이라 행도 둘.
        { Icon: Ticket, label: t('shopping.voucher', { defaultValue: '내 이용권' }), sub: t('shopping.voucherSub', { defaultValue: '매장에서 QR·코드로 사용' }), count: counts.voucher, path: '/my-vouchers' },
        { Icon: Gift, label: t('shopping.gifticon', { defaultValue: '내 교환권' }), sub: t('shopping.gifticonSub', { defaultValue: '문자로 받은 기프티콘' }), count: counts.gifticon, path: '/my-gifticons' },
        { Icon: TicketPercent, label: t('shopping.coupons', { defaultValue: '쿠폰함' }), count: counts.coupon, path: '/my-coupons' },
        { Icon: BedDouble, label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), sub: t('shopping.myStaysSub', { defaultValue: '체크인 코드 / 유효기간' }), path: '/my-stays' },
        { Icon: BookOpen, label: t('shopping.digitalLibrary', { defaultValue: '디지털 보관함' }), sub: t('shopping.digitalLibrarySub', { defaultValue: '전자책·강의·가이드' }), path: '/my/digital' },      ],
    },
    {
      key: 'interest',
      label: t('shopping.groupInterest', { defaultValue: '관심' }),
      items: [
        { Icon: Heart, label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), count: counts.wish, path: '/wishlist' },
        { Icon: Star, label: t('shopping.myFollows', { defaultValue: '내 단골 가게' }), sub: t('shopping.myFollowsSub', { defaultValue: '가게별 알림 설정' }), path: '/my/follows' },
        { Icon: Bell, label: t('shopping.interestList', { defaultValue: '관심 맛집' }), sub: t('shopping.interestListSub', { defaultValue: '공구 오픈 알림 신청 목록' }), path: '/interest-list' },
      ],
    },
    {
      key: 'orders',
      label: t('shopping.groupOrders', { defaultValue: '주문·배송' }),
      items: [
        { Icon: Package, label: t('shopping.orders', { defaultValue: '주문 내역' }), sub: t('shopping.ordersSub', { defaultValue: '최근 3개월' }), path: '/my-orders' },
        { Icon: MapPin, label: t('userProfile.addressManage', { defaultValue: '배송지 관리' }), path: '/mypage/addresses' },
        { Icon: PenLine, label: t('userProfile.myReviews', { defaultValue: '내 리뷰' }), path: '/my-reviews' },
      ],
    },
  ]

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('shopping.sectionTitle', { defaultValue: '나의 이용 내역' })}</p>
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1A1C21]">
        {groups.map((g, gi) => (
          <div key={g.key}>
            {/* 🛡️ 2026-07-02: 인라인 검정 고정 borderTop → 테마 대응 클래스(다크에서 구분선 소실 수정) */}
            <p
              className={`px-3.5 pt-3 pb-1.5 text-[10px] font-bold tracking-wide text-gray-400 dark:text-white/35 ${gi ? 'border-t border-black/[0.06] dark:border-white/[0.06]' : ''}`}
            >
              {g.label}
            </p>
            {g.items.map((item, i) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-gray-50 dark:active:bg-white/[0.06] ${i ? 'border-t border-black/[0.04] dark:border-white/[0.05]' : ''}`}
              >
                <item.Icon className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" aria-hidden="true" />
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
