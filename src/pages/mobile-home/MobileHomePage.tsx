import { useRef, useState } from 'react'
import { useCurrentDong } from '@/hooks/useCurrentDong'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Bell, ShoppingCart } from 'lucide-react'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import GroupBuyFeed from '@/pages/main-home/GroupBuyFeed'
import { useHomeQuerySync } from '@/pages/main-home/useHomeQuerySync'
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
  // 🧭 2026-08-30 (대표 "홈에선 현재 위치가 어딘지도 나와야지"): 좌표 → 동네 이름.
  //   서버 엔드포인트는 2026-07-07 부터 있었는데 **아무도 안 부르고 있었다**(useCurrentDong 주석).
  const dong = useCurrentDong(userLoc)
  const [category, setCategory] = useState<DealCategory>('all')
  const [sort, setSort] = useState<'popular' | 'newest' | 'deadline' | 'discount' | 'near'>('popular')

  /**
   * 🔗 2026-08-27 (대표 신고 — "지금 인기 이용권의 더보기 클릭도 안되고"): 섹션 '더보기'는
   *   `/?sort=popular` 같은 **쿼리 전용 이동**인데, 그 반영이 PC 홈에만 있었다. 모바일은 같은
   *   링크를 받고도 쿼리를 안 읽어서 **폰에서 누르면 정말 아무 일도 안 일어났다.**
   *   두 홈이 같은 섹션·같은 링크를 쓰므로 로직도 한 곳(`useHomeQuerySync`)에서 공유한다.
   */
  const gridHeaderRef = useRef<HTMLElement | null>(null)
  useHomeQuerySync({ setCategory, setSort, gridHeaderRef })

  const handleLocate = (loc: { lat: number; lng: number }) => { setUserLoc(loc); setRegion({}); setSort('near') }
  const handleRegion = (r: HomeRegion) => { setRegion(r); setUserLoc(null); setSort((s) => (s === 'near' ? 'popular' : s)) }

  return (
    <div className="bg-white dark:bg-[#0D0F12] min-h-[100dvh]">
      <SEO
        title="유어딜 — 동네 이용권·공동구매·교환권을 할인가로"
        description="우리 동네 이용권·동네딜·교환권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요."
        url="/"
        jsonLd={[organizationJsonLd, webSiteJsonLd]}
      />

      {/* 상단 — 2026-08-31 (대표 "더 대기업 수준의 완성도"): 크롬 4층 → 2층.
          ■ 무엇이 문제였나 (첫 400px 을 세어 보고 알았다)
            컨트롤이 9개였고 **그중 다섯이 전부 같은 형태**였다 — 테두리 두른 둥근 알약
            (지역·현위치·목록/지도·정렬) + 아이콘+라벨 세로 조합(카테고리 5개).
            형태가 하나뿐이면 화면은 "무엇이 중요한지"를 말하지 못한다. 그게 AI 티의 정체다.
          ■ 무엇을 없앴나 — 장식이 아니라 **줄**을 없앴다
            · h2 "가까운 동네 딜" + 부제 "이용권 · 공동구매 · 교환권을 할인가로" → 삭제.
              위치(동네 이름)가 곧 이 화면의 제목이다(당근·배민이 그렇다). 설명 부제는
              정보가 0인데 한 줄을 먹는다.
            · 지역 알약의 테두리·핀 아이콘, 현위치 알약 → 제목 + 옆의 작은 아이콘으로 흡수.
            · 카테고리 아이콘 5개 → 텍스트만. 선 아이콘 + 11px 라벨 조합이 가장 "만들어진" 티가 난다.
              활성은 잉크 + 밑줄로 — 색이 아니라 무게로 말한다(로즈는 하단 탭 하나에만 남긴다). */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="px-4 h-11 flex items-center justify-between gap-2">
          <Link to="/" aria-label="홈" className="shrink-0 flex items-center"><UrDealLogo size={17} /></Link>
          <div className="flex items-center gap-0.5 text-gray-500 dark:text-gray-400">
            <button onClick={() => navigate('/search')} aria-label="검색" className="p-2 shrink-0"><Search className="h-[21px] w-[21px]" strokeWidth={1.5} /></button>
            <button onClick={() => navigate('/notifications')} aria-label="알림" className="p-2 shrink-0"><Bell className="h-[21px] w-[21px]" strokeWidth={1.5} /></button>
            <button onClick={() => navigate('/cart')} aria-label="장바구니" className="p-2 shrink-0"><ShoppingCart className="h-[21px] w-[21px]" strokeWidth={1.5} /></button>
          </div>
        </div>

        {/* 위치 = 제목. 오른쪽은 같은 목록의 다른 보기(지도)로 가는 전환. */}
        <div className="px-4 pt-1 pb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <PcHomeLocationBar tone="title" value={region} onChange={handleRegion} onLocate={handleLocate} located={!!userLoc} locatedLabel={dong?.dong} />
          </div>
          {/* ⚠️ 하단 탭에 지도가 없으므로 **이 컨트롤이 유일한 통로**다 — 지우지 말 것.
              아이콘을 뺀 이유: 이 줄에서 아이콘이 하는 일이 없다(라벨이 이미 두 글자다). */}
          <div role="tablist" aria-label="보기 방식" className="shrink-0 flex items-center gap-0.5 rounded-lg bg-gray-100 dark:bg-white/[0.06] p-0.5">
            <span role="tab" aria-selected="true" className="rounded-[6px] bg-white dark:bg-[#1A1C21] px-3 py-1.5 text-[12.5px] font-bold text-gray-900 dark:text-white shadow-sm">목록</span>
            <Link to="/map" role="tab" aria-selected="false" className="rounded-[6px] px-3 py-1.5 text-[12.5px] font-bold text-gray-500 dark:text-gray-400">지도</Link>
          </div>
        </div>

        {/* 카테고리 — 라벨 SSOT 는 PC 헤더와 같은 `DEAL_CATS`(둘이 갈리지 않게). */}
        <nav aria-label="카테고리" className="flex gap-5 overflow-x-auto no-scrollbar px-4">
          {DEAL_CATS.map(({ key, label }) => {
            const on = category === key
            return (
              <button
                key={key}
                onClick={() => setCategory(key)}
                aria-pressed={on}
                className={`shrink-0 pb-2 text-[14.5px] transition-colors border-b-2 ${
                  on
                    ? 'font-black text-gray-900 dark:text-white border-gray-900 dark:border-white'
                    : 'font-semibold text-gray-400 dark:text-gray-500 border-transparent'
                }`}
              >
                {label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 어드민 편성(섹션·배너) — 카테고리를 고르면 숨긴다(PC 홈과 같은 규칙: 화면 맨 위가 그 카테고리여야 한다). */}
      {HOME_SHOWCASE_ENABLED && category === 'all' && (
        <div className="mt-3">
          <HomeSections midBanner={<HomeBannerStrip variant="inline" />} />
          <HomeBannerStrip variant="wide" />
        </div>
      )}

      <section className="mt-4">
        {/* 🗺️ 지도로 가는 길은 **상단 [목록|지도] 전환**이 갖는다(위 헤더).
            2026-08-30 에 "내 주변 지도로 보기" 배너를 그 전환으로 바꿨고,
            2026-08-31 에 제목·부제를 지우면서 전환도 위치 제목 옆으로 함께 올렸다.
            ⚠️ 하단 탭에 지도가 없으므로 그 컨트롤이 **유일한 통로**다 — 지우지 말 것.
            여기 있던 h2("가까운 동네 딜")와 부제는 삭제했다. 위치가 제목을 겸하므로
            같은 말을 두 번 하게 되고, 부제는 정보가 없는데 한 줄을 먹었다. */}
        <div ref={gridHeaderRef as React.RefObject<HTMLDivElement>} className="scroll-mt-24" />
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
