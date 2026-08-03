/**
 * 🧮 보강 레인 누적 집계(`foldRound`) — 2026-07-29.
 *
 *   왜 이 테스트가 필요한가: 스냅샷(`ads_enrich_last`)은 **라운드마다 덮인다**. 그래서 라이브에서
 *   `partial:true` 를 봐도 ⓐ 모든 라운드가 초반에 죽는 건지 ⓑ 마지막 라운드만 부모 크론 종료에 잘린 건지
 *   **구분할 수 없었다**(처방이 정반대다: 코드 수리 vs 스케줄 수리). 누적이 그 판정을 대신하는데,
 *   누적의 정확성은 전적으로 **멱등성**에 달려 있다 — 같은 스냅샷을 두 번 접으면 숫자가 곧 거짓말이 된다.
 */
import { describe, it, expect } from 'vitest'
import { foldRound, kstDay, DEATH_TRAIL_MAX, type EnrichRollup } from '@/features/marketing/api/enrich-telemetry'

const snap = (over: Record<string, unknown> = {}) => ({
  run_id: 'aaaa1111', processed: 3, enriched: 1, crawls: 2, fetches: 5, d1: 4, spent: 9,
  partial: true, phase: 'p2', ...over,
})

describe('foldRound — 보강 라운드 누적', () => {
  it('접을 스냅샷이 없으면 쓰지 않는다(null)', () => {
    expect(foldRound(null, null)).toBeNull()
  })

  it('run_id 없는 구형 스냅샷은 접지 않는다 — 중복을 막을 수단이 없기 때문', () => {
    expect(foldRound(null, { processed: 10, partial: true })).toBeNull()
  })

  it('첫 라운드를 접으면 카운터와 종료단계 분포가 생긴다', () => {
    const r = foldRound(null, snap(), '2026-07-29')!
    expect(r.day).toBe('2026-07-29')
    expect(r.rounds).toBe(1)
    expect(r.partial).toBe(1)
    expect(r.processed).toBe(3)
    expect(r.enriched).toBe(1)
    expect(r.phase).toEqual({ p2: 1 })
    expect(r.last_run_id).toBe('aaaa1111')
  })

  it('다른 라운드는 누적된다 — 종료단계가 어디에 몰리는지가 드러난다', () => {
    const a = foldRound(null, snap(), '2026-07-29')!
    const b = foldRound(a, snap({ run_id: 'bbbb2222', phase: 'p3_done', partial: false, processed: 7, enriched: 2 }), '2026-07-29')!
    expect(b.rounds).toBe(2)
    expect(b.partial).toBe(1)      // 두 번째는 정상 종료
    expect(b.processed).toBe(10)
    expect(b.enriched).toBe(3)
    expect(b.phase).toEqual({ p2: 1, p3_done: 1 })
  })

  it('🔁 같은 라운드를 두 번 접지 않는다(멱등) — 이게 깨지면 누적이 곧 거짓말이 된다', () => {
    const a = foldRound(null, snap(), '2026-07-29')!
    expect(foldRound(a, snap(), '2026-07-29')).toBeNull()
  })

  it('🌙 자정 경계에서도 같은 라운드는 재계상되지 않는다(버킷은 새로, 멱등키는 유지)', () => {
    const a = foldRound(null, snap(), '2026-07-29')!
    // 날짜만 바뀌고 스냅샷은 그대로 → 접을 것 없음
    expect(foldRound(a, snap(), '2026-07-30')).toBeNull()
    // 새 라운드가 오면 새 날짜 버킷에서 1부터
    const b = foldRound(a, snap({ run_id: 'cccc3333' }), '2026-07-30')!
    expect(b.day).toBe('2026-07-30')
    expect(b.rounds).toBe(1)
    expect(b.processed).toBe(3)
  })

  it('중단 사유(시간상한·요청한도·예외)를 각각 센다 — 처방이 서로 다르므로 합치면 안 된다', () => {
    let r: EnrichRollup | null = foldRound(null, snap({ run_id: 'd1', deadline_hit: true }), '2026-07-29')
    r = foldRound(r, snap({ run_id: 'd2', limit_hit: true }), '2026-07-29')
    r = foldRound(r, snap({ run_id: 'd3', crash: 'Error: boom' }), '2026-07-29')!
    expect(r!.deadline).toBe(1)
    expect(r!.limit).toBe(1)
    expect(r!.crash).toBe(1)
    expect(r!.rounds).toBe(3)
  })

  it('숫자가 아닌 필드는 0 으로 — 계측이 NaN 을 저장해 상태줄을 망가뜨리지 않게', () => {
    const r = foldRound(null, snap({ processed: 'x', enriched: null, crawls: undefined }), '2026-07-29')!
    expect(r.processed).toBe(0)
    expect(r.enriched).toBe(0)
    expect(r.crawls).toBe(0)
  })

  it('phase 가 없으면 unknown 버킷 — 분포에서 조용히 사라지지 않게', () => {
    const r = foldRound(null, snap({ phase: undefined }), '2026-07-29')!
    expect(r.phase).toEqual({ unknown: 1 })
  })

  it('kstDay 는 UTC 워커에서 한국 날짜를 준다(자정 직전 UTC = 다음날 KST)', () => {
    expect(kstDay(Date.parse('2026-07-29T15:30:00Z'))).toBe('2026-07-30')
    expect(kstDay(Date.parse('2026-07-29T14:30:00Z'))).toBe('2026-07-29')
  })
})

/**
 * 💀 **사망 지점 흔적(`deaths`)** — 2026-08-03 실측에서 생긴 요구.
 *
 * 라이브 스냅샷이 이랬다: `processed 3 · spent 15/60 · limit_hit false · deadline_hit false · crash 0 · partial true`.
 * 한도도·시간제한도·예외도 아닌 **예외 없이 사라지는 죽음**인데, 처방이 둘로 갈린다 —
 * 마지막 체크포인트(`at`)가 **한 주소에 몰리면** 그 사이트가 벽시계를 태운 것이고,
 * **흩어지면** 부모 CPU 한도다. 그런데 `at` 은 스냅샷에만 있고 라운드마다 덮여서,
 * 판정하려면 하루 2~4회차씩 며칠을 **기다려야** 했다. 누적에 모으면 조회 한 번으로 갈린다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * `at` 이 실제로 유용한 지점을 가리키는지(그건 레인 쪽 체크포인트 품질). 여기서는 **보존과 격리**만 본다.
 */
describe('foldRound — 사망 지점 흔적(deaths)', () => {
  it('🔒 중도 사망(partial) 라운드의 `at` 을 남긴다 — 안 남기면 며칠을 기다려야 판정된다', () => {
    const r = foldRound(null, snap({ run_id: 'x1', at: 'cr:https://www.busan.com' }), '2026-08-03')!
    expect(r.deaths).toEqual(['cr:https://www.busan.com'])
  })

  it('🔒 정상 종료 라운드는 남기지 않는다 — 흔적이 죽음만 담아야 몰림이 보인다', () => {
    const r = foldRound(null, snap({ run_id: 'x2', partial: false, at: 'done' }), '2026-08-03')!
    expect(r.deaths).toBeUndefined()
  })

  it('🔒 여러 회차가 순서대로 쌓인다(몰림 vs 흩어짐을 눈으로 가른다)', () => {
    let r = foldRound(null, snap({ run_id: 'a', at: 'cr:https://a.kr' }), '2026-08-03')
    r = foldRound(r, snap({ run_id: 'b', at: 'cr:https://a.kr' }), '2026-08-03')
    r = foldRound(r, snap({ run_id: 'c', at: 'p2:120' }), '2026-08-03')!
    expect(r!.deaths).toEqual(['cr:https://a.kr', 'cr:https://a.kr', 'p2:120'])
  })

  it('🔒 상한을 넘으면 **최근 것**을 남긴다 — 무한히 자라면 누적 레코드가 비대해진다', () => {
    let r: EnrichRollup | null = null
    for (let i = 0; i < DEATH_TRAIL_MAX + 4; i++) r = foldRound(r, snap({ run_id: `r${i}`, at: `cr:${i}` }), '2026-08-03')
    expect(r!.deaths!.length).toBe(DEATH_TRAIL_MAX)
    expect(r!.deaths![DEATH_TRAIL_MAX - 1]).toBe(`cr:${DEATH_TRAIL_MAX + 3}`) // 가장 최근
    expect(r!.deaths![0]).toBe('cr:4')                                        // 오래된 것부터 밀려난다
  })

  it('🔒 이전 누적본을 **오염시키지 않는다** — 얕은 복사가 배열을 참조로 물고 온다', () => {
    const first = foldRound(null, snap({ run_id: 'p', at: 'cr:one' }), '2026-08-03')!
    const before = [...first.deaths!]
    foldRound(first, snap({ run_id: 'q', at: 'cr:two' }), '2026-08-03')
    expect(first.deaths, '원본이 함께 늘어나면 멱등 검사가 거짓말을 하게 된다').toEqual(before)
  })

  it('날짜가 바뀌면 흔적도 리셋된다(하루 단위 추세를 본다는 이 레코드의 규약)', () => {
    const d1 = foldRound(null, snap({ run_id: 'y1', at: 'cr:old' }), '2026-08-02')!
    const d2 = foldRound(d1, snap({ run_id: 'y2', at: 'cr:new' }), '2026-08-03')!
    expect(d2.deaths).toEqual(['cr:new'])
  })

  it('`at` 이 없거나 문자열이 아니면 조용히 건너뛴다(빈 항목으로 흔적을 흐리지 않는다)', () => {
    expect(foldRound(null, snap({ run_id: 'z1' }), '2026-08-03')!.deaths).toBeUndefined()
    expect(foldRound(null, snap({ run_id: 'z2', at: 42 }), '2026-08-03')!.deaths).toBeUndefined()
  })

  it('과도하게 긴 `at` 은 잘라서 담는다(누적 레코드 크기 방어)', () => {
    const r = foldRound(null, snap({ run_id: 'z3', at: 'cr:' + 'x'.repeat(200) }), '2026-08-03')!
    expect(r.deaths![0].length).toBe(60)
  })
})
