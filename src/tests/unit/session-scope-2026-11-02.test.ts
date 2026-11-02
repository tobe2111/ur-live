/**
 * 🛡️ 세션 = 작업 하나 — 2026-11-02 (대표 *"세션별 작업 분리가 안되는데? 다른 세션에서 기존 세션에서
 * 작업하던 걸 가져오고 그래"*).
 *
 * 원인은 규칙 문장 두 개의 조합이었다:
 *   (a) CLAUDE.md *"새 세션 시작 시 반드시 `ls docs/handoff/ | sort -r | head -5` 로 최근 인계를 찾아 1~3건 열기"*
 *   (b) 인계마다 *"다음 세션의 첫 액션"* (최근 30건에 40회)
 * 세션이 여러 개 동시에 도는 지금 *최신 인계 = 다른 세션이 하던 일* 이라서, 새 세션이 주제와 무관하게
 * 남의 할 일 목록을 받아 실행했다.
 *
 * 이 시험이 지키는 것:
 *   ① CLAUDE.md 인계 절에 "남의 작업은 이어받지 않는다" 규칙이 있다
 *   ② 인계를 **최신순으로 열라는 지시**가 CLAUDE.md · CURRENT_WORK.md 에 없다(주제로 찾는다)
 *   ③ 인계에 남길 칸 이름이 "다음 세션의 첫 액션" 이 아니라 "이어받는 세션의 첫 액션" 이다 —
 *      CLAUDE.md 와, 인계를 안 쓴 브랜치에 고치는 법을 알려 주는 검사 메시지 둘 다
 *   ④ dev 역할 정의의 '남의 PR·인계를 보는 루틴' 에 범위 한정이 붙어 있다
 *
 * ⚠️ **못 보는 것**: 세션이 실제로 이 규칙을 지키는지(행동은 레포가 못 본다) · 이미 쓰인 옛 인계의
 * "다음 세션의 첫 액션" 문장(기록이라 소급 수정하지 않는다 — 그래서 ① 이 그 문장을 무력화한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')
const claude = read('CLAUDE.md')
const sec = claude.slice(claude.indexOf('## 🔄 진행 중 작업 인계'), claude.indexOf('## 📣 유어애즈 방향 확정'))

describe('세션 = 작업 하나 (남의 작업을 이어받지 않는다)', () => {
  it('① 인계 절에 "남의 작업은 이어받지 않는다" 규칙이 있다', () => {
    expect(sec.length, '인계 절을 못 찾았다(제목이 바뀌었나?)').toBeGreaterThan(500)
    expect(sec).toContain('남의 작업은 이어받지 않는다')
    expect(sec, '다른 세션 브랜치·PR 금지 줄이 없다').toContain('다른 세션의 브랜치·PR 에 커밋·머지·코멘트하지 않는다')
    expect(sec, '실행은 대표가 이름을 대서 시켰을 때만 — 그 조건이 없다').toContain('이름을 대서')
  })

  it('② 인계를 최신순으로 열라는 지시가 없다 (주제로 찾는다)', () => {
    for (const [name, s] of [['CLAUDE.md', claude], ['docs/CURRENT_WORK.md', read('docs/CURRENT_WORK.md')]] as const) {
      const bad = s.split('\n').filter((l) => /ls docs\/handoff\/? \| sort -r/.test(l) && !/^> 🩸/.test(l))  // 🩸 줄은 옛 지시를 인용하는 기록이다
      expect(bad, `${name} 가 아직 최신순으로 열라고 지시한다`).toEqual([])
    }
    expect(sec, '주제로 찾는 명령이 없다').toMatch(/grep -ril '<[^>]+>' docs\/handoff\//)
  })

  it('③ 인계 칸 이름이 "이어받는 세션의 첫 액션" 이다 (CLAUDE.md + 검사 메시지)', () => {
    const list = sec.slice(sec.indexOf('반드시 남길 4가지'))
    expect(list).toContain('**이어받는 세션의 첫 액션**')
    expect(list.slice(0, 400)).not.toContain('**다음 세션의 첫 액션**')
    const msg = read('scripts/check-current-work-sync.mjs')
    expect(msg).toContain('이어받는 세션의 첫 액션')
    expect(msg).not.toContain('다음 세션의 첫 액션')
  })

  it('④ dev 역할의 남의 PR·인계 루틴에 범위 한정이 있다', () => {
    const dev = read('.claude/agents/dev.md')
    const i = dev.indexOf('## 하는 일')
    expect(i).toBeGreaterThan(-1)
    expect(dev.slice(i, i + 400)).toContain('dev 역할 루틴으로 돈 세션만')
  })
})
