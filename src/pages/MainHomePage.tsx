/**
 * 🛡️ 2026-05-20: 홈 전면 단순화 (사용자 요청 "오롯이 당근처럼").
 *
 * 모든 섹션 제거:
 *   - SocarStyleHero / SocarStyleBanner / FlashDealsHero
 *   - 오프라인 내 주변 공구 / 예정 방송 / 다시보기
 *   - 카테고리섹션 / RecentlyViewed / InvitePrompt
 *
 * 유지: sticky header (로고 · 검색 · 알림 · 장바구니) + 공구 단일 피드.
 *
 * 페이지 = `<MainHomePage>` ::
 *   <SEO />
 *   <StickyHeader>  ← 모바일만 (md+ 는 DesktopTopNav)
 *     <Logo /> <Search /> <Bell /> <Cart />
 *   </StickyHeader>
 *   <GroupBuyFeed>  ← 카테고리 칩 + 정렬 + 2열 그리드
 *     <GroupBuyFeedCard /> ...
 *   </GroupBuyFeed>
 *   <SiteFooter />
 */

import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, ShoppingCart, Bell } from 'lucide-react'
import { useUnreadCount, useCartCount } from '@/hooks/queries'
import SiteFooter from '@/components/main/SiteFooter'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import DealEarnStrip from '@/components/main/DealEarnStrip'
import HomeDongneDealSection from '@/components/main/HomeDongneDealSection'
import VouchersPage from './VouchersPage'

export default function MainHomePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // 🛡️ 2026-05-22 v5 (전체 영구 마이그레이션):
  //   공통 hook 사용 → DesktopTopNav 와 자동 dedup + localStorage 즉시 표시.
  //   사용자 1명 세션 내 server hit = 1 (이전: 페이지 진입마다 4 calls).
  const { data: unreadCount = 0 } = useUnreadCount()
  const { data: cartCount = 0 } = useCartCount()

  return (
    <>
      <SEO
        title={t('seo.home.title', { defaultValue: '유어딜 — 교환권·공동구매로 돈버는 쇼핑' })}
        description={t('seo.home.description', { defaultValue: '딜로 스타벅스·편의점 교환권 즉시 교환. 링크샵·매장영입으로 딜 적립하고 동네 공동구매까지.' })}
        url="/"
        jsonLd={[organizationJsonLd, webSiteJsonLd]}
      />

      {/* ═══ Sticky Top Bar ═══ — 모바일 전용. md+ 는 DesktopTopNav 가 담당. */}
      <div className="md:hidden sticky top-0 inset-x-0 z-30 bg-white/95 dark:bg-[#020202]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-wide px-4 lg:px-8 h-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <UrDealLogo size={18} />
          </Link>
          <div className="flex items-center gap-1 text-gray-700 dark:text-gray-200">
            <button onClick={() => navigate('/search')} aria-label={t('mainHome.ariaSearch', { defaultValue: '검색' })} className="p-1.5">
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => navigate('/notifications')}
              aria-label={unreadCount > 0
                ? t('mainHome.ariaNotificationsCount', { count: unreadCount })
                : t('mainHome.ariaNotifications')}
              className="p-1.5 relative"
            >
              <Bell className="h-5 w-5" strokeWidth={1.5} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => navigate('/cart')} aria-label={t('mainHome.ariaCart', { defaultValue: '장바구니' })} className="p-1.5 relative">
              <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 🧭 2026-06-10 (UI 100점 패스): 첫 화면 가치 제안 — '이게 무슨 서비스인지' 한 줄 */}
      <p className="ur-content-wide px-4 lg:px-8 pt-1 pb-2 text-[13px] text-gray-400">
        {t('home.tagline', { defaultValue: '우리 동네 맛집·교환권, 같이 사면 더 싸다 🍽️' })}
      </p>

      {/* ═══ 🎟️ 교환권 (홈 메인 콘텐츠) ═══
          🛡️ 2026-06-01 [UNLOCK_LOADING]: 홈 = 교환권 + 딜모으는법 (사용자 승인).
          VouchersPage 를 embedded 로 재사용 — SSR 는 worker MAIN 슬롯(deal_only) 에서 0-RTT 로 읽음.
          오프라인 공구는 동네딜(/group-buy) 탭이 전담. */}
      <VouchersPage embedded />

      {/* ═══ 🍽️ 우리 동네딜 (주력 사업 홈 첫 노출) — 2026-06-10 포털형 홈.
          교환권 40개 캡 아래 위치 — 뷰포트 진입 시에만 fetch (홈 LCP/SSR 잠금 불변, additive). */}
      <HomeDongneDealSection />

      {/* ═══ 💰 딜 모으는 법 — 🧭 2026-06-10: 신규 방문자 첫 콘텐츠로 부적합(기존 사용자용) → 하단 이동 */}
      <DealEarnStrip />


      <SiteFooter />
    </>
  )
}
