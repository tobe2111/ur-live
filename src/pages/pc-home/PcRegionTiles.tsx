import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { addressInRegion, regionPath, type SidoStat } from '@/shared/constants/region-slugs'
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
 *     → 없으면 그 지역 이용권 중 인기 첫 장(위 순위 줄과 같은 캐시) → 그것도 없으면 브랜드 면에 글자만.
 * 네 곳이 안 모이면(라이브 시/도가 적으면) 줄 자체를 그리지 않는다 — 두 칸짜리 줄은 빈자리처럼 보인다.
 */
const TILE_COUNT = 4

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

  const tiles = useMemo(() => {
    const top = regions.filter((r) => r.indexable && r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, TILE_COUNT)
    return top.map((r) => {
      const path = regionPath({ sido: r.sido })
      // 배너 링크는 절대 주소·퍼센트 인코딩으로 저장돼 있다(`https://urdeal.kr/region/%EC%84%9C%EC%9A%B8`) — 경로만 떼어 디코딩해 비교한다.
      const fromBanner = banners.find((b) => {
        try { return !!b.image_url && decodeURIComponent(new URL(b.link_url || '', 'https://urdeal.kr').pathname) === path } catch { return false }
      })?.image_url
      const photo = fromBanner || deals.find((p) => p.image_url && p.deal_only !== 1 && addressInRegion(p.restaurant_address, { sido: r.sido }))?.image_url
      const places = r.sigungu.filter((s) => s.indexable).slice(0, 3).map((s) => s.sigungu).join('·')
      return { ...r, photo, places }
    })
  }, [regions, deals, banners])

  if (tiles.length < TILE_COUNT) return null

  return (
    <section aria-labelledby="pc-region-tiles" className="ur-home-panel !mb-0">
      <h2 id="pc-region-tiles" className="mb-3 text-[24px] font-bold tracking-[-.02em] text-gray-900 dark:text-white">어디로 갈까요?</h2>
      <div className="grid grid-cols-4 gap-4">
        {tiles.map((t) => {
          const src = t.photo ? cfImage(t.photo, { width: 400, quality: 76 }) : ''
          return (
            <Link
              key={t.sido}
              to={regionPath({ sido: t.sido })}
              className="relative isolate overflow-hidden rounded-2xl aspect-[4/3] flex flex-col justify-end px-4 pb-4 transition-transform hover:scale-[1.01]"
              style={src ? undefined : { background: 'var(--brand-grad)' }}
            >
              {src && (
                <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async"
                  className="absolute inset-0 -z-10 w-full h-full object-cover"
                  onError={(e) => cfImageOnError(e.currentTarget, t.photo)} />
              )}
              {src && <div className="absolute inset-x-0 bottom-0 h-[70%] -z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent" aria-hidden="true" />}
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
