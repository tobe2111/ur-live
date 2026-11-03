/**
 * ← 뒤로가기 한 벌 — 2026-11-03 대표 *"페이지 이동이 지금 이상적인지 봐줘 특히 뒤로가기"*.
 *
 * 라이브 실측: 링크로 바로 들어온 화면(이용권 상세·숙소·지도·쇼츠·약관…)에서 머리줄 ← 를 누르면
 * 9곳 전부 **앱 밖으로** 나갔다. 화면마다 `navigate(-1)` 을 손으로 적었고, 막으려던 몇 곳은
 * `history.length`·`document.referrer` 로 판정해서 그것도 틀렸다(앱 밖 칸까지 센다).
 * ⇒ 판정은 `useSafeBack`(라우터 `history.state.idx`) 한 곳이다.
 *
 * 이 시험이 지키는 것:
 *  ① 코드(주석 제외)에 `navigate(-1)` 이 허용 목록 밖에 없다.
 *  ② 뒤로 판정에 `window.history.length` 를 쓰지 않는다(referrer 판정은 MobileHeader 한 곳이었고 이번에 걷었다 — 기계 판정이 오탐이라 시험엔 안 넣었다).
 *  ③ `canGoBackInApp` 의 판정 자체 — idx 0 · 없음 · 비숫자는 false, 1 이상만 true.
 *
 * ⚠️ 못 보는 것: fallback 이 그 화면에 *맞는 자리*인지(사람이 고른다) · 손으로 `history.back()` 부르는 곳
 *   · `<Link to="/">` 처럼 뒤로 *모양*의 버튼이 push 하는 경우.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { canGoBackInApp } from '@/hooks/useSafeBack'

/** 허용 — 사유가 있는 곳만. 늘리지 말 것. */
const ALLOW = new Set([
  'src/hooks/useSafeBack.ts', // SSOT 자신
  'src/pages/user-profile/seller-section/ToolPageSheet.tsx', // 시트 안 이력(sheet-history) — 앱 이력 칸이 늘 있다
  'src/pages/GroupBuyDetailPage.tsx', // 🔒 로딩 잠금 파일 — 대표 승인 뒤 이행(2026-11-03 결재 대기)
  'src/pages/TossWidgetPayPage.tsx', // 🔒 Toss V2 잠금 파일 — 대표 승인 뒤 이행
])

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const files = execSync("git ls-files 'src/*.ts' 'src/*.tsx' 'src/**/*.ts' 'src/**/*.tsx'", { encoding: 'utf8' })
  .split('\n').filter(Boolean).filter((f) => !f.startsWith('src/tests/'))

describe('뒤로가기 SSOT (useSafeBack)', () => {
  it('검사 대상이 충분하다(glob 이 눈멀지 않았다)', () => {
    expect(files.length).toBeGreaterThan(1500)
  })

  it('① navigate(-1) 은 허용 목록 밖에 없다', () => {
    const bad = files.filter((f) => !ALLOW.has(f) && /navigate\(\s*-1\s*\)/.test(stripComments(readFileSync(f, 'utf8'))))
    expect(bad).toEqual([])
  })

  it('② 뒤로 판정에 window.history.length 를 쓰지 않는다', () => {
    const bad = files.filter((f) => /window\.history\.length/.test(stripComments(readFileSync(f, 'utf8'))))
    expect(bad).toEqual([])
  })

  describe('③ canGoBackInApp', () => {
    const orig = window.history.state
    afterEach(() => window.history.replaceState(orig, ''))
    const at = (state: unknown) => { window.history.replaceState(state, ''); return canGoBackInApp() }
    it('앱 안 칸이 있으면 true', () => { expect(at({ idx: 1 })).toBe(true); expect(at({ idx: 7, usr: null })).toBe(true) })
    it('처음 연 칸(링크로 바로 들어옴)은 false', () => { expect(at({ idx: 0 })).toBe(false) })
    it('라우터 표식이 없으면 false(바깥에서 쌓은 칸)', () => {
      expect(at(null)).toBe(false); expect(at({ modalOpen: true })).toBe(false); expect(at({ idx: '3' })).toBe(false)
    })
  })
})
