/**
 * 🛡️ 참여 자격 판정 — **마감은 더 이상 막지 않는다.**
 *
 * 🗓️ 2026-09-04 대표 확정: *"마감 개념은 없어. 결제 이후 유저가 이용권을 쓸 수는 있어야 하잖아."*
 *
 * 그 전까지 이 함수는 세 가지를 막았다(마감 / 종료·취소 / 바우처가 마감보다 먼저 죽음).
 * 그중 **마감에 기댄 둘을 없앴다.** 그대로 뒀다면 라이브에서 이런 일이 났다:
 *
 *   · 이용권 등록 폼이 마감을 **"지금부터 7일 뒤"로 자동 프리필**했다(`defaultDeadline`).
 *     셀러가 의도한 적 없는 값이다.
 *   · 그 날짜가 지나면 이 함수가 400 을 냈고, cron 은 상태를 'expired' 로 뒤집었다.
 *   · ⇒ **그 폼으로 만든 모든 상품이 7일 뒤 안내 없이 조용히 안 팔렸다.**
 *     실증: 유일한 실제 상품 2888 은 09-03 생성 · 마감 09-10 — 정확히 +7일.
 *
 * ⚠️ 남긴 것: 상태(expired/cancelled) 차단. 그건 마감이 아니라 **사람이 내린 종료**다.
 * ⚠️ 이 테스트가 못 막는 것: 라우트가 이 함수를 **부르지 않게** 되는 것은 아래 배선 검사로만 본다
 *   (라우트를 실제로 실행하려면 D1 이 필요해 여기선 소스로 확인한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { groupBuyJoinBlockReason } from '@/features/group-buy/api/gb-purchase-guards'

const 어제 = new Date(Date.now() - 86400_000).toISOString()
const 내일 = new Date(Date.now() + 86400_000).toISOString()
const 모레 = new Date(Date.now() + 2 * 86400_000).toISOString()

describe('groupBuyJoinBlockReason — 마감은 막지 않는다', () => {
  it('마감이 지나도 통과한다 (종전엔 막았다)', () => {
    expect(groupBuyJoinBlockReason({ group_buy_deadline: 어제 })).toBeNull()
  })
  it('바우처가 마감보다 먼저 죽어도 통과한다 (마감이 아무것도 안 막으므로 그 비교는 근거를 잃었다)', () => {
    expect(groupBuyJoinBlockReason({ group_buy_deadline: 모레, voucher_expiry: 내일 })).toBeNull()
  })
  it('사람이 내린 종료·취소는 계속 막는다', () => {
    expect(groupBuyJoinBlockReason({ group_buy_status: 'expired' })).toBe('종료된 공동구매입니다')
    expect(groupBuyJoinBlockReason({ group_buy_status: 'cancelled' })).toBe('종료된 공동구매입니다')
  })
  it('마감이 지났어도 상태가 살아 있으면 판다', () => {
    expect(groupBuyJoinBlockReason({ group_buy_deadline: 어제, group_buy_status: 'active' })).toBeNull()
  })
  it('아무 값도 없으면 통과', () => {
    expect(groupBuyJoinBlockReason({})).toBeNull()
  })

  it('라우트가 실제로 이 판정을 쓴다', () => {
    const route = readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')
    expect(route).toContain('groupBuyJoinBlockReason(product)')
    // 마감 차단 문구는 **양쪽 분기 모두** 사라져야 한다. 종전엔 카드(Toss) 분기가 자기 사본을
    // 갖고 있어 1벌이 남아 있었다 — 그 사본까지 지웠으므로 이제 0 이다.
    expect(route).not.toContain("error: '공동구매가 마감되었습니다'")
    expect(route).not.toContain('바우처 만료일이 공구 마감 전')
  })

  it('cron 이 마감으로 상품을 만료시키지 않는다 — 안 지우면 상태를 바꿔 같은 차단을 우회로 만든다', () => {
    const cron = readFileSync('src/worker/cron/scheduled-cleanup.ts', 'utf8')
    const code = cron.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/group_buy_deadline/)
    expect(code).not.toMatch(/SET group_buy_status = 'expired'/)
  })

  it('이용권 등록 폼이 마감을 자동으로 채우지 않는다 (근본 원인)', () => {
    const form = readFileSync('src/pages/seller-meal-voucher/voucher-form.ts', 'utf8')
    const code = form.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')
    expect(code).not.toMatch(/7 \* 24 \* 3600/)   // "+7일" 프리필
    expect(code).toMatch(/defaultDeadline\(\): string \{\s*return ''/)
  })
})
