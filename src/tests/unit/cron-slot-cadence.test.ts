import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expectedMaxAgeMinutes } from '@/worker/utils/cron-heartbeat'

const SRC = readFileSync(join(process.cwd(), 'src/worker/scheduled.ts'), 'utf8')
/** 주석 제거 — 배선은 **코드**에 있어야 한다(주석에만 남아도 통과하는 함정 차단). */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * ⏰ **슬롯 작업의 주기 오탐** (2026-08-13 — 대표 *"굳이 필요없는 알람은 없애줘"*).
 *
 * 소비자 cron 은 대부분 5분 캐리어에 얹혀 `slotDue(...)` 로 자기 시각에만 돈다. 그런데 하트비트엔
 * **캐리어 식**이 기록돼, 경보가 기대치를 40분(5×2+30)으로 잡고 하루 1회 작업을 23시간 내내
 * `stale` 로 신고한다. 라이브 실측: `cron 실패 24h 8건`이 **전부** 이 오탐이었다
 * (stay-reminder · meal-voucher-expire · district-coupon-expire … 매일 18:40 KST 1회).
 *
 * ⚠️ 매일 울리는 경보는 곧 아무도 안 읽는 경보가 된다 — 이 레포가 반복해 만난 병이고,
 *   그래서 진짜 정지가 오탐 더미에 묻힌 적이 실제로 있었다(`cron-stale-watch` docblock의 실측).
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 슬롯 식이 `slotDue` 인자와 실제로 같은 시각인지(문자열 대조는
 *   `slotCron('40 9 * * *')` 이 `{minute:40,hour:9}` 블록 안에 있는지까지만 본다).
 */
describe('⏰ 슬롯 cron 은 자기 주기를 신고한다', () => {
  it('🔴 5분 캐리어로 판정하면 하루 1회 작업은 40분 뒤부터 stale 이다 — 이것이 오탐의 정체', () => {
    expect(expectedMaxAgeMinutes('*/5 * * * *')).toBe(40)
    expect(expectedMaxAgeMinutes('40 9 * * *')).toBe(1800)      // 하루 + 6h (회차 누락이 보이게)
    expect(expectedMaxAgeMinutes('45 0 * * 1')).toBe(10440)     // 주간 + 6h
    expect(expectedMaxAgeMinutes('25 * * * *')).toBe(150)       // 매시 + 여유
  })

  it('🔌 배선 — safeCron 이 주기를 받아 하트비트에 넘긴다', () => {
    expect(CODE).toMatch(/const safeCron = async \(name: string, task: \(\) => Promise<unknown>, gapMin\?: number\)/)
    expect(CODE).toMatch(/recordCronBeat\(env, name, ok, Date\.now\(\) - t0, cron, out, gapMin, meter\)/)
  })

  it('🔌 배선 — slotCron 이 cron 식을 SSOT 로 환산한다(새 상수 금지)', () => {
    expect(CODE).toMatch(/const slotCron = \(expr: string\)[\s\S]{0,400}expectedMaxAgeMinutes\(expr\)/)
  })

  /**
   * 🔒 **핵심 불변식** — `slotDue` 블록 안에서 `safeCron` 을 **직접** 부르면 그 작업은 캐리어 주기로
   *   기록돼 다시 매일 오탐을 낸다. 블록 안은 전부 `slotCron(...)` 이어야 한다.
   */
  it('🔒 슬롯 블록 안에는 생 safeCron 호출이 없다', () => {
    const lines = CODE.split('\n')
    const offenders: string[] = []
    for (let i = 0; i < lines.length; i++) {
      // 🩹 2026-08-31: 게이트가 `slotDue(...)` → `slotOpen(spec)`(정시 + 만회)로 바뀌었다. 둘 다 본다.
      //   ⚠️ **`if (` 로 시작하는 줄만** — 안 그러면 `slotOpen` **정의** 줄(안에 slotDue 가 있다)이
      //      블록 시작으로 읽혀 파일 앞부분 전체가 '슬롯 블록'이 된다(실제로 그렇게 오탐이 났다).
      const isGate = lines[i]!.includes('if (')
        && (lines[i]!.includes('slotOpen(') || lines[i]!.includes('slotDue(event.scheduledTime'))
      if (!isGate) continue
      for (let j = i + 1; j < lines.length && lines[j] !== '  }'; j++) {
        if (/(?<!slot)\bsafeCron\(/.test(lines[j]!)) offenders.push(`${j + 1}: ${lines[j]!.trim().slice(0, 70)}`)
      }
    }
    expect(offenders, `슬롯 블록 안 생 safeCron — 캐리어 주기로 기록돼 매일 오탐이 된다:\n${offenders.join('\n')}`).toEqual([])
  })

  it('🔒 검사 대상이 0 이면 실패 — 블록이 사라졌거나 이름이 바뀐 것이다', () => {
    const blocks = (CODE.match(/slotOpen\(\{/g) || []).length
      + (CODE.match(/slotDue\(event\.scheduledTime/g) || []).length
    expect(blocks).toBeGreaterThanOrEqual(4)
    expect((CODE.match(/slotCron\('/g) || []).length).toBeGreaterThanOrEqual(20)
  })
})
