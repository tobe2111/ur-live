/**
 * 🖥️ PC 홈(`/`)의 **서버가 그리는 첫 화면** (2026-11-09 대표 "1~4번 모두 진행" 의 ③).
 *
 * ## 왜
 * 라이브 실측(1440px · 데스크톱 UA): first-paint 1.5초 · 첫 글자 **2.25초**. 폰 홈은 2026-10-08 부터 서버가 첫 화면을
 * 그리는데 PC 홈은 `#root` 가 로더뿐이라 앱이 켜질 때까지 색면도 배너도 없었다. 그런데 배너 전체 시드
 * (`__SSR_INITIAL_HOMEBANNERS__`, 2026-11-09 #2243)가 **이미 같은 HTML 에 와 있다** — 그릴 재료가 있는데 안 그리고 있었다.
 *
 * ## 무엇을 그리나 — 어긋날 수 없는 것만
 *   1. 상단 네비 **높이만**(`PC_HOME_FS.topnav*`) — 글리프·검색창은 안 그린다(두 벌이 갈리는 클래스). `warmDesktopChrome` 이
 *      네비 코드를 첫 렌더 전에 받아 두므로 마운트 때 그 자리에 바로 선다(높이 68+1+44).
 *   2. 색면 + 큰 배너 1 · 작은 배너 2 — `PcHeroBanners` 와 **같은 상수**(shared/pc-home-first-screen)로 같은 사진 주소.
 *      큰 자리엔 보이는 한 장만 그린다(React 는 모든 장을 겹쳐 두지만 상자 크기는 같다).
 *   그 아래는 로더(아직 오는 중이라는 정직한 신호). 섹션 줄·지역 4칸·목록은 안 그린다.
 *
 * ## 못 보는 것
 *   - 프로모 바(`/api/promo-bar`, 어드민이 켜면 네비 위에 띠) — 지금 라이브는 꺼져 있다. 켜지면 그 높이만큼 한 번 민다.
 *   - 가로 768 미만의 데스크톱 UA — `hidden md:block` 이라 아무것도 안 그린다(로더만). `HomeRoute` 의 분기와 같은 경계.
 */
import { cfImage } from '../../utils/cf-image'
import { resolveBannerLink } from '../../components/home/banner-link'
import { PC_HOME_FS as F, PC_HERO_IMG, pcHeroBannersFromPayload, type PcHeroBanner } from '../../shared/pc-home-first-screen'
import { escAttr, escText } from './home-first-screen'

function slideHtml(b: PcHeroBanner, big: boolean): string {
  const src = b.image_url ? cfImage(b.image_url, big ? PC_HERO_IMG.big : PC_HERO_IMG.small) : ''
  const link = resolveBannerLink(b.link_url, 'urdeal.kr')
  const open = link?.kind === 'internal' ? `<a href="${escAttr(link.to)}" class="${F.slide}"${src ? '' : ' style="background:var(--brand-grad)"'}>`
    : link?.kind === 'external' ? `<a href="${escAttr(link.href)}" target="_blank" rel="noopener noreferrer" class="${F.slide}"${src ? '' : ' style="background:var(--brand-grad)"'}>`
    : `<div class="${F.slide}"${src ? '' : ' style="background:var(--brand-grad)"'}>`
  const close = link ? '</a>' : '</div>'
  const img = src ? `<img src="${escAttr(src)}" alt="" aria-hidden="true" loading="${big ? 'eager' : 'lazy'}" fetchpriority="${big ? 'high' : 'auto'}" decoding="async" class="${F.img}">` +
    `<div class="${F.grad}" aria-hidden="true"></div>` : ''
  const title = `<strong class="${F.titleBase} ${big ? F.titleBig : F.titleSmall}">${escText(b.title)}</strong>`
  const desc = b.description ? `<span class="${F.descBase} ${big ? F.descBig : F.descSmall}">${escText(b.description)}</span>` : ''
  return open + img + title + desc + close
}

/** 큰 자리 사진(LCP 후보) — 응답 헤더 preload 용. 없으면 ''. */
export function pcHomeLcpImage(bannersPayload: string | null | undefined): string {
  const b = pcHeroBannersFromPayload(bannersPayload)[0]
  const u = b?.image_url ? cfImage(b.image_url, PC_HERO_IMG.big) : ''
  return u && u.startsWith('/') && !u.startsWith('//') ? u : ''
}

/**
 * `#root` 에 넣을 첫 화면 HTML. strip 배너가 하나도 없으면 ''(호출부가 로더로 폴백 — 무회귀).
 * 노드 id `ur-first-screen` 은 폰 홈·상세와 같다(`lib/boot-first-screen.ts` 가 경로를 안 가리고 이 노드를 들고 간다).
 */
export function buildPcHomeFirstScreen(bannersPayload: string | null | undefined, loaderHtml: string): string {
  const banners = pcHeroBannersFromPayload(bannersPayload)
  if (banners.length === 0) return ''
  const n = banners.length
  const side = n >= 3 ? [1, 2] : n === 2 ? [1] : []
  const section = `<section aria-roledescription="carousel" aria-label="기획전 배너" class="${F.sectionBase} ${side.length ? F.sectionCols2 : F.sectionCols1}">` +
    `<div class="${F.bigWrap}"><div class="absolute inset-0">${slideHtml(banners[0], true)}</div></div>` +
    (side.length ? `<div class="${F.sideGrid} ${side.length === 2 ? F.sideRows2 : F.sideRows1}">` +
      side.map((k) => `<div class="${F.sideCell}">${slideHtml(banners[k % n], false)}</div>`).join('') + '</div>' : '') +
    '</section>'
  const body = `<div class="hidden md:block">` +
    `<div class="${F.topnav}"><div class="${F.topnavRow1}"></div><div class="${F.topnavRow2}"></div></div>` +
    `<div class="${F.field}"><div class="${F.container}">${section}${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}</div></div>` +
    '</div>'
  return `<div id="ur-first-screen">${body}</div>`
}
