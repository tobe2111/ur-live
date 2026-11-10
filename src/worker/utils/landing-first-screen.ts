/**
 * 🧭 대외 안내 랜딩 셋(`/about` · `/partners` · `/influencer`) 서버 첫 화면 (2026-11-10).
 *
 * 라이브 실측(폰 4G · CPU 4배): 첫 그림 = 큰 사진 **3.2~4.7s**(PC 3.4s)인데 그 사진은 응답 헤더 preload 로 **0.8s 에 이미 와 있었다** —
 * 그리는 쪽(앱)이 랜딩 청크 + React 가 다 와야 사진을 꽂았다. 머리줄(잉크 바 · 로고 · 글자 링크 · 파란 버튼)과 사진 칸은 고정 모양이라
 * 서버가 먼저 그린다. 제목·문장·버튼은 **그리지 않는다** — 마스크 안에서 올라오는 모션(`Line` · `ur-load`)이 대표 승인 시안이라
 * 서버가 먼저 보이면 깜빡인다(premium.css: "아무것도 숨긴 채 기다리지 않는다"는 그 모션의 규칙이고, 사진 칸 높이는 예약한다).
 *
 * 같은 모양의 근거: `shared/landing-photo.ts`(클래스 · 문구 · 사진 위치 · 사진 칸 CSS) — 세 페이지 소스와 시험이 글자 대조.
 * 세 경로는 전체화면(자기 머리줄 · 전역 네비 없음 · PC 풀폭)이라 폰·PC 가 같은 본문이다.
 */
import { LANDING_FS, LANDING_HEAD, LANDING_HERO_CSS, LANDING_LOGO_SIZE, LANDING_PHOTOS, landingPhotoKeyOf } from '../../shared/landing-photo'
import { logoHtml } from './logo-html'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

export function buildLandingFirstScreen(pathname: string, loaderHtml: string): string {
  const key = landingPhotoKeyOf(pathname)
  if (!key) return ''
  const head = LANDING_HEAD[key], photo = LANDING_PHOTOS[key]
  const links = head.links.map((t) => `<span class="${LANDING_FS.navLink}">${esc(t)}</span>`).join('')
  const cta = head.cta ? `<span class="${LANDING_FS.cta}">${esc(head.cta)} <span class="${LANDING_FS.ctaIcon} inline-block" aria-hidden="true"></span></span>` : ''
  const header = `<header class="${LANDING_FS.header}"><div class="${LANDING_FS.headerRow}">` +
    `<span class="${LANDING_FS.brand}">${logoHtml(LANDING_LOGO_SIZE, 'dark')}<span class="${LANDING_FS.brandLabel}">${esc(head.label)}</span></span>` +
    `<div class="${LANDING_FS.actions}">${links}${cta}</div></div></header>`
  const hero = `<style>${LANDING_HERO_CSS}</style><section data-photo-hero="${key}" class="${LANDING_FS.hero}">` +
    `<img src="${escAttr(photo.src)}" alt="${escAttr(photo.alt)}" width="1080" height="1080" decoding="async" fetchpriority="high" class="${LANDING_FS.heroImg}" style="object-position:${escAttr(photo.position)}">` +
    `<div class="${LANDING_FS.heroInner}"></div></section>`
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다. 로더는 사진 칸 아래(첫 화면 밖).
  return `<div id="ur-first-screen"><div class="${LANDING_FS.root}">${header}<main class="${LANDING_FS.main}">${hero}</main></div></div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
