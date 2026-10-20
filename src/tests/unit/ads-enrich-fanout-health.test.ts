/**
 * 🪂 **"띄웠다"를 "성공"으로 보고하지 않는다.**
 *
 * ## 실측 (2026-08-02 09:00 KST)
 * ```
 *   ads:enrich-influencer-driver   ok=true  0ms      ← 하트비트는 초록
 *   enrich_lane.last_run           18:10 UTC (6시간 정지)
 *   total_measured                 10,498 → 10,630  (6시간에 +132)
 * ```
 * 팬아웃 진입점이 자식 K개를 띄우고 **즉시** 반환하는데, 그 응답으로 부모가 성공 하트비트를 찍는다.
 * 자식이 CPU 한도로 전멸해도 화면은 초록 — 어제 하루 종일 싸운 *"침묵이 성공처럼 보인다"* 가
 * **관측 계층 한 겹 위에서 재발**한 것이다.
 *
 * ⚠️ 이 가드가 **못 보는 것**: 자식 일부만 죽는 경우(하나라도 착지하면 landed=true).
 *    전멸만 잡는다. 부분 실패는 `total_measured` 증가폭으로 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { judgeFanout, fanoutBeatResult, type FanoutStamp } from '@/features/marketing/api/enrich-fanout-health'

const stamp = (over: Partial<FanoutStamp> = {}): FanoutStamp =>
  ({ at: '2026-08-02T00:01:00.000Z', k: 6, planned: 20, lane_before: '2026-08-01 18:10:02', ...over })

describe('🔴 직전 팬아웃이 전멸했으면 빨강이다', () => {
  it('스냅샷이 그대로면 landed=false', () => {
    const v = judgeFanout(stamp(), '2026-08-01 18:10:02')   // 6시간째 그대로 — 라이브 실측 그 상황
    expect(v.landed).toBe(false)
    expect(v.reason).toContain('아무것도 못 했다')
  })

  it('🔒 그리고 하트비트가 **실제로 빨강**이 된다 — 필드만 추가하면 화면은 여전히 초록이다', () => {
    const { ok, result } = fanoutBeatResult(6, 20, judgeFanout(stamp(), '2026-08-01 18:10:02'))
    expect(ok).toBe(false)
    expect(result.prev_landed).toBe(false)
    expect(result.fanout).toBe(6)
  })

  it('레인 스냅샷이 아예 없으면 착지한 적 없음', () => {
    expect(judgeFanout(stamp(), null).landed).toBe(false)
  })
})

describe('✅ 착지했으면 초록', () => {
  it('스냅샷이 전진했으면 landed=true', () => {
    const v = judgeFanout(stamp(), '2026-08-02 00:06:31')
    expect(v.landed).toBe(true)
    expect(fanoutBeatResult(6, 20, v).ok).toBe(true)
  })
})

describe('⚠️ 판정 불가는 빨강으로 만들지 않는다 — 첫 실행마다 우는 경보는 곧 무시된다', () => {
  it('직전 기록이 없으면 landed=null · ok 유지', () => {
    for (const prev of [null, undefined]) {
      const v = judgeFanout(prev, '2026-08-02 00:06:31')
      expect(v.landed).toBeNull()
      expect(fanoutBeatResult(6, 20, v).ok).toBe(true)
    }
  })

  it('기록이 손상됐어도 터지지 않는다', () => {
    expect(judgeFanout({} as FanoutStamp, '2026-08-02 00:06:31').landed).toBeNull()
    expect(judgeFanout({ at: 'x' } as FanoutStamp, null).landed).toBe(false)
  })
})

describe('🚧 배선 — 팬아웃이 실제로 자기신고를 하는가', () => {
  it('진입점이 reportFanout 을 부르고, 그게 하트비트+기준값을 남긴다', async () => {
    const src = (await import('node:fs')).readFileSync('src/worker-ads/enrich.routes.ts', 'utf8')
    // 순수 판정만 만들고 호출을 안 하면 **아무 일도 안 일어난다** — 조용해서 더 위험하다.
    expect(src).toMatch(/await reportFanout\(c\.env as never, K, rounds\)/)
    expect(src).toContain('fanoutBeatResult')
    expect(src).toMatch(/bind\(FANOUT_KEY, JSON\.stringify\(/)
    // 부모(kick)가 덮어쓰지 않도록 **다른 이름**으로 쓴다 — 같은 이름이면 초록이 다시 덮는다.
    expect(src).toContain("'ads:enrich-influencer-fanout'")
  })

  it('🚧 진단 API 가 그 기록을 내보낸다 — 안 보이면 판정 자체가 불가', async () => {
    const src = (await import('node:fs')).readFileSync('src/features/marketing/api/ads-pool-diag.ts', 'utf8')
    expect(src).toContain("'ads_enrich_fanout_last'")
    expect(src).toMatch(/enrich_fanout: parseJson\(find\('ads_enrich_fanout_last'\)\)/)
  })
})
