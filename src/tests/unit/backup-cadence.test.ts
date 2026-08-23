import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { expectedMaxAgeMinutes } from '../../worker/utils/cron-heartbeat'

/**
 * 🗄️ **백업이 하루 안에 한 벌을 만들 수 있는가** (2026-08-23)
 *
 * 실측: cron 1회차 = `reads 25 · 6.69MB · 약 12,500행`. 유어애즈 DB 는 약 754,000행이다.
 * 시간당 1회면 **60시간** — "일 1회 백업"이 원리적으로 불가능하고, 게다가 한 벌이 2.5일에 걸쳐
 * 만들어져 **시점이 어긋난 스냅샷**이 된다(첫 테이블은 월요일, 마지막은 수요일 상태).
 *
 * 시간당 4회로 올리면 15시간 — 하루 안에 들어온다. 이 테스트는 그 지점을 고정한다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 cron 발화. 트리거는 Cloudflare 에 등록돼 있고 레포는 그걸
 *    못 본다. 여기서 고정하는 것은 "코드가 몇 번 시도하도록 짜여 있는가" 까지다.
 */
const SCHEDULED = readFileSync('src/worker/scheduled.ts', 'utf8')

describe('백업 주기', () => {
  it('🔑 시간당 4회 이상 시도한다 (1회면 전체 스냅샷에 60시간)', () => {
    const m = /\[([\d,\s]+)\]\.some\(\(m\) => slotDue\(event\.scheduledTime, \{ minute: m \}\)\)/.exec(SCHEDULED)
    expect(m, '백업 슬롯이 배열 형태가 아니다 — 단일 minute 로 되돌아갔는지 확인').toBeTruthy()
    const slots = (m![1].split(',').map((s) => Number(s.trim())))
    expect(slots.length, `시간당 ${slots.length}회 — 4회 미만이면 하루 안에 한 벌을 못 만든다`).toBeGreaterThanOrEqual(4)
    for (const s of slots) expect(s).toBeGreaterThanOrEqual(0), expect(s).toBeLessThan(60)
    // 5분 캐리어 위에 올라타므로 **5의 배수**가 아니면 그 슬롯은 영원히 안 걸린다(조용한 무동작).
    for (const s of slots) expect(s % 5, `분 ${s} 는 5의 배수가 아니라 5분 틱에 절대 안 걸린다`).toBe(0)
  })

  it('🔑 신고하는 주기가 실제 슬롯 수와 일치한다 (침묵 판정이 느슨해지지 않게)', () => {
    const slotsM = /\[([\d,\s]+)\]\.some\(\(m\) => slotDue/.exec(SCHEDULED)
    const exprM = /slotCron\('([^']+)'\)\('d1-backup-chunked'/.exec(SCHEDULED)
    expect(exprM, "d1-backup-chunked 의 slotCron 식을 못 찾았다").toBeTruthy()
    const slotCount = slotsM![1].split(',').length
    const exprMinuteCount = exprM![1].trim().split(/\s+/)[0].split(',').length
    expect(exprMinuteCount, '실행 슬롯 수와 신고한 cron 식의 분 개수가 다르다 — 하나만 고치면 경보가 어긋난다')
      .toBe(slotCount)
  })

  it('🩸 분 목록을 "매시 1회"로 오해석하지 않는다 (멈춰도 조용해진다)', () => {
    // 15분마다 → 기대 간격도 15분 기준이어야 한다. 60분 기준이면 2시간 멈춰도 경보가 없다.
    expect(expectedMaxAgeMinutes('5,20,35,50 * * * *')).toBe(15 * 2 + 30)
    // 하위호환: 단일 분은 종전과 같은 값
    expect(expectedMaxAgeMinutes('50 * * * *')).toBe(60 * 2 + 30)
    expect(expectedMaxAgeMinutes('*/5 * * * *')).toBe(5 * 2 + 30)
  })
})
