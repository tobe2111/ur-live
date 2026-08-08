/**
 * 🏢 공정위 가맹 브랜드 레인 — **오퍼레이션 이름 하나로 21회를 버렸다** (2026-08-05).
 *
 * ## 무엇이 있었나
 * ```
 *   ads_franchise_stats: total_runs 21 · total_saved 0
 *   error: HTTP 400 · NO_OPENAPI_SERVICE_ERROR
 * ```
 * 승인·활용기간(2026-07-27~2028-07-27)·키 전부 정상인데 **`getBrandList` 라는 이름이 그 주소에 없었다.**
 * 포털 Swagger 화면으로 확인한 실제 이름은 **`getBrandinfo`**(응답 모델도 `getBrandinfo_response`).
 *
 * 🩸 **왜 오래 안 잡혔나**: 소스 주석이 *"✅ 실 엔드포인트(웹 확인 2026-07-23)"* 라고 단언하고 있었다.
 *   그런데 이 환경은 `apis.data.go.kr` 이 프록시 차단이라 **개발 중에 찔러볼 수가 없다** — 확인했다는
 *   문장만 남고 검증은 비어 있었다. 문서가 증거를 대신한 자리다.
 *
 * ## 그래서 추측을 코드에 굳히지 않는다
 * Swagger 글자가 작아 대소문자를 100% 단정하기 어렵다. 이름을 하나 더 찍는 대신 **한 번의 실측으로
 * 스스로 정하게** 한다: 주소 부재면 후보를 순회하고, 맞는 이름을 `platform_settings` 에 기억한다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 어느 이름이 진짜인지. 그건 라이브 호출만 안다 —
 *   여기서 지키는 건 *"틀렸을 때 스스로 회복할 수 있는가"* 다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/franchise-collect.ts'), 'utf8')
/** 주석을 지운 사본 — 배선은 코드에서만 판정한다(이 레포가 반복해 밟은 "주석에만 남아도 통과" 함정). */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('오퍼레이션 이름', () => {
  it('🔒 기본값이 Swagger 로 확인한 이름이다 — 옛 `getBrandList` 로 되돌아가면 다시 21회를 버린다', () => {
    expect(CODE).toMatch(/const FRANCHISE_OP = 'getBrandinfo'/)
  })

  it('🔒 후보 목록이 비어 있지 않다 — 비면 자가회복이 통째로 사라진다', () => {
    const m = /const FRANCHISE_OP_FALLBACKS = \[([^\]]*)\]/.exec(CODE)
    expect(m, '후보 목록 선언을 못 찾았다(낡은 지도)').not.toBeNull()
    expect((m as RegExpExecArray)[1].split(',').filter(s => s.trim()).length).toBeGreaterThanOrEqual(2)
  })

  it('🔒 옛 이름이 후보에 남아 있다 — 우리 판정이 틀렸을 경우의 복귀로', () => {
    expect(CODE).toContain("'getBrandList'")
  })
})

describe('자가회복 — 틀린 이름에서 스스로 빠져나온다', () => {
  it('🔒 **주소 부재일 때만** 후보를 돌린다 — 키·트래픽 오류에 돌리면 같은 실패를 N배로 반복한다', () => {
    expect(CODE, '조건 없이 후보를 순회하면 실패 회차마다 예산을 3배로 태운다')
      .toMatch(/NO_OPENAPI_SERVICE_ERROR\/i\.test\(msg\)/)
  })

  it('🔒 첫 페이지에서만 시도한다 — 매 페이지마다 돌리면 회차 예산이 사라진다', () => {
    expect(CODE).toMatch(/if \(i === 0 && !count && msg && \/NO_OPENAPI_SERVICE_ERROR/)
  })

  it('🔒 맞는 이름을 **기억한다** — 안 하면 매 회차 재시도로 예산을 계속 흘린다', () => {
    expect(CODE).toMatch(/bind\(OP_KEY, useOp\)/)
    expect(CODE, '기억한 값을 읽지 않으면 저장이 무의미하다').toMatch(/bind\(OP_KEY\)[\s\S]{0,120}\.first</)
  })

  it('🔒 우선순위 = env > 학습값 > 기본 — 대표가 넣은 값이 학습값에 덮이면 안 된다', () => {
    expect(CODE).toMatch(/ADS_FRANCHISE_OP.*\|\| learnedOp \|\| FRANCHISE_OP/)
  })

  it('🔒 후보 호출도 예산을 쓴다 — 예산 밖에서 쏘면 서브리퀘스트 한도를 그대로 넘긴다', () => {
    expect(CODE).toMatch(/if \(cand === useOp \|\| budget\.left <= 0\) continue/)
  })
})

/**
 * 🩸 **2026-08-07 후속 — 이름을 고쳤더니 다음 층에서 같은 병이 나왔다.**
 *
 * 오퍼레이션 이름 수정 후 `NO_OPENAPI_SERVICE_ERROR` 는 사라졌는데 3회 연속 `found 0 · error 없음`.
 * 에러가 없는 게 아니라 **에러를 읽는 자리가 비어 있었다**: 결과코드를 `header.resultCode` 에서만
 * 읽는데, 이 API 응답은 **평평하다**(Swagger `getBrandinfo_response { resultCode, …, items }`).
 * `header` 가 undefined → `rc`/`rm` 이 빈 문자열 → 실패 판정이 **무조건 통과**.
 *
 * ⚠️ 이 시험이 못 보는 것: 실제로 데이터가 오는지. 그건 라이브만 안다 —
 *   여기서 지키는 건 *"실패가 실패로 보이는가"* 다.
 */
describe('응답 봉투 — 실패가 조용히 성공처럼 보이면 안 된다', () => {
  it('🔒 결과코드를 header **또는 평평한 최상위** 어디서든 읽는다', () => {
    expect(CODE, 'header 에서만 읽으면 평평한 응답의 오류코드를 영영 못 본다')
      .toMatch(/const codeSrc = \(resp\.header \?\? resp \?\? data\)/)
    expect(CODE).toMatch(/String\(codeSrc\.resultCode/)
    expect(CODE).toMatch(/String\(codeSrc\.resultMsg/)
  })

  it('🔒 `header` 유무로 결과코드 읽기를 가르지 않는다 — 그게 이 버그의 형태였다', () => {
    expect(CODE, "옛 형태(header ? … : '')가 살아 있다").not.toMatch(/header \? String\(header\.resultCode/)
  })

  it('🔒 **0건이면 그 사실을 남긴다** — 안 남기면 "에러 없는데 0건"으로 또 막힌다', () => {
    expect(CODE).toMatch(/arr\.length === 0 \?/)
    expect(CODE, 'totalCount 를 같이 남겨야 정상 0건과 조용한 실패가 갈린다').toMatch(/totalCount=/)
  })
})
