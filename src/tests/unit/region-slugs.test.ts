/**
 * 🗺️ 행정 지역 SSOT 불변식 〔2026-08-03 — 도시별 색인 페이지〕
 *
 * 이 파일이 지키는 것은 **주소 파싱**이다. 도시 페이지의 URL·색인 여부·피드 필터가 전부
 * `parseRegionFromAddress` 한 함수의 출력에 걸려 있어서, 여기가 틀리면 조용히 틀린다 —
 * 페이지는 200 으로 열리고 상품만 0개로 보인다(에러가 안 난다).
 *
 * 아래 케이스는 **전부 2026-08-03 라이브 실측 주소**다(활성 동네딜 329건 전수 조회).
 * 지어낸 표기가 아니라 D1 에 실제로 들어 있는 문자열이라, 정규화 표를 건드리면 여기서 깨진다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 주소 자체가 틀린 상품(셀러 입력 오타) — 파서는 준 문자열만 본다.
 *   - `/region/*` 라우트 배선·sitemap 발행·워커 메타. 그건 별도 가드(region-page-wiring)가 본다.
 *   - 실제 색인 여부. 우리가 `index` 를 내보내는 것과 구글이 색인하는 것은 다른 일이다.
 */
import { describe, it, expect } from 'vitest'
import {
  parseRegionFromAddress,
  parseRegionPath,
  normalizeSido,
  addressInRegion,
  regionPath,
  regionLabel,
  SIDO_LIST,
  REGION_INDEX_MIN_DEALS,
} from '@/shared/constants/region-slugs'

describe('시/도 정규화 — 라이브 주소는 짧은형과 전체형이 섞여 있다', () => {
  it('짧은형은 그대로 통과', () => {
    expect(normalizeSido('서울')).toBe('서울')
    expect(normalizeSido('경기')).toBe('경기')
    expect(normalizeSido('충남')).toBe('충남')
  })

  it('특별자치도 표기를 짧은형으로 접는다 (실측: 강원/전북/제주)', () => {
    expect(normalizeSido('강원특별자치도')).toBe('강원')
    expect(normalizeSido('전북특별자치도')).toBe('전북')
    expect(normalizeSido('제주특별자치도')).toBe('제주')
  })

  it('전남광주통합특별시 — 라이브에 실재하는 표기(24건), 전남으로 접는다', () => {
    // 하위가 화순군·나주시·보성군·장흥군이라 전남 권역. 이 매핑을 지우면 24건이 지역 없음이 된다.
    expect(normalizeSido('전남광주통합특별시')).toBe('전남')
  })

  it('미등록 표기는 접미사만 떼어 폴백 — 새 행정명이 생겨도 조용히 죽지 않게', () => {
    expect(normalizeSido('경기특별자치도')).toBe('경기')
  })

  it('모르는 값은 null — 추측해서 엉뚱한 지역에 넣지 않는다', () => {
    expect(normalizeSido('도쿄')).toBeNull()
    expect(normalizeSido('')).toBeNull()
    expect(normalizeSido(undefined)).toBeNull()
  })
})

describe('주소 파싱 — 실측 문자열', () => {
  const cases: Array<[string, string, string | undefined]> = [
    ['서울 광진구 뚝섬로32길 31', '서울', '광진구'],
    ['서울 종로구 자하문로1길 25', '서울', '종로구'],
    ['경기 파주시 경의로 1246', '경기', '파주시'],
    ['부산 해운대구 중동1로19번길 7', '부산', '해운대구'],
    ['강원특별자치도 강릉시 창해로362번길 11-1', '강원', '강릉시'],
    ['강원특별자치도 양양군 강현면 주청2길 31', '강원', '양양군'],
    ['전남광주통합특별시 화순군 화순읍 쌍충로 74', '전남', '화순군'],
    ['충남 예산군 덕산면 봉운로 53', '충남', '예산군'],
    ['경북 경주시 천북면 천강로 194', '경북', '경주시'],
    ['제주특별자치도 제주시 은남1길 24', '제주', '제주시'],
    ['대구 중구 동성로3길 67', '대구', '중구'],
  ]
  it.each(cases)('%s → %s %s', (addr, sido, sigungu) => {
    expect(parseRegionFromAddress(addr)).toEqual({ sido, sigungu })
  })

  it('자치구를 가진 특례시는 **시 단위**까지만 — 구까지 쪼개면 thin content 가 된다', () => {
    expect(parseRegionFromAddress('전북특별자치도 전주시 덕진구 아중로 127')).toEqual({ sido: '전북', sigungu: '전주시' })
    expect(parseRegionFromAddress('충북 청주시 서원구 쌍샘로 64')).toEqual({ sido: '충북', sigungu: '청주시' })
  })

  it('시/도만 있는 주소는 sigungu 없이', () => {
    expect(parseRegionFromAddress('서울')).toEqual({ sido: '서울' })
  })

  it('빈 값·해외·깨진 주소는 null', () => {
    expect(parseRegionFromAddress('')).toBeNull()
    expect(parseRegionFromAddress(null)).toBeNull()
    expect(parseRegionFromAddress('Tokyo Shibuya 1-2-3')).toBeNull()
  })
})

describe('지역 소속 판정 — 동명 시군구를 삼키면 안 된다', () => {
  // 🔴 이게 이 파일의 핵심 케이스다. 라이브에 서울 중구(25건)·대구 중구(8건)·부산 중구가 전부 있다.
  //    문자열 includes 로 필터하면 서울 중구 페이지에 대구 딜이 섞인다.
  it('같은 이름의 다른 지역을 구분한다 (서울 중구 ≠ 대구 중구)', () => {
    const seoulJung = { sido: '서울', sigungu: '중구' }
    expect(addressInRegion('서울 중구 을지로 1', seoulJung)).toBe(true)
    expect(addressInRegion('대구 중구 동성로3길 67', seoulJung)).toBe(false)
    expect(addressInRegion('부산 중구 광복로 1', seoulJung)).toBe(false)
  })

  it('시/도 단위는 하위 시군구를 전부 포함', () => {
    const seoul = { sido: '서울' }
    expect(addressInRegion('서울 중구 을지로 1', seoul)).toBe(true)
    expect(addressInRegion('서울 광진구 뚝섬로32길 31', seoul)).toBe(true)
    expect(addressInRegion('경기 파주시 경의로 1246', seoul)).toBe(false)
  })

  it('전체형 표기 주소도 짧은형 지역에 매칭 (정규화 후 비교)', () => {
    expect(addressInRegion('강원특별자치도 강릉시 창해로362번길 11-1', { sido: '강원', sigungu: '강릉시' })).toBe(true)
  })

  it('주소 없는 딜은 제외 — 통과시키면 지역 필터가 새어 다른 지역 딜이 올라온다', () => {
    expect(addressInRegion('', { sido: '서울' })).toBe(false)
    expect(addressInRegion(null, { sido: '서울' })).toBe(false)
  })
})

describe('URL 왕복 — 경로 생성과 파싱이 대칭이어야 링크가 안 죽는다', () => {
  it('생성 → 파싱 왕복', () => {
    for (const ref of [{ sido: '서울' }, { sido: '서울', sigungu: '중구' }, { sido: '강원', sigungu: '양양군' }]) {
      const path = regionPath(ref)
      const [, , sido, sigungu] = path.split('/')
      expect(parseRegionPath(sido, sigungu)).toEqual(ref)
    }
  })

  it('퍼센트 인코딩된 파라미터도 받는다 (직접 입력·외부 유입 URL)', () => {
    expect(parseRegionPath(encodeURIComponent('서울'), encodeURIComponent('중구')))
      .toEqual({ sido: '서울', sigungu: '중구' })
  })

  it('모르는 지역은 null — 200 으로 내주면 soft-404 가 되어 크롤 예산을 먹는다', () => {
    expect(parseRegionPath('atlantis')).toBeNull()
    expect(parseRegionPath('서울', '없는동네')).toBeNull()   // 시군구 형태가 아님
  })

  it('라벨', () => {
    expect(regionLabel({ sido: '서울', sigungu: '중구' })).toBe('서울 중구')
    expect(regionLabel({ sido: '서울' })).toBe('서울')
  })
})

describe('색인 게이트', () => {
  it('17개 시/도 전부 정규화 가능 — 목록과 정규화 표가 어긋나면 그 지역 URL 이 통째로 404', () => {
    expect(SIDO_LIST).toHaveLength(17)
    for (const s of SIDO_LIST) expect(normalizeSido(s)).toBe(s)
  })

  it('thin content 하한이 1보다 크다 — 1이면 상품 1개짜리 빈 페이지가 대량 색인된다', () => {
    expect(REGION_INDEX_MIN_DEALS).toBeGreaterThan(1)
  })
})
