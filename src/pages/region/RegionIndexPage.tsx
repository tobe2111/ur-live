import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import SEO, { breadcrumbJsonLd } from '@/components/SEO'
import SiteFooter from '@/components/main/SiteFooter'
import BrandLoader from '@/components/brand/BrandLoader'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { REGION_PAGES_ENABLED } from '@/shared/feature-flags'
import { regionPath, type SidoStat } from '@/shared/constants/region-slugs'

/**
 * 🗺️ 2026-08-03 (대표 — 도시별 색인): `/region` 지역 인덱스.
 *
 * 역할은 **허브**다. 크롤러가 sitemap 없이도 여기 한 장에서 모든 지역 페이지로 갈 수 있어야 하고,
 * 사용자에겐 "우리가 어디를 커버하는지"가 한눈에 보여야 한다.
 * 그래서 탭·캐러셀 없이 **전 시/도를 한 번에 펼친다**(여기어때 하단 '국내 여행지' 확장판).
 *
 * 딜이 없는 지역은 아예 안 나온다 — 커버리지를 부풀리면 사용자는 빈 페이지에서 튕기고,
 * 크롤러는 그걸 soft-404 로 읽는다.
 */
export default function RegionIndexPage() {
  const { data: regions = [], isLoading } = useApiQuery<SidoStat[]>(
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

  const total = regions.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="bg-white dark:bg-[#0F151D] min-h-[100dvh]">
      <SEO
        title="지역별 이용권·동네딜 — 우리 동네 할인 찾기 | 유어딜"
        description="서울·경기·부산부터 제주까지, 지역별 식당·카페·뷰티·숙박 이용권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요."
        url="/region"
        noindex={!REGION_PAGES_ENABLED}
        jsonLd={[breadcrumbJsonLd([{ name: '홈', url: '/' }, { name: '지역', url: '/region' }])]}
      />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-10 pt-4 lg:pt-6">
        <nav aria-label="위치" className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 mb-3">
          <Link to="/" className="hover:underline">홈</Link>
          <ChevronRight className="w-3 h-3" aria-hidden />
          <span className="font-bold text-gray-900 dark:text-white">지역</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-[22px] lg:text-[26px] font-black tracking-tight text-gray-900 dark:text-white">
            지역별 이용권·동네딜
          </h1>
          <p className="mt-1.5 text-[13px] lg:text-[14px] text-gray-500 dark:text-gray-400">
            {total > 0
              ? <>전국 <b className="text-gray-900 dark:text-white">{total}개</b> 딜 진행 중 · 우리 동네를 골라보세요</>
              : <>지역을 골라 우리 동네 딜을 확인해보세요</>}
          </p>
        </header>

        {isLoading ? (
          <div className="py-20"><BrandLoader label="지역 정보를 불러오는 중" /></div>
        ) : regions.length === 0 ? (
          <p className="py-20 text-center text-[14px] text-gray-500 dark:text-gray-400">
            아직 등록된 지역 딜이 없어요.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-7 pb-12">
            {regions.map(r => (
              <section key={r.sido} aria-labelledby={`sido-${r.sido}`}>
                <h2 id={`sido-${r.sido}`} className="mb-2.5 pb-2 border-b border-gray-100 dark:border-[#2A3446]">
                  <Link
                    to={regionPath({ sido: r.sido })}
                    className="inline-flex items-baseline gap-1.5 text-[15px] font-black text-gray-900 dark:text-white hover:underline"
                  >
                    {r.sido}
                    <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500">{r.count}</span>
                  </Link>
                </h2>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {r.sigungu.filter(s => s.indexable).map(s => (
                    <li key={s.sigungu}>
                      <Link
                        to={regionPath({ sido: r.sido, sigungu: s.sigungu })}
                        className="text-[13px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:underline"
                      >
                        {s.sigungu}
                        <span className="ml-1 text-gray-400 dark:text-gray-500">{s.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  )
}
