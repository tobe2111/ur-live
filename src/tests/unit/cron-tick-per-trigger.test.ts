/**
 * 🔬 **진단 프로브가 트리거를 구분한다** (2026-08-25).
 *
 * ## 왜 필요했나 (실측)
 *
 * `__tick` 이 전역 키 하나여서, 같은 분에 여러 트리거가 울리면 **마지막 하나가 덮어썼다.**
 * 그 결과 두 가지를 못 가렸다:
 *
 * 1. `*​/15` 전용 백업 트리거가 실제로 발화하는가 — `*​/15` 의 분(:00/:15/:30/:45)은 **전부**
 *    `*​/5` 의 분이기도 하다. CF 에 등록은 확인했는데(API 직접 조회) 하트비트에는 그 cron 식이
 *    한 번도 안 찍혔다. 전역 tick 으로는 "안 울렸다"와 "울렸는데 덮였다"가 같아 보인다.
 * 2. 2026-08-24 에 `0 18` 블록 16개가 통째로 빠졌을 때, 트리거가 안 울린 건지 인보케이션이
 *    기록 전에 죽은 건지.
 *
 * ⇒ 키를 `__tick:<cron식>` 으로 쪼개면 **쓰기 횟수 그대로** 두 질문이 다 측정된다.
 *
 * ⚠️ **이 테스트가 못 막는 것**: 실제로 CF 가 그 트리거를 발화시키는지(레포 밖). 여기서 고정하는
 *   것은 *발화했다면 구분해 기록되는가* 하나다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const code = readFileSync('src/worker/scheduled.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')

describe('__tick 진단 프로브 — 트리거별', () => {
  it('🔴 tick 키에 cron 식이 들어간다 — 전역 키 하나로 되돌아가면 트리거를 못 가린다', () => {
    expect(code, "`__tick` 이 다시 전역 키가 됐다").toMatch(/recordCronBeat\(env,\s*`__tick:\$\{cron\}`/)
    expect(code, '전역 tick 리터럴이 되살아났다').not.toMatch(/recordCronBeat\(env,\s*'__tick'/)
  })

  it('🔴 여전히 인보케이션 맨 앞이다 — 뒤로 밀리면 "아무도 예산을 안 쓴 시점"이라는 성질을 잃는다', () => {
    const tickAt = code.indexOf('`__tick:${cron}`')
    const firstSafeCron = code.search(/ctx\.waitUntil\(safeCron\(/)
    expect(tickAt, 'tick 호출을 못 찾았다 — 통과 아님').toBeGreaterThan(0)
    expect(tickAt, 'tick 이 다른 작업 뒤로 밀렸다').toBeLessThan(firstSafeCron)
  })

  it('🔴 safeCron 으로 감싸지 않는다 — 감싸면 실패 시 자기 자신을 못 남긴다', () => {
    const line = code.split('\n').find((l) => l.includes('`__tick:${cron}`')) ?? ''
    expect(line, 'tick 이 safeCron 안으로 들어갔다').not.toMatch(/safeCron\(/)
  })
})
