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
  maxPhaseGapHours, phaseGapMinutes, maxScheduleGapHours, scheduleGapMinutes, makeHourGates,
  neverFiredLanes, orphanLaneBeats, createLaneRegistry, type KickFn,
} from '../../worker-ads/lane-cadence'
import { expectedMaxAgeMinutes } from '../../worker/utils/cron-heartbeat'
import { MAINT_PHASES, MAINT_SCHEDULE } from '../../features/marketing/api/influencer-maintenance'

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

describe('maxScheduleGapHours — 가중 배정표의 실제 간격', () => {
  it('균등 배정은 maxPhaseGapHours 와 동치 — 공식을 두 벌 두지 않는다', () => {
    for (const n of [1, 4, 5, 6, 7, 10]) {
      expect(maxScheduleGapHours(Array.from({ length: n }, (_, i) => i))).toBe(maxPhaseGapHours(n))
    }
  })

  it('같은 단계가 여러 슬롯을 차지하면 간격이 줄어든다 — 슬롯 수만으로는 못 보는 값', () => {
    // 4슬롯 중 a 가 3자리: a 는 0·1·2시… 로 촘촘하고, b 는 3시마다 → 최대 간격은 b 의 4시간.
    expect(maxScheduleGapHours(['a', 'a', 'a', 'b'])).toBe(4)
    // 단계가 하나뿐이면 매시간.
    expect(maxScheduleGapHours(['a', 'a'])).toBe(1)
  })

  it('빈 배정표는 24시간으로 폴백 — 0 을 넘겨 즉시-stale 이 되지 않게', () => {
    expect(maxScheduleGapHours([])).toBe(24)
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
    const kick: KickFn = (path, _fn, opts) => { calls.push({ path, gap: opts?.gap }) }
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

  /**
   * 🤝 `hourlySchedule` — 양보 시각과 주기 신고가 **같은 입력**에서 나온다.
   *   손으로 `if (hourUTC !== 19) { kick(…, { gap: … }) }` 를 쓰면 두 군데가 되고, 한쪽만 고치면
   *   *"안 도는데 경보는 안 울리는"* 상태가 된다 — 위 'raw kick 금지' 불변식이 막는 그 형태다.
   */
  const SCHED = ['a', 'b', 'a', 'b'] as const
  const pathOf = (p: string) => `/__ads/maintenance?phase=${p}`
  const fallbackOf = () => noop

  it('양보 시각엔 발화하지 않고, 나머지 시각엔 배정된 단계로 발화한다', () => {
    const s = spy()
    for (let h = 0; h < 24; h++) makeHourGates(h, s.kick).hourlySchedule(SCHED, [19], pathOf, fallbackOf)
    expect(s.calls).toHaveLength(23)                                   // 24시간 − 양보 1
    expect(s.calls.some(c => c.path === pathOf(SCHED[19 % SCHED.length]))).toBe(true) // 그 단계 자체는 다른 시각에 돈다
  })

  it('신고하는 주기가 **양보를 반영한** 값과 정확히 같다(손계산과 갈라질 수 없다)', () => {
    const s = spy()
    makeHourGates(0, s.kick).hourlySchedule(SCHED, [19], pathOf, fallbackOf)
    expect(s.calls[0]?.gap).toBe(scheduleGapMinutes(SCHED, [19]))
  })

  it('빈 배정표는 아무것도 발화하지 않는다(0 주기로 즉시-stale 이 되지 않게)', () => {
    const s = spy()
    makeHourGates(0, s.kick).hourlySchedule([], [], pathOf, fallbackOf)
    expect(s.calls).toEqual([])
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

  it('단계 순환 레인은 **배정표에서** 유도한 주기를 신고한다(리터럴 하드코딩 금지)', () => {
    // 슬롯 수(`PHASES.length`)로 유도하면 가중 배정표에서 과대추정 → stale 경보가 조용히 느슨해진다.
    // 🔁 2026-07-29: 호출부에서 `scheduleGapMinutes(PHASES)` 를 직접 쓰던 것을 `gates.hourlySchedule` 안으로
    //   옮겼다(양보 시각과 주기를 **한 입력**에서 유도하기 위해 — 위 'raw kick 금지' 불변식이 요구한 형태).
    //   따라서 검사 대상은 "호출부가 그 게이트를 쓰는가" 로 바뀐다. 유도 자체의 정합은 아래 유닛이 본다.
    expect(src).toMatch(/gates\.hourlySchedule\(PHASES,/)
    expect(src).not.toMatch(/phaseGapMinutes\(PHASES/)
    // 호출부가 주기를 **손으로** 계산해 넘기면 다시 두 군데가 된다 — 그 형태를 금지한다.
    expect(src).not.toMatch(/gap: scheduleGapMinutes\(/)
  })
})

/**
 * 🗓️ 정비 **배정표**가 SSOT 와 어긋나지 않게 — 주석의 약속을 빨간불로 바꾼다.
 *
 *   그동안 이 관계를 지킨 건 worker-ads 의 주석 한 줄("추가 시 두 곳을 함께 고칠 것")뿐이었다.
 *   이 레포가 반복해 만난 실패는 "검사가 실패한다"가 아니라 **"검사가 아예 없다"** 이고,
 *   여기가 정확히 그 모양이었다 — 배정표에서 빠진 단계는 에러도 경보도 없이 **영원히 안 돈다**
 *   (`cron-stale-watch` 는 기록이 아예 없는 이름을 판정 대상으로 잡지 못한다).
 *
 *   ⚠️ 이 테스트가 못 막는 것: 배정표의 **비중**이 타당한지는 못 본다(라이브 수율은 코드 밖 사실이다).
 *   비중을 바꿀 땐 `MAINT_SCHEDULE` 주석의 실측 근거도 함께 갱신할 것.
 */
describe('정비 배정표 — cron 리터럴 ↔ MAINT_SCHEDULE(SSOT)', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
  /** worker-ads 의 `const PHASES = [...] as const` 리터럴을 그대로 읽는다(정적 import 불가라 복제돼 있다). */
  const cronSchedule = (): string[] => {
    const m = /const PHASES = \[([\s\S]*?)\] as const/.exec(src)
    expect(m, 'worker-ads/index.ts 의 PHASES 리터럴을 못 찾음 — 형태가 바뀌었으면 이 정규식도 함께').toBeTruthy()
    return [...m![1].matchAll(/'([a-z]+)'/g)].map(x => x[1])
  }

  it('🔒 두 리터럴이 순서까지 동일하다', () => {
    expect(cronSchedule()).toEqual(MAINT_SCHEDULE)
  })

  it('🔒 모든 단계가 배정표에 최소 1번 — 빠진 단계는 조용히 영원히 안 돈다', () => {
    const missing = MAINT_PHASES.filter(p => !MAINT_SCHEDULE.includes(p))
    expect(missing, `배정표에서 누락된 단계: ${missing.join(', ')}`).toEqual([])
  })

  it('🔒 배정표에 정의 밖 단계가 섞이지 않는다(오타는 그 슬롯을 통째로 버린다)', () => {
    expect(MAINT_SCHEDULE.filter(p => !MAINT_PHASES.includes(p))).toEqual([])
  })

  it('⏰ stale 기준은 배정표의 **실제** 최대 간격에서 나온다 — 슬롯 수 기준보다 촘촘하다', () => {
    // 이 배정표의 실제 최대 간격은 merge·reextract 의 **12시간**.
    // 🔢 2026-07-29: 10슬롯(10h) → `selflink` 추가로 12슬롯. 이 숫자를 고른 근거가 있다 —
    //    단순히 덧붙인 11슬롯은 **13h** 였다(24 를 11 로 나눌 때의 자정 불연속). 이 검사가 그걸 잡아
    //    12(24 의 약수)로 되돌렸다: 각 슬롯이 하루 **정확히 2회** 고정 시각에 돌아 간격이 12h 로 수렴한다.
    //    ⚠️ 즉 경보 창은 10h→12h 만큼만 느슨해졌다(11슬롯이었다면 13h). 더 늘릴 거면 여기서 다시 판단할 것.
    expect(maxScheduleGapHours(MAINT_SCHEDULE)).toBe(12)
    // 슬롯 수만 보면 12시간 — 12슬롯은 균등 순환과 같은 값이라 이번엔 둘이 같다(가중이 24 의 약수에 맞아떨어짐).
    expect(maxPhaseGapHours(MAINT_SCHEDULE.length)).toBe(12)
    // 가중 배정이 균등과 같아졌으므로 '더 촘촘하다'가 아니라 '더 느슨하지 않다'가 이번 배정표의 사실이다.
    expect(scheduleGapMinutes(MAINT_SCHEDULE)).toBeLessThanOrEqual(phaseGapMinutes(MAINT_SCHEDULE.length))
  })

  it('📏 배분 의도: 할 일이 남은 단계(reclassify·handle)가 끝난 단계(reextract·merge)보다 많이 받는다', () => {
    const share = (p: string) => MAINT_SCHEDULE.filter(x => x === p).length
    for (const busy of ['reclassify', 'handle']) {
      for (const idle of ['reextract', 'merge']) {
        expect(share(idle), `${idle} 가 ${busy} 보다 많이 받고 있다`).toBeLessThan(share(busy))
      }
    }
    // 0 으로 만들지 않는다 — 지금 filled:0 은 '고장'이 아니라 '다 했다'라, 새 미추출 행이 생기면 다시 돌아야 한다.
    for (const p of MAINT_PHASES) expect(share(p), `${p} 배정 0`).toBeGreaterThan(0)
  })
})

/**
 * 🔭 **관측 밖 레인 래칫** (2026-07-29).
 *
 *   ur-ads 의 레인은 대부분 `kick()` 을 거쳐 `ads:<이름>` 하트비트를 남긴다. 그런데 몇몇은
 *   `ctx.waitUntil` 로 **생으로** 도는데, 그런 레인은 멈춰도 아무도 모른다 — `cron-stale-watch` 는
 *   *한 번도 기록이 없는 이름을 판정 대상으로 잡지 못하기* 때문이다(부재는 침묵과 다르게 생겼다).
 *
 *   실측(07-29 12:00, 배포가 안 겹친 정각 회차): 다른 13개 레인은 다 돌았는데 **시트 미러만
 *   `ads_sheets_last_sync` 가 09:00:21 그대로**였다 — 성공도 KICK_FAILED 도 안 남아서, 멈췄다는
 *   사실 자체를 화면에서 볼 수 없었다. 그 레인에 하트비트를 배선하면서 같은 모양을 래칫으로 고정한다.
 *
 *   ⚠️ 남은 것들을 지금 다 배선하지 않는 이유: 부모 인보케이션은 이미 서브리퀘스트 ~31/50 을 쓰고
 *   있고 하트비트 하나가 D1 쓰기 1이다. **증거 없이 5개를 더 얹으면** 뒤에 선 레인이 굶는다 —
 *   그건 이 세션이 방금 고친 실패 양식(#880 블로거 굶주림)과 같은 클래스다.
 *   ⇒ 지금은 **늘어나지 못하게만** 막고, 실제로 멈춘 정황이 나오는 레인부터 하나씩 배선한다.
 *   ⚠️ 이 래칫이 못 보는 것: 이미 목록에 있는 5개가 조용히 멈추는 것(그건 여전히 안 보인다).
 */
describe('worker-ads — 생 waitUntil 레인은 관측 밖이다(래칫)', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
  /** `ctx.waitUntil((async () => { … })` 블록을 중괄호 짝으로 정확히 잘라낸다(문자열 길이 추정 금지). */
  const rawLanes = (): string[] => {
    const out: string[] = []
    for (const m of src.matchAll(/ctx\.waitUntil\(\(async \(\) => \{/g)) {
      const open = m.index! + m[0].length - 1
      let depth = 0
      for (let j = open; j < src.length; j++) {
        if (src[j] === '{') depth++
        else if (src[j] === '}' && --depth === 0) { out.push(src.slice(m.index!, j + 1)); break }
      }
    }
    return out
  }

  it('검사 대상이 실제로 존재한다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect(rawLanes().length).toBeGreaterThanOrEqual(5)
  })

  it('🔒 하트비트 없는 생 레인이 하나도 없다 — 새 레인은 반드시 kick 또는 adsBeat', () => {
    // ⚠️ 본문을 모듈로 분리하고 `adsBeat` 을 **인자로 넘기는** 형태도 관측된 것으로 본다
    //   (`runSheetsMirrorLane(env, adsBeat)`). 호출만 보면 놓치므로 토큰 뒤 `(`·`,`·`)` 를 모두 받는다.
    //   그 형태의 진짜 보증은 아래 짝 검사다 — 넘긴 쪽이 실제로 하트비트를 남기는지 모듈에서 확인한다.
    // 🔒 2026-07-29 후속: 남아 있던 5개(social-maintenance · autobid · 18시 일일배치 · 23시 팔로업 ·
    //   주간 리포트)를 전부 배선해 **허용치가 0** 이 됐다. 비용 우려는 구조로 해소된다 —
    //   시간 게이트 레인은 한 시각에 하나씩만 켜지므로 정각당 실제 증가는 +1~2 D1 쓰기다.
    const blind = rawLanes().filter(b => !/adsBeat[(,)]/.test(b))
    expect(blind.length, `관측 밖 레인 ${blind.length}개 — kick() 을 쓰거나 adsBeat 을 남겨라`).toBe(0)
  })

  it('🔒 시트 미러는 하트비트를 남긴다 — 09:00 이후 멈춘 걸 아무도 못 보던 자리', () => {
    // 분리 후에도 불변식은 그대로다: ① 엔트리가 그 레인에 beat 를 넘긴다 ② 레인이 실제로 남긴다.
    expect(src).toMatch(/runSheetsMirrorLane\(env, adsBeat\)/)
    const lane = readFileSync(join(process.cwd(), 'src/worker-ads/sheets-mirror-lane.ts'), 'utf8')
    expect(lane).toMatch(/beat\('sheets-sync'/)
    expect((lane.match(/beat\('sheets-sync'/g) || []).length, '성공·실패 양쪽 경로에 남겨야 한다').toBeGreaterThanOrEqual(2)
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

/**
 * 🛡️ 드라이버는 **응답을 라운드 뒤로 미루지 않는다**.
 *
 * 부모의 `kick` 은 SELF fetch 를 await 한다 → 드라이버가 라운드를 다 돌고 응답하면
 * 부모가 그 시간 내내 묶인다. #835 가 라운드를 부모의 *서브리퀘스트 예산*에서는 뺐지만
 * *수명*에서는 못 뺐던 이유이고, 그래서 07:00 틱에 느린 레인이 통째로 굶었다.
 * ⚠️ 못 막는 것: 드라이버가 아닌 **단발 느린 레인**(collect 등)은 여전히 부모를 붙잡는다.
 */
describe('enrich.routes.ts — 드라이버는 즉시 응답한다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/enrich.routes.ts'), 'utf8')

  it('드라이버 핸들러 본문에 라운드 for 루프가 직접 들어있지 않다', () => {
    const offenders: string[] = []
    for (const m of src.matchAll(/enrichRoutes\.post\('\/__ads\/[a-z-]*-driver'[\s\S]{0,600}?\n\}\)/g)) {
      if (/\bfor\s*\(/.test(m[0])) offenders.push(m[0].split('\n')[0].slice(0, 70))
    }
    expect(offenders).toEqual([])
  })

  it('드라이버는 체인을 await 한 채 응답하지 않는다 — 부모의 kick 이 그만큼 묶인다', () => {
    const offenders: string[] = []
    for (const m of src.matchAll(/enrichRoutes\.post\('\/__ads\/[a-z-]*-driver'[\s\S]{0,600}?\n\}\)/g)) {
      if (/await\s+runRoundChain\(/.test(m[0])) offenders.push(m[0].split('\n')[0].slice(0, 70))
    }
    expect(offenders).toEqual([])
  })

  it('체인은 waitUntil 로 분리되고 결과를 하트비트로 남긴다(관측 유실 금지)', () => {
    expect(src).toMatch(/executionCtx\?\.waitUntil/)
    expect(src).toMatch(/driverBeat\(/)
  })

  it('드라이버가 두 개 다 분리 헬퍼를 쓴다(검사 대상 존재 확인)', () => {
    expect((src.match(/dispatchRoundChain\(/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  /**
   * 🔎 **부분 실행이 조용히 성공으로 보이지 않는가** (2026-07-29 라이브 실측 후 추가).
   *
   * 10:00 틱 기록: `ads:enrich-influencer-driver · ok:true · ms:18,615`. 12라운드를 계획했는데
   * 라운드 1회가 실측 16초니 **한 라운드밖에 못 돈 것**이다. 그런데 `ok:true` 라 화면상 정상이었고,
   * 왜 멈췄는지는 어디에도 없었다. 이 레포가 반복해 만난 형태 — 실패가 아니라 **조용한 부분 실행**.
   *
   * ⚠️ 지금 구현은 self-chain(라운드마다 새 인보케이션)이라 depth 0 이 "몇 라운드 돌았는지"를 알 수 없다.
   *    대신 `planned`(계획) 와 `chained`(다음 라운드를 낳았는가) 로 판정한다 — 계획이 12인데
   *    `chained=false` 면 그 자리에서 끊긴 것이고, `error` 가 그 이유다.
   */
  it('체인 결과(planned/chained/error)를 하트비트에 남긴다 — 부분 실행을 조용히 넘기지 않는다', () => {
    const beat = /async function driverBeat\([\s\S]{0,700}?\n\}/.exec(src)?.[0] || ''
    expect(beat).toMatch(/recordCronBeat\(/)
    for (const k of ['planned', 'chained', 'error']) expect(beat).toContain(k)
  })
})

/**
 * 🛡️ ur-ads 배포 트리거가 **실제 의존 코드**를 덮는가.
 *
 * `deploy-ads.yml` 의 `paths` 는 손으로 적은 목록이라 드리프트한다. 실제로 드리프트해 있었다:
 * `src/worker/**`(ur-ads 의 하트비트 기록기 `cron-heartbeat.ts` 가 여기 있다)와
 * `src/features/social-media/**`(매시간 도는 소셜 유지보수)가 빠져 있어서, 그 파일만 바꾸면
 * **배포가 아예 안 돌고 ur-ads 는 조용히 낡은 코드로 계속 돈다** — 실패도 안 나므로 눈치채기 어렵다.
 *
 * ⚠️ 못 막는 것: 전이 의존(worker-ads → marketing → 제3의 폴더)까지는 안 본다. 직접 import 만.
 */
describe('deploy-ads.yml — 배포 트리거가 ur-ads 의존 경로를 덮는다', () => {
  const wf = readFileSync(join(process.cwd(), '.github/workflows/deploy-ads.yml'), 'utf8')
  const srcFiles = ['index.ts', 'enrich.routes.ts', 'public-data.routes.ts', 'lane-cadence.ts']
    .map(f => join(process.cwd(), 'src/worker-ads', f))
    .filter(p => { try { readFileSync(p); return true } catch { return false } })

  // `@/features/marketing/...` → 'src/features/marketing' · `@/worker/utils/...` → 'src/worker/utils'
  const prefixes = new Set<string>()
  for (const f of srcFiles) {
    const t = readFileSync(f, 'utf8')
    for (const m of t.matchAll(/@\/([a-z-]+)\/([a-z-]+)/g)) prefixes.add(`src/${m[1]}/${m[2]}`)
  }
  /** 정확히 그 경로거나, 더 넓은 상위 경로가 있으면 덮인 것으로 본다. */
  const covered = (p: string): boolean => {
    const parts = p.split('/')
    for (let i = parts.length; i >= 2; i--) if (wf.includes(`'${parts.slice(0, i).join('/')}/**'`)) return true
    return false
  }

  it('검사 대상이 실제로 있다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect(srcFiles.length).toBeGreaterThan(0)
    expect(prefixes.size).toBeGreaterThan(0)
  })

  it('worker-ads 가 import 하는 모든 최상위 경로가 paths 에 있다', () => {
    const missing = [...prefixes].filter(p => !covered(p)).sort()
    expect(missing).toEqual([])
  })
})

describe('orphanLaneBeats — 기록은 있는데 지금은 아무도 안 부르는 이름', () => {
  it('알려진 목록에 없는 ads 기록을 고아로 잡는다', () => {
    // 실측 사례: sweep-kakao-phone → sweep-kakao-chain 개명 후 옛 행이 영원히 stale
    expect(orphanLaneBeats(['sweep-kakao-chain'], ['ads:sweep-kakao-phone', 'ads:sweep-kakao-chain']))
      .toEqual(['ads:sweep-kakao-phone'])
  })

  it("스케줄러 자체 신호('scheduled')는 레인이 아니므로 고아로 보지 않는다", () => {
    expect(orphanLaneBeats(['collect'], ['ads:scheduled', 'ads:collect'])).toEqual([])
  })

  it('쿼리가 붙은 이름도 레인 기준으로 판정한다', () => {
    expect(orphanLaneBeats(['maintenance'], ['ads:maintenance?phase=merge'])).toEqual([])
  })

  it('메인 워커 cron 은 비교 대상이 아니다', () => {
    expect(orphanLaneBeats([], ['cache-prewarm', 'retry-alimtalk'])).toEqual([])
  })

  it('never_fired 와 정확히 반대 방향이다 — 둘을 같이 봐야 "안 도는 것"과 "이제 없는 것"이 갈린다', () => {
    const known = ['collect', 'collect-nps']
    const beats = ['ads:collect', 'ads:old-lane']
    expect(neverFiredLanes(known, beats)).toEqual(['collect-nps'])
    expect(orphanLaneBeats(known, beats)).toEqual(['ads:old-lane'])
  })
})

/**
 * 🐛 **beat 이름을 덮어쓴 레인이 두 목록에 동시에 뜨던 오탐** (2026-07-29 라이브에서 오진을 유발했다).
 *
 * `kick(path, fn, { beat })` 은 하트비트 이름을 경로와 다르게 쓸 수 있고, 실제로 쓰는 레인이 있다
 * (`/__ads/enrich-company-driver` → beat `enrich-company`). 그런데 알려진 목록엔 **경로 이름**이,
 * 하트비트엔 **beat 이름**이 들어가서:
 *   · `never_fired` — 경로 이름(enrich-company-driver)으로는 기록이 없다 → "한 번도 안 돎"
 *   · `orphan_lanes` — beat 이름(enrich-company)은 알려진 목록에 없다 → "이제 없는 레인"
 * **같은 레인이 양쪽에 동시에** 떴고, 이번 세션이 그걸 보고 "보강 드라이버가 한 번도 안 돌았다"고
 * 오진했다. 관측 도구가 틀린 답을 주면 없느니만 못하다.
 */
describe('레인 등록 — beat 이름을 덮어쓰면 그 이름으로 등록한다', () => {
  it('beat 이 있으면 beat 이름으로, 없으면 경로에서 유도', () => {
    const reg = createLaneRegistry()
    reg.note('/__ads/enrich-company-driver', 'enrich-company')
    reg.note('/__ads/collect-nps')
    expect(reg.list()).toEqual(['collect-nps', 'enrich-company'])
  })

  it('🔒 덮어쓴 레인이 never_fired 에도 orphan 에도 안 뜬다 — 오탐의 정확한 재현', () => {
    const reg = createLaneRegistry()
    reg.note('/__ads/enrich-company-driver', 'enrich-company')
    const beats = ['ads:enrich-company']            // 하트비트는 beat 이름으로 남는다
    expect(neverFiredLanes(reg.list(), beats)).toEqual([])
    expect(orphanLaneBeats(reg.list(), beats)).toEqual([])
  })

  it('빈 beat 은 무시하고 경로로 폴백한다(빈 문자열이 이름을 지우면 안 된다)', () => {
    const reg = createLaneRegistry()
    reg.note('/__ads/collect-nps', '')
    reg.note('/__ads/collect-mx', '   ')
    expect(reg.list()).toEqual(['collect-mx', 'collect-nps'])
  })

  it('worker-ads 의 kick 이 beat 을 등록에 넘긴다 — 순수함수만 고치면 배선이 빠진다', () => {
    // 이 레포가 반복해 만난 형태: 함수는 고쳤는데 호출부가 안 넘겨 **조용히 예전 동작** 유지.
    const idx = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
    expect(idx).toMatch(/laneReg\.note\(path,\s*opts\?\.beat\)/)
  })
})

/**
 * 🤝 **19시 양보** — 시간별 정비 순환과 야간 재보정이 같은 lease 를 다투던 것 (2026-07-29).
 *
 *   `runMaintenancePhase` 와 `runNightlyRescan` 은 의도적으로 같은 `MAINT_LEASE_KEY` 를 잡는다
 *   (둘 다 YouTube 쿼터를 써서 동시 실행이 곧 하루 예산 낭비). 그런데 시간별 순환이 도입된
 *   2026-07-28 부터 19시에 **둘 다** 발화했고, 먼저 dispatch 되는 순환이 항상 이겼다.
 *   진 쪽은 스냅샷도 안 남기고 돌아가 어드민에서는 "한 번도 안 돔"으로 보였다
 *   (실측: `maintenance_rescan.at` 이 2026-07-27T19:00 에서 정지 — 순환 배포 당일부터).
 *
 *   ⚠️ 양보는 공짜가 아니다 — 그 시각 슬롯의 단계가 한 번 덜 돈다. 그래서 **양보 후에도**
 *   ① 모든 단계가 하루에 최소 한 번 돌고 ② 실제 최대 간격이 경보 임계 안에 있어야 한다.
 *   이 둘을 계산으로 고정한다(배정표를 나중에 바꿔도 자동으로 재검사된다).
 */
describe('🤝 야간 재보정에 19시를 양보해도 정비 순환이 굶지 않는다', () => {
  const YIELD = [19]
  const slotAt = (h: number) => MAINT_SCHEDULE[h % MAINT_SCHEDULE.length]

  it('양보한 시각의 단계가 다른 시각에도 배정돼 있다 — 아니면 그 단계가 영영 안 돈다', () => {
    const yielded = slotAt(19)
    const remaining = Array.from({ length: 24 }, (_, h) => h).filter(h => !YIELD.includes(h) && slotAt(h) === yielded)
    expect(remaining.length, `${yielded} 가 19시에만 배정돼 있다 — 양보하면 사라진다`).toBeGreaterThan(0)
  })

  /**
   * ⚠️ **지금 배정표(12슬롯)에서는 이 검사가 절대 안 깨진다** — 24 % 12 === 0 이라 모든 슬롯이 하루 2회
   *   돌고, 19시 슬롯은 7시에도 돈다. 그러니 "늘 초록"을 "검사가 헛돈다"로 읽지 말 것:
   *   길이를 **20 이상**으로 바꾸면 19시에만 도는 슬롯이 생기고(19+20 > 23) 그때 빨간불이 뜬다(실측 확인).
   *   즉 이 검사는 지금이 아니라 **다음 사람이 배정표 길이를 바꿀 때** 값을 한다.
   */
  it('양보 후에도 모든 단계가 하루 안에 최소 한 번 돈다', () => {
    const ran = new Set(Array.from({ length: 24 }, (_, h) => h).filter(h => !YIELD.includes(h)).map(slotAt))
    const missing = MAINT_PHASES.filter(p => !ran.has(p))
    expect(missing, `양보로 하루 동안 사라지는 단계: ${missing.join(', ')}`).toEqual([])
  })

  /**
   * 경보 임계는 **양보를 모르는** 값(`scheduleGapMinutes(PHASES, [19])`)으로 계산돼 워커에 들어간다.
   * 실제 간격이 그 값을 넘으면 정상 동작이 stale 로 신고된다 — 경보를 무디게 만드는 것만큼이나 나쁘다
   * (거짓 경보가 반복되면 사람이 경보를 끈다).
   */
  it('양보를 반영한 임계가 양보 전 임계보다 느슨해지지 않거나, 느슨해졌다면 그만큼만이다', () => {
    const before = maxScheduleGapHours(MAINT_SCHEDULE)
    const after = maxScheduleGapHours(MAINT_SCHEDULE, YIELD)
    expect(after).toBeGreaterThanOrEqual(before)      // 양보는 간격을 넓히기만 한다
    expect(after, `양보 후 최대 간격 ${after}h — 하루를 넘으면 그 단계는 사실상 정지다`).toBeLessThanOrEqual(24)
    expect(scheduleGapMinutes(MAINT_SCHEDULE, YIELD)).toBe(staleGapMinutes(after * 60))
  })

  it('🔒 스케줄러가 실제로 양보한다 — 상수 공유(두 벌로 두면 한쪽만 옮겨져 다시 겹친다)', () => {
    const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
    expect(src).toMatch(/export const RESCAN_HOUR_UTC = 19/)
    // 양보는 `gates.hourlySchedule(PHASES, [RESCAN_HOUR_UTC], …)` 한 자리에서 표현된다 —
    // 조건과 주기를 따로 쓰면(첫 판이 그랬다) 'raw kick 금지' 불변식이 먼저 잡는다.
    expect(src, '순환이 19시를 양보하지 않는다').toMatch(/gates\.hourlySchedule\(PHASES, \[RESCAN_HOUR_UTC\]/)
    expect(src, '재보정 시각이 상수를 안 쓴다').toMatch(/dailyAt\(RESCAN_HOUR_UTC,/)
  })

  it('🔒 경합에 진 재보정이 흔적을 남긴다 — 무음이면 "안 돎"과 구분되지 않는다', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-maintenance.ts'), 'utf8')
    const block = /export async function runNightlyRescan[\s\S]{0,2000}?\n\}/.exec(src)?.[0] || ''
    expect(block, 'runNightlyRescan 을 못 찾았다').toBeTruthy()
    // busy 반환 경로에서 스냅샷 키를 쓴다
    const busyPath = /acquireLease\([\s\S]{0,900}?\n  \}/.exec(block)?.[0] || ''
    expect(busyPath).toMatch(/ads_maintenance_rescan_last/)
  })
})

/**
 * 📍 **지역 백필의 자리** — 라이브 실측(2026-07-29)이 만든 불변식.
 *
 *   | 지역 판정 | 인원 | 비중 |
 *   |---|---|---|
 *   | 값 있음 | **282** | **0.7%** |
 *   | 지역 없는 키워드로 확정 | 1,808 | 4.6% |
 *   | **미판정** | **37,075** | **94.7%** |
 *
 *   `강남 맛집` 한 키워드로 741명을 모았는데 어드민에서 `region=강남` 은 **0명**이었다.
 *   동네딜은 지역×업종 매칭이 본질이라 그 축이 사실상 없는 상태였다.
 *
 *   ❗ 처음엔 "예산 고갈로 굶는다"고 읽었는데 **틀렸다** — 채워진 2,090건이 정확히 5회차 × 400 이라
 *   백필은 **정상 동작 중이고 단지 느렸다**(3.9일). 고칠 것은 고장이 아니라 **자리와 크기**였다.
 *   ⇒ 수집 꼬리(예산 바닥) → 정비 `reextract` 단계(fresh 인보케이션, 할 일 0이라 슬롯이 남던 곳).
 *
 *   ⚠️ 이 테스트가 못 보는 것: 실제 채움 속도(라이브 값이라 코드가 모른다). `stats.region_pending` 으로 볼 것.
 */
describe('지역 백필 — 한 곳에서만, 정비 인보케이션에서', () => {
  const collect = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
  const maint = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-maintenance.ts'), 'utf8')

  it('🔒 수집 레인은 더 이상 백필을 부르지 않는다(두 벌 금지)', () => {
    expect(collect).not.toMatch(/await backfillRegions\(/)
    expect(collect).not.toMatch(/await recheckBlankRegions\(/)
  })

  it('🔒 정비의 reextract 단계가 스윕을 돈다 — 할 일 0이던 슬롯이 실제 일을 갖는다', () => {
    expect(maint).toMatch(/out\.region = await sweepRegions\(bdb, budget\)/)
    expect(maint).toMatch(/await backfillRegions\(DB, POOL, 500\)/)
  })

  it('🔒 예산이 남는 동안 반복한다 — 한 청크로 끝나면 옮긴 의미가 없다', () => {
    expect(maint).toMatch(/while \(!budget\.exhausted && budget\.left >= 6\)/)
  })
})
