import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { regionPath, type SidoStat } from '@/shared/constants/region-slugs'
import { pickRegionTiles, TILE_COUNT } from './region-tiles'
import { formatNumber } from '@/utils/format'
import { usePopularDeals } from './usePopularDeals'
import { useHomeBanners } from '@/components/home/useHomeBanners'

/**
 * 🧭 PC 홈 · 어디로 갈까요? (2026-10-14 대표 확정 "시안 4" — 시안 3 에서 가져온 줄)
 *
 * 이용권이 가장 많은 시/도 네 곳을 사진 타일로 → `/region/*`. 숫자는 지어내지 않는다:
 *   - 고르는 기준·개수 = 지역 집계 API(`/api/regions` — 하단 지역 링크와 **같은 응답·같은 키**라 요청 0번 추가).
 *   - 색인 게이트(`indexable`)를 통과한 곳만 — 빈 지역으로 보내면 사용자는 튕기고 크롤러는 soft-404 로 읽는다.
 *   - 사진 = 그 지역으로 가는 **어드민 배너**의 사진(위 큰 배너와 같은 목록 — 대표가 지역마다 골라 올린 사진)
 *     → 없으면 그 지역 이용권 중 인기 첫 장. **사진이 없는 지역은 빼고 다음 지역으로 채운다**(2026-10-14 대표).
 * 네 곳이 안 모이면(라이브 시/도가 적으면) 줄 자체를 그리지 않는다 — 두 칸짜리 줄은 빈자리처럼 보인다.
 */

export default function PcRegionTiles() {
  const { data: regions = [] } = useApiQuery<SidoStat[]>(['regions', 'stats'], '/api/regions', {
    select: (raw) => {
      const r = raw as { success?: boolean; data?: SidoStat[] }
      return r?.success && Array.isArray(r.data) ? r.data : []
    },
    staleTime: 10 * 60_000,
  })
  const { data: deals = [] } = usePopularDeals()
  const banners = useHomeBanners('strip')

  const tiles = useMemo(() => pickRegionTiles(regions, deals, banners), [regions, deals, banners])

  if (tiles.length < TILE_COUNT) return null

  return (
    <section aria-labelledby="pc-region-tiles" className="ur-home-panel !mb-0">
      <h2 id="pc-region-tiles" className="mb-3 text-[24px] font-bold tracking-[-.02em] text-gray-900 dark:text-white">어디로 갈까요?</h2>
      <div className="grid grid-cols-4 gap-4">
        {tiles.map((t) => {
          // 🗺️ 머리와 같은 지역 사진은 우리 정적 파일(1080×360, 장당 30~70KB)이라 리사이저를 거치지 않는다 —
          //   400px 로 줄이면 높이가 133px 이 되어 4:3 칸을 채우려 다시 늘리며 흐려진다.
          const src = t.hero ? t.photo : cfImage(t.photo, { width: 400, quality: 76 })
          return (
            <Link
              key={t.sido}
              to={regionPath({ sido: t.sido })}
              className="relative isolate overflow-hidden rounded-2xl aspect-[4/3] flex flex-col justify-end px-4 pb-4 transition-transform hover:scale-[1.01]"
            >
              <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async"
                className="absolute inset-0 -z-10 w-full h-full object-cover"
                onError={(e) => cfImageOnError(e.currentTarget, t.photo)} />
              <div className="absolute inset-x-0 bottom-0 h-[70%] -z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent" aria-hidden="true" />
              <strong className="text-[24px] font-bold leading-none text-white dark:text-white [text-shadow:0_1px_8px_rgba(0,0,0,.3)]">{t.sido}</strong>
              <span className="mt-2 text-[12px] text-white/90 dark:text-white/90 line-clamp-1">
                {t.places ? `${t.places} · ` : ''}이용권 {formatNumber(t.count)}개
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
