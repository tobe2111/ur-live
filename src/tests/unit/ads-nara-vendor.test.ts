/**
 * 🏛️ **나라장터 조달업체 레인** — 대행사 새 수집 루트 (2026-08-11 대표 *"아직 손 안댄거 다 해줘"*).
 *
 * ## 🩸 이 레인은 한 번 지워졌다 — 그 오독을 테스트로 못 박는다
 * 2026-07-27 에 만들었다가 **15회 연속 코드 12(`NO_OPENAPI_SERVICE_ERROR`)** 를 *"이 주소가 폐기됐다"* 로
 * 읽고 2026-08-04 에 통째로 삭제했다. 실제 원인은 **오퍼레이션 이름에 `02` 가 빠진 것**이었다
 * (2026-08-10 대표가 공유한 포털 Swagger 로 확정: `getPrcrmntCorpBasicInfo02`).
 * 코드 12 는 *주소 부재*와 *오퍼레이션 오타*를 **구분하지 못한다** — 그래서 이 레인은
 * 이름을 추측에 맡기지 않고 **라이브가 한 번 재고 그 답을 기억**한다.
 *
 * ## ⚠️ 이 테스트가 못 하는 것 (과신 금지)
 * 실제 API 응답은 검증할 수 없다 — 이 환경은 `apis.data.go.kr` 이 프록시 차단(CONNECT 403)이다.
 * 여기서 고정하는 것은 **순수 함수의 판정**과 **배선**뿐이고, 필드 매핑이 맞는지는
 * 첫 회차의 `diag.sample`(라이브 응답 원문 1건)로만 확인된다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { NARA_VENDOR_BASE, NARA_VENDOR_OP, AGENCY_RE } from '@/features/marketing/api/nara-vendor-collect'

const SRC = 'src/features/marketing/api/nara-vendor-collect.ts'
const src = fs.readFileSync(SRC, 'utf8')

describe('확정된 스펙 (대표 Swagger 화면 2026-08-10)', () => {
  it('🔒 오퍼레이션에 02 가 붙어 있다 — 이게 빠져서 15회를 버렸다', () => {
    expect(NARA_VENDOR_OP).toBe('getPrcrmntCorpBasicInfo02')
    expect(NARA_VENDOR_BASE).toBe('https://apis.data.go.kr/1230000/ao/UsrInfoService02')
  })

  /**
   * 후보 순회를 **코드 12 밖으로 넓히면** 키·트래픽·파라미터 오류에도 N배로 쏴서 예산만 태운다
   * (공정위 레인에서 실제로 겪었다). 조건을 조인다.
   */
  it('🔒 후보 오퍼레이션은 코드 12 일 때만 시도한다', () => {
    expect(src).toMatch(/r\.code === '12'/)
    // 첫 페이지에서 한 번만 — 매 페이지마다 돌면 회차가 후보 순회로 끝난다.
    expect(src).toMatch(/i === 0 && !r\.items\.length && r\.code === '12'/)
  })

  it('🔒 맞은 이름을 기억한다 (다음 회차는 재시도 0)', () => {
    expect(src).toMatch(/bind\(OP_KEY, op\)/)
  })

  it('🔒 env 로 무배포 교정이 가능하다 (추측이 굳지 않게)', () => {
    expect(src).toMatch(/ADS_NARA_VENDOR_ENDPOINT/)
    expect(src).toMatch(/ADS_NARA_VENDOR_OP/)
    // env 가 있으면 후보 순회를 하지 않는다 — 대표가 고정한 값을 코드가 덮으면 안 된다.
    expect(src).toMatch(/r\.code === '12' && !envOp/)
  })
})

describe('죽는 방식이 정해져 있다', () => {
  /**
   * 🩸 커서 저장이 루프 **뒤**에 있으므로, 마감선이 없으면 인보케이션 한도에 맞아 죽을 때
   * 저장에 도달하지 못하고 다음 회차가 **같은 페이지를 또 훑는다(전진 0)**.
   * commerce·quality 가 그렇게 조용히 멈췄고, **지워진 옛 버전의 이 레인에는 이 마감선이 없었다.**
   */
  it('🔒 벽시계 마감선이 있고 루프가 그걸 본다', () => {
    expect(src).toMatch(/const VENDOR_RUN_MS = 6_000/)
    expect(src).toMatch(/if \(Date\.now\(\) >= runDeadline\) \{ stoppedBy = 'deadline'; break \}/)
  })

  it('🔒 커서는 어떤 경로로 끝나도 저장된다 (루프 밖)', () => {
    const loopEnd = src.indexOf('    page++\n  }')
    const save = src.indexOf('bind(CURSOR_KEY, String(page))')
    expect(loopEnd).toBeGreaterThan(0)
    expect(save).toBeGreaterThan(loopEnd)   // 루프가 끝난 뒤에 저장한다
  })

  it('🔒 무엇 때문에 멈췄는지 남긴다 (안 보이면 또 오진한다)', () => {
    expect(src).toMatch(/stoppedBy/)
  })
})

describe('명단의 질', () => {
  it('🔒 연락처 없는 행은 저장하지 않는다', () => {
    expect(src).toMatch(/requireContact: true/)
  })

  it('대행사 계열만 받는다 — 이 원부는 대부분 건설·물품이다', () => {
    expect(AGENCY_RE.test('세종광고기획')).toBe(true)
    expect(AGENCY_RE.test('한빛마케팅')).toBe(true)
    expect(AGENCY_RE.test('대한종합건설')).toBe(false)
    expect(AGENCY_RE.test('우리전기공사')).toBe(false)
  })

  /**
   * 원부가 전화를 `***********` 로 가려서 주는 경우가 있다(계약 레인 실측). 그대로 저장하면
   * **연락처가 있는 것처럼 세어져** 명단 수가 거짓이 된다 — 유어애즈의 유일한 지표가 그 수다.
   */
  it('🔒 마스킹된 값은 버린다', () => {
    expect(src).toMatch(/const unmasked =/)
    expect(src).toMatch(/s\.includes\('\*\*\*'\)/)
  })

  /**
   * 홈페이지는 스킴 없이 오는 경우가 많다. 그대로 두면 이메일 크롤 레인이 못 쓰고,
   * 이 레인의 값어치(연락처 병목 해소) 절반이 사라진다.
   */
  it('🔒 홈페이지를 정규화해 크롤 레인이 이어받게 한다', () => {
    expect(src).toMatch(/const normUrl =/)
    expect(src).toMatch(/website: site/)
    // 전화가 없고 홈페이지만 있으면 출처는 'web' — 정직해야 다음 사람이 오독하지 않는다.
    expect(src).toMatch(/contact_source: phone \? 'govreg' : \(site \? 'web' : null\)/)
  })
})

describe('배선 — 만들어 놓고 안 부르면 없는 것과 같다', () => {
  it('🔒 cron·알람·라우트 세 곳에 전부 등록됐다', () => {
    expect(fs.readFileSync('src/worker-ads/index.ts', 'utf8'))
      .toMatch(/gates\.dailyAt\(15, '\/__ads\/collect-nara-vendor'/)
    expect(fs.readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8'))
      .toMatch(/'collect-nara-vendor': \{/)
    expect(fs.readFileSync('src/worker-ads/public-data.routes.ts', 'utf8'))
      .toMatch(/'\/__ads\/collect-nara-vendor'/)
  })

  /** 표에 없으면 `isKnownLane` 이 거짓이 되어 디스패치 스냅샷의 `unknown` 으로 샌다. */
  it('🔒 도메인 표에 등록됐다', () => {
    expect(fs.readFileSync('src/worker-ads/lane-domains.ts', 'utf8'))
      .toMatch(/'collect-nara-vendor': '(influencer|company|prospect|wholesale)'/)
  })
})
