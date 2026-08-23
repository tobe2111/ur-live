import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Bell, ShoppingCart, Map as MapIcon, ChevronRight } from 'lucide-react'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import GroupBuyFeed from '@/pages/main-home/GroupBuyFeed'
import HomeSections from '@/components/home/HomeSections'
import HomeBannerStrip from '@/components/home/HomeBannerStrip'
import PcHomeLocationBar, { readHomeRegion, type HomeRegion } from '@/pages/pc-home/PcHomeLocationBar'
import { DEAL_CATS, type DealCategory } from '@/pages/pc-home/PcHomeRail'
import { HOME_SHOWCASE_ENABLED } from '@/shared/feature-flags'

/**
 * 📱 모바일 메인 (2026-08-19 대표 확정 — 그루폰 모바일 홈 시안).
 *
 * ## 무엇이 바뀌었나
 * 모바일 홈은 **지도**였다(`RestaurantMapPage`). 대표 지시: *"이건 그루폰 페이지인데 모바일
 * 메인으로 해서 우리도 이걸 메인으로 해줘. 지금은 맵 링크잖아. 대신 변경되는 페이지에서
 * 맵으로 이동하기 버튼이 있어야겠지?"* ⇒ 메인은 **딜 피드**, 지도는 **상단 배너**로 간다.
 * (하단 탭 5개는 그대로 — 대표 확정 "안 넣기 — 상단 배너만".)
 *
 * ## 🧩 PC 홈과 같은 재료를 쓴다
 * 카드(`GroupBuyFeed`)·편성 섹션(`HomeSections`)·배너·위치바를 **PC 홈과 공유**한다.
 * 모바일용으로 따로 만들면, 이 레포가 이미 여러 번 겪은 대로 **한쪽만 개선되는** 상태로 간다
 * (숙소 상세가 정확히 그랬다). 여기서 모바일 고유인 것은 레이아웃(2열·세로 흐름)뿐이다.
 *
 * ⚠️ 지도로 가는 길을 **반드시** 남긴다 — 홈이 지도였으므로, 배너가 사라지면 사용자는 지도를
 *    찾을 방법이 없어진다(하단 탭에도 지도가 없다). 그래서 가드로 고정한다.
 */
export default function MobileHomePage() {
  const navigate = useNavigate()
  const [region, setRegion] = useState<HomeRegion>(() => readHomeRegion())
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [category, setCategory] = useState<DealCategory>('all')
  const [sort, setSort] = useState<'popular' | 'newest' | 'deadline' | 'discount' | 'near'>('popular')

  const handleLocate = (loc: { lat: number; lng: number }) => { setUserLoc(loc); setRegion({}); setSort('near') }
  const handleRegion = (r: HomeRegion) => { setRegion(r); setUserLoc(null); setSort((s) => (s === 'near' ? 'popular' : s)) }

  return (
    <div className="bg-white dark:bg-[#0F151D] min-h-[100dvh]">
      <SEO
        title="유어딜 — 동네 이용권·공동구매·교환권을 할인가로"
        description="우리 동네 이용권·동네딜·교환권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요."
        url="/"
        jsonLd={[organizationJsonLd, webSiteJsonLd]}
      />

      {/* 상단 — 로고 · 위치 · 아이콘. 지도 홈이 갖고 있던 진입점(검색·알림·장바구니)을 그대로 승계한다. */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0F151D]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2A3446]">
        <div className="px-4 h-12 flex items-center justify-between gap-2">
          <Link to="/" aria-label="홈" className="shrink-0 flex items-center"><UrDealLogo size={18} /></Link>
          <div className="flex items-center gap-1 text-gray-700 dark:text-gray-200 min-w-0">
            <PcHomeLocationBar value={region} onChange={handleRegion} onLocate={handleLocate} located={!!userLoc} />
            <button onClick={() => navigate('/search')} aria-label="검색" className="p-1.5 shrink-0"><Search className="h-5 w-5" strokeWidth={1.5} /></button>
            <button onClick={() => navigate('/notifications')} aria-label="알림" className="p-1.5 shrink-0"><Bell className="h-5 w-5" strokeWidth={1.5} /></button>
            <button onClick={() => navigate('/cart')} aria-label="장바구니" className="p-1.5 shrink-0"><ShoppingCart className="h-5 w-5" strokeWidth={1.5} /></button>
          </div>
        </div>

        {/* 카테고리 — 라벨·아이콘 SSOT 는 PC 헤더와 같은 `DEAL_CATS`(둘이 갈리지 않게). */}
        <nav aria-label="카테고리" className="flex gap-1 overflow-x-auto no-scrollbar px-3 pb-2">
          {DEAL_CATS.map(({ key, label, icon: Icon }) => {
            const on = category === key
            return (
              <button
                key={key}
                onClick={() => setCategory(key)}
                aria-pressed={on}
                className={`shrink-0 flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${
                  on ? 'text-brand bg-brand/[0.07] font-bold' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={on ? 2.1 : 1.7} />
                <span className="text-[11px] leading-none">{label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* 🗺️ 지도 진입 — 홈이 지도였으므로 **이 배너가 유일한 통로**다(하단 탭에 지도가 없다). */}
      <Link
        to="/map"
        className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-gray-50 dark:bg-white/[0.04] px-4 py-3 active:scale-[0.99] transition-transform"
      >
        <span className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
          <MapIcon className="w-[18px] h-[18px]" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-extrabold text-gray-900 dark:text-white">내 주변 지도로 보기</span>
          <span className="block text-[12px] text-gray-500 dark:text-gray-400">가까운 순으로 딜을 지도에서 찾아보세요</span>
        </span>
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
      </Link>

      {/* 어드민 편성(섹션·배너) — 카테고리를 고르면 숨긴다(PC 홈과 같은 규칙: 화면 맨 위가 그 카테고리여야 한다). */}
      {HOME_SHOWCASE_ENABLED && category === 'all' && (
        <div className="mt-3">
          <HomeSections midBanner={<HomeBannerStrip variant="inline" />} />
          <HomeBannerStrip variant="wide" />
        </div>
      )}

      <section className="mt-4">
        <header className="px-4 mb-2">
          <h2 className="text-[17px] font-black tracking-tight text-gray-900 dark:text-white">
            {userLoc ? '내 주변 가까운 딜' : region.regionKey ? '이 지역 동네 딜' : '가까운 동네 딜'}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">이용권 · 공동구매 · 교환권을 할인가로</p>
        </header>
        {/* 실측: 이 피드는 히어로·편성섹션 아래라 첫 행이 접힘 밖(모바일 1,605px / PC 1,385px) */}
        <GroupBuyFeed
          firstScreen={false}
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          regionKey={region.regionKey}
          districtKey={region.districtKey}
          userLoc={userLoc}
        />
      </section>
    </div>
  )
}
