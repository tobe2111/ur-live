/**
 * 🛒 AI 비서 결제 넘겨받기 (2026-10-20 대표 *"4번도 일단은 하자. 가장 이상적으로."*).
 *
 * AI 는 결제하지 않는다 — 금액과 **결제 링크**를 건네고, 손님이 링크를 열면 구매 창이 그 수량으로 열린다.
 * 지키는 것:
 *   ① 수량은 1 이상·상한 이하로만 (링크를 손으로 고쳐도 상한을 못 넘는다)
 *   ② 숙소 링크엔 수량을 안 싣는다 (날짜·객실을 골라야 한다)
 *   ③ 상세 페이지는 표식(`via=agent`)이 있을 때만 반응한다
 *   ④ 라우트: 두 게이트를 다 읽고, 검색과 **같은 조건**(활성·승인·데모 제외·교환권 제외)으로만 링크를 준다
 *   ⑤ 라우트: 결제·주문·원장 코드를 부르지 않는다 (머니 경로 무접촉)
 *   ⑥ 화면: 창을 열고 수량을 넣을 뿐 결제(onJoin)를 스스로 부르지 않는다 · 주인·판매 전엔 안 연다
 *   ⑦ llms.txt: 두 게이트가 다 켜져 있을 때만 적는다
 * ⚠️ 못 보는 것: 실제 손님이 링크에서 결제까지 가는지(실결제) · AI 가 이 주소를 쓰는지(외부 판정).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { clampAgentQty, agentCheckoutUrl, readAgentHandoff, AGENT_CHECKOUT_PATH } from '@/shared/agent-checkout'
import { buildLlmsTxt } from '@/shared/seo/llms-txt'
import { useAgentHandoff } from '@/pages/group-buy/useAgentHandoff'
import { readCode } from '../helpers/source-text'

const O = 'https://urdeal.kr'

describe('AI 비서 결제 넘겨받기 — 규칙', () => {
  it('① 수량은 1..상한', () => {
    expect(clampAgentQty('3', 5)).toBe(3)
    expect(clampAgentQty('99', 5)).toBe(5)
    expect(clampAgentQty('0', 5)).toBe(1)
    expect(clampAgentQty('-4', 5)).toBe(1)
    expect(clampAgentQty('abc', 5)).toBe(1)
    expect(clampAgentQty(undefined, 5)).toBe(1)
    expect(clampAgentQty('2.9', 5)).toBe(2)
  })

  it('② 이용권 링크엔 수량·표식, 숙소 링크엔 안 싣는다', () => {
    expect(agentCheckoutUrl(O, '/pass/2919', 2)).toBe(`${O}/pass/2919?qty=2&via=agent`)
    expect(agentCheckoutUrl(`${O}/`, '/stays/2887', 3)).toBe(`${O}/stays/2887`)
  })

  it('③ 표식이 있을 때만 읽는다', () => {
    expect(readAgentHandoff('?qty=2&via=agent')).toEqual({ qty: 2 })
    expect(readAgentHandoff('?qty=2')).toBeNull()
    expect(readAgentHandoff('?via=agent')).toEqual({ qty: 1 })
    expect(readAgentHandoff('?via=agent&qty=-3')).toEqual({ qty: 1 })
  })
})

describe('AI 비서 결제 넘겨받기 — 라우트', () => {
  const src = readCode('src/worker/routes/agent-search.routes.ts')
  const body = src.slice(src.indexOf("agentSearchRoutes.get('/checkout'"))

  it('④ 두 게이트 · 검색과 같은 조건', () => {
    expect(body.length, '라우트를 못 찾았다').toBeGreaterThan(500)
    expect(body).toMatch(/settingOn\(DB,\s*AGENT_SEARCH_GATE\)/)
    expect(body).toMatch(/settingOn\(DB,\s*AGENT_CHECKOUT_GATE\)/)
    expect(body).toMatch(/if \(!searchOn \|\| !checkoutOn\)/)
    for (const frag of [
      "p.is_active = 1 AND p.group_buy_status = 'active'",
      'COALESCE(p.deal_only, 0) = 0',
      '${consumerVisibleProductSql(\'p\')}',
      '${approvedSellerProductSql(\'p\')}',
      'NOT ${demoSlugSql(\'p\')}',
    ]) expect(body).toContain(frag)
    expect(body).toMatch(/clampAgentQty\(c\.req\.query\('qty'\),\s*cap\)/)
    expect(body).toMatch(/resolveQtyCap\(meta\?\.max_per_person,\s*await getPlatformQtyCap\(DB\)\)/)
    expect(body).toMatch(/meta\?\.prelaunch === '1'/)
  })

  it('⑤ 결제·주문·원장 코드를 부르지 않는다', () => {
    for (const bad of [/confirmTossPayment/, /INSERT INTO orders/i, /adjustUserPoints/, /ledger/i, /\/join/]) {
      expect(src).not.toMatch(bad)
    }
  })

  it('게이트가 저장 허용·설정 화면·운영 게이트표 세 곳에 등록돼 있다', () => {
    expect(readCode('src/worker/utils/platform-settings-validation.ts')).toMatch(/agent_checkout_enabled: boolStr/)
    expect(readCode('src/pages/AdminPlatformSettingsPage.tsx')).toMatch(/key: 'agent_checkout_enabled'/)
    expect(readCode('src/features/admin/api/admin-system-monitoring.routes.ts')).toMatch(/key: 'agent_checkout_enabled'.*default_value: 'false'/)
  })

  it('주소 = 실제 마운트', () => {
    const util = readCode('src/worker/routes/public-utility.routes.ts')
    const mount = util.match(/publicUtilityRoutes\.route\('([^']+)',\s*agentSearchRoutes\)/)?.[1]
    expect(`${mount}/checkout`).toBe(AGENT_CHECKOUT_PATH)
  })
})

describe('AI 비서 결제 넘겨받기 — 화면', () => {
  function run(search: string, ready: boolean, maxQty = 5) {
    // 테스트 setup 이 window.location 을 모형으로 바꿔 둔다 — 직접 채운다.
    Object.assign(window.location, { search, pathname: '/pass/2919', hash: '', href: `http://localhost:5173/pass/2919${search}` })
    const rs = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
    const setQuantity = vi.fn()
    const setOpen = vi.fn()
    const r = renderHook(() => useAgentHandoff({ ready, maxQty, setQuantity, setOpen }))
    return { setQuantity, setOpen, r, rs }
  }

  it('⑥ 표식 있으면 창을 열고 수량을 상한 안으로 넣는다 · 주소에서 표식을 지운다', () => {
    const { setQuantity, setOpen, r, rs } = run('?qty=9&via=agent', true, 4)
    expect(setOpen).toHaveBeenCalledWith(true)
    const fn = setQuantity.mock.calls[0][0] as (q: number) => number
    expect(fn(1)).toBe(4)
    expect(r.result.current).toBe(true)
    expect(rs.mock.calls[0]?.slice(1)).toEqual(['', '/pass/2919'])
  })

  it('⑥ 살 수 없는 상태(주인·판매 전·품절)면 안 연다', () => {
    const { setQuantity, setOpen } = run('?qty=2&via=agent', false)
    expect(setOpen).not.toHaveBeenCalled()
    expect(setQuantity).not.toHaveBeenCalled()
  })

  it('⑥ 표식이 없으면 아무것도 안 한다', () => {
    const { setOpen } = run('?qty=2', true)
    expect(setOpen).not.toHaveBeenCalled()
  })

  it('⑥ 결제를 스스로 시작하지 않는다 + 바가 준비 조건을 건다', () => {
    const hook = readCode('src/pages/group-buy/useAgentHandoff.ts')
    expect(hook).not.toMatch(/onJoin|requestPayment|\/join/)
    const bar = readCode('src/pages/group-buy/DealBottomBar.tsx')
    expect(bar).toMatch(/useAgentHandoff\(\{\s*ready:\s*isJoinable && buyable && !isPrelaunch && !isOwner/)
  })
})

describe('AI 비서 결제 넘겨받기 — llms.txt', () => {
  it('⑦ 두 게이트가 다 켜져 있을 때만 적는다', () => {
    expect(buildLlmsTxt(O, { agentSearch: true, agentCheckout: true })).toContain(`${O}${AGENT_CHECKOUT_PATH}?id=`)
    for (const opts of [{ agentSearch: true }, { agentSearch: false, agentCheckout: true }, {}]) {
      expect(buildLlmsTxt(O, opts)).not.toContain(AGENT_CHECKOUT_PATH)
    }
  })
})
