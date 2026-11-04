/**
 * 🚪 로그인 전 탭 화면(이용권 `/my-vouchers` · 유어샵 `/u/me` · 마이 `/user/profile`) 서버 첫 화면 (2026-10-19).
 *
 * 라이브 실측(아이폰13 · 느린 4G · CPU 4배): 세 탭 모두 첫 그림이 2.0~2.5초였다 — 화면 대부분이 고정 문구(제목·혜택·
 * 카카오 버튼)인데 앱 코드가 다 와야 그려졌다. 새로 온 사람이 하단 탭을 누르면 가장 먼저 보는 화면이다.
 *
 * 이 첫 화면은 **React 와 같은 모양**(같은 클래스·문구 상수 — `shared/guest-page.ts`)으로 위쪽(제목 + 머리)과
 * 아래 고정 카카오 버튼(2026-11-03)만 그리고,
 * 그 아래는 종전 로더를 둔다(인기 이용권·최근 본 이용권처럼 데이터·기기 저장값이 필요한 것은 그리지 않는다).
 *
 * ## 로그인한 사람
 * 서버는 세션 쿠키가 있으면 아예 그리지 않는다(호출부). 쿠키가 없는데 기기에 로그인 흔적이 있으면(`isUserLoggedIn` 과
 * 같은 두 키) 바로 뒤 인라인 스크립트가 노드를 걷어낸다 — 그 사람에게 게스트 화면을 보여 주지 않는다.
 *
 * ## 그리지 않는 것
 * 아이콘·마스코트 그림 — 같은 크기의 빈 칸만(두 벌 금지). 카카오 말풍선은 같은 path 상수라 그대로 그린다.
 */
import { GUEST_CLS, GUEST_COPY, GUEST_MY_MASCOT, GUEST_CLOCK, KAKAO_BUBBLE_PATH } from '../../shared/guest-page'

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
  `<button type="button" class="${GUEST_CLS.kakao}"><svg class="${GUEST_CLS.kakaoIcon}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${KAKAO_BUBBLE_PATH}"></path></svg><span>${esc(GUEST_COPY.kakaoStart)}</span><span class="${GUEST_CLS.kakaoShine}" aria-hidden="true"></span></button>`

/** 아래 고정 카카오 버튼 — `GuestDock` 과 같은 모양. */
const dock = (note?: string) =>
  `<div class="${GUEST_CLS.dock}" data-guest-dock="">${kakao()}${note ? `<p class="${GUEST_CLS.dockNote}">${esc(note)}</p>` : ''}</div>`

/** 1 · 2 · 3 단계 — `GuestSteps` 와 같은 모양. */
const steps = (list: ReadonlyArray<readonly [string, string]>) =>
  `<ol class="${GUEST_CLS.steps}">${list.map(([a, b], i) =>
    `<li class="${GUEST_CLS.step}"><span class="${GUEST_CLS.stepNum}">${i + 1}</span><span class="${GUEST_CLS.stepText}">${esc(a)}<br>${esc(b)}</span></li>`).join('')}</ol>`

/** 지갑 미리보기 — `GuestTicket` 과 같은 모양(예시 두 장 · 고정 그림이라 데이터가 없어도 그린다). */
function ticket(): string {
  const c = GUEST_COPY.pass
  const clock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="${GUEST_CLS.walletClock}"><circle cx="${GUEST_CLOCK.circle.cx}" cy="${GUEST_CLOCK.circle.cy}" r="${GUEST_CLOCK.circle.r}"></circle><path d="${GUEST_CLOCK.path}"></path></svg>`
  return `<div class="${GUEST_CLS.ticket}" aria-hidden="true">` + c.wallet.map((w) =>
    `<div class="${GUEST_CLS.walletRow}"><span class="${GUEST_CLS.walletThumb}"><img src="${esc(w.img)}" alt="" width="56" height="56" decoding="async" class="${GUEST_CLS.walletImg}"></span>` +
    `<span class="${GUEST_CLS.walletText}"><span class="${GUEST_CLS.walletStore}">${esc(w.store)}</span><span class="${GUEST_CLS.walletName}">${esc(w.name)}</span>` +
    `<span class="${GUEST_CLS.walletDue}">${clock}${esc(w.due)}</span></span><span class="${GUEST_CLS.walletUse}">${esc(c.use)}</span></div>`).join('') + `</div>`
}

function passBody(): string {
  const c = GUEST_COPY.pass
  return `<h1 class="${GUEST_CLS.title}">${esc(c.title)}</h1>` +
    `<section class="${GUEST_CLS.hero}" data-guest="pass"><h2 class="${GUEST_CLS.headline}">${esc(c.headline1)}<br>${esc(c.headline2)}</h2>` +
    `<p class="${GUEST_CLS.sub}">${esc(c.sub)}</p>${ticket()}${steps(c.steps)}</section>` + dock()
}

/** 헤드라인의 한 구절을 형광펜 칸(`data-motion="mark"`)으로 감싼다 — 앱 `MarkedLine` 과 같은 모양. 구절이 없으면 그대로. */
function markHtml(line: string, mark: string): string {
  const i = line.indexOf(mark)
  if (i < 0) return esc(line)
  return `${esc(line.slice(0, i))}<span data-motion="mark">${esc(mark)}</span>${esc(line.slice(i + mark.length))}`
}

function shopBody(): string {
  const c = GUEST_COPY.shop
  return `<h1 class="${GUEST_CLS.title}">${esc(c.title)}</h1>` +
    `<div class="${GUEST_CLS.hero}" data-guest="urshop"><h2 class="${GUEST_CLS.headline}">${esc(c.headline1)}<br>${markHtml(c.headline2, c.headline2Mark)}</h2><p class="${GUEST_CLS.sub}">${esc(c.sub)}</p></div>` + dock(c.dockNote)
}

function myBody(): string {
  const c = GUEST_COPY.my
  return `<h1 class="${GUEST_CLS.title}">${esc(c.title)}</h1>` +
    `<section class="${GUEST_CLS.hero}" data-guest="my"><div class="${GUEST_CLS.myHead}">${slot(GUEST_MY_MASCOT.width, GUEST_MY_MASCOT.height)}` +
    `<div class="${GUEST_CLS.myHeadText}"><p class="${GUEST_CLS.myHello}">${esc(c.hello)}</p><p class="${GUEST_CLS.myHelloSub}">${esc(c.helloSub)}</p></div></div></section>` + dock()
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
