/**
 * ⏱️ **재분류 패스 루프의 마감선** — 계약 (2026-08-03 라이브 실측 후 신설).
 *
 * ## 실측 — 이 레인은 **매시간 죽고 있었다**
 * ```
 *   cron_hb:ads:reclassify-company?passes=5
 *     ok=false  ms=3880  detail=Worker exceeded CPU time limit.
 * ```
 * 5패스 × 1,000행 × 행당 정규식 ~20개 = **10만 회**를 한 인보케이션에서 돌린다.
 *
 * ## 이건 이미 세운 교리를 **호출부**가 어긴 것이다
 * `ads-cpu-work-cap.test.ts` 가 2026-07-31 에 확정했다 —
 * *"막아야 하는 것은 페이지 크기가 아니라 **인보케이션당 총 작업량**"*.
 * `reclassifyCompanyLeads` 자체는 호출당 1,000행으로 이미 묶여 있다. **루프를 도는 쪽**이 문제였다.
 *
 * ## ✅ 커버리지 손실 0
 * 각 패스가 끝날 때 커서를 저장하고 `done:false` 로 남긴다 — 일찍 멈춰도 다음 회차가 이어받는다.
 * 그래서 이 마감선은 **처리량을 줄이지 않는다**(오히려 매번 죽던 회차가 부분 성공으로 바뀐다).
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 실제 CPU 소모(런타임이 안 준다). 벽시계는 **근사**다 — 대기 시간이 섞인다.
 * - 마감선 값이 충분히 작은지는 라이브 하트비트(`ok`·`elapsed_ms`·`stopped_by`)로만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
const LOOP = SRC.slice(SRC.indexOf("kick('/__ads/reclassify-company"), SRC.indexOf("kick('/__ads/reclassify-company") + 2200)

describe('재분류 — 인보케이션당 총량에 상한이 있다', () => {
  it('🔒 패스 루프가 **마감선**을 본다 — 없으면 5패스를 무조건 돌아 CPU 한도에 닿는다', () => {
    expect(LOOP, '루프 조건에 경과 시간 검사가 있어야 한다').toMatch(/passes < 5 && !last\.done && Date\.now\(\) - t0 < deadlineMs/)
  })

  it('🔒 무료 마감선이 **관측된 사망 지점(3,880ms)의 절반 아래** — 근접하면 못 끊는다', () => {
    const m = /envPlanValue\(undefined, ([\d_]+), ([\d_]+), env\)/.exec(LOOP)
    expect(m, '마감선 상수를 못 찾았다(호출 형태가 바뀌었나)').toBeTruthy()
    const free = Number(m![1].replace(/_/g, ''))
    expect(free).toBeGreaterThan(0)
    expect(free, '3,880ms 에 죽는데 마감선이 1,940ms 이상이면 끊는 의미가 없다').toBeLessThanOrEqual(1_940)
  })

  it('🔒 유료는 **더 크다** — CPU 한도가 다른 세계인데 같은 값이면 늘어난 한도가 그냥 남는다', () => {
    const m = /envPlanValue\(undefined, ([\d_]+), ([\d_]+), env\)/.exec(LOOP)!
    expect(Number(m[2].replace(/_/g, ''))).toBeGreaterThan(Number(m[1].replace(/_/g, '')))
  })

  it('🔒 첫 패스는 **마감선 전에** 무조건 돈다 — 0패스로 끝나면 커서가 영영 안 나간다', () => {
    const first = LOOP.indexOf('let last = await reclassifyCompanyLeads(env.DB, 1000)')
    const loopAt = LOOP.indexOf('for (; passes < 5')
    expect(first, '첫 패스를 못 찾았다').toBeGreaterThan(0)
    expect(first, '첫 패스가 루프 앞에 있어야 한다').toBeLessThan(loopAt)
  })

  it('🔒 **중단 사유·경과**를 남긴다 — 매번 deadline 이면 상한을 더 내려야 한다는 신호다', () => {
    expect(LOOP).toMatch(/stopped_by:/)
    expect(LOOP).toMatch(/elapsed_ms:/)
    expect(LOOP, '몇 패스를 돌았는지가 없으면 처리량 변화를 못 읽는다').toMatch(/passes,/)
  })

  it('🔒 `housekeeping` 은 첫 패스만 — 뒤 패스도 켜면 대형 테이블 풀스캔이 패스마다 반복된다', () => {
    expect(LOOP).toMatch(/reclassifyCompanyLeads\(env\.DB, 1000, false\)/)
  })
})
