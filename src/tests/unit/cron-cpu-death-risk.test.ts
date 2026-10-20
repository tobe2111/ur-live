/**
 * 🩸 **위험 판정을 추측에서 기록으로** — 2026-08-09.
 *
 * ## 무엇이 틀렸었나 (라이브 실측)
 * `cpu_risk` 는 **벽시계 `ms`** 로 판정했다. 그런데 워커에서 `Date.now()` 는 **I/O 에서만 흐른다**
 * ⇒ `ms` 는 I/O 시간이고 CPU 와 무관하다. 결과가 **반대로** 나왔다:
 *
 * ```
 * schema-repair-daily  159,066ms → danger   그런데 ok=true (멀쩡)
 * d1-backup            146,975ms → danger   그런데 ok=true (멀쩡)
 * collect-commerce      13,921ms → null     그런데 그 회차에 CPU 로 죽었다
 * collect-storeinfo     13,833ms 사망 → 20,668ms · 80,696ms 생존   (같은 레인)
 * ```
 *
 * 이 지표를 읽고 *"문턱에 붙은 레인 6개"* 라는 목록이 만들어졌고 하마터면 그걸로 작업할 뻔했다.
 *
 * ## 이 테스트가 지키는 것
 * 위험 판정이 **실제 사망 기록**에서 나오고, 사망이 **다음 성공에 지워지지 않는다**(별도 키).
 *
 * ## ⚠️ 못 하는 것
 *  · **예측이 아니다.** 한 번도 안 죽은 레인은 `null` — 그건 "안전"이 아니라 **"모른다"** 이다
 *    (워커가 CPU 시간을 안 주므로 원리적으로 못 잰다). 이 값을 안전 근거로 인용하지 말 것.
 *  · 실제 D1 쓰기 경로(`recordCronBeat`)는 여기서 안 돈다 — 순수 함수와 배선만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cpuRiskFromDeaths, CPU_DEATH_RE, cpuDeathKey } from '@/worker/utils/cron-heartbeat'

const SRC = readFileSync(join(process.cwd(), 'src/worker/utils/cron-heartbeat.ts'), 'utf8')
const NOW = Date.parse('2026-08-09T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

describe('사망 기록 → 위험 등급', () => {
  it('🔒 기록이 없으면 null — **"안전"이 아니라 "모른다"** 이다', () => {
    expect(cpuRiskFromDeaths(0, null, NOW)).toBeNull()
    expect(cpuRiskFromDeaths(null, null, NOW)).toBeNull()
  })

  it('🔒 최근 7일 내 사망 = danger', () => {
    expect(cpuRiskFromDeaths(1, daysAgo(0), NOW)).toBe('danger')
    expect(cpuRiskFromDeaths(3, daysAgo(6), NOW)).toBe('danger')
  })

  it('🔒 30일 내 = warn · 그 밖은 흘려보낸다(옛 사고가 영원히 붉게 남지 않도록)', () => {
    expect(cpuRiskFromDeaths(1, daysAgo(20), NOW)).toBe('warn')
    expect(cpuRiskFromDeaths(1, daysAgo(90), NOW)).toBeNull()
  })

  it('🔒 시각이 깨졌어도 사망 사실은 삼키지 않는다', () => {
    expect(cpuRiskFromDeaths(2, 'not-a-date', NOW)).toBe('warn')
  })
})

describe('사망 감지', () => {
  it('🔒 워커의 CPU 한도 에러 원문을 잡는다 — 이게 유일한 실제 신호다', () => {
    expect(CPU_DEATH_RE.test('err=Error detail=Worker exceeded CPU time limit.')).toBe(true)
  })
  it('🔒 다른 실패를 CPU 사망으로 오인하지 않는다', () => {
    expect(CPU_DEATH_RE.test('err=HTTP 503 SERVICETIMEOUT_ERROR')).toBe(false)
    expect(CPU_DEATH_RE.test('ok=true rows=12000')).toBe(false)
  })
})

describe('🔌 배선', () => {
  it('🔒 사망은 **별도 키**에 산다 — 하트비트 행에 두면 다음 성공이 지운다', () => {
    expect(cpuDeathKey('ads:collect-commerce')).toBe('cron_cpu_death:ads:collect-commerce')
    expect(SRC).toMatch(/cron_cpu_death:/)
  })

  it('🔒 위험 판정이 **사망 기록**에서 나온다 — 벽시계로 되돌아가면 다시 반대로 찍힌다', () => {
    const listing = SRC.slice(SRC.indexOf('export async function listCronHeartbeats'))
    expect(listing).toMatch(/cpu_risk:\s*cpuRiskFromDeaths\(/)
    expect(listing, 'cpu_risk 를 다시 ms 로 계산하면 안 된다').not.toMatch(/cpu_risk:\s*cpuRisk\(ms\)/)
  })

  it('🔒 ms 기반 값은 버리지 않고 **io_slow** 로 남는다 — 느린 건 그 자체로 정보다(CPU 위험은 아니다)', () => {
    expect(SRC.slice(SRC.indexOf('export async function listCronHeartbeats'))).toMatch(/io_slow:\s*cpuRisk\(ms\)/)
  })

  it('🔒 사망 누적은 **실패 + CPU 에러**일 때만 — 성공 경로에 비용을 붙이지 않는다(93레인 × 매시간)', () => {
    expect(SRC).toMatch(/if \(!ok && CPU_DEATH_RE\.test\(summarizeResult\(result\) \|\| ''\)\) await bumpCpuDeath\(/)
  })
})
