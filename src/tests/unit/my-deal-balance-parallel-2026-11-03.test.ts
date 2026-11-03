/**
 * 🐢 2026-11-03 대표 *"3,4 해결해줘"* — ③ 마이 '내 딜' 칸(`GET /api/points/balance`)의 직렬 2왕복 → 나란히.
 *
 * 처리 중 환급 신청 조회를 잔액 조회와 **같이 출발**시킨다(읽기 전용 · 판정은 종전과 같다).
 * 지키는 것: ① 그 조회가 잔액 await **앞**에서 출발 ② 무상만 있는 쪽은 그 약속을 쓴다 ③ 유상 잔액 쪽은 여전히 한도 SSOT
 *   (`getDealRefundState`)가 판정한다 ④ 실패는 조용히 null(표가 없을 때) — 종전과 같다.
 * ⚠️ 못 보는 것: 실제 왕복 시간(로그인 필요 — 라이브 체감).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/features/points/api/points.routes.ts', 'utf8')
const start = src.indexOf("pointsRoutes.get('/balance'")
const fn = src.slice(start, src.indexOf('\npointsRoutes.', start + 10)) // 다음 라우트 정의 직전까지

describe("마이 '내 딜' — 처리 중 환급 조회를 잔액 조회와 나란히", () => {
  it('① 잔액 await 보다 먼저 출발한다', () => {
    const p = fn.indexOf('const pendingP = DB.prepare(')
    const row = fn.indexOf('const row = await DB.prepare(')
    expect(p).toBeGreaterThan(0)
    expect(row).toBeGreaterThan(p)
  })
  it('② 무상만 있는 쪽은 그 약속을 쓰고, 같은 질의를 다시 보내지 않는다', () => {
    expect(fn).toMatch(/\} else \{\s*const p = await pendingP;/)
    expect(fn.match(/FROM deal_refund_requests/g)?.length).toBe(1)
  })
  it('③ 유상 잔액 쪽은 여전히 한도 SSOT 가 판정 · ④ 실패는 조용히 null', () => {
    expect(fn).toMatch(/if \(balance - freeBalance > 0\) \{[\s\S]*getDealRefundState\(DB, userId\)/)
    expect(fn).toMatch(/const pendingP = DB\.prepare\([^)]*\)\s*\.bind\(userId\)\.first<\{ amount: number \}>\(\)\.catch\(\(\) => null\)/)
  })
})
