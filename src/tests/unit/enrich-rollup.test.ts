/**
 * 🧮 보강 레인 누적 집계(`foldRound`) — 2026-07-29.
 *
 *   왜 이 테스트가 필요한가: 스냅샷(`ads_enrich_last`)은 **라운드마다 덮인다**. 그래서 라이브에서
 *   `partial:true` 를 봐도 ⓐ 모든 라운드가 초반에 죽는 건지 ⓑ 마지막 라운드만 부모 크론 종료에 잘린 건지
 *   **구분할 수 없었다**(처방이 정반대다: 코드 수리 vs 스케줄 수리). 누적이 그 판정을 대신하는데,
 *   누적의 정확성은 전적으로 **멱등성**에 달려 있다 — 같은 스냅샷을 두 번 접으면 숫자가 곧 거짓말이 된다.
 */
import { describe, it, expect } from 'vitest'
import { foldRound, kstDay, type EnrichRollup } from '@/features/marketing/api/enrich-telemetry'

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
