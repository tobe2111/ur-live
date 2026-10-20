import { describe, it, expect } from 'vitest'
import { expectedMaxAgeMinutes, summarizeResult } from '@/worker/utils/cron-heartbeat'

/**
 * 💓 cron 멈춤 판정 — 순수함수 회귀 고정 (2026-07-28).
 *
 * 이 함수가 틀리면 두 방향 모두 나쁘다:
 *   - 너무 짧게 잡으면 → 정상인데 매시간 경보 → 곧 아무도 안 본다(오늘 고친 무음 정지와 같은 결말)
 *   - 너무 길게 잡으면 → 멈춰도 며칠간 조용
 * 그래서 실제 등록된 cron 식(scheduled.ts 의 10종)을 기준값으로 못박는다.
 */
describe('expectedMaxAgeMinutes — cron 식별 기대주기(분)', () => {
  it('N분마다: 기대주기 = N (×2 + 30분 여유)', () => {
    expect(expectedMaxAgeMinutes('*/2 * * * *')).toBe(2 * 2 + 30)
    expect(expectedMaxAgeMinutes('*/5 * * * *')).toBe(5 * 2 + 30)
    expect(expectedMaxAgeMinutes('*/10 * * * *')).toBe(10 * 2 + 30)
  })

  it('매시(분 고정): 60분 기준', () => {
    expect(expectedMaxAgeMinutes('0 * * * *')).toBe(60 * 2 + 30)
    expect(expectedMaxAgeMinutes('30 * * * *')).toBe(60 * 2 + 30)
  })

  // 🩸 2026-08-25: 하루 이상 주기는 `× 2` 를 쓰지 않는다. ×2 는 **한 회차를 통째로 건너뛰어도
  //   조용하다**는 뜻이고, 실제로 그날 `0 18` 블록 17개(정산 cron 포함)가 08-24 회차를 빠뜨렸는데
  //   37시간은 허용 48.5시간 안이라 경보가 0이었다. 규칙은 `주기 + min(주기/4, 6시간)`.
  it('매일: 한 회차를 건너뛰면 반드시 보인다 (24h + 6h)', () => {
    expect(expectedMaxAgeMinutes('0 18 * * *')).toBe(60 * 24 + 6 * 60)
    expect(expectedMaxAgeMinutes('0 3 * * *')).toBe(60 * 24 + 6 * 60)
    expect(expectedMaxAgeMinutes('0 0 * * *')).toBe(60 * 24 + 6 * 60)
  })

  it('주간(요일 지정): 일 단위보다 길게 (7일 + 6h)', () => {
    expect(expectedMaxAgeMinutes('0 0 * * 1')).toBe(60 * 24 * 7 + 6 * 60)
    expect(expectedMaxAgeMinutes('0 20 * * 0')).toBe(60 * 24 * 7 + 6 * 60)
  })

  it('월간(일자 지정)', () => {
    expect(expectedMaxAgeMinutes('0 21 1 * *')).toBe(60 * 24 * 31 + 6 * 60)
  })

  /**
   * 🔴 **이 describe 가 이 파일의 존재 이유다** — 위 숫자들은 이 불변식의 결과일 뿐이다.
   *   숫자를 바꾸고 싶어지면 먼저 여기를 보라: 회차를 건너뛴 게 보이는가?
   */
  describe('🔴 회차 누락이 보여야 한다 (2026-08-24 실사고)', () => {
    it('일간 작업이 한 회차를 건너뛰면(37h) stale 로 판정된다', () => {
      // 08-23 18:00 에 돌고 08-24 18:00 회차가 없는 채 08-25 07:20 이 된 실제 상황.
      const limit = expectedMaxAgeMinutes('0 18 * * *')!
      expect(37 * 60, `허용 ${limit}분 — 하루를 건너뛰었는데 조용하다`).toBeGreaterThan(limit)
    })

    it('늦게라도 그 회차가 돌면 조용하다 — 오탐을 늘리지 않는다', () => {
      const limit = expectedMaxAgeMinutes('0 18 * * *')!
      expect(25 * 60, '한 시간 늦게 돈 것까지 울리면 아무도 안 본다').toBeLessThan(limit)
    })

    it('주간도 같다 — 한 주를 건너뛰면 보인다', () => {
      const limit = expectedMaxAgeMinutes('45 0 * * 1')!
      expect(13 * 24 * 60).toBeGreaterThan(limit)   // 한 주 누락
      expect(7 * 24 * 60 + 60).toBeLessThan(limit)  // 한 시간 지연
    })

    it('잦은 작업은 종전대로 넉넉하다 — 한두 틱 밀린다고 울리지 않는다', () => {
      expect(expectedMaxAgeMinutes('*/5 * * * *')).toBe(40)
      expect(expectedMaxAgeMinutes('0 * * * *')).toBe(150)
    })
  })

  it('⚠️ 해석 불가하면 null — 경보하지 않는다(모르면 조용한 편이 오탐보다 낫다)', () => {
    expect(expectedMaxAgeMinutes('bad')).toBeNull()
    expect(expectedMaxAgeMinutes('')).toBeNull()
    expect(expectedMaxAgeMinutes(undefined)).toBeNull()
    expect(expectedMaxAgeMinutes(null)).toBeNull()
    expect(expectedMaxAgeMinutes('0 0 * *')).toBeNull()      // 4필드
    expect(expectedMaxAgeMinutes('0 0 * * * *')).toBeNull()  // 6필드
  })

  it('여유폭이 항상 기대주기보다 커야 한다(한 번 밀렸다고 울리면 안 된다)', () => {
    for (const [expr, period] of [['*/5 * * * *', 5], ['0 * * * *', 60], ['0 18 * * *', 1440]] as const) {
      const limit = expectedMaxAgeMinutes(expr)!
      expect(limit).toBeGreaterThan(period)
    }
  })
})

/**
 * 🔎 결과 요약 — **알고 싶은 값이 조용히 사라지지 않는가**.
 *
 * 2026-07-29 실측: 보강 라운드 드라이버가 12라운드를 계획하고 1라운드만 돈 채 `ok:true` 로 기록됐다.
 * `runRoundChain` 은 첫 실패의 원문 error 를 들고 돌아오는데 하트비트가 그걸 안 받고 있었고,
 * 받도록 고친 뒤엔 **요약기가 24자 넘는 문자열을 통째로 버려서** 또 사라질 뻔했다 —
 * 길어지는 값은 대개 error 라, 하필 가장 필요한 값만 증발하는 규칙이었다.
 */
describe('summarizeResult — 요약하되 버리지 않는다', () => {
  it('숫자·불리언을 남긴다', () => {
    expect(summarizeResult({ done: 1, planned: 12, partial: true })).toBe('done=1 planned=12 partial=true')
  })
  it('긴 문자열을 버리지 않고 자른다 — 여기가 회귀 지점이다', () => {
    const long = 'round2: Error: Too many subrequests. (subrequest limit exceeded)'
    const out = summarizeResult({ error: long })
    expect(out).toBeTruthy()
    expect(out).toContain('round2')            // 어느 라운드에서 멈췄는지
    expect(out).toContain('Too many')          // 왜 멈췄는지
  })
  it('전체 길이는 한 줄로 묶인다(로그가 아니다)', () => {
    const out = summarizeResult({ a: 'x'.repeat(500), b: 'y'.repeat(500) })
    expect((out || '').length).toBeLessThanOrEqual(160)
  })
  it('비었으면 null — 그러나 "객체가 아니다"는 버릴 이유가 아니다', () => {
    expect(summarizeResult(null)).toBeNull()
    expect(summarizeResult(undefined)).toBeNull()
    expect(summarizeResult({})).toBeNull()
    expect(summarizeResult([])).toBeNull()
    expect(summarizeResult('')).toBeNull()
  })

  // 🔁 2026-08-01 계약 변경(이 파일의 제목이 원래 요구하던 방향으로).
  //   이 케이스는 원래 `summarizeResult('문자열') === null` 을 고정하고 있었다. 그런데 그건
  //   안전장치가 아니라 **24자 드롭과 같은 클래스의 두 번째 구멍**이었다 — 라이브에서 물렸다:
  //   `cron-env-missing`(없는 키 목록)과 `cron-unmatched`(매칭 안 된 cron 식)이 문자열을 반환했는데
  //   여기서 null 이 되어 **하트비트에 이름만 남고 내용이 사라졌다.** "무엇이 없는지"가 그 관측의
  //   존재 이유였는데 정확히 그것만 증발했다(2026-08-01 13:10:59Z 실측, result: null).
  //   ⇒ 비었으면 버리고, 값이 있으면 자를지언정 남긴다.
  it('원시값·배열도 남긴다 — 객체가 아니라는 이유로 사라지지 않는다', () => {
    expect(summarizeResult('TOSS_SECRET_KEY(scheduled-cleanup)')).toContain('TOSS_SECRET_KEY')
    expect(summarizeResult([1, 2])).toContain('[2]')
    expect(summarizeResult(0)).toBe('0')       // 0건도 사실이다 — falsy 라고 버리면 안 된다
    expect(summarizeResult(false)).toBe('false')
    expect((summarizeResult('x'.repeat(500)) || '').length).toBeLessThanOrEqual(160)
  })
})
