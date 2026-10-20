/**
 * 🤖 AI 비서 검색 창구 (2026-10-19 · 결재 docs/decisions/2026-10-19-ai-agent-channel.md).
 *
 * 이 시험이 못 보는 것: 라이브 결과 · AI 비서가 실제로 이 창구를 쓰는지 · 엣지 캐시 동작.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseAgentQuery, toAgentItem, AGENT_SEARCH_MAX, AGENT_SEARCH_GATE } from '@/shared/agent-search'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 입력', () => {
  it('검색어도 지역도 없으면 null — 전체 목록을 안 준다', () => {
    expect(parseAgentQuery({})).toBeNull()
    expect(parseAgentQuery({ q: '   ', region: 'a' })).toBeNull()
  })
  it('한 번에 최대 10건', () => {
    expect(parseAgentQuery({ q: '돈가스', limit: '999' })!.limit).toBe(AGENT_SEARCH_MAX)
    expect(parseAgentQuery({ q: '돈가스', limit: 'abc' })!.limit).toBe(AGENT_SEARCH_MAX)
    expect(parseAgentQuery({ q: '돈가스', limit: '3' })!.limit).toBe(3)
  })
  it('LIKE 와일드카드를 지운다 (% 하나로 전체를 긁지 못하게)', () => {
    expect(parseAgentQuery({ q: '%' })).toBeNull()
    expect(parseAgentQuery({ q: '돈%가_스' })!.q).toBe('돈 가 스')
  })
  it('카테고리는 허용 넷만', () => {
    expect(parseAgentQuery({ q: 'a', category: 'meal' })!.category).toBe('meal_voucher')
    expect(parseAgentQuery({ q: 'a', category: 'shopping' })!.category).toBeNull()
  })
})

describe('② 응답 한 줄', () => {
  const row = { id: 2919, name: '닭도리탕', restaurant_name: '달빛한스푼', restaurant_address: '서울 서초구 방배로 1', category: 'meal_voucher', price: 31000, original_price: 35000, discount_rate: 0, deal_only: 0 }
  it('우리 상세 주소를 건넨다', () => {
    const it2 = toAgentItem(row, 'https://urdeal.kr')!
    expect(it2.url).toBe('https://urdeal.kr/pass/2919')
    expect(it2.discount_percent).toBe(11)
    expect(it2.area).toBe('서울 서초구')
    expect(it2.currency).toBe('KRW')
  })
  it('교환권·가격 없음은 안 건넨다', () => {
    expect(toAgentItem({ ...row, deal_only: 1 }, 'https://urdeal.kr')?.url).not.toMatch(/\/pass\//)
    expect(toAgentItem({ ...row, price: 0 }, 'https://urdeal.kr')).toBeNull()
  })
})

describe('③ 서버 배선', () => {
  const src = read('src/worker/routes/agent-search.routes.ts')
  it('게이트가 꺼져 있으면 404', () => {
    expect(src).toMatch(/settingOn\(DB, AGENT_SEARCH_GATE\)\)\) return c\.json\(\{ success: false, error: 'NOT_FOUND' \}, 404\)/)
    expect(AGENT_SEARCH_GATE).toBe('agent_search_enabled')
  })
  it('데모·도매 원본·미승인 매장·교환권을 뺀다', () => {
    // 2026-10-20: 같은 파일에 결제 링크 라우트가 생겨 같은 조건을 쓴다 — 파일 전체로 보면 한쪽이 빠져도 통과한다.
    const a = src.indexOf("agentSearchRoutes.get('/search'"), b = src.indexOf("agentSearchRoutes.get('/checkout'")
    const search = src.slice(a, b > a ? b : undefined)
    expect(a, '검색 라우트를 못 찾았다').toBeGreaterThan(-1)
    expect(search).toMatch(/AND NOT \$\{demoSlugSql\('p'\)\}/)
    expect(search).toMatch(/AND \$\{consumerVisibleProductSql\('p'\)\}/)
    expect(search).toMatch(/AND \$\{approvedSellerProductSql\('p'\)\}/)
    expect(search).toMatch(/COALESCE\(p\.deal_only, 0\) = 0/)
  })
  it('결제·주문 경로를 건드리지 않는다', () => {
    expect(src).not.toMatch(/INSERT|UPDATE|DELETE|confirmTossPayment|adjustUserPoints/)
  })
  it('public-utility 아래에 붙는다 (worker/index.ts 무접촉)', () => {
    expect(read('src/worker/routes/public-utility.routes.ts')).toMatch(/publicUtilityRoutes\.route\('\/api\/agent', agentSearchRoutes\)/)
  })
  it('게이트가 세 곳에 등록돼 있다', () => {
    expect(read('src/worker/utils/platform-settings-validation.ts')).toMatch(/agent_search_enabled: boolStr/)
    expect(read('src/features/admin/api/admin-system-monitoring.routes.ts')).toMatch(/key: 'agent_search_enabled'.*default_value: 'false'.*staging_ref: 'S-AGENT'/)
    expect(read('src/pages/AdminPlatformSettingsPage.tsx')).toMatch(/key: 'agent_search_enabled'/)
    expect(read('docs/STAGING_CHECKLIST.md')).toMatch(/\*\*S-AGENT\*\*/)
  })
})
