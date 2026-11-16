/**
 * 📦 CLAUDE.md 의 두 절(디자인 · 유어애즈) 전문을 문서로 옮겼다 (2026-11-16 대표 승인 "둘 다 옮긴다")
 * 왜: 모든 세션이 시작할 때 CLAUDE.md(약 6.1만 토큰)를 통째로 읽는데, 두 절이 그 30%(약 1.8만)였고 대부분 근거·정정 기록이었다.
 * 고정하는 것: ① CLAUDE.md 에 두 절의 머리와 "먼저 읽을 것" 길잡이가 남아 있다 ② 전문 문서가 있고 내용이 실제로 들어 있다
 *            ③ 세션 컨텍스트 예산 검사가 옮긴 문서 안의 문서 참조까지 계속 잰다(옮겼다고 감시에서 빠지지 않게).
 * ⚠️ 못 보는 것: 요약이 전문과 뜻이 같은지 — 디스플레이 스케일 하나만 기계로 대조한다(consumer-type-scale 시험). 나머지는 사람이 읽는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const claude = readFileSync('CLAUDE.md', 'utf8')
const MOVED = [
  { head: '## 🎫 디자인 시스템 확정', doc: 'docs/design/design-system-rules.md', must: ['디스플레이(26px 이상)는 일곱 단계', '목록 문법 — 전체메뉴형 평면 목록', '라이트 섬 `light-island`'] },
  { head: '## 📣 유어애즈 방향 확정', doc: 'docs/business/urads-direction.md', must: ['발굴의 천장은 플랫폼마다 다르다', '옛 행의 업종은 **재분류로 안 고쳐진다', '발송 시점'] },
]

describe('CLAUDE.md 에서 옮긴 두 절', () => {
  for (const m of MOVED) {
    it(`${m.head} — 머리와 길잡이가 남아 있고, 요약은 짧다`, () => {
      const i = claude.indexOf(m.head)
      expect(i, '절 머리가 사라졌다 — 다른 시험이 이 머리를 경계로 쓴다').toBeGreaterThanOrEqual(0)
      const next = claude.indexOf('\n## ', i + 1)
      const body = claude.slice(i, next)
      expect(body).toContain(`\`${m.doc}\` 를 먼저 읽을 것`)
      expect(body.length, '요약이 다시 전문만큼 커졌다 — 기록은 전문 문서에 쌓는다').toBeLessThan(6000)
    })
    it(`${m.doc} — 전문이 실제로 들어 있다`, () => {
      const d = readFileSync(m.doc, 'utf8')
      expect(d.split('\n').slice(0, 4).join('\n')).toContain('CLAUDE.md 에서 옮긴 전문')
      for (const s of m.must) expect(d, s).toContain(s)
    })
  }
  it('세션 컨텍스트 예산 검사가 옮긴 문서 안의 참조도 잰다', () => {
    const g = readFileSync('scripts/check-context-budget.mjs', 'utf8')
    expect(g).toContain("const MOVED_FROM_CLAUDE = 'CLAUDE.md 에서 옮긴 전문'")
    expect(g).toContain("const src = [claude, ...moved.map((p) => read(p) || '')].join('\\n')")
  })
})
