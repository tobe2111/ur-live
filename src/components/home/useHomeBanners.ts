import { useMemo } from 'react'
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

/**
 * ⚡ 2026-10-01 — **한 번만 받는다** (대표 *"로딩 … 다른 페이지들도 그런 경우가 많아"*)
 *
 * ## 무엇이 틀렸나 (하네스 폭포 실측)
 * 홈 한 화면에서 `/api/banners` 가 **세 번** 나갔다 — 자리(hero·inline·wide)마다 따로 불렀다:
 *
 * ```
 * +288ms  /api/banners      +288ms  /api/banners      +293ms  /api/banners
 * ```
 *
 * 🔴 **그리고 그 셋은 예열을 한 번도 못 받고 있었다.** cron 이 데우는 키는 `/api/banners`
 * (파라미터 없음, `cache-prewarm.ts`)인데 화면은 `?type=hero|inline|wide` 를 부른다. 엣지 캐시
 * 키는 **path+query** 라 셋 다 **다른 키**다. 같은 파일의 주석이 이미 그 규칙을 적어 뒀는데
 * (*"SSR inject key 와 정확히 일치(path+query)"*) 배너만 어긋나 있었다. 에러가 없어서
 * 예열은 계속 초록불이었고, 홈만 매번 콜드로 세 번 물었다.
 *
 * ## 처방
 * 활성 배너를 **한 번** 받아(쿼리 키 하나) 자리별로 **화면에서** 가른다.
 * 거르는 규칙은 종전과 **같은 코드**다 — 자리를 안 고른 배너(NULL)는 여전히 어디에도 안 뜬다.
 *
 * ⚠️ 쿼리 키를 자리별로 되돌리지 말 것(`['banners', slot]`). 그러면 요청이 다시 셋이 되고
 *   예열도 다시 빗나간다. 그리고 `useApiQuery` 는 `select` 를 **queryFn 안에서** 적용하므로
 *   같은 키에 다른 `select` 를 주면 캐시가 서로 덮어쓴다 — 키 하나 + 전체 목록이라야 안전하다.
 */
function useAllHomeBanners(): HomeBanner[] {
  const { data = [] } = useApiQuery<HomeBanner[]>(
    ['banners', 'all'],
    '/api/banners',
    {
      select: (raw) => {
        const r = raw as { success?: boolean; data?: HomeBanner[] }
        if (!r?.success || !Array.isArray(r.data)) return []
        return r.data.map(b => ({ ...b, banner_slot: parseBannerSlot(b.banner_slot) }))
      },
      staleTime: 5 * 60_000,
    },
  )
  return data
}

export function useHomeBanners(slot: BannerSlot) {
  const all = useAllHomeBanners()
  // 🔴 자리를 고르지 않은 배너(null)는 어디에도 안 뜬다 — 기본 자리로 승격시키지 않는다.
  return useMemo(() => all.filter(b => b.banner_slot === slot), [all, slot])
}
