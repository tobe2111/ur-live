/**
 * ⏸️ 유어애즈 레인 일시정지 스위치 — 2026-09-02 (D1 계정 일일 읽기 한도 사고).
 *
 * 지키는 것:
 *   ① `ADS_LANES_PAUSED='true'` 만 정지(대소문자·공백 관용, 그 외 전부 동작)
 *   ② 사람에게 가는 두 레인(온보딩·리마인드)은 정지 중에도 뜬다
 *   ③ 배선 — cron `kick` 이 정지 중 띄우지 않고(등록은 함) · 부트스트랩·시트 미러가 정지를 본다 · 정지 표식 하트비트
 *   ④ DO 알람 — 정지 중엔 **체인을 이어 걸고** 레인은 안 돌린다(킬스위치처럼 끊지 않는다), 학습 상태 무접촉
 *   ⑤ 감시 — 정지 표식이 신선하면 `ads:*` 침묵은 경보가 아니다; 표식이 오래됐거나 paused=false 면 경보다
 *   ⑥ 표식 이름이 양쪽(worker-ads / cron-heartbeat)에서 같다
 *   ⑦ 📏 유어애즈 계량기 배선 — 엔트리가 env 를 감싸고, self-beat 와 DO 스탬프가 계량기를 싣는다
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lanesPaused, pauseExempt, PAUSE_BEAT, PAUSE_EXEMPT_PATHS } from '@/worker-ads/lane-pause'
import { adsLanesPausedFrom, isPausedAdsBeat, ADS_PAUSE_BEAT_NAME, ADS_PAUSE_FRESH_MIN } from '@/worker/utils/cron-heartbeat'

const INDEX = readFileSync('src/worker-ads/index.ts', 'utf8')
const ALARM = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')
const SELF_BEAT = readFileSync('src/worker-ads/self-beat.ts', 'utf8')
const HB = readFileSync('src/worker/utils/cron-heartbeat.ts', 'utf8')
const WATCH = readFileSync('src/worker/cron/cron-stale-watch.ts', 'utf8')

describe('lane-pause — 순수', () => {
  it('① true 만 정지', () => {
    expect(lanesPaused({ ADS_LANES_PAUSED: 'true' })).toBe(true)
    expect(lanesPaused({ ADS_LANES_PAUSED: ' TRUE ' })).toBe(true)
    for (const v of ['false', '1', 'yes', '', undefined]) expect(lanesPaused({ ADS_LANES_PAUSED: v })).toBe(false)
    expect(lanesPaused(undefined)).toBe(false)
  })
  it('② 사람 대면 두 레인만 면제', () => {
    expect(pauseExempt('/__ads/inbound-onboarding')).toBe(true)
    expect(pauseExempt('/__ads/consented-reminder?x=1')).toBe(true)
    expect(pauseExempt('/__ads/collect-chain')).toBe(false)
    expect(pauseExempt('/__ads/maintenance?phase=merge')).toBe(false)
    expect(PAUSE_EXEMPT_PATHS.size).toBe(2)
  })
})

describe('lane-pause — 배선', () => {
  it('③ kick 은 등록 뒤·push 앞에서 정지를 본다', () => {
    const kick = INDEX.slice(INDEX.indexOf('const kick = ('), INDEX.indexOf('const gates = makeHourGates'))
    const note = kick.indexOf('laneReg.note(path, opts?.beat)')
    const gate = kick.indexOf('if (paused && !pauseExempt(path)) return')
    const push = kick.indexOf('pending.push(')
    expect(note).toBeGreaterThan(-1); expect(gate).toBeGreaterThan(note); expect(push).toBeGreaterThan(gate)
  })
  it('③ paused 는 kick 선언보다 앞에 있고(TDZ), 부트스트랩·시트 미러가 본다', () => {
    expect(INDEX.indexOf('const paused = lanesPaused(env)')).toBeLessThan(INDEX.indexOf('const kick = ('))
    expect(INDEX).toMatch(/if \(laneAlarmOn && !paused\) ctx\.waitUntil\(bootstrapLaneAlarm\(env, adsBeat\)\)/)
    const sheets = INDEX.slice(INDEX.indexOf("env.ADS_SHEETS_SYNC_ENABLED === 'true'"), INDEX.indexOf('runSheetsMirrorLane'))
    expect(sheets).toMatch(/if \(!paused\) ctx\.waitUntil\(/)
  })
  it('③ 매 정각 정지 표식 하트비트를 남긴다(paused 값 그대로)', () => {
    expect(INDEX).toMatch(/adsBeat\(PAUSE_BEAT, true, 0, undefined, 120, \{ paused \}\)/)
  })
  it('④ DO 알람은 정지 중 다음 알람을 걸고 돌아간다 — 킬스위치 return 과 다르다', () => {
    const alarm = ALARM.slice(ALARM.indexOf('async alarm()'), ALARM.indexOf('const lane = lookupAlarmLane'))
    expect(alarm).toMatch(/if \(lanesPaused\(this\.env\)\) \{\s*await this\.ctx\.storage\.setAlarm\(/)
    // 학습 상태 쓰기(storage.put)보다 앞에서 돌아간다
    expect(alarm).not.toMatch(/storage\.put/)
  })
  it('⑥ 표식 이름이 양쪽에서 같다', () => {
    expect(ADS_PAUSE_BEAT_NAME).toBe(`ads:${PAUSE_BEAT}`)
  })
})

describe('lane-pause — 감시 판정', () => {
  const beat = (age: number, result: string | null) => [{ name: ADS_PAUSE_BEAT_NAME, age_minutes: age, result }]
  it('⑤ 신선한 paused=true 만 정지로 본다', () => {
    expect(adsLanesPausedFrom(beat(10, 'paused=true'))).toBe(true)
    expect(adsLanesPausedFrom(beat(10, 'paused=false'))).toBe(false)
    expect(adsLanesPausedFrom(beat(ADS_PAUSE_FRESH_MIN + 1, 'paused=true'))).toBe(false)
    expect(adsLanesPausedFrom(beat(10, null))).toBe(false)
    expect(adsLanesPausedFrom([])).toBe(false)
  })
  it('⑤ 정지 중엔 ads:* 만, 표식 행 자신은 제외', () => {
    expect(isPausedAdsBeat('ads:collect', true)).toBe(true)
    expect(isPausedAdsBeat(ADS_PAUSE_BEAT_NAME, true)).toBe(false)
    expect(isPausedAdsBeat('cache-prewarm', true)).toBe(false)
    expect(isPausedAdsBeat('ads:collect', false)).toBe(false)
  })
  it('⑤ 배선 — 헬스 게이트와 침묵 감시 둘 다 정지를 본다', () => {
    const health = HB.slice(HB.indexOf('export async function getCronHealth'))
    expect(health).toMatch(/const adsPaused = adsLanesPausedFrom\(beats\)/)
    expect(health).toMatch(/isPausedAdsBeat\(b\.name, adsPaused\)\) retired\.push/)
    expect(WATCH).toMatch(/!isPausedAdsBeat\(b\.name, adsPaused\)/)
  })
})

describe('📏 유어애즈 계량기 — 배선', () => {
  it('⑦ 엔트리가 fetch/scheduled 의 env 를 계량 래퍼로 감싼다', () => {
    expect(INDEX).toMatch(/fetch: \(req: Request, env: Env, ctx: ExecutionContext\) => app\.fetch\(req, withMeteredEnv\(env, newMeter\(\)\), ctx\)/)
    expect(INDEX).toMatch(/scheduled\(event, withMeteredEnv\(env, newMeter\(\)\), ctx\)/)
  })
  it('⑦ self-beat 가 계량기를 싣고, DO 는 회차마다 새 계량기로 스탬프를 남긴다', () => {
    expect(SELF_BEAT).toMatch(/recordCronBeat\(env, `ads:\$\{beat\}`, ok, ms, undefined, ok \? undefined : failNote\(err\), gap, readEnvMeter\(env\)\)/)
    expect(ALARM).toMatch(/this\.env = withMeteredEnv\(env, \(\) => this\.meter\)/)
    expect(ALARM).toMatch(/this\.meter = newMeter\(\)/)
    expect(ALARM).toMatch(/staleGapMinutes\(Math\.max\(1, Math\.round\(60 \/ Math\.max\(1, cap\)\)\)\), this\.meter\)/)
  })
})
