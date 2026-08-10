/**
 * 🏬 2026-08-10 상인회(몰) 일괄 크레딧 지급 — 배선 불변식.
 *
 * 돈이 오가는 자리다. 두 번 눌러서 두 번 지급되면 그건 그냥 손실이고, 배분 합계가 결제금액과
 * 어긋나면 마진 집계가 통째로 틀어진다(1단계가 `credit_transactions.price_paid` 합계를 매출로 쓴다).
 *
 * ⚠️ 이 테스트가 **못** 막는 것: D1 배치가 실제로 원자적인지, 실발송이 되는지.
 *   발송은 ALIGO 3종 키가 설정돼야 나간다 — 지금은 미설정이라 판매·회계만 성립한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const api = readFileSync('src/features/admin/api/admin-streams.routes.ts', 'utf8')
const code = api.replace(/\/\/[^\n]*/g, '') // 주석에만 남아도 통과하는 함정 차단
const grant = code.slice(code.indexOf("post('/alimtalk/grant'"), code.indexOf("get('/alimtalk/accounts'"))

describe('🔴 멱등 — 같은 참조로 두 번 지급되지 않는다', () => {
  it('지급 전에 payment_key 로 기존 지급을 조회한다', () => {
    expect(grant).toContain('FROM credit_transactions WHERE payment_key = ?')
  })
  it('중복이면 아무것도 쓰지 않고 반환한다(already)', () => {
    expect(grant).toMatch(/if \(dupe\)[\s\S]{0,120}already: true/)
    // dupe 반환이 INSERT 보다 **앞**에 있어야 실제로 막힌다.
    expect(grant.indexOf('already: true')).toBeLessThan(grant.indexOf('INSERT INTO seller_credits'))
  })
  it('참조(grant_ref)가 없으면 지급을 거부한다 — 지급은 항상 문서와 짝지어진다', () => {
    expect(grant).toMatch(/if \(!ref\) return/)
  })
})

describe('🔴 배분 — 합계가 결제금액과 정확히 일치한다', () => {
  it('나머지를 첫 매장에 몰아 총합을 보존한다', () => {
    expect(grant).toContain('const remainder = totalPaid - per * sellerIds.length')
    expect(grant).toMatch(/i === 0 \? remainder : 0/)
  })
  it('배분 로직 자체 검증 — 나눠떨어지지 않아도 합계 보존', () => {
    // 서버와 동일한 식. 100,000원을 3개 매장에 → 33,333/33,333/33,333 + 나머지 1
    const split = (total: number, n: number) => {
      const per = Math.floor(total / n)
      const remainder = total - per * n
      return Array.from({ length: n }, (_, i) => per + (i === 0 ? remainder : 0))
    }
    for (const [total, n] of [[100_000, 3], [1_000_000, 7], [0, 5], [999, 4]] as [number, number][]) {
      expect(split(total, n).reduce((a, b) => a + b, 0)).toBe(total)
    }
  })
})

describe('대상 선정 — 몰 스코프 + 승인 매장만', () => {
  it('몰 소속 승인 매장을 고른다', () => {
    expect(grant).toContain("COALESCE(mall_id, 1) = ?")
    expect(grant).toContain("status = 'approved'")
  })
  it('대상이 0명이면 거부한다(조용한 no-op 금지)', () => {
    expect(grant).toMatch(/sellerIds\.length === 0\) return c\.json\(\{ success: false/)
  })
})

describe('잔액 증액은 누적이다 — 덮어쓰기가 아니다', () => {
  it('ON CONFLICT 에서 balance 를 더한다', () => {
    expect(grant).toContain('balance = balance + excluded.balance')
    expect(grant).not.toMatch(/SET balance = \?/)
  })
})
