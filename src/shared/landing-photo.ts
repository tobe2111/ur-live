/**
 * 📸 대외 안내 페이지(/about · /partners · /influencer) 맨 위 사진 — 화면(`pages/landing/premium.tsx` `PhotoHero`)과
 * 워커(응답 헤더 preload)가 **같은 주소**를 쓴다(2026-11-09 — 갈리면 같은 사진을 두 번 받는다).
 * 실측(폰 흉내): 이 사진(222KB)이 가장 큰 그림인데 앱 코드가 다 돈 뒤(1.7s)에야 출발해 LCP 3.1s.
 */
export const LANDING_HERO_SRC = '/static/partners/deal-photo.jpg'

/** 그 사진을 맨 위에 그리는 경로. */
export function landingHeroFor(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/about' || p === '/partners' || p === '/influencer' ? LANDING_HERO_SRC : ''
}
