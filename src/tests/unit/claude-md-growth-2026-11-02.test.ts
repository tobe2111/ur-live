/**
 * 🧱 CLAUDE.md 증가 상한 + 판정 기록 차단 — 2026-11-02 (대표 *"이러니까 계속 충돌이 되었지"* → *"모두 개선해줘"*).
 *   근거·측정: `scripts/check-claude-md-growth.mjs` 머리말. 최근 머지 200건 중 20건이 CLAUDE.md 를 고쳤다.
 *
 * 고정하는 것:
 *   ① 4,000자 넘게 늘면 실패 · 그 안이면 통과
 *   ② 더한 줄에 판정 기록(E3~E5 판정 · 판정 통과)이 있으면 실패 — 규칙 문장("E4 이상에서만 완료")은 통과
 *   ③ 우회 토큰이 있으면 통과
 *   ④ 배선 — verify 의 strict 단계(pre-push 는 verify 를 파싱해 같은 명령을 돈다)
 *   ⑤ 지금 CLAUDE.md 에 판정 기록이 남아 있지 않다(옮긴 자리: docs/handoff/2026-11-02-claude-md-verdicts-moved.md)
 * ⚠️ 못 막는 것: 4,000자 안의 기록성 문장(패턴 밖 표현) · 규칙이 맞는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { judgeClaudeMd, GROWTH_LIMIT_CHARS, BYPASS, RECORD_PATTERNS } from '../../../scripts/check-claude-md-growth.mjs'

const base = 'x'.repeat(1000)
const ok = { baseText: base, headText: base, addedLines: [] as string[], commitMessages: '' }

describe('CLAUDE.md 증가 상한 + 판정 기록 차단', () => {
  it('① 4,000자 초과는 실패, 그 안은 통과', () => {
    expect(judgeClaudeMd({ ...ok, headText: base + 'y'.repeat(GROWTH_LIMIT_CHARS + 1) })).toHaveLength(1)
    expect(judgeClaudeMd({ ...ok, headText: base + 'y'.repeat(GROWTH_LIMIT_CHARS) })).toHaveLength(0)
    expect(GROWTH_LIMIT_CHARS).toBeLessThanOrEqual(4000)
  })

  it('② 판정 기록 줄은 실패, 규칙 문장은 통과', () => {
    expect(judgeClaudeMd({ ...ok, addedLines: ['> ✅ **E4 판정 통과(배포 후 라이브, 머지 `abc`)**'] })).toHaveLength(1)
    expect(judgeClaudeMd({ ...ok, addedLines: ['배포 후 E4판정: 숫자 1 → 0'] })).toHaveLength(1)
    expect(judgeClaudeMd({ ...ok, addedLines: ['"완료" 는 E4(라이브에서 의도한 효과를 실측) 이상에서만 쓴다'] })).toHaveLength(0)
    expect(RECORD_PATTERNS.length).toBeGreaterThan(0)
  })

  it('③ 우회 토큰이 있으면 통과', () => {
    expect(judgeClaudeMd({ ...ok, headText: base + 'y'.repeat(9000), commitMessages: `feat: x\n\n${BYPASS}` })).toHaveLength(0)
  })

  it('④ verify 에 strict 단계로 걸려 있다', () => {
    const v = readFileSync('.github/workflows/verify.yml', 'utf8')
    expect(v).toMatch(/\n {8}run: node scripts\/check-claude-md-growth\.mjs\n {8}continue-on-error: false\n/)
  })

  it('⑤ 지금 CLAUDE.md 에 판정 기록 줄이 없다', () => {
    const lines = readFileSync('CLAUDE.md', 'utf8').split('\n').filter((l) => RECORD_PATTERNS.some((re) => re.test(l)))
    // 유달이 철칙의 "톤 판정 통과" 는 검수 규칙(판정 '결과'가 아니다) — 그 한 줄만 예외.
    expect(lines.filter((l) => !l.includes('udal-qa.py'))).toEqual([])
  })
})
