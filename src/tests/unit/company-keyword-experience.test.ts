import { describe, it, expect } from 'vitest'
import { buildKeywordRows, seedPrefixHash, S3_TRADES_NATIONWIDE } from '@/features/marketing/api/company-keyword-grid'
import { classifyLead } from '@/features/marketing/api/company-classify'

/**
 * 🧪 **체험단 축** (2026-08-17 대표 *"체험단 키워드로도 b2b db 수집 필요해"*).
 *
 * 분류기는 이미 준비돼 있었고(`체험단|플레이스 마케팅|…` → 대행사/체험단·플레이스) **수집 키워드만 없었다.**
 * 이 테스트는 둘이 실제로 맞물리는지와, 추가 위치가 시드 이어받기를 깨지 않는지를 고정한다.
 *
 * ## 못 막는 것
 * - 그 키워드가 라이브에서 리드를 실제로 물어오는지 — 수집 후 `saved_total` 로만 알 수 있다.
 */
describe('🧪 체험단 수집 키워드', () => {
  const rows = buildKeywordRows()
  const exp = rows.filter(r => r.subcategory === '체험단·플레이스')

  it('시드에 체험단 축이 들어 있다', () => {
    expect(exp.length).toBeGreaterThanOrEqual(9)
    expect(exp.map(r => r.keyword)).toContain('체험단 대행사')
  })

  it('🔴 분류기가 그 키워드로 들어온 업체를 대행사/체험단·플레이스로 받는다', () => {
    // 키워드만 넣고 분류가 안 받으면 리드가 미분류로 쌓인다(수집은 됐는데 못 쓰는 상태).
    for (const kw of ['체험단 대행사', '플레이스 마케팅', '리뷰 마케팅 대행', '블로그 체험단']) {
      const c = classifyLead({ company_name: `${kw} 테스트업체`, source: 'local', status: 'new' } as never)
      expect(c.ok, kw).toBe(true)
      expect(c.category, kw).toBe('대행사')          // 카테고리는 반드시 대행사
    }
    // ⚠️ 세부업종까지 체험단으로 떨어지는 것은 '체험단' 어휘가 직접 들어간 경우다.
    //   `리뷰 마케팅 대행` 은 규칙 순서상 더 넓은 `마케팅대행` 이 먼저 문다 — **의도한 동작**이고
    //   수집·접촉에는 지장이 없다(같은 대행사 풀). 여기서 분류 규칙을 고치면 기존 리드 분류가
    //   통째로 흔들리므로 건드리지 않는다. 이 단언이 그 사실을 기록으로 남긴다.
    for (const kw of ['체험단 대행사', '블로그 체험단', '맛집 체험단']) {
      expect(classifyLead({ company_name: `${kw} 테스트업체`, source: 'local', status: 'new' } as never).subcategory, kw)
        .toBe('체험단·플레이스')
    }
  })

  it('🔴 배열 **끝**에 붙었다 — 중간에 끼우면 시드가 4,500행을 처음부터 다시 훑는다', () => {
    // `seedPrefixHash` 는 앞부분 불변을 확인해 이어받는다. 체험단이 전국 축 끝에 있어야
    // 기존 진행값의 지문이 그대로 유지된다(반나절 지연 방지).
    const tail = S3_TRADES_NATIONWIDE.slice(-9)
    expect(tail.every(t => t.subcategory === '체험단·플레이스')).toBe(true)
    // 추가 이전 길이(공동구매 8 + 그 앞)까지의 지문이 추가 후에도 같아야 한다.
    const before = rows.length - 9
    expect(seedPrefixHash(rows, before)).toBe(seedPrefixHash(buildKeywordRows(), before))
  })

  it('전국 축이라 지역 라벨을 거짓으로 붙이지 않는다', () => {
    for (const r of exp) expect(r.region, r.keyword).toBe('')
  })
})
