/**
 * 🕳️ **판정 대상에서 빠진 레인은 죽어도 안 울린다** (2026-08-03, 라이브 실측으로 발견)
 *
 * ## 무엇이 잘못돼 있었나
 * 하트비트는 두 번 쓰인다 — 부모(`adsBeat`, `cron: event.cron` 을 실음)와
 * 레인 자신(`writeSelfBeat`). 자기 하트비트는 **설계상 cron 을 일부러 안 싣는다**
 * (레인은 자기 주기를 모르므로 추측하면 일 1회 레인이 오경보를 낸다 — `self-beat.ts`).
 * 대신 부모가 넘긴 `gap`(=`_gap` 쿼리)만 믿는다.
 *
 * 그런데 **자식 쓰기가 나중**이라 부모가 실어 둔 `cron` 을 덮는다. `kick` 이 `gap` 없이
 * 불린 레인은 결국 `cron` 도 `g` 도 없는 행이 된다:
 *
 * ```
 * cron_hb:ads:sweep-kakao-chain = {"at":"2026-08-03T00:01:06.735Z","ok":true,"ms":17004}
 * ```
 *
 * `getCronHealth` 는 `max_gap_min ?? expectedMaxAgeMinutes(cron)` 이 **둘 다 없으면**
 * 그 레인을 `missing` 으로 빼고 **stale 검사를 안 한다.** 게다가 `missing` 은 `ok` 를 깨지 않는다
 * ⇒ 그 레인이 조용히 멈춰도 dead-man's switch 는 초록이다. *"안 도는 것"* 과
 * *"판정 대상이 아닌 것"* 이 화면에서 똑같이 생겼다 — 이 레포가 반복해 만난 실패 양식이다.
 *
 * ## 이 테스트가 **못 막는 것**
 * - 레인이 실제로 도는지. 여기서 보는 건 *"돌지 않으면 울릴 수 있는 상태인가"* 뿐이다.
 * - `gap` 값의 **타당성**. 매시간 레인에 150분이 맞는지는 라이브 주기가 정하는 사실이다.
 * - 부모가 죽어 자식도 못 도는 경우(그건 마감선·예산 쪽 문제다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { hourlyGapMinutes, dailyGapMinutes, staleGapMinutes, laneCadenceFields } from '@/worker-ads/lane-cadence'

const read = (rel: string) => {
  const p = path.join(process.cwd(), rel)
  expect(fs.existsSync(p), `${rel} 이 없다 — 경로가 낡으면 통과가 아니라 실패다`).toBe(true)
  return fs.readFileSync(p, 'utf8')
}
const IDX = read('src/worker-ads/index.ts')
const HEALTH = read('src/worker/utils/cron-heartbeat.ts')

describe('kick 이 주기를 안 받으면 매시간으로 채운다', () => {
  /**
   * 🔁 2026-08-03: 이 불변식의 **집이 옮겨졌다** — 조립이 `lane-cadence.laneCadenceFields` 로 추출됐다
   *   (같은 필드가 미루기 판정에도 쓰여 매시간 레인을 통째로 `always` 로 만들던 것을 끊으면서).
   *   그래서 문자열이 아니라 **함수 반환값**으로 본다 — 리팩토링에 안 깨지고 뜻을 더 정확히 고정한다.
   */
  it('gapMin 에 기본값이 있다 — undefined 를 그대로 넘기지 않는다', () => {
    expect(laneCadenceFields(undefined).gapMin).toBe(hourlyGapMinutes())
    expect(laneCadenceFields({}).gapMin).toBe(hourlyGapMinutes())
    // 엔트리가 그 SSOT 를 실제로 쓰는가(직접 조립으로 되돌아가면 기본값이 다시 새어 나간다)
    expect(IDX).toMatch(/pending\.push\(\{ beat, path, fallback, \.\.\.laneCadenceFields\(opts\) \}\)/)
  })

  it('기본값이 매시간 cron 의 기대 최대 나이와 같다', () => {
    // 두 곳이 갈리면 같은 레인이 부모 기록으로는 정상, 자식 기록으로는 침묵으로 보인다.
    expect(hourlyGapMinutes()).toBe(staleGapMinutes(60))
    expect(hourlyGapMinutes()).toBe(150)   // 라이브 실측 max_gap_min 과 일치
  })

  it('일 1회 레인의 기본값을 침범하지 않는다', () => {
    // 게이트 레인은 자기 주기를 명시로 넘기므로 이 기본값에 닿지 않아야 한다.
    expect(dailyGapMinutes()).toBeGreaterThan(hourlyGapMinutes())
    expect(IDX).toMatch(/gates\.dailyAt|makeHourGates/)
  })
})

describe('판정 불가는 조용히 통과시키지 않는다 — 규칙 자체를 계산으로', () => {
  // getCronHealth 의 판정을 그대로 옮긴 것: 둘 다 없으면 stale 검사에서 빠진다.
  const judgeable = (beat: { cron?: string; g?: number }) =>
    (beat.g != null && beat.g > 0) || !!beat.cron

  it('cron 도 gap 도 없으면 판정 불가 — 이게 실측에서 본 상태다', () => {
    expect(judgeable({})).toBe(false)
  })

  it('gap 만 있어도 판정된다 (자식 하트비트가 기대하는 경로)', () => {
    expect(judgeable({ g: 150 })).toBe(true)
  })

  it('cron 만 있어도 판정된다 (부모 하트비트 경로)', () => {
    expect(judgeable({ cron: '0 * * * *' })).toBe(true)
  })

  it('건강판정이 실제로 그 순서로 본다', () => {
    expect(HEALTH).toMatch(/const limit = b\.max_gap_min \?\? expectedMaxAgeMinutes\(b\.cron\)/)
    expect(HEALTH).toMatch(/if \(limit == null \|\| b\.age_minutes == null\) \{ missing\.push\(b\.name\); continue \}/)
  })
})
