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
    const write = vi.fn(async () => {})
    const b = createBeatBatch(write, 10)
    for (let i = 0; i < 9; i++) b.add(beat(`a${i}`))
    expect(write).not.toHaveBeenCalled()
    expect(b.size).toBe(9)
  })

  it('임계치에 닿으면 **한 번에** 내보낸다 — N건이 쓰기 1회', async () => {
    const write = vi.fn(async () => {})
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
    const write = vi.fn(async () => {})
    const b = createBeatBatch(write, 10)
    for (let i = 0; i < 20; i++) b.add(beat(`a${i}`))
    await b.flush()
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('빈 상태에서 flush 하면 아무것도 쓰지 않는다(빈 배치로 서브리퀘스트를 낭비하지 않는다)', async () => {
    const write = vi.fn(async () => {})
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
