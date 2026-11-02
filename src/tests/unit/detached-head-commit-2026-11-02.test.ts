/**
 * 🧭 브랜치 밖(detached HEAD) 커밋 금지 (2026-11-02) — 구현·근거: scripts/check-detached-head.mjs
 * 실측: 고침을 브랜치 밖에서 커밋하자 push 가 "Everything up-to-date" 를 내고 아무것도 안 올라갔다.
 * ⚠️ 못 보는 것: 훅이 설치되지 않은 세션(설치는 .claude/hooks/session-start.sh 가 한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { judgeDetached } from '../../../scripts/check-detached-head.mjs'

describe('브랜치 밖 커밋', () => {
  it('브랜치 위면 통과', () => {
    expect(judgeDetached({ branch: 'claude/x', inProgress: [], allow: false })).toEqual([])
  })
  it('브랜치 밖이면 막는다', () => {
    expect(judgeDetached({ branch: null, inProgress: [], allow: false })).toHaveLength(1)
  })
  it('rebase·cherry-pick 진행 중이거나 우회면 통과', () => {
    expect(judgeDetached({ branch: null, inProgress: ['rebase-merge'], allow: false })).toEqual([])
    expect(judgeDetached({ branch: null, inProgress: [], allow: true })).toEqual([])
  })
  it('pre-commit 이 실제로 부르고 실패하면 멈춘다', () => {
    const hook = readFileSync('scripts/install-git-hooks.sh', 'utf8')
    expect(hook).toMatch(/node scripts\/check-detached-head\.mjs \|\| \{\n[^\n]*\n\s+exit 1/)
  })
})
