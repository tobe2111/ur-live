/**
 * 🕳️ **잠정 회차** — "관측만 죽은 회차"를 붕괴로 읽지 않는다 (2026-08-06).
 *
 * ## 이 테스트가 지키는 사고
 * 라이브에서 밤사이 이력 빈자리가 9회차 생겼는데 **같은 시각 레인 하트비트는 전부 `ok=true`** 였다.
 * 레인은 다 돌았고 죽은 건 부모 꼬리(관측)뿐인데, 학습기가 빈자리를 붕괴로 읽고
 * **cap 을 6 → 2(바닥)** 로 깎았다. 멀쩡한 함대가 스스로 처리량을 절반 이하로 줄인 것이다.
 *
 * ## 못 막는 것 (과신 금지)
 * - **부모가 왜 꼬리까지 못 사는지는 여전히 모른다.** 이건 그 원인을 고치는 게 아니라
 *   *원인이 남아 있어도 학습기가 오판하지 않게* 만드는 것이다. 원인 규명은 별건이다.
 * - 실제 D1 쓰기가 성공하는지는 유닛이 못 본다(배선 존재만 소스로 확인). 라이브 판정은
 *   `ads_tick_history` 에 `"p":1` 항목이 나타나는지로 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  appendTick, provisionalTick, isProvisionalTick, readTickHistory, summarizeTick,
} from '@/worker-ads/tick-history'
import { learnLanes, missedTicks, missedTicksJudged, MIN_LANES_PER_TICK } from '@/worker-ads/lane-aimd'

const H = (n: number) => `2026-08-06T${String(n).padStart(2, '0')}:00:00.000Z`

describe('잠정 회차 — 결과 미상은 실패가 아니다', () => {
  it('provisionalTick 은 띄운 수만 채우고 결과는 0 + p:1 로 남긴다', () => {
    const t = provisionalTick(H(3), 3, ['collect', 'collect', 'sheets-sync'])
    expect(t.ran, '중복 이름은 한 번만 센다').toBe(2)
    expect([t.n, t.ok, t.fail, t.miss]).toEqual([0, 0, 0, 0])
    expect(isProvisionalTick(t)).toBe(true)
  })

  it('확정 요약에는 p 가 없다 — 둘이 구분돼야 판정에서 뺄 수 있다', () => {
    const done = summarizeTick(H(3), 3, ['collect'], [{ name: 'ads:collect', ok: true, ms: 10 }])
    expect(isProvisionalTick(done)).toBe(false)
  })

  it('🔴 잠정 회차는 해로 세지 않는다 — 이 사고의 핵심', () => {
    // 결과 미상(p:1)인 회차가 fail/miss 0 이므로 tickHarmed 는 거짓이어야 하고,
    // 빈자리도 0 이라 물러나지 않는다.
    const prov = provisionalTick(H(3), 3, ['a', 'b', 'c'])
    const after = learnLanes({ cap: 6, clean: 0, pinned: 0 }, prov, 12, 6, missedTicksJudged({ at: H(2) }, H(3)))
    expect(after.cap, '결과 미상으로 cap 이 깎이면 안 된다').toBe(6)
  })

  it('🔴 직전이 잠정이면 빈자리를 세지 않는다(관측 실패 ≠ 붕괴)', () => {
    // 5시간 벌어져 있어도 직전 항목이 '결과 미상'이면 해가 아니다.
    expect(missedTicks(H(0), H(5)), '원래 함수는 빈자리를 센다').toBeGreaterThan(0)
    expect(missedTicksJudged({ at: H(0), p: 1 }, H(5))).toBe(0)
  })

  it('✅ 진짜 붕괴 신호는 잃지 않는다 — 확정 회차 뒤의 빈자리는 그대로 해', () => {
    expect(missedTicksJudged({ at: H(0) }, H(5))).toBeGreaterThan(0)
    const done = summarizeTick(H(5), 5, [], [])
    const after = learnLanes({ cap: 6, clean: 0, pinned: 0 }, done, 12, 6, missedTicksJudged({ at: H(0) }, H(5)))
    expect(after.cap, '디스패치 전에 죽은 회차는 여전히 물러나야 한다').toBeLessThan(6)
    expect(after.cap).toBeGreaterThanOrEqual(MIN_LANES_PER_TICK)
  })

  it('🔁 꼬리가 돌면 같은 at 의 잠정 항목이 확정본으로 교체된다(두 줄로 안 갈린다)', () => {
    const hist = appendTick('[]', provisionalTick(H(3), 3, ['collect']))
    const done = summarizeTick(H(3), 3, ['collect'], [{ name: 'ads:collect', ok: true, ms: 5 }])
    const list = readTickHistory(appendTick(hist, done))
    expect(list.filter(t => t.at === H(3)), '한 회차는 한 줄이어야 한다').toHaveLength(1)
    expect(isProvisionalTick(list.at(-1))).toBe(false)
  })
})

describe('배선 — 빠지면 잠정 항목이 영원히 안 생긴다', () => {
  const runner = readFileSync('src/worker-ads/lane-runner.ts', 'utf8')
  const index = readFileSync('src/worker-ads/index.ts', 'utf8')
  const tail = readFileSync('src/worker-ads/tick-history-write.ts', 'utf8')
  /** 주석을 지운 본문 — 주석에만 남은 이름이 배선으로 오인되는 걸 막는다(이 레포가 두 번 밟은 함정). */
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('디스패처가 잠정 항목을 실제로 쓴다(주석 아님)', () => {
    expect(code(runner)).toMatch(/writes\.push[\s\S]{0,200}provisionalTick\(/)
  })

  /**
   * ⚠️ **위 검사만으로는 부족하다** — 주입 하네스가 그걸 증명했다. 쓰기 코드를 그대로 두고
   * 조건만 `if (false)` 로 바꾸면 문자열은 여전히 매치돼 **초록**이었다(죽은 코드는 안 지켜진다).
   * ⇒ 조건이 **실제 입력(`opts.at`)에 걸려 있는지**까지 본다.
   */
  it('🔴 잠정 쓰기가 상수로 꺼져 있지 않다 — 죽은 코드는 지키는 게 아니다', () => {
    expect(code(runner)).toMatch(/if \(opts\.at\) \{/)
    expect(code(runner), '상수 조건이면 그 블록은 영원히 안 돈다').not.toMatch(/if \((?:false|0|null|undefined)\) \{[\s\S]{0,300}provisionalTick\(/)
  })

  it('이력을 커서와 같은 왕복에서 읽는다 — 따로 읽으면 회차당 D1 왕복이 는다', () => {
    expect(code(runner)).toMatch(/IN \(\?, \?, \?\)[\s\S]{0,200}TICK_HISTORY_KEY/)
  })

  it('🔴 호출부가 꼬리와 같은 at(tickStartIso)을 넘긴다 — 다르면 회차가 두 줄로 갈린다', () => {
    const call = code(index).match(/dispatchPendingLanes\(\{[^}]*\}\)/)?.[0] ?? ''
    expect(call, 'at 을 안 넘기면 잠정 이력이 아예 안 생긴다').toMatch(/\bat:\s*tickStartIso\b/)
    const close = code(index).match(/closeTick\(\{[^}]*\}\)/)?.[0] ?? ''
    expect(close, '꼬리도 같은 값을 써야 교체된다').toMatch(/\bat:\s*tickStartIso\b/)
  })

  it('🔴 꼬리가 자기 자신을 직전으로 쓰지 않는다 — 그러면 간격이 늘 0 이라 검사가 헛돈다', () => {
    expect(code(tail)).toMatch(/reverse\(\)\.find\(t => t\.at !== at\)/)
    expect(code(tail), '보류 판정 함수를 써야 한다').toMatch(/missedTicksJudged\(/)
  })
})
