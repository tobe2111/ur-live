/**
 * 🚪 로그인 전 탭 화면(이용권 `/my-vouchers` · 유어샵 `/u/me` · 마이 `/user/profile`) 서버 첫 화면 (2026-10-19).
 *
 * 라이브 실측(아이폰13 · 느린 4G · CPU 4배): 세 탭 모두 첫 그림이 2.0~2.5초였다 — 화면 대부분이 고정 문구(제목·혜택·
 * 카카오 버튼)인데 앱 코드가 다 와야 그려졌다. 새로 온 사람이 하단 탭을 누르면 가장 먼저 보는 화면이다.
 *
 * 이 첫 화면은 **React 와 같은 모양**(같은 클래스·문구 상수 — `shared/guest-page.ts`)으로 위쪽(제목 + 첫 카드)만 그리고,
 * 그 아래는 종전 로더를 둔다(인기 이용권·최근 본 이용권처럼 데이터·기기 저장값이 필요한 것은 그리지 않는다).
 *
 * ## 로그인한 사람
 * 서버는 세션 쿠키가 있으면 아예 그리지 않는다(호출부). 쿠키가 없는데 기기에 로그인 흔적이 있으면(`isUserLoggedIn` 과
 * 같은 두 키) 바로 뒤 인라인 스크립트가 노드를 걷어낸다 — 그 사람에게 게스트 화면을 보여 주지 않는다.
 *
 * ## 그리지 않는 것
 * 아이콘·마스코트 그림 — 같은 크기의 빈 칸만(두 벌 금지). 카카오 말풍선은 같은 path 상수라 그대로 그린다.
 */
import { GUEST_CLS, GUEST_COPY, GUEST_MY_MASCOT, KAKAO_BUBBLE_PATH } from '../../shared/guest-page'

export type GuestTab = 'pass' | 'shop' | 'my'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')
const slot = (w: number, h = w) => `<span class="block shrink-0" style="width:${w}px;height:${h}px" aria-hidden="true"></span>`

/** 경로 → 탭. 셋 밖이면 null. */
export function guestTabOf(pathname: string): GuestTab | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/my-vouchers' ? 'pass' : p === '/u/me' ? 'shop' : p === '/user/profile' ? 'my' : null
}

const kakao = () =>
  `<button type="button" class="${GUEST_CLS.kakao}"><svg class="${GUEST_CLS.kakaoIcon}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${KAKAO_BUBBLE_PATH}"></path></svg><span>${esc(GUEST_COPY.kakaoStart)}</span></button>`

function passBody(): string {
  const c = GUEST_COPY.pass
  const items = c.benefits.map(([t, d]) =>
    `<li class="${GUEST_CLS.benefit}"><span class="${GUEST_CLS.benefitIcon}">${slot(20)}</span><span class="${GUEST_CLS.benefitText}"><span class="${GUEST_CLS.benefitTitle}">${esc(t)}</span><span class="${GUEST_CLS.benefitDesc}">${esc(d)}</span></span></li>`).join('')
  return `<h1 class="${GUEST_CLS.title}">${esc(c.title)}</h1>` +
    `<section class="${GUEST_CLS.card}" data-guest="pass"><h2 class="${GUEST_CLS.headline}">${esc(c.headline1)}<br>${esc(c.headline2)}</h2>` +
    `<div class="mt-5"><ul class="${GUEST_CLS.benefits}">${items}</ul></div><div class="mt-6">${kakao()}</div></section>`
}

function shopBody(): string {
  const c = GUEST_COPY.shop
  return `<h1 class="${GUEST_CLS.title}">${esc(c.title)}</h1>` +
    `<div class="${GUEST_CLS.shopBody}" data-guest="urshop"><h2 class="${GUEST_CLS.shopHeadline}">${esc(c.headline1)}<br>${esc(c.headline2)}</h2><p class="${GUEST_CLS.shopSub}">${esc(c.sub)}</p></div>`
}

function myBody(): string {
  const c = GUEST_COPY.my
  const stats = c.stats.map((l) => `<div><p class="${GUEST_CLS.myStatValue}" aria-hidden="true">-</p><p class="${GUEST_CLS.myStatLabel}">${esc(l)}</p></div>`).join('')
  return `<h1 class="${GUEST_CLS.title}">${esc(c.title)}</h1>` +
    `<section class="${GUEST_CLS.card}" data-guest="my"><div class="${GUEST_CLS.myHead}">${slot(GUEST_MY_MASCOT.width, GUEST_MY_MASCOT.height)}` +
    `<div class="${GUEST_CLS.myHeadText}"><p class="${GUEST_CLS.myHello}">${esc(c.hello)}</p><p class="${GUEST_CLS.myHelloSub}">${esc(c.helloSub)}</p></div></div>` +
    `<div class="${GUEST_CLS.myStats}">${stats}</div><div class="mt-5">${kakao()}</div></section>`
}

/** `RouteGuards.isUserLoggedIn` 과 같은 두 키 — 로그인 흔적이면 게스트 화면을 걷어낸다. */
export function guestFirstScreenGuardScript(nonce: string): string {
  const js = `(function(){try{var s=localStorage;if(s.getItem('user_id')||s.getItem('session_login')){var n=document.getElementById('ur-first-screen');if(n)n.remove()}}catch(e){}})()`
  return `<script nonce="${escAttr(nonce)}">${js}</script>`
}

export function buildGuestFirstScreen(tab: GuestTab, loaderHtml: string, nonce: string): string {
  const body = tab === 'pass' ? passBody() : tab === 'shop' ? shopBody() : myBody()
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다.
  return `<div id="ur-first-screen"><div class="${GUEST_CLS.root}">${body}</div></div>${guestFirstScreenGuardScript(nonce)}${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
