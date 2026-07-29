/**
 * 🗺️ 파트너 키워드 그리드 + 커서 회전 창 — 불변식 고정 (2026-07-28 전국 시군구 전면 확장).
 *
 *   회전 창이 틀리면 **일부 키워드가 영영 안 돌아간다**(조용한 미수집 — 아무 오류도 안 남).
 *   전국 3,800개 규모에서는 눈으로 못 잡으므로 순수함수로 분리해 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { rotationWindow, buildKeywordRows, S2_REGIONS, S2_TRADES } from '@/features/marketing/api/company-keyword-grid'

describe('rotationWindow', () => {
  it('창이 끝을 안 넘으면 단일 구간', () => {
    expect(rotationWindow(100, 10, 12)).toEqual([{ offset: 10, limit: 12 }])
  })

  it('끝을 넘으면 앞으로 감겨 2구간', () => {
    expect(rotationWindow(100, 95, 12)).toEqual([{ offset: 95, limit: 5 }, { offset: 0, limit: 7 }])
  })

  it('커서가 총개수 이상이면 나머지로 정규화', () => {
    expect(rotationWindow(10, 23, 3)).toEqual([{ offset: 3, limit: 3 }])
  })

  it('batch 가 총개수보다 크면 전체 1바퀴로 클램프(중복 없음)', () => {
    const w = rotationWindow(5, 2, 50)
    expect(w.reduce((s, x) => s + x.limit, 0)).toBe(5)
  })

  it('빈 풀/비정상 입력은 빈 배열', () => {
    expect(rotationWindow(0, 0, 12)).toEqual([])
    expect(rotationWindow(100, 0, 0)).toEqual([])
    expect(rotationWindow(Number.NaN, 0, 12)).toEqual([])
  })

  it('음수 커서도 앞으로 감아 유효 오프셋', () => {
    const w = rotationWindow(10, -3, 2)
    expect(w[0].offset).toBeGreaterThanOrEqual(0)
    expect(w[0].offset).toBeLessThan(10)
  })

  /** 핵심 불변식: 커서를 batch 씩 밀면 **모든 인덱스를 빠짐없이** 밟는다(조용한 미수집 0). */
  it('커서를 계속 밀면 전 인덱스를 정확히 1회씩 커버', () => {
    const total = 47, batch = 12
    const seen = new Set<number>()
    let cursor = 0
    for (let run = 0; run < Math.ceil(total / batch) * 3; run++) {
      let picked = 0
      for (const w of rotationWindow(total, cursor, batch)) {
        for (let i = 0; i < w.limit; i++) { seen.add((w.offset + i) % total); picked++ }
      }
      expect(picked).toBe(batch)
      cursor = (cursor + batch) % total
    }
    expect(seen.size).toBe(total) // 전 인덱스 도달
  })
})

describe('키워드 그리드', () => {
  it('지역명 중복 없음 (중복이면 시드가 조용히 줄어듦)', () => {
    expect(S2_REGIONS.length).toBe(new Set(S2_REGIONS).size)
  })

  it('전국 규모 — 광역시 구 접두로 이름 충돌 제거', () => {
    expect(S2_REGIONS.length).toBeGreaterThan(200)
    // '중구'는 서울 것만 bare, 나머지는 시명 접두여야 한다(검색어 모호성 방지).
    expect(S2_REGIONS.filter(r => r === '중구')).toHaveLength(1)
    expect(S2_REGIONS).toContain('부산 중구')
    expect(S2_REGIONS).toContain('경기 광주') // 광주광역시와 분리
  })

  it('시드 키워드가 지역×업종으로 전개되고 tier1(대행사)이 다수', () => {
    const rows = buildKeywordRows()
    const unique = new Set(rows.map(r => r.keyword))
    expect(unique.size).toBeGreaterThan(3000)
    const tier1Trades = S2_TRADES.filter(t => t.tier === 1).length
    expect(rows.filter(r => r.tier === 1).length).toBe(S2_REGIONS.length * tier1Trades)
  })

  it('키워드 길이가 저장 한도(40자) 안에 든다', () => {
    for (const r of buildKeywordRows()) expect(r.keyword.length).toBeLessThanOrEqual(40)
  })
})
