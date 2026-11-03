/**
 * 🗂️ 디자인 시안 표 — 한 줄 = 파일 하나 (2026-11-03) · 근거: scripts/generate-design-index.mjs 머리말
 * (모든 세션이 README 표 맨 위에 끼워 넣어 3일 머지 109건 중 13건이 그 파일을 다퉜다).
 *
 * 지키는 것: ① README 에 표 줄이 다시 생기지 않는다 ② 줄 파일은 4칸 표 한 줄이다 ③ 목차는 최신순 생성물이고 추적 안 한다
 * ⚠️ 못 보는 것: 줄 파일의 상태 문구가 시안 파일과 맞는지 — 사람이 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { buildDesignIndex, DESIGN_INDEX_DIR } from '../../../scripts/generate-design-index.mjs'

const README = readFileSync('docs/design/README.md', 'utf8')
const files = readdirSync(DESIGN_INDEX_DIR).filter((n) => n.endsWith('.md'))

describe('디자인 시안 표', () => {
  it('① README 에 표 줄이 없다 — 새 줄은 docs/design/index/ 에 파일로', () => {
    const rows = README.split('\n').filter((l) => /^\|.*\|\s*$/.test(l))
    expect(rows, 'README 표에 줄을 다시 끼워 넣었다 — 그 줄을 모든 세션이 다툰다').toEqual([])
  })
  it('② 줄 파일은 날짜 접두사 이름 + 4칸 표 한 줄', () => {
    expect(files.length, '줄 파일이 없다 — 경로가 낡았다').toBeGreaterThan(50)
    for (const n of files) {
      expect(n, '파일명은 <날짜>-<슬러그>.md').toMatch(/^\d{4}-\d{2}-\d{2}-[\w-]+\.md$/)
      const lines = readFileSync(`${DESIGN_INDEX_DIR}/${n}`, 'utf8').trim().split('\n')
      expect(lines.length, `${n}: 한 줄이어야 한다`).toBe(1)
      expect(lines[0].trim().replace(/^\||\|$/g, '').split('|').length, `${n}: 4칸 이상이어야 한다(내용 안의 | 는 허용)`).toBeGreaterThanOrEqual(4)
    }
  })
  it('③ 목차는 최신순 · 생성물이라 추적 안 한다', () => {
    const md = buildDesignIndex([
      { name: '2026-01-01-a.md', text: '| 옛 | 2026-01-01 | x | y |\n' },
      { name: '2026-11-03-b.md', text: '| 새 | 2026-11-03 | x | y |\n' },
    ])
    expect(md.indexOf('| 새 |')).toBeLessThan(md.indexOf('| 옛 |'))
    expect(() => execFileSync('git', ['check-ignore', '-q', 'docs/design/INDEX.local.md'])).not.toThrow()
  })
})
