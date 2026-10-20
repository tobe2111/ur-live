/**
 * 🔴 몰 컨텍스트 해석 불변식 〔세션 ③-a, 대표 경계조건 ①·②〕
 *
 * ① **경로가 호스트를 이기면 하이재킹**: 커스텀 도메인이 붙은 A몰에서 경로에 B몰 슬러그가 들어가면
 *    B몰로 넘어간다. ⇒ 호스트가 매핑되면 호스트 단독 결정, 경로는 정본 호스트에서만.
 *    지금은 커스텀 도메인 몰이 0개라 **차이가 안 난다** — 그래서 지금 박는다.
 *
 * ② **가드는 양방향이어야 한다**: 예약어가 몰 슬러그를 잡아먹는 방향만 막으면 반쪽이다.
 *    반대 — **신규 라우트가 이미 존재하는 몰 슬러그와 충돌** — 이 진짜 드리프트다.
 *    ⚠️ 그 반쪽은 **여기서 못 막는다**(몰 슬러그는 라이브 DB 에 있고 CI 는 못 읽는다).
 *    CI 몫 = `라우트 ⊆ 예약어`(mall-branding.test) · 런타임 몫 = `기존 슬러그 ∩ 예약어 = ∅` 보고.
 *    **둘 다 있어야 ∅ 이 성립**한다 — 한쪽만 보고 "막았다"고 하지 말 것.
 */
import { describe, it, expect } from 'vitest'
import { decideMallSource, isCanonicalHost, firstPathSegment, CANONICAL_HOSTS } from '@/shared/mall/resolve'
import { RESERVED_SLUGS } from '@/shared/mall/slug'

const base = { queryMallFound: false, hostMapped: false, host: 'urdeal.kr', pathSlugFound: false }

describe('🔴 경계조건 ① — 호스트가 매핑되면 경로는 무시된다', () => {
  it('커스텀 도메인 몰에서 경로에 다른 몰 슬러그가 있어도 **호스트가 이긴다**', () => {
    // 이게 뒤집히면 A몰 사이트에서 B몰 컨텍스트로 넘어간다 = 하이재킹.
    expect(decideMallSource({ ...base, hostMapped: true, host: 'a-mall.com', pathSlugFound: true }))
      .toBe('host')
  })

  it('🔴 **정본 호스트인데 매핑도 된** 경우에도 호스트가 이긴다 — 순서 자체를 고정', () => {
    // ⚠️ 위 케이스만으로는 부족하다. 커스텀 도메인은 정본이 아니라 **경로 분기가 애초에 못 뜨고**,
    //   그래서 두 조건(순서 · 정본제한)이 겹쳐 **순서를 뒤집어도 초록**이 된다(되돌려-검증에서 실측).
    //   두 분기가 **동시에 발화 가능한** 조합으로 순서를 따로 고정해야 한다.
    expect(decideMallSource({ ...base, hostMapped: true, host: 'live.ur-team.com', pathSlugFound: true }))
      .toBe('host')
  })

  it('정본 호스트 + 경로 슬러그 → 경로가 결정', () => {
    expect(decideMallSource({ ...base, host: 'urdeal.kr', pathSlugFound: true })).toBe('path')
  })

  it('정본이 아닌 미매핑 호스트에선 경로를 보지 않는다', () => {
    // 남이 DNS 를 우리 쪽으로 걸어둔 호스트에서 경로로 몰을 정하게 두지 않는다.
    expect(decideMallSource({ ...base, host: 'random-parked.example', pathSlugFound: true }))
      .toBe('default')
  })

  it('경로 슬러그가 실재하지 않으면 기본 몰', () => {
    expect(decideMallSource({ ...base, pathSlugFound: false })).toBe('default')
  })
})

describe('기존 동작 보존 — 이번 변경이 만든 축은 path 뿐', () => {
  it('`?mall` 은 여전히 최우선(기존 dev 오버라이드, 의미 불변)', () => {
    expect(decideMallSource({ ...base, queryMallFound: true, hostMapped: true })).toBe('query')
  })

  it('경로가 없으면 기존과 동일 — 매핑 호스트는 host, 아니면 default', () => {
    expect(decideMallSource({ ...base, hostMapped: true, host: 'a-mall.com' })).toBe('host')
    expect(decideMallSource({ ...base })).toBe('default')
  })

  it('🛡️ 단일 몰 환경(경로·쿼리·매핑 전부 없음)에선 항상 default — 동작 불변 불변식', () => {
    for (const h of ['urdeal.kr', 'live.ur-team.com', 'x.ur-live.pages.dev', 'localhost', null]) {
      expect(decideMallSource({ ...base, host: h })).toBe('default')
    }
  })
})

describe('정본 호스트 판정', () => {
  it('목록의 호스트 + 포트/대문자 정규화', () => {
    for (const h of CANONICAL_HOSTS) expect(isCanonicalHost(h)).toBe(true)
    expect(isCanonicalHost('URDEAL.KR')).toBe(true)
    expect(isCanonicalHost('localhost:5173')).toBe(true)
  })

  it('pages.dev 프리뷰는 정본 — 커스텀 도메인 몰이 아니다', () => {
    expect(isCanonicalHost('abc123.ur-live.pages.dev')).toBe(true)
  })

  it('커스텀 도메인·빈값은 정본 아님', () => {
    expect(isCanonicalHost('a-mall.com')).toBe(false)
    expect(isCanonicalHost('utongstart.com')).toBe(false)
    expect(isCanonicalHost('')).toBe(false)
    expect(isCanonicalHost(null)).toBe(false)
  })
})

describe('경로 1st 세그먼트 추출 — DB 조회를 아끼는 사전 필터', () => {
  it('슬러그 문법인 것만 후보로 올린다', () => {
    expect(firstPathSegment('https://urdeal.kr/my-shop/products/1')).toBe('my-shop')
    expect(firstPathSegment('https://urdeal.kr/My-Shop')).toBe('my-shop')
  })

  it('문법 밖은 null — 조회하지 않는다', () => {
    expect(firstPathSegment('https://urdeal.kr/')).toBeNull()
    expect(firstPathSegment('https://urdeal.kr/ab')).toBeNull()          // 3자 미만
    expect(firstPathSegment('https://urdeal.kr/한글가게')).toBeNull()     // 비ASCII
    expect(firstPathSegment('https://urdeal.kr/shop_1')).toBeNull()      // 언더스코어
    expect(firstPathSegment('https://urdeal.kr/' + 'a'.repeat(31))).toBeNull()
  })
})

describe('② 양방향 가드 — CI 가 볼 수 있는 절반', () => {
  it('예약어가 슬러그 문법을 만족하는 것들은 경로 후보와 같은 공간에 있다', () => {
    // 예약어와 경로 후보가 **같은 정규화 규칙**을 쓰지 않으면 한쪽만 막힌다.
    const sample = ['admin', 'products', 'my-orders', 'group-buy']
    for (const s of sample) {
      expect(RESERVED_SLUGS).toContain(s)
      expect(firstPathSegment(`https://urdeal.kr/${s}`)).toBe(s)
    }
  })

  it('⚠️ 못 막는 절반을 명시한다 — 라이브 몰 슬러그는 CI 가 못 읽는다', () => {
    // 이 테스트는 사실 검증이 아니라 **경계 선언**이다. 신규 라우트가 이미 존재하는 몰 슬러그와
    // 충돌하는 방향은 런타임(어드민 진단)이 맡는다. 여기서 막았다고 착각하지 말 것.
    expect(RESERVED_SLUGS.length).toBeGreaterThan(50) // 스냅샷이 비지 않았다는 것만 확인
  })
})
