import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { regionPath, type SidoStat } from '@/shared/constants/region-slugs'

/**
 * 🗺️ 2026-08-03 (대표 — 여기어때 하단 "국내 여행지 / 인기 검색 키워드" 차용): 지역 텍스트 링크 그리드.
 *
 * 왜 이미지 캐러셀이 아니라 텍스트인가:
 *   이 블록의 목적은 장식이 아니라 **크롤러가 지역 페이지를 발견하는 통로**다. sitemap 만으로는
 *   색인이 잘 안 붙는다 — 내부 링크로 실제로 연결돼 있어야 크롤 예산이 그쪽으로 흐른다.
 *   텍스트라 LCP 영향이 0 이고(이미지 요청 0), 지역 이름 자체가 앵커 텍스트가 되어 관련성 신호가 된다.
 *
 * 🚫 딜이 없는 지역은 링크하지 않는다. 빈 페이지로 보내면 사용자는 튕기고 크롤러는 soft-404 로 읽는다.
 *   (지역 페이지 자체는 열리지만 `noindex` — 판정 기준은 `REGION_INDEX_MIN_DEALS` 하나로 통일.)
 *
 * 데이터가 없거나 실패하면 **아무것도 렌더하지 않는다**(null) — 빈 제목만 남는 유령 섹션 방지.
 */
export default function RegionLinkGrid({
  activeSido,
  title = '지역별 동네딜',
  className = '',
}: {
  /** 지역 페이지에서 그 시/도를 기본 선택 상태로 연다. 없으면 딜이 가장 많은 시/도. */
  activeSido?: string
  title?: string
  className?: string
}) {
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

  // 딜이 있는 시/도만 탭에 노출(집계 API 가 이미 0건 시/도를 빼지만, 방어적으로 한 번 더).
  const available = useMemo(() => regions.filter(r => r.count > 0), [regions])
  const [selected, setSelected] = useState<string | null>(null)
  const activeKey = selected ?? activeSido ?? available[0]?.sido ?? null
  const active = available.find(r => r.sido === activeKey) ?? available[0]

  // 로딩 중엔 자리를 잡지 않는다 — 늦게 삽입돼 아래 콘텐츠를 밀면 CLS 가 된다.
  // 이 블록은 페이지 최하단이라 밀 콘텐츠가 없고, 없으면 없는 대로 자연스럽다.
  if (isLoading || available.length === 0 || !active) return null

  const linkable = active.sigungu.filter(s => s.indexable)

  // 🚫 링크할 지역이 어디에도 없으면 섹션 자체를 감춘다 — 대표가 배너에 정한 원칙과 같다
  //   ("올리지 않으면 아예 보이지 않도록"). 안 그러면 홈 하단에 제목만 있고 "아직 딜이 모이지
  //   않았어요" 만 뜨는, 빈손을 광고하는 블록이 남는다(2026-08-03 배포 직후 실제 그 상태였다).
  if (!available.some(r => r.sigungu.some(s => s.indexable))) return null

  return (
    <section className={`border-t border-gray-100 dark:border-[#2A3446] ${className}`} aria-labelledby="region-grid-heading">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-8">
        <h2 id="region-grid-heading" className="text-[15px] font-black text-gray-900 dark:text-white mb-4">
          {title}
        </h2>

        {/* 시/도 탭 — 가로 스크롤(모바일에서 17개가 줄바꿈으로 쌓이지 않게) */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide">
          {available.map(r => {
            const on = r.sido === active.sido
            return (
              <button
                key={r.sido}
                onClick={() => setSelected(r.sido)}
                aria-pressed={on}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[13px] font-bold border transition-colors ${
                  on
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2A3446] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {r.sido}
              </button>
            )
          })}
        </div>

        {/* 시군구 링크 — 모바일 3열 → PC 6열. 여기어때 하단 그리드와 같은 밀도. */}
        <ul className="mt-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2.5">
          <li>
            <Link
              to={regionPath({ sido: active.sido })}
              className="text-[13px] font-bold text-gray-900 dark:text-white hover:underline"
            >
              {active.sido} 전체
              <span className="ml-1 font-medium text-gray-400 dark:text-gray-500">{active.count}</span>
            </Link>
          </li>
          {linkable.map(s => (
            <li key={s.sigungu}>
              <Link
                to={regionPath({ sido: active.sido, sigungu: s.sigungu })}
                className="text-[13px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:underline"
              >
                {s.sigungu}
                <span className="ml-1 text-gray-400 dark:text-gray-500">{s.count}</span>
              </Link>
            </li>
          ))}
        </ul>

        {linkable.length === 0 && (
          <p className="mt-2 text-[12px] text-gray-400 dark:text-gray-500">
            {active.sido}는 아직 지역별로 나눌 만큼 딜이 모이지 않았어요.
          </p>
        )}
      </div>
    </section>
  )
}
