/**
 * 🏛️ **공공데이터 두 레인의 주소·오퍼레이션·파라미터** — 대표 화면으로 확정 (2026-08-12).
 *
 * ## 왜 테스트로 못 박나
 * 이 둘은 **몇 달간 0건**이었고, 원인이 전부 *"이름 한 글자"* 였다:
 * ```
 *   공정위   연도 파라미터가 `yr` 이 아니라 `jngBizCrtraYr`      → 코드 11(필수 파라미터 누락)
 *   기업마당 주소·오퍼레이션이 둘 다 틀림(hpsBnaSituService/getSupportBusinessList)
 *            → 코드 12(주소 없음). 그런데 그 코드는 **오퍼레이션 오타와 구분되지 않는다**
 * ```
 * 이 환경은 `apis.data.go.kr` 이 프록시 차단(CONNECT 403)이라 **개발 중에 찔러볼 수가 없다.**
 * ⇒ 확정된 값은 **추측으로 되돌아가지 못하게** 여기서 잠근다. 되돌아가면 또 몇 달간 조용히 0건이다.
 *
 * ## 🩸 내가 틀렸던 것 (기록)
 * 2026-08-11 에 *"연도 가설은 기각됐다"* 고 적었다. **반만 맞았다** — 연도가 필요한 건 맞았고
 * **이름**이 틀렸다. 자가치유가 2025·2026·2024 를 다 시도해도 실패한 건 값이 아니라 **키**가
 * 틀렸기 때문이다. 그때 *"다음 후보를 추측하지 말고 화면을 받자"* 로 멈춘 판단은 옳았다(교훈 ⑪).
 *
 * ## ⚠️ 이 테스트가 못 하는 것
 * 실제 응답은 검증할 수 없다. 여기서 고정하는 것은 **요청을 어떻게 만드는가**뿐이고,
 * 필드 매핑이 맞는지는 첫 회차의 `diag.sample`(응답 원문 1건)로만 확인된다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { FRANCHISE_BASE, FRANCHISE_OP, FRANCHISE_YR_PARAM } from '@/features/marketing/api/franchise-collect'
import { BIZINFO_OP } from '@/features/marketing/api/notice-scan'

const FR = fs.readFileSync('src/features/marketing/api/franchise-collect.ts', 'utf8')
const NT = fs.readFileSync('src/features/marketing/api/notice-scan.ts', 'utf8')

describe('공정위 가맹 브랜드목록조회', () => {
  it('🔒 연도 파라미터는 `jngBizCrtraYr` — `yr` 이 아니다(코드 11 의 진짜 원인)', () => {
    expect(FRANCHISE_YR_PARAM).toBe('jngBizCrtraYr')
    // URL 조립이 실제로 그 상수를 쓰는가 — 리터럴로 되돌아가면 조용히 깨진다
    expect(FR).toMatch(/&\$\{FRANCHISE_YR_PARAM\}=\$\{encodeURIComponent\(yr\)\}/)
    expect(FR).not.toMatch(/&yr=\$\{encodeURIComponent/)
  })

  it('🔒 주소·오퍼레이션은 확정값 그대로', () => {
    expect(FRANCHISE_BASE).toBe('https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service')
    expect(FRANCHISE_OP).toBe('getBrandinfo')
  })

  /**
   * 🩸 이름을 고친 뒤엔 코드 11 이 안 나온다 — **연도만 틀리면 '오류 없이 0건'** 이 되고,
   *   순회 조건이 코드 11 뿐이면 그 상태가 **영원히** 간다(이 레포의 '조용한 부재' 클래스).
   *   포털 샘플값이 2017 이라 최신 연도가 비어 있을 가능성이 실제로 있다.
   */
  it('🔒 연도 순회가 "오류 없이 0건"에서도 돈다', () => {
    expect(FR).toMatch(/if \(i === 0 && !count && \(!msg \|\| \/ESSENTIAL_PARAMETER_ERROR/)
  })

  it('연도 후보가 최신 한 해에만 걸려 있지 않다 (샘플이 2017 이다)', () => {
    const m = /return \[([^\]]+)\]/.exec(FR.slice(FR.indexOf('const yearCandidates')))
    expect(m).toBeTruthy()
    expect((m![1].match(/String\(y/g) || []).length).toBeGreaterThanOrEqual(4)
  })
})

describe('기업마당 지원사업 공고', () => {
  it('🔒 주소·오퍼레이션은 대표 화면 확정값', () => {
    expect(NT).toContain("const BIZINFO_BASE = 'https://apis.data.go.kr/1421000/bizinfo'")
    expect(BIZINFO_OP).toBe('pblancBsnsService')
    // 옛 값으로 되돌아가면 또 몇 달간 코드 12 다.
    // ⚠️ 파일 전체를 `not.toContain` 하면 **옛 값을 설명하는 주석까지** 잡는다(첫 초안이 그래서 빨간불이었다).
    //   경위 기록은 남겨야 하므로, 검사는 **실제 코드**(상수 선언·URL 조립)로 좁힌다.
    const code = NT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toContain('hpsBnaSituService')
    expect(code).not.toContain('getSupportBusinessList')
  })

  /**
   * ⚠️ 포맷 파라미터 이름이 **두 서비스가 서로 다르다**(공정위 `resultType` / 기업마당 `dataType`).
   *   한쪽 이름을 다른 쪽에 복사하면 필수 파라미터 오류로 다시 0건이 된다 — 실제로 그렇게 틀려 있었다.
   */
  it('🔒 포맷은 `dataType`, 검색은 `hashtags`', () => {
    expect(NT).toMatch(/\$\{BIZINFO_OP\}\?serviceKey=/)
    expect(NT).toMatch(/&dataType=json/)
    expect(NT).toMatch(/&hashtags=\$\{encodeURIComponent\(kw\)\}/)
    expect(NT).not.toMatch(/searchCnst=/)
  })

  it('입찰 경로는 건드리지 않았다 (그쪽은 이미 정상 수집 중)', () => {
    expect(NT).toContain('getDataSetOpnStdBidPblancInfo')
    expect(NT).toContain("const NARA_BASE = 'https://apis.data.go.kr/1230000/ao/PubDataOpnStdService'")
  })
})
