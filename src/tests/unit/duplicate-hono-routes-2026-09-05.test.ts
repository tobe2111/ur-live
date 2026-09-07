/**
 * 같은 경로를 두 번 등록하면 뒤엣것은 **한 번도 안 돈다** (2026-09-05)
 *
 * 배경: `sellerOrdersRoutes.get('/products/:id')` 가 두 번 정의돼 있었다. Hono 는 먼저 등록된
 * 쪽이 이기므로 뒤엣것은 죽은 코드였고, 하필 그쪽이 전 컬럼을 주는 '좋은' 구현이라 다음 사람이
 * 거기를 고치면 아무 일도 안 일어나는 상태였다. 에러도 경고도 빌드 실패도 없다.
 *
 * 화면 쪽(App.tsx)은 `check-duplicate-routes` 가, 순서 그림자(`/:id` 가 `/new` 를 선점)는
 * `check-route-shadowing` 이 본다. **정확히 겹치는 서버 라우트만 아무도 안 보고 있었다** —
 * 실측으로 확인했다(위 duplicate 를 주입해도 route-shadowing 은 초록이었다).
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 파일이 갈린 중복 · 경로 문자열이 다른 그림자(그건 shadowing 가드).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const GUARD = 'scripts/check-duplicate-hono-routes.mjs'
const run = () => {
  try {
    execFileSync('node', [GUARD, '-s'], { encoding: 'utf8', stdio: 'pipe' })
    return { code: 0 }
  } catch (e) {
    const err = e as { status?: number; stdout?: string }
    return { code: err.status ?? 1, out: err.stdout ?? '' }
  }
}

describe('서버 라우트 중복 가드', () => {
  it('지금은 중복이 없다', () => {
    expect(run().code).toBe(0)
  })

  it('중복을 심으면 **실제로** 빨간불이 된다 (헛도는 가드가 아니다)', () => {
    const F = 'src/features/seller/api/seller-orders.routes.ts'
    const original = readFileSync(F, 'utf8')
    try {
      writeFileSync(F, original + "\nsellerOrdersRoutes.get('/products/:id', async (c) => c.json({ ok: true }));\n")
      const r = run()
      expect(r.code).toBe(1)
      expect(r.out).toContain('/products/:id')
    } finally {
      writeFileSync(F, original)
    }
    expect(run().code).toBe(0)   // 복원 확인 — 다음 테스트를 오염시키지 않는다
  })

  it('수신자가 라우터가 아닌 호출은 안 잡는다 (c.get(\'user\') 오탐 방지)', () => {
    // 🩸 첫 판이 정확히 이걸 못 걸러 38개 파일을 위반이라 신고했다. 그대로 켰으면 아무도 안 봤을 것.
    const s = readFileSync(GUARD, 'utf8')
    expect(s).toContain('ROUTER_NAME')
    expect(/\^\[ \\t\]\*/.test(s)).toBe(true)   // 줄 맨 앞 앵커
  })

  it('스캔 대상이 비면 통과가 아니라 실패다', () => {
    const s = readFileSync(GUARD, 'utf8')
    expect(/files\.length < MIN_FILES[\s\S]{0,300}process\.exit\(1\)/.test(s)).toBe(true)
  })

  it('가드가 실제 실행 경로에 등록돼 있다 (파일만 있고 안 도는 것 방지)', () => {
    expect(readFileSync('scripts/audit-gate.sh', 'utf8')).toContain('check-duplicate-hono-routes.mjs')
    expect(readFileSync('.github/workflows/verify.yml', 'utf8')).toContain('check-duplicate-hono-routes.mjs')
  })
})
