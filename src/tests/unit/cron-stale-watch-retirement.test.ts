/**
 * 🪦 **은퇴 분류는 두 소비처 모두에 붙어야 한다** — 계약 (2026-08-05).
 *
 * ## 무엇이 문제였나
 * 2026-08-04 에 `cron-beat-retirement.ts` 를 만들어 *"이름이 은퇴한 하트비트"* 를 판정에서 걷어냈다.
 * 그런데 그 배선이 **`/api/_healthcheck/cron` 게이트 한 곳에만** 붙었다. 사람에게 실제로 닿는 채널
 * (디스코드 · `cron_failures` · 어드민 벨)을 쏘는 `cron-stale-watch` 는 그대로 `stale === true` 만 보고
 * 유령을 계속 신고했다.
 *
 * 2026-08-05 라이브 실측 — 24시간 `cron_failures` 의 `stale:*` 16건 중 대부분이 유령이었다:
 * ```
 *   stale:ads:maintenance?phase=merge   79h   ← ads:maintenance 는 12분 전에 돌았다 (승계)
 *   stale:ads:enrich-influencer-driver  58h   ← DO 알람 ads:enrich-influencer 가 인수 (승계)
 *   stale:ads:sweep-kakao-phone        158h   ← sweep-kakao-chain 으로 개명 (은퇴)
 * ```
 *
 * 🔴 **나쁜 이유는 소음 자체가 아니라 진짜를 덮기 때문이다.** 그 목록 안에 3일 멈춘 레인이 하나
 * 있었는데 유령 15건에 묻혀 있었다. 같은 날 회전 오탐과 **정확히 같은 병**이다.
 *
 * ## 이 시험이 지키는 것
 * 1. 유령(승계·은퇴)은 신고하지 않는다
 * 2. **진짜는 계속 신고한다** — 완화가 경보를 끄면 안 된다
 * 3. 두 소비처가 **같은 분류기**를 쓴다(한쪽만 고치는 것이 이번 결함의 정체다)
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * `classifyBeat` 의 배수(8×)·하한(24h)이 적절한지는 판정 못 한다 — 그건 그 파일의 실측 근거에 달렸고,
 * 낮추면 "예산에 밀려 늦는 정상 레인"이 은퇴로 숨는 **정반대 사고**가 난다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { classifyBeat, freshBaseNames, RETIRED_GAP_MULTIPLE, RETIRED_MIN_AGE_MIN } from '@/worker/utils/cron-beat-retirement'

/** 2026-08-05 라이브 하트비트 그대로 — 숫자를 지어내지 않는다. */
const LIVE = [
  { name: 'ads:maintenance', age_minutes: 12, max_gap_min: 40 },                      // 살아 있다
  { name: 'ads:maintenance?phase=merge', age_minutes: 79 * 60, max_gap_min: 1470 },   // 승계
  { name: 'ads:maintenance?phase=quality', age_minutes: 59 * 60, max_gap_min: 1470 }, // 승계
  { name: 'ads:enrich-influencer', age_minutes: 8, max_gap_min: 40 },                 // 살아 있다
  { name: 'ads:enrich-influencer-driver', age_minutes: 58 * 60, max_gap_min: 150 },   // 은퇴(58h > 150×8)
  // ⚠️ 이 레인은 `g` 를 안 싣는다 — 임계는 cron 식에서 유도된다(`expectedMaxAgeMinutes('0 * * * *')` = 150).
  //   첫 판에 2910 으로 적었다가 시험이 빨간불을 냈다(3.3× 라 은퇴 문턱 미달). **픽스처도 실측이어야 한다.**
  { name: 'ads:sweep-kakao-phone', age_minutes: 158 * 60, max_gap_min: 150 },         // 은퇴(63×)
  { name: 'ads:scan-notices', age_minutes: 70 * 60, max_gap_min: 2910 },              // 🔴 진짜
  { name: 'ads:collect-hira', age_minutes: 6 * 60, max_gap_min: 150 },                // 진짜(밀리는 중)
]

describe('은퇴 분류 — 유령은 빼고 진짜는 남긴다', () => {
  const fresh = freshBaseNames(LIVE)
  const verdict = (n: string) => classifyBeat(LIVE.find(b => b.name === n)!, fresh)

  it('같은 일이 새 이름으로 돌고 있으면 승계 — 신고하지 않는다', () => {
    expect(verdict('ads:maintenance?phase=merge')).toBe('superseded')
    expect(verdict('ads:maintenance?phase=quality')).toBe('superseded')
  })

  it('아무도 안 부르는 이름은 은퇴 — 신고하지 않는다', () => {
    expect(verdict('ads:enrich-influencer-driver')).toBe('retired')
    expect(verdict('ads:sweep-kakao-phone')).toBe('retired')
  })

  it('🔴 진짜 침묵은 계속 신고한다 — 이게 성공 조건이다', () => {
    expect(verdict('ads:scan-notices')).toBe('judge')
    expect(verdict('ads:collect-hira')).toBe('judge')
  })

  it('은퇴 문턱은 배수와 하한을 **둘 다** 넘어야 한다 — 늦은 것을 없는 것으로 만들면 안 된다', () => {
    const fresh0 = freshBaseNames([])
    // 배수는 넘지만 하한(24h) 미만 → 은퇴 아님
    expect(classifyBeat({ name: 'x', age_minutes: 60 * (RETIRED_GAP_MULTIPLE + 1), max_gap_min: 60 }, fresh0)).toBe('judge')
    // 하한은 넘지만 배수 미만 → 은퇴 아님
    expect(classifyBeat({ name: 'y', age_minutes: RETIRED_MIN_AGE_MIN + 60, max_gap_min: RETIRED_MIN_AGE_MIN }, fresh0)).toBe('judge')
  })
})

describe('🚧 배선 — 두 소비처가 같은 분류기를 쓴다', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('경보 경로(cron-stale-watch)가 분류기를 거친다', () => {
    const src = read('src/worker/cron/cron-stale-watch.ts')
    expect(src, '은퇴 분류를 안 쓰면 유령이 계속 디스코드·어드민 벨로 나간다').toContain('classifyBeat(')
    expect(src).toContain('freshBaseNames(beats)')
    // 계산만 하고 필터에 안 쓰면 조용한 no-op 이다
    expect(src).toMatch(/=== 'judge'\)/)
  })

  it('게이트 경로(cron-heartbeat)도 같은 분류기를 쓴다 — 두 곳이 갈리면 이번 결함이 재발한다', () => {
    expect(read('src/worker/utils/cron-heartbeat.ts')).toContain('classifyBeat(')
  })
})
