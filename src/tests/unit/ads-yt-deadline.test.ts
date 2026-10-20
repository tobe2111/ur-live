/**
 * ⏱️ 유튜브 보강이 **마감을 읽는가** — 블로거 시간 바닥(#880)이 실제로 듣게 하는 조건.
 *
 * ## 왜 이 테스트가 있나 (2026-07-29, 배포와 안 겹친 첫 클린 틱)
 * 보강 레인은 앞 단계에 사전 마감을 씌워 뒤에 선 블로거 레인의 시간 바닥을 보장한다
 * (`frontStageDeadline`, 기본 40%). 그런데 라이브에서 그 바닥이 **전혀 듣지 않았다**:
 * ```
 *   창 20,000ms · 앞 단계 사전 마감 12,000ms
 *   → elapsed 28,095ms · naver { selected: 12, tried: 0 } · spent 19/45
 * ```
 * 원인: **바닥은 '마감'인데 앞 단계가 그 마감을 한 번도 읽지 않았다.** 이 함수의 루프들은
 * `budget.left` 만 봤고, 건당 fetch 타임아웃이 10s 라 채널 몇 개면 창을 통째로 넘겼다.
 * 예산은 26 이나 남은 채 블로거가 **선택만 하고 0명**으로 끝났다.
 *
 * ## 왜 소스 검사가 아니라 행동 검사인가
 * "루프에 조건이 있다"는 통과해도 실제로 안 멈출 수 있다(조건이 항상 거짓인 경우 — 이 레포가
 * gzip 예산 0 사건에서 실제로 겪은 형태). 그래서 **가짜 시계로 마감을 지나게 하고 fetch 수를 센다.**
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 마감 *값*이 옳은지(40% 바닥이 적정한지)는 여기서 안 본다 —
 *    그건 `frontStageDeadline` 유닛과 라이브 실측의 몫이다. 여기서 고정하는 건 "읽기는 하는가" 뿐이다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { enrichYouTubePerformance } from '@/features/marketing/api/influencer-performance'
import type { FetchBudget } from '@/features/marketing/api/influencer-discovery'

const T0 = Date.parse('2026-07-29T14:00:00Z')

/** 최소 D1 스텁 — 이 함수가 쓰는 것만(prepare→bind→all/run/first). */
function fakeDB(rows: unknown[]) {
  const stmt = {
    bind: () => stmt,
    all: async () => ({ results: rows }),
    run: async () => ({}),
    first: async () => null,
  }
  return { prepare: () => stmt, batch: async () => [] } as never
}

const leadRows = [1, 2, 3].map(i => ({ id: i, channel_id: `ch${i}`, name: `n${i}`, email: null, category: null }))

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('enrichYouTubePerformance — 마감 준수', () => {
  it('마감이 이미 지났으면 fetch 도 D1 도 건드리지 않는다', async () => {
    vi.useFakeTimers(); vi.setSystemTime(T0)
    const calls: string[] = []
    vi.stubGlobal('fetch', async (u: string) => { calls.push(String(u)); return { ok: false } })
    const prepared: number[] = []
    const db = { prepare: () => { prepared.push(1); return { bind: () => ({ all: async () => ({ results: leadRows }) }) } } } as never
    const budget: FetchBudget = { left: 45, deadline: T0 - 1 }   // 이미 지남
    expect(await enrichYouTubePerformance('key', db, budget, 20)).toBe(0)
    expect(calls).toEqual([])
    // D1 도 같은 지갑에서 지불한다 — 시간이 끝났으면 조회조차 하지 않아야 한다.
    expect(prepared).toEqual([])
    expect(budget.left).toBe(45)                                  // 예산 무소비
  })

  it('🔒 실측 재현: 첫 배치 뒤 마감이 지나면 채널별 루프를 더 돌지 않는다', async () => {
    vi.useFakeTimers(); vi.setSystemTime(T0)
    const calls: string[] = []
    vi.stubGlobal('fetch', async (u: string) => {
      calls.push(String(u))
      // 실제 상황 재현 — 첫 호출(channels)이 타임아웃 근처까지 시간을 먹는다(건당 10s 상한).
      vi.setSystemTime(Date.now() + 13_000)
      return {
        ok: true,
        json: async () => ({
          items: leadRows.map(r => ({
            id: r.channel_id,
            snippet: { publishedAt: '2020-01-01T00:00:00Z', description: '' },
            contentDetails: { relatedPlaylists: { uploads: `UU${r.channel_id}` } },
          })),
        }),
      }
    })
    const budget: FetchBudget = { left: 45, deadline: T0 + 12_000 }  // 앞 단계 사전 마감 12s
    await enrichYouTubePerformance('key', fakeDB(leadRows), budget, 20)
    // channels 1콜만. 마감을 안 보면 여기서 playlistItems 3콜이 더 나가 창을 넘긴다(그게 라이브에서 일어난 일).
    expect(calls.length).toBe(1)
    expect(calls[0]).toContain('/channels')
    expect(calls.some(u => u.includes('/playlistItems'))).toBe(false)
    // 남긴 예산은 블로거 레인이 쓴다 — 이 수가 0 에 가까우면 이 수리는 의미가 없다.
    expect(budget.left).toBeGreaterThan(40)
  })

  it('마감 안이면 정상 진행한다 — 가드가 레인을 통째로 죽이지 않는다', async () => {
    vi.useFakeTimers(); vi.setSystemTime(T0)
    const calls: string[] = []
    vi.stubGlobal('fetch', async (u: string) => {
      calls.push(String(u))
      vi.setSystemTime(Date.now() + 100)     // 빠른 응답
      if (String(u).includes('/channels')) {
        return { ok: true, json: async () => ({ items: leadRows.map(r => ({
          id: r.channel_id, snippet: { publishedAt: '2020-01-01T00:00:00Z', description: '' },
          contentDetails: { relatedPlaylists: { uploads: `UU${r.channel_id}` } },
        })) }) }
      }
      return { ok: true, json: async () => ({ items: [] }) }
    })
    const budget: FetchBudget = { left: 45, deadline: T0 + 12_000 }
    await enrichYouTubePerformance('key', fakeDB(leadRows), budget, 20)
    expect(calls.some(u => u.includes('/playlistItems'))).toBe(true)
  })

  it('마감이 없으면(단독 호출) 종전대로 — deadline 미설정 경로를 막지 않는다', async () => {
    vi.useFakeTimers(); vi.setSystemTime(T0)
    const calls: string[] = []
    vi.stubGlobal('fetch', async (u: string) => {
      calls.push(String(u))
      vi.setSystemTime(Date.now() + 9_000)   // 느려도 마감이 없으면 계속 간다
      if (String(u).includes('/channels')) {
        return { ok: true, json: async () => ({ items: leadRows.map(r => ({
          id: r.channel_id, snippet: {}, contentDetails: { relatedPlaylists: { uploads: `UU${r.channel_id}` } },
        })) }) }
      }
      return { ok: true, json: async () => ({ items: [] }) }
    })
    const budget: FetchBudget = { left: 45 }   // deadline 없음(어드민 수동 refresh 등)
    await enrichYouTubePerformance('key', fakeDB(leadRows), budget, 20)
    expect(calls.some(u => u.includes('/playlistItems'))).toBe(true)
  })
})
