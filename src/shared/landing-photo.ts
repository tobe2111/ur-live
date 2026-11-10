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

/**
 * 📸 세 랜딩의 첫 사진 — 위치·대체문구 SSOT (2026-11-10 — `pages/landing/premium.tsx` `PhotoHero` 와 워커 첫 화면이 같이 읽는다).
 */
export const LANDING_PHOTOS = {
  partners: { src: LANDING_HERO_SRC, position: '50% 50%', alt: '유어딜 입점 매장의 돈가스 한 상' },
  influencer: { src: LANDING_HERO_SRC, position: '20% 30%', alt: '동네 맛집 메뉴 사진' },
  about: { src: LANDING_HERO_SRC, position: '75% 60%', alt: '유어딜에서 파는 동네 가게 메뉴' },
} as const
export type LandingPhotoKey = keyof typeof LANDING_PHOTOS

/** 경로 → 사진 키(`PhotoHero photo=…`). 세 랜딩 밖이면 null. */
export function landingPhotoKeyOf(pathname: string): LandingPhotoKey | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/about' ? 'about' : p === '/partners' ? 'partners' : p === '/influencer' ? 'influencer' : null
}

/**
 * 🧭 세 랜딩의 **머리줄·첫 사진 클래스 SSOT** (2026-11-10 — 라이브 폰 첫 그림 = 큰 사진 3.2~4.7s · 사진은 0.8s 에 이미 와 있었다).
 *   세 페이지(`AboutServicePage`·`PartnersPage`·`CreatorsPage`)와 `PartnerHero`·`PhotoHero` 가 글자로 같은 클래스를 갖는다
 *   (시험이 원본 소스와 글자 대조 — 페이지는 잠금표 밖이지만 모션 부품과 얽혀 있어 상수로 바꾸지 않고 **대조**한다).
 *   서버는 [머리줄(로고 · 라벨 · 링크 글자 · 파란 버튼) + 사진 칸(사진 + 높이 예약)] 만 그린다 — 제목·문장·버튼은 마운트 때
 *   마스크 안에서 올라오는 모션(`Line`·`ur-load`)이라 서버가 먼저 보이면 깜빡인다(premium.css 머리말 "글자는 늘 보인다" 는 그 모션의 규칙).
 */
export const LANDING_FS = {
  root: 'min-h-[100dvh] bg-warm ur-landing-type overflow-x-clip',
  header: 'sticky top-0 z-20 ur-panel-ink',
  headerRow: 'ur-content-wide mx-auto px-5 lg:px-10 h-14 lg:h-16 flex items-center justify-between',
  brand: 'flex items-center gap-2',
  brandLabel: 'hidden sm:inline text-[12px] font-medium text-white/55',
  actions: 'flex items-center gap-2 lg:gap-3',
  navLink: 'hidden sm:inline text-[12px] font-medium text-white/70 px-2',
  cta: 'h-9 lg:h-10 px-4 lg:px-5 rounded-full bg-brand text-white inline-flex items-center gap-2 text-[12px] lg:text-[13px] font-medium',
  ctaIcon: 'w-3.5 h-3.5',
  main: 'pb-24 lg:pb-0',
  hero: 'ur-photo-hero ur-panel-ink text-white',
  heroImg: 'ur-photo-hero-img',
  heroInner: 'ur-content-wide mx-auto px-5 lg:px-10 min-h-[calc(100svh-56px)] lg:min-h-[calc(100svh-64px)] flex flex-col justify-end pt-40 pb-28',
} as const
export const LANDING_LOGO_SIZE = 19

/** 머리줄 문구 — 페이지별 라벨·링크·버튼(각 페이지 소스와 같은 글자). */
export const LANDING_HEAD: Record<LandingPhotoKey, { label: string; links: string[]; cta: string }> = {
  about: { label: '서비스 소개', links: ['입점 안내', '소개하기'], cta: '딜 보러가기' },
  partners: { label: '입점 안내', links: ['서비스 소개'], cta: '' },
  influencer: { label: '소개하기', links: ['서비스 소개'], cta: '소개 파트너 지원' },
}

/**
 * 첫 사진 칸의 CSS — `pages/landing/premium.css` ① 의 세 규칙을 **정지 상태**로 옮겨 적은 것(켄번스 애니메이션은 앱이 붙인다 —
 *   시작값 scale(1.08) 이 같아 이어진다). 그 파일은 랜딩 청크의 CSS 라 첫 화면 CSS 생성기(index.css 대상)에 안 들어온다.
 */
export const LANDING_HERO_CSS =
  '.ur-photo-hero{position:relative;isolation:isolate;overflow:hidden}' +
  '.ur-photo-hero>.ur-photo-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;transform:scale(1.08)}' +
  '.ur-photo-hero::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgb(17 20 28 / 0.30) 0%,rgb(17 20 28 / 0.55) 45%,rgb(17 20 28 / 0.94) 100%)}' +
  '@media (min-width:1024px){.ur-photo-hero::after{background:linear-gradient(90deg,rgb(17 20 28 / 0.92) 0%,rgb(17 20 28 / 0.72) 45%,rgb(17 20 28 / 0.25) 100%)}}'
