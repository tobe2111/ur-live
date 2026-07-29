import { describe, it, expect } from 'vitest'
import { searchAdCredsFrom, parseRelatedKeywords } from '../../features/marketing/api/searchad-client'

describe('searchAdCredsFrom — 셋 다 있어야 활성 (fail-soft)', () => {
  it('셋 다 설정되면 creds 반환', () => {
    const c = searchAdCredsFrom({
      NAVER_SEARCHAD_CUSTOMER_ID: '47982',
      NAVER_SEARCHAD_ACCESS_LICENSE: 'license',
      NAVER_SEARCHAD_SECRET_KEY: 'secret',
    })
    expect(c).toEqual({ customerId: '47982', accessLicense: 'license', secretKey: 'secret' })
  })

  it('하나라도 빠지면 null (부분 키로 API 호출 방지)', () => {
    expect(searchAdCredsFrom({})).toBeNull()
    expect(searchAdCredsFrom({ NAVER_SEARCHAD_CUSTOMER_ID: '47982' })).toBeNull()
    expect(searchAdCredsFrom({ NAVER_SEARCHAD_CUSTOMER_ID: '47982', NAVER_SEARCHAD_ACCESS_LICENSE: 'x' })).toBeNull()
  })

  it('공백만 있는 값은 미설정으로 간주', () => {
    expect(searchAdCredsFrom({
      NAVER_SEARCHAD_CUSTOMER_ID: '  ',
      NAVER_SEARCHAD_ACCESS_LICENSE: 'x',
      NAVER_SEARCHAD_SECRET_KEY: 'y',
    })).toBeNull()
  })
})

describe('parseRelatedKeywords — RelKwdStat 응답 파싱', () => {
  it('PC+모바일 합산 + 총 검색량 내림차순 정렬', () => {
    const rows = parseRelatedKeywords([
      { relKeyword: '무선이어폰', monthlyPcQcCnt: 1000, monthlyMobileQcCnt: 5000, compIdx: '높음' },
      { relKeyword: '블루투스이어폰', monthlyPcQcCnt: 2000, monthlyMobileQcCnt: 20000, compIdx: '중간' },
    ])
    expect(rows[0].keyword).toBe('블루투스이어폰') // 22000 > 6000
    expect(rows[0].monthlyTotal).toBe(22000)
    expect(rows[1].monthlyTotal).toBe(6000)
  })

  it("'< 10' 같은 문자열 검색량을 안전한 정수로", () => {
    const rows = parseRelatedKeywords([
      { relKeyword: '희귀키워드', monthlyPcQcCnt: '< 10', monthlyMobileQcCnt: '< 10', compIdx: '낮음' },
    ])
    expect(rows[0].monthlyPc).toBe(10)
    expect(rows[0].monthlyTotal).toBe(20)
  })

  it('keyword 없는 행은 제외 + null/undefined 입력 안전', () => {
    expect(parseRelatedKeywords(null)).toEqual([])
    expect(parseRelatedKeywords(undefined)).toEqual([])
    const rows = parseRelatedKeywords([{ relKeyword: '', monthlyPcQcCnt: 100 }])
    expect(rows).toHaveLength(0)
  })

  it('최대 100개로 제한', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ relKeyword: `k${i}`, monthlyPcQcCnt: i }))
    expect(parseRelatedKeywords(many)).toHaveLength(100)
  })
})
