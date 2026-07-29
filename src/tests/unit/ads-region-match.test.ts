/**
 * 📍 지역 추출 규칙 — 오탐/누락 양쪽을 고정한다 (2026-07-29).
 *
 *   이 규칙은 **오탐이 더 비싸다**: 잘못 붙은 지역은 "강남 맛집 인플루언서 10명" 주문에 엉뚱한 사람을
 *   섞어 넣고, 그건 화면에서 안 보인다(에러가 아니라 *그럴듯한* 결과라서). 그래서 고유명사
 *   (`강남스타일`·`제주항공`·`성수기`·`고양이`)를 회귀 테스트로 못 박는다.
 *
 *   반대로 누락도 조용하다: `'방배동 맛집'` 이 `동` 접미 미지원으로 지역 없음이 돼 있었고(누적 241명),
 *   그 사실은 어드민 목록에서 "지역 필터에 안 잡힘"으로만 나타났다.
 *
 *   ⚠️ 이 테스트가 **못 막는 것**: 규칙을 고치고 `REGION_RULES_VERSION` 을 안 올리는 경우.
 *   그건 아래 마지막 케이스가 *버전 상수의 존재*만 확인할 뿐, 값이 올바른지는 사람이 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { regionFromKeyword, REGION_RULES_VERSION } from '@/features/marketing/api/influencer-region'

describe('regionFromKeyword — 매칭', () => {
  it('토큰 + 공백', () => {
    expect(regionFromKeyword('강남 맛집')).toBe('강남')
    expect(regionFromKeyword('영등포 카페')).toBe('영등포')
  })

  it('행정 단위 접미(동/구/시/군/읍/면/리)를 인정한다', () => {
    expect(regionFromKeyword('방배동 맛집')).toBe('방배')   // ← 2026-07-29 실사고(누적 241명 미매칭)
    expect(regionFromKeyword('강남구 네일')).toBe('강남')
    expect(regionFromKeyword('수원시 카페')).toBe('수원')
    expect(regionFromKeyword('화성시 숙소')).toBe('화성')
  })
})

describe('regionFromKeyword — 오탐 차단(이쪽이 더 비싸다)', () => {
  it('고유명사는 지역이 아니다', () => {
    for (const k of ['강남스타일', '제주항공', '성수기 여행', '고양이 용품', '동대문시장 구경']) {
      expect(regionFromKeyword(k), k).toBeNull()
    }
  })

  it('어순이 다르면 지역 의도로 보지 않는다', () => {
    expect(regionFromKeyword('맛집 강남')).toBeNull()
  })

  it('빈 값/공백', () => {
    expect(regionFromKeyword('')).toBeNull()
    expect(regionFromKeyword(null)).toBeNull()
    expect(regionFromKeyword('   ')).toBeNull()
  })
})

describe('규칙 버전', () => {
  it('버전 상수가 존재하고 1 이상 — 규칙을 바꿨으면 사람이 +1 해야 한다', () => {
    expect(REGION_RULES_VERSION).toBeGreaterThanOrEqual(1)
  })
})
