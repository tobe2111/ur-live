/**
 * 📱 카카오 로그인 두 가지 (2026-10-11 대표 *"모두 가장 이상적으로 고치자"*)
 *
 * ① 카톡 간편로그인 — 다른 서비스는 카톡 앱으로 바로 동의 화면이 뜨는데 유어딜은 카카오 아이디·비밀번호
 *    창이 떴다(서버가 웹 이동만 했다). 안드로이드는 JS SDK `Kakao.Auth.authorize` 로 카톡 앱을 연다.
 * ② 옛 착지 주소 — 라이브 2026-10-10 아이폰 사파리 세션 교환 3회 거절, 그 시각 카카오 콜백 0건.
 *    방문 기록이 옛 `?login=success…#st=` 주소를 다시 연 것이다 → 로그인으로 취급하지 않는다 +
 *    서버가 티켓을 거절하면 다시 던지지 않는다.
 *
 * ⚠️ 못 보는 것: 실제 폰에서 카톡 앱이 열리고 돌아오는지(브라우저·카톡 버전마다 다르다) — 배포 뒤
 *   안드로이드에서 직접 눌러 봐야 한다. 아이폰은 이번 범위 밖(종전 웹 이동 유지).
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'
import { isStaleLoginLanding, landingTicketExp, STALE_GRACE_SEC } from '@/utils/stale-login-landing'

const b64u = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const ticket = (exp: number) => `${b64u({ alg: 'HS256' })}.${b64u({ p: 'session_establish', uid: '3', exp })}.sig`
const hashOf = (exp: number) => '#st=' + encodeURIComponent(ticket(exp))

describe('② 옛 착지 주소 판정', () => {
  const now = 1_800_000_000
  it('티켓의 exp 를 읽는다', () => {
    expect(landingTicketExp(hashOf(now))).toBe(now)
    expect(landingTicketExp(hashOf(now) + '&auth=xyz')).toBe(now)
  })
  it('만료 + 여유(10분)를 넘긴 착지만 옛날로 본다', () => {
    expect(STALE_GRACE_SEC).toBe(600)
    expect(isStaleLoginLanding(hashOf(now - 601), now)).toBe(true)
    expect(isStaleLoginLanding(hashOf(now - 599), now)).toBe(false)
    expect(isStaleLoginLanding(hashOf(now + 120), now)).toBe(false)
  })
  it('애매하면 옛날로 보지 않는다(정상 로그인을 막지 않는다)', () => {
    expect(isStaleLoginLanding('', now)).toBe(false)
    expect(isStaleLoginLanding('#auth=abc', now)).toBe(false)
    expect(isStaleLoginLanding('#st=not-a-jwt', now)).toBe(false)
  })
  it('착지 처리는 옛 주소면 로그인 분기를 건너뛰고 주소만 지운다', () => {
    const boot = readCode('src/utils/auth-callback-bootstrap.ts')
    const i = boot.indexOf('isStaleLoginLanding(window.location.hash')
    const j = boot.indexOf('didFreshLogin = true')
    expect(i).toBeGreaterThan(0)
    expect(j).toBeGreaterThan(i) // 판정이 로그인 분기보다 먼저
    const branch = boot.slice(i, j)
    expect(branch).toMatch(/history\.replaceState/)
    expect(branch).toMatch(/\} else\s*\n?\s*if \(loginLanding\)/)
  })
  it('서버가 티켓을 거절(400/401)하면 다시 던지지 않는다 — 재시도는 일시 실패에만', () => {
    const main = readCode('src/main.tsx')
    expect(main).toMatch(/rejected = res\.status === 400 \|\| res\.status === 401/)
    const k = main.indexOf('if (rejected) {')
    expect(k).toBeGreaterThan(0)
    const tail = main.slice(k, k + 220)
    expect(tail).toMatch(/__urEstablishTicket/)
    expect(tail).toMatch(/else \{ try \{ setTimeout\(retryEstablishOnce, 1500\)/) // 재시도는 거절이 아닐 때만
    expect(main.match(/setTimeout\(retryEstablishOnce/g)?.length).toBe(1)
  })
})

describe('① 카톡 간편로그인', () => {
  it('서버는 같은 state·쿠키로 값만 돌려준다(이동은 SDK 가)', () => {
    const start = sliceFrom(readCode('src/features/auth/api/kakao.routes.ts'), "kakaoRoutes.get('/start'", "kakaoRoutes.get('/consent/start'", 8000)
    expect(start.length).toBeGreaterThan(0)
    const sdk = start.indexOf("c.req.query('mode') === 'sdk'")
    expect(sdk).toBeGreaterThan(start.indexOf('OAUTH_STATE_COOKIE}=')) // 쿠키를 심은 뒤
    expect(start.slice(sdk, sdk + 200)).toMatch(/data: \{ state, redirectUri, scope/)
  })
  it('클릭 안에서 동기로 SDK 를 부르고, 준비가 안 됐으면 종전 웹 이동', () => {
    const page = readCode('src/pages/LoginPage.tsx')
    const h = sliceFrom(page, 'function handleKakaoLogin()', 'async function handleEmailLogin', 4000)
    const talk = h.indexOf('startTalkLogin()')
    expect(talk).toBeGreaterThan(0)
    expect(h.slice(talk - 40, talk)).toMatch(/!wantsSwitch && $/) // '다른 계정으로'는 웹 로그인 창
    expect(h.indexOf("window.location.href = `/auth/kakao/start?")).toBeGreaterThan(talk) // 폴백은 그 뒤
    expect(page).toMatch(/if \(wantsSwitch \|\| !canUseTalkLogin\(\)\) return\s*\n\s*void prepareTalkLogin\(/)
  })
  it('SDK 호출은 카톡 실행을 요청하고 state 를 1회용으로 쓴다', () => {
    const lib = readCode('src/lib/kakao-talk-login.ts')
    expect(lib).toMatch(/throughTalk: true/)
    expect(lib).toMatch(/state: t\.state/)
    expect(lib).toMatch(/ready = null \/\/ state 는 1회용|ready = null/)
  })
  it('안드로이드 일반 브라우저만 — 아이폰·다른 앱 안 브라우저는 종전 방식', () => {
    const lib = readCode('src/lib/kakao-talk-login.ts')
    expect(lib).toMatch(/return isAndroid\(\) && detectInAppBrowser\(\) === null/)
  })
})
