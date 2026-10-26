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
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkCheck } from 'lucide-react'
import UrDealLogo from '@/components/brand/UrDealLogo'
import WishlistButton from '@/components/WishlistButton'
import PinButton from '@/components/curator/PinButton'
import KakaoShareButton from '@/components/KakaoShareButton'

type Props = {
  /** 찜·핀이 붙을 상품 id */
  productId: number
  /** 스크롤 후 가운데에 뜨는 제목 */
  title: string
  /**
   * 🔗 2026-10-15 — 공유 카드 제목. 안 넘기면 `title`(보이는 머리글)을 그대로 쓴다(숙소 등 종전 동작).
   *
   * **왜 가르나**: `title` 은 한 자리에서 두 일을 하고 있었다 — 사진 위 머리글(아래 108줄)과
   * 카카오 공유 카드 제목(아래). 머리글은 **상품명 하나**여야 하고(가게명이 붙으면 좁은 화면에서
   * 잘린다) 공유 카드 제목은 **검색 제목과 같아야** 한다(`passDetailTitle` — 한 링크가 받는 쪽에
   * 따라 다른 이름으로 불리면 안 된다). 둘을 한 값으로 묶으면 한쪽을 고칠 때마다 다른 쪽이 망가진다.
   */
  shareTitle?: string
  shareDescription: string
  shareImageUrl: string
  shareLink: string
  myUserId: string
  /** 카카오 commerce 템플릿용 — 없으면 feed 템플릿으로 나간다(딜 결제 상품 등). */
  price?: number
  discountPct?: number
  /** 히어로(사진) 높이를 재서 그만큼 지나면 solid 로 바꾼다. 없으면 스크롤 60px 기준. */
  heroRef?: React.RefObject<HTMLDivElement | null>
  onBack: () => void
  /** 🎟️ 2026-10-11 (이용권 상세 D안): 빵부스러기 없이 사진이 맨 위부터 깔린다 — 투명 헤더의 로고를 흰 글자로(사진 위 스크림). */
  overPhoto?: boolean
}

export default function DetailFloatingHeader({
  productId, title, shareTitle, shareDescription, shareImageUrl, shareLink, myUserId, price, discountPct, heroRef, onBack, overPhoto = false,
}: Props) {
  // 📜 스크롤 상태를 **여기서** 갖는다. 예전엔 페이지가 각자 갖고 prop 으로 내려 줬는데, 그러다 보니
  //    숙소 상세는 이 컴포넌트를 아예 안 쓰고 뒤로가기 버튼만 따로 두게 됐다(대표 "왜 계속 다르게 하는거지?").
  //    상태가 컴포넌트 안에 있으면 새 상세 페이지는 **한 줄만 쓰면 같은 상단바를 얻는다.**
  const [headerSolid, setHeaderSolid] = useState(false)
  useEffect(() => {
    const HEADER_H = 56 // overlay 헤더 대략 높이 (px)
    const onScroll = () => {
      const h = heroRef?.current?.offsetHeight ?? 0
      const threshold = h > 0 ? Math.max(0, h - HEADER_H) : 60
      setHeaderSolid(window.scrollY > threshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [heroRef])

  // 🔘 네 버튼(뒤로·찜·핀·공유)은 **한 벌**이다. 예전엔 처리가 넷 다 달랐다 —
  //    뒤로/공유는 검정 반투명 원, 찜은 원 없는 맨 하트, 핀은 흰 원 + **이모지 ➕**.
  //    선 아이콘들 사이에 이모지가 하나 섞이면 그 버튼만 혼자 튄다(대표 지적 2026-08-31).
  //    ⇒ 흰 원 + 잉크 선 아이콘 + 옅은 그림자로 통일. 사진 위에서도, 스크롤 후 흰 바에서도 읽힌다.
  // 🌫️ 2026-10-27 (대표 "붕 떠있는 버튼같아 주변 테두리 원을 없애는게" → 시안 C 확정): 사진 위에서는 **원 없이**
  //   흰 아이콘 + 화면 위쪽 옅은 그늘(`onPhoto` 일 때 header 배경)로 읽히게 한다. 사진 색과 무관하게 보인다.
  //   사진이 위에 깔리지 않는 화면(빵부스러기가 먼저인 숙소 등)은 종전 흰 원을 유지한다(흰 바탕 위 흰 아이콘 방지).
  const onPhoto = overPhoto && !headerSolid
  const chip =
    'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white ' +
    (onPhoto
      ? 'bg-transparent text-white [&_svg]:!text-white [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,.35)] focus-visible:ring-white'
      : headerSolid
        ? 'text-gray-900 dark:text-white bg-transparent hover:bg-gray-100 dark:hover:bg-[#1D1F29]'
        : 'text-gray-900 dark:text-white bg-white/90 dark:bg-[#11141C]/85 backdrop-blur shadow-[0_1px_4px_rgba(22,24,28,.18)] hover:bg-white dark:hover:bg-warm')

  // 🏭 2026-06-07 (당근 스타일): 투명 overlay → 스크롤 시 solid 바 전환. position fixed 로 이미지 위에 뜬다.
  // 🖥️ 2026-07-19 (대표 "상단은 공통"): PC(lg+)는 전역 DesktopTopNav 가 담당 → 여긴 모바일 전용(lg:hidden).
  //    핀/공유는 lg 섹션 탭 우측에 별도로 렌더된다.
  return (
    <header
        className={`fixed top-0 inset-x-0 z-40 transition-colors duration-200 lg:hidden ${
          headerSolid
            ? 'bg-white/90 dark:bg-[#11141C]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]'
            : 'bg-transparent border-b border-transparent'
        }`}
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))', paddingBottom: '0.625rem' }}
        role="banner"
      >
        {/* 🌫️ C안 위쪽 그늘 — 헤더보다 길게 늘여 끝선이 안 보이게(헤더 배경으로 깔면 아래 경계가 줄로 보였다). */}
        {onPhoto && <div aria-hidden="true" data-header-scrim className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[160%] bg-gradient-to-b from-black/40 via-black/15 to-transparent" />}
        <div className="px-3 flex items-center justify-between gap-2">
          <button onClick={() => onBack()} className={chip} aria-label="뒤로가기">
            <ArrowLeft className="w-[18px] h-[18px] text-gray-900 dark:text-white" strokeWidth={2.2} />
          </button>
          {/* 🅰️ 브랜드 — 모바일 상세엔 로고가 없었다. 공유 링크로 바로 들어온 사람에게
              "여기가 어디인지" 알려 주는 표식이 하나도 없던 셈이다(PC 는 전역 상단바가 담당).
              스크롤하면 제목에 자리를 내준다. */}
          <Link
            to="/"
            aria-label="유어딜 홈"
            className={`shrink-0 transition-opacity duration-200 ${headerSolid ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'}`}
          >
            <UrDealLogo size={19} forceDark={overPhoto && !headerSolid} />
          </Link>
          {/* 스크롤 시 fade-in 되는 가운데 제목 */}
          <h2
            className={`flex-1 min-w-0 text-center text-[15px] font-bold text-gray-900 dark:text-white truncate transition-opacity duration-200 ${
              headerSolid ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={!headerSolid}
          >
            {title}
          </h2>
          {/* 🛡️ 2026-06-12: 내 유어샵 핀 — 공유 옆 1탭 (ProductCard 의 PinButton 재사용) */}
          {/* 💗 찜 — 홈 카드엔 있는데 상세엔 없었다(상세까지 들어온 사람이 오히려 찜을 못 했다). */}
          <WishlistButton productId={productId} userId={Number(myUserId) || null} size="sm" className={chip} />
          <PinButton
            productId={productId}
            price={price ?? 0}
            variant="detail-floating"
            className={chip}
            icon={(pinned) => pinned
              ? <BookmarkCheck className="w-[18px] h-[18px] text-gray-900 dark:text-white" />
              : <Bookmark className="w-[18px] h-[18px] text-gray-900 dark:text-white" />}
          />
          <KakaoShareButton
            title={shareTitle ?? title}
            description={shareDescription}
            imageUrl={shareImageUrl}
            link={shareLink}
            buttonText="구매하기"
            {...(price ? { salePrice: price, discountRate: discountPct ?? 0, secondaryButtonText: '자세히 보기' } : {})}
            compact
            className={chip}
          />
        </div>
      </header>
  )
}
