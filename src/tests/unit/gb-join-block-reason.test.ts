/**
 * 🛡️ 참여 자격 3가지(마감 / 종료·취소 / 바우처 만료)를 `group-buy.routes.ts` 에서
 * `gb-purchase-guards` 로 옮기면서(2026-09-01, 파일 크기 래칫) 조건이 그대로인지 못으로 박는다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 라우트가 이 함수를 **부르지 않게** 되는 것은 아래 배선 검사로만 본다
 *   (라우트를 실제로 실행하려면 D1 이 필요해 여기선 소스로 확인한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { groupBuyJoinBlockReason } from '@/features/group-buy/api/gb-purchase-guards'

const 어제 = new Date(Date.now() - 86400_000).toISOString()
const 내일 = new Date(Date.now() + 86400_000).toISOString()
const 모레 = new Date(Date.now() + 2 * 86400_000).toISOString()

describe('groupBuyJoinBlockReason', () => {
  it('마감이 지났으면 막는다', () => {
    expect(groupBuyJoinBlockReason({ group_buy_deadline: 어제 })).toBe('공동구매가 마감되었습니다')
  })
  it('종료·취소된 공구를 막는다', () => {
    expect(groupBuyJoinBlockReason({ group_buy_status: 'expired' })).toBe('종료된 공동구매입니다')
    expect(groupBuyJoinBlockReason({ group_buy_status: 'cancelled' })).toBe('종료된 공동구매입니다')
  })
  it('바우처가 공구 마감보다 먼저 죽으면 막는다', () => {
    expect(groupBuyJoinBlockReason({ group_buy_deadline: 모레, voucher_expiry: 내일 }))
      .toContain('바우처 만료일이 공구 마감 전')
  })
  it('마감 전 · 활성 · 바우처가 더 오래 살면 통과', () => {
    expect(groupBuyJoinBlockReason({ group_buy_deadline: 내일, group_buy_status: 'active', voucher_expiry: 모레 })).toBeNull()
    expect(groupBuyJoinBlockReason({})).toBeNull()
  })
  it('마감을 종료상태보다 먼저 본다(원래 순서 보존)', () => {
    // 둘 다 걸리는 상품에서 마감 문구가 나와야 한다 — 라우트 주석이 명시한 의도.
    expect(groupBuyJoinBlockReason({ group_buy_deadline: 어제, group_buy_status: 'expired' }))
      .toBe('공동구매가 마감되었습니다')
  })
  it('라우트가 실제로 이 판정을 쓴다', () => {
    const route = readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')
    expect(route).toContain('groupBuyJoinBlockReason(product)')
    // 내가 옮긴 블록의 고유 문구는 라우트에서 사라져야 한다(두 벌이 되면 갈린다).
    expect(route).not.toContain('바우처 만료일이 공구 마감 전')
    // 🔎 남아 있는 중복 1벌은 **선재**다: 같은 핸들러의 Toss(카드) 분기가 마감·종료 가드를
    //   자기 상품 조회로 따로 갖고 있다(바우처 만료 가드는 없다 — 집합이 다르다).
    //   이 PR 의 범위가 아니라 손대지 않았다. 합칠 때는 두 분기의 조건 집합 차이부터 확인할 것.
    expect(route.match(/error: '공동구매가 마감되었습니다'/g)).toHaveLength(1)
  })
})
