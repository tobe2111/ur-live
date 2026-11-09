/**
 * 🔐 2026-11-09 보안 전수조사 6차 — 대표 *"계속 개선"*.
 *
 * 4차 가드(`security-hardening-2-…` 의 "hono verify 대신 verifyLogin")는 **이름을 바꿔 들여온 verify**
 * (`verify as honoVerify` · `verify as jwtVerify` · `verify as verifyJwt`)를 못 봤다. 그래서 셀러 PIN 화면의
 * 로그인 확인 · 유튜브 연결 · 로그인 상태 확인(`/api/auth/session`)이 옛 재발급·용도 토큰을 그대로 받고 있었다.
 * 이 시험은 **별칭까지** 찾아, 로그인 토큰이 아닌 것을 확인하는 호출만 파일별 개수로 허용한다.
 *
 * ## ⚠️ 못 보는 것
 * - `@tsndr/cloudflare-worker-jwt` 같은 다른 라이브러리로 확인하는 곳(별도 경로 — requireAuth 가 판정 함수를 쓴다).
 * - 허용된 호출이 *정말* 로그인 토큰이 아닌 것만 확인하는지(호출 개수만 고정한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { readCode } from '@/tests/helpers/source-text'

/** 파일 → hono verify 직접 호출 허용 개수(로그인 토큰이 아닌 것을 확인하는 곳만). */
const ALLOWED_CALLS: Record<string, number> = {
  'src/worker/utils/login-token-policy.ts': 1, // 판정 함수 자신
  'src/worker/utils/refresh-token-key.ts': 2, // 재발급 토큰(새 키 + 이행기 옛 키)
  'src/features/agency-console/api/agency-session.ts': 1, // 에이전시 좌석 키
  'src/features/marketing/api/ads-account.ts': 1, // 유어애즈 별도 키
  'src/features/auth/api/kakao.routes.ts': 1, // OAuth state
  'src/worker/routes/auth.routes.ts': 1, // 세션 확정 티켓(p=session_establish)
  'src/features/seller/api/seller-pin.routes.ts': 2, // PIN·카카오 확인 토큰(purpose) 자체
}

function honoVerifyCalls(src: string): number {
  const names: string[] = []
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'hono\/jwt'/g)) {
    for (const part of m[1].split(',')) {
      const mm = part.trim().match(/^verify(?:\s+as\s+(\w+))?$/)
      if (mm) names.push(mm[1] || 'verify')
    }
  }
  for (const m of src.matchAll(/const\s*\{\s*verify(?:\s*:\s*(\w+))?\s*\}\s*=\s*await import\('hono\/jwt'\)/g)) names.push(m[1] || 'verify')
  let n = (src.match(/import\('hono\/jwt'\)\.then\(\(?m\)?\s*=>\s*m\.verify\(/g) || []).length
  for (const name of names) n += (src.match(new RegExp(`(?<![\\w.])${name}\\(`, 'g')) || []).length
  return n
}

describe('① 로그인 토큰 확인은 별칭을 써도 verifyLogin 을 거친다', () => {
  it('hono verify 직접 호출은 허용 목록의 개수 이내', () => {
    const files = execSync('git grep -l "hono/jwt" -- src', { encoding: 'utf8' }).split('\n').filter((f) => f && !f.includes('/tests/'))
    const over: string[] = []
    for (const f of files) {
      const n = honoVerifyCalls(readFileSync(f, 'utf8'))
      if (n > (ALLOWED_CALLS[f] ?? 0)) over.push(`${f}: ${n} > ${ALLOWED_CALLS[f] ?? 0}`)
    }
    expect(over, '로그인 토큰을 직접 확인하면 utils/login-token-policy 의 verifyLogin 을 쓸 것').toEqual([])
  })
  it('별칭 탐지가 실제로 센다(자기 검사)', () => {
    expect(honoVerifyCalls("import { verify as jv } from 'hono/jwt'\nawait jv(t, s)")).toBe(1)
    expect(honoVerifyCalls("import { sign, verify } from 'hono/jwt'\nawait verify(t, s)\nx.verify(1)")).toBe(1)
  })
  it('세 곳이 verifyLogin 을 쓴다', () => {
    expect(readCode('src/features/seller/api/seller-pin.routes.ts')).toMatch(/const payload = await verifyLogin\(authorization\.substring\(7\)/)
    expect(readCode('src/features/youtube/api/youtube.routes.ts')).toMatch(/import \{ verifyLogin as honoVerify \} from '\.\.\/\.\.\/\.\.\/worker\/utils\/login-token-policy'/)
    expect(readCode('src/worker/routes/auth.routes.ts')).toMatch(/const p = await verifyLogin\(bearer, c\.env\.JWT_SECRET/)
  })
})

describe('② 사업자등록증 사진 판독(AI)은 크기·횟수 제한', () => {
  it('rateLimit + 10MB', () => {
    const code = readCode('src/features/seller/api/seller-profile.routes.ts')
    expect(code).toMatch(/post\('\/business-registration\/ocr-verify', rateLimit\(\{ action: 'seller_ocr_verify'/)
    expect(code).toMatch(/if \(file\.size > 10 \* 1024 \* 1024\) return/)
  })
})

describe('③ 카카오 장소 프록시는 쿼리 값을 검증한 뒤 주소에 붙인다', () => {
  it('size·category·좌표 검사', () => {
    const code = readCode('src/worker/routes/proxy.routes.ts')
    expect(code).not.toMatch(/c\.req\.query\('size'\) \|\| '15'/)
    expect(code.match(/kakaoSize\(c\.req\.query\('size'\)\)/g)?.length).toBe(2)
    expect(code).toMatch(/if \(!\/\^\[A-Z0-9\]\{3\}\$\/\.test\(category\)\)/)
    expect(code).toMatch(/!Number\.isFinite\(Number\(x\)\) \|\| !Number\.isFinite\(Number\(y\)\)/)
  })
})
