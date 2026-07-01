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

import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SiteFooter from '@/components/main/SiteFooter'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import HomeTopHeader from '@/components/main/HomeTopHeader'
import DealEarnStrip from '@/components/main/DealEarnStrip'
import HomeProductsRail from '@/components/main/HomeProductsRail'
import GroupBuyFeed from './main-home/GroupBuyFeed'

export default function MainHomePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title={t('seo.home.title', { defaultValue: '유어딜 — 교환권·공동구매로 돈버는 쇼핑' })}
        description={t('seo.home.description', { defaultValue: '딜로 스타벅스·편의점 교환권 즉시 교환. 링크샵·매장영입으로 딜 적립하고 동네 공동구매까지.' })}
        url="/"
        jsonLd={[organizationJsonLd, webSiteJsonLd]}
      />

      {/* ═══ 홈 상단 헤더 (검색 바 + 위치 행) — 2026-07-01 대표 시안 ═══
          모바일 + PC 액자(lg+). md(768~1023)만 DesktopTopNav 담당(중복 회피). */}
      <HomeTopHeader />

      {/* ═══ 🏘️ 동네딜 (홈 메인 콘텐츠) ═══
          🛡️ 2026-06-18 [UNLOCK_LOADING] (대표 결정 — 홈 = 동네딜 중심): 교환권 blend → 동네딜 피드.
          GroupBuyFeed(category='all') 가 worker MAIN 슬롯(group-buy active)을 0-RTT 로 consume.
          교환권은 아래 entry 로 강등 → /vouchers. */}
      <GroupBuyFeed />

      {/* ═══ 🛍️ 일반 상품 레일 — 실제 상품 미리보기 */}
      <HomeProductsRail />

      {/* ═══ 📱 교환권(기프티콘) — 홈에서 강등: 딜 소진 옵션 entry → /vouchers ═══ */}
      <div className="ur-content-wide px-4 lg:px-8 mt-5">
        <button
          onClick={() => navigate('/vouchers')}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] px-4 py-3.5 active:scale-[0.99] transition-transform"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="text-[20px]">📱</span>
            <span className="text-left min-w-0">
              <span className="block text-[14px] font-bold text-gray-900 dark:text-white">{t('home.gifticonEntry', { defaultValue: '기프티콘 교환권' })}</span>
              <span className="block text-[12px] text-gray-500 dark:text-gray-400 truncate">{t('home.gifticonEntrySub', { defaultValue: '딜로 편의점·카페 기프티콘 구매' })}</span>
            </span>
          </span>
          <span className="text-gray-400 shrink-0 text-[18px]">›</span>
        </button>
      </div>

      {/* ═══ 💰 딜 모으는 법 — 하단 */}
      <DealEarnStrip />


      <SiteFooter />
    </>
  )
}
