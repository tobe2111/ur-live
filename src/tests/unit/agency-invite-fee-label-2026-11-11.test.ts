/**
 * 🧾 에이전시 매장 초대 링크에 **에이전시 수수료** 표기 · "에이전시 몫" 표현 금지
 *   (2026-11-11 대표 *"에이전시가 매장 초대하는 링크에 에이전시 수수료 표기도 해야겠는데? 에이전시 몫이라고 표현하지 말고"*)
 *
 * 지키는 것:
 *  ① 카톡 카드(에이전시가 보내는 길 · 주소 붙여넣기 서버 메타 길 둘 다)가 정해 둔 수수료 % 를 적는다 · 0 이면 안 적는다
 *  ② 화면에 보이는 글자에 "에이전시 몫" · 에이전시 화면의 "우리 몫" 이 다시 생기지 않는다(주석·식별자는 무관)
 *
 * ⚠️ 못 보는 것: 카카오가 실제로 그리는 카드(대표 확인) · 옛 "중개사 몫"(별개 제도 — 이번 지시 범위 밖).
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { agencyInviteCardCopy } from '@/shared/agency-store-invite'
import { buildStoreInviteMeta } from '@/worker/utils/store-invite-ssr'

describe('① 초대 카드에 에이전시 수수료', () => {
  it('정해 둔 % 가 있으면 첫머리에 적는다', () => {
    expect(agencyInviteCardCopy('리스터', 3).description.startsWith('에이전시 수수료 판매액의 3%. ')).toBe(true)
  })
  it('0 · 미정이면 적지 않는다(종전 문장 그대로)', () => {
    for (const v of [0, null, undefined, NaN]) expect(agencyInviteCardCopy('리스터', v as number).description).not.toContain('수수료')
  })
  it('주소를 붙여 넣는 길(서버 메타)도 같은 % 를 적는다', () => {
    const m = buildStoreInviteMeta({ success: true, agencyName: '리스터', sharePct: 4 }, 'https://urdeal.kr', '/store/agency/x')!
    expect(m.description).toBe(agencyInviteCardCopy('리스터', 4).description)
    expect(m.description).toContain('에이전시 수수료 판매액의 4%')
  })
})

/** 화면 글자만 — 주석 줄·줄 끝 주석은 뺀다. */
function visibleHits(word: RegExp): string[] {
  const files = execSync("git ls-files 'src/*.ts' 'src/*.tsx' 'src/**/*.ts' 'src/**/*.tsx' 'public/locales/*/translation.json'", { encoding: 'utf8' })
    .split('\n').filter((f) => f && !f.startsWith('src/tests/'))
  const out: string[] = []
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => {
      const t = l.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return
      const code = l.replace(/\s\/\/\s.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '')
      if (word.test(code)) out.push(`${f}:${i + 1}`)
    })
  }
  return out
}

describe('② "에이전시 몫" 표현이 화면에 없다', () => {
  it('에이전시 몫', () => { expect(visibleHits(/에이전시 몫/)).toEqual([]) })
  it('에이전시 화면의 우리 몫', () => { expect(visibleHits(/우리 몫/)).toEqual([]) })
  it('검사 대상이 실제로 있다(헛돌지 않는다)', () => { expect(visibleHits(/에이전시 수수료/).length).toBeGreaterThan(5) })
})
