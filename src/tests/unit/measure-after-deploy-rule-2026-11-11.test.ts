/**
 * 📏 "소비자 화면을 바꿨으면 배포 뒤 속도·밀림을 잰다" 규칙이 살아 있는가 (2026-11-11 대표 승인).
 *
 * 규칙 자체(세션이 실제로 재는가)는 레포 안에서 관측할 수 없다 — 이 시험이 지키는 것은 **규칙이 가리키는 도구가 실재하고 쓸 수 있는가**다:
 *   ① CLAUDE.md 에 규칙 절이 있고, 그 절이 실행 명령과 대상 범위를 말한다
 *   ② 그 명령의 스크립트가 있고 문법이 맞다 · 측정 조건(4G · CPU 4배)이 이 레포의 기존 실측과 같다(값을 비교할 수 있어야 한다)
 *   ③ 스크립트가 없는 주소(HTTP 4xx)를 경고한다 — 404 로더를 "느린 화면"으로 읽은 오판(2026-11-11)의 재발 방지
 * ⚠️ 못 보는 것: 세션이 실제로 쟀는지 · 잰 값을 정직하게 보고했는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const DOC = readFileSync('CLAUDE.md', 'utf8')
const SCRIPT = 'scripts/measure-live-vitals.mjs'
const SRC = readFileSync(SCRIPT, 'utf8')

describe('배포 뒤 실측 규칙', () => {
  it('① CLAUDE.md 가 규칙 · 명령 · 대상 범위를 말한다', () => {
    const i = DOC.indexOf('## 📏 소비자 화면을 바꿨으면 배포 뒤 속도·밀림을 잰다')
    expect(i).toBeGreaterThan(-1)
    const sec = DOC.slice(i, DOC.indexOf('\n## ', i + 10))
    expect(sec).toContain(`node ${SCRIPT}`)
    expect(sec).toContain('대표가 매번 시키지 않아도 한다')
    for (const w of ['FCP', 'LCP', 'CLS', '대시보드', '실재하는']) expect(sec, w).toContain(w)
  })
  it('② 스크립트가 있고 문법이 맞다 · 측정 조건이 기존 실측과 같다', () => {
    expect(existsSync(SCRIPT)).toBe(true)
    execFileSync('node', ['--check', SCRIPT]) // 문법 오류면 던진다
    expect(SRC).toContain('export const THROTTLE = { latency: 150, downloadThroughput: (1.6e6 / 8) * 4, uploadThroughput: 750e3 / 8, cpuRate: 4 }')
    expect(SRC).toContain("viewport: { width: 390, height: 844 }")
    for (const t of ["type: 'layout-shift'", "type: 'largest-contentful-paint'", "'first-contentful-paint'"]) expect(SRC).toContain(t)
  })
  it('③ 없는 주소를 경고하고, 주소 없이 부르면 사용법을 낸다', () => {
    expect(SRC).toContain('if (r.status >= 400) { bad = true;')
    let code = 0
    try { execFileSync('node', [SCRIPT], { stdio: 'pipe' }) } catch (e) { code = (e as { status?: number }).status ?? 1 }
    expect(code).toBe(2)
  })
})
