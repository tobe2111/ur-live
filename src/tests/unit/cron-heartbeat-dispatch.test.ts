/**
 * 🌆 **일간 레인 분리**가 조용히 되돌아가지 않게 못박는다 (2026-08-25).
 *
 * ## 무엇이 있었나
 *
 * `0 18 * * *` 한 인보케이션에 작업 **16개**가 몰려 있었다. 무료 플랜은 인보케이션당
 * 서브리퀘스트가 ~50 이고 작업 하나가 D1 왕복 2~5회를 쓴다. 예산이 마르면 뒤쪽 작업은
 * **에러 없이 잘린다** — `recordCronBeat` 의 write 조차 실패하고 fail-soft catch 가 삼킨다.
 *
 * 실측 2026-08-24: 그 16개 **전부** 하트비트가 없었다(정산 성숙·원장 정합 포함).
 * 경보는 0이었다 — 그건 `staleToleranceMinutes` 에서 따로 고쳤다.
 *
 * ## 이 파일이 지키는 것
 *
 * 1. 그룹이 **서로 다른 인보케이션**에서 돈다(분이 다르고, 5의 배수이며, 겹치지 않는다).
 * 2. 각 그룹에 **진짜 기록 래퍼**(safeCron / slotCron)가 주입된다.
 * 3. 머니 작업이 `money` 그룹에 있고 **전용 트리거**를 쓴다.
 *
 * ⚠️ **못 막는 것**: 실제 서브리퀘스트 소비량. 그룹을 나눠도 한 그룹이 예산을 넘으면 똑같이
 *   잘린다 — 그건 하트비트로만 보이고, 이제 일간 관용이 30시간이라 하루 안에 드러난다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/** 주석은 배선이 아니다 — 실행 코드만 판정한다(이 레포가 반복해 걸린 함정). */
const code = readFileSync('src/worker/scheduled.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
const lane = readFileSync('src/worker/cron/daily-lane.ts', 'utf8')

/** `runDailyLane('<그룹>', { … run: <래퍼> … })` 배선 전수. */
const wiring = [...code.matchAll(/runDailyLane\(\s*'([^']+)'[\s\S]{0,240}?run:\s*([A-Za-z]+)/g)]
  .map((m) => ({ group: m[1], run: m[2] }))

describe('일간 레인 — 인보케이션 분리', () => {
  it('네 그룹이 전부 배선돼 있다', () => {
    const groups = wiring.map((w) => w.group).sort()
    expect(groups, `배선된 그룹: ${groups.join(', ')}`).toEqual(['growth', 'integrity', 'maintenance', 'money'])
  })

  it('🔴 그룹마다 기록 래퍼가 safeCron 또는 slotCron 이다 — 이름만 run 인 것은 관측 밖이다', () => {
    for (const w of wiring) {
      expect(['safeCron', 'slotCron'], `${w.group} 에 '${w.run}' 이 주입됐다`).toContain(w.run)
    }
  })

  it('🔴 money 는 전용 트리거(0 18)를 쓴다 — 가장 확실한 자리를 돈에 준다', () => {
    expect(code).toMatch(/cron === '0 18 \* \* \*'\)\s*\{\s*runDailyLane\('money'/)
  })

  it('🔴 나머지 셋은 서로 다른 분에서 돈다 — 같은 분이면 같은 인보케이션이라 분리가 무의미하다', () => {
    const mins = [...code.matchAll(/slotDue\(event\.scheduledTime,\s*\{\s*minute:\s*(\d+),\s*hour:\s*18\s*\}\)/g)]
      .map((m) => Number(m[1]))
    expect(mins.length, '18시 슬롯 게이트를 못 찾았다(구조가 바뀌었나?) — 통과 아님').toBe(3)
    expect(new Set(mins).size, `분이 겹친다: ${mins.join(',')}`).toBe(3)
    for (const m of mins) expect(m % 5, `분 ${m} 은 */5 격자에 없다 — 영원히 안 돈다`).toBe(0)
  })

  it('🔴 슬롯이 신고하는 주기가 실제 게이트와 일치한다 — 갈라지면 오탐/미탐이 된다', () => {
    const mins = [...code.matchAll(/slotDue\(event\.scheduledTime,\s*\{\s*minute:\s*(\d+),\s*hour:\s*18\s*\}\)[\s\S]{0,260}?slotCron\('(\d+) 18 \* \* \*'\)/g)]
    expect(mins.length, 'slotDue ↔ slotCron 짝을 못 찾았다 — 통과 아님').toBe(3)
    for (const [, gate, declared] of mins) {
      expect(declared, `게이트 :${gate} 인데 :${declared} 로 신고한다`).toBe(gate)
    }
  })
})

describe('일간 레인 — 그룹 배정', () => {
  const MONEY = ['auto-settlement', 'expired-voucher-refund', 'supplier-settlement-mature',
    'affiliate-mature', 'referral-mature']

  it('🔴 머니 작업이 전부 money 그룹 안에 있다', () => {
    const block = /group === 'money'\)\s*\{([\s\S]*?)\n    return\n  \}/.exec(lane)?.[1] ?? ''
    expect(block.length, "money 그룹 블록을 못 찾았다 — 통과 아님").toBeGreaterThan(100)
    for (const n of MONEY) expect(block, `${n} 이 money 그룹 밖으로 나갔다`).toContain(`'${n}'`)
  })

  it('작업 16개가 전부 남아 있다 — 분리하면서 흘리지 않았다', () => {
    const names = [...lane.matchAll(/run\('([^']+)'/g)].map((m) => m[1])
    expect(new Set(names).size, `이관된 작업: ${names.join(', ')}`).toBe(16)
  })
})
