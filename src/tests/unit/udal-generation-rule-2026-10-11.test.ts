/**
 * 🦦 유달이 생성 철칙 (2026-10-11 대표 *"앞으로는 만들 때 이것을 철칙으로 여겨서 문제가 없도록 해줘"*)
 *
 * 같은 날 철칙 없이 그려 다른 캐릭터가 두 번 나왔다(짧게 고쳐 쓴 문구 · gemini · 미리보기만 보고 판정).
 * 철칙과 그 재료(설정서 문구·세부 실측·보정 블록·검수 도구·기준 원본)가 **지워지거나 따로 놀지 않게** 고정한다.
 * ⚠️ 못 막는 것: 실제로 그 문구로 생성했는지, 결과가 같은 캐릭터인지 — 그건 검수 도구와 대표 판정이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const DOC = readFileSync('docs/design/urdeal-mascot-otter-2026-10.md', 'utf8')
const QA = 'scripts/mascot/udal-qa.py'

describe('유달이 생성 철칙', () => {
  it('철칙 다섯 줄이 문서에 있다', () => {
    expect(DOC).toContain('🔒 유달이 생성 철칙')
    expect(DOC).toMatch(/gpt-image-2\.5/)
    expect(DOC).toMatch(/한 장 시트/)
    expect(DOC).toMatch(/udal-qa\.py/)
  })

  it('설정서 본문 · 세부 실측 · 보정 블록이 모두 있다', () => {
    expect(DOC).toContain('Cute chibi baby otter mascot, 3D animated character')
    expect(DOC).toContain('Exactly THREE thin long white whiskers on each side')
    expect(DOC).toContain('Correction details: the face is NARROW')
  })

  it('검수 도구와 그 기준 원본이 실재한다', () => {
    expect(existsSync(QA)).toBe(true)
    const src = readFileSync(QA, 'utf8')
    const ref = /REF = os\.path\.join\(ROOT, '([^']+)'\)/.exec(src)?.[1]
    expect(ref, '검수 도구가 기준 원본 경로를 선언하지 않는다').toBeTruthy()
    expect(existsSync(ref!), `${ref} 없음 — 검수가 무엇과 비교하는지 사라진다`).toBe(true)
  })

  it('CLAUDE.md 가 모든 세션에 철칙을 가리킨다', () => {
    expect(readFileSync('CLAUDE.md', 'utf8')).toContain('유달이(마스코트) 생성 철칙')
  })
})
