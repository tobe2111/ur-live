/**
 * 🔐 로그인 벽에서 돌아오면 고르던 수량으로 구매 창이 다시 열린다 (2026-11-13 대표 "응, 고쳐줘")
 *
 * 실측: 30일 이용권 화면 로그인 벽 ~7명 → 결제 화면 1명. 돌아온 손님이 [구매하기] 를 또 누르고 수량을 또 골라야 했다.
 * ⚠️ 못 보는 것: 실제 카카오 왕복(서버 콜백이 `?via=login&qty=N` 을 보존하는지 — bootstrap 은 login 관련 키만 지운다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readLoginResume } from '@/pages/group-buy/useAgentHandoff'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { __safeRedirectForTest } from '@/features/auth/api/kakao.routes'
import { stripComments } from '../helpers/source-text'

describe('🧭 주소 꼬리 규칙은 한 파일 — 프론트·워커가 같이 쓴다(대표 "영구적으로 해결해")', () => {
  it('두 곳이 공용 파일을 import 하고, 자기 복사본(목록·차단 경로)을 두지 않는다', () => {
    const k = stripComments(readFileSync('src/features/auth/api/kakao.routes.ts', 'utf8'))
    const f = stripComments(readFileSync('src/utils/safe-internal-path.ts', 'utf8'))
    expect(k).toContain("from '../../../shared/login-return-query'")
    expect(f).toContain("from '@/shared/login-return-query'")
    for (const src of [k, f]) {
      expect(src).not.toMatch(/PRESERVED_QUERY_PARAMS\s*=/)
      expect(src).not.toMatch(/'\/seller\/login',\s*'\/admin\/login'/)
    }
  })
  it('카카오 복귀(워커)와 이메일 복귀(프론트)가 같은 답을 낸다', () => {
    const cases = ['/pass/2919?via=login&qty=2', '/store/find?code=AB12CD34', '/x?ref=77&error=a', '/login?via=login', '//evil.com', '/group-buy/confirm-payment?productId=9&qty=1']
    for (const c of cases) expect(__safeRedirectForTest(c), c).toBe(safeInternalPath(c, '/'))
  })
})

describe('로그인 복귀 → 구매 창', () => {
  it('표식을 읽는다 · 수량은 1~100 · 표식 없으면 null', () => {
    expect(readLoginResume('?via=login&qty=3')).toEqual({ qty: 3 })
    expect(readLoginResume('?via=login&qty=abc')).toEqual({ qty: 1 })
    expect(readLoginResume('?via=login&qty=9999')).toEqual({ qty: 100 })
    expect(readLoginResume('?qty=3')).toBeNull()
    expect(readLoginResume('?via=agent&qty=3')).toBeNull()
  })
  it('이용권 화면이 로그인 전에 그 주소를 저장하고, 복귀 주소 검사가 쿼리를 지운지 않는다', () => {
    expect(readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf8')).toContain("localStorage.setItem('loginReturnUrl', `${window.location.pathname}?via=login&qty=${quantity}`)")
    expect(safeInternalPath('/pass/2919?via=login&qty=2', '/')).toBe('/pass/2919?via=login&qty=2')
    expect(safeInternalPath('/pass/2919?via=agent&qty=0', '/')).toBe('/pass/2919') // 다른 값은 버린다
    expect(safeInternalPath('/group-buy/confirm-payment?productId=9&qty=1', '/')).toBe('/group-buy/confirm-payment') // 로그인 복귀가 아니면 qty 도 종전대로 버린다
  })
  it('구매 창 훅이 로그인 복귀도 받고, 비서 문구는 비서 링크에만', () => {
    const s = readFileSync('src/pages/group-buy/useAgentHandoff.ts', 'utf8')
    expect(s).toContain('const h = readAgentHandoff(window.location.search) ?? login')
    expect(s).toContain('setFromAgent(!login)')
  })
  it('로그인 콜백 정리가 via·qty 를 지우지 않는다', () => {
    const b = readFileSync('src/utils/auth-callback-bootstrap.ts', 'utf8')
    const del = b.match(/for \(const k of \[([^\]]+)\]\) urlParams\.delete\(k\)/g) ?? []
    expect(del.length).toBeGreaterThan(0)
    for (const d of del) { expect(d).not.toMatch(/'via'|'qty'/) }
  })
})
