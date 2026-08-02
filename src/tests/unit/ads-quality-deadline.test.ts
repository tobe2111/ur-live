/**
 * ⏱️ **품질 패스의 마감선** — 계약 (2026-08-03 라이브 실측 후 신설).
 *
 * ## 실측 — 이 패스는 **영원히 전진 0** 이었을 가능성이 크다
 * ```
 *   cron_hb:ads:maintenance?phase=quality
 *     ok=false  ms=3649  detail=Worker exceeded CPU time limit.
 * ```
 * 상한이 **행 수(MAX=8,000)뿐**이라 한 인보케이션이 16페이지 × 500행을 통째로 채점한다.
 *
 * ## 🩸 재분류보다 나쁜 이유 — 커서 저장이 루프 **뒤**에 있다
 * CPU 로 죽으면 커서 저장 줄에 **도달하지 못한다.** 다음 회차가 같은 지점을 또 훑고 또 죽는다
 * ⇒ **전진 0**. `ads-cpu-deadline.test.ts` 가 통신판매에서 확정한 그 실패 모양 그대로다:
 * *"죽으면 루프 뒤의 커서 저장이 실행되지 않는다. 다음 회차가 같은 페이지를 또 훑고 또 죽는다."*
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 실제 CPU 소모(런타임이 안 준다). 벽시계는 **근사**다.
 * - 값이 충분히 작은지는 라이브 하트비트(`ok` · `stopped_by` · `elapsed_ms`)로만 판정된다.
 * - **실행 검증이 아니다** — 소스 배선만 본다(D1 을 여기서 못 돌린다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QUALITY_DEADLINE_MS_FREE } from '@/features/marketing/api/influencer-quality'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/influencer-quality.ts'), 'utf8')
const CALLER = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/influencer-maintenance.ts'), 'utf8')

describe('품질 패스 — 인보케이션당 총량에 시간 상한이 있다', () => {
  it('🔒 무료 마감선이 **관측된 사망 지점(3,649ms)의 절반 아래** — 근접하면 못 끊는다', () => {
    expect(QUALITY_DEADLINE_MS_FREE).toBeGreaterThan(0)
    expect(QUALITY_DEADLINE_MS_FREE).toBeLessThanOrEqual(1_824)
  })

  it('🔒 루프가 **매 페이지 전에** 마감선을 본다 — 행 수만으로는 CPU 를 못 막는다', () => {
    const loop = SRC.slice(SRC.indexOf('while (scanned < MAX)'))
    expect(loop.slice(0, 300)).toMatch(/Date\.now\(\) - t0 >= deadlineMs.*break/s)
  })

  it('🔒 마감선 중단은 `done` 을 **false 로 남긴다** — true 면 커서가 0 으로 리셋돼 진행이 사라진다', () => {
    const loop = SRC.slice(SRC.indexOf('while (scanned < MAX)'))
    const hit = loop.slice(0, 300)
    expect(hit, '마감선 분기에서 done 을 세우면 안 된다').not.toMatch(/deadlineMs[\s\S]{0,120}done = true/)
    expect(SRC, '커서는 done 일 때만 0 으로 리셋된다').toMatch(/String\(done \? 0 : cursor\)/)
  })

  it('🔒 **중단 사유·경과를 돌려준다** — 매번 deadline 이면 상한을 더 내려야 한다는 신호다', () => {
    expect(SRC).toMatch(/stopped_by: stoppedBy/)
    expect(SRC).toMatch(/elapsed_ms: Date\.now\(\) - t0/)
  })

  it('🔒 호출부가 **요금제 인지 값**을 넘긴다 — 유료 CPU 한도가 커져도 무료 값이면 그대로 남는다', () => {
    expect(CALLER).toMatch(/runQualityPass\(bdb, \{ budget, deadlineMs: envPlanValue\(undefined, QUALITY_DEADLINE_MS_FREE, ([\d_]+), env\) \}\)/)
    const m = /envPlanValue\(undefined, QUALITY_DEADLINE_MS_FREE, ([\d_]+), env\)/.exec(CALLER)!
    expect(Number(m[1].replace(/_/g, '')), '유료가 무료보다 커야 한다').toBeGreaterThan(QUALITY_DEADLINE_MS_FREE)
  })

  it('🔒 호출부가 값을 안 주면 **무료 기본값**으로 떨어진다 — 배선이 빠져도 CPU 로 죽지 않게', () => {
    expect(SRC).toMatch(/opts\?\.deadlineMs\).*\|\| QUALITY_DEADLINE_MS_FREE/)
  })
})
