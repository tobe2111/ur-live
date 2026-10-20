/**
 * 🚮 **크롤 불가 URL 이 슬롯을 먹지 않는다** — 계약 (2026-08-02 라이브 실측 후 신설).
 *
 * ## 실측이 말한 것
 * ```
 *   매장 보강 1회차 — processed 8 · email_found 0 · remaining_no_email 46,174 · deadline_hit true
 *   pass2_reason: site_naver 5 · crawl_blocked_host 4 · site_search 3 · crawl_robots 1
 * ```
 * 회차당 **8건**만 처리하는데 그중 **4건이 차단 호스트**였다 — 인스타·블로그·카페다.
 * 소상공인의 '홈페이지'가 대부분 그것이라 **이메일이 구조적으로 없는데**, `LIMIT` 슬롯과 크롤 예산은
 * 진짜 사이트와 똑같이 먹는다. 슬롯이 8개뿐인 레인에서 절반을 그렇게 쓰면 진짜 사이트는 영영 안 뽑힌다.
 *
 * ## 이건 **파트너 레인이 이미 배운 것**이다
 * `company-collect` 는 2026-07-28 에 같은 실측(그 풀의 22.9%가 플랫폼 URL)으로 선정 SQL 에
 * `PLATFORM_URL_SQL_EXCLUDE` 를 넣었다. **매장 레인만 그 처방을 못 받았다** — 슬롯이 15가 아니라
 * 8이라 이쪽이 더 치명적인데도. 새 규칙이 아니라 **검증된 패턴의 이식**이다.
 *
 * ## ⚠️ 버리는 것은 *크롤 시도*뿐, **주소가 아니다**
 * 소상공인에겐 그 블로그가 실제 접점이다. Pass 2 는 플랫폼 URL 도 `website` 로 **저장하고**
 * 크롤만 건너뛴다. 이걸 헷갈려 주소까지 버리면 수집이 아니라 삭제가 된다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 실제 D1 동작(발행 SQL 문자열만 본다). 라이브 판정은 `pass2_reason.site_platform_skip` 출현과
 *   `processed` 증가로 한다.
 * - 제외 목록이 **충분한지**(새 플랫폼이 생기면 목록에 추가해야 한다 — SSOT 한 곳만 고치면 된다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PLATFORM_URL_SQL_EXCLUDE, realSite } from '@/features/marketing/api/contact-enrich'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const PROSPECT = SRC('src/features/marketing/api/prospect-enrich.ts')
const COMPANY = SRC('src/features/marketing/api/company-collect.ts')

describe('선정 단계 — 두 풀이 같은 SSOT 를 쓴다', () => {
  it('🔒 매장 Pass 1 이 플랫폼 URL 을 **SQL 에서** 뺀다', () => {
    expect(PROSPECT).toMatch(/const platformNot = PLATFORM_URL_SQL_EXCLUDE\.map\(\(\) => 'website NOT LIKE \?'\)\.join\(' AND '\)/)
    expect(PROSPECT, 'Pass 1 쿼리에 제외 절이 안 붙었다').toMatch(/\$\{COOL\} AND \$\{platformNot\}/)
  })

  it('🔒 `?` 를 넣었으면 **bind 도** 해야 한다 — 안 하면 D1 이 던지고 `.catch` 가 삼켜 조용히 0건이 된다', () => {
    expect(PROSPECT).toMatch(/\)\.bind\(\.\.\.PLATFORM_URL_SQL_EXCLUDE\)\.all</)
  })

  it('🔒 목록을 **복붙하지 않았다** — 두 벌이면 새 플랫폼이 생겼을 때 한쪽만 는다', () => {
    const inlined = PROSPECT.split('\n').filter(l => /%instagram\.com%|%blog\.naver\.com%/.test(l))
    expect(inlined, `목록을 복붙한 줄: ${inlined.join(' | ')}`).toHaveLength(0)
    expect(PROSPECT).toMatch(/PLATFORM_URL_SQL_EXCLUDE \} = await import\('\.\/contact-enrich'\)|, PLATFORM_URL_SQL_EXCLUDE \}/)
  })

  it('파트너 레인도 같은 상수를 쓴다(두 풀의 처방이 갈라지지 않았다)', () => {
    expect(COMPANY).toMatch(/PLATFORM_URL_SQL_EXCLUDE\.map\(\(\) => 'website NOT LIKE \?'\)/)
  })
})

describe('Pass 2 — 크롤만 건너뛰고 주소는 남긴다', () => {
  it('🔒 플랫폼 URL 이면 크롤을 건너뛴다(예산이 다음 행으로 간다)', () => {
    expect(PROSPECT).toMatch(/if \(site && !realSite\(site\)\) \{[\s\S]{0,80}?bump2\('site_platform_skip'\)/)
  })

  it('🔒 그래도 **저장은 한다** — 소상공인에겐 그 블로그가 실제 접점이다', () => {
    // upd 호출이 여전히 site 를 website 로 넘긴다(스킵 분기가 site 를 지우지 않았다).
    expect(PROSPECT).toMatch(/upd\(p\.id, \{ email, website: site, phone, source \}\)/)
    expect(PROSPECT, 'site 를 null 로 만들면 수집이 아니라 삭제가 된다').not.toMatch(/site = null/)
  })

  it('🔒 스킵을 **세어서 남긴다** — 안 세면 "왜 이메일이 0인가"를 다음 세션이 다시 판다', () => {
    expect(PROSPECT).toContain("bump2('site_platform_skip')")
  })
})

describe('realSite 판정 — SQL 을 빠져나간 변종을 잡는다', () => {
  it('플랫폼/지도 URL 을 거른다', () => {
    for (const u of ['https://blog.naver.com/foo', 'https://place.map.kakao.com/1', 'https://naver.me/xyz', 'https://www.instagram.com/shop']) {
      expect(realSite(u), u).toBeNull()
    }
  })

  it('진짜 자체 도메인은 통과한다', () => {
    expect(realSite('https://mystore.co.kr')).toBe('https://mystore.co.kr')
  })

  it('🔒 SQL 목록이 비어 있지 않다 — 비면 위 제외 절이 조용히 무력해진다', () => {
    expect(PLATFORM_URL_SQL_EXCLUDE.length).toBeGreaterThan(10)
  })
})
