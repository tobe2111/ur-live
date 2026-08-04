/**
 * ⏰ **DO 알람 레인** — cron 부모의 CPU 천장을 우회하는 시범(2026-08-02 대표 승인 "한 레인 시범 후 확장").
 *
 * ## 왜 이 시범인가 — 오늘 하루가 증명한 것
 * ```
 *   KST 16:00  디스패치 8 → 완주 2 · 사망 4 (ms 3,880~4,152, 값이 같다 = 같은 순간에 끌려감)
 *   KST 17:00  디스패치 6 → 완주 3 · 사망 3 (ms 3,649~3,701)   ← per_tick 을 줄여도 사망률 50% 그대로
 * ```
 * ⚠️ **레인을 싸게 만드는 것으론 못 고친다.** 사망 목록의 `sheets-sync` 는 같은 날 커서로 잘라
 *   12,000행만 보게 해 둔 레인인데도 죽었다 — 자기 일에 지친 게 아니라 **부모가 죽으며 끌려간** 것이다.
 *
 * ## 이 파일이 지키는 것
 * 알람의 **안전장치**다. 무료 플랜 DO 알람 한도를 이 환경에서 확인할 수 없어(대시보드 차단)
 * "안전할 것"이라고 말하는 대신 **코드가 스스로 상한을 갖게** 했고, 그 상한이 사라지지 않게 고정한다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 실제 무료 한도. 그건 라이브 스탬프(`ads_lane_alarm_last`)로만 판정된다 —
 *   그게 이 시범의 목적이고, 결과를 보고 확장할지 되돌릴지 정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  alarmEnabled, resolveInterval, resolveRunsPerHour, nextWakeAt, hourBucket,
  ALARM_INTERVAL_MS_DEFAULT, ALARM_INTERVAL_MS_MIN, RUNS_PER_HOUR_DEFAULT, FAIL_BACKOFF_MAX,
} from '../../worker-ads/lane-alarm-policy'

describe('알람 게이트 — 기본 ON, 끄려면 명시적으로', () => {
  it('미설정이면 켜진다 — "켜야 도는 구조"는 이 레포가 반복해 만난 조용한 부재를 만든다', () => {
    expect(alarmEnabled(undefined)).toBe(true)
    expect(alarmEnabled({})).toBe(true)
  })

  it("'false' 만 끈다 — 오타로 레인이 멈추지 않게", () => {
    expect(alarmEnabled({ ADS_LANE_ALARM_ENABLED: 'false' })).toBe(false)
    for (const v of ['true', 'FALSE', '0', 'no', '']) {
      expect(alarmEnabled({ ADS_LANE_ALARM_ENABLED: v }), v).toBe(true)
    }
  })
})

describe('간격·상한 — 폭주 방지가 이 시범의 전제다', () => {
  it('기본은 5분(시간당 12회) — 무료 한도를 모르므로 보수적으로 시작', () => {
    expect(resolveInterval(undefined)).toBe(ALARM_INTERVAL_MS_DEFAULT)
    expect(ALARM_INTERVAL_MS_DEFAULT).toBe(5 * 60_000)
  })

  it('🛡️ 하한이 있다 — env 오타(0·음수·문자)로 폭주하지 않는다', () => {
    expect(resolveInterval('1000')).toBe(ALARM_INTERVAL_MS_MIN)
    for (const bad of ['0', '-5', 'abc', '']) {
      expect(resolveInterval(bad), bad).toBe(ALARM_INTERVAL_MS_DEFAULT)
    }
  })

  it('🛡️ 시간당 상한은 1 이상 60 이하 — 0 이면 레인이 통째로 멈춘다', () => {
    expect(resolveRunsPerHour(undefined)).toBe(RUNS_PER_HOUR_DEFAULT)
    expect(resolveRunsPerHour('0')).toBe(RUNS_PER_HOUR_DEFAULT)
    expect(resolveRunsPerHour('-3')).toBe(RUNS_PER_HOUR_DEFAULT)
    expect(resolveRunsPerHour('999')).toBe(60)
    expect(resolveRunsPerHour('20')).toBe(20)
  })
})

describe('다음 기상 시각 — 상한과 백오프', () => {
  const HOUR = 3_600_000
  const now = 10 * HOUR + 12_000 // 정시로부터 12초 지난 시각

  it('상한 아래면 간격 뒤에 깨운다', () => {
    expect(nextWakeAt(now, 300_000, 3, 12, 0)).toBe(now + 300_000)
  })

  it('🛡️ 상한을 채우면 다음 정시까지 쉰다 — 이게 시간당 상한의 실체다', () => {
    expect(nextWakeAt(now, 300_000, 12, 12, 0)).toBe(11 * HOUR)
    expect(nextWakeAt(now, 300_000, 99, 12, 0)).toBe(11 * HOUR)
  })

  it('실패가 이어지면 간격이 늘어난다 — 죽은 체인도, 재시도 폭풍도 만들지 않는다', () => {
    const a = nextWakeAt(now, 300_000, 1, 12, 0)
    const b = nextWakeAt(now, 300_000, 1, 12, 1)
    const c = nextWakeAt(now, 300_000, 1, 12, 20)
    expect(b).toBeGreaterThan(a)
    expect(c - now).toBe(300_000 * FAIL_BACKOFF_MAX) // 상한이 있다(무한히 멀어지지 않는다)
  })

  it('항상 미래다 — 과거를 예약하면 알람이 즉시 재발화해 폭주한다', () => {
    for (const runs of [0, 5, 12, 100]) {
      for (const fs of [0, 1, 9]) {
        expect(nextWakeAt(now, 300_000, runs, 12, fs), `${runs}/${fs}`).toBeGreaterThan(now)
      }
    }
  })

  it('시간 버킷은 정시마다 바뀐다 — 상한 카운터가 리셋되는 근거', () => {
    expect(hourBucket(10 * HOUR)).toBe(10)
    expect(hourBucket(10 * HOUR + HOUR - 1)).toBe(10)
    expect(hourBucket(11 * HOUR)).toBe(11)
  })
})

/**
 * 🔌 **배선** — 순수함수만 보면 "함수는 있는데 아무도 안 부르는" 사고를 못 잡는다
 *   (이 레포가 `isUnjudgedRound` 로 이미 당했다). 소스로 확인한다.
 */
describe('배선 — 알람이 실제로 이 레인을 몬다', () => {
  const idx = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
  const toml = readFileSync(join(process.cwd(), 'wrangler-ads.toml'), 'utf8')
  const doSrc = readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm.ts'), 'utf8')
  const bootSrc = readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm-boot.ts'), 'utf8')

  it('🔒 DO 클래스를 엔트리에서 export 한다 — 빼면 배포는 되는데 알람이 영원히 안 깨어난다', () => {
    expect(idx).toMatch(/export \{ AdsLaneDurableObject \} from '\.\/lane-alarm'/)
  })

  it('🔒 wrangler 에 바인딩 + 무료 호환 마이그레이션이 있다', () => {
    expect(toml).toMatch(/name = "ADS_LANE"/)
    expect(toml).toMatch(/class_name = "AdsLaneDurableObject"/)
    expect(toml).toMatch(/new_sqlite_classes = \["AdsLaneDurableObject"\]/)
  })

  it('🔒 알람이 켜지면 cron 은 같은 레인을 안 띄운다 — 두 경로가 겹치면 같은 사람을 두 번 잰다', () => {
    expect(idx).toMatch(/const laneAlarmOn = laneAlarmDrivesEnrich\(env\)/)
    expect(idx).toMatch(/if \(!laneAlarmOn && \(env as unknown as \{ ADS_INFLUENCER_ENRICH_DISABLED/)
    // 게이트는 **한 곳**에서만 판단한다 — 두 군데서 각자 판단하면 한쪽만 고쳐져 두 경로가 겹친다.
    expect(bootSrc).toMatch(/return alarmEnabled\(env\) && !!\(env as \{ ADS_LANE\?/)
  })

  /**
   * 🎯 **수집 레인도 같은 규칙을 받는다** (2026-08-03).
   *   부모 디스패치를 안 끊으면 알람과 cron 이 겹쳐 던진다. 리스가 이중 *실행* 은 막지만
   *   던지는 것 자체가 **부모 CPU 를 또 먹는다** — 그게 애초에 이 레인을 죽인 원인이다.
   */
  it('🔒 수집도 알람이 몰면 cron 은 손을 뗀다', () => {
    expect(idx).toMatch(/if \(!laneAlarmOn && env\.ADS_AUTO_COLLECT_ENABLED === 'true'\)/)
  })

  /**
   * ⚠️ **선언이 첫 사용보다 위에 있어야 한다** — `const` 는 TDZ 라 아래 있으면 **런타임에 터진다**
   *   (타입체크는 통과한다). 수집 게이트가 보강 블록보다 위에 있어 작성 중 실제로 밟았다.
   */
  it('🔒 laneAlarmOn 선언이 첫 사용보다 앞에 있다 — TDZ 는 타입체크가 못 잡는다', () => {
    const decl = idx.indexOf('const laneAlarmOn = laneAlarmDrivesEnrich(env)')
    const firstUse = idx.indexOf('!laneAlarmOn')
    expect(decl).toBeGreaterThanOrEqual(0)
    expect(firstUse).toBeGreaterThanOrEqual(0)
    expect(decl, '선언이 첫 사용보다 뒤에 있다 → 런타임 ReferenceError').toBeLessThan(firstUse)
  })

  /**
   * 📉 **수집은 시간당 1회로 못 박는다** — 기본값(12)을 그대로 받으면 cron 설계 의도(`0 * * * *`)를
   *   넘는 증설이고, 그건 네이버로 나가는 요청을 늘리는 일이라 **대표 판단 사항**이다.
   *   ⚠️ 이 값을 올릴 땐 그 판단을 다시 받을 것. 테스트가 조용히 바뀌는 걸 막는다.
   */
  it('🔒 수집 레인은 runsPerHour 1 — cron 의도 복원이지 증설이 아니다', () => {
    const runners = readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm-runners.ts'), 'utf8')
    expect(runners).toMatch(/collect: \{\s*\n\s*runsPerHour: 1,/)
    expect(runners).toMatch(/runInfluencerAutoCollect/)
  })

  /**
   * 📊 **시트 미러 이관 불변식 3장** (2026-08-04 — 전 레인 최다 CPU 사망 ×16/3일이라 알람으로).
   *
   *   ⚠️ ②가 이 셋의 핵심이다: 시트 미러는 **리스가 없다**(커서 기반 append). cron 게이트
   *   `!laneAlarmOn` 이 빠지면 알람과 cron 이 같은 시간에 겹쳐 돌고, 행이 **중복**된다 —
   *   collect 는 리스가 받쳐 주지만 이 레인은 게이트가 유일한 방어다.
   */
  it('🔒 시트 미러 — 알람 등록 + runsPerHour 1 (Sheets 쿼터 증설 금지)', () => {
    const runners = readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm-runners.ts'), 'utf8')
    expect(runners).toMatch(/'sheets-sync': \{\s*\n\s*runsPerHour: 1,/)
    expect(runners).toMatch(/runSheetsMirrorDirect/)
  })

  it('🔒 시트 미러 — 알람이 몰면 cron 은 손을 뗀다(겹치면 시트 행 중복)', () => {
    // 게이트가 같은 if 조건 안에 있어야 한다 — 근처 어딘가가 아니라.
    expect(idx).toMatch(/if \(!laneAlarmOn && env\.ADS_SHEETS_SYNC_ENABLED === 'true'\)/)
  })

  it('🔒 시트 미러 — 알람 러너는 게이트 OFF 면 no-op (알람은 매시간 무조건 깨므로)', async () => {
    const { runSheetsMirrorDirect } = await import('@/worker-ads/sheets-mirror-lane')
    // env 에 DB 가 없다 — 게이트를 안 보고 진행하면 여기서 throw 한다(= 게이트가 첫 관문임을 증명).
    const r = await runSheetsMirrorDirect({} as never)
    expect(r).toEqual({ skipped: 'gate_off' })
  })

  it('🔒 매 정각 부트스트랩 — 체인이 끊겨도 다음 정각이 되살린다', () => {
    expect(idx).toMatch(/ctx\.waitUntil\(bootstrapLaneAlarm\(env, adsBeat\)\)/)
    // 🗂️ 이름은 등록부가 준다(클래스 하나 · 이름별 인스턴스). 보강 레인이 그 안에 있어야 한다.
    expect(bootSrc).toMatch(/ns\.idFromName\(lane\)/)
    expect(readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm-runners.ts'), 'utf8'))
      .toMatch(/'enrich-influencer': \{/)
    expect(doSrc).toMatch(/pathname !== '\/start'/)
    // 멱등: 이미 알람이 있으면 다시 걸지 않는다(중복 체인 금지).
    expect(doSrc).toMatch(/const cur = await this\.ctx\.storage\.getAlarm\(\)/)
  })

  /**
   * 🫀 부트스트랩이 조용히 실패하면 알람이 안 서고, cron 킥은 게이트로 꺼져 있어 **레인이 통째로
   *   사라진다.** 그게 이 레포가 반복해 만난 '관측 밖 레인'이라, 성공·실패 양쪽에 하트비트를 요구한다
   *   (시트 미러와 같은 짝 검사 — 넘긴 쪽이 실제로 남기는지 모듈에서 확인).
   */
  it('🔒 부트스트랩은 성공·실패 양쪽에 하트비트를 남긴다', () => {
    expect((bootSrc.match(/beat\(`lane-alarm-boot:\$\{lane\}`/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(bootSrc).toMatch(/catch \(err\)/) // throw 가 다른 레인을 끌고 가지 않는다
  })

  it('🔒 알람은 다음 알람을 반드시 건다 — 안 걸면 체인이 영구히 멎는다', () => {
    expect(doSrc).toMatch(/await this\.ctx\.storage\.setAlarm\(at\)/)
    // 실패해도 멎지 않게 try/catch 로 감싼 실행부가 있어야 한다.
    expect(doSrc).toMatch(/catch \(err\) \{\s*error =/)
  })

  it('📊 회차마다 스탬프를 남긴다 — 무료 한도 측정이 이 시범의 목적이다', () => {
    expect(doSrc).toMatch(/LANE_ALARM_STAMP_KEY/)
    expect(doSrc).toMatch(/runs_this_hour: ran/)
  })

  /**
   * ⚠️ 이 검사가 없으면 위 상한 테스트가 **장식**이 된다: DO 가 정책을 자기 안에서 다시 정의하면
   *   테스트가 지키는 값과 라이브가 쓰는 값이 갈린다(이 레포의 '낡은 지도' 클래스).
   */
  it('🔒 DO 는 안전장치를 policy 에서 가져온다 — 자체 정의로 갈라지면 상한 테스트가 헛돈다', () => {
    expect(doSrc).toMatch(/from '\.\/lane-alarm-policy'/)
    expect(doSrc).not.toMatch(/^\s*(export\s+)?const (ALARM_INTERVAL_MS_\w+|RUNS_PER_HOUR_DEFAULT|FAIL_BACKOFF_MAX)\s*=/m)
    expect(doSrc).not.toMatch(/^\s*(export\s+)?function (resolveInterval|resolveRunsPerHour|nextWakeAt|alarmEnabled)\b/m)
    // 게이트도 같은 policy 를 본다(DO 와 다른 판단을 하면 두 경로가 겹친다).
    expect(bootSrc).toMatch(/import \{ alarmEnabled \} from '\.\/lane-alarm-policy'/)
  })
})
