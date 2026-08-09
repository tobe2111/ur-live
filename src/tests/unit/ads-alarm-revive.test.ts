/**
 * 🫀 **죽은 알람 체인 되살리기** — "걸려 있다"와 "살아 있다"는 다르다.
 *
 * ## 이 테스트가 지키는 사고 (2026-08-09 라이브 실측)
 * 측정 갈래 하나(`enrich-influencer`)가 **6시간 죽어 있었다.** 예약 시각이 3.5시간 과거인데
 * 안 깨어난 상태였고, 부트스트랩은 `getAlarm()` 이 non-null 이라는 이유로 **매 정각 확인하면서
 * 매 정각 그냥 넘어갔다**:
 * ```
 *   enrich-influencer    마지막 실행 16:24 · alarmAt 3.5h 과거   → 시간당 측정 262 → 0
 *   lane-alarm-boot:…    ok=true  started=false                 → 화면은 계속 초록
 * ```
 * `lane-alarm-boot.ts` 헤더는 *"알람 체인이 어떤 이유로든 끊겨도 다음 정각이 되살린다"* 고
 * 약속했지만 **그 약속이 이 경우엔 거짓이었다.** 자가치유가 자기가 고쳐야 할 상태를 건강으로 읽었다.
 *
 * ## 왜 유닛으로 고정하나
 * 이건 값 하나가 아니라 **판정 규칙**이다. 규칙이 되돌아가면 레인이 또 조용히 죽고, 그건
 * 에러가 없어 아무도 모른다 — 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 다.
 *
 * ## 못 막는 것 (과신 금지)
 * - **왜 알람이 안 깨어났는지는 이 수리가 답하지 않는다.** 여기서 하는 건 *깨어나지 않았을 때
 *   되살아나게* 만드는 것이다. 근본 원인(런타임 유실·CPU 사망 등)은 여전히 미확정이다.
 * - 실제 DO storage 동작은 유닛이 못 본다(배선 존재만 소스로 확인). 라이브 판정은
 *   `lane-alarm-boot:*` 하트비트의 `revived` 필드로 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { alarmReviveKind, ALARM_DEAD_AFTER_MS, ALARM_INTERVAL_MS_DEFAULT } from '@/worker-ads/lane-alarm-policy'

const NOW = 1_700_000_000_000

describe('알람 되살리기 판정 — 과거 예약은 죽은 것이다', () => {
  it('알람이 없으면 처음 세운다', () => {
    expect(alarmReviveKind(null, NOW)).toBe('none')
    expect(alarmReviveKind(undefined, NOW)).toBe('none')
    expect(alarmReviveKind(Number.NaN, NOW)).toBe('none')
  })

  it('미래 예약은 건드리지 않는다 — 정상 동작을 덮어쓰면 회차를 잃는다', () => {
    expect(alarmReviveKind(NOW + 60_000, NOW)).toBe('alive')
    expect(alarmReviveKind(NOW, NOW)).toBe('alive')
  })

  it('🔴 한참 지난 예약은 죽은 것으로 보고 되살린다 — 이 사고의 핵심', () => {
    // 실측 사례: 예약 시각이 3.5시간 과거인데 안 깨어났다.
    expect(alarmReviveKind(NOW - 3.5 * 3_600_000, NOW)).toBe('stale')
    expect(alarmReviveKind(NOW - ALARM_DEAD_AFTER_MS - 1, NOW)).toBe('stale')
  })

  /**
   * ⚠️ **여유가 간격보다 넉넉해야 한다.** 런타임의 알람 발화는 정확하지 않아 수십 초~수 분 지연이
   * 정상이다. 여유가 간격보다 짧으면 **정상 지연을 죽음으로 오판**해 알람을 계속 덮어쓰고,
   * 그러면 고치려던 것과 반대로 회차를 잃는다(부호만 반대인 같은 고장).
   */
  it('✅ 짧은 지연은 죽음이 아니다 — 정상 지연을 덮어쓰면 오히려 회차를 잃는다', () => {
    expect(alarmReviveKind(NOW - 60_000, NOW)).toBe('alive')
    expect(alarmReviveKind(NOW - ALARM_INTERVAL_MS_DEFAULT, NOW)).toBe('alive')
    expect(ALARM_DEAD_AFTER_MS).toBeGreaterThan(ALARM_INTERVAL_MS_DEFAULT * 2)
  })
})

describe('배선 — 빠지면 레인이 또 조용히 죽는다', () => {
  /** 주석 제거 — 주석에만 남은 이름이 배선으로 오인되는 걸 막는다(이 레포가 여러 번 밟은 함정). */
  const src = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('🔴 부트스트랩이 판정 함수를 실제로 쓴다(non-null 이면 무조건 통과하면 안 된다)', () => {
    expect(src).toMatch(/alarmReviveKind\(cur, Date\.now\(\)\)/)
    expect(src, "'alive' 가 아닐 때 알람을 다시 걸어야 한다").toMatch(/kind !== 'alive'[\s\S]{0,160}setAlarm\(/)
  })

  it("🔴 'none' 과 'stale' 을 구분해 남긴다 — 뭉개면 사고가 또 안 보인다", () => {
    expect(src).toMatch(/revived:\s*kind === 'stale'/)
  })

  it('✅ 살아 있는 알람은 덮어쓰지 않는다 — 무조건 setAlarm 은 회차를 잃는다', () => {
    // `/start` 본문에 조건 없는 setAlarm 이 있으면 정상 알람도 매 정각 밀린다.
    const startBody = src.match(/if \(url\.pathname !== '\/start'\)[\s\S]*?\n  \}/)?.[0] ?? src
    const unconditional = /\n\s{4}await this\.ctx\.storage\.setAlarm\(/.test(startBody)
    expect(unconditional, '조건 없는 setAlarm 이 /start 최상위에 있다').toBe(false)
  })
})
