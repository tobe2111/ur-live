/**
 * 🔁 **정비 단계를 시각이 아니라 커서로 돌린다** (2026-08-02).
 *
 * ## 왜 (라이브 근거)
 * ```
 *   ads_reextract_cursor   KST 10:00 이후 13시간째 제자리 · region_pending 32,761 불변
 *   KST 21:00 merge        CPU 한도로 사망(cron_failures 에 기록)
 *   KST 22:00 reextract    디스패치됐는데 성공·실패 어느 기록도 없음
 * ```
 * 단계가 `MAINT_SCHEDULE[hourUTC % 12]` 에 묶여 **한 단계가 하루 2~4회**뿐이다. 한 번 죽으면 다음 기회가
 * 6~12시간 뒤라, 회차 하나를 잃는 비용이 그대로 진도 정지가 된다.
 *
 * 알람은 시간당 12회 깨어나는데, 시각 기반 회전을 그대로 두면 **12회차가 전부 같은 단계**를 돈다.
 * ⇒ 회전축을 커서로 옮기고, 배정표의 슬롯 가중치는 그대로 재사용한다(순서대로 한 바퀴 = 슬롯 비율).
 *
 * ⚠️ **이 테스트가 못 보는 것**: 실제 알람 발화와 리스 경합. 그건 라이브 스탬프
 *   (`ads_lane_alarm_last:maintenance`)로만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAINT_PHASE_CURSOR_KEY, MAINT_SCHEDULE_VERSION, parsePhaseCursor, formatPhaseCursor, nextPhaseSlot,
} from '../../features/marketing/api/maintenance-phase-cursor'
import { MAINT_SCHEDULE, MAINT_SLOT_INTENT } from '../../features/marketing/api/influencer-maintenance'

describe('단계 커서 계약', () => {
  it('판이 다르면 처음부터 — 배정표를 바꿨는데 옛 인덱스를 쓰면 엉뚱한 단계가 엉뚱한 빈도로 돈다', () => {
    expect(parsePhaseCursor(`${MAINT_SCHEDULE_VERSION}:7`, MAINT_SCHEDULE_VERSION)).toBe(7)
    expect(parsePhaseCursor(`${MAINT_SCHEDULE_VERSION + 1}:7`, MAINT_SCHEDULE_VERSION)).toBe(0)
    expect(parsePhaseCursor('7', MAINT_SCHEDULE_VERSION)).toBe(0) // 판 없는 옛 값
    for (const bad of ['', null, undefined, 'x:y', '1:-3']) {
      expect(parsePhaseCursor(bad as string, MAINT_SCHEDULE_VERSION)).toBe(0)
    }
  })

  it('왕복한다 — 저장한 값을 그대로 읽어야 회차가 이어진다', () => {
    for (const c of [0, 1, 11, 999]) {
      expect(parsePhaseCursor(formatPhaseCursor(MAINT_SCHEDULE_VERSION, c), MAINT_SCHEDULE_VERSION)).toBe(c)
    }
  })

  it('🅿️ 커서는 집기 전에 전진한다 — 안 그러면 무거운 단계가 죽을 때마다 같은 자리를 무한 재시도한다', () => {
    const len = MAINT_SCHEDULE.length
    expect(nextPhaseSlot(0, len)).toEqual({ index: 0, nextCursor: 1 })
    expect(nextPhaseSlot(len - 1, len)).toEqual({ index: len - 1, nextCursor: 0 }) // 한 바퀴 → 처음으로
    expect(nextPhaseSlot(len + 3, len)).toEqual({ index: 3, nextCursor: 4 })       // 범위 밖도 접힌다
    for (const bad of [-1, NaN, Infinity]) expect(nextPhaseSlot(bad, len).index).toBe(0)
  })

  it('🔒 한 바퀴는 배정표의 슬롯 비율과 정확히 같다 — 가중치 계약이 커서에서도 성립해야 한다', () => {
    const seen: Record<string, number> = {}
    let c = 0
    for (let i = 0; i < MAINT_SCHEDULE.length; i++) {
      const { index, nextCursor } = nextPhaseSlot(c, MAINT_SCHEDULE.length)
      seen[MAINT_SCHEDULE[index]!] = (seen[MAINT_SCHEDULE[index]!] || 0) + 1
      c = nextCursor
    }
    for (const [phase, intent] of Object.entries(MAINT_SLOT_INTENT)) {
      expect(seen[phase], `${phase} 슬롯 수 불일치`).toBe(intent.slots)
    }
    expect(c, '한 바퀴 뒤 커서는 처음으로 돌아온다').toBe(0)
  })

  it('커서 키는 재추출 커서와 다른 키다 — 같은 키를 쓰면 서로를 덮어쓴다', () => {
    expect(MAINT_PHASE_CURSOR_KEY).toBe('ads_maint_phase_cursor')
  })
})

/**
 * 🔌 **배선** — 순수함수만 보면 "함수는 있는데 아무도 안 부르는" 사고를 못 잡는다.
 */
describe('배선 — 알람이 정비를 몰고, cron 은 그때 손을 뗀다', () => {
  const idx = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
  const runners = readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm-runners.ts'), 'utf8')
  const doSrc = readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm.ts'), 'utf8')
  const boot = readFileSync(join(process.cwd(), 'src/worker-ads/lane-alarm-boot.ts'), 'utf8')
  const maint = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-maintenance.ts'), 'utf8')

  it('🔒 등록부에 정비 레인이 있고, 커서 회전 함수를 부른다', () => {
    expect(runners).toMatch(/maintenance: \{/)
    expect(runners).toMatch(/runNextMaintenancePhase/)
    expect(maint).toMatch(/export async function runNextMaintenancePhase/)
  })

  it('🔒 커서는 실행 **전에** 저장된다 — 죽어도 다음 회차가 다음 자리로 간다', () => {
    const body = /export async function runNextMaintenancePhase[\s\S]*?\n\}/.exec(maint)?.[0] || ''
    expect(body, 'runNextMaintenancePhase 를 못 찾음').not.toBe('')
    expect(body.indexOf('formatPhaseCursor')).toBeGreaterThanOrEqual(0)
    expect(body.indexOf('formatPhaseCursor')).toBeLessThan(body.indexOf('runMaintenancePhase(env, phase)'))
  })

  it('🔒 알람이 켜지면 cron 정비 순환은 안 돈다 — 같은 리스를 다투면 진 쪽이 흔적 없이 사라진다', () => {
    expect(idx).toMatch(/ADS_AUTO_MAINTENANCE_ENABLED !== 'false' && !laneAlarmOn/)
  })

  it('🔒 DO 는 자기 이름으로 레인을 찾는다 — 한 클래스로 여러 레인을 몰기 위한 전제', () => {
    expect(doSrc).toMatch(/this\.ctx\.id\.name/)
    expect(doSrc).toMatch(/lookupAlarmLane\(this\.lane\)/)
    // 모르는 이름이면 다음 알람을 안 건다(유령 인스턴스가 영원히 깨어나지 않게).
    expect(doSrc).toMatch(/if \(!lane\) return/)
  })

  it('📊 스탬프 키가 레인별로 갈린다 — 공유하면 나중 레인이 앞 레인 기록을 덮어쓴다', () => {
    expect(doSrc).toMatch(/\$\{LANE_ALARM_STAMP_KEY\}:\$\{this\.lane\}/)
  })

  it('🫀 부트스트랩은 등록된 모든 레인을 세우고, 레인별로 하트비트를 남긴다', () => {
    expect(boot).toMatch(/for \(const lane of ALARM_LANE_NAMES\)/)
    expect((boot.match(/lane-alarm-boot:\$\{lane\}/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})
