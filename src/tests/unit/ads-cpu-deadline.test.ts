/**
 * ⏱️ **CPU 한도에 닿기 전에 스스로 멈춘다** — 계약 (2026-08-02 라이브 실측 후 신설).
 *
 * ## 무엇이 있었나
 * 01:00 KST 틱에서 세 레인이 **같은 사유**로 죽었다 — 부모가 실은 `detail` 원문 덕에 처음 보였다:
 *
 * ```
 *   collect-commerce  ms=26027  detail=Worker exceeded CPU time limit.
 *   collect-neis      ms=26039  detail=Worker exceeded CPU time limit.
 *   collect-nps       ms=26563  detail=Worker exceeded CPU time limit.
 * ```
 *
 * 그날 우리가 세웠던 두 가설(**배포가 죽인다** / **부모 수명 ≈10.5초**)은 **둘 다 틀렸다.**
 * 배포 창을 비우자 레인은 26초까지 살았고, 거기서 CPU 한도를 쳤다.
 *
 * ## 왜 치명적이었나 (느린 게 아니라 전진이 0이었다)
 * 죽으면 루프 **뒤의 커서 저장이 실행되지 않는다.** 다음 회차가 같은 페이지를 또 훑고 또 죽는다
 * ⇒ **영원히 전진 0**. `commerce.total_saved` 가 얼어붙어 있던 진짜 이유가 이것이다.
 *
 * ## 곁들여 확인된 것 (유령 사냥의 끝)
 * 며칠간 화면에 떠 있던 `"비JSON 응답"` 은 **원인이 아니었다.** 사다리 실측(01:12 KST):
 * `rows 1·50·100·200·500` 전부 `HTTP 200 · JSON · resultCode "00"` — 레인이 쓰는 500 에서도 정상이다.
 *
 * ## 이 시험이 못 보는 것
 * - 실제 CPU 소모량은 여기서 못 잰다(워커 런타임이 안 준다). **벽시계로 대신 재는 근사**를 고정할 뿐이다.
 * - 마감선 값이 충분히 작은지는 라이브의 `elapsed_ms`/`stopped_by` 로만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const COMMERCE = SRC('src/features/marketing/api/commerce-notify-collect.ts')
const ENTRY = SRC('src/worker-ads/index.ts')

describe('통신판매 — 마감선이 커서 저장을 지킨다', () => {
  /**
   * 🔁 **2026-08-09 재작성 — 묶어야 할 것은 시간이 아니라 파싱량이다.**
   *
   *   원래 이 검사는 `RUN_DEADLINE_MS <= 13_000`(사망점 26초의 절반)이었다. 그 시절엔 그게 맞았다 —
   *   `MAX_RECORDS_PER_RUN` 이 **1,500** 이라 실질 제동이 마감선뿐이었기 때문이다.
   *
   *   그런데 마감선이 CPU 를 줄이는 방식은 **간접적**이다: 마감선 → 받는 페이지 수 → 파싱 레코드 수 → CPU.
   *   그리고 그 사슬의 끝(레코드 수)에는 **직접 천장**이 따로 있다. 상한을 700 으로 내린 지금은
   *   그 천장이 먼저 걸리므로, 시간을 묶는 것은 **수확만 깎고 CPU 는 안 줄인다**
   *   (08-09 07:00 실측: 마감선 6초에서 `found=500`, 상한 700 은 **한 번도 안 걸렸다**).
   *
   *   ⇒ 그래서 시간이 아니라 **실효 파싱량**을 묶는다. 상한은 페이지를 **받기 전에** 보므로 한 장은 넘친다:
   *       실효 상한 = MAX_RECORDS_PER_RUN + PAGE_ROWS
   *   이 값이 **죽던 회차의 1,499 보다 작아야** 한다. 마감선을 얼마로 두든 이 천장은 유지된다.
   *
   * ⚠️ 못 보는 것: 레코드당 CPU 가 얼마인지는 여기서 못 잰다. 파싱 로직이 무거워지면 같은 건수라도
   *   더 태운다 — 그건 라이브 하트비트(`ok=false`)로만 보인다. 그때 내릴 것은 **상한**이다.
   */
  it('🔒 한 회차 **실효 파싱량**이 죽던 회차(1,499건)보다 작다 — CPU 를 묶는 건 시간이 아니라 이것이다', () => {
    const cap = Number(/const MAX_RECORDS_PER_RUN = ([\d_]+)/.exec(COMMERCE)![1].replace(/_/g, ''))
    const rows = Number(/const PAGE_ROWS = ([\d_]+)/.exec(COMMERCE)![1].replace(/_/g, ''))
    expect(cap).toBeGreaterThan(0)
    expect(rows).toBeGreaterThan(0)
    expect(cap + rows, '실효 상한(상한+페이지)이 죽던 1,499건 이상이면 그 회차를 다시 만든다').toBeLessThan(1_499)
  })

  it('🔒 마감선은 살아 있고 유료 마감선을 넘지 않는다 — 사라지면 느린 회차가 통째로 매달린다', () => {
    const ms = Number(/const RUN_DEADLINE_MS = ([\d_]+)/.exec(COMMERCE)![1].replace(/_/g, ''))
    const paid = Number(/const RUN_DEADLINE_MS_PAID = ([\d_]+)/.exec(COMMERCE)![1].replace(/_/g, ''))
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(paid)
  })

  it('🔒 페이지 루프가 마감선에서 **break** 한다 — return/throw 면 커서 저장을 건너뛴다', () => {
    const loop = COMMERCE.slice(COMMERCE.indexOf('for (let p = 0; p < perService'))
    const head = loop.slice(0, 500)
    // ⚠️ 2026-08-02: 마감선이 **요금제 인지 지역변수**가 됐다(무료 12초 / 유료 24초). 무료 값은 위 검사가 지킨다.
    expect(head).toMatch(/Date\.now\(\) - startedAt > runDeadlineMs.*break/s)
    expect(head, '레코드 캡도 함께 — 응답이 빨라도 파싱량이 CPU 를 먹는다').toMatch(/found >= MAX_RECORDS_PER_RUN.*break/s)
  })

  it('🔒 커서 저장이 루프 **뒤**에 있고, break 로 반드시 도달한다', () => {
    const loopAt = COMMERCE.indexOf('for (let p = 0; p < perService')
    const cursorAt = COMMERCE.indexOf("INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(ck", loopAt)
    expect(cursorAt, '루프 뒤 커서 저장을 못 찾았다').toBeGreaterThan(loopAt)
  })

  it('두 번째 서비스는 마감선을 넘긴 뒤 시작하지 않는다(시작하면 그 회차가 통째로 죽는다)', () => {
    expect(COMMERCE).toMatch(/if \(stoppedBy === 'deadline'\) break/)
  })

  it('중단 사유·경과를 진단에 남긴다 — 매번 deadline 이면 슬라이스를 더 줄여야 한다는 신호다', () => {
    expect(COMMERCE).toMatch(/stopped_by: stoppedBy/)
    expect(COMMERCE).toMatch(/elapsed_ms: Date\.now\(\) - startedAt/)
  })
})

/**
 * 🩹 **슬라이스 되돌림 — 올린 날 죽었고 회복이 없었다.**
 *
 * ⚠️ 2026-08-02: 숫자가 **호출부(index.ts) → 레인 안**으로 옮겨갔다(요금제별 기본값이 됐다).
 *   지켜야 할 것은 위치가 아니라 **무료에서의 실효값**이다 — 그래서 새 위치에서 같은 것을 고정한다.
 *   그리고 *왜 되돌렸는지*를 **값 옆으로** 함께 옮겼다. 근거가 값에서 멀어지면 다음 세션이 또 올린다.
 *
 * ⚠️ 유료 값(8·120)은 CPU 한도가 다른 세계라 **이 사고와 무관한 별개 값**이다.
 *   "유료가 8인데 무료도 8이면 되지 않나" 는 정확히 이 사고를 재현하는 생각이다.
 */
describe('슬라이스 되돌림 — 올린 날 죽었고 회복이 없었다', () => {
  const NEIS = SRC('src/features/marketing/api/neis-academy-collect.ts')
  const NPS = SRC('src/features/marketing/api/nps-workplace-enrich.ts')

  it('🔒 NEIS 무료는 3페이지 — 6 으로 올린 07-29 이후 성공 기록이 없다', () => {
    expect(NEIS).toMatch(/maxPagesArg \?\? envPlanValue\(undefined, 3, \d+, env\)/)
    expect(NEIS, '왜 되돌렸는지가 **값 옆에** 남아야 다음 세션이 또 올리지 않는다').toMatch(/6 → 3 되돌림/)
    expect(ENTRY, '호출부가 다시 리터럴을 박으면 레인의 요금제 기본값이 죽는다').not.toMatch(/runNeisAcademyCollect\(env, \d/)
  })

  it('🔒 NPS 무료는 40건 — 100 으로 올린 07-28 이후 마지막 성공은 07-27 이다', () => {
    expect(NPS).toMatch(/maxLeadsArg \?\? envPlanValue\(undefined, 40, \d+, env\)/)
    expect(NPS).toMatch(/100 → 40 되돌림/)
    expect(ENTRY).not.toMatch(/runNpsWorkplaceEnrich\(env, \d/)
  })
})

describe('사다리가 무죄를 입증한 값은 유지한다', () => {
  it('numOfRows 는 500 그대로 — 사다리 실측에서 500 까지 전부 200/JSON 이었다', () => {
    expect(COMMERCE).toMatch(/const PAGE_ROWS = 500/)
    expect(COMMERCE, '"비JSON" 이 범인이 아니었다는 근거를 코드에 남긴다').toMatch(/사다리 실측/)
  })
})
