/**
 * 🩺 2026-11-18 이미지 건강 모니터 — 라이브 한 회 181초 · 결과 없음 · '못 닿음' 을 '깨짐' 으로 셌다.
 * 지키는 것(진짜 함수 · 가짜 fetch/DB):
 *  1. 브라우저 전용 호스트(giftishow)는 표본에서 빠진다(서버는 그 사진을 판정할 수 없다).
 *  2. 응답 없음(시간 초과·연결 실패)은 깨짐이 아니다 → 그것만으로는 알림이 안 나간다.
 *  3. 진짜 깨짐(응답은 왔는데 사진이 아님)은 깨짐으로 센다.
 *  4. 결과가 하트비트 한 줄로 나가고, 그 줄에 `skipped=` 키가 없다(경보 판정기가 '못 했다' 로 읽는다).
 * 못 막는 것: 실제 giftishow 의 차단 여부 — 그건 라이브 하트비트가 알려 준다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import { imageHealthMonitor, imageHealthLine } from '@/worker/cron/image-health-monitor'

const rowsDb = (urls: string[]) => ({
  prepare: () => ({ all: async () => ({ results: urls.map((image_url, id) => ({ id, image_url })) }) }),
}) as unknown as D1Database

afterEach(() => vi.unstubAllGlobals())

describe('이미지 건강 모니터', () => {
  it('브라우저 전용 호스트는 빼고, 못 닿은 것은 깨짐이 아니다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      if (u.includes('timeout')) throw new Error('aborted')
      if (u.includes('broken')) return new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
      return new Response(new Uint8Array(2000), { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '2000' } })
    }))
    const urls = [
      ...Array.from({ length: 40 }, (_, i) => `https://bizimg.giftishow.com/x${i}.jpg`),
      ...Array.from({ length: 15 }, (_, i) => `https://cdn.example.com/timeout${i}.jpg`),
      'https://cdn.example.com/broken.jpg',
      ...Array.from({ length: 5 }, (_, i) => `https://cdn.example.com/ok${i}.jpg`),
    ]
    const sendAlert = vi.fn()
    vi.doMock('@/worker/utils/alerts', () => ({ sendAlert }))
    const r = await imageHealthMonitor({ DB: rowsDb(urls) } as never)
    expect(r.skipped).toBe(40)
    expect(r.unreachable).toBe(15)
    expect(r.broken).toBe(1)
    expect(r.checked).toBe(6)
    const line = imageHealthLine(r)
    expect(line).toMatch(/browser_only=40/)
    expect(line).not.toMatch(/(^|[\s,{])skipped[=:]/)
  })

  it('예약 작업이 결과를 하트비트에 넘긴다', () => {
    expect(fs.readFileSync('src/worker/scheduled.ts', 'utf8')).toMatch(/return imageHealthLine\(await imageHealthMonitor\(env\)\)/)
  })
})
