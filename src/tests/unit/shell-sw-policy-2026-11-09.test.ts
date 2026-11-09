/**
 * 🏠 Shell SW 정책 가드 (2026-11-09 대표 승인 — 결재 2026-11-09-revisit-instant-shell).
 *   `public/shell-sw.js` 를 **그대로 평가**해(classic SW · import 없음) `self.__urShellPolicy` 로 대조한다.
 *   2026-04-27 사고 재발 조건 셋을 고정한다:
 *     ① 카카오 로그인 시작(`/auth/kakao/start?redirect=…`)·콜백·API·결제 복귀·어드민은 **절대** 다루지 않는다
 *     ② 쿼리가 하나라도 있으면 다루지 않는다 · navigate·GET·같은 출처만
 *     ③ 네트워크 fetch 는 `redirect: 'follow'` 로, 리다이렉트된 응답은 `Response.redirect` 로 바꾼다
 *   배선: main.tsx 가 shell-sw 를 청소 대상에서 빼고(안 빼면 reload 루프) · _routes.json 이 정적으로 낸다 · 기본 OFF.
 *   ⚠️ 못 보는 것: 브라우저에서 실제로 가로채는지(라이브 `?__shellsw=1` 로 확인) · 저장본이 얼마나 낡는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('public/shell-sw.js', 'utf8')
const ORIGIN = 'https://urdeal.kr'

function loadPolicy() {
  const self: Record<string, unknown> = { location: { origin: ORIGIN }, addEventListener: () => {}, clients: {}, registration: {} }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('self', 'caches', 'fetch', 'Response', 'Request', 'URL', 'Headers', SRC)(self, {}, () => {}, class {}, class { url: string; constructor(u: string) { this.url = u } }, URL, Headers)
  return self.__urShellPolicy as { shouldHandle: (u: string, m: string, mode: string, o: string) => boolean; isDenied: (p: string) => boolean; isAllowed: (p: string) => boolean; version: string }
}
const P = loadPolicy()
const nav = (path: string, origin = ORIGIN) => P.shouldHandle(origin + path, 'GET', 'navigate', ORIGIN)

describe('① 사고 경로는 절대 안 다룬다', () => {
  it.each([
    '/auth/kakao/start?redirect=%2Fu%2Fme&intent=user',
    '/auth/kakao/start', '/auth/logout', '/auth/kakao/callback', // 쿼리 없이도 /auth 는 금지 — 쿼리 규칙만 믿지 않는다
    '/auth/kakao/callback?code=abc&state=xyz',
    '/oauth/callback',
    '/sync/callback',
    '/api/group-buy/products',
    '/api/auth/session/establish',
    '/checkout/return?paymentKey=p&orderId=o&amount=1',
    '/payment/success?paymentKey=p',
    '/pay/toss',
    '/admin', '/admin/login', '/seller/login', '/agency', '/store/new', '/u/me', '/user/profile', '/my-vouchers', '/login',
    '/sw.js', '/push-sw.js', '/shell-sw.js', '/assets/index-abc.js', '/cdn-cgi/trace',
  ])('%s', (p) => { expect(nav(p)).toBe(false) })
})

describe('①-2 금지 목록은 허용 목록과 별개로 서 있어야 한다(두 겹)', () => {
  // 허용 목록이 이미 거르더라도 금지 목록이 그 자체로 막아야 한다 — 한 겹이 느슨해져도 다른 겹이 남게.
  it.each(['/auth/kakao/start', '/oauth/callback', '/api/x', '/sync/callback', '/checkout', '/payment/success', '/admin/login', '/seller/login', '/u/me'])('isDenied(%s)', (p) => {
    expect(P.isDenied(p)).toBe(true)
  })
})

describe('② 쿼리·메서드·모드·출처', () => {
  it('허용 경로라도 쿼리가 있으면 안 다룬다(?ref= ?__cb= ?code= …)', () => {
    for (const q of ['?ref=abc', '?__cb=1', '?code=1&state=2', '?utm_source=x']) expect(nav('/' + q)).toBe(false)
    expect(nav('/pass/2919?ref=u1')).toBe(false)
  })
  it('navigate 가 아니거나 GET 이 아니거나 다른 출처면 안 다룬다', () => {
    expect(P.shouldHandle(ORIGIN + '/', 'GET', 'cors', ORIGIN)).toBe(false)
    expect(P.shouldHandle(ORIGIN + '/', 'POST', 'navigate', ORIGIN)).toBe(false)
    expect(P.shouldHandle('https://live.ur-team.com/', 'GET', 'navigate', ORIGIN)).toBe(false)
  })
  it('허용 목록(서버 첫 화면이 있는 소비자 경로)만 다룬다', () => {
    for (const p of ['/', '/vouchers', '/stays', '/life', '/pass/2919', '/group-buy/2919', '/vouchers/12', '/stays/5', '/u/jiwon1228', '/region/서울', '/blog', '/blog/some-post']) expect(nav(p), p).toBe(true)
    for (const p of ['/map', '/search', '/browse', '/products/3', '/about', '/u/me']) expect(nav(p), p).toBe(false)
  })
})

describe('③ 리다이렉트·fetch 모양 · 배선', () => {
  it("네트워크는 redirect:'follow' 새 요청으로 받고, 리다이렉트된 응답은 Response.redirect 로 바꾼다", () => {
    expect(SRC).toMatch(/fetch\(url, \{ credentials: 'include', redirect: 'follow'/)
    expect(SRC).toMatch(/if \(res\.redirected\) return Response\.redirect\(res\.url, 302\)/)
    expect(SRC).toMatch(/res\.redirected\) return false/) // 리다이렉트된 응답은 저장하지 않는다
  })
  it('다루지 않는 요청엔 respondWith 를 부르지 않는다(투명)', () => {
    expect(SRC).toMatch(/if \(!shouldHandle\(req\.url, req\.method, req\.mode, self\.location\.origin\)\) return/)
  })
  it('저장본에는 표식을 끼우고, 앱은 그 표식을 보면 쿼리를 새로 받는다', () => {
    expect(SRC).toContain('<meta name="ur-shell-cache" content="1">')
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main).toMatch(/isShellCacheServed\(\)[\s\S]{0,200}invalidateQueries/)
  })
  it('저장본 위에서는 새로고침 진행 띠를 띄우고, 쿼리가 다 오면 걷는다(대표 "새로고침이 되듯")', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main).toMatch(/const hide = sw\.showShellRefreshBar\(\)[\s\S]{0,200}invalidateQueries[\s\S]{0,80}\.finally\(hide\)/)
    const lib = readFileSync('src/lib/shell-sw.ts', 'utf8')
    expect(lib).toMatch(/if \(!isShellCacheServed\(\)[^\n]*return \(\) => \{\}/) // 저장본이 아니면 아무것도 안 그린다
    expect(lib).toContain("var(--brand,#1C69EF)")
  })
  it('main.tsx 의 옛 SW 청소가 shell-sw.js 를 남긴다(안 남기면 reload 루프)', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main).toMatch(/scriptUrl\.includes\('push-sw\.js'\) \|\| scriptUrl\.includes\('shell-sw\.js'\)/)
    expect(main).toMatch(/!\(\(_ctrl\.scriptURL \|\| ''\)\.includes\('shell-sw\.js'\)\)/)
  })
  it('main.tsx 의 캐시 청소가 ur-shell-* 저장소를 남긴다(2026-11-09 라이브 실측 — 안 남기면 저장본이 매 로드마다 지워져 한 번도 안 쓰인다)', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main).toMatch(/caches\.keys\(\)\.then\(keys => Promise\.all\(keys\.filter\(k => !k\.startsWith\('ur-shell-'\)\)\.map\(k => caches\.delete\(k\)\)\)\)/)
    expect(readFileSync('src/lib/shell-sw.ts', 'utf8')).toMatch(/applyShellSwTestFlag\(\)[^\n]*\n\s*const on = testFlagOn\(\)/) // 시험 표식은 같은 로드에서 먹는다
  })
  it('_routes.json 이 정적으로 낸다 · 킬스위치 기본 OFF · 워커가 variant 헤더를 단다', () => {
    const routes = JSON.parse(readFileSync('public/_routes.json', 'utf8'))
    expect(routes.exclude).toContain('/shell-sw.js')
    const gates = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
    expect(gates).toMatch(/key: 'shell_sw_enabled', kind: 'setting'[^\n]*default_value: 'false'/)
    const util = readFileSync('src/worker/routes/public-utility.routes.ts', 'utf8')
    expect(util).toContain("out.shell_sw_enabled = s.shell_sw_enabled === 'true'")
    expect(readFileSync('src/worker/index.ts', 'utf8')).toContain("c.res.headers.set('X-Shell-Variant', authed ? 'user' : 'guest')")
    expect(readFileSync('src/lib/shell-sw.ts', 'utf8')).toMatch(/j\?\.data\?\.shell_sw_enabled === true/)
  })
})
