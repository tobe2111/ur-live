import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { normalizeBannerType, type BannerType } from '@/shared/constants/home-showcase'

/**
 * 🏠 2026-08-04: 홈 배너 조회 훅 — 자리(hero/inline/wide)별.
 *
 * 배너는 어드민이 등록하는 것이고, **안 올리면 아무것도 안 그린다**(대표 확정 규칙).
 * 그래서 이 훅은 빈 배열을 정상 상태로 다룬다 — 에러도 빈 배열로 흡수한다.
 * 홈 최상단이 배너 API 하나 때문에 깨지면 안 된다.
 */
export interface HomeBanner {
  id: number
  title: string
  image_url: string
  video_url?: string | null
  link_url?: string | null
  description?: string | null
  banner_type: BannerType
  display_order: number
}

export function useHomeBanners(type: BannerType) {
  const { data = [] } = useApiQuery<HomeBanner[]>(
    ['banners', type],
    '/api/banners',
    {
      params: { type },
      select: (raw) => {
        const r = raw as { success?: boolean; data?: HomeBanner[] }
        if (!r?.success || !Array.isArray(r.data)) return []
        return r.data
          .map(b => ({ ...b, banner_type: normalizeBannerType(b.banner_type) }))
          .filter(b => b.banner_type === type)
      },
      staleTime: 5 * 60_000,
    },
  )
  return data
}
