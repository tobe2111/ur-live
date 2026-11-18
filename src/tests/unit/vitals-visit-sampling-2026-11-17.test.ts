/**
 * 📉 2026-11-17 속도 측정 표본 — 브라우저가 방문 단위로 고르고, 서버는 가득 찬 칸을 매번 덮어쓰지 않는다
 * (결재 2026-11-17-traffic-surge-readiness 4번).
 *
 * 지키는 것:
 *  1. 방문 하나의 결정은 한 번이다 — 안 고른 방문은 신호를 **하나도** 안 보낸다(요청 75% 감소의 근거).
 *  2. 고른 방문은 `s:1` 로 표시하고, 서버는 그것을 다시 25% 로 버리지 않는다(이중 표본 = 표본 1/16 로 굶주림).
 *  3. 칸(100)이 찬 표본 키는 20번에 1번만 다시 쓴다 · 개수 세기는 20번에 1번 +20(기댓값 같음).
 *
 * 못 막는 것: 표본 비율 자체가 판정에 충분한지(실사용 SLO 가 본다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const CLIENT = fs.readFileSync('src/lib/web-vitals-report.ts', 'utf8')
const SERVER = fs.readFileSync('src/worker/routes/analytics.routes.ts', 'utf8')

describe('속도 측정 — 방문 단위 표본', () => {
  it('보내기 전에 방문 표본을 본다 · 표시 s:1 을 싣는다', () => {
    const send = CLIENT.slice(CLIENT.indexOf('function send('), CLIENT.indexOf('function send(') + 300)
    expect(send).toMatch(/if \(!isSampledVisit\(\)\) return/)
    expect(send).toMatch(/s: 1/)
  })

  it('방문 결정은 한 번만 — 같은 방문 안에서 바뀌지 않는다', async () => {
    const m = await import('@/lib/web-vitals-report')
    const first = m.isSampledVisit(() => 0.99)
    expect(m.isSampledVisit(() => 0)).toBe(first)
  })

  it('서버는 s:1 을 다시 버리지 않고, 표시 없는 옛 클라이언트만 25% 고른다', () => {
    expect(SERVER).toMatch(/\.s !== 1 && Math\.random\(\) > VITALS_SAMPLE_RATE/)
  })

  it('가득 찬 표본 키는 드물게만 쓰고, 개수는 20배 보정으로 센다', () => {
    expect(SERVER).toMatch(/>= maxSamples && Math\.random\(\) >= FULL_RESERVOIR_WRITE_RATE\) return/)
    expect(SERVER).toMatch(/if \(Math\.random\(\) < 0\.05\) await incrementCounter\(kv, `vitals_count:\$\{day\}:\$\{body\.name\}`, 20\)/)
  })
})
