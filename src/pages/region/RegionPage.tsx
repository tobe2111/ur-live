import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin, ChevronRight } from 'lucide-react'
import SEO, { breadcrumbJsonLd } from '@/components/SEO'
import SiteFooter from '@/components/main/SiteFooter'
import GroupBuyFeed from '@/pages/main-home/GroupBuyFeed'
import RegionLinkGrid from '@/components/region/RegionLinkGrid'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { REGION_PAGES_ENABLED } from '@/shared/feature-flags'
import {
  parseRegionPath,
  regionPath,
  regionLabel,
  REGION_INDEX_MIN_DEALS,
  type SidoStat,
} from '@/shared/constants/region-slugs'
import NotFoundPage from '@/pages/NotFoundPage'

/**
 * 🗺️ 2026-08-03 (대표 — "도시별로도 보이게" + "구글에 페이지가 쭉 나오게"): 지역 착지 페이지.
 *   `/region/서울` (시/도) · `/region/서울/중구` (시군구) 공용.
 *
 * 이 페이지의 존재 이유는 **검색 착지점**이다. 그래서 홈과 다르게 만든 것 셋:
 *   ① 지도를 띄우지 않는다 — 카카오 지도 SDK(~150KB)를 검색 유입 첫 페인트에 물리면 이탈한다.
 *      대신 '지도에서 보기' 링크로 기존 지도 홈에 넘긴다.
 *   ② 딜이 0건이면 **0건으로 보여준다** — 홈처럼 전국 목록으로 폴백하면 모든 도시 페이지가 같은
 *      콘텐츠가 되어 중복 색인된다(GroupBuyFeed 의 폴백이 regionKey 에만 걸린 이유).
 *   ③ 딜이 `REGION_INDEX_MIN_DEALS` 미만이면 `noindex` — 페이지는 열되 색인은 안 시킨다.
 *      빈 페이지를 대량 색인시키면 사이트 전체 품질 평가가 깎인다(thin content).
 *
 * 카테고리는 **URL 이 아니라 화면 안 필터**다. 지역×카테고리 교차 URL 을 지금 열면 대부분
 * 0~1건짜리 thin 페이지가 된다(2026-08-03 실측: beauty 11건·etc 22건이 전국 합계).
 */

const CATEGORY_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'meal_voucher', label: '식사' },
  { key: 'beauty_voucher', label: '뷰티' },
  { key: 'stay_voucher', label: '숙소' },
  { key: 'etc_voucher', label: '기타' },
] as const
type CategoryKey = typeof CATEGORY_CHIPS[number]['key']

export default function RegionPage() {
  const { sido: sidoParam, sigungu: sigunguParam } = useParams()
  const ref = useMemo(() => parseRegionPath(sidoParam, sigunguParam), [sidoParam, sigunguParam])
  const [category, setCategory] = useState<CategoryKey>('all')

  const { data: regions = [] } = useApiQuery<SidoStat[]>(
    ['regions', 'stats'],
    '/api/regions',
    {
      select: (raw) => {
        const r = raw as { success?: boolean; data?: SidoStat[] }
        return r?.success && Array.isArray(r.data) ? r.data : []
      },
      staleTime: 10 * 60_000,
    },
  )

  // 모르는 지역은 404 — 200 으로 내주면 soft-404 가 되어 크롤 예산을 태운다.
  if (!ref) return <NotFoundPage />

  const label = regionLabel(ref)
  const sidoStat = regions.find(r => r.sido === ref.sido)
  const dealCount = ref.sigungu
    ? (sidoStat?.sigungu.find(s => s.sigungu === ref.sigungu)?.count ?? 0)
    : (sidoStat?.count ?? 0)
  // 집계가 아직 안 왔으면(첫 페인트) 색인 판정을 보류하지 않는다 — 기본은 색인 허용이고,
  // 데이터가 도착해 미달로 밝혀지면 그때 noindex 로 바뀐다(크롤러는 최종 렌더를 본다).
  const known = regions.length > 0
  const noindex = !REGION_PAGES_ENABLED || (known && dealCount < REGION_INDEX_MIN_DEALS)

  const title = `${label} 이용권·동네딜 할인 | 유어딜`
  const description = dealCount > 0
    ? `${label}의 식당·카페·뷰티·숙박 이용권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요. 현재 ${dealCount}개 딜 진행 중.`
    : `${label}의 식당·카페·뷰티·숙박 이용권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요.`

  const crumbs = [
    { name: '홈', url: '/' },
    { name: '지역', url: '/region' },
    { name: ref.sido, url: regionPath({ sido: ref.sido }) },
    ...(ref.sigungu ? [{ name: ref.sigungu, url: regionPath(ref) }] : []),
  ]

  return (
    <div className="bg-white dark:bg-[#0F151D] min-h-[100dvh]">
      <SEO
        title={title}
        description={description}
        url={regionPath(ref)}
        noindex={noindex}
        jsonLd={[breadcrumbJsonLd(crumbs)]}
      />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-10 pt-4 lg:pt-6">
        {/* 브레드크럼 — 사용자 탐색 + 검색결과 계층 표시(JSON-LD 와 쌍) */}
        <nav aria-label="위치" className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 mb-3 flex-wrap">
          {crumbs.map((c, i) => (
            <span key={c.url} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" aria-hidden />}
              {i === crumbs.length - 1
                ? <span className="font-bold text-gray-900 dark:text-white">{c.name}</span>
                : <Link to={c.url} className="hover:underline">{c.name}</Link>}
            </span>
          ))}
        </nav>

        <header className="mb-4">
          <h1 className="text-[22px] lg:text-[26px] font-black tracking-tight text-gray-900 dark:text-white">
            {label} 이용권·동네딜
          </h1>
          <p className="mt-1.5 text-[13px] lg:text-[14px] text-gray-500 dark:text-gray-400">
            {dealCount > 0
              ? <>진행 중인 딜 <b className="text-gray-900 dark:text-white">{dealCount}개</b> · 온라인 결제 후 매장에서 바로 사용</>
              : <>아직 이 지역에 진행 중인 딜이 없어요. 다른 지역을 둘러보세요.</>}
          </p>
        </header>

        {/* 카테고리 — 화면 안 필터(URL 미반영). 교차 URL 은 thin content 라 열지 않는다. */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {CATEGORY_CHIPS.map(ch => {
            const on = category === ch.key
            return (
              <button
                key={ch.key}
                onClick={() => setCategory(ch.key)}
                aria-pressed={on}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold border transition-colors ${
                  on
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2A3446] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {ch.label}
              </button>
            )
          })}
          <Link
            to={`/map?q=${encodeURIComponent(label)}`}
            className="shrink-0 ml-auto inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold border border-gray-200 dark:border-[#2A3446] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden />
            지도에서 보기
          </Link>
        </div>

        {/* 딜 그리드 — 홈과 같은 GroupBuyFeed(데이터/prefetch/페이지네이션 공유, 중복 fetch 0) */}
        <GroupBuyFeed
          pc
          category={category}
          onCategoryChange={setCategory}
          regionRef={ref}
        />
      </div>

      {/* 같은 시/도의 다른 지역 — 사용자 탐색 + 크롤러가 이웃 지역 페이지로 넘어가는 통로 */}
      {REGION_PAGES_ENABLED && (
        <RegionLinkGrid activeSido={ref.sido} title={`${ref.sido}의 다른 지역`} />
      )}
      <SiteFooter />
    </div>
  )
}
