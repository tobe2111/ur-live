/**
 * 📼 **회차 이력** — 최신값만 보관하는 저장소로는 시계열을 만들 수 없다 (2026-08-02).
 *
 * ## 왜 만들었나 — 내 측정이 틀렸다는 걸 발견해서
 * 붕괴 판정에 필요한 [회차별 띄운수 ↔ 실패수 ↔ 성공max] 가 **어디에도 없었다**:
 *
 * | 저장소 | 실제 보관 |
 * |---|---|
 * | `cron_hb:{레인이름}` | 레인당 **최신 1건** — 그 레인이 또 돌면 덮어쓴다 |
 * | `ads_dispatch_last` | **최신 회차 1건** — 매 회차 쓰지만 덮어쓴다 |
 *
 * 그래서 하트비트를 시각별로 묶으면 옛 회차가 자동으로 작아 보인다. 실제로 그 착시를 근거로
 * *"레인이 많은 회차일수록 더 죽는다"* 를 보고했다가 **철회**했다. 덮어쓰기를 부하로 읽은 것이다.
 *
 * ## 이 파일이 지키는 것
 * 1. **누적기가 flush 로 비워져도 요약은 안 줄어든다** — 비면 붕괴를 과소보고한다(가장 위험).
 * 2. **같은 회차는 한 줄** — flush 가 두 번이어도 항목이 갈리지 않는다.
 * 3. **`ran` 과 `n` 은 다른 값** — 띄웠는데 기록조차 못 남긴 수(`ran - n`)가 붕괴의 핵심 지표다.
 * 4. **길이 유계** — 한 행에 무한정 쌓이면 읽기가 비싸진다.
 * 5. **배선** — 순수 로직이 맞아도 부모가 안 부르면 이력은 영원히 안 생긴다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 부모가 마지막 flush 전에 죽는 회차. 그 회차는 이력에 **없다** —
 *   그건 결함이 아니라 신호다(빈 시각 = 가장 심하게 붕괴한 회차). 코드로 못 만드는 관측이다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  appendTick, summarizeTick, readTickHistory, TICK_HISTORY_CAP, TICK_HISTORY_MAX_CHARS, TICK_HISTORY_KEY,
} from '../../worker-ads/tick-history'
import { createBeatBatch } from '../../worker-ads/beat-batch'

const beat = (name: string, ok: boolean, ms: number) => ({ name, ok, ms })

describe('회차 요약', () => {
  it('띄운 레인 중 기록이 없는 것을 miss 로 센다', () => {
    const s = summarizeTick('2026-08-02T08:00:00.000Z', 8, ['a', 'b', 'c', 'd', 'e'], [
      beat('ads:a', true, 100), beat('ads:b', false, 3649), beat('ads:c', true, 4652),
    ])
    expect(s.ran).toBe(5)
    expect(s.n).toBe(3)
    expect(s.miss).toBe(2)   // d·e 는 하트비트조차 못 남겼다
    expect(s.off).toBe(0)
    expect(s.ok).toBe(2)
    expect(s.fail).toBe(1)
    expect(s.okMax).toBe(4652)
    expect(s.failMin).toBe(3649)
  })

  /**
   * 🐛 **라이브 회귀 테스트** — 첫 판은 `ran - n` 으로 "기록조차 못 남긴 수"를 계산했다.
   *   19:00 회차에서 **`띄운 7 · 기록 9`** 가 나와 그 값이 **음수**가 됐다:
   *   예산 밖 레인(`sheets-sync` 같은 생 waitUntil)과 DO 알람 레인이 **자기 하트비트를 따로** 남긴다.
   *   뺄셈은 두 집합이 같다고 가정했는데 거짓이었다. ⇒ 이름으로 대조하면 음수가 구조적으로 불가능하다.
   */
  it('🔒 예산 밖 레인이 기록을 남겨도 miss 가 음수가 되지 않는다 (라이브 실측 재현)', () => {
    const s = summarizeTick('t', 19, ['collect-hira', 'collect-commerce'], [
      beat('ads:collect-hira', true, 25750), beat('ads:collect-commerce', true, 12702),
      beat('ads:sheets-sync', true, 9118),          // 예산 우회 레인
      beat('ads:lane-alarm-boot', true, 273),       // DO 알람 레인
    ])
    expect(s.ran).toBe(2)
    expect(s.n).toBe(4)          // 기록이 띄운 수보다 많다 — 실제로 일어난다
    expect(s.miss).toBe(0)       // 띄운 둘은 다 기록을 남겼다
    expect(s.off).toBe(2)        // 예산 밖에서 온 기록 둘
    expect(s.miss).toBeGreaterThanOrEqual(0)
  })

  it('n = (ran − miss) + off 가 항상 성립한다', () => {
    const s = summarizeTick('t', 0, ['a', 'b', 'c'], [
      beat('ads:a', true, 1), beat('ads:x', false, 2), beat('ads:y', true, 3),
    ])
    expect(s.n).toBe((s.ran - s.miss) + s.off)
  })

  /** `ads:scheduled` 는 "회차가 울렸다"는 사실이지 레인이 아니다 — 세면 성공률이 부풀려진다. */
  it('scheduled 는 레인으로 안 센다', () => {
    const s = summarizeTick('t', 0, ['x'], [beat('ads:scheduled', true, 0), beat('ads:x', false, 10)])
    expect(s.n).toBe(1)
    expect(s.ok).toBe(0)
    expect(s.fail).toBe(1)
  })

  it('실패가 없으면 failMin 은 null (0 이 아니다)', () => {
    expect(summarizeTick('t', 0, ['x'], [beat('ads:x', true, 5)]).failMin).toBeNull()
  })

  it('실패 레인 이름을 남기되 상한을 둔다', () => {
    const many = Array.from({ length: 10 }, (_, i) => beat(`ads:l${i}`, false, 100))
    const s = summarizeTick('t', 0, many.map(b => b.name.slice(4)), many)
    expect(s.bad.length).toBe(6)
    expect(s.bad[0]).toBe('l0')   // `ads:` 접두어는 뗀다(길이 절약)
  })
})

describe('링 버퍼', () => {
  const mk = (at: string) => summarizeTick(at, 0, ['x'], [beat('ads:x', true, 1)])

  it('같은 회차는 한 줄로 유지된다 (flush 2회여도 안 갈린다)', () => {
    let raw = appendTick(null, mk('T1'))
    raw = appendTick(raw, { ...mk('T1'), n: 5 })
    const list = readTickHistory(raw)
    expect(list.length).toBe(1)
    expect(list[0].n).toBe(5)      // 나중 값이 이긴다(더 완전한 집계)
  })

  it('상한을 넘으면 오래된 것부터 버린다', () => {
    let raw: string | null = null
    for (let i = 0; i < TICK_HISTORY_CAP + 10; i++) raw = appendTick(raw, mk(`T${i}`))
    const list = readTickHistory(raw)
    expect(list.length).toBe(TICK_HISTORY_CAP)
    expect(list[list.length - 1].at).toBe(`T${TICK_HISTORY_CAP + 9}`)   // 최신은 남는다
  })

  it('값 길이가 유계다 — 이름이 길어도', () => {
    let raw: string | null = null
    for (let i = 0; i < TICK_HISTORY_CAP; i++) {
      const big = Array.from({ length: 8 }, (_, j) => beat(`ads:${'x'.repeat(70)}${j}`, false, 1000))
      raw = appendTick(raw, summarizeTick(`T${i}`, 0, big.map(b => b.name.slice(4)), big))
    }
    expect(raw!.length).toBeLessThanOrEqual(TICK_HISTORY_MAX_CHARS)
    expect(readTickHistory(raw).length).toBeGreaterThan(0)   // 다 버리지는 않는다
  })

  it('깨진 값·구 포맷에도 안 터진다', () => {
    for (const raw of ['', 'null', '{oops', '{}', undefined, null, 42]) {
      expect(() => readTickHistory(raw)).not.toThrow()
      expect(readTickHistory(raw)).toEqual([])
    }
  })
})

describe('누적기 — flush 해도 요약이 안 줄어든다', () => {
  /**
   * 🔑 **이게 가장 위험한 회귀다.** `seen` 을 `pending` 처럼 비우면, 마지막 flush 시점엔 앞쪽 묶음이
   *   사라져 요약이 실제보다 작아진다 — **붕괴를 과소보고**하고, 그 수치로 "괜찮아졌다"고 오판한다.
   */
  it('임계치 flush 가 여러 번 일어나도 seenBeats 는 전부 들고 있다', async () => {
    const written: number[] = []
    const b = createBeatBatch(async (list) => { written.push(list.length) }, 3, 60_000)
    for (let i = 0; i < 7; i++) b.add({ name: `ads:l${i}`, ok: i % 2 === 0, ms: i * 10 })
    await b.flush()
    expect(b.seenBeats.length).toBe(7)                       // 비워지지 않는다
    expect(written.reduce((a, n) => a + n, 0)).toBe(7)       // 쓰기 총합은 같다
    const s = summarizeTick('t', 0, b.seenBeats.map(x => x.name.slice(4)), b.seenBeats)
    expect(s.n).toBe(7)
    expect(s.ok).toBe(4)
    expect(s.fail).toBe(3)
  })
})

describe('배선 — 부모가 실제로 남기는가', () => {
  /** 주석을 걷어내고 본다(설명 문장 속 코드가 판정을 뒤집는 사고를 오늘 겪었다). */
  const code = (p: string) => fs.readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

  /**
   * 🧭 **2026-08-03: 앵커를 위치가 아니라 의미로 옮겼다.**
   *   꼬리가 `index.ts` 인라인 → `tail-bound.ts` `closeTick` 으로 이사하면서 이 검사가 깨졌는데,
   *   **지켜야 할 것은 그 코드가 어느 파일에 있느냐가 아니라** ① 요약이 쓰이는가 ② flush 뒤인가
   *   ③ 개수가 아니라 이름인가 다. 파일을 옮겼다고 빨간불이 뜨면 그건 "낡은 지도"이지 회귀가 아니다.
   */
  const tail = () => code('src/worker-ads/tail-bound.ts')

  it('마지막 flush 뒤에 회차 요약을 쓴다', () => {
    const src = tail()
    expect(src, '배선이 없으면 이력은 영원히 안 생긴다').toMatch(/writeTickSummary\(/)
    const flushAt = src.indexOf('.flush()')
    const writeAt = src.indexOf('writeTickSummary(o.DB')
    expect(flushAt).toBeGreaterThan(-1)
    expect(writeAt, 'flush 전에 쓰면 마지막 묶음이 요약에서 빠진다').toBeGreaterThan(flushAt)
    // 그리고 그 꼬리가 실제로 스케줄러에 매달려 있어야 한다(모듈만 있고 안 부르면 무의미).
    expect(code('src/worker-ads/index.ts'), '스케줄러가 꼬리를 안 부르면 이력이 안 생긴다')
      .toMatch(/ctx\.waitUntil\(closeTick\(\{/)
  })

  it('띄운 레인 **이름**을 넘긴다 — 개수로 대체하면 miss 가 음수가 될 수 있다', () => {
    const src = tail()
    // ⚠️ 범위를 **같은 줄**로 묶는다. 이 코드베이스는 세미콜론을 안 써서 `[^;]*` 가 다음 문장까지 넘어가고,
    //   실제로 바로 아래 `stampTailBound(..., o.ranNames.length, r)` 에 걸려 정상 코드가 빨간불이 됐다.
    expect(src).toMatch(/writeTickSummary\([^\n]*ranNames/)
    expect(src, '개수로 되돌아가면 라이브에서 본 "띄운7 기록9" 가 다시 음수를 만든다').not.toMatch(/writeTickSummary\([^\n]*\.length\s*,/)
    const runner = code('src/worker-ads/lane-runner.ts')
    expect(runner, '디스패처가 이름을 안 돌려주면 배선이 성립하지 않는다').toMatch(/ranNames: sel\.run\.map\(l => l\.beat\)/)
  })

  /**
   * 🕳️ **빈 회차를 세는 순서** — 이력을 덧붙이기 *전*에 직전 항목을 읽어야 한다.
   *
   * 덧붙인 **뒤** 마지막 항목은 방금 만든 *이* 회차라 간격이 **항상 0** 이 된다. 그러면
   * 학습기의 빈-회차 신호가 통째로 죽는데 **에러는 없다** — 이 레포가 반복해 만난 "헛도는 가드" 다.
   *
   * ⚠️ 이 검사 자체가 주입 하네스 덕에 생겼다: 처음엔 이 불변식을 지키는 테스트가 **하나도 없어서**
   *   순서를 뒤집어도 초록이었다(`check-guard-mutations` 가 그걸 빨간불로 알려 줬다).
   */
  it('빈 회차 수를 이력 덧붙이기 **전**에 센다 — 뒤에 세면 항상 0 이다', () => {
    const src = code('src/worker-ads/tick-history-write.ts')
    const prevAt = src.indexOf('const prev =')
    const appendAt = src.indexOf('const next = appendTick(')
    expect(prevAt, '직전 항목 계산을 못 찾았다 — 코드가 옮겨갔다(통과가 아니라 실패)').toBeGreaterThan(-1)
    expect(appendAt).toBeGreaterThan(-1)
    expect(prevAt, '덧붙인 뒤에 읽으면 방금 만든 이 회차가 잡혀 간격이 0 이 된다').toBeLessThan(appendAt)
    expect(src, '학습기에 빈 회차 수를 안 넘기면 편향이 그대로다').toMatch(/missedTicksJudged\(prev, at\)/)
    // 🕳️ 2026-08-06: 디스패치가 **같은 `at`** 으로 잠정 항목을 먼저 박으므로, 이력의 마지막은 보통
    //   *이* 회차다. 그냥 `.at(-1)` 을 쓰면 순서가 맞아도 간격이 늘 0 이라 검사가 또 헛돈다.
    expect(src, '자기 자신을 직전으로 쓰면 안 된다').toMatch(/\.find\(t => t\.at !== at\)/)
  })

  it('진단이 이력을 노출한다 — 쓰기만 하고 안 보여주면 판정에 못 쓴다', () => {
    const src = code('src/features/marketing/api/ads-pool-diag.ts')
    expect(src).toMatch(/tick_history: parseJson\(find\('ads_tick_history'\)\)/)
    expect(src, '조회 쿼리에 키가 없으면 항상 null 이다').toContain(TICK_HISTORY_KEY)
  })
})
