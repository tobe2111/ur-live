import { useState } from 'react'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import SiteFooter from '@/components/main/SiteFooter'
import GroupBuyFeed from '@/pages/main-home/GroupBuyFeed'
import PcHomeRail, { type DealCategory } from './PcHomeRail'
import PcHomeAppBand from './PcHomeAppBand'

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
type SortKey = typeof SORT_CHIPS[number]['key']

export default function PcHomePage() {
  const [category, setCategory] = useState<DealCategory>('all')
  const [sort, setSort] = useState<SortKey>('popular')

  return (
    <div className="bg-white dark:bg-[#020202] min-h-[100dvh]">
      <SEO
        title="유어딜 — 동네 이용권·공동구매·교환권을 할인가로"
        description="우리 동네 이용권·동네딜·교환권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요."
        url="/"
        jsonLd={[organizationJsonLd, webSiteJsonLd]}
      />

      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-6 flex gap-8 items-start">
        <PcHomeRail category={category} onCategory={setCategory} />

        <main className="flex-1 min-w-0">
          <header className="mb-4">
            <h1 className="text-[24px] font-black tracking-tight text-gray-900 dark:text-white">가까운 동네 딜</h1>
            <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400">
              이용권 · 공동구매 · 교환권을 할인가로 바로 만나보세요.
            </p>
          </header>

          {/* 정렬 칩 */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
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
                      : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2A2A2A] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* 딜 그리드 — 모바일 홈과 동일 GroupBuyFeed (pc 레이아웃).
              GroupBuyFeed 하단에 '전체 동네딜 보기 →' 링크가 이미 포함됨(중복 방지 위해 여기선 미추가). */}
          <GroupBuyFeed
            pc
            category={category}
            onCategoryChange={setCategory}
            sort={sort}
            onSortChange={setSort}
          />
        </main>
      </div>

      <PcHomeAppBand />
      <SiteFooter />
    </div>
  )
}
