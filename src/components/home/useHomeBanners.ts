import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { parseBannerSlot, type BannerSlot } from '@/shared/constants/home-showcase'

/**
 * 🏠 2026-08-04: 홈 배너 조회 훅 — 자리(hero/inline/wide)별.
 *
 * 배너는 어드민이 등록하고 **자리까지 고른 것만** 뜬다 — 안 고르면 아무것도 안 그린다
 * (대표 확정 규칙. 2026-08-04 에 기본값 때문에 옛 배너가 저절로 뜬 사고의 수리).
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
  banner_slot: BannerSlot | null
  display_order: number
}

export function useHomeBanners(slot: BannerSlot) {
  const { data = [] } = useApiQuery<HomeBanner[]>(
    ['banners', slot],
    '/api/banners',
    {
      params: { type: slot },
      select: (raw) => {
        const r = raw as { success?: boolean; data?: HomeBanner[] }
        if (!r?.success || !Array.isArray(r.data)) return []
        // 🔴 자리를 고르지 않은 배너(null)는 어디에도 안 뜬다 — 기본 자리로 승격시키지 않는다.
        return r.data
          .map(b => ({ ...b, banner_slot: parseBannerSlot(b.banner_slot) }))
          .filter(b => b.banner_slot === slot)
      },
      staleTime: 5 * 60_000,
    },
  )
  return data
}
