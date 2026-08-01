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
  it('🔒 마감선이 **죽는 지점(26초)의 절반 이하** — 외부가 느린 회차에도 여유가 있어야 한다', () => {
    const m = /const RUN_DEADLINE_MS = ([\d_]+)/.exec(COMMERCE)
    expect(m, 'RUN_DEADLINE_MS 가 없다').toBeTruthy()
    const ms = Number(m![1].replace(/_/g, ''))
    expect(ms).toBeGreaterThan(0)
    expect(ms, '26초에 죽는데 마감선이 13초 이상이면 못 끊는다').toBeLessThanOrEqual(13_000)
  })

  it('🔒 페이지 루프가 마감선에서 **break** 한다 — return/throw 면 커서 저장을 건너뛴다', () => {
    const loop = COMMERCE.slice(COMMERCE.indexOf('for (let p = 0; p < perService'))
    const head = loop.slice(0, 500)
    expect(head).toMatch(/Date\.now\(\) - startedAt > RUN_DEADLINE_MS.*break/s)
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

describe('슬라이스 되돌림 — 올린 날 죽었고 회복이 없었다', () => {
  it('🔒 NEIS 는 3페이지 — 6 으로 올린 07-29 이후 성공 기록이 없다', () => {
    expect(ENTRY).toMatch(/runNeisAcademyCollect\(env, 3\)/)
    expect(ENTRY, '왜 되돌렸는지가 코드에 남아야 다음 세션이 또 올리지 않는다').toMatch(/6 → 3 페이지 \*\*되돌림\*\*/)
  })

  it('🔒 NPS 는 40건 — 100 으로 올린 07-28 이후 마지막 성공은 07-27 이다', () => {
    expect(ENTRY).toMatch(/runNpsWorkplaceEnrich\(env, 40\)/)
    expect(ENTRY).toMatch(/100 → 40 \*\*되돌림\*\*/)
  })
})

describe('사다리가 무죄를 입증한 값은 유지한다', () => {
  it('numOfRows 는 500 그대로 — 사다리 실측에서 500 까지 전부 200/JSON 이었다', () => {
    expect(COMMERCE).toMatch(/const PAGE_ROWS = 500/)
    expect(COMMERCE, '"비JSON" 이 범인이 아니었다는 근거를 코드에 남긴다').toMatch(/사다리 실측/)
  })
})
