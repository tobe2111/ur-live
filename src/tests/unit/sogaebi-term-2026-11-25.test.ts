/**
 * 🏷️ 소개비 용어 통일 (2026-11-25 대표 *"3번 소개비 통일해주고"*)
 *
 * 유저가 링크로 소개한 이용권이 팔리면 받는 돈 — 화면·안내·알림에서 부르는 이름은 **소개비** 하나다.
 * 종전엔 같은 돈을 여덟 가지로 불렀다(소개비 191 · 인플루언서 수수료 10 · 추천 커미션 7 · 소개 커미션 6 ·
 * 판매 커미션 6 · 소개 수익 · 소개 몫 · 추천 수수료). 대표 *"표현단어를 통일해야 할 것 같아. 헷갈려"*.
 *
 * 이 시험이 보는 것: 사용자에게 보이는 문자열(주석을 뺀 줄)에 옛 이름이 다시 들어오는지.
 * 이 시험이 못 보는 것: 주석·코드 식별자(`commission`·`curatorEarnings` 등 — 일부러 그대로 둔다) ·
 *   다른 언어 번역(ko 만 본다) · 새로 생기는 제3의 표현(목록에 없으면 통과한다).
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export const BANNED = ['소개 커미션', '추천 커미션', '판매 커미션', '인플루언서 수수료', '소개 수수료', '소개 수익', '소개 몫', '추천 수수료']

export function visibleHits(src: string): string[] {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
  const out: string[] = []
  for (const line of noBlock.split('\n')) {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*')) continue
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1')
    for (const b of BANNED) if (code.includes(b)) out.push(`${b} :: ${t.slice(0, 120)}`)
  }
  return out
}

const FILES = execSync("git ls-files 'src/*.ts' 'src/*.tsx' 'src/**/*.ts' 'src/**/*.tsx' public/locales/ko/translation.json", { encoding: 'utf8' })
  .split('\n').filter((f) => f && !f.includes('/tests/'))

describe('소개비 — 화면에 보이는 이름은 하나', () => {
  it('검사 대상이 실제로 많다(glob 이 눈멀지 않았다)', () => {
    expect(FILES.length).toBeGreaterThan(2500)
    expect(FILES).toContain('src/pages/InfluencerSettlementPage.tsx')
    expect(FILES).toContain('public/locales/ko/translation.json')
  })

  it('옛 이름 여덟 개가 사용자에게 보이는 문자열에 없다', () => {
    const bad: string[] = []
    for (const f of FILES) {
      const s = readFileSync(f, 'utf8')
      if (!BANNED.some((b) => s.includes(b))) continue
      for (const h of visibleHits(s)) bad.push(`${f} — ${h}`)
    }
    expect(bad).toEqual([])
  })

  it('판정기가 주석은 건너뛰고 문자열은 잡는다(되돌려-검증)', () => {
    expect(visibleHits("// 소개 커미션 메모\n/* 추천 커미션 */\nconst a = 1")).toEqual([])
    expect(visibleHits("const label = '판매 커미션 (%)'")).toHaveLength(1)
    expect(visibleHits('<p>소개 수익</p> // 소개 몫')).toHaveLength(1)
  })

  it('명칭 SSOT(CLAUDE.md)에 소개비 행이 있다', () => {
    expect(readFileSync('CLAUDE.md', 'utf8')).toMatch(/\| \*\*소개비\*\* \|/)
  })
})
