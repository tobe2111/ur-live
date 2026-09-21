/**
 * 🇰🇷 서류 주소·상호 대조 — `shared/korean-address.ts` 불변식.
 *
 * 2026-09-16 (결재 `2026-09-16-ocr-license-automation.md`).
 *
 * ## 이 시험이 쓰는 데이터는 **라이브 원장에서 그대로 가져온 것**이다
 * `store_prospects` 의 `general_restaurants`(진짜 인허가 원장) 행에서 뽑았다.
 * 합성 주소로만 재면 한국 주소의 실제 흔들림(`, 1층` · `(원서동)` · `…248번길`)을 못 잡는다.
 *
 * ## 이 시험이 **못 막는** 것
 * - OCR 이 글자를 잘못 읽는 것(그건 AI 품질이고 여기선 입력이 이미 문자열이다).
 * - 지번주소끼리의 대조 — 도로명이 없으면 등급이 `near` 아래로 안 올라간다(의도된 보수성).
 * - 같은 건물 안 다른 호실의 두 가게 — `same` 이 뜬다. 주소만으로는 구분 불가이고,
 *   그래서 이 판정이 **승인 버튼을 누르지 않는다**(사람이 상호도 같이 본다).
 */
import { describe, it, expect } from 'vitest'
import {
  addressTokens,
  compareAddress,
  normalizeBizName,
  compareBizName,
} from '@/shared/korean-address'

describe('addressTokens — 라이브 원장 실제 주소', () => {
  it('도로명 + 층 + 법정동 괄호를 모두 견딘다', () => {
    const t = addressTokens('서울특별시 종로구 창덕궁길 29-24, 1층 (원서동)')
    expect(t.sido).toBe('서울')
    expect(t.sigungu).toBe('종로구')
    expect(t.road).toBe('창덕궁길')
    expect(t.building).toBe('29-24')
  })

  it('축약 시도 표기(`서울`)도 같은 토큰을 낸다', () => {
    const a = addressTokens('서울 강남구 논현로94길 15')
    const b = addressTokens('서울특별시 강남구 논현로94길 15')
    expect(a.sido).toBe(b.sido)
    expect(a.sigungu).toBe(b.sigungu)
    expect(a.road).toBe(b.road)
    expect(a.building).toBe(b.building)
  })

  it('`…248번길` 처럼 도로명에 숫자가 박힌 것도 도로명으로 읽는다', () => {
    const t = addressTokens('인천광역시 강화군 강화읍 강화대로248번길 22 (강화읍)')
    expect(t.sigungu).toBe('강화군')
    expect(t.road).toBe('강화대로248번길')
    expect(t.building).toBe('22')
  })

  it('2단계 시군구(`성남시 분당구`)는 더 좁은 쪽을 택한다', () => {
    const t = addressTokens('경기도 성남시 분당구 판교역로 235')
    expect(t.sigungu).toBe('분당구')
    expect(t.road).toBe('판교역로')
    expect(t.building).toBe('235')
  })

  it('🔑 건물번호를 도로명 안 숫자와 혼동하지 않는다', () => {
    // `논현로94길` 의 94 를 건물번호로 집으면 전혀 다른 건물이 "같다" 가 된다
    const t = addressTokens('서울 강남구 논현로94길 15')
    expect(t.building).toBe('15')
    expect(t.building).not.toBe('94')
  })

  it('빈 입력·null 은 조용히 빈 토큰', () => {
    for (const v of [null, undefined, '', '   ']) {
      expect(addressTokens(v as string).normalized).toBe('')
    }
  })
})

describe('compareAddress — 등급', () => {
  it('같은 건물이면 same (표기가 달라도)', () => {
    const r = compareAddress('서울특별시 강남구 봉은사로 333, 2층', '서울 강남구 봉은사로 333')
    expect(r.verdict).toBe('same')
  })

  it('다른 시군구면 differ', () => {
    const r = compareAddress('서울 강남구 봉은사로 333', '서울 종로구 창덕궁길 29-24')
    expect(r.verdict).toBe('differ')
    expect(r.reason).toContain('다른 지역')
  })

  it('같은 구 다른 도로면 near — differ 로 올리지 않는다', () => {
    const r = compareAddress('서울 강남구 봉은사로 333', '서울 강남구 논현로94길 15')
    expect(r.verdict).toBe('near')
  })

  it('🔍 2026-09-21 모델이 도로명 숫자를 띄어 써도 같은 건물 (`가리내 10길 10` ↔ `가리내10길 10`)', () => {
    // S-OCR 라이브 실측 — OCR 이 `가리내10길` 을 `가리내 10길` 로 냈고 파서가 도로명을 `10길` 로 잘라 near 가 됐다.
    const r = compareAddress('전북특별자치도 전주시 덕진구 가리내 10길 10', '전북특별자치도 전주시 덕진구 가리내10길 10')
    expect(r.verdict).toBe('same')
    expect(addressTokens('서울 강남구 논현로 94길 15').road).toBe('논현로94길')
    // 행정구역 뒤의 숫자 조각은 붙이지 않는다 — `강남구10길` 같은 가짜 도로명을 만들지 않는다
    expect(addressTokens('서울 강남구 10길 15').road).toBe('10길')
  })

  it('같은 도로 다른 건물번호도 near', () => {
    const r = compareAddress('서울 강남구 봉은사로 333', '서울 강남구 봉은사로 555')
    expect(r.verdict).toBe('near')
  })

  it('🛡️ 한쪽을 못 읽으면 unknown — differ 가 아니다', () => {
    // OCR 실패를 "주소가 다르다" 로 바꾸면 정상 사장님이 반려된다
    expect(compareAddress(null, '서울 강남구 봉은사로 333').verdict).toBe('unknown')
    expect(compareAddress('알아볼 수 없음', '서울 강남구 봉은사로 333').verdict).toBe('unknown')
  })
})

describe('normalizeBizName / compareBizName', () => {
  it('법인격은 지운다', () => {
    expect(normalizeBizName('(주)대가방')).toBe('대가방')
    expect(normalizeBizName('주식회사 유일한옥')).toBe('유일한옥')
  })

  it('🔑 지점명은 지우지 않는다 — 다른 가게다', () => {
    const n = normalizeBizName('스타벅스 역삼점')
    expect(n).toContain('역삼점')
    expect(compareBizName('스타벅스 역삼점', '스타벅스 강남점').verdict).toBe('differ')
  })

  it('한쪽이 다른 쪽을 품으면 contains', () => {
    expect(compareBizName('대가방', '대가방 본점').verdict).toBe('contains')
  })

  it('완전히 다르면 differ', () => {
    expect(compareBizName('광주식당', '유일한옥 북촌점').verdict).toBe('differ')
  })

  it('한쪽이 비면 unknown', () => {
    expect(compareBizName('', '대가방').verdict).toBe('unknown')
    expect(compareBizName(null, '대가방').verdict).toBe('unknown')
  })

  it('한 글자 우연 일치를 contains 로 올리지 않는다', () => {
    // `집` 한 글자가 겹친다고 같은 가게일 리 없다
    expect(compareBizName('집', '리북집 논현직영점').verdict).toBe('differ')
  })
})
