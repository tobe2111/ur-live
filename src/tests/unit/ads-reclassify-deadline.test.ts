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
 *
 * ## 🩹 2026-08-04 갱신 — **마감선만으로는 부족했다**(이 시험의 전제가 반쯤 틀렸다)
 * 위 마감선(무료 1,800ms)을 넣은 뒤에도 이 레인은 **`ms=1316` 에 CPU 한도로 죽었다** —
 * *자기 마감선에 닿기도 전에*. 외부 호출이 없는 DB-only 정규식 루프는 **벽시계가 안 흐르는데
 * CPU 만 탄다**(위 "근사다" 라는 단서가 가장 크게 어긋나는 자리). ⇒ 교리대로 **행 총량**을 함께
 * 건다. 상수는 `reclassifyWorkPlan`(collect-budget) SSOT 로 옮겼다 — 여기선 **정규식이 아니라
 * 실제 값**을 시험한다(리터럴을 문자열로 긁으면 상수를 옮길 때마다 이 시험이 낡는다).
 * ⚠️ **마감선은 지우지 않았다** — D1 이 느린 회차는 행 수가 아니라 시간이 먼저 닿는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { reclassifyWorkPlan } from '@/features/marketing/api/collect-budget'

// 🗺️ 2026-08-05 읽기 대상 이사 — 본문이 `reclassify-lane.ts` 로 추출됐다(DO 알람 이관: cron·알람
//   두 경로가 같은 본문을 쓴다. 인라인 복제는 마감선·행상한이 두 벌이 되어 조용히 갈린다).
//   이 시험의 계약(마감선·행상한·첫패스·중단사유)은 전부 그대로다 — 사는 곳만 옮겨졌다.
const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/reclassify-lane.ts'), 'utf8')
const AT = SRC.indexOf('export async function runReclassifyLane')
const LOOP = SRC.slice(AT, AT + 2600)
// 배선(두 경로가 정말 이 본문을 부르는가)도 함께 잠근다 — 추출이 반쪽(한 경로만 교체)이면 도로 두 벌이다.
const IDX = readFileSync(resolve(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
const RUNNERS = readFileSync(resolve(process.cwd(), 'src/worker-ads/lane-alarm-runners.ts'), 'utf8')

describe('재분류 — 인보케이션당 총량에 상한이 있다', () => {
  it('🔒 패스 루프가 **마감선**을 본다 — 없으면 5패스를 무조건 돌아 CPU 한도에 닿는다', () => {
    expect(AT, 'runReclassifyLane 을 못 찾았다 — 이름이 바뀌었으면 이 시험을 고쳐라').toBeGreaterThan(0)
    expect(LOOP, '루프 조건에 경과 시간 검사가 있어야 한다').toMatch(/passes < 5 && [^\n]*Date\.now\(\) - t0 < deadlineMs/)
  })

  it('🔒 무료 마감선이 **관측된 사망 지점(3,880ms)의 절반 아래** — 근접하면 못 끊는다', () => {
    const free = reclassifyWorkPlan(undefined).deadlineMs
    expect(free).toBeGreaterThan(0)
    expect(free, '3,880ms 에 죽는데 마감선이 1,940ms 이상이면 끊는 의미가 없다').toBeLessThanOrEqual(1_940)
  })

  it('🔒 유료는 **더 크다** — CPU 한도가 다른 세계인데 같은 값이면 늘어난 한도가 그냥 남는다', () => {
    expect(reclassifyWorkPlan({ ADS_PLAN: 'paid' }).deadlineMs).toBeGreaterThan(reclassifyWorkPlan(undefined).deadlineMs)
  })

  it('🔒 첫 패스는 **상한 검사 전에** 무조건 돈다 — 0패스로 끝나면 커서가 영영 안 나간다', () => {
    const first = LOOP.indexOf('let last = await reclassifyCompanyLeads(env.DB, rowsPerPass)')
    const loopAt = LOOP.indexOf('for (; passes < 5')
    expect(first, '첫 패스를 못 찾았다').toBeGreaterThan(0)
    expect(first, '첫 패스가 루프 앞에 있어야 한다').toBeLessThan(loopAt)
  })

  it('🔒 **중단 사유·경과**를 남긴다 — 매번 같은 사유면 그 상한을 더 내려야 한다는 신호다', () => {
    expect(LOOP).toMatch(/stopped_by:/)
    expect(LOOP).toMatch(/elapsed_ms:/)
    expect(LOOP, '몇 패스를 돌았는지가 없으면 처리량 변화를 못 읽는다').toMatch(/passes,/)
  })

  it('🔒 `housekeeping` 은 첫 패스만 — 뒤 패스도 켜면 대형 테이블 풀스캔이 패스마다 반복된다', () => {
    expect(LOOP).toMatch(/reclassifyCompanyLeads\(env\.DB, rowsPerPass, false\)/)
  })

  it('🔒 두 실행 경로(cron kick · DO 알람)가 **같은 본문**을 부른다 — 반쪽 추출이면 도로 두 벌', () => {
    expect(IDX).toMatch(/runReclassifyLane/)
    expect(RUNNERS).toMatch(/runReclassifyLane/)
  })
})
