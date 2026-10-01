/**
 * 🧭 **공식: 로그인으로 보낼 때는 돌아올 곳을 같이 보낸다** (2026-10-01, 대표)
 *
 * 대표: *"로그아웃 된 상태에서의 페이지에서 로그인을 하고 다시 그 같은 페이지로 가는 플로우는
 * 모든 경우의 수에 적용이 되어야 할텐데 모두 되어있어? 이건 당연한 공식같은거잖아."*
 *
 * ## 그때 재 보니 아니었다
 *
 * 로그인으로 보내는 자리가 **59곳**인데 그중 **14곳이 돌아갈 곳을 전혀 안 남겼다** — 그 안에
 * **결제 화면 둘**(체크아웃 배송지·딜 충전)과 세션 만료 인터셉터가 있었다. 돈을 내려던 사람을
 * 홈으로 떨어뜨리는 자리다.
 *
 * ## 공식 — 셋 중 하나여야 한다
 *
 * 1. `loginPathFromHere()` 또는 `?returnUrl=` 을 **URL 에 실어** 보낸다 ← 기본
 * 2. 바로 앞에서 `localStorage.loginReturnUrl` 에 적는다 (옛 방식 — LoginPage 가 읽는다)
 * 3. 돌아가면 **안 되는** 자리면 `login-return-ok` 주석으로 의도를 밝힌다
 *    (탈퇴 직후 · 로그인 실패 후 재시도 · 가입 완료 후 · 메뉴의 "로그인" 링크)
 *
 * ⚠️ 이 가드가 **못** 보는 것: 변수로 조립한 경로 · 서버 리다이렉트 · 로그인 **후** 실제로 그
 *   주소로 가는지(그건 `login-return-url-2026-10-01.test.ts` 와 라이브 판정의 몫) ·
 *   대시보드 로그인(`/seller/login`·`/admin/login`·`/agency/login` — 별도 흐름).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')
const SCAN = ['src/pages', 'src/components', 'src/client', 'src/shared', 'src/lib', 'src/utils', 'src/features']

/**
 * `/login` 으로 보내는 줄 — navigate / location.href / <Navigate to> / <Link to>.
 * ⚠️ 고쳐진 자리는 `/login` 리터럴이 사라지고 `loginPathFromHere()` 가 되므로 **그것도 진입점으로 센다**
 *   (안 그러면 고칠수록 검사 대상이 줄어 ②의 "그 파일에 진입점이 있는가" 가 헛돈다).
 */
const SEND = /(navigate\(|window\.location\.href\s*=\s*|location\.href\s*=\s*|<Navigate\s+to=|\bto=)\s*/
const NAV = new RegExp(SEND.source + "(?:[`'\"]\\/login|\\{?\\s*loginPathFromHere\\()")

interface Site { file: string; line: number; text: string; ok: boolean; why: string }

function scan(): Site[] {
  const files = execFileSync('git', ['ls-files', ...SCAN], { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter(f => /\.tsx?$/.test(f) && !f.includes('/tests/'))
  const out: Site[] = []
  for (const f of files) {
    const lines = readFileSync(resolve(ROOT, f), 'utf-8').split('\n')
    lines.forEach((ln, i) => {
      if (!ln.includes('/login') && !ln.includes('loginPathFromHere(')) return
      if (!NAV.test(ln)) return
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return                      // 주석 줄
      const ctx = lines.slice(Math.max(0, i - 6), i + 2).join('\n')  // 앞 6줄 + 다음 줄
      let why = ''
      if (/returnUrl|loginPathFromHere/.test(ln)) why = 'url'
      else if (ctx.includes('loginReturnUrl')) why = 'storage'
      else if (/login-return-ok/.test(ctx)) why = 'opt-out'
      out.push({ file: f, line: i + 1, text: ln.trim().slice(0, 90), ok: why !== '', why })
    })
  }
  return out
}

describe('① 전수 — 로그인으로 보내는 모든 자리가 복귀를 남긴다', () => {
  const sites = scan()

  it('검사 대상을 실제로 찾았다 (0곳이면 통과가 아니라 고장)', () => {
    expect(sites.length, '로그인 진입점을 하나도 못 찾았다 — 스캔이 헛돈다').toBeGreaterThan(30)
  })

  it('🔴 복귀 주소를 안 남기는 자리가 없다', () => {
    const bad = sites.filter(s => !s.ok)
    const msg = bad.map(s => `\n  ${s.file}:${s.line}  ${s.text}`).join('')
    expect(bad, `복귀 주소 없이 /login 으로 보낸다 — loginPathFromHere() 를 쓰거나, 돌아가면 안 되는 자리면 'login-return-ok' 주석으로 밝힐 것:${msg}`).toEqual([])
  })

  it('의도적 예외는 손에 꼽을 만큼만 (늘면 공식이 형해화된다)', () => {
    const optOut = sites.filter(s => s.why === 'opt-out')
    expect(optOut.length, `예외 ${optOut.length}곳: ${optOut.map(s => s.file + ':' + s.line).join(', ')}`).toBeLessThanOrEqual(10)
  })

  it('🔁 예외 상한을 몰래 풀 수 없다 — 이 시험 **자신의 숫자**를 고정한다', () => {
    // 래칫은 스스로 느슨해지는 것을 못 막는다(상한을 올리는 변경은 통과만 쉬워진다).
    // 그래서 숫자 자체를 소스에서 읽어 앵커한다 — 올리면 **이 줄**이 빨간불이 된다.
    const self = readFileSync(resolve(__dirname, 'login-return-everywhere-2026-10-01.test.ts'), 'utf-8')
    expect(self).toContain(').toBeLessThanOrEqual(10)')
    expect(self).not.toMatch(/toBeLessThanOrEqual\((?!10\)|30\))\d{3,}\)/)
  })

  it('대부분은 URL 에 명시한다 — localStorage 는 막힌 브라우저에서 안 통한다', () => {
    const url = sites.filter(s => s.why === 'url').length
    expect(url).toBeGreaterThan(sites.filter(s => s.why === 'storage').length)
  })
})

describe('② 결제·세션 자리는 반드시 복귀한다 (돈 내려던 사람을 홈으로 보내지 않는다)', () => {
  const sites = scan()
  const MUST = [
    'src/pages/CheckoutPage.tsx',
    'src/pages/PointsChargePage.tsx',
    'src/pages/AddressManagementPage.tsx',
    'src/pages/UserProfilePage.tsx',
    'src/pages/MyGroupBuysPage.tsx',
    'src/pages/UserGroupBuyCreatePage.tsx',
  ]
  it.each(MUST)('%s 의 로그인 유도가 복귀를 남긴다', (f) => {
    const mine = sites.filter(s => s.file === f)
    expect(mine.length, `${f} 에서 로그인 유도를 못 찾았다 — 이 시험이 낡았다`).toBeGreaterThan(0)
    for (const s of mine) expect(s.ok, `${f}:${s.line} ${s.text}`).toBe(true)
  })
})

describe('③ 헬퍼 — loginPathFromHere', () => {
  it('현재 경로를 쿼리에 실어 준다', async () => {
    const { loginPathFromHere } = await import('@/utils/login-return')
    expect(loginPathFromHere('/pass/2916')).toBe('/login?returnUrl=%2Fpass%2F2916')
    expect(loginPathFromHere('/checkout?order_id=5')).toBe('/login?returnUrl=%2Fcheckout')  // safeInternalPath 가 쿼리를 버린다
  })

  it("돌아갈 수 없는 곳이면 복귀를 안 붙인다 ('/' 가 저장값을 이기지 않게)", async () => {
    const { loginPathFromHere } = await import('@/utils/login-return')
    for (const bad of ['/', '/login', 'https://evil.example/x', '//evil.example']) {
      expect(loginPathFromHere(bad), bad).toBe('/login')
    }
  })
})
