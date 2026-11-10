/**
 * 📏 올리기 전 화면 무게 사전 측정 (2026-11-10) · 근거: scripts/pre-push-surface-budget.mjs 머리말
 * (11/3~11/10 PR 검사 실패 32건 중 화면 무게 12 · 실행 비용 6 — 무게 12건 중 11건이 허용치를 0~0.3KB 넘긴 것)
 * ⚠️ 못 보는 것: 실제 빌드 결과가 CI 와 같은지 — 같은 환경변수를 쓰는지까지만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { needsSurfaceCheck, CI_BUILD_ENV } from '../../../scripts/pre-push-surface-budget.mjs'

describe('화면 무게 사전 측정', () => {
  it('화면 코드를 바꿨을 때만 잰다', () => {
    expect(needsSurfaceCheck(['src/pages/MyPage.tsx'])).toBe(true)
    expect(needsSurfaceCheck(['src/index.css'])).toBe(true)
    expect(needsSurfaceCheck(['package.json'])).toBe(true)
    expect(needsSurfaceCheck(['src/worker/index.ts', 'src/features/blog/api/blog.routes.ts', 'src/tests/unit/x.test.ts', 'docs/a.md', 'scripts/x.mjs'])).toBe(false)
  })
  it('CI 의 Build client 와 같은 환경변수로 빌드한다 — 다르면 바이트가 달라 판정이 어긋난다', () => {
    const yml = readFileSync('.github/workflows/verify.yml', 'utf8')
    const i = yml.indexOf('      - name: Build client\n')
    expect(i).toBeGreaterThan(0)
    const block = yml.slice(i, yml.indexOf('run: npm run build:client', i))
    for (const [k, v] of Object.entries(CI_BUILD_ENV)) expect(block, k).toContain(`${k}: '${v}'`)
  })
  it('푸시 게이트가 부르고, 넘었을 때(exit 1)만 멈춘다', () => {
    const g = readFileSync('scripts/pre-push-gate.mjs', 'utf8')
    const i = g.indexOf("execFileSync('node', ['scripts/pre-push-surface-budget.mjs']")
    expect(i).toBeGreaterThan(0)
    expect(g.slice(i, i + 250)).toMatch(/if \(err && err\.status === 1\) process\.exit\(1\)/)
  })
})
