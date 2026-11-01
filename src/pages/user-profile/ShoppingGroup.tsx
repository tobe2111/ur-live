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
import { useTranslation } from '@/lib/i18n-lite'
import type { LucideIcon } from 'lucide-react'
// 🎨 2026-09-28 (대표 *"앞으로 아이콘은 모두 저 컨셉"*): 뜻을 가진 아이콘은 전부 유어딜 것으로.
//    lucide 로 남는 건 화살표·닫기 같은 **조작** 뿐이고, 이 목록엔 그런 게 없어 0개가 됐다.
import {
  TicketStubIcon, CouponIcon, GiftBoxIcon, StayLineIcon, HeartIcon, StarIcon,
  BellIcon, PinIcon, ReviewIcon,
} from '@/components/icons/urdeal-icons'
import { SectionTitle, ListRow, rowIcon } from './list-grammar'
import type { MyCounts } from './types'
import { SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'

/** 🖊️ 2026-08-30: `icon` 이모지 문자열 → lucide 컴포넌트.
 *  이 목록은 마이페이지의 주 메뉴다 — 11칸이 전부 이모지라 같은 행 오른쪽의
 *  `ChevronRight`(선 아이콘)와 언어가 갈렸고, OS 마다 다른 그림이 나왔다. */
/**
 * 🔵 2026-09-29(안 C): `sub` 는 제목 아래 설명이 아니라 **오른쪽 짧은 값**이다(`ListRow.hint`).
 * 여덟 자 안팎만 — 문장을 넣으면 잘린다. 숫자가 있는 줄은 `count` 가 대신 서므로 `sub` 를 비운다.
 */
type Item = { Icon: LucideIcon; label: string; sub?: string; count?: number | null; path: string }

/**
 * 🧹 2026-10-19 (대표 *"다 이상적으로 진행해줘 모두"*) — '이용권 현황'(전체 구매·사용완료·만료·환불) 바를 걷었다.
 *   맨 위 숫자 줄이 `이용권 N`(지금 쓸 수 있는 장수)을 이미 말하고, 나머지 셋은 '내 이용권' 화면의
 *   탭이 그대로 갖는다. 같은 구역 안에서 제목 아래 숫자 줄·그 아래 메뉴 줄이 겹쳐 '내가 산 것' 이
 *   제목 층 둘로 읽혔다. 되살리지 말 것 — 같은 화면에 이용권 숫자가 두 줄 선다.
 */
export default function ShoppingGroup({ counts }: { counts: MyCounts }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  /**
   * 🔵 2026-09-29(안 C) — **세 그룹(이용권·자산 / 관심 / 주문·배송)을 한 목록으로 폈다.**
   *
   * 그룹 라벨 셋이 각각 24px 여백을 먹어 72px 을 썼는데, 그 대가로 얻는 것이 *세 덩어리로 훑기*였다.
   * 그런데 안 C 는 행이 48px 이라 **열 줄이 480px 에 다 들어간다** — 한 화면 안에 다 보이는 목록을
   * 다시 세 덩어리로 쪼갤 이유가 없다. 순서는 그대로 유지해 옛 근육기억이 안 깨진다.
   *
   * ⚠️ 긴 설명은 **떨어뜨렸다**("매장에서 QR·코드로 사용" 등 — 문법 머리말에 그 손실을 적어 뒀다).
   *   숫자가 서는 줄은 숫자가 말하고, 나머지는 제목이 혼자 선다.
   */
  const items: Item[] = [
    // 🎟️ 2026-08-31 (대표 — 지갑 분리): 이용권/교환권은 서로 다른 보관함이라 행도 둘.
    // 🔢 2026-10-18 (대표 *"같은 숫자 하나로 줄여줘"*): 이용권·쿠폰 장수는 **맨 위 숫자 줄(`MyStats`)이
    //   그 한 곳**이라 이 두 줄엔 숫자를 안 단다(종전엔 같은 값이 세 번·두 번 나왔다). 교환권은 반대로
    //   숫자 줄에 칸이 없으므로(폰·PC 같은 세 칸) **이 줄이 그 한 곳**이다 — 그래서 숫자가 남는다.
    // 🫥 2026-10-18 (대표 *"다 해줘"*): 줄 숫자는 **1 이상일 때만** 단다. 종전엔 '내 교환권 0'·'찜한 상품 0' 이
    //   0 을 적고, 숫자가 없는 '내 이용권'·'쿠폰함' 은 아무것도 안 적어 한 목록이 두 규칙으로 그려졌다.
    //   0 은 들어가 보면 아는 정보라 줄마다 적을 값이 아니다. 조회 실패(null)도 그대로 안 그린다.
    { Icon: TicketStubIcon, label: t('shopping.voucher', { defaultValue: '내 이용권' }), path: '/my-vouchers' },
    { Icon: GiftBoxIcon, label: t('shopping.gifticon', { defaultValue: '내 교환권' }), count: counts.gifticon || undefined, path: '/my-gifticons' },
    { Icon: CouponIcon, label: t('shopping.coupons', { defaultValue: '쿠폰함' }), path: '/my-coupons' },
    { Icon: StayLineIcon, label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), path: '/my-stays' },
    // 🧹 2026-09-02 (대표 "디지털 보관함도 필요없고"): 전자책·강의는 지금 파는 물건이 아니다.
    //   라우트(/my/digital)와 페이지는 남긴다 — 되살릴 때 이 줄만 되돌리면 된다.
    { Icon: HeartIcon, label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), count: counts.wish || undefined, path: '/wishlist' },
    { Icon: StarIcon, label: t('shopping.myFollows', { defaultValue: '내 단골 가게' }), path: '/my/follows' },
    /* 🛍️ 2026-10-18 — '관심 맛집'·'배송지 관리' 는 **쇼핑 탭이 숨겨진 동안** 감춘다.
       관심 등록 버튼은 쇼핑 목록(`/browse`)에만 남아 있고(가게·이용권 화면엔 없다 — 라이브 누적 1건),
       배송지는 배송 상품에만 쓰인다(이용권·교환권은 배송이 없다). 둘 다 들어가면 빈 화면이다.
       라우트·페이지는 남긴다 — 쇼핑을 다시 열면(`SHOPPING_TAB_HIDDEN=false`) 이 두 줄이 저절로 돌아온다. */
    ...(SHOPPING_TAB_HIDDEN ? [] : [{ Icon: BellIcon, label: t('shopping.interestList', { defaultValue: '관심 맛집' }), path: '/interest-list' }]),
    /* 🧾 2026-10-20 (대표 "2,3,4 모두 다 고쳐줘") — '주문 내역' 줄을 목록에서 뺐다. 쇼핑 탭이 숨겨진 지금
       거기 들어 있는 건 이용권·교환권·숙소를 산 **결제 기록**이라, 바로 위 세 줄과 같은 물건을 한 번 더 가리켰다.
       갈 길은 지우지 않는다 — 구역 제목 오른쪽 '결제 내역 ›' 가 같은 화면(/my-orders)으로 간다(영수증·환불 확인). */
    ...(SHOPPING_TAB_HIDDEN ? [] : [{ Icon: PinIcon, label: t('userProfile.addressManage', { defaultValue: '배송지 관리' }), path: '/mypage/addresses' }]),
    { Icon: ReviewIcon, label: t('userProfile.myReviews', { defaultValue: '내 리뷰' }), path: '/my-reviews' },
  ]

  return (
    /* 🧱 가로 패딩을 **주지 않는다** — 평면 행이 자기 `px-4` 를 갖는다(문법 머리말 참조).
       여기에 px-4 를 또 주면 글자가 32px 들어가 구역 제목과 왼쪽 끝이 어긋난다. */
    <div className="ur-content-medium lg:px-4 ur-pc-card">
      <SectionTitle action={{ label: t('shopping.paymentHistory', { defaultValue: '결제 내역' }), onClick: () => navigate('/my-orders') }}>
        {t('shopping.sectionTitle', { defaultValue: '내가 산 것' })}
      </SectionTitle>
      <div>
        {items.map((item) => (
          <ListRow
            key={item.path}
            icon={rowIcon(item.Icon)}
            label={item.label}
            hint={item.sub}
            count={item.count}
            onClick={() => navigate(item.path)}
          />
        ))}
      </div>
    </div>
  )
}
