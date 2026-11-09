/**
 * 🔐 로그인 화면(`/login`) 서버 첫 화면 (2026-11-09 — 라이브 첫 글자 1.6s · 유달이 1.73s, HTML 은 0.29s).
 *
 * 지키는 것:
 *   ① `/login` 은 로그인 전 탭 셋의 네 번째 탭(`guestTabOf`) — 워커 배선·세션 쿠키 조건·로그인 흔적 걷어내기를 그대로 탄다
 *   ② 서버 HTML 이 `shared/login-page.ts` 의 클래스·문구 **전부**를 쓰고, 뿌리 클래스는 `LOGIN_CLS.root`
 *   ③ `LoginPage.tsx` 도 같은 상수를 쓴다 — 손으로 다시 적은 클래스 문자열이 없다(갈리면 마운트 때 모양이 바뀐다)
 *   ④ 유달이는 공개 주소 한 벌(`UDAL_HELLO_SRC`) · eager · 64px, 로고는 `logo-html` 미러
 *   ⑤ 들어올 때 모션(`ur-lg-h`·`ur-lg-btn`)은 서버가 먼저 그렸으면 붙이지 않는다(`hadBootFirstScreen`)
 *
 * ⚠️ 못 보는 것: 실제 박스 위치(jsdom 엔 레이아웃이 없다) · 오류/이메일 폼 분기(서버는 기본 분기만 그린다 — 의도).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildGuestFirstScreen, guestTabOf } from '@/worker/utils/guest-first-screen'
import { loginFirstScreenBody } from '@/worker/utils/login-first-screen'
import { LOGIN_CLS, LOGIN_COPY, LOGIN_UDAL_SIZE, LOGIN_LOGO_SIZE } from '@/shared/login-page'
import { UDAL_HELLO_SRC } from '@/shared/mascot-art'
import { logoHtml } from '@/worker/utils/logo-html'

const page = stripComments(readFileSync('src/pages/LoginPage.tsx', 'utf8'))

function serverRoot(): Element {
  const d = document.createElement('div')
  d.innerHTML = buildGuestFirstScreen('login', '<div>LOADER</div>', 'n')
  return d.querySelector('#ur-first-screen > div')!
}

describe('① /login 은 네 번째 게스트 탭', () => {
  it('guestTabOf', () => {
    expect(guestTabOf('/login')).toBe('login')
    expect(guestTabOf('/login/')).toBe('login')
    for (const p of ['/login/email', '/seller/login', '/agency/login', '/']) expect(guestTabOf(p)).not.toBe('login')
  })
  it('뿌리 클래스는 로그인 화면 것(게스트 탭 뿌리 아님) · 로그인 흔적 스크립트가 붙는다', () => {
    const html = buildGuestFirstScreen('login', '<div>LOADER</div>', 'n')
    expect(serverRoot().getAttribute('class')).toBe(LOGIN_CLS.root)
    expect(html).toContain("s.getItem('user_id')||s.getItem('session_login')")
  })
})

describe('② 서버 HTML = 상수 전부', () => {
  const body = loginFirstScreenBody()
  it.each(Object.entries(LOGIN_CLS).filter(([k]) => k !== 'root'))('클래스 %s', (_k, v) => {
    expect(body).toContain(`class="${v}"`.replace(`class="${LOGIN_CLS.udal}"`, `${LOGIN_CLS.udal}"`))
  })
  it.each(Object.entries(LOGIN_COPY))('문구 %s', (_k, v) => {
    expect(body).toContain(v) // '및' 은 앞뒤 공백과 함께 선다(앱의 {' '}및{' '} 과 같다)
  })
  it('순서: 유달이 → 로고 → 한 줄 → 카카오 → 약관 → 링크 한 줄', () => {
    const idx = [UDAL_HELLO_SRC, 'urdeal', LOGIN_COPY.heroTitle, LOGIN_COPY.kakaoStart, LOGIN_COPY.termsLink, LOGIN_COPY.loginWithEmail].map((s) => body.indexOf(s))
    expect(idx.every((n) => n >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })
})

describe('③ LoginPage 는 같은 상수를 쓴다', () => {
  it('손으로 적은 클래스 문자열이 남아 있지 않다', () => {
    for (const [k, v] of Object.entries(LOGIN_CLS)) {
      expect(page, `LoginPage 가 LOGIN_CLS.${k} 대신 문자열을 손으로 적었다`).not.toContain(`"${v}"`)
      if (k !== 'udal') expect(page).toContain(`LOGIN_CLS.${k}`)
    }
    expect(page).toContain('size={LOGIN_UDAL_SIZE}')
    expect(page).toContain('<UrDealLogo size={LOGIN_LOGO_SIZE} />')
    for (const k of Object.keys(LOGIN_COPY)) expect(page).toContain(`LOGIN_COPY.${k}`)
  })
})

describe('④ 유달이·로고', () => {
  it('유달이 <img>: 공개 주소 · eager · 64px · Udal 과 같은 클래스(ur-udal-bob 포함) · 파일 실재', () => {
    const img = serverRoot().querySelector('img[data-udal="hello"]')!
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe(UDAL_HELLO_SRC)
    expect(existsSync('public' + UDAL_HELLO_SRC)).toBe(true)
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('width')).toBe(String(LOGIN_UDAL_SIZE))
    expect(img.getAttribute('class')).toBe(`select-none pointer-events-none ur-udal-bob ${LOGIN_CLS.udal}`)
  })
  it('로고는 공용 미러 한 벌(logo-html) — 유어샵 첫 화면도 같은 것을 쓴다', () => {
    expect(loginFirstScreenBody()).toContain(logoHtml(LOGIN_LOGO_SIZE))
    const curator = stripComments(readFileSync('src/worker/utils/curator-ssr-body.ts', 'utf8'))
    expect(curator).toMatch(/import \{ logoHtml \} from '\.\/logo-html'/)
    expect(curator).not.toMatch(/function logoHtml\(/)
  })
})

describe('⑤ 들어올 때 모션은 서버가 먼저 그렸으면 끈다', () => {
  it('LoginPage 가 hadBootFirstScreen 로 판단하고 두 클래스를 조건부로 붙인다', () => {
    expect(page).toMatch(/hadBootFirstScreen\(window\.location\.pathname\)/)
    expect(page).toMatch(/enterMotion \? 'ur-lg-h ' : ''/)
    expect(page).toMatch(/enterMotion \? 'ur-lg-btn ' : ''/)
    expect(stripComments(readFileSync('src/lib/boot-first-screen.ts', 'utf8'))).toMatch(/export function hadBootFirstScreen\(pathname: string\): boolean/)
    // 서버 쪽은 모션 클래스를 안 그린다(키프레임이 앱 코드와 같이 오므로 그리면 마운트 때 0 에서 다시 떠오른다)
    expect(loginFirstScreenBody()).not.toMatch(/ur-lg-/)
  })
})
