/**
 * 🔐 로그인 화면(`/login`) 서버 첫 화면 — `guest-first-screen.ts` 의 네 번째 탭(`login`) (2026-11-09).
 *
 * 실측: HTML 0.29s · 첫 글자 1.6s · 유달이 1.73s(아이폰13 · 느린 4G · CPU 4배). 화면은 전부 고정 문구다.
 * React(`pages/LoginPage.tsx`)와 **같은 클래스·문구 상수**(`shared/login-page.ts`)로 [유달이 · 로고 · 한 줄 · 카카오 버튼 ·
 * 약관 · 링크 한 줄]을 그린다. 유달이는 공개 주소(`shared/mascot-art.ts`)라 서버가 같은 `<img>` 를 그린다.
 * 오류·전환 문구(`error`·`switch=1`)·이메일 폼은 상태가 있어야 하므로 그리지 않는다(기본 분기만).
 * 버튼은 앱 코드가 올 때까지 눌리지 않는다 — 로그인 전 탭 셋과 같은 교환(글자 1.3초 먼저 ↔ 조작 그대로).
 */
import { LOGIN_CLS, LOGIN_COPY, LOGIN_UDAL_SIZE, LOGIN_LOGO_SIZE } from '../../shared/login-page'
import { KAKAO_BUBBLE_PATH } from '../../shared/guest-page'
import { UDAL_HELLO_SRC, UDAL_HELLO_ART } from '../../shared/mascot-art'
import { logoHtml } from './logo-html'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** `Udal mood="hello" size={64} priority motion className="block mb-5"` 와 같은 속성(움직임 클래스 `ur-udal-bob` 포함). */
function udalHtml(): string {
  const w = LOGIN_UDAL_SIZE
  const h = Math.round((w * UDAL_HELLO_ART.h) / UDAL_HELLO_ART.w)
  return `<img src="${UDAL_HELLO_SRC}" alt="" aria-hidden="true" draggable="false" width="${w}" height="${h}" loading="eager" fetchpriority="high" decoding="async" data-udal="hello" class="select-none pointer-events-none ur-udal-bob ${LOGIN_CLS.udal}" style="width:${w}px;height:auto">`
}

export function loginFirstScreenBody(): string {
  const c = LOGIN_COPY
  return `<div class="${LOGIN_CLS.frame}">` +
    `<div class="${LOGIN_CLS.center}">${udalHtml()}${logoHtml(LOGIN_LOGO_SIZE)}<h1 class="${LOGIN_CLS.h1}">${esc(c.heroTitle)}</h1></div>` +
    `<div><button type="button" class="${LOGIN_CLS.kakao}"><svg class="${LOGIN_CLS.kakaoIcon}" viewBox="0 0 24 24" aria-hidden="true"><path fill="#3C1E1E" d="${KAKAO_BUBBLE_PATH}"></path></svg><span>${esc(c.kakaoStart)}</span></button>` +
    `<p class="${LOGIN_CLS.terms}"><a href="/terms" class="${LOGIN_CLS.termsLink}">${esc(c.termsLink)}</a> ${esc(c.termsAnd)} <a href="/privacy" class="${LOGIN_CLS.termsLink}">${esc(c.privacyLink)}</a></p>` +
    `<div class="${LOGIN_CLS.links}"><button type="button" class="${LOGIN_CLS.link}">${esc(c.loginWithEmail)}</button><span aria-hidden="true" class="${LOGIN_CLS.linkSep}">|</span><a href="/agency/login" class="${LOGIN_CLS.link}">${esc(c.agencyLogin)}</a></div></div>` +
    `</div>`
}
