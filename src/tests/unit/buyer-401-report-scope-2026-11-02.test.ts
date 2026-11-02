/**
 * 2026-11-02 — Sentry `Buyer 401: Unauthorized` 는 **소비자 세션이 실제로 끝났을 때만** 보낸다.
 *
 * 사고: 대시보드(어드민·셀러·에이전시) 토큰만 있고 소비자 로그인은 없는 브라우저에서 홈(`/`)을 열면,
 *   소비자 API 의 401 이 `hasAnyAuth`(대시보드 토큰·user_type 도 센다)를 통과해 맨 아래 로그아웃 분기까지
 *   내려와 매번 에러를 보냈다(15분 사이 2건, 윈도우 크롬). 비로그인 손님과 같은 상황이라 보고할 일이 아니다.
 *
 * 이 시험이 못 보는 것: 인터셉터를 실제로 돌리지 않는다(소스 모양만 본다). 진짜 소비자 세션 만료 보고는
 *   그대로 남는다 — 그게 소음인지는 Sentry 빈도로 다시 판단할 것.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/lib/api.ts', 'utf8')

describe('Buyer 401 보고 범위', () => {
  it("'Buyer 401: Unauthorized' 보고는 소비자 세션 흔적이 있을 때만", () => {
    const idx = src.indexOf("new Error('Buyer 401: Unauthorized')")
    expect(idx).toBeGreaterThan(0)
    const before = src.slice(Math.max(0, idx - 200), idx)
    expect(before).toMatch(/if\s*\(\s*isSessionCookieUser\s*\)\s*\{\s*captureError\($/)
  })

  it('소비자 세션 판정은 user_id·session_login 으로만 한다(대시보드 토큰 제외)', () => {
    const m = src.match(/const isSessionCookieUser = ([^;]+);/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/session_login/)
    expect(m![1]).toMatch(/user_id/)
    expect(m![1]).not.toMatch(/admin_token|seller_token|agency_token|user_type/)
  })
})
