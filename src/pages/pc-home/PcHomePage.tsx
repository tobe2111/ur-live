import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import SiteFooter from '@/components/main/SiteFooter'
import GroupBuyFeed from '@/pages/main-home/GroupBuyFeed'
import PcHomeRail, { DEAL_CATS, type DealCategory } from './PcHomeRail'
import PcHomeMapButton from './PcHomeMapButton'
import PcHomeAppBand from './PcHomeAppBand'
import PcHomeLocationBar, { readHomeRegion, type HomeRegion } from './PcHomeLocationBar'
import RegionLinkGrid from '@/components/region/RegionLinkGrid'
import HomeHeroBanner from '@/components/home/HomeHeroBanner'
import HomeBannerStrip from '@/components/home/HomeBannerStrip'
import HomeSections from '@/components/home/HomeSections'
import { HOME_SHOWCASE_ENABLED, REGION_PAGES_ENABLED } from '@/shared/feature-flags'

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
const SORT_KEYS: SortKey[] = ['popular', 'newest', 'deadline', 'discount']

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
  const [sort, setSort] = useState<SortKey>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('sort') as SortKey | null
      return q && SORT_KEYS.includes(q) ? q : 'popular'
    } catch { return 'popular' }
  })

  // 🔗 2026-08-17 (대표 신고 — 섹션 '더보기' 플래시): 더보기가 `/?sort=popular` 같은 **쿼리 전용 이동**을
  //   쓴다(App.tsx key=pathname 이라 리마운트 0 = 플래시 0). 그런데 이 페이지는 카테고리/정렬을 마운트
  //   시점에만 읽어서, 쿼리만 바뀌면 아무 일도 안 일어난다 → 내비게이션마다 쿼리를 state 에 반영하고
  //   그리드 제목으로 스크롤해 "더보기 = 전체 목록으로 이동"이 눈에 보이게 한다. 첫 마운트는 스킵
  //   (일반 홈 진입에서 점프 금지) — 칩 클릭(쿼리 무변경)에는 영향 없다.
  const location = useLocation()
  const gridHeaderRef = useRef<HTMLElement | null>(null)
  const firstQuerySync = useRef(true)
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const qCat = q.get('category') as DealCategory | null
    const qSort = q.get('sort') as SortKey | null
    if (qCat && DEAL_CATEGORY_KEYS.includes(qCat)) setCategory(qCat)
    if (qSort && SORT_KEYS.includes(qSort)) setSort(qSort)
    if (firstQuerySync.current) { firstQuerySync.current = false; return }
    if (qSort || qCat) gridHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // location.key = 내비게이션마다 갱신 — 같은 더보기를 두 번 눌러도 다시 스크롤된다.
  }, [location.key, location.search])
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

      {/* 🏠 ④ 히어로 배너 (2026-08-04 대표 시안 승인) — 풀블리드, 컨테이너 **밖**.
          등록된 히어로가 없으면 아무것도 안 그린다 → 아래 컨테이너가 그대로 최상단(현행과 동일). */}
      {HOME_SHOWCASE_ENABLED && <HomeHeroBanner />}

      {/* 🖥️ 2026-07-19 (대표 — "왼쪽 카테고리보단 위에"): 좌측 레일 제거 → 풀너비. 카테고리는 상단 가로 바(PcHomeRail).
          📐 2026-08-17 (대표 — "컴팩트하게, 여백이 많은 느낌" · 여기어때/그루폰 참고): 컨테이너 1600→1440
          + 상하 여백 축소. 카드 밀도는 GroupBuyFeed pc 그리드(xl 5열·2xl 6열)와 짝. */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 pt-4">
        <main className="min-w-0">
          {/* 🗺️ 상단 헤더 행 — 좌: 위치바+카테고리 / 우: 지도 썸네일 버튼(대표 지정 위치 — 빈 공간 활용). */}
          <div className="mb-4 border-b border-gray-100 dark:border-[#2A3446] pb-3 flex items-start justify-between gap-8">
            <div className="flex-1 min-w-0">
              <div className="mb-3">
                <PcHomeLocationBar value={region} onChange={handleRegion} onLocate={handleLocate} located={!!userLoc} />
              </div>
              <PcHomeRail category={category} onCategory={setCategory} />
            </div>
            <PcHomeMapButton />
          </div>

          {/* 🏠 ① 카테고리 섹션(+더보기) · ③ 중간 배너 (2026-08-04 대표 시안 승인).
              어드민이 만든 섹션·배너가 하나도 없으면 **전부 null** → 아래 딜 그리드가 그대로
              이어진다(대표 확정 "안 올리면 아예 안 보이게"). 되돌리기는 플래그 하나. */}
          {/* 🎯 2026-08-08 (대표 — "카테고리 페이지를 눌러도 맨 위가 그 카테고리에 맞는 이용권이 안 나와.
              UI 자체가 잘못됐어. 그 카테고리 이용권만 나와야지"): 쇼케이스 섹션·배너는 **어드민이 큐레이션한
              홈 전용 편성**이라 카테고리를 모른다. 그래서 숙소를 눌러도 맨 위엔 그대로 남아 있었고,
              카테고리로 걸러진 그리드는 그 **아래**에 있었다 — 화면 맨 위가 카테고리와 무관했던 이유.
              ⇒ 카테고리를 고른 순간엔 숨긴다. 'all'(홈 기본)에서만 편성이 보인다. */}
          {HOME_SHOWCASE_ENABLED && category === 'all' && (
            <>
              <HomeSections midBanner={<HomeBannerStrip variant="inline" />} />
              <HomeBannerStrip variant="wide" />
            </>
          )}

          {/* 🏷️ 2026-08-08: 카테고리를 고르면 제목·설명이 **그 카테고리를 말한다.** 이전엔 숙소를 눌러도
              제목이 "내 주변 가까운 딜"이라, 화면이 걸러졌다는 신호가 어디에도 없었다. */}
          <header ref={gridHeaderRef} className="mb-3 scroll-mt-24">
            <h1 className="text-[20px] font-black tracking-tight text-gray-900 dark:text-white">
              {catLabel
                ? `${catLabel} 이용권`
                : userLoc ? '내 주변 가까운 딜' : region.regionKey ? '이 지역 동네 딜' : '가까운 동네 딜'}
            </h1>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
              {catLabel
                ? `${catLabel} 이용권만 모아 봤어요.`
                : '이용권 · 공동구매 · 교환권을 할인가로 바로 만나보세요.'}
            </p>
          </header>

          {/* 정렬 칩 — 현위치 설정 시 '가까운 순' 칩 노출(거리순). */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {userLoc && (
              <button
                onClick={() => setSort('near')}
                aria-pressed={sort === 'near'}
                className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-bold border transition-colors inline-flex items-center gap-1 ${
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
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-bold border transition-colors ${
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
