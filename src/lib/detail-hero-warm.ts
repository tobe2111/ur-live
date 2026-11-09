/**
 * 👆 2026-11-08 대표 *"눌렀을 때 반응하는 속도"* — 손가락이 이용권 카드에 **닿는 순간** 상세 맨 위 큰 사진을 받기 시작한다.
 *
 * 실측(폰 흉내 · CPU 4배 · 느린 4G): 카드를 누르면 상세 글자는 0.34초에 서지만 큰 사진(960px)은 **그때서야** 출발했고,
 * 같은 순간 아래쪽(지도 그림 9장 · 리뷰 · 추천 목록 등 15건)이 함께 출발해 회선을 나눴다.
 * 닿고 → 떼고 → 화면이 바뀌기까지 ~0.3초를 그 사진이 먼저 쓴다.
 *
 * 주소는 화면(`DetailGallery`)과 **같은 함수**(`detailGalleryImages` → `detailHeroMobileUrl`)라 같은 요청이 재사용된다.
 * 폰 배치에서만(PC 는 다른 주소를 쓴다 — `DETAIL_DESKTOP_QUERY`). 카드당 한 번.
 */
import { detailGalleryImages, detailHeroMobileUrl, DETAIL_DESKTOP_QUERY } from '@/shared/detail-hero-image'

const warmed = new Set<string>()

export function warmDetailHero(p: { image_url?: string | null; images?: string | null; image_urls?: string | null; detail_images?: string | null }): void {
  try {
    if (typeof window === 'undefined' || window.matchMedia?.(DETAIL_DESKTOP_QUERY).matches) return
    const first = detailGalleryImages(p)[0]
    if (!first) return
    const url = detailHeroMobileUrl(first)
    if (!url || warmed.has(url)) return
    warmed.add(url)
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  } catch { /* 가속일 뿐 — 실패해도 화면이 평소대로 받는다 */ }
}
