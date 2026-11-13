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
    // 서버(카카오 복귀 safeRedirect)도 같은 화이트리스트 — 한쪽만 바꾸면 카카오 왕복에서 다시 사라진다
    expect(readFileSync('src/features/auth/api/kakao.routes.ts', 'utf8')).toMatch(/PRESERVED_QUERY_PARAMS = \[[^\]]*'via', 'qty'\][\s\S]{0,400}via: \/\^login\$\/, qty: /)
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
