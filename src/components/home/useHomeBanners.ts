import { useMemo, useState } from 'react'
import { readHomeSectionsSeedRaw } from '@/shared/home-section-ids'
import { stripBannersOf } from '@/shared/home-strip-banners'
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
function useAllHomeBanners(): { all: HomeBanner[]; settled: boolean } {
  /**
   * 🎫 2026-10-14 — 응답이 오기 전에는 **서버 첫 화면과 같은 상단 배너**를 보여 준다(섹션 시드의
   *   `strip_banners`). 비워 두면 서버가 그린 배너가 마운트 때 사라졌다가 응답 뒤 다시 나타나며
   *   첫 섹션을 위아래로 흔든다. `placeholderData` 라 캐시에 안 들어가고, 응답이 오면 그 값으로 바뀐다.
   *   시드엔 strip 만 있다 — inline/wide 는 화면 밖이라 응답을 기다려도 아무것도 안 민다.
   */
  const [seeded] = useState<HomeBanner[] | undefined>(() => {
    // 🖼️ 2026-11-01 교환권(`__SSR_INITIAL_BANNERS__`) 보조 시드는 **걷혔다** — 대표 확정 A안으로 그 화면
    //   머리에 배너가 없어져 워커가 그 시드를 아예 안 싣는다(주입처 0). 그래서 읽는 코드도 함께 지웠다
    //   (남겨 두면 다음 세션이 "시드가 온다"고 읽는다). 되살리려면 워커 `ssrExtra = { slot: 'BANNERS' }` 가
    //   먼저 돌아와야 한다 — 사유: src/tests/unit/vouchers-hero-banner-ssr-2026-10-18.test.tsx
    const raw = readHomeSectionsSeedRaw()
    const strip = stripBannersOf(raw)
    return strip.length ? (strip as unknown as HomeBanner[]) : undefined
  })
  const { data = [], isFetched } = useApiQuery<HomeBanner[]>(
    ['banners', 'all'],
    '/api/banners',
    {
      select: (raw) => {
        const r = raw as { success?: boolean; data?: HomeBanner[] }
        if (!r?.success || !Array.isArray(r.data)) return []
        return r.data.map(b => ({ ...b, banner_slot: parseBannerSlot(b.banner_slot) }))
      },
      staleTime: 5 * 60_000,
      placeholderData: seeded,
    },
  )
  // `isFetched` — 성공이든 실패든 **응답이 한 번 왔다**. 실패는 select 없이 [] 라 '없음'과 같게 다룬다.
  return { all: data, settled: isFetched }
}

export function useHomeBanners(slot: BannerSlot) {
  return useHomeBannersState(slot).banners
}

/**
 * 🎟️ 2026-10-14 교환권 머리(대표 확정 안 C) — 자리를 **응답 전부터** 잡아야 해서 '아직 모름'이 필요하다.
 *   `settled=false` 동안 화면은 배너 높이를 비워 두고, 응답이 왔는데 0장이면 그때 접는다(드문 경우).
 */
export function useHomeBannersState(slot: BannerSlot): { banners: HomeBanner[]; settled: boolean } {
  const { all, settled } = useAllHomeBanners()
  // 🔴 자리를 고르지 않은 배너(null)는 어디에도 안 뜬다 — 기본 자리로 승격시키지 않는다.
  const banners = useMemo(() => all.filter(b => b.banner_slot === slot), [all, slot])
  return { banners, settled }
}
