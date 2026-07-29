/**
 * 🗺️ 파트너 키워드 그리드 + 커서 회전 창 — 불변식 고정 (2026-07-28 전국 시군구 전면 확장).
 *
 *   회전 창이 틀리면 **일부 키워드가 영영 안 돌아간다**(조용한 미수집 — 아무 오류도 안 남).
 *   전국 3,800개 규모에서는 눈으로 못 잡으므로 순수함수로 분리해 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { rotationWindow, buildKeywordRows, S2_REGIONS, S2_TRADES, resumeSeedIndex, seedPrefixHash, S3_TRADES_LOCAL, S3_TRADES_NATIONWIDE } from '@/features/marketing/api/company-keyword-grid'

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
    // tier1 = (전국 그리드에 얹히는 업종 × 지역) + (지역 없는 전국 축). 2026-07-29 공동구매(S3) 추가로
    //   S2 만 세면 안 된다 — 새 축을 더할 때 이 식도 함께 늘어나야 '다수' 주장이 유지된다.
    const gridTier1 = [...S2_TRADES, ...S3_TRADES_LOCAL].filter(t => t.tier === 1).length
    const nationTier1 = S3_TRADES_NATIONWIDE.filter(t => t.tier === 1).length
    expect(rows.filter(r => r.tier === 1).length).toBe(S2_REGIONS.length * gridTier1 + nationTier1)
  })

  it('키워드 길이가 저장 한도(40자) 안에 든다', () => {
    for (const r of buildKeywordRows()) expect(r.keyword.length).toBeLessThanOrEqual(40)
  })
})

/**
 * 🛒 공동구매 생태계 시드 (2026-07-29 대표 "창고형 공동구매, 공동구매 관련 키워드 업체들").
 *   ⚠️ 서비스 분리: 여기는 유어딜 파트너 풀. 도매몰(제조사) 레인과 섞이면 안 된다.
 */
describe('공동구매 키워드 시드', () => {
  const rows = buildKeywordRows()
  const gb = rows.filter(r => r.category === '공동구매')

  it('창고형은 지역 그리드에 얹히고, 총판·벤더는 전국(무지역)이다', () => {
    expect(gb.length).toBeGreaterThan(0)
    const local = gb.filter(r => r.region)
    const national = gb.filter(r => !r.region)
    expect(local.length).toBeGreaterThan(100)   // 지역 × 창고형
    expect(national.length).toBeGreaterThan(0)  // 지역 접두 없는 온라인 축
    // 전국 축에 지역명이 섞이면 리콜이 죽는다(거짓 지역 라벨도 금지)
    for (const r of national) expect(r.keyword.startsWith('서울')).toBe(false)
  })

  it('전국 축 키워드는 지역이 접두되지 않는다', () => {
    expect(gb.some(r => r.keyword === '공동구매 총판' && !r.region)).toBe(true)
  })

  it('🔧 "공구" 단독 키워드를 만들지 않는다 — 공구상가(연장)를 긁어오게 된다', () => {
    for (const r of gb) expect(/(^|\s)공구(\s|$)/.test(r.keyword)).toBe(false)
  })
})

/**
 * 🔢 시드 이어받기 — 버전 bump 가 앞부분을 다시 훑지 않게(새 업종이 반나절 늦게 들어가던 문제).
 *   앞이 바뀌었으면 반드시 0 으로 떨어져야 한다: "덧붙이기겠지"라는 가정이 데이터를 건너뛰게 만든다.
 */
describe('resumeSeedIndex — 버전 bump 시 이어받기', () => {
  const rows = buildKeywordRows()

  it('같은 버전이면 평소대로 이어받는다', () => {
    expect(resumeSeedIndex('3:500', 3, rows)).toBe(500)
  })

  it('진행값이 없으면 0', () => {
    expect(resumeSeedIndex(null, 3, rows)).toBe(0)
    expect(resumeSeedIndex('', 3, rows)).toBe(0)
    expect(resumeSeedIndex('2:0', 3, rows)).toBe(0)
  })

  it('구형(지문 없는) 진행값은 안전하게 0 — 앞이 그대로인지 확인할 수단이 없다', () => {
    expect(resumeSeedIndex('2:3600', 3, rows)).toBe(0)
  })

  it('✅ 버전이 올라도 앞부분 지문이 같으면 이어받는다(덧붙이기만 한 경우)', () => {
    const h = seedPrefixHash(rows, 3600)
    expect(resumeSeedIndex(`2:3600:${h}`, 3, rows)).toBe(3600)
  })

  it('🔒 앞부분이 바뀌었으면 0 부터 — 건너뛴 행이 영영 안 들어가는 사고 방지', () => {
    expect(resumeSeedIndex('2:3600:deadbeef', 3, rows)).toBe(0)
  })

  it('저장된 진행값이 현재 행 수보다 크면 잘라낸다(그리드 축소 후)', () => {
    const h = seedPrefixHash(rows, rows.length)
    expect(resumeSeedIndex(`2:${rows.length + 10}:${h}`, 3, rows)).toBeLessThanOrEqual(rows.length)
  })

  it('지문은 앞부분 길이에 따라 달라진다(길이만 맞고 내용이 다르면 잡힌다)', () => {
    expect(seedPrefixHash(rows, 100)).not.toBe(seedPrefixHash(rows, 101))
  })
})
