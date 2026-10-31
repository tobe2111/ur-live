import { useEffect, useRef, useState } from 'react'
import { useCurrentDong } from '@/hooks/useCurrentDong'
import { BedDouble, LocateFixed } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import SiteFooter from '@/components/main/SiteFooter'
import GroupBuyFeed from '@/pages/main-home/GroupBuyFeed'
import { DEAL_CATS, type DealCategory } from './PcHomeRail'
import { useHomeQuerySync } from '@/pages/main-home/useHomeQuerySync'
import PcHomeAppBand from './PcHomeAppBand'
import { readHomeRegion, homeStartLoc, type HomeRegion } from './PcHomeLocationBar'
import RegionLinkGrid from '@/components/region/RegionLinkGrid'
import HomeBannerStrip from '@/components/home/HomeBannerStrip'
import { resolveHomeNear, syncNearCookie } from '@/components/home/home-near'
import { HOME_SHOWCASE_ENABLED, REGION_PAGES_ENABLED } from '@/shared/feature-flags'
import type { FeedFilters } from '@/shared/home-feed-filters'
import PcHeroBanners from './PcHeroBanners'
import HomeSections from '@/components/home/HomeSections'
import UrShortsRail from '@/components/home/UrShortsRail'
import PcRegionTiles from './PcRegionTiles'
import PcFeedSidebar from './PcFeedSidebar'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { homeFeedTitle } from './home-location-label'

/**
 * 🖥️ 2026-07-15 (대표 시안 — 당근 스타일 PC 홈): lg+ 전용 풀너비 홈.
 *   구조: [좌측 카테고리 레일] + [제목 + 정렬칩 + 조밀한 딜 그리드(GroupBuyFeed pc 재사용)] + 앱배너 + 푸터.
 *   - 데이터/SSR시드/prefetch/페이지네이션은 GroupBuyFeed 공유(모바일 홈과 동일 SSOT — 중복 fetch 0).
 *   - 카테고리(레일)·정렬(칩)은 여기서 관리 → GroupBuyFeed controlled 로 주입.
 *   - 라이트 기본 + dark: 대응(앱 테마 토글 정합). 모바일(<lg)은 RestaurantMapPage 가 담당(App.tsx HomeRoute 분기).
 *   상단 네비는 전역 DesktopTopNav(홈 인지 — 풀폭 정렬) 가 담당 → 여기선 콘텐츠만.
 */

/**
 * 🧩 2026-10-14 (대표 확정 "시안 4" — *"시안은 2번과 3번이 섞이면 좋겠는데? 위 배너 부분은 3번이 마음에 들어"*
 *   → *"응 일단 이렇게 만들까?"* → 시안 6 *"주말에 떠나는 숙소 이건 빼줘 … 시안대로 구현"*): 위에서부터
 *   [큰 배너 1 + 작은 배너 2] → [어드민 섹션(모바일과 같은 것) + 유어쇼츠] → [어디로 갈까요? 지역 4칸] → [왼쪽 필터 + 4열 목록]. 시안 SSOT: `docs/design/pc-home-redesign-2026-10-13.md`.
 *   ⚠️ 이 구성이 대체한 것: 히어로(색면 + 위치 칩 + 사진 띠) · 한 줄 세 장 배너 · 중간 배너(inline).
 *      위치 칩은 왼쪽 필터로 옮겼다(같은 부품). 모바일 홈은 그대로다.
 */
const SORT_CHIPS = [
  { key: 'popular',  label: '인기순' },
  { key: 'newest',   label: '최신순' },
  { key: 'discount', label: '할인율순' },
] as const
type SortKey = typeof SORT_CHIPS[number]['key'] | 'near'

const DEAL_CATEGORY_KEYS: DealCategory[] = ['all', 'meal_voucher', 'beauty_voucher', 'stay_voucher', 'home_voucher', 'etc_voucher']
// 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): 'deadline' 제거 — 옛 `?sort=deadline` 링크는 'popular' 로 폴백된다.
const SORT_KEYS: SortKey[] = ['popular', 'newest', 'discount']

export default function PcHomePage() {
  // 🧭 2026-07-20 (카테고리 이동 전수조사): `/?category=` 딥링크로 초기 카테고리 지정 지원 —
  //   /stays 칩이 홈 필터로 되돌아오는 경로(모바일 지도 홈 RestaurantMapPage 의 ?category 초기화와 쌍).
  const [category, setCategory] = useState<DealCategory>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('category') as DealCategory | null
      return q && DEAL_CATEGORY_KEYS.includes(q) ? q : 'all'
    } catch { return 'all' }
  })
  // 🏷️ 선택된 카테고리의 한글 라벨 — 'all' 이면 빈 문자열(= 홈 기본 문구 유지). 라벨 SSOT 는 PcHomeRail.
  const catLabel = category === 'all' ? '' : (DEAL_CATS.find(c => c.key === category)?.label || '')
  /**
   * 🧭 2026-09-05 (대표 "기본 디폴트가 현재 위치에서 가까운 순대로"): 모바일 홈과 **같은 규칙**.
   *   위치는 새로 묻지 않고 마지막 측위 캐시만 읽는다. 지역을 직접 고른 사람은 제외한다.
   */
  const [sort, setSort] = useState<SortKey>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('sort') as SortKey | null
      if (q && SORT_KEYS.includes(q)) return q
    } catch { /* 쿼리 파싱 실패는 기본값으로 */ }
    // 🧭 2026-09-08 (대표 "가장 가까운 순이 먼저"): 좌표가 있으면 **저장된 지역을 이긴다**.
    //    근거·함정은 `MobileHomePage` 의 같은 자리에 길게 적어 뒀다(두 홈이 같은 규칙을 공유한다).
    return homeStartLoc() ? 'near' : 'popular'
  })

  // 🔗 섹션 '더보기'는 `/?sort=popular` 같은 **쿼리 전용 이동**이다. 그 반영 로직은
  //   `useHomeQuerySync` 한 곳에 있다 — 2026-08-27 이전엔 이 파일에만 있어서
  //   **모바일 홈에서는 더보기를 눌러도 아무 일도 안 일어났다**(대표 신고).
  const gridHeaderRef = useRef<HTMLElement | null>(null)
  useHomeQuerySync({ setCategory, setSort, gridHeaderRef })
  // 🗺️ 2026-07-16 (대표 — PC 홈 위치 필터): 선택 지역(초기값 = 지난 방문 저장분). GroupBuyFeed 로 주입.
  const [region, setRegion] = useState<HomeRegion>(() => (homeStartLoc() ? {} : readHomeRegion()))
  // 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): GPS 좌표. 세팅되면 sort='near'(거리순, 숨기지 않고 재배열).
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(() => homeStartLoc())
  // 🧭 2026-08-30 (대표 "홈에선 현재 위치가 어딘지도 나와야지") — 모바일 홈과 같은 훅.
  const dong = useCurrentDong(userLoc)
  /**
   * 📍 2026-10-13 (대표 — 위치를 정하면 맨 위가 그 지역에서 가까운 이용권, 시안 확정 "1,2 섞어서"):
   *   내 위치 → 그 좌표, 지역만 고름 → 시/도 중심. 편성 섹션이 이걸로 정렬된다(어드민 수동 섹션은 그대로).
   *   쿠키도 맞춘다 — 다음 하드로드에서 워커가 같은 위치로 섹션 시드를 받아 첫 화면부터 동네 것이 뜬다.
   */
  const near = resolveHomeNear({ userLoc, dongLabel: dong?.dong, regionKey: region.regionKey })
  useEffect(() => { syncNearCookie(near.key, near.label) }, [near.key, near.label])
  // '현 위치로 설정' → 거리순 정렬 + 지역필터 해제(가까운 딜을 전부 보여줌).
  const handleLocate = (loc: { lat: number; lng: number }) => { setUserLoc(loc); setRegion({}); setSort('near') }
  // 지역 드롭다운 선택 → 지역 필터 모드(거리순 해제).
  const handleRegion = (r: HomeRegion) => { setRegion(r); setUserLoc(null); setSort((s) => (s === 'near' ? 'popular' : s)); setFilters((f) => ({ ...f, maxKm: null })) }
  // 🎚️ 왼쪽 필터의 거리·가격(지역·종류는 위 state 가 맡는다). 위치를 풀면 거리 필터도 같이 푼다(판정 불가).
  const [filters, setFilters] = useState<FeedFilters>({})

  return (
    /* 🎨 2026-08-19 (대표 확정 — 그루폰식 색면): PC 메인 배경을 브랜드 잉크(#16181C)로 덮고
       콘텐츠는 흰 패널로 띄운다. 그루폰이 초록으로 하는 것을 우리 딥네이비로.
       ⚠️ PC 메인 한정(대표 지시) — 다른 소비자 페이지는 흰 배경 그대로. */
    <div className="bg-[var(--home-field)] min-h-[100dvh]">
      {/* 🔁 2026-10-14 — 모바일 홈과 같은 이유로 표에서 읽는다(같은 URL 두 제목 해소). */}
      <SEO
        title={CONSUMER_SURFACE_SEO['/'].title}
        description={CONSUMER_SURFACE_SEO['/'].description}
        url="/"
        jsonLd={[organizationJsonLd, webSiteJsonLd]}
      />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 pt-6 pb-10 flex flex-col gap-6">
        {/* 🎯 2026-08-08 대표 규칙 유지 — 카테고리를 고르면 맨 위가 **그 카테고리**여야 한다(위 세 줄은 카테고리를 모른다).
            상단 네비의 식사·미용·숙소는 `/?category=` 로 오므로, 그때는 아래 탐색 패널이 맨 위로 온다. */}
        {category === 'all' && (
          <>
            {/* ① 큰 배너 1 + 작은 배너 2 — 배너가 없으면 아무것도 안 그린다(대표 규칙). */}
            {HOME_SHOWCASE_ENABLED && <PcHeroBanners />}
            {/* ② 어드민 편성 섹션 — **모바일과 같은 섹션**(제목·순서·위치 정렬이 어드민 하나로 같이 간다).
                PC 는 한 줄로 넘긴다(`rail`). 유어쇼츠는 모바일과 같은 자리(첫 섹션 다음).
                2026-10-14 대표 "시안 6" — 시안 4 의 '인기 순위' 별도 줄을 대체(이름이 어드민과 갈리고 위치 정렬을 잃었다). */}
            {HOME_SHOWCASE_ENABLED && <HomeSections rail near={near} shortsRail={<UrShortsRail />} midBanner={<HomeBannerStrip variant="inline" />} />}
            {/* ③ 어디로 갈까요? — 네 곳이 안 모이면 줄 자체를 안 그린다. */}
            {REGION_PAGES_ENABLED && <PcRegionTiles />}
            {/* 어드민이 '가로 전체' 자리를 고른 배너가 있을 때만(없으면 null). */}
            {HOME_SHOWCASE_ENABLED && <HomeBannerStrip variant="wide" />}
          </>
        )}

        {/* ④ 탐색 — 왼쪽 필터 + 목록(시안 2). 흰 패널 하나에 담는다(색면 위에 뜬 매대). */}
        <div className="ur-home-panel !mb-0 flex gap-8 items-start">
          <PcFeedSidebar
            region={region} onRegionChange={handleRegion} onLocate={handleLocate}
            located={!!userLoc} locatedLabel={dong?.dong}
            category={category} onCategoryChange={setCategory}
            filters={filters} onFiltersChange={setFilters}
          />
          <main className="min-w-0 flex-1">
          {/* 🏷️ 2026-08-08: 카테고리를 고르면 제목이 **그 카테고리를 말한다**(걸러졌다는 신호). */}
          <header ref={gridHeaderRef} className="mb-4 scroll-mt-24 flex items-center justify-between gap-4 flex-wrap">
            <div>
            <h1 className="text-[24px] font-bold tracking-tight text-gray-900 dark:text-white">
              {catLabel
                ? `${catLabel} 이용권`
                : homeFeedTitle({ located: !!userLoc, dongLabel: dong?.dong, region })}
            </h1>
            {catLabel && (
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{`${catLabel} 이용권만 모아 봤어요.`}</p>
            )}
            </div>

          {/* 정렬 칩 — 제목 오른쪽(시안 2). 선택 = 브랜드 블루 면(2026-09-07 안 B — 서비스 공통). */}
          <div className="flex items-center gap-2 flex-wrap">
            {userLoc && (
              <button
                onClick={() => setSort('near')}
                aria-pressed={sort === 'near'}
                className={`px-4 py-2 rounded-full text-[12px] font-medium border transition-colors inline-flex items-center gap-1 ${
                  sort === 'near'
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2C2F35] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <LocateFixed className="w-[15px] h-[15px]" aria-hidden="true" />가까운 순
              </button>
            )}
            {SORT_CHIPS.map(s => {
              const active = sort === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  aria-pressed={active}
                  className={`px-4 py-2 rounded-full text-[12px] font-medium border transition-colors ${
                    active
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2C2F35] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          </header>

          {/* 🏨 2026-07-20: 숙소 = 제자리 필터. 날짜·인원 검색은 명시적 링크로만 /stays 이동. */}
          {category === 'stay_voucher' && (
            <Link
              to="/stays"
              className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-line hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
            >
              <span className="text-[13px] font-medium text-gray-900 dark:text-white"><BedDouble className="w-4 h-4 inline-block align-[-3px] mr-1 text-gray-400" aria-hidden="true" />날짜·인원으로 숙소 검색하기</span>
              <span className="text-[13px] text-gray-500 dark:text-gray-400">체크인/체크아웃 지정 →</span>
            </Link>
          )}

          {/* 딜 그리드 — 모바일 홈과 동일 GroupBuyFeed (pc 레이아웃). 접힘 아래라 firstScreen=false. */}
          <GroupBuyFeed
            pc
            firstScreen={false}
            category={category}
            onCategoryChange={setCategory}
            sort={sort}
            onSortChange={setSort}
            regionKey={region.regionKey}
            districtKey={region.districtKey}
            userLoc={userLoc}
            sectionNearKey={near.key}
            filters={filters}
          />
          </main>
        </div>
      </div>

      {/* 🗺️ 2026-08-03 (대표 — 여기어때 하단 링크 그리드 차용): 지역 텍스트 링크.
          크롤러가 `/region/*` 페이지를 발견하는 통로 + 사용자 지역 탐색. 이미지 0 → LCP 영향 없음.
          플래그 OFF 면 아무것도 안 그린다(홈은 2026-07-19 확정 구조로 즉시 복귀). */}
      {/* 🎨 2026-08-19: 색면 위에서는 자체 배경이 없으면 글자가 묻힌다(gray-900 on 잉크).
          지역 링크는 흰 밴드로 깔아 하단을 마무리한다 — 그루폰 하단 링크 영역과 같은 처리. */}
      {REGION_PAGES_ENABLED && <RegionLinkGrid className="bg-white dark:bg-[#11141C]" />}

      <PcHomeAppBand />
      <SiteFooter />
    </div>
  )
}
