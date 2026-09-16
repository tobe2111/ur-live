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
  // 📉 2026-09-02: `*/5` 슬롯 배열(:05/:20/:35/:50)은 제거됐다 — 08-25 전용 트리거와 중복돼 시간당 8회 돌며
  //   하루 ~110만 행을 읽었다(무료 한도의 22%). 이제 유일한 배선은 전용 트리거 `2,17,32,47` 이다.
  const dedicated = /cron === '([\d,]+) \* \* \* \*'[^\n]*\n\s*ctx\.waitUntil\(slotCron\('([^']+)'\)\('d1-backup-chunked'/.exec(SCHEDULED)
  it('🔑 시간당 4회 이상 시도한다 (1회면 전체 스냅샷에 60시간)', () => {
    expect(dedicated, '백업 전용 트리거 블록(cron === \'m,m,m,m * * * *\' → d1-backup-chunked)을 못 찾았다').toBeTruthy()
    const slots = dedicated![1].split(',').map((x) => Number(x.trim()))
    expect(slots.length, `시간당 ${slots.length}회 — 4회 미만이면 하루 안에 한 벌을 못 만든다`).toBeGreaterThanOrEqual(4)
    for (const m of slots) expect(m).toBeGreaterThanOrEqual(0), expect(m).toBeLessThan(60)
    // 전용 트리거의 분이 `*/5` 의 분과 겹치면 CF 가 한 인보케이션으로 합쳐 백업이 5분 틱 예산(40개가 나눠 씀)을 받는다.
    for (const m of slots) expect(m % 5, `분 ${m} 는 */5 와 겹친다 — 전용 인보케이션이 아니게 된다`).not.toBe(0)
    // 등록도 돼 있어야 한다 — 등록 안 된 식은 조용히 안 울린다(08-25 에 `*/15` 가 그랬다).
    const toml = readFileSync('wrangler.toml', 'utf8')
    expect(toml).toContain(`"${dedicated![1]} * * * *"`)
  })

  it('🔑 신고하는 주기가 실제 슬롯 수와 일치한다 (침묵 판정이 느슨해지지 않게)', () => {
    expect(dedicated).toBeTruthy()
    const slotCount = dedicated![1].split(',').length
    const exprMinuteCount = dedicated![2].trim().split(/\s+/)[0].split(',').length
    expect(exprMinuteCount, '실행 슬롯 수와 신고한 cron 식의 분 개수가 다르다 — 하나만 고치면 경보가 어긋난다')
      .toBe(slotCount)
  })

  it('🔑 `*/5` 슬롯 배열 배선이 되살아나지 않는다 (시간당 8회 = 하루 110만 행)', () => {
    expect(SCHEDULED).not.toMatch(/\]\.some\(\(m\) => slotDue\(event\.scheduledTime, \{ minute: m \}\)\)\)\s*\{\s*ctx\.waitUntil\(slotCron\('[^']+'\)\('d1-backup-chunked'/)
  })

  it('🩸 분 목록을 "매시 1회"로 오해석하지 않는다 (멈춰도 조용해진다)', () => {
    // 15분마다 → 기대 간격도 15분 기준이어야 한다. 60분 기준이면 2시간 멈춰도 경보가 없다.
    expect(expectedMaxAgeMinutes('5,20,35,50 * * * *')).toBe(15 * 2 + 30)
    // 하위호환: 단일 분은 종전과 같은 값
    expect(expectedMaxAgeMinutes('50 * * * *')).toBe(60 * 2 + 30)
    expect(expectedMaxAgeMinutes('*/5 * * * *')).toBe(5 * 2 + 30)
  })
})
