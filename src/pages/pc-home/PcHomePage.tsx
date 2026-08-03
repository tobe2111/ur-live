import { useState } from 'react'
import { Link } from 'react-router-dom'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import SiteFooter from '@/components/main/SiteFooter'
import GroupBuyFeed from '@/pages/main-home/GroupBuyFeed'
import PcHomeRail, { type DealCategory } from './PcHomeRail'
import PcHomeMapButton from './PcHomeMapButton'
import PcHomeAppBand from './PcHomeAppBand'
import PcHomeLocationBar, { readHomeRegion, type HomeRegion } from './PcHomeLocationBar'
import RegionLinkGrid from '@/components/main/RegionLinkGrid'
import { REGION_PAGES_ENABLED } from '@/shared/feature-flags'

/**
 * 🖥️ 2026-07-15 (대표 시안 — 당근 스타일 PC 홈): lg+ 전용 풀너비 홈.
 *   구조: [좌측 카테고리 레일] + [제목 + 정렬칩 + 조밀한 딜 그리드(GroupBuyFeed pc 재사용)] + 앱배너 + 푸터.
 *   - 데이터/SSR시드/prefetch/페이지네이션은 GroupBuyFeed 공유(모바일 홈과 동일 SSOT — 중복 fetch 0).
 *   - 카테고리(레일)·정렬(칩)은 여기서 관리 → GroupBuyFeed controlled 로 주입.
 *   - 라이트 기본 + dark: 대응(앱 테마 토글 정합). 모바일(<lg)은 RestaurantMapPage 가 담당(App.tsx HomeRoute 분기).
 *   상단 네비는 전역 DesktopTopNav(홈 인지 — 풀폭 정렬) 가 담당 → 여기선 콘텐츠만.
 */

const SORT_CHIPS = [
  { key: 'popular',  label: '인기순' },
  { key: 'newest',   label: '최신순' },
  { key: 'deadline', label: '마감임박' },
  { key: 'discount', label: '할인율순' },
] as const
type SortKey = typeof SORT_CHIPS[number]['key'] | 'near'

const DEAL_CATEGORY_KEYS: DealCategory[] = ['all', 'meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher']

export default function PcHomePage() {
  // 🧭 2026-07-20 (카테고리 이동 전수조사): `/?category=` 딥링크로 초기 카테고리 지정 지원 —
  //   /stays 칩이 홈 필터로 되돌아오는 경로(모바일 지도 홈 RestaurantMapPage 의 ?category 초기화와 쌍).
  const [category, setCategory] = useState<DealCategory>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('category') as DealCategory | null
      return q && DEAL_CATEGORY_KEYS.includes(q) ? q : 'all'
    } catch { return 'all' }
  })
  const [sort, setSort] = useState<SortKey>('popular')
  // 🗺️ 2026-07-16 (대표 — PC 홈 위치 필터): 선택 지역(초기값 = 지난 방문 저장분). GroupBuyFeed 로 주입.
  const [region, setRegion] = useState<HomeRegion>(() => readHomeRegion())
  // 🗺️ 2026-07-16 (대표 — 현위치로 가까운 순): GPS 좌표. 세팅되면 sort='near'(거리순, 숨기지 않고 재배열).
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  // '현 위치로 설정' → 거리순 정렬 + 지역필터 해제(가까운 딜을 전부 보여줌).
  const handleLocate = (loc: { lat: number; lng: number }) => { setUserLoc(loc); setRegion({}); setSort('near') }
  // 지역 드롭다운 선택 → 지역 필터 모드(거리순 해제).
  const handleRegion = (r: HomeRegion) => { setRegion(r); setUserLoc(null); setSort((s) => (s === 'near' ? 'popular' : s)) }

  return (
    <div className="bg-white dark:bg-[#0F151D] min-h-[100dvh]">
      <SEO
        title="유어딜 — 동네 이용권·공동구매·교환권을 할인가로"
        description="우리 동네 이용권·동네딜·교환권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요."
        url="/"
        jsonLd={[organizationJsonLd, webSiteJsonLd]}
      />

      {/* 🖥️ 2026-07-19 (대표 — "왼쪽 카테고리보단 위에"): 좌측 레일 제거 → 풀너비. 카테고리는 상단 가로 바(PcHomeRail). */}
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-6">
        <main className="min-w-0">
          {/* 🗺️ 상단 헤더 행 — 좌: 위치바+카테고리 / 우: 지도 썸네일 버튼(대표 지정 위치 — 빈 공간 활용). */}
          <div className="mb-5 border-b border-gray-100 dark:border-[#2A3446] pb-3 flex items-start justify-between gap-8">
            <div className="flex-1 min-w-0">
              <div className="mb-4">
                <PcHomeLocationBar value={region} onChange={handleRegion} onLocate={handleLocate} located={!!userLoc} />
              </div>
              <PcHomeRail category={category} onCategory={setCategory} />
            </div>
            <PcHomeMapButton />
          </div>
          <header className="mb-4">
            <h1 className="text-[24px] font-black tracking-tight text-gray-900 dark:text-white">
              {userLoc ? '내 주변 가까운 딜' : region.regionKey ? '이 지역 동네 딜' : '가까운 동네 딜'}
            </h1>
            <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400">
              이용권 · 공동구매 · 교환권을 할인가로 바로 만나보세요.
            </p>
          </header>

          {/* 정렬 칩 — 현위치 설정 시 '가까운 순' 칩 노출(거리순). */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {userLoc && (
              <button
                onClick={() => setSort('near')}
                aria-pressed={sort === 'near'}
                className={`px-4 py-2 rounded-full text-[13px] font-bold border transition-colors inline-flex items-center gap-1 ${
                  sort === 'near'
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2A3446] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                📍 가까운 순
              </button>
            )}
            {SORT_CHIPS.map(s => {
              const active = sort === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  aria-pressed={active}
                  className={`px-4 py-2 rounded-full text-[13px] font-bold border transition-colors ${
                    active
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                      : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2A3446] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* 🏨 2026-07-20: 숙소 카테고리 = 제자리 필터(카테고리 클릭 무이동 원칙). 날짜·인원 검색은
              명시적 배너 링크로만 /stays 이동(이전: 숙소 칩이 저절로 /stays 로 넘어가던 것 제거). */}
          {category === 'stay_voucher' && (
            <Link
              to="/stays"
              className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-[#2A3446] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
            >
              <span className="text-[13px] font-bold text-gray-900 dark:text-white">🏨 날짜·인원으로 숙소 검색하기</span>
              <span className="text-[13px] text-gray-500 dark:text-gray-400">체크인/체크아웃 지정 →</span>
            </Link>
          )}

          {/* 딜 그리드 — 모바일 홈과 동일 GroupBuyFeed (pc 레이아웃).
              GroupBuyFeed 하단에 '전체 동네딜 보기 →' 링크가 이미 포함됨(중복 방지 위해 여기선 미추가). */}
          <GroupBuyFeed
            pc
            category={category}
            onCategoryChange={setCategory}
            sort={sort}
            onSortChange={setSort}
            regionKey={region.regionKey}
            districtKey={region.districtKey}
            userLoc={userLoc}
          />
        </main>
      </div>

      {/* 🗺️ 2026-08-03 (대표 — 여기어때 하단 링크 그리드 차용): 지역 텍스트 링크.
          크롤러가 `/region/*` 페이지를 발견하는 통로 + 사용자 지역 탐색. 이미지 0 → LCP 영향 없음.
          플래그 OFF 면 아무것도 안 그린다(홈은 2026-07-19 확정 구조로 즉시 복귀). */}
      {REGION_PAGES_ENABLED && <RegionLinkGrid />}

      <PcHomeAppBand />
      <SiteFooter />
    </div>
  )
}
