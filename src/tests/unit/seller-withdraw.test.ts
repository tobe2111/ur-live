/**
 * 🚪 셀러 탈퇴 불변식 (2026-08-26 대표 — "셀러도 탈퇴를 할 수 있어야 하잖아")
 *
 * 지키는 것 — 전부 **돈·소비자 안전**:
 *   W1 미사용 이용권 / 미처리 주문 / 미정산 잔액 중 하나라도 있으면 차단.
 *      (특히 미사용 이용권: 이미 결제한 소비자가 못 쓰게 되는 것을 막는다)
 *   W2 화면이 막아도 **서버가 최종 방어선** — POST 가 blockers 를 재검사해 409.
 *   W3 confirm !== true 면 실행 거부(오폭 방지).
 *   W4 '삭제'가 아니라 soft-close — sellers 행 DELETE 금지(주문·이용권 이력 고아화 방지),
 *      status 는 CHECK 허용값 'suspended'('closed' 는 SqlError — 2026-08-20 실사고).
 *   W5 세션 무효화 — 이미 발급된 seller_token 이 만료 전까지 살아 있다.
 *
 * 이 테스트가 못 막는 것: 실제 D1 UPDATE 결과(라이브 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isWithdrawBlocked, type WithdrawBlockers } from '@/features/seller/api/seller-withdraw.routes'

const read = (p: string) => readFileSync(p, 'utf-8')
const ROUTES = 'src/features/seller/api/seller-withdraw.routes.ts'
const clean: WithdrawBlockers = { pending_orders: 0, unused_vouchers: 0, unsettled_krw: 0, active_products: 3 }

describe('W1 차단 판정', () => {
  it('전부 0 이면 탈퇴 가능 (활성 상품은 차단 사유가 아니다 — 탈퇴가 내려 주면 된다)', () => {
    expect(isWithdrawBlocked(clean)).toBe(false)
  })
  it('미사용 이용권 1건이면 차단 — 결제한 소비자를 버리고 나갈 수 없다', () => {
    expect(isWithdrawBlocked({ ...clean, unused_vouchers: 1 })).toBe(true)
  })
  it('미처리 주문·미정산 잔액도 각각 차단', () => {
    expect(isWithdrawBlocked({ ...clean, pending_orders: 1 })).toBe(true)
    expect(isWithdrawBlocked({ ...clean, unsettled_krw: 1 })).toBe(true)
  })
})

describe('W2~W5 실행 경로 계약', () => {
  const s = read(ROUTES)
  const post = s.slice(s.indexOf("app.post('/account/withdraw'"))

  it('W2 서버가 blockers 를 재검사하고 409 로 거부한다', () => {
    // ⚠️ toContain 은 `false && isWithdrawBlocked(...)` 같은 무력화를 못 잡는다(실제로 통과했다).
    //   조건문 자체를 고정한다 — 조건이 조금이라도 바뀌면 빨강.
    expect(post, '서버 재검사가 빠지면 화면을 우회한 요청이 통과한다').toMatch(/\n\s*if \(isWithdrawBlocked\(blockers\)\) \{\n/)
    expect(post).toContain('WITHDRAW_BLOCKED')
    // 재검사가 파괴적 UPDATE 보다 먼저여야 한다.
    expect(post.indexOf('isWithdrawBlocked')).toBeLessThan(post.indexOf('UPDATE products SET is_active = 0'))
  })

  it('W3 confirm 없이는 실행되지 않는다', () => {
    expect(post).toMatch(/\n\s*if \(body\.confirm !== true\) \{\n/)
    expect(post.indexOf('body.confirm !== true')).toBeLessThan(post.indexOf('UPDATE products SET is_active = 0'))
  })

  it('W4 soft-close — sellers 행을 지우지 않고 suspended 로만 내린다', () => {
    expect(s, 'sellers DELETE 는 주문·이용권 이력을 고아로 만든다').not.toMatch(/DELETE\s+FROM\s+sellers/i)
    expect(s, "status CHECK 는 'closed' 를 거부한다(SqlError)").not.toMatch(/status\s*=\s*'closed'/)
    expect(post).toContain("SET status = 'suspended'")
  })

  it('W5 세션 무효화 + 위임 회수', () => {
    expect(post, '토큰이 살아 있으면 탈퇴 후에도 대시보드에 들어온다').toContain('startDashboardSession')
    expect(post, '운영자 권한이 남으면 정지된 매장에 계속 들어온다').toContain('seller_operators SET revoked_at')
  })

  it('탈퇴는 셀러 좌석 인증 뒤에만 — 남의 매장을 닫을 수 없다', () => {
    expect(post).toContain('requireSellerSeat(c)')
    expect(post.indexOf('requireSellerSeat')).toBeLessThan(post.indexOf('UPDATE products SET is_active = 0'))
  })
})
