/**
 * 🧮 어드민 대시보드 D3 합류 (2026-09-15, 대표 "다른 대시보드들의 페이지들도 개선 계속") —
 * 색 정보상자 0 · 이모지 0 · rounded-2xl 0 · 버튼 체계 · 버튼 가드 스코프.
 *
 * 셀러의 `seller-tones-2026-09-15.test.ts` 와 같은 규칙을 어드민 표면(163파일)에 건다. 어드민은 대표만 보는
 * 화면이라 "사소해서" 다시 색이 자라기 쉽다 — 그래서 래칫이 아니라 0 으로 잠근다.
 *
 * 주입 매니페스트: scripts/mutations/admin-tones.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { listFiles } from '../../../scripts/codemods/adopt-dashboard-tones.mjs'

const read = (p: string) => readFileSync(p, 'utf8')
const COLOR = '(?:red|rose|amber|yellow|orange|emerald|green|blue|sky|indigo|purple|violet)'
// ★(U+2605)·☆ 는 이모지가 아니라 글자다(평점·우선 표시에 쓴다) — 범위에서 뺀다.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{2604}\u{2607}-\u{27BF}\u{2B50}\u{2705}\u{274C}\u{2728}\u{26A0}\u{2713}\u{23F3}]/u

describe('어드민 표면 — 스코프', () => {
  const files = listFiles('admin') as string[]
  it('대상 파일이 충분히 있다 — 경로가 낡으면 통과가 아니라 실패', () => {
    expect(files.length).toBeGreaterThan(120)
    expect(files.filter((f) => f.startsWith('src/pages/admin/')).length).toBeGreaterThan(30)
  })
  it('버튼 체계 가드가 어드민 표면도 검사한다 (셀러 전용으로 되돌아가지 않게)', () => {
    const s = read('scripts/check-dashboard-button-system.mjs')
    for (const g of ["':(glob)src/pages/Admin*.tsx'", "':(glob)src/pages/admin/**/*.tsx'", "':(glob)src/components/admin/**/*.tsx'"]) expect(s, g).toContain(g)
  })
})

describe('어드민 표면 — 표면 규칙 0 (잠금)', () => {
  const files = listFiles('admin') as string[]
  it('bg-{색}-50/100 정보상자·배지가 없다 (톤 토큰만)', () => {
    const bad: string[] = []
    for (const f of files) {
      const m = stripComments(read(f)).match(new RegExp(`\\bbg-${COLOR}-(?:50|100)\\b`, 'g'))
      if (m) bad.push(`${f}: ${m.join(' ')}`)
    }
    expect(bad).toEqual([])
  })
  it('UI 코드에 이모지가 없다', () => {
    const bad: string[] = []
    for (const f of files) stripComments(read(f)).split('\n').forEach((ln, i) => { if (EMOJI.test(ln)) bad.push(`${f}:${i + 1}`) })
    expect(bad).toEqual([])
  })
  it('rounded-2xl 이 없다 — 카드 모서리는 --dash-radius 토큰', () => {
    const bad = files.filter((f) => /\brounded-2xl\b/.test(stripComments(read(f))))
    expect(bad).toEqual([])
  })
  it('흰 카드에 그림자 대신 헤어라인 — `bg-white … shadow-sm` 조합이 없다', () => {
    const bad: string[] = []
    for (const f of files) {
      for (const m of stripComments(read(f)).matchAll(/className="([^"]*)"/g)) {
        const c = m[1]
        if (c.includes('bg-white') && /\bshadow-sm\b/.test(c)) bad.push(`${f}: ${c}`)
      }
    }
    expect(bad).toEqual([])
  })
  it('어드민 네비 섹션 라벨에 이모지가 없다', () => {
    for (const m of stripComments(read('src/components/admin/admin-nav-config.ts')).matchAll(/label: '([^'\n]*)'/g)) expect(m[1], m[0]).not.toMatch(EMOJI)
  })
})
