/**
 * ⏱️ ur-ads 레인 주기 신고 — 불변식 고정.
 *
 * 배경(실측): `adsBeat` 이 모든 레인에 워커 cron(`0 * * * *`, 매시간)을 붙여 기록해,
 * 일 1회/N시간/단계순환 레인이 **정상 동작 중에도** `stale` 로 찍혔다. 그 판정은
 * `/api/_healthcheck/cron` → uptime.yml → 이슈+메일로 나간다. 2026-07-29 라이브에서
 * `ads:maintenance?phase=quality` 가 age 167분·stale 이었다(5단계 순환이라 정상인데도).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  staleGapMinutes, dailyGapMinutes, everyNHoursGapMinutes,
  maxPhaseGapHours, phaseGapMinutes, makeHourGates,
  neverFiredLanes, createLaneRegistry, type KickFn,
} from '../../worker-ads/lane-cadence'
import { expectedMaxAgeMinutes } from '../../worker/utils/cron-heartbeat'

describe('staleGapMinutes — cron-heartbeat 와 같은 공식', () => {
  it('기대주기 × 2 + 30', () => {
    expect(staleGapMinutes(60)).toBe(150)
    expect(staleGapMinutes(24 * 60)).toBe(2910)
  })

  it('매시간 주기는 expectedMaxAgeMinutes("0 * * * *") 와 동치 — 공식이 갈라지면 실패한다', () => {
    expect(staleGapMinutes(60)).toBe(expectedMaxAgeMinutes('0 * * * *'))
  })

  it('일 1회는 expectedMaxAgeMinutes("0 16 * * *") 와 동치', () => {
    expect(dailyGapMinutes()).toBe(expectedMaxAgeMinutes('0 16 * * *'))
  })

  it('0/음수는 최소 1분으로 클램프 — 0 을 넘겨도 즉시-stale 이 되지 않는다', () => {
    expect(staleGapMinutes(0)).toBe(32)
    expect(everyNHoursGapMinutes(0)).toBe(150)
  })
})

describe('maxPhaseGapHours — 자정 불연속까지 센다', () => {
  it('5단계: 단계 4 는 19시 다음이 다음날 4시 → 9시간(5가 아니다)', () => {
    expect(maxPhaseGapHours(5)).toBe(9)
  })

  it('24 의 약수면 정확히 그 값 — 단계를 6개로 늘리면 자동으로 6이 된다', () => {
    expect(maxPhaseGapHours(4)).toBe(4)
    expect(maxPhaseGapHours(6)).toBe(6)
    expect(maxPhaseGapHours(8)).toBe(8)
    expect(maxPhaseGapHours(1)).toBe(1)
  })

  it('약수가 아니면 항상 실제 최대 간격 ≥ 단계 수', () => {
    for (const p of [5, 7, 9, 10, 11]) expect(maxPhaseGapHours(p)).toBeGreaterThanOrEqual(p)
  })

  it('현행 5단계 순환의 stale 기준은 매시간 기준(150분)보다 확실히 크다 — 이게 오탐의 원인이었다', () => {
    expect(phaseGapMinutes(5)).toBeGreaterThan(staleGapMinutes(60))
    expect(phaseGapMinutes(5)).toBe(9 * 60 * 2 + 30)
  })
})

describe('makeHourGates — 발화 조건과 주기 신고가 같은 자리에서 나온다', () => {
  const spy = () => {
    const calls: Array<{ path: string; gap?: number }> = []
    const kick = (path: string, _fn: () => Promise<unknown>, gap?: number) => { calls.push({ path, gap }) }
    return { calls, kick }
  }
  const noop = async () => undefined

  it('dailyAt: 지정 시각에만 발화하고, 그때 일 1회 주기를 신고한다', () => {
    const s = spy()
    makeHourGates(16, s.kick).dailyAt(16, '/__ads/collect-nps', noop)
    makeHourGates(15, s.kick).dailyAt(16, '/__ads/collect-nps', noop)
    expect(s.calls).toEqual([{ path: '/__ads/collect-nps', gap: dailyGapMinutes() }])
  })

  it('everyNHours: 조건이 맞는 시각에만, N시간 주기를 신고한다', () => {
    const s = spy()
    for (const h of [0, 1, 2, 3]) makeHourGates(h, s.kick).everyNHours(2, 0, '/__ads/collect-storeinfo', noop)
    expect(s.calls).toHaveLength(2)                       // 0시·2시
    expect(s.calls.every(c => c.gap === everyNHoursGapMinutes(2))).toBe(true)
  })

  it('하루 24시간을 돌려도 일 1회 레인은 정확히 한 번', () => {
    const s = spy()
    for (let h = 0; h < 24; h++) makeHourGates(h, s.kick).dailyAt(20, '/__ads/collect-localdata', noop)
    expect(s.calls).toHaveLength(1)
  })
})

/**
 * 🛡️ 회귀 차단 — 시각 게이트가 `kick` 을 **직접** 호출하면 주기 신고가 빠진다.
 *
 * 이게 정확히 원래 버그의 모양이었다: 조건은 `hourUTC === 16` 인데 하트비트는 매시간으로 기록.
 * 조건과 주기를 따로 적을 수 있는 한 언젠가 또 어긋나고, 어긋나도 **조용하다**(경보만 늘 뿐).
 * ⚠️ 이 테스트가 못 막는 것: `gates.*` 를 쓰되 잘못된 시각/N 을 넣는 경우(값의 정합은 못 본다).
 */
describe('worker-ads/index.ts — 시각 게이트는 반드시 gates 헬퍼를 쓴다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')

  it('hourUTC 조건 블록 안에서 raw kick( 을 호출하지 않는다', () => {
    // `if (... hourUTC ...) {` 바로 뒤 몇 줄 안에 kick( 이 오면 위반.
    const offenders = [...src.matchAll(/if \([^\n]*hourUTC[^\n]*\) \{\n(?:[^\n]*\n){0,4}?[^\n]*\bkick\(/g)]
      .map(m => m[0].split('\n')[0].trim())
    expect(offenders).toEqual([])
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과(측정 대상 없음)를 성공으로 오인하지 않게', () => {
    expect(src).toContain('makeHourGates')
    expect((src.match(/gates\.(dailyAt|everyNHours)\(/g) || []).length).toBeGreaterThanOrEqual(10)
  })

  it('단계 순환 레인은 단계 수에서 유도한 주기를 신고한다(리터럴 하드코딩 금지)', () => {
    expect(src).toMatch(/phaseGapMinutes\(PHASES\.length\)/)
  })
})

describe('neverFiredLanes — "게이트는 ON 인데 기록이 없다"', () => {
  it('하트비트가 없는 레인만 고른다', () => {
    expect(neverFiredLanes(['collect', 'collect-nps'], ['ads:collect', 'ads:scheduled']))
      .toEqual(['collect-nps'])
  })

  it('쿼리가 붙은 하트비트도 같은 레인으로 본다 — 단계 순환이 오탐되지 않게', () => {
    // maintenance 는 매 시간 ?phase=… 가 달라진다. 쿼리째 비교하면 4개 단계가 전부 never-fired 로 잡힌다.
    expect(neverFiredLanes(['maintenance'], ['ads:maintenance?phase=merge'])).toEqual([])
  })

  it('ads: 접두가 아닌 메인 워커 cron 은 비교에 끼어들지 않는다', () => {
    expect(neverFiredLanes(['collect'], ['cache-prewarm', 'retry-alimtalk'])).toEqual(['collect'])
  })

  it('알려진 레인이 없으면 아무것도 신고하지 않는다(첫 배포 오탐 방지)', () => {
    expect(neverFiredLanes([], ['ads:collect'])).toEqual([])
  })
})

describe('createLaneRegistry — 발화하지 않는 시각에도 레인을 알아본다', () => {
  it('일 1회 레인은 조건이 안 맞는 시각에도 등록된다 (이게 never-fired 판정의 전제)', () => {
    const reg = createLaneRegistry()
    const fired: string[] = []
    const kick: KickFn = (p) => { fired.push(p) }
    // 03시 — NPS(16시)는 발화하지 않는다
    makeHourGates(3, kick, reg).dailyAt(16, '/__ads/collect-nps', async () => undefined)
    expect(fired).toEqual([])                    // 안 돌았지만
    expect(reg.list()).toEqual(['collect-nps'])  // 존재는 안다
  })

  it('쿼리는 떼고 중복은 합친다', () => {
    const reg = createLaneRegistry()
    reg.note('/__ads/maintenance?phase=merge')
    reg.note('/__ads/maintenance?phase=quality')
    expect(reg.list()).toEqual(['maintenance'])
  })
})

/**
 * 🛡️ 순서 불변식 — 레인 등록은 `recordKnownLanes` **이전**에 끝나야 한다.
 *
 * 나중에 누가 kick 을 파일 아래쪽에 추가하면 그 레인은 목록에서 조용히 빠지고,
 * "게이트 ON 인데 기록 없음" 판정이 그 레인에 대해서만 영영 안 나온다(가드가 헛도는 클래스).
 */
describe('worker-ads/index.ts — 레인 등록은 저장보다 먼저 끝난다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
  const lines = src.split('\n')
  const persistAt = lines.findIndex(l => l.includes('recordKnownLanes(env'))

  it('recordKnownLanes 호출이 존재한다', () => {
    expect(persistAt).toBeGreaterThan(0)
  })

  it('그 뒤로는 kick/gates 호출이 없다 — 있으면 그 레인이 목록에서 누락된다', () => {
    const after = lines.slice(persistAt + 1)
      .map((l, i) => ({ n: persistAt + 2 + i, l }))
      .filter(x => /\bkick\(|gates\.(dailyAt|everyNHours)\(/.test(x.l))
      .map(x => `${x.n}: ${x.l.trim().slice(0, 80)}`)
    expect(after).toEqual([])
  })
})

/**
 * 🛡️ 부모 cron 인보케이션에서 **라운드 루프를 돌리지 않는다**.
 *
 * 이 레포가 네 번 데인 실패 양식이다(#830 수집 러너 · #831 kick 격리 · #835 인플루언서 보강 ·
 * 2026-07-29 파트너풀 보강). `for (…) await env.SELF.fetch(…)` 를 부모에서 돌리면 그동안 부모가
 * 살아 있어야 하고, 부모가 먼저 회수되면 **뒤쪽 레인이 하트비트도 없이 조용히 사라진다**
 * (실측: 07:00 틱이 8개 레인에서 절단, 실패 기록 0). 라운드는 드라이버 인보케이션이 돈다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 루프가 아닌 **단발** 인라인 await(무거운 단일 작업)는 잡지 않는다.
 */
describe('worker-ads/index.ts — 부모는 라운드 루프를 돌리지 않는다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')

  it('for 루프 안에서 env.SELF.fetch 를 await 하지 않는다', () => {
    // ⚠️ 표기 변종(`env.SELF.fetch` · `env.SELF?.fetch` · `env.SELF!.fetch`)을 전부 덮어야 한다 —
    //   처음 쓴 정규식이 `!` 를 놓쳐 회귀 주입을 통과시켰다(깨뜨려 보지 않았으면 헛도는 가드가 됐다).
    const offenders: string[] = []
    for (const m of src.matchAll(/\bfor\s*\(/g)) {
      const window = src.slice(m.index ?? 0, (m.index ?? 0) + 300)
      if (/await\s+env\.SELF\s*[!?]?\s*\.?\s*fetch/.test(window)) offenders.push(window.split('\n')[0].trim().slice(0, 70))
    }
    expect(offenders).toEqual([])
  })

  it('라운드가 필요한 레인은 드라이버 경로로 kick 한다(검사 대상 존재 확인)', () => {
    expect(src).toMatch(/kick\('\/__ads\/enrich-influencer-driver'/)
    expect(src).toMatch(/kick\('\/__ads\/enrich-company-driver'/)
  })
})
