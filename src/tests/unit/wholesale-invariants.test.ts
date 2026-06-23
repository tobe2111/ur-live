import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { wholesaleAuthSeg } from '@/hooks/queries/useWholesale'

// 🤖 2026-06-19 자동 QA(배포 전): 도매몰 인증/에러처리 불변식 회귀 방지.
//   사람이 수동 QA 안 해도, 핵심 수정이 되돌려지면 CI 가 빨강으로 잡도록.

describe('wholesaleAuthSeg — 게스트/로그인 캐시 분리 불변식', () => {
  beforeEach(() => { try { localStorage.removeItem('seller_token') } catch { /* jsdom */ } })

  it("로그인(seller_token 있음) → 'in'", () => {
    localStorage.setItem('seller_token', 'tok')
    expect(wholesaleAuthSeg()).toBe('in')
  })
  it("비로그인(토큰 없음) → 'out'", () => {
    localStorage.removeItem('seller_token')
    expect(wholesaleAuthSeg()).toBe('out')
  })
  it("게스트와 로그인 접미사가 달라야 한다(캐시 교차오염 방지의 핵심)", () => {
    localStorage.removeItem('seller_token'); const guest = wholesaleAuthSeg()
    localStorage.setItem('seller_token', 'tok'); const authed = wholesaleAuthSeg()
    expect(guest).not.toBe(authed)
  })
})

describe('도매 머니/데이터 훅 — 에러 삼킴 회귀 방지 (정적 검사)', () => {
  // 배경: .catch(()=>빈값) 으로 네트워크/5xx 를 '성공한 빈 결과'로 삼키면 → '주문/상품 없음'·'잔액 ₩0' 오표시 +
  //   전역 retry 무력화. 아래 머니/트러스트 훅은 절대 에러를 삼키면 안 됨(2026-06-19 수정).
  const src = readFileSync(resolve(process.cwd(), 'src/hooks/queries/useWholesale.ts'), 'utf8')
  const moneyHooks = [
    'useWholesaleOrders',
    'useWholesaleStatement',
    'useWholesaleProduct',
    'useWholesaleDeposit',
    'useWholesaleChargeRequests',
  ]
  for (const name of moneyHooks) {
    it(`${name} 는 .catch(()=>...) 로 에러를 삼키지 않는다`, () => {
      const start = src.indexOf(`export function ${name}`)
      expect(start).toBeGreaterThan(-1)
      const after = src.slice(start + `export function ${name}`.length)
      const nextExport = after.indexOf('\nexport function ')
      const body = nextExport === -1 ? after : after.slice(0, nextExport)
      // 에러 삼킴 패턴(.catch(() => ) 가 본문에 없어야 함.
      expect(body).not.toMatch(/\.catch\(\s*\(\s*\)\s*=>/)
    })
  }

  it('useWholesaleMall 은 의도적 폴백 유지(헤더 빈값 방지) — 예외', () => {
    // 반례 가드: mall 브랜딩은 절대 비면 안 되므로 폴백 유지가 정상. 위 목록에 포함되면 안 됨.
    expect(moneyHooks).not.toContain('useWholesaleMall')
  })
})
