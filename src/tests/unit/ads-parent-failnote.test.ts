/**
 * 💥 **부모가 남기는 실패 기록에 원문이 실리는가** — 불변식 (2026-08-01 라이브 장애 후 신설).
 *
 *   실측: 외부 HTTP 를 쓰는 레인 **12개**가 매시간 죽는데, 하트비트의 실패 사유가 전부 `err=Error`
 *   한 단어였다. `cronErrorCode` 는 `name || 'Error'` 를 돌려주므로 **평범한 Error 는 메시지를 통째로
 *   잃는다.** 그래서 "한도인가 · 네트워크인가 · 자식이 강제 종료됐나"를 하나도 못 좁혔다.
 *
 *   ⚠️ 왜 부모가 남겨야 하나: 자식 인보케이션이 **강제 종료**되면 자식측 기록(#904 `writeSelfBeat`)은
 *   실행조차 안 된다. 그 경우 부모의 이 한 줄이 **유일한 단서**다.
 *
 *   ⚠️ 이 검사가 못 막는 것: 원문이 비어 있는 에러(메시지 없는 throw)는 여전히 분류만 남는다.
 *   그리고 형태만 본다 — 실제로 기록되는지는 라이브 하트비트로 확인한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { summarizeResult, cronErrorCode } from '@/worker/utils/cron-heartbeat'

describe('cronErrorCode — 분류는 하되 원문을 대신하지 못한다', () => {
  it('한도·타임아웃은 분류된다(그건 그대로 유용하다)', () => {
    expect(cronErrorCode(new Error('Too many subrequests'))).toBe('limit')
    expect(cronErrorCode(new Error('The operation was aborted due to timeout'))).toBe('timeout')
  })

  it('🕳️ 평범한 Error 는 **메시지를 잃는다** — 이게 12개 레인을 진단 불가로 만든 지점이다', () => {
    expect(cronErrorCode(new Error('Network connection lost'))).toBe('Error')
  })
})

describe('요약이 원문을 살려 보낸다', () => {
  it('detail 이 있으면 한 줄 요약에 실린다', () => {
    const out = summarizeResult({ err: 'Error', detail: 'Network connection lost' }) || ''
    expect(out).toContain('Error')
    expect(out).toContain('Network connection lost')
  })

  it('긴 원문도 버리지 않고 자른다(24자 컷으로 증발하던 회귀 방지)', () => {
    const long = 'x'.repeat(200)
    const out = summarizeResult({ err: 'Error', detail: long }) || ''
    expect(out).toContain('detail=')
    expect(out.length).toBeGreaterThan(40)
  })
})

/**
 * 🔗 배선 — 부모가 실제로 detail 을 싣는가.
 */
describe('worker-ads adsBeat — 실패 기록에 원문을 함께 싣는다', () => {
  const SRC = readFileSync(resolve(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')

  it('🔒 실패 result 에 detail 이 들어간다', () => {
    expect(SRC).toMatch(/const detail = ok \? '' :/)
    expect(SRC).toMatch(/err: cronErrorCode\(err\)[^\n]*detail/)
  })

  it('🔒 분류(cronErrorCode)는 그대로 유지한다 — limit/timeout 구분은 AIMD 가 쓴다', () => {
    expect(SRC).toContain('cronErrorCode(err)')
  })

  it('성공 회차에는 detail 을 안 싣는다(성공 기록을 오염시키지 않게)', () => {
    expect(SRC).toMatch(/ok \? extra :/)
  })
})
