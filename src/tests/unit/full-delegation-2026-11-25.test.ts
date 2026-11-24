import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🔓 2026-11-25 대표 전권 위임 — *"너가 모든 권한을 갖도록 승인할게"* → 범위 답 "전부 맡김, 조건 없음".
 *
 * 규칙이 CLAUDE.md 에만 있고 운영 모델(§2 결정권 매트릭스)이 옛 뜻("C = 승인 전 실행 금지")으로 남으면
 * 세션마다 다르게 읽는다. 여기서 고정하는 것:
 *   ① CLAUDE.md 에 위임 절이 있고 대표의 말이 그대로 있다
 *   ② 운영 모델 §2 가 같은 위임을 가리킨다(두 문서가 어긋나지 않는다)
 *   ③ 위임으로 안 풀리는 다섯 가지가 남아 있다 — 사후 기록 · 대상 먼저 확인 · 멈추라 한 것 · 기술 규칙 · 역할 루틴
 *   ④ 결재 기록이 approved 이고 대표의 말을 그대로 담는다
 * 못 막는 것: 세션이 실제로 사후 기록을 남기는지(행동) · 대표가 나중에 말로 범위를 좁혔는데 문서에 안 옮긴 경우.
 */
const claude = readFileSync('CLAUDE.md', 'utf8')
const model = readFileSync('docs/design/ai-team-operating-model.md', 'utf8')
const decision = readFileSync('docs/decisions/2026-11-25-full-delegation.md', 'utf8')
const section = claude.slice(claude.indexOf('## 🔓 전권 위임'), claude.indexOf('## 🤖 AI 팀 운영 모델'))

describe('전권 위임 (2026-11-25)', () => {
  it('① CLAUDE.md 에 위임 절이 운영 모델 절보다 앞에 있고 대표의 말이 그대로 있다', () => {
    expect(section.length).toBeGreaterThan(500)
    expect(section).toContain('너가 모든 권한을 갖도록 승인할게')
    expect(section).toContain('"전부 맡김, 조건 없음"')
    expect(section).toMatch(/세션이 스스로 판단해 실행한다/)
  })
  it('② 운영 모델 §2 가 같은 위임을 가리킨다', () => {
    const matrix = model.slice(model.indexOf('## 2. 결정권 매트릭스'), model.indexOf('## 3. 역할'))
    expect(matrix).toContain('2026-11-25 대표 전권 위임')
    expect(matrix).toMatch(/세션이 판단해 실행하고, 같은 날 `docs\/decisions\/` 에 기록해 보고한다/)
  })
  it('③ 위임으로 안 풀리는 다섯 가지가 남아 있다', () => {
    expect(section).toMatch(/1\. \*\*한 뒤에 적고 보고한다\.\*\*/)
    expect(section).toMatch(/2\. \*\*되돌릴 수 없는 것은 실행 전에 대상을 본다\.\*\*/)
    expect(section).toMatch(/3\. \*\*대표가 멈추라고 한 것은 멈춘 채로 둔다\.\*\*/)
    expect(section).toMatch(/비밀번호·토큰 커밋 금지 · CI\/가드 우회 금지/)
    expect(section).toMatch(/5\. \*\*역할 루틴\*\*/)
  })
  it('④ 결재 기록이 approved 이고 대표의 말을 담는다', () => {
    expect(decision).toMatch(/^상태: approved$/m)
    expect(decision).toContain('너가 모든 권한을 갖도록 승인할게')
    expect(decision).toContain('"전부 맡김, 조건 없음"')
  })
})
