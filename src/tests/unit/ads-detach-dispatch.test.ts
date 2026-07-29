/**
 * 🚀 즉시 응답 디스패치 — 부모 cron 이 레인을 기다리지 않게 (2026-07-29 신설).
 *
 *   라이브 하트비트가 완벽한 계단을 보여줬다: 11:00 에 돈 레인은 **즉시 응답으로 바뀐 것들**뿐이고,
 *   나머지는 1·2·3·6시간 전이 마지막이었다(`collect-company` 는 6시간째 정지).
 *   원인: 부모의 `kick` 이 `await env.SELF.fetch(...)` 라 레인이 일을 **다 끝내야** 응답한다 →
 *   레인 하나가 20초씩이면 목록 뒷부분은 부모 수명 안에 **디스패치조차 안 된다.**
 *
 *   여기서 고정하는 계약:
 *   ① cron(`?detach=1`)은 즉시 응답하고 작업은 백그라운드로 이어진다
 *   ② **어드민 수동 버튼은 detach 하지 않는다** — 눌렀는데 결과가 안 뜨면 UX 후퇴다
 *   ③ `executionCtx` 가 없으면(로컬/테스트) 동기 실행 — 동작 동일
 */
import { describe, it, expect, vi } from 'vitest'
import { runDetachable, wantsDetach } from '@/worker-ads/detach'

const ctxOf = (query: Record<string, string>, withCtx = true) => {
  const scheduled: Promise<unknown>[] = []
  return {
    scheduled,
    c: {
      env: {},
      req: { query: (k: string) => query[k] },
      ...(withCtx ? { executionCtx: { waitUntil: (p: Promise<unknown>) => { scheduled.push(p) } } } : {}),
    },
  }
}

describe('detach 판정', () => {
  it('cron 만 detach 한다(`?detach=1`)', () => {
    expect(wantsDetach({ req: { query: () => '1' } })).toBe(true)
    expect(wantsDetach({ req: { query: () => undefined } })).toBe(false)
    expect(wantsDetach({ req: { query: () => '0' } })).toBe(false)
  })
})

describe('runDetachable', () => {
  it('cron 이면 **작업을 기다리지 않고** 즉시 돌아온다(부모의 kick 이 곧바로 풀린다)', async () => {
    const { c, scheduled } = ctxOf({ detach: '1' })
    let done = false
    const slow = async () => { await new Promise(r => setTimeout(r, 30)); done = true; return 'v' }

    const r = await runDetachable(c, slow)

    expect(r).toEqual({ detached: true })
    expect(done).toBe(false)        // 아직 안 끝났는데 응답은 나갔다 — 이게 이 수정의 전부다
    expect(scheduled).toHaveLength(1)
    await scheduled[0]              // 백그라운드는 계속 돈다
    expect(done).toBe(true)
  })

  it('🖱️ 어드민 수동 호출은 **동기** — 결과를 돌려준다(눌렀는데 아무것도 안 뜨면 후퇴다)', async () => {
    const { c, scheduled } = ctxOf({})
    const r = await runDetachable(c, async () => ({ saved: 3 }))
    expect(r).toEqual({ detached: false, result: { saved: 3 } })
    expect(scheduled).toHaveLength(0)
  })

  it('executionCtx 가 없으면(로컬/테스트) detach 요청이어도 동기 실행 — 조용히 사라지지 않는다', async () => {
    const { c } = ctxOf({ detach: '1' }, false)
    const r = await runDetachable(c, async () => 42)
    expect(r).toEqual({ detached: false, result: 42 })
  })

  it('백그라운드 작업이 던져도 요청은 실패하지 않는다(관측은 각 러너의 stats.diag 가 담당)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { c, scheduled } = ctxOf({ detach: '1' })
    const r = await runDetachable(c, async () => { throw new Error('boom') })
    expect(r).toEqual({ detached: true })
    await expect(scheduled[0]).resolves.toBeUndefined() // 삼키되 — 콘솔로는 흘린다(조용한 소멸 방지)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})

// 🔔 detach 는 관측 사각지대를 새로 만든다 — 부모 하트비트가 '던지기 성공'만 뜻하게 되므로,
//   레인이 조용히 죽어도 ok:true 로 남는다. 그래서 **작업이 끝난 뒤 실제 결과로 다시 기록**한다.
describe('완료 하트비트 (detach 가 만든 사각지대의 처방)', () => {
  it('작업이 끝나면 **실제 결과로** 하트비트를 다시 쓴다 — 부모의 낙관적 기록을 덮는다', async () => {
    const beats: Array<{ name: string; ok: boolean }> = []
    vi.doMock('@/worker/utils/cron-heartbeat', () => ({
      recordCronBeat: async (_e: unknown, name: string, ok: boolean) => { beats.push({ name, ok }) },
    }))
    const { runDetachable } = await import('@/worker-ads/detach')
    const { c, scheduled } = ctxOf({ detach: '1' })

    await runDetachable(c, async () => { throw new Error('lane died') }, 'collect-neis')
    await scheduled[0]

    expect(beats).toEqual([{ name: 'ads:collect-neis', ok: false }]) // 실패가 실패로 남는다
    vi.doUnmock('@/worker/utils/cron-heartbeat')
  })

  it('beat 이름을 안 주면 기록하지 않는다(체인 depth>0 처럼 같은 시간대를 N번 덮지 않게)', async () => {
    const beats: unknown[] = []
    vi.doMock('@/worker/utils/cron-heartbeat', () => ({
      recordCronBeat: async () => { beats.push(1) },
    }))
    const { runDetachable } = await import('@/worker-ads/detach')
    const { c, scheduled } = ctxOf({ detach: '1' })

    await runDetachable(c, async () => 'ok')
    await scheduled[0]

    expect(beats).toHaveLength(0)
    vi.doUnmock('@/worker/utils/cron-heartbeat')
  })
})
