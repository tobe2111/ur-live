import { describe, it, expect } from 'vitest'
import { cronErrorCode, summarizeResult } from '@/worker/utils/cron-heartbeat'

/**
 * 🏷️ 2026-07-29 — 실패 하트비트에 사유가 없던 갭의 회귀 방지.
 *
 *   06:00 회차에 ur-ads 4개 레인이 **동시에** `ok:false` 로 죽었는데 어드민에는 `result: null` 뿐이었다.
 *   전부 2~6초 만에 끝난 초기 사망인데 예산 고갈인지 다른 예외인지 화면에서 구분되지 않았다.
 *
 *   ⚠️ 원래 함정: `summarizeResult` 가 **24자 초과 문자열을 버렸다**.
 *   `Too many subrequests by single Worker invocation`(47자)을 그대로 넘기면 통째로 사라졌고,
 *   그래서 호출부가 짧은 분류 코드(`cronErrorCode`)로 줄이는 계약이 생겼다.
 *
 *   ✂️ **같은 날 그 드롭 자체를 없앴다**(자르되 버리지 않는다). 두 세션이 같은 갭을 각자 만나
 *   한쪽은 '호출부가 줄인다', 다른 쪽은 '요약기가 안 버린다'로 고쳤고 — **둘 다 남긴다**:
 *   원문 보존과 정규화 코드는 다른 일이다(코드는 집계·자동대응용, 원문은 사람이 읽는 용).
 *   실제로 이 병합이 아니었으면 main 의 새 드라이버 하트비트(`error` 를 120자로 잘라 넘긴다)가
 *   **그 24자 규칙에 걸려 또 사라졌을 것**이다.
 */
describe('cronErrorCode — 실패를 짧은 분류 코드로', () => {
  it('🔒 서브리퀘스트 한도는 limit — AIMD 가 반응해야 하는 유일한 신호', () => {
    expect(cronErrorCode(new Error('Too many subrequests by single Worker invocation'))).toBe('limit')
    expect(cronErrorCode(new Error('Too many API requests by single worker invocation'))).toBe('limit')
  })
  it('타임아웃은 timeout(이름/문구 어느 쪽으로 와도)', () => {
    const e = new Error('The operation was aborted'); e.name = 'TimeoutError'
    expect(cronErrorCode(e)).toBe('timeout')
    expect(cronErrorCode(new Error('request timeout'))).toBe('timeout')
  })
  it('그 외는 예외 이름(24자 이내) — summarizeResult 가 버리지 않는 길이', () => {
    expect(cronErrorCode(new TypeError('x is not a function'))).toBe('TypeError')
    expect(cronErrorCode(null)).toBe('Error')
    expect(cronErrorCode(cronErrorCode).length).toBeLessThanOrEqual(24)
  })
})

describe('summarizeResult — 실패 사유가 실제로 남는가', () => {
  it('🔒 짧은 분류 코드는 보존된다(호출부가 이 형태로 넘긴다)', () => {
    expect(summarizeResult({ err: 'limit' })).toBe('err=limit')
    expect(summarizeResult({ err: 'timeout' })).toBe('err=timeout')
    expect(summarizeResult({ err: 'TypeError' })).toBe('err=TypeError')
  })

  it('🔒 원문도 이제는 사라지지 않는다 — 버리지 말고 자른다', () => {
    const raw = 'Too many subrequests by single Worker invocation'
    expect(raw.length).toBeGreaterThan(24)
    const out = summarizeResult({ err: raw })
    expect(out).toBeTruthy()
    expect(out).toContain('Too many subrequests')   // 사람이 읽고 판단할 만큼은 남는다
  })

  it('성공 회차(undefined)는 요약을 만들지 않는다', () => {
    expect(summarizeResult(undefined)).toBeNull()
    expect(summarizeResult(null)).toBeNull()
  })

  it('숫자·불리언 결과는 그대로 요약된다(기존 계약 보존)', () => {
    expect(summarizeResult({ saved: 12, done: true })).toBe('saved=12 done=true')
  })

  it('요약 길이는 상한을 넘지 않는다(스탬프 오염 방지)', () => {
    const big: Record<string, number> = {}
    for (let i = 0; i < 100; i++) big[`k${i}`] = i
    expect((summarizeResult(big) || '').length).toBeLessThanOrEqual(160)
  })

  // 🔒 2026-08-01 라이브 실측으로 잡힌 두 번째 증발. 24자 드롭과 같은 클래스다.
  //   `cron-env-missing`(없는 키)·`cron-unmatched`(매칭 안 된 cron 식)이 문자열을 반환했는데
  //   객체가 아니라는 이유로 null 이 되어, **하트비트에 이름만 남고 내용이 사라졌다.**
  //   "무엇이 없는지"가 그 관측의 존재 이유였는데 정확히 그것만 없어졌다.
  it('🔒 문자열 결과가 통째로 사라지지 않는다', () => {
    expect(summarizeResult('TOSS_SECRET_KEY(scheduled-cleanup)')).toBe('TOSS_SECRET_KEY(scheduled-cleanup)')
    expect(summarizeResult("cron='0 7 * * *' 에 대응하는 핸들러가 없다")).toContain('0 7 * * *')
  })

  it('문자열도 상한을 넘지 않고, 빈 문자열은 요약을 만들지 않는다', () => {
    expect((summarizeResult('x'.repeat(500)) || '').length).toBeLessThanOrEqual(160)
    expect(summarizeResult('')).toBeNull()
    expect(summarizeResult('   ')).toBeNull()
  })

  it('숫자·불리언·배열 원시 반환도 남는다', () => {
    expect(summarizeResult(0)).toBe('0')      // 0건도 사실이다 — falsy 라고 버리면 안 된다
    expect(summarizeResult(false)).toBe('false')
    expect(summarizeResult(['a', 'b'])).toContain('[2]')
    expect(summarizeResult([])).toBeNull()
  })
})
