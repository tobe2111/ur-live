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

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, ShoppingCart, Bell } from 'lucide-react'
import api from '@/lib/api'
import { isLoggedInSync } from '@/utils/auth'
import SiteFooter from '@/components/main/SiteFooter'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import GroupBuyFeed from './main-home/GroupBuyFeed'

export default function MainHomePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [cartCount, setCartCount] = useState(0)

  // ── 알림 unread + 장바구니 cart 카운트 ─────────────────────────────────
  // 로그인된 사용자만. 실패해도 silent.
  useEffect(() => {
    if (!isLoggedInSync()) return
    let cancelled = false
    api.get('/api/notifications/unread-count')
      .then(res => { if (!cancelled && res.data?.success) setUnreadCount(Number(res.data.data?.count ?? 0)) })
      .catch(() => { /* silent */ })
    api.get('/api/cart')
      .then(res => {
        if (cancelled) return
        const items = Array.isArray(res.data?.data) ? res.data.data : []
        setCartCount(items.length)
      })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <SEO
        title={t('seo.home.title', { defaultValue: '돈버는 쇼핑, 오프라인 공동구매 & 라이브커머스' })}
        description={t('seo.home.description', { defaultValue: '동네 가게 공동구매로 결제하고 딜 적립까지. 인플루언서 추천 공구권 + 라이브 쇼핑.' })}
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

      {/* ═══ 공구 단일 피드 ═══ */}
      <div className="ur-content-wide">
        <GroupBuyFeed />
      </div>

      <SiteFooter />
    </>
  )
}
