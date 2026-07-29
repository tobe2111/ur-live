/**
 * 🧾 디스패치 하트비트 일괄 쓰기 — 계약 (2026-07-29 신설).
 *
 *   왜: `kick` 한 번이 [SELF.fetch 1 + D1 쓰기 1] = **2 서브리퀘스트**라, 매시간 15~20개 레인이면
 *   30~40 으로 천장(~50)에 닿는다. 넘으면 뒤쪽 레인은 **디스패치도 실패 기록도 못 한다** —
 *   `ok:false` 행이 아니라 **행 자체가 없다**(라이브: 통신판매가 02:00 이후 5회 결번, 기록 0).
 *   `DB.batch` 는 문장이 몇 개든 서브리퀘스트 1개 → 부모 비용 `2N` → `N+1`.
 *
 *   여기서 고정하는 것: ① 모아서 한 번에 쓴다 ② 임계치에서 중간 flush(손실을 유계로)
 *   ③ **flush 하면 반드시 나간다**(누적기가 기록을 삼키는 장치가 되지 않게) ④ 쓰기 실패가 전파되지 않는다.
 */
import { describe, it, expect, vi } from 'vitest'
import { createBeatBatch, FLUSH_AT, type PendingBeat } from '@/worker-ads/beat-batch'

const beat = (name: string): PendingBeat => ({ name, ok: true, ms: 1 })

describe('하트비트 일괄 쓰기', () => {
  it('임계치 전에는 **쓰지 않는다**(그게 절약의 전부다)', async () => {
    const write = vi.fn(async (_list: PendingBeat[]) => {})
    const b = createBeatBatch(write, 10)
    for (let i = 0; i < 9; i++) b.add(beat(`a${i}`))
    expect(write).not.toHaveBeenCalled()
    expect(b.size).toBe(9)
  })

  it('임계치에 닿으면 **한 번에** 내보낸다 — N건이 쓰기 1회', async () => {
    const write = vi.fn(async (_list: PendingBeat[]) => {})
    const b = createBeatBatch(write, 10)
    for (let i = 0; i < 10; i++) b.add(beat(`a${i}`))
    await b.flush()
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0][0]).toHaveLength(10)
  })

  it('flush 는 남은 것을 반드시 내보낸다 — 안 그러면 누적기가 기록을 삼키는 장치가 된다', async () => {
    const seen: string[] = []
    const b = createBeatBatch(async (list) => { seen.push(...list.map(x => x.name)) }, 10)
    b.add(beat('x')); b.add(beat('y'))
    await b.flush()
    expect(seen).toEqual(['x', 'y'])
  })

  it('20건 + flush = 쓰기 2회(중간 1 + 마지막 1) — 손실이 임계치 단위로 묶인다', async () => {
    const write = vi.fn(async (_list: PendingBeat[]) => {})
    const b = createBeatBatch(write, 10)
    for (let i = 0; i < 20; i++) b.add(beat(`a${i}`))
    await b.flush()
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('빈 상태에서 flush 하면 아무것도 쓰지 않는다(빈 배치로 서브리퀘스트를 낭비하지 않는다)', async () => {
    const write = vi.fn(async (_list: PendingBeat[]) => {})
    await createBeatBatch(write).flush()
    expect(write).not.toHaveBeenCalled()
  })

  it('쓰기가 실패해도 전파되지 않는다 — 관측 실패가 cron 을 망가뜨리면 안 된다', async () => {
    const b = createBeatBatch(async () => { throw new Error('D1 down') }, 2)
    b.add(beat('a')); b.add(beat('b'))
    await expect(b.flush()).resolves.toBeUndefined()
  })

  it('기본 임계치는 10 — 손실 한도이자 절약 단위', () => {
    expect(FLUSH_AT).toBe(10)
  })
})

/**
 * 🔓 **flush 이후 도착분** — 모든 레인이 `kick` 을 거치지는 않는다.
 *
 *   생 `ctx.waitUntil` 로 도는 레인(시트 미러 #882 등)은 마지막 flush **뒤에** 하트비트를 남길 수 있다.
 *   그걸 모으기만 하면 영영 안 나가고, 그 레인은 **멈춘 것과 똑같이 생긴다** —
 *   비용을 아끼려다 관측을 지우는 것이고, 이 레포가 반복해 만난 "조용한 부재" 그 자체다.
 */
describe('봉인 뒤에는 즉시 쓴다', () => {
  it('flush 뒤에 add 하면 **또 flush 하지 않아도** 나간다', async () => {
    // ⚠️ 여기서 flush 를 한 번 더 부르면 안 된다 — 그러면 봉인을 지워도 초록이라 **검사가 헛돈다**
    //   (실제로 처음 쓴 이 테스트가 그랬고, 되돌려-검증에서 통과하는 걸 보고서야 알았다).
    const seen: string[] = []
    const b = createBeatBatch(async (list) => { seen.push(...list.map(x => x.name)) }, 10)
    await b.flush()
    b.add(beat('late'))
    await Promise.resolve()
    expect(seen).toEqual(['late'])
    expect(b.size).toBe(0)
  })

  it('봉인 전에는 여전히 모은다 — 절약이 사라지면 이 PR 의 목적이 사라진다', () => {
    const write = vi.fn(async (_list: PendingBeat[]) => {})
    const b = createBeatBatch(write, 10)
    b.add(beat('a')); b.add(beat('b'))
    expect(write).not.toHaveBeenCalled()
    expect(b.size).toBe(2)
  })
})

/**
 * ⏳ **나이 상한** — 2026-07-29 라이브가 가르쳐 준 것.
 *
 *   임계치와 마지막 flush 만 두면, 임계치에 못 닿은 뒷부분은 **모든 디스패치가 끝날 때까지** 대기한다.
 *   부모가 그 전에 회수되면 통째로 사라진다 — 실측: `reclassify` 가 자기 스탬프상 14:01 에 돌았는데
 *   하트비트는 13:01 그대로였다(= 돌았지만 기록이 없다 = 멈춘 것과 똑같이 생겼다).
 *
 *   ⚠️ 타이머로 풀지 않는다 — 타이머는 부모 **수명**을 건드리고, 그건 이 세션이 이미 한 번 데인 선이다.
 *   `add()` 시점 검사라 비용 0이고, 아무 기록도 안 들어오면 여전히 마지막 flush 가 처리한다(그 한계는 남는다).
 */
describe('나이 상한 — 오래 들고 있지 않는다', () => {
  it('임계치에 못 닿아도 상한이 지나면 내보낸다 — 시간을 실제로 흘려 확인', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-07-29T14:00:00Z'))
      const write = vi.fn(async (_l: PendingBeat[]) => {})
      const b = createBeatBatch(write, 100, 3_000)
      b.add(beat('a'))
      vi.advanceTimersByTime(1_000)
      b.add(beat('b'))
      expect(write, '상한 안에서는 계속 모은다').not.toHaveBeenCalled()
      vi.advanceTimersByTime(2_500)   // 첫 기록이 3.5초째 — 상한 초과
      b.add(beat('c'))
      expect(write).toHaveBeenCalledTimes(1)
      expect(write.mock.calls[0][0]).toHaveLength(3) // 모인 것을 한 번에
    } finally { vi.useRealTimers() }
  })

  it('상한 0 은 "들고 있지 않는다" — 매 건 즉시(배칭 이전과 동일한 안전 동작)', () => {
    const write = vi.fn(async (_l: PendingBeat[]) => {})
    const b = createBeatBatch(write, 100, 0)
    b.add(beat('a'))
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('상한 안이면 계속 모은다 — 절약이 사라지면 안 된다', () => {
    const write = vi.fn(async (_l: PendingBeat[]) => {})
    const b = createBeatBatch(write, 100, 60_000)
    for (let i = 0; i < 5; i++) b.add(beat(`a${i}`))
    expect(write).not.toHaveBeenCalled()
    expect(b.size).toBe(5)
  })

  it('flush 후 다시 모으면 나이는 새 묶음 기준으로 다시 센다', async () => {
    const write = vi.fn(async (_l: PendingBeat[]) => {})
    const b = createBeatBatch(write, 100, 60_000)
    b.add(beat('a'))
    await b.flush()
    expect(write).toHaveBeenCalledTimes(1)
    b.add(beat('b')) // 봉인 뒤라 즉시 나간다
    expect(write).toHaveBeenCalledTimes(2)
  })
})
