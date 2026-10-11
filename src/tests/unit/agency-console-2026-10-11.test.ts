/**
 * 🏢 2026-10-11 에이전시 콘솔(1단계) — 계정·이메일 로그인·직원 초대의 불변식.
 *
 * 대표: *"에이전시가 대행사잖아. 에이전시로 통일하자."* · *"안 A로 하자."*
 * 결정: `docs/decisions/2026-10-11-agency-model-email-only.md` · 시안: `docs/design/agency-login-2026-10-11.md`
 *
 * ## 가장 중요한 하나 — 토큰 열쇠 분리
 * 공용 `requireAuth()` 는 `JWT_SECRET` 으로 서명된 토큰이면 종류를 안 가리고 `sub` 를 사용자 id 로 쓴다.
 * 에이전시 직원 토큰이 같은 열쇠로 서명되면 직원 3번이 소비자 users.id=3 으로 통한다. 그래서 열쇠를
 * 갈랐고, 여기서 **실제로 서명·검증해서** 서로 안 통하는지 잰다(문자열 검사가 아니다).
 *
 * ## 이 테스트가 못 막는 것
 * - D1 위에서의 실제 동작(동시 소비 경합·UNIQUE 인덱스). 소스의 CAS 조건만 고정한다.
 * - 메일이 실제로 도착하는지(Resend 등 외부) — 라이브에서만 판정된다.
 * - 화면이 보기 좋은지 — 그려서 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sign, verify } from 'hono/jwt'
import { stripComments } from '../helpers/source-text'
import { agencySigningKey, issueAgencyStaffToken, readAgencyClaims } from '@/features/agency-console/api/agency-session'
import { normalizeBusinessNumber, normalizeEmail } from '@/features/agency-console/api/agency-auth.routes'
import { safeAgencyReturn } from '@/pages/agency-console/agency-api'

const SECRET = 'test-secret-0123456789'
const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const AUTH = code('src/features/agency-console/api/agency-auth.routes.ts')
const STAFF = code('src/features/agency-console/api/agency-staff.routes.ts')
const SESSION = code('src/features/agency-console/api/agency-session.ts')

describe('① 토큰 열쇠가 소비자·셀러와 갈려 있다', () => {
  it('에이전시 토큰은 공용 열쇠로 검증되지 않는다', async () => {
    const { token } = await issueAgencyStaffToken(SECRET, { id: 3, agency_id: 7 })
    await expect(verify(token, SECRET, 'HS256')).rejects.toBeTruthy()
    const claims = await readAgencyClaims(token, SECRET)
    expect(claims?.sid).toBe(3)
    expect(claims?.aid).toBe(7)
  })

  it('에이전시 토큰에는 sub 가 없다 (공용 미들웨어가 사용자 id 로 오해할 자리가 없다)', async () => {
    const { token } = await issueAgencyStaffToken(SECRET, { id: 3, agency_id: 7 })
    const payload = await verify(token, agencySigningKey(SECRET), 'HS256') as Record<string, unknown>
    expect(payload.sub).toBeUndefined()
    expect(payload.type).toBeUndefined()
  })

  it('공용 열쇠로 서명한 소비자 토큰은 에이전시로 통하지 않는다', async () => {
    const now = Math.floor(Date.now() / 1000)
    const consumer = await sign({ sub: '3', type: 'user', iat: now, exp: now + 60 }, SECRET)
    expect(await readAgencyClaims(consumer, SECRET)).toBeNull()
    // 열쇠가 맞아도 종류(typ)가 다르면 거절한다.
    const wrongTyp = await sign({ typ: 'seller', aid: 7, sid: 3, iat: now, exp: now + 60 }, agencySigningKey(SECRET))
    expect(await readAgencyClaims(wrongTyp, SECRET)).toBeNull()
  })

  it('매 요청 DB 를 본다 — 내보낸 직원·정지된 에이전시·비밀번호 변경 전 토큰은 즉시 막힌다', () => {
    expect(SESSION).toMatch(/row\.status !== 'active'/)
    expect(SESSION).toMatch(/row\.agency_status !== 'active'/)
    expect(SESSION).toMatch(/claims\.iat < Number\(row\.tokens_valid_after/)
  })
})

describe('② 입력 정리', () => {
  it('이메일은 소문자·공백 제거', () => {
    expect(normalizeEmail('  Boss@Agency.CO.kr ')).toBe('boss@agency.co.kr')
    expect(normalizeEmail(42)).toBe('')
  })
  it('사업자등록번호는 숫자 10자리만', () => {
    expect(normalizeBusinessNumber('123-45-67890')).toBe('1234567890')
    expect(normalizeBusinessNumber('12345')).toBeNull()
  })
  it('로그인 뒤 돌아갈 곳은 콘솔 안쪽만', () => {
    expect(safeAgencyReturn('/agency')).toBe('/agency')
    expect(safeAgencyReturn('https://evil.example/agency')).toBe('/agency')
    expect(safeAgencyReturn('//evil.example')).toBe('/agency')
    expect(safeAgencyReturn('/seller')).toBe('/agency')
    expect(safeAgencyReturn('/agency/login')).toBe('/agency')
    expect(safeAgencyReturn('/agency-partner')).toBe('/agency')
  })
})

describe('③ 링크 토큰·로그인 방어', () => {
  it('링크 토큰은 해시로만 저장되고 원자적으로 한 번만 소비된다', () => {
    expect(AUTH).toMatch(/await hashToken\(raw\)/)
    expect(AUTH).toMatch(/UPDATE agency_tokens SET used_at = datetime\('now'\) WHERE id = \? AND used_at IS NULL/)
    expect(AUTH).toMatch(/meta\?\.changes \?\? 0\) === 0\) return \{ error: 'invalid' \}/)
  })

  it('없는 이메일에도 비밀번호 검증을 한 번 돈다 (응답 시간으로 가입 여부를 못 알게)', () => {
    expect(AUTH).toMatch(/verifyPassword\(password, DUMMY_PBKDF2_HASH\)/)
  })

  it('비밀번호를 바꾸면 그 전 로그인은 전부 끊긴다', () => {
    expect(AUTH).toMatch(/password_hash = \?, tokens_valid_after = \?/)
  })
})

describe('④ 직원 관리는 관리자만, 대표 계정은 못 뺀다', () => {
  it('초대·재발송·내보내기·정보수정은 adminOnly', () => {
    for (const route of ["'/staff/invite'", "'/staff/:id/resend'", "'/staff/:id/remove'", "'/account'"]) {
      const at = STAFF.indexOf(route)
      expect(at, route).toBeGreaterThan(0)
      expect(STAFF.slice(at, at + 120), route).toMatch(/requireAgencyStaff\(\{ adminOnly: true \}\)/)
    }
  })

  it('내보내기 UPDATE 자체에 is_owner = 0 · 같은 에이전시 조건이 있다', () => {
    expect(STAFF).toMatch(/WHERE id = \? AND agency_id = \? AND is_owner = 0/)
    expect(STAFF).toMatch(/status = 'removed', tokens_valid_after = \?/)
  })
})

describe('⑤ 손님 로그인과의 경계 (안 A)', () => {
  it('손님 로그인 화면에 에이전시 입구 한 줄이 있다', () => {
    const page = code('src/pages/LoginPage.tsx')
    expect(page).toMatch(/to="\/agency\/login"/)
  })

  it('손님 이메일 로그인에 에이전시 이메일을 넣으면 안내한다', () => {
    const auth = code('src/worker/routes/auth.routes.ts')
    expect(auth).toMatch(/if \(await isAgencyStaffEmail\(c\.env\.DB, email\)\) return c\.json\(AGENCY_ACCOUNT_HINT, 401\)/)
    const hint = code('src/features/agency-console/api/agency-hint.ts')
    expect(hint).toMatch(/FROM agency_staff WHERE LOWER\(email\) = LOWER\(\?\)/)
    expect(hint).toMatch(/code: 'AGENCY_ACCOUNT'/)
  })

  it('공용 axios 가 /agency 화면에서 소비자 401 로 로그인에 던지지 않는다 (가입·합류 화면 보호)', () => {
    const api = code('src/lib/api.ts')
    expect(api).not.toMatch(/localStorage\.getItem\('agency_token'\)\) window\.location\.href = '\/agency\/login'/)
  })
})
