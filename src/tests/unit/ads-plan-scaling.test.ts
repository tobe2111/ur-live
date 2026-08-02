/**
 * 💳 **요금제 하나로 수집 능력이 함께 올라간다** — 그리고 **무료는 한 바이트도 안 바뀐다**.
 *
 * ## 왜 이 파일이 있나 (2026-08-02 대표 요구)
 * *"무료 선에선 완벽했으면 좋겠고, 유료 전환 시 자동으로 수집 능력이 올라가면 좋겠네"*
 *
 * 그 전엔 조임쇠가 **셋인데 요금제를 아는 건 하나뿐**이었다:
 *
 * | 조임쇠 | 요금제 인지 | 유료로 바꾸면 |
 * |---|---|---|
 * | 회차당 레인 수 | ✅ `ADS_PLAN` | 8 → 64 |
 * | 서브리퀘스트 천장 | ❌ raw env 만 | **60 그대로** |
 * | 보강 라운드 벽시계 | ❌ raw env 만 | **7s 그대로** |
 *
 * 즉 유료로 바꿔도 **레인 수만 늘고 레인당 일은 그대로**였다. 그건 자동이 아니라 반쪽이다.
 *
 * ## 이 파일이 지키는 것
 * 1. **무료 회귀 0** — 요금제를 안 주면 세 값이 전부 종전과 같다. (가장 중요하다. 새 축을 넣다가
 *    현재 라이브를 흔들면 그게 제일 큰 손해다.)
 * 2. **유료는 셋이 함께 오른다** — 하나라도 안 오르면 그게 병목이 되어 나머지가 무의미해진다.
 * 3. **명시 env 가 요금제보다 우선** — 되돌리기 경로(무배포 롤백)가 살아 있어야 한다.
 * 4. **AIMD 불변식(하향 > 회복)이 요금제와 무관하게 유지** — 깨지면 회차가 계속 죽는 동안에도
 *    상한이 순증해 영영 못 내려온다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 유료 기본값(900 · 20s)이 *맞는 값인지*. 그건 문자열로 판정 불가다
 *   — 전환 후 하트비트의 **성공 max ↔ 실패 min 경계**로만 보인다(무료 7s 를 정한 방법과 같다).
 *   여기서는 "함께 오른다"와 "무료가 안 변한다"만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import {
  SUBREQ_PLATFORM_CAP_DEFAULT, SUBREQ_PLATFORM_CAP_PAID, platformSubreqCap, envSubreqCap,
  ENRICH_DEADLINE_MS_DEFAULT, ENRICH_DEADLINE_MS_PAID, resolveEnrichDeadlineMs, envEnrichDeadlineMs,
  recoverStep, abandonStep, nextSubreqCap, capAfterAbandonedRun, envLaneBudget,
} from '../../features/marketing/api/collect-budget'
import { lanesPerTick, resolvePlan, FREE_LANES_PER_TICK, PAID_LANES_PER_TICK } from '../../worker-ads/dispatch-budget'
import {
  resolveInterval, resolveRunsPerHour, ALARM_INTERVAL_MS_DEFAULT, ALARM_INTERVAL_MS_PAID,
  RUNS_PER_HOUR_DEFAULT, RUNS_PER_HOUR_PAID,
} from '../../worker-ads/lane-alarm-policy'
import fs from 'node:fs'

describe('요금제 스케일링 — 무료 회귀 0', () => {
  /**
   * 🔒 이 블록이 빨개지면 **라이브가 바뀐다**는 뜻이다. 유료 축을 넣는 대가로 현재 동작이
   *   흔들리는 것이 이 작업에서 가장 피하고 싶은 결과다.
   */
  it('요금제를 안 주면 세 값이 전부 종전과 같다', () => {
    expect(platformSubreqCap(undefined)).toBe(60)
    expect(platformSubreqCap(undefined, 'free')).toBe(60)
    expect(SUBREQ_PLATFORM_CAP_DEFAULT).toBe(60)

    expect(resolveEnrichDeadlineMs(undefined)).toBe(7_000)
    expect(resolveEnrichDeadlineMs(undefined, 'free')).toBe(7_000)
    expect(ENRICH_DEADLINE_MS_DEFAULT).toBe(7_000)

    expect(lanesPerTick({})).toBe(FREE_LANES_PER_TICK)

    // 🔻 08-02 전수 점검에서 찾은 두 축 — 이것들도 무료에서 값이 안 바뀌어야 한다.
    expect(resolveInterval(undefined)).toBe(ALARM_INTERVAL_MS_DEFAULT)
    expect(resolveRunsPerHour(undefined)).toBe(RUNS_PER_HOUR_DEFAULT)
    for (const d of [12, 20, 60, 80, 110, 300]) expect(envLaneBudget(undefined, d)).toBe(d)
  })

  /**
   * 보폭을 천장에서 유도하도록 바꿨다. **무료 천장(60)에서는 옛 상수와 정확히 같아야** 한다 —
   * 이 항등이 깨지면 학습 곡선이 조용히 달라진다(에러 없이 수확만 줄어드는 종류의 회귀).
   */
  it('무료 생활점에서 보폭이 옛 상수와 동일하다 (+2 / −4)', () => {
    for (const c of [60, 57, 55, 44, 40, 25]) {
      expect(recoverStep(c)).toBe(2)
      expect(abandonStep(c)).toBe(4)
    }
  })

  /**
   * 🐛 **첫 판이 여기서 틀렸다.** 보폭을 *천장*에 비례시켰더니, 천장이 크고 실제 한도가 작은 배치에서
   *   보폭이 10 이 되어 낭비가 늘었다(기존 시뮬 유닛이 30회 중 실패 6→10 으로 잡아냈다).
   *   그건 가상의 배치가 아니다 — **`ADS_PLAN=paid` 인데 계정이 아직 무료**면 정확히 그 모양이다.
   *   ⇒ 기준은 **학습값(관측된 생활점)** 이다. 천장이 얼마든 레인이 50 언저리에 살면 보폭은 2 여야 한다.
   */
  it('천장이 커도 생활점이 낮으면 보폭은 그대로다 (설정 오류에 안전)', () => {
    expect(recoverStep(900, 55)).toBe(2)
    expect(abandonStep(900, 55)).toBe(4)
    expect(recoverStep(300, 50)).toBe(2)
  })

  it('무료에서 회복/하향 결과값이 종전과 같다', () => {
    // 회복: 학습값 44 · 천장 60 → 46 (기존 +2)
    expect(nextSubreqCap(30, false, 44, 300, 60)).toBe(46)
    // 유기 하향: 44 → 40 (기존 −4)
    expect(capAfterAbandonedRun(44, 300, 60)).toBe(40)
  })
})

describe('요금제 스케일링 — 유료는 셋이 함께 오른다', () => {
  /**
   * 🔑 **하나라도 안 오르면 나머지가 무의미하다.** 레인 수만 늘고 천장이 60 이면 레인마다 60 에서
   *   멈추고, 천장만 900 이고 벽시계가 7s 면 시간이 먼저 끊는다. 셋을 한 테스트에 묶는 이유다.
   */
  it('ADS_PLAN=paid 하나로 세 조임쇠가 전부 풀린다', () => {
    const env = { ADS_PLAN: 'paid' }
    expect(lanesPerTick(env)).toBe(PAID_LANES_PER_TICK)
    expect(envSubreqCap(env)).toBe(SUBREQ_PLATFORM_CAP_PAID)
    expect(envEnrichDeadlineMs(env)).toBe(ENRICH_DEADLINE_MS_PAID)

    // 그리고 그 값들은 무료보다 실제로 커야 한다(상수를 잘못 넣어 같아지는 것 방지).
    expect(SUBREQ_PLATFORM_CAP_PAID).toBeGreaterThan(SUBREQ_PLATFORM_CAP_DEFAULT)
    expect(ENRICH_DEADLINE_MS_PAID).toBeGreaterThan(ENRICH_DEADLINE_MS_DEFAULT)
    expect(PAID_LANES_PER_TICK).toBeGreaterThan(FREE_LANES_PER_TICK)
  })

  /**
   * 🔻 **08-02 전수 점검 — 요금제가 못 닿던 축이 둘 더 있었다.**
   *
   *   ① **DO 알람 레인**(`lane-alarm-policy`): 5분 간격·시간당 12회가 고정이었다. 그런데 이 레인이
   *      **지금 실제로 보강을 돌리는 주체**다(cron 팬아웃이 아니라) — 유료로 바꿔도 처리량이 한 톨도
   *      안 늘어난다는 뜻이었다.
   *   ② **레인별 env 예산**: 실제 예산은 `min(envBudget, learnedCap, platformCap)` 인데 env 기본값이
   *      12·20·60·80·110·300 으로 제각각이고 요금제를 몰랐다. 천장을 900 으로 올려도 **레인은 80 에서 멈춘다.**
   *
   *   ⇒ 둘 다 요금제 인지형으로. 이제 `ADS_PLAN=paid` 하나가 **다섯 축**을 함께 올린다.
   */
  it('ADS_PLAN=paid 가 DO 알람과 레인 예산까지 올린다 (다섯 축)', () => {
    const env = { ADS_PLAN: 'paid' }
    expect(resolveInterval(undefined, env)).toBe(ALARM_INTERVAL_MS_PAID)
    expect(resolveRunsPerHour(undefined, env)).toBe(RUNS_PER_HOUR_PAID)
    expect(ALARM_INTERVAL_MS_PAID).toBeLessThan(ALARM_INTERVAL_MS_DEFAULT)   // 더 자주
    expect(RUNS_PER_HOUR_PAID).toBeGreaterThan(RUNS_PER_HOUR_DEFAULT)        // 더 많이

    // 레인 예산은 천장이 커진 비율만큼(60→900 = ×15), 단 천장을 넘지 않는다.
    expect(envLaneBudget(undefined, 80, env)).toBe(900)     // 80×15=1200 → 900 으로 클램프
    expect(envLaneBudget(undefined, 12, env)).toBe(180)     // 12×15
    expect(envLaneBudget(undefined, 300, env)).toBe(900)
    for (const d of [12, 20, 60, 80, 110, 300]) {
      expect(envLaneBudget(undefined, d, env), `기본값 ${d}`).toBeGreaterThan(d)
      expect(envLaneBudget(undefined, d, env)).toBeLessThanOrEqual(SUBREQ_PLATFORM_CAP_PAID)
    }
  })

  /** 명시 env 는 요금제를 이긴다 — 이 파일의 다른 축들과 같은 규약이어야 한다(규약이 갈리면 예측 불가). */
  it('새 두 축도 명시 env 가 우선한다', () => {
    const env = { ADS_PLAN: 'paid' }
    expect(resolveInterval('180000', env)).toBe(180_000)
    expect(resolveRunsPerHour('5', env)).toBe(5)
    expect(envLaneBudget('50', 300, env)).toBe(50)
  })

  /**
   * ⚠️ `lane-alarm-policy` 는 순수 정책이라 `dispatch-budget` 을 import 하지 않고 **같은 규칙을 복제**한다.
   *   두 벌이 되면 조용히 갈라진다(이 레포가 반복해 만난 클래스) — 그래서 판정을 직접 대조한다.
   */
  it('요금제 판정 규칙이 두 모듈에서 일치한다', () => {
    for (const v of ['paid', 'PAID', ' paid ', 'Paid', 'free', 'pro', '', undefined]) {
      const viaDispatch = resolvePlan({ ADS_PLAN: v }) === 'paid'
      const viaAlarm = resolveInterval(undefined, { ADS_PLAN: v }) === ALARM_INTERVAL_MS_PAID
      expect(viaAlarm, `ADS_PLAN=${JSON.stringify(v)}`).toBe(viaDispatch)
    }
  })

  /**
   * 🚦 **배선** — 함수가 옳아도 레인이 안 쓰면 의미가 없다(오늘 이미 같은 자리에서 당했다).
   *   레인 예산 기본값을 `parseInt(env.X || '', 10) || N` 형태로 되돌리면 요금제가 다시 못 닿는다.
   */
  it('레인들이 실제로 envLaneBudget 을 쓴다 — raw parseInt 잔존 0', () => {
    const dir = 'src/features/marketing/api'
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'collect-budget.ts')
    expect(files.length).toBeGreaterThan(20)   // 측정 대상이 비면 실패
    const offenders: string[] = []
    let users = 0
    for (const f of files) {
      const src = fs.readFileSync(`${dir}/${f}`, 'utf8')
      if (/envLaneBudget\(/.test(src)) users++
      if (/parseInt\(env\.ADS_(ENRICH_BUDGET|COMPANY_SUBREQUEST_BUDGET)[^)]*\)\s*\|\|\s*\d+/.test(src)) offenders.push(f)
    }
    expect(offenders, `요금제를 우회하는 예산 기본값 — envLaneBudget 로 바꿀 것:\n${offenders.join('\n')}`).toEqual([])
    expect(users, '아무도 안 쓰면 배선이 죽은 것이다').toBeGreaterThanOrEqual(5)
  })

  /**
   * 📐 천장만 올리고 보폭이 +2 로 남으면 60→900 에 **시간당 1회차 기준 17일**이 걸린다.
   *   "유료로 바꿨는데 다음 날 아침에 그대로"가 정확히 그 상태다 — 그래서 보폭도 같이 커야 한다.
   */
  it('유료 천장에서는 학습이 며칠이 아니라 하루 안에 따라붙는다', () => {
    const ceiling = SUBREQ_PLATFORM_CAP_PAID
    // 생활점이 올라가면 보폭도 같이 커진다 — 그래서 등비적으로 따라붙는다(천장 근처에서 +30).
    expect(recoverStep(ceiling, 900)).toBeGreaterThan(recoverStep(ceiling, 60))
    // 무료 수렴값(60)에서 출발해 유료 천장까지 실제로 몇 회차 걸리는지 **시뮬레이션으로** 센다.
    //   (산식으로 추정하면 보폭이 회차마다 바뀌는 걸 놓친다 — 실제로 첫 판이 그렇게 틀렸다.)
    let cap = 60, rounds = 0
    while (cap < ceiling && rounds < 500) { cap = Math.min(ceiling, cap + recoverStep(ceiling, cap)); rounds++ }
    expect(cap).toBe(ceiling)
    expect(rounds).toBeLessThanOrEqual(120) // 시간당 1회차 = 닷새 이내(종전 +2 고정이면 420회차 ≈ 17일)
  })

  /**
   * 🔑 AIMD 불변식은 요금제와 무관하다. 하향이 회복보다 크지 않으면, 회차가 계속 죽는 상황에서도
   *   상한이 순증해 **영영 못 내려온다**(2026-07-29 나선 사고의 반대 방향 버전).
   */
  it('어떤 천장에서도 하향 > 회복 이다', () => {
    for (const ceiling of [25, 40, 57, 60, 120, 300, 900]) {
      expect(abandonStep(ceiling)).toBeGreaterThan(recoverStep(ceiling))
    }
  })

  /**
   * ⚖️ 2026-07-29 진동 사고의 원인은 "비례"가 아니라 **회복이 백오프(×0.8)의 정확한 역수(×1.25)** 였던 것이다.
   *   여기 비율은 `1 + 1/30 ≈ ×1.033` — 백오프 1회를 되돌리는 데 여러 회차가 걸려야 한다.
   *   그 여유가 사라지면(역수에 가까워지면) 2회마다 1회씩 수확을 버리는 그 상태로 되돌아간다.
   */
  it('회복 비율이 백오프의 역수 근처로 가지 않는다', () => {
    for (const cap of [55, 100, 300, 900]) {
      const ratio = (cap + recoverStep(1000, cap)) / cap
      expect(ratio).toBeLessThan(1.1)        // ×1.25 는 물론 그 근처에도 안 간다
      // 백오프 1회(×0.8)를 되돌리는 데 최소 5회차 이상 걸린다 = 실패 사이 간격이 그만큼 확보된다.
      expect(Math.log(1 / 0.8) / Math.log(ratio)).toBeGreaterThanOrEqual(5)
    }
  })
})

describe('요금제 스케일링 — 명시 env 가 요금제를 이긴다 (무배포 되돌리기)', () => {
  /**
   * 요금제는 **기본값만** 정한다. 유료 전환 후 어느 한 축이 과했다고 판명되면 배포 없이 그 축만
   * 되돌릴 수 있어야 한다 — 그게 이 레포가 게이트마다 요구해 온 롤백 경로다.
   */
  it('paid 여도 명시값이 있으면 그 값을 쓴다', () => {
    expect(envSubreqCap({ ADS_PLAN: 'paid', ADS_SUBREQ_PLATFORM_CAP: '120' })).toBe(120)
    expect(envEnrichDeadlineMs({ ADS_PLAN: 'paid', ADS_ENRICH_DEADLINE_MS: '9000' })).toBe(9_000)
    expect(lanesPerTick({ ADS_PLAN: 'paid', ADS_LANES_PER_TICK: '12' })).toBe(12)
  })

  /** 모르는 값·오타는 free — 오타 하나로 예산이 16배 열리면 안 된다(안전한 쪽으로 떨어진다). */
  it('오타/미지값은 무료로 떨어진다', () => {
    for (const v of ['Paid ', 'PAID', 'pro', 'true', '1', '']) {
      const expected = v.trim().toLowerCase() === 'paid' ? SUBREQ_PLATFORM_CAP_PAID : SUBREQ_PLATFORM_CAP_DEFAULT
      expect(envSubreqCap({ ADS_PLAN: v })).toBe(expected)
    }
    expect(envSubreqCap({ ADS_PLAN: 'pro' })).toBe(SUBREQ_PLATFORM_CAP_DEFAULT)
    expect(envEnrichDeadlineMs({ ADS_PLAN: 'pro' })).toBe(ENRICH_DEADLINE_MS_DEFAULT)
  })

  it('env 없음/널에도 안 터진다', () => {
    expect(envSubreqCap(undefined)).toBe(SUBREQ_PLATFORM_CAP_DEFAULT)
    expect(envSubreqCap(null)).toBe(SUBREQ_PLATFORM_CAP_DEFAULT)
    expect(envEnrichDeadlineMs(undefined)).toBe(ENRICH_DEADLINE_MS_DEFAULT)
  })
})

describe('요금제 스케일링 — 레인이 진입점을 우회하지 않는다', () => {
  /**
   * 🚦 **이게 이 파일의 진짜 가드다.** 위 단위 검사는 함수가 옳음을 보이지만, 레인이 그 함수를
   *   *안 쓰면* 아무 의미가 없다 — 그리고 그게 정확히 방금 전까지의 상태였다(13개 파일이 raw
   *   문자열만 넘겨 요금제가 닿을 길이 없었다).
   *
   * ⚠️ 소스를 읽어 판정한다. 대상 파일이 0개면 **통과가 아니라 실패**여야 한다
   *   (이 레포의 "측정 0 = 실패" 규약 — 경로가 낡아 조용히 비는 것을 막는다).
   */
  it('raw env 를 천장/벽시계 함수에 직접 넘기는 레인이 없다', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const roots = ['src/features/marketing/api', 'src/features/supply/api']
    const files: string[] = []
    for (const r of roots) {
      for (const f of fs.readdirSync(r)) if (f.endsWith('.ts')) files.push(path.join(r, f))
    }
    expect(files.length).toBeGreaterThan(20) // 측정 대상이 비면 실패

    const offenders: string[] = []
    for (const f of files) {
      if (f.endsWith('collect-budget.ts')) continue // 정의부(주석에 옛 형태를 설명한다)
      const src = fs.readFileSync(f, 'utf8')
      if (/platformSubreqCap\(\s*env\./.test(src)) offenders.push(`${f}: platformSubreqCap(env.…)`)
      if (/resolveEnrichDeadlineMs\(\s*env\./.test(src)) offenders.push(`${f}: resolveEnrichDeadlineMs(env.…)`)
    }
    expect(offenders, `요금제를 우회하는 호출부 — envSubreqCap(env)/envEnrichDeadlineMs(env) 로 바꿀 것:\n${offenders.join('\n')}`).toEqual([])
  })

  /** 진입점이 실제로 쓰이고 있는가 — 위 검사만 있으면 "전부 지워도 통과"가 된다. */
  it('진입점을 쓰는 레인이 실제로 존재한다', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dir = 'src/features/marketing/api'
    const users = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('collect-budget.ts'))
      .filter(f => /envSubreqCap\(env\)/.test(fs.readFileSync(path.join(dir, f), 'utf8')))
    expect(users.length).toBeGreaterThanOrEqual(10)
  })
})
