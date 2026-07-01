import { describe, it, expect, vi, afterEach } from 'vitest'
import { updateCampaignStatus, updateCampaignBudget, addNegativeKeywords, BUDGET_MIN, BUDGET_MAX } from '@/features/marketing/api/searchad-client'

/**
 * 🆕 2026-06-30 유어애즈 검색광고 WRITE(캠페인 제어·제외키워드) — fetch 스텁으로 검증.
 *   서명 헤더/PUT·POST 경로/예산 하드캡/개수 상한 등 안전장치 잠금(실호출 없이).
 */
type Captured = { url: string; method: string; body: string | undefined }
function stub(status = 200, json: unknown = {}): Captured[] {
  const calls: Captured[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { method?: string; body?: string }) => {
    calls.push({ url: String(url), method: init?.method || 'GET', body: init?.body })
    return { ok: status < 400, status, json: async () => json }
  }))
  return calls
}
afterEach(() => vi.unstubAllGlobals())

const creds = { customerId: '123', accessLicense: 'lic', secretKey: 'c2VjcmV0' } // base64-ish

describe('캠페인 제어(WRITE)', () => {
  it('일시정지: PUT /ncc/campaigns/{id}?fields=userLock, userLock=true', async () => {
    const calls = stub()
    const r = await updateCampaignStatus(creds, 'cmp-1', true)
    expect(r.ok).toBe(true)
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].url).toContain('/ncc/campaigns/cmp-1')
    expect(calls[0].url).toContain('fields=userLock')
    expect(JSON.parse(calls[0].body!)).toMatchObject({ nccCampaignId: 'cmp-1', userLock: true })
  })

  it('예산 변경: 하드캡 범위 밖은 호출 없이 거부', async () => {
    const calls = stub()
    expect((await updateCampaignBudget(creds, 'cmp-1', BUDGET_MIN - 1)).ok).toBe(false)
    expect((await updateCampaignBudget(creds, 'cmp-1', BUDGET_MAX + 1)).ok).toBe(false)
    expect(calls).toHaveLength(0) // 범위 밖 → 외부 호출 안 함(하드캡)
  })

  it('예산 변경: 정상 범위 → PUT budget', async () => {
    const calls = stub()
    const r = await updateCampaignBudget(creds, 'cmp-1', 50000)
    expect(r.ok).toBe(true)
    expect(calls[0].url).toContain('fields=budget')
    expect(JSON.parse(calls[0].body!)).toMatchObject({ nccCampaignId: 'cmp-1', dailyBudget: 50000, useDailyBudget: true })
  })

  it('API 오류(4xx) → ok:false + 에러 전달', async () => {
    stub(400, { title: '잘못된 요청' })
    const r = await updateCampaignStatus(creds, 'cmp-1', false)
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
  })
})

describe('제외(네거티브) 키워드(WRITE)', () => {
  it('POST /ncc/restricted-keywords + 중복제거 + 공백정리', async () => {
    const calls = stub(200, [{}, {}])
    const r = await addNegativeKeywords(creds, 'grp-1', ['무료 배송', '무료배송', '  ', '체험단'])
    expect(r.ok).toBe(true)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toContain('/ncc/restricted-keywords')
    const body = JSON.parse(calls[0].body!) as Array<{ nccAdgroupId: string; restrictedKeyword: string }>
    // '무료 배송'→'무료배송' 정리 후 '무료배송' 중복 제거, 공백 제거 → 2개
    expect(body.map(b => b.restrictedKeyword)).toEqual(['무료배송', '체험단'])
    expect(body.every(b => b.nccAdgroupId === 'grp-1')).toBe(true)
  })

  it('빈 목록/그룹 없음 → 호출 없이 거부', async () => {
    const calls = stub()
    expect((await addNegativeKeywords(creds, '', ['x'])).ok).toBe(false)
    expect((await addNegativeKeywords(creds, 'grp-1', ['   '])).ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('20개 초과 → 상한 컷', async () => {
    const calls = stub(200, [])
    const many = Array.from({ length: 30 }, (_, i) => `kw${i}`)
    await addNegativeKeywords(creds, 'grp-1', many)
    const body = JSON.parse(calls[0].body!) as unknown[]
    expect(body.length).toBe(20) // KW_ADD_MAX
  })
})
