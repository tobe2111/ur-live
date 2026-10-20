/**
 * 🩸 이메일 가입이 라이브에서 **항상 500** 이던 결함 (2026-09-20 실측 — E5 계정 3개를 만들다 발견)
 *
 * 라이브 `users.id` 는 `INTEGER PRIMARY KEY AUTOINCREMENT` 다. `POST /api/auth/register` 가
 * `generateId()`(TEXT) 를 id 에 넣어 SQLite "datatype mismatch" → catch → 'Registration failed'.
 * 마지막 성공 가입이 2026-03-15 — 소비자 로그인이 카카오 전용이라 아무도 신고하지 않았다.
 *
 * 이 테스트가 못 보는 것: 실제 D1 에서 INSERT 가 통과하는지(그건 라이브 `POST /api/auth/register` 201 로 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stripComments } from '../helpers/source-text'

const SRC = stripComments(readFileSync('src/worker/routes/auth.routes.ts', 'utf8'))
const at = SRC.indexOf("authRouter.post('/register'")
const handler = SRC.slice(at, SRC.indexOf('authRouter.post(', at + 10))

describe('이메일 가입 INSERT — id 는 DB 가 준다', () => {
  it('핸들러가 존재한다', () => { expect(at).toBeGreaterThan(0); expect(handler.length).toBeGreaterThan(200) })
  it('users INSERT 컬럼 목록에 id 가 없다 (INTEGER AUTOINCREMENT 에 TEXT 를 넣으면 datatype mismatch)', () => {
    const m = handler.match(/INSERT INTO users \(([^)]*)\)/)
    expect(m, 'users INSERT 가 있어야 한다').toBeTruthy()
    const cols = m![1].split(',').map((c) => c.trim())
    expect(cols).not.toContain('id')
    expect(cols).toEqual(['email', 'password_hash', 'name', 'phone'])
  })
  it('userId 는 last_row_id 에서 읽고, 비면 500 으로 끝낸다 (빈 sub 로 토큰을 발급하지 않는다)', () => {
    expect(handler).toMatch(/const userId = String\(ins\.meta\?\.last_row_id \?\? ''\)/)
    expect(handler).toMatch(/if \(!userId\) \{\s*return c\.json\(\{ success: false, error: 'Registration failed' \}, 500\)/)
  })
  it('refresh_tokens INSERT 도 id 를 안 넣는다 (라이브 refresh_tokens.id 역시 INTEGER AUTOINCREMENT — 첫 수정 배포 후에도 500 이던 두 번째 자리)', () => {
    const m = handler.match(/INSERT INTO refresh_tokens \(([^)]*)\)/)
    expect(m, 'refresh_tokens INSERT 가 있어야 한다').toBeTruthy()
    expect(m![1].split(',').map((c) => c.trim())).toEqual(['user_id', 'token_hash', 'expires_at'])
    expect(handler).not.toMatch(/generateId\(\)/)
  })
})
