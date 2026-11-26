/**
 * 📥 2026-09-08 어드민 결재함 — 결재 파일 파서 계약.
 *   실제 레포의 결재 파일 전부를 파싱해 필수 필드가 채워지는지 본다(템플릿이 바뀌면 여기가 먼저 빨개진다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseDecision, sortDecisions, isDecisionFile, slugFromPath } from '@/pages/admin/decisions/parse-decision'

const DIR = join(process.cwd(), 'docs/decisions')
const files = readdirSync(DIR).filter(f => isDecisionFile(f))

describe('admin-decisions parse', () => {
  it('실제 결재 파일이 하나 이상 있고 전부 파싱된다 (측정 대상 0 이면 실패)', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const d = parseDecision(slugFromPath(f), readFileSync(join(DIR, f), 'utf8'))
      expect(d.title.length, f).toBeGreaterThan(5)
      expect(['open', 'approved', 'rejected', 'expired', 'done'], f).toContain(d.status)
      expect(d.role.length, f).toBeGreaterThan(0)
      expect(d.question.length, f).toBeGreaterThan(10)
      expect(d.options.length, f).toBeGreaterThan(0)
    }
  })

  it('템플릿·README 는 결재 파일이 아니다', () => {
    expect(isDecisionFile('_template.md')).toBe(false)
    expect(isDecisionFile('README.md')).toBe(false)
    expect(isDecisionFile('2026-09-07-foo.md')).toBe(true)
  })

  it('<비워 둠> 은 빈 값으로 읽고, 머지 해시가 있고 "머지 대기" 가 없는 approved 만 fullyApplied', () => {
    const base = '# 제목\n\n상태: approved\n등급: C\n역할: dev\n올린 날: 2026-09-07\n기한: 2026-09-14\n\n## 질문\n질문 한 문장입니다\n\n## 선택지\n1. 안 하나\n2. 안 둘\n\n## 결정 (대표가 한 말 그대로)\n'
    const empty = parseDecision('x', base + '<비워 둠>\n\n## 반영 커밋\n<비워 둠>\n')
    expect(empty.decision).toBe('')
    expect(empty.applied).toBe('')
    expect(empty.fullyApplied).toBe(false)
    const waiting = parseDecision('x', base + '1\n\n## 반영 커밋\n- PR #1 (draft, 머지 대기)\n')
    expect(waiting.fullyApplied).toBe(false)
    const merged = parseDecision('x', base + '1\n\n## 반영 커밋\n- PR #1 → 머지 `1d0593e`\n')
    expect(merged.fullyApplied).toBe(true)
    expect(merged.options).toEqual(['안 하나', '안 둘'])
  })

  it('정렬: 답 필요 → 구현 중 → 반영 끝, 같은 묶음은 기한 이른 순', () => {
    const makeDecision = (slug: string, status: string, due: string, applied = '<비워 둠>') =>
      parseDecision(slug, `# ${slug}\n\n상태: ${status}\n역할: dev\n기한: ${due}\n\n## 질문\n질문 한 문장입니다\n\n## 선택지\n1. a\n\n## 결정 (대표가 한 말 그대로)\n1\n\n## 반영 커밋\n${applied}\n`)
    const sorted = sortDecisions([
      makeDecision('done', 'approved', '2026-09-01', '머지 `abcdef1`'),
      makeDecision('open-late', 'open', '2026-09-20'),
      makeDecision('wip', 'approved', '2026-09-10'),
      makeDecision('open-early', 'open', '2026-09-14'),
    ]).map(d => d.slug)
    expect(sorted).toEqual(['open-early', 'open-late', 'wip', 'done'])
  })
})

// 🗂️ 2026-11-26 대표 "결재함에 있는 것들은 다 구현 중이고 대기 중인거야 실제로? 왜 저렇게 많지?"
//   실측: "구현 중" 45건 중 34건이 이미 끝났는데 반영 칸을 아무도 안 채워 남아 있었다(그리고 이 페이지가
//   결재 전문을 빌드에 넣어 사이트에서 가장 무거운 청크 98KB 가 됐다 → 전체 JS 예산을 막았다).
//   ⚠️ 못 막는 것: 반영 칸을 아예 안 채우는 것(구현 여부는 코드를 봐야 안다 — 당번이 주기적으로 대조한다).
describe('결재함 정리 — 끝난 결재는 보관함으로', () => {
  it('"반영 끝" 줄이 있는 결재가 docs/decisions/ 에 남아 있지 않다(archive/ 로 옮길 것)', () => {
    const stale = files.filter(f => /✅\s*\*\*반영 끝/.test(readFileSync(join(DIR, f), 'utf8')))
    expect(stale, `보관함으로 옮길 것: ${stale.join(', ')}`).toEqual([])
  })

  it("반영 칸의 '⏸ 대기' 줄은 '대표·외부 조치 대기' 로 읽힌다(구현 중으로 세지 않는다)", () => {
    const raw = '# 제목입니다 충분히 길게\n상태: approved\n등급: C\n역할: dev\n기한: 2026-12-01\n\n## 질문\nq\n## 반영 커밋\n- ⏸ 대기(세무사): 답 오면 진행\n'
    const d = parseDecision('2026-11-26-x', raw)
    expect(d.waiting).toBe(true)
    expect(d.fullyApplied).toBe(false)
    const done = parseDecision('2026-11-26-y', raw.replace('⏸ 대기(세무사): 답 오면 진행', 'abc1234 (#1)'))
    expect(done.waiting).toBe(false)
  })
})
