/**
 * ☎️ **한국 전화번호 하이픈 위치** — 2026-08-12 대표 신고 *"연락처랑 업체명이 전혀 안맞아"*.
 *
 * ## 실사고
 * 포맷이 국번을 모르고 자리수로만 끊었다(`(\d{2,4})(\d{3,4})(\d{4})$`, `{2,4}` 탐욕).
 * 라이브 실측 — `ad_company_leads` 8,850건 중 **873건**(약 10%)이 아래 상태였다:
 * ```
 *   0104-233-5119   ← 010-4233-5119   (대표 화면의 "모두의마케팅")
 *   026-403-6767    ← 02-6403-6767    ("군포 중고차 장기렌트")
 *   0704-667-2900   ← 070-4667-2900   ("불법운전학원 1800")
 *   16682606        ← 1668-2606       (8자리는 매칭 자체가 안 돼 하이픈 없음)
 * ```
 * 매장후보(117,179건)는 29건뿐이다 — 그쪽은 공공 API 가 포맷해 주고 **우리가 포맷하는 건 이 레인뿐**이다.
 *
 * ## 🔑 이 파일이 지키는 안전 성질
 * **숫자를 절대 바꾸지 않는다.** 하이픈만 옮긴다 — 그래서 소급 교정이 안전하고(재크롤 0),
 * 이 함수가 틀려도 원본 숫자는 남는다. 마지막 테스트가 그 성질을 직접 고정한다.
 *
 * ## ⚠️ 이 테스트가 못 하는 것
 * 번호가 **그 업체의 것인지**는 못 본다(오귀속). 그건 별개 문제이고 상호 가드가 담당한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatKrPhone, isValidKrPhone, isPlatformRootUrl } from '@/features/marketing/api/contact-enrich'

describe('formatKrPhone — 국번별 하이픈', () => {
  it('🔒 휴대폰 11자리는 3-4-4 (사고 당사자)', () => {
    expect(formatKrPhone('01042335119')).toBe('010-4233-5119')
    expect(formatKrPhone('0104-233-5119')).toBe('010-4233-5119')   // 틀린 포맷을 넣어도 교정된다
    expect(formatKrPhone('010 4381 0105')).toBe('010-4381-0105')
  })

  it('🔒 서울 02 는 국번이 2자리 (3자리로 끊으면 안 된다)', () => {
    expect(formatKrPhone('0234452030')).toBe('02-3445-2030')
    expect(formatKrPhone('026-403-6767')).toBe('02-6403-6767')
    expect(formatKrPhone('021234567')).toBe('02-123-4567')          // 9자리(구 국번)
  })

  it('🔒 070 인터넷전화·지역번호는 3자리', () => {
    expect(formatKrPhone('07046672900')).toBe('070-4667-2900')
    expect(formatKrPhone('03180688528')).toBe('031-8068-8528')
    expect(formatKrPhone('04185402114')).toBe('041-8540-2114')      // 정부등록 API 도 틀리게 준다
    expect(formatKrPhone('0311234567')).toBe('031-123-4567')        // 10자리
  })

  it('🔒 대표번호 8자리는 4-4 (이전엔 매칭 실패로 하이픈이 아예 없었다)', () => {
    expect(formatKrPhone('16682606')).toBe('1668-2606')
    expect(formatKrPhone('15881234')).toBe('1588-1234')
  })

  it('🔒 안심번호 050X 는 국번이 4자리', () => {
    expect(formatKrPhone('05070171380')).toBe('0507-017-1380')      // 이미 맞던 값 — 바뀌면 안 된다
    expect(formatKrPhone('050812345678')).toBe('0508-1234-5678')
  })

  it('한국 번호가 아니면 null — 호출부가 버릴지 정한다', () => {
    expect(formatKrPhone('12345')).toBeNull()
    expect(formatKrPhone('04051200000')).toBeNull()                 // 2026-07-27 사고의 그 번호(존재하지 않는 국번)
    expect(formatKrPhone(null)).toBeNull()
    expect(formatKrPhone('')).toBeNull()
  })

  /**
   * 🔒 **가장 중요한 불변식** — 하이픈만 옮기고 숫자는 그대로.
   *   이게 깨지면 소급 교정이 데이터를 **파괴**한다(되돌릴 원본이 없다).
   */
  it('🔒 숫자열은 절대 바뀌지 않는다 (소급 교정의 안전 근거)', () => {
    const samples = [
      '01042335119', '0234452030', '07046672900', '16682606', '05070171380',
      '03180688528', '021234567', '0311234567', '050812345678', '01199998888',
    ]
    for (const d of samples) {
      const out = formatKrPhone(d)
      expect(out, `${d} 가 포맷되지 않았다`).not.toBeNull()
      expect(out!.replace(/\D/g, ''), `${d} 의 숫자가 바뀌었다`).toBe(d)
    }
  })

  /** 두 함수가 같은 국번 지식을 써야 한다 — 갈리면 "유효한데 포맷 못 함" 이 생긴다. */
  it('isValidKrPhone 이 통과시키는 번호는 반드시 포맷된다', () => {
    for (const d of ['01012345678', '0212345678', '0311234567', '07012345678', '16881234', '05031234567']) {
      expect(isValidKrPhone(d), `${d} 유효성`).toBe(true)
      expect(formatKrPhone(d), `${d} 포맷`).not.toBeNull()
    }
  })
})

/**
 * 🔌 **소급 교정 배선** — 873건을 실제로 고치는 것은 이 배선이다.
 *
 * 포맷 함수만 고치면 **앞으로 들어올 번호**만 맞고 **이미 저장된 873건은 영원히 틀린 채** 남는다.
 * 재분류 레인은 어차피 전 행을 한 바퀴 도므로 거기에 얹었다(추가 스캔 0).
 *
 * ⚠️ 이 테스트는 **코드가 있는지**만 본다(정적). 실제로 고쳐졌는지는 라이브에서만 보인다 —
 *   `SELECT COUNT(*) FROM ad_company_leads WHERE phone LIKE '010_-%' OR phone LIKE '02_-%'` 가 0 으로 가는지.
 */
describe('소급 교정 배선 (재분류 레인)', () => {
  const SRC = readFileSync('src/features/marketing/api/company-discovery.ts', 'utf8')

  it('🔒 재분류 레인이 formatKrPhone 으로 기존 행을 교정한다', () => {
    // ⚠️ import 줄 **전체**를 문자열로 고정하지 말 것 — 같은 파일에 심볼이 하나 더 붙는 순간
    //   무관한 변경이 빨간불을 낸다(실제로 `isPlatformRootUrl` 을 추가하다 그렇게 됐다).
    expect(SRC).toMatch(/import \{[^}]*\bformatKrPhone\b[^}]*\} from '\.\/contact-enrich'/)
    expect(SRC).toMatch(/const fixed = formatKrPhone\(r\.phone\)/)
    // 값이 실제로 UPDATE 로 나가는가 — 계산만 하고 안 쓰면 조용히 아무 일도 안 일어난다.
    expect(SRC).toMatch(/if \(fixed && fixed !== r\.phone\) stmts\.push\([\s\S]{0,200}UPDATE ad_company_leads SET phone = \?/)
  })

  /** 대부분의 행은 이미 정상이다 — 같은 값을 다시 쓰면 회차 예산만 먹는다(무료 플랜에선 그게 곧 수집량이다). */
  it('🔒 값이 같으면 UPDATE 를 만들지 않는다', () => {
    expect(SRC).toMatch(/fixed !== r\.phone/)
  })
})

/**
 * 🏢 **연락처가 그 업체 것인가** — 대표 신고의 두 번째 절반 (2026-08-12, *"이 불일치 문제는 무조건 해결"*).
 *
 * 전화 형식(위)이 맞아도 **그 번호가 남의 것**이면 더 나쁘다. 실측으로 나온 행:
 * ```
 *   이루더스   1877-9737     www.daangn.com      ← 당근마켓 대표번호
 *   블라인드   031-192-5624  www.teamblind.com   ← 회사가 아니라 커뮤니티
 * ```
 * ⚠️ **경로가 있으면 다르다** — `blog.naver.com/nuricom6779` 은 그 업체가 직접 운영하는 블로그라
 *   거기 번호는 그 업체 것이 맞다(실측 `누리컴애드` 042-710-6779). 호스트만 보고 지우면 **멀쩡한 연락처가 죽는다.**
 *   이 구분이 이 함수의 존재 이유이고, 아래 두 테스트가 그 경계를 고정한다.
 */
describe('isPlatformRootUrl — 플랫폼 자기 페이지', () => {
  it('🔒 플랫폼 루트 = 참 (거기 연락처는 플랫폼 것)', () => {
    for (const u of ['https://www.daangn.com', 'https://www.teamblind.com', 'https://cafe.daangn.com/', 'https://www.instagram.com']) {
      expect(isPlatformRootUrl(u), u).toBe(true)
    }
  })

  it('🔒 사용자 페이지(경로 있음) = 거짓 — 그 업체가 직접 운영하는 채널이다', () => {
    for (const u of [
      'https://blog.naver.com/nuricom6779',
      'https://www.instagram.com/foodcenter_daechi',
      'https://cafe.naver.com/somecafe',
    ]) expect(isPlatformRootUrl(u), u).toBe(false)
  })

  it('자체 도메인은 무조건 거짓 (루트여도 그 회사 사이트다)', () => {
    for (const u of ['https://www.modoomkt.com', 'http://www.hwadamtax.com/', 'https://solspectrum.co.kr']) {
      expect(isPlatformRootUrl(u), u).toBe(false)
    }
    expect(isPlatformRootUrl(null)).toBe(false)
    expect(isPlatformRootUrl('not a url')).toBe(false)
  })
})

/**
 * 🏷️ **이름은 연락처와 같은 근거에서 나와야 한다.**
 *
 * `suspectCompanyName` 은 *"업체명이 아닌 것"* 을 열거하는 방식이라 `고객지원`·`군포 중고차 장기렌트`
 * 같은 값을 하나도 못 잡는다(실측 webkr 1,772건 중 플래그 330건뿐). **열거로는 못 이긴다.**
 * ⇒ 사이트가 스스로 밝힌 이름(og:site_name/title)이 있으면 그쪽을 쓴다 — webkr 한정,
 *   대표가 손댄 행(`status !== 'new'`)은 불가침.
 */
describe('webkr 상호 = 사이트 자기 이름 (배선)', () => {
  const SRC = readFileSync('src/features/marketing/api/enrich-lane.ts', 'utf8')

  it('🔒 suspectCompanyName 게이트가 빠졌다 (그게 못 잡던 원인)', () => {
    const block = SRC.slice(SRC.indexOf("t.source === 'webkr' && c.siteName"))
    expect(block.slice(0, 700)).not.toContain('suspectCompanyName')
  })

  it('🔒 대표 수동 편집은 불가침 · 같은 이름은 다시 안 쓴다', () => {
    expect(SRC).toMatch(/t\.source === 'webkr' && c\.siteName && t\.status === 'new'/)
    expect(SRC).toMatch(/norm\(c\.siteName\) !== norm\(t\.company_name \|\| ''\)/)
    expect(SRC).toMatch(/WHERE id = \? AND status = 'new'/)
  })
})

describe('플랫폼 연락처 소급 무효화 (배선)', () => {
  const SRC = readFileSync('src/features/marketing/api/company-discovery.ts', 'utf8')

  it('🔒 재분류 레인이 플랫폼 루트 연락처를 비운다', () => {
    expect(SRC).toContain('isPlatformRootUrl')
    expect(SRC).toMatch(/isPlatformRootUrl\(r\.website\)[\s\S]{0,200}UPDATE ad_company_leads SET phone = NULL, email = NULL/)
  })
})
