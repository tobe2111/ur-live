import { addressInRegion, regionPath, type SidoStat } from '@/shared/constants/region-slugs'
import { regionHeroForSido } from '@/shared/home-region-hero'

/** PC 홈 「어디로 갈까요?」 타일 고르기 — 순수 함수(시험이 실제로 돌린다). */
export const TILE_COUNT = 4

type Banner = { image_url?: string | null; link_url?: string | null }
type Deal = { image_url?: string | null; deal_only?: number | null; restaurant_address?: string | null }
/** `hero` = 홈 머리와 같은 지역 사진(우리 정적 파일 — 리사이저를 거치지 않는다). */
export type RegionTile = SidoStat & { photo: string; places: string; hero?: boolean }

/**
 * 이용권 많은 순으로 훑어 **사진이 있는 곳만** 네 곳을 고른다(2026-10-14 대표 *"사진 없는건 빼주면 돼"*).
 *   사진 = **홈 머리와 같은 지역 사진**(2026-11-02 대표 *"이 부분들도 같이 적용되는걸로"* · *"그렇게 진행해줘"*)
 *     → 없으면 그 지역으로 가는 어드민 배너 사진 → 없으면 그 지역 이용권 중 인기 첫 장.
 *   🩸 종전 1순위는 배너·이용권 사진이라 '경기' 칸에 헬스장 광고 사진("프리미엄 머신 구비")이 떴다.
 *   사진이 없는 지역은 건너뛰고 다음 지역으로 채운다 — 종전엔 파란 면에 글자만 그려 한 칸만 비어 보였다.
 * 네 곳이 안 모이면 빈 배열(호출부가 줄 자체를 안 그린다).
 */
export function pickRegionTiles(regions: SidoStat[], deals: Deal[], banners: Banner[]): RegionTile[] {
  const out: RegionTile[] = []
  const ranked = regions.filter((r) => r.indexable && r.count > 0).sort((a, b) => b.count - a.count)
  for (const r of ranked) {
    // 배너 링크는 절대 주소·퍼센트 인코딩으로 저장돼 있다 — 경로만 떼어 **양쪽 다** 디코딩해 비교한다.
    // 🩸 종전엔 배너 쪽만 디코딩하고 `regionPath`(인코딩된 값)와 비교해 **한 번도 안 맞았다** — 대표가
    //    지역마다 올린 배너 사진이 타일에 안 쓰이고 늘 이용권 사진으로 떨어졌다(시험이 잡았다).
    const path = decodeURIComponent(regionPath({ sido: r.sido }))
    const fromBanner = banners.find((b) => {
      try { return !!b.image_url && decodeURIComponent(new URL(b.link_url || '', 'https://urdeal.kr').pathname) === path } catch { return false }
    })?.image_url
    const hero = regionHeroForSido(r.sido)?.src
    const photo = hero || fromBanner || deals.find((p) => p.image_url && p.deal_only !== 1 && addressInRegion(p.restaurant_address, { sido: r.sido }))?.image_url
    if (!photo) continue
    const places = r.sigungu.filter((s) => s.indexable).slice(0, 3).map((s) => s.sigungu).join('·')
    out.push({ ...r, photo, places, ...(hero ? { hero: true } : {}) })
    if (out.length === TILE_COUNT) break
  }
  return out.length === TILE_COUNT ? out : []
}
