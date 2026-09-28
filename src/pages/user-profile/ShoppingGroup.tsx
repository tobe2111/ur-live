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
import type { LucideIcon } from 'lucide-react'
// 🎨 2026-09-28 (대표 *"앞으로 아이콘은 모두 저 컨셉"*): 뜻을 가진 아이콘은 전부 유어딜 것으로.
//    lucide 로 남는 건 화살표·닫기 같은 **조작** 뿐이고, 이 목록엔 그런 게 없어 0개가 됐다.
import {
  TicketStubIcon, CouponIcon, GiftBoxIcon, StayLineIcon, HeartIcon, StarIcon,
  BellIcon, BoxIcon, PinIcon, ReviewIcon,
} from '@/components/icons/urdeal-icons'
import { GroupLabel, ListPlate, ListRow, rowIcon } from './list-grammar'
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
        { Icon: TicketStubIcon, label: t('shopping.voucher', { defaultValue: '내 이용권' }), sub: t('shopping.voucherSub', { defaultValue: '매장에서 QR·코드로 사용' }), count: counts.voucher, path: '/my-vouchers' },
        { Icon: GiftBoxIcon, label: t('shopping.gifticon', { defaultValue: '내 교환권' }), sub: t('shopping.gifticonSub', { defaultValue: '문자로 받은 기프티콘' }), count: counts.gifticon, path: '/my-gifticons' },
        { Icon: CouponIcon, label: t('shopping.coupons', { defaultValue: '쿠폰함' }), count: counts.coupon, path: '/my-coupons' },
        { Icon: StayLineIcon, label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), sub: t('shopping.myStaysSub', { defaultValue: '체크인 코드 / 유효기간' }), path: '/my-stays' },
        // 🧹 2026-09-02 (대표 "디지털 보관함도 필요없고"): 전자책·강의는 지금 파는 물건이 아니다.
        //   라우트(/my/digital)와 페이지는 남긴다 — 과거 구매자가 있으면 링크로는 여전히 닿아야 하고,
        //   되살릴 때 이 줄만 되돌리면 된다(기능 삭제가 아니라 진입로 정리).
      ],
    },
    {
      key: 'interest',
      label: t('shopping.groupInterest', { defaultValue: '관심' }),
      items: [
        { Icon: HeartIcon, label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), count: counts.wish, path: '/wishlist' },
        { Icon: StarIcon, label: t('shopping.myFollows', { defaultValue: '내 단골 가게' }), sub: t('shopping.myFollowsSub', { defaultValue: '가게별 알림 설정' }), path: '/my/follows' },
        { Icon: BellIcon, label: t('shopping.interestList', { defaultValue: '관심 맛집' }), sub: t('shopping.interestListSub', { defaultValue: '공구 오픈 알림 신청 목록' }), path: '/interest-list' },
      ],
    },
    {
      key: 'orders',
      label: t('shopping.groupOrders', { defaultValue: '주문·배송' }),
      items: [
        { Icon: BoxIcon, label: t('shopping.orders', { defaultValue: '주문 내역' }), sub: t('shopping.ordersSub', { defaultValue: '최근 3개월' }), path: '/my-orders' },
        { Icon: PinIcon, label: t('userProfile.addressManage', { defaultValue: '배송지 관리' }), path: '/mypage/addresses' },
        { Icon: ReviewIcon, label: t('userProfile.myReviews', { defaultValue: '내 리뷰' }), path: '/my-reviews' },
      ],
    },
  ]

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      {/* 🏷️ 블록 라벨 — 대표 확정 **이름 E**(2026-09-28): 손님 쪽엔 25px 구역 제목을 두지 않는다
          (제목이 붙은 구역이 파는 쪽이라는 규칙이 그것 하나로 선다). 잉크색이라 아래 그룹 라벨(회색)과
          층이 갈린다. */}
      <p className="text-[15px] font-extrabold text-gray-900 dark:text-white">{t('shopping.sectionTitle', { defaultValue: '내가 산 것' })}</p>
      {/* 🧾 2026-09-28: 세 그룹을 **한 판**에 담고 라벨을 판 *안*에 넣던 것을, 판매 쪽(`매일`·`가끔`)과
          같은 문법으로 되돌렸다 — 판 밖 라벨 + 그룹마다 따로 판(CLAUDE.md 표면 규칙 ⑦).
          종전엔 13행이 한 덩어리라 훑을 단위가 없었고, 같은 화면의 판매 목록과 글자 크기까지 갈렸다. */}
      {groups.map((g) => (
        <div key={g.key}>
          <GroupLabel>{g.label}</GroupLabel>
          <ListPlate>
            {g.items.map((item) => (
              <ListRow
                key={item.path}
                icon={rowIcon(item.Icon)}
                label={item.label}
                hint={item.sub}
                count={item.count}
                onClick={() => navigate(item.path)}
              />
            ))}
          </ListPlate>
        </div>
      ))}
    </div>
  )
}
