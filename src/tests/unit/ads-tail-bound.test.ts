/**
 * ⏳ **회차 꼬리 상한** (2026-08-03, 대표 확정 "c")
 *
 * 학습기(`cap`)를 갱신하는 자리는 회차 꼬리 **하나뿐**인데, 그 꼬리가 띄운 레인이 전부 끝나기를
 * 기다렸다. 부모가 못 버티면 요약도 학습도 통째로 실행되지 않는다 —
 * 실측: 이력이 09:00 KST 에서 5시간 정지, 그동안 디스패치 기록은 매 회차 정상, `cron_failures` 0.
 *
 * ## 🔑 이 테스트가 지키는 두 번째 불변식이 더 중요하다
 *
 * 상한만 넣으면 **부호만 반대인 같은 고장**이 생긴다. `tickHarmed` 는 `fail + miss` 로 판정하고
 * `miss` 는 *띄웠는데 하트비트가 없는* 레인이다 — 아직 도는 레인을 그대로 넘기면 전부 `miss` 가 되어
 * **모든 회차가 항상 해로움** → 영영 회복 불가. 그래서 **끝난 레인만 판정 대상**이어야 한다.
 *
 * ## 이 테스트가 **못 막는 것**
 * - 상한 값(25s/60s)의 타당성. 부모가 실제로 언제 죽는지는 아직 모른다(CPU·대기·waitUntil 중 무엇인지 미확정).
 *   그래서 `cut` 을 스탬프로 남긴다 — 다음 세션이 그 숫자로 조정한다.
 * - 레인이 상한 뒤에 실패하는 것. 그건 레인 자기 하트비트가 남기고, 다음 회차 판정에 잡힌다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { settleWithin, judgedLaneNames, TAIL_WAIT_MS, TAIL_WAIT_MS_PAID } from '@/worker-ads/tail-bound'

const read = (rel: string) => {
  const p = path.join(process.cwd(), rel)
  expect(fs.existsSync(p), `${rel} 이 없다 — 경로가 낡으면 통과가 아니라 실패다`).toBe(true)
  return fs.readFileSync(p, 'utf8')
}
const IDX = read('src/worker-ads/index.ts')
const TAIL = read('src/worker-ads/tail-bound.ts')

const never_ = () => new Promise<void>(() => {})            // 끝나지 않는 작업 = 느린 레인
const soon = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms))

describe('상한 안에 끝난 것만 기다린다', () => {
  it('느린 항목이 있어도 상한에서 돌아온다 — 이게 기록이 남는 이유다', async () => {
    const t0 = Date.now()
    const r = await settleWithin([soon(0), never_(), soon(0)], 60)
    expect(Date.now() - t0).toBeLessThan(1500)              // 무한정 매달리지 않는다
    expect(r.cut).toBe(1)
    expect(r.settled).toEqual([0, 2])                       // 인덱스가 정렬돼 온다
  })

  it('전부 끝나면 상한을 기다리지 않고 즉시 반환한다(예전과 동일)', async () => {
    const t0 = Date.now()
    const r = await settleWithin([soon(0), soon(0)], 5000)
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(r.cut).toBe(0)
    expect(r.settled).toEqual([0, 1])
  })

  it('실패한 항목도 "끝난 것"이다 — 실패는 판정 대상이어야 한다', async () => {
    const r = await settleWithin([Promise.reject(new Error('x')), never_()], 60)
    expect(r.settled).toEqual([0])
    expect(r.cut).toBe(1)
  })

  it('띄운 게 없으면 아무것도 안 기다린다', async () => {
    expect(await settleWithin([], 5000)).toEqual({ settled: [], cut: 0 })
  })
})

describe('🔑 못 기다린 레인은 판정 대상이 아니다 (부호 반대 고착 방지)', () => {
  it('끝난 레인 이름만 남긴다', () => {
    expect(judgedLaneNames(['a', 'b', 'c'], [0, 2])).toEqual(['a', 'c'])
  })

  it('하나도 못 기다리면 판정 대상이 0 — miss 로 세지 않는다', () => {
    // 이 배열이 그대로 summarizeTick 의 ranNames 가 된다. 넘기면 전부 miss → 늘 해로움.
    expect(judgedLaneNames(['a', 'b'], [])).toEqual([])
  })

  it('호출부가 실제로 걸러서 넘긴다 — 원본 ranNames 를 그대로 주면 안 된다', () => {
    expect(TAIL).toMatch(/writeTickSummary\(\s*o\.DB as never, o\.at, o\.hourUTC, judgedLaneNames\(o\.ranNames, r\.settled\)/)
    // ⚠️ `[^)]*o\.ranNames` 로 쓰면 `judgedLaneNames(o.ranNames` 안쪽에 걸려 **정상 코드가 빨간불**이 된다.
    //   잡아야 할 결함 모양은 "그 인자 자리에 원본을 그대로" 이므로 앞 인자에 붙여 좁힌다.
    expect(TAIL).not.toMatch(/o\.hourUTC,\s*o\.ranNames/)
  })
})

describe('배선', () => {
  it('index 가 무한 대기(allSettled)로 돌아가지 않았다', () => {
    expect(IDX).not.toMatch(/Promise\.allSettled\(kicked\)/)
    expect(IDX).toMatch(/ctx\.waitUntil\(closeTick\(\{/)
  })

  it('상한이 요금제를 따른다 — 유료 전환에 코드 변경 0', () => {
    expect(TAIL).toMatch(/resolvePlan\(env as never\) === 'paid' \? TAIL_WAIT_MS_PAID : TAIL_WAIT_MS/)
    expect(TAIL_WAIT_MS_PAID).toBeGreaterThan(TAIL_WAIT_MS)
  })

  it('워커에서 금지된 동적 alias import 를 쓰지 않는다', () => {
    // 첫 판이 그 형태였다. 던지면 이 꼬리가 통째로 죽어 **기록이 안 남는다** — 고치려던 고장과
    // 증상이 같아 원인 규명이 한 바퀴 더 돈다.
    // ⚠️ **주석을 걷어내고 본다.** 안 걷으면 위 설명문(그 형태를 인용한다)에 걸려 정상 코드가 빨간불이
    //   된다 — 오늘 이 함정을 네 번째로 밟았다. 텍스트 존재는 구조의 증거가 아니다.
    const codeOnly = TAIL.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
    expect(codeOnly).not.toMatch(/await import\('@\//)
  })

  it('앞 단계가 실패해도 요약·스탬프를 시도한다', () => {
    // 이 꼬리의 존재 이유가 "기록이 남는 것" 이다. 한 단계가 던져서 뒤가 생략되면 의미가 없다.
    expect(TAIL).toMatch(/catch \{[^}]*\}\s*\n\s*try \{\s*\n\s*await writeTickSummary/)
    expect(TAIL).toMatch(/await stampTailBound\(o\.DB as never, o\.at, o\.ranNames\.length, r\)/)
  })

  it('잘린 수를 남긴다 — "잘렸다"와 "원래 없다"가 같아 보이면 안 된다', () => {
    expect(TAIL).toMatch(/cut: r\.cut/)
    expect(TAIL).toMatch(/TAIL_BOUND_KEY/)
  })

  it('학습기 갱신(writeTickSummary)이 여전히 꼬리에 있다 — 빼먹으면 cap 이 영영 안 움직인다', () => {
    expect(TAIL).toMatch(/writeTickSummary/)
  })
})
