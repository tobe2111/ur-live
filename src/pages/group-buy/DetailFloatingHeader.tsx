/**
 * 📱 이용권 상세 — 사진 위에 뜨는 모바일 상단바 (PC 는 전역 `DesktopTopNav` 가 담당)
 *
 * 스크롤 전엔 투명하게 사진 위를 덮고, 내리면 solid 로 바뀌며 가운데 제목이 나타난다
 * (2026-06-07 당근 스타일). 본문에서 빼낸 이유는 파일 크기이기도 하지만, 이 상단바가
 * **자기완결적**이기 때문이다 — 상태는 `headerSolid` 하나뿐이고 나머지는 전부 표시용이다.
 *
 * 🅰️ 2026-08-31: 로고를 넣었다. 모바일 상세엔 브랜드 표식이 하나도 없어서, 공유 링크로 바로
 *    들어온 사람에게 "여기가 어디인지" 알려 줄 게 없었다. 스크롤하면 제목에 자리를 내준다.
 * 💗 같은 날: 찜(하트)도 넣었다. 홈 카드엔 있는데 상세엔 없어서, **상세까지 들어온 사람이
 *    오히려 찜을 못 하고 있었다.**
 */
import { Link } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkCheck } from 'lucide-react'
import UrDealLogo from '@/components/brand/UrDealLogo'
import WishlistButton from '@/components/WishlistButton'
import PinButton from '@/components/curator/PinButton'
import KakaoShareButton from '@/components/KakaoShareButton'

type Props = {
  detail: { id: number; name: string; price: number; restaurant_name?: string; group_buy_current: number; deal_only?: number }
  productId: string | number
  headerSolid: boolean
  shareLink: string
  myUserId: string
  displayDiscountPct: number
  onBack: () => void
}

export default function DetailFloatingHeader({ detail, productId, headerSolid, shareLink, myUserId, displayDiscountPct, onBack }: Props) {
  // 🔘 네 버튼(뒤로·찜·핀·공유)은 **한 벌**이다. 예전엔 처리가 넷 다 달랐다 —
  //    뒤로/공유는 검정 반투명 원, 찜은 원 없는 맨 하트, 핀은 흰 원 + **이모지 ➕**.
  //    선 아이콘들 사이에 이모지가 하나 섞이면 그 버튼만 혼자 튄다(대표 지적 2026-08-31).
  //    ⇒ 흰 원 + 잉크 선 아이콘 + 옅은 그림자로 통일. 사진 위에서도, 스크롤 후 흰 바에서도 읽힌다.
  const chip =
    'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white text-gray-900 dark:text-white ' +
    (headerSolid
      ? 'bg-transparent hover:bg-gray-100 dark:hover:bg-[#1A1C21]'
      : 'bg-white/92 dark:bg-[#0D0F12]/85 backdrop-blur shadow-[0_1px_4px_rgba(22,24,28,.18)] hover:bg-white')

  // 🏭 2026-06-07 (당근 스타일): 투명 overlay → 스크롤 시 solid 바 전환. position fixed 로 이미지 위에 뜬다.
  // 🖥️ 2026-07-19 (대표 "상단은 공통"): PC(lg+)는 전역 DesktopTopNav 가 담당 → 여긴 모바일 전용(lg:hidden).
  //    핀/공유는 lg 섹션 탭 우측에 별도로 렌더된다.
  return (
    <header
        className={`fixed top-0 inset-x-0 z-40 transition-colors duration-200 lg:hidden ${
          headerSolid
            ? 'bg-white/90 dark:bg-[#0D0F12]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]'
            : 'bg-transparent border-b border-transparent'
        }`}
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))', paddingBottom: '0.625rem' }}
        role="banner"
      >
        <div className="px-3 flex items-center justify-between gap-2">
          <button onClick={() => onBack()} className={chip} aria-label="뒤로가기">
            <ArrowLeft className="w-[18px] h-[18px] text-gray-900 dark:text-white" />
          </button>
          {/* 🅰️ 브랜드 — 모바일 상세엔 로고가 없었다. 공유 링크로 바로 들어온 사람에게
              "여기가 어디인지" 알려 주는 표식이 하나도 없던 셈이다(PC 는 전역 상단바가 담당).
              스크롤하면 제목에 자리를 내준다. */}
          <Link
            to="/"
            aria-label="유어딜 홈"
            className={`shrink-0 transition-opacity duration-200 ${headerSolid ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'}`}
          >
            <UrDealLogo size={19} />
          </Link>
          {/* 스크롤 시 fade-in 되는 가운데 제목 */}
          <h2
            className={`flex-1 min-w-0 text-center text-sm font-bold text-gray-900 dark:text-white truncate transition-opacity duration-200 ${
              headerSolid ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={!headerSolid}
          >
            {detail.name}
          </h2>
          {/* 🛡️ 2026-06-12: 내 유어샵 핀 — 공유 옆 1탭 (ProductCard 의 PinButton 재사용) */}
          {/* 💗 찜 — 홈 카드엔 있는데 상세엔 없었다(상세까지 들어온 사람이 오히려 찜을 못 했다). */}
          <WishlistButton productId={detail.id} userId={Number(myUserId) || null} size="sm" className={chip} />
          <PinButton
            productId={detail.id}
            price={detail.price}
            variant="detail-floating"
            className={chip}
            icon={(pinned) => pinned
              ? <BookmarkCheck className="w-[18px] h-[18px] text-gray-900 dark:text-white" />
              : <Bookmark className="w-[18px] h-[18px] text-gray-900 dark:text-white" />}
          />
          <KakaoShareButton
            title={`${detail.name} 공구 참여하기`}
            description={`${detail.restaurant_name ? detail.restaurant_name + ' · ' : ''}${detail.group_buy_current}명 함께 구매 중 · ${displayDiscountPct > 0 ? `${displayDiscountPct}% 할인` : '공동구매 특가'}${myUserId ? ' · 친구 초대 시 양쪽 0.5% 보너스 (첫 1회)' : ''}`}
            imageUrl={`https://urdeal.kr/api/og/group-buy/${productId}`}
            link={shareLink}
            buttonText="나도 참여하기"
            {...(Number((detail as { deal_only?: number }).deal_only) === 1 ? {} : {
              salePrice: detail.price,
              discountRate: displayDiscountPct,
              secondaryButtonText: '자세히 보기',
            })}
            compact
            className={chip}
          />
        </div>
      </header>
  )
}
