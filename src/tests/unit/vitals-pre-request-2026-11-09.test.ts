/**
 * 🕳️ 첫 응답 전 구간을 쪼갠다 (2026-11-09 대표 검은 화면 — 실사용 9.3초 중 8초가 요청 전).
 *   PRE(이동→가져오기 시작) · DNS · TCP(연결+암호화)를 보내고, 서버가 받아 요약에 싣는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('요청 전 구간 계측', () => {
  it('클라가 셋을 보낸다', () => {
    const s = readFileSync('src/lib/web-vitals-report.ts', 'utf8')
    for (const n of ["send('PRE', Math.max(0, nav.fetchStart)", "send('DNS',", "send('TCP',"]) expect(s).toContain(n)
  })
  it('서버가 받고 요약에 싣는다(두 목록이 같다)', () => {
    const s = readFileSync('src/worker/routes/analytics.routes.ts', 'utf8')
    const lists = s.match(/\['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'CONN', 'D1', 'SRV', 'PRE', 'DNS', 'TCP'\]/g)
    expect(lists?.length).toBe(2)
  })
})
