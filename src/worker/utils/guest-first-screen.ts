/**
 * 🚪 로그인 전 탭 화면(이용권 `/my-vouchers` · 유어샵 `/u/me` · 마이 `/user/profile`) + 로그인 `/login`(2026-11-09) 서버 첫 화면 (2026-10-19).
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
 * 아이콘 그림 — 같은 크기의 빈 칸만(두 벌 금지). 카카오 말풍선은 같은 path 상수라 그대로 그린다.
 * 🦦 마이의 유달이는 그린다(2026-11-09): 그림이 공개 주소(`UDAL_HELLO_SRC`) 한 벌이 됐고, `Udal` 부품과 같은 속성으로
 * 그려서 마운트 때 같은 `<img>` 로 이어진다. 빈 칸이던 때는 글자 0.45초 · 그림 2.3초였다(실측).
 * 아이콘(svg)은 여전히 빈 칸이다 — 여기서 path 를 손으로 베끼면 두 벌이 된다.
 */
import { GUEST_CLS, GUEST_COPY, GUEST_MY_MASCOT, GUEST_CLOCK, KAKAO_BUBBLE_PATH, AUTHED_PASS_CLS, AUTHED_PASS_TITLE } from '../../shared/guest-page'
import { UDAL_HELLO_SRC, UDAL_HELLO_ART } from '../../shared/mascot-art'
import { LOGIN_CLS } from '../../shared/login-page'
import { loginFirstScreenBody } from './login-first-screen'
import { PC_HOME_FS } from '../../shared/pc-home-first-screen' // 🖥️ PC 상단 네비 높이 예약(홈·상세·목록과 같은 상수)

/** 🔐 2026-11-09 — `login`(`/login`)이 네 번째 탭. 로그인 전 탭·보호 경로가 전부 그 화면으로 보낸다(`login-first-screen.ts`). */
export type GuestTab = 'pass' | 'shop' | 'my' | 'login'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

/** 경로 → 탭. 넷 밖이면 null. */
export function guestTabOf(pathname: string): GuestTab | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/my-vouchers' ? 'pass' : p === '/u/me' ? 'shop' : p === '/user/profile' ? 'my' : p === '/login' ? 'login' : null
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
    `<section class="${GUEST_CLS.hero}" data-guest="pass"><h2 class="${GUEST_CLS.headline}">${esc(c.headline1)}<br>${markHtml(c.headline2, c.headline2Mark)}</h2>` +
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

/** 유달이(hello) — `components/mascot/Udal.tsx` 가 `priority` 로 그리는 `<img>` 와 같은 속성·같은 주소. */
function mascot(): string {
  const w = GUEST_MY_MASCOT.width
  const h = Math.round((w * UDAL_HELLO_ART.h) / UDAL_HELLO_ART.w)
  return `<img src="${UDAL_HELLO_SRC}" alt="" aria-hidden="true" draggable="false" width="${w}" height="${h}" loading="eager" fetchpriority="high" decoding="async" data-udal="hello" class="select-none pointer-events-none" style="width:${w}px;height:auto">`
}

function myBody(): string {
  const c = GUEST_COPY.my
  return `<h1 class="${GUEST_CLS.title}">${esc(c.title)}</h1>` +
    `<section class="${GUEST_CLS.hero}" data-guest="my"><div class="${GUEST_CLS.myHead}">${mascot()}` +
    `<div class="${GUEST_CLS.myHeadText}"><p class="${GUEST_CLS.myHello}">${esc(c.hello)}</p><p class="${GUEST_CLS.myHelloSub}">${esc(c.helloSub)}</p></div></div></section>` + dock()
}

/** `RouteGuards.isUserLoggedIn` 과 같은 두 키 — 로그인 흔적이면 게스트 화면을 걷어낸다. */
export function guestFirstScreenGuardScript(nonce: string): string {
  const js = `(function(){try{var s=localStorage;if(s.getItem('user_id')||s.getItem('session_login')){var n=document.getElementById('ur-first-screen');if(n)n.remove()}}catch(e){}})()`
  return `<script nonce="${escAttr(nonce)}">${js}</script>`
}

/**
 * 🖥️ PC(lg+) 액자 — `MobileAppLayout` 이 소비자 화면을 `.mobile-app-container.app-framed`(430px 가운데 액자, `--app-frame`)로 감싼다.
 *   서버가 같은 상자를 그려야 마운트 때 가로가 안 움직인다. 거터 바탕(`body.app-frame-host`)은 React 가 테마를 알고 칠한다 — 색만 바뀌고 자리는 그대로.
 *   값은 `MobileAppLayout.tsx` 의 className·`frameWidth` 그대로(시험이 소스와 대조).
 */
export const GUEST_PC_FRAME = { cls: 'mobile-app-container app-framed', width: '430px' } as const

/**
 * @param isMobile 폰·크롤러(`shouldRenderMobileFirstScreen`)면 종전 그대로. PC 면 **네비 높이 예약 + 430 액자**로 감싼다(2026-11-09 대표 승인 — PC 첫 화면).
 *   로그인 화면(`login`)은 PC 에서 상단 네비가 없다(`consumerChromeHiddenByPath`) — 액자만.
 */
export function buildGuestFirstScreen(tab: GuestTab, loaderHtml: string, nonce: string, isMobile = true): string {
  const body = tab === 'pass' ? passBody() : tab === 'shop' ? shopBody() : tab === 'my' ? myBody() : loginFirstScreenBody()
  const root = tab === 'login' ? LOGIN_CLS.root : GUEST_CLS.root // 로그인 화면은 자기 뿌리(흰 바탕·가운데 정렬)다
  const page = `<div class="${root}">${body}</div>`
  const topnav = isMobile || tab === 'login' ? '' : `<div class="${PC_HOME_FS.topnav}"><div class="${PC_HOME_FS.topnavRow1}"></div><div class="${PC_HOME_FS.topnavRow2}"></div></div>`
  const framed = isMobile ? page : `<div class="${GUEST_PC_FRAME.cls}" data-mobile-only="false" style="--app-frame:${GUEST_PC_FRAME.width}">${page}</div>`
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다.
  return `<div id="ur-first-screen">${topnav}${framed}</div>${guestFirstScreenGuardScript(nonce)}${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}

/**
 * 🎟️ 2026-11-11 로그인한 사람의 내 이용권 — 제목 줄 + 로더(폰만 · 세션 쿠키가 있을 때만). 목록은 본인 데이터라 서버가 모른다.
 *   첫 화면 CSS 는 게스트 탭 표면(`guest`)을 같이 쓴다(이 파일이 그 표면의 뿌리).
 */
/** 쿠키는 있는데 이 기기는 로그아웃 상태면(앱이 게스트 화면을 그린다) 제목을 걷어낸다 — 게스트 쪽 스크립트의 반대 방향. */
export function authedFirstScreenGuardScript(nonce: string): string {
  const js = `(function(){try{var s=localStorage;if(!(s.getItem('user_id')||s.getItem('session_login'))){var n=document.getElementById('ur-first-screen');if(n)n.remove()}}catch(e){}})()`
  return `<script nonce="${escAttr(nonce)}">${js}</script>`
}
export function buildAuthedPassFirstScreen(loaderHtml: string, nonce: string): string {
  return `<div id="ur-first-screen"><div class="${AUTHED_PASS_CLS.root}"><div class="${AUTHED_PASS_CLS.titleRow}"><h1 class="${AUTHED_PASS_CLS.title}">${esc(AUTHED_PASS_TITLE)}</h1></div></div></div>${authedFirstScreenGuardScript(nonce)}${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
