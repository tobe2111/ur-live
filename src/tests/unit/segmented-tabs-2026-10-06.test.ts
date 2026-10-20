/**
 * 🧭 SegmentedTabs — 탭 라벨이 두 줄로 접히지 않는다 (2026-10-06 대표 신고)
 *
 *   *"판매 중지 0 이렇게 2줄짜리로 나뉘는거 너무 보기 안좋다 근본적으로 모두 해결해"*
 *
 * 원인: 세 화면이 같은 탭을 각자 손으로 그리면서 **칸을 똑같이 나누고(`flex-1`) 좌우 여백을 고정**했다.
 * 390px 폰에서 네 칸이면 글자 자리가 50px 남짓이라 "판매 중지 0" 이 접혔다.
 *
 * 이 시험이 지키는 것:
 *   ① 부품이 세 규칙(줄바꿈 금지 · 글자보다 안 좁아짐 · 넘치면 옆으로)을 갖고 있다
 *   ② 세 화면이 그 부품을 쓴다(손으로 다시 그리지 않는다)
 *   ③ 저장소 어디에도 같은 모양(탭 버튼 + `flex-1` + 줄바꿈 허용)이 새로 생기지 않는다
 *
 * ⚠️ 못 막는 것: jsdom 은 레이아웃이 없어 "실제로 한 줄인가" 는 못 잰다. 그 판정은 렌더된 화면이다.
 *   이 시험은 **줄이 접히게 만드는 클래스 조합**을 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

const R = (p: string) => readFileSync(p, 'utf-8')
// 주석을 걷어낸다 — 부품 머리말이 규칙을 **글로** 설명하고 있어서, 안 걷으면 클래스를 지워도 통과한다.
const COMP = stripComments(R('src/components/ui/segmented-tabs.tsx'))

/** 탭 버튼(aria-pressed / role=tab / aria-selected) 중 `flex-1` 이면서 줄바꿈을 막지 않는 것. */
function wrapProneTabs(src: string): number {
  let n = 0
  // `=>` 안의 `>` 에서 끊기지 않게 — 화살표 함수가 속성 안에 흔하다.
  for (const m of src.matchAll(/<button\b([\s\S]*?)(?<![=-])>/g)) {
    const a = m[1]
    if (a.length > 2000) continue
    if (!/aria-pressed|role="tab"|aria-selected/.test(a)) continue
    if (!/\bflex-1\b/.test(a)) continue
    if (/whitespace-nowrap|truncate/.test(a)) continue
    n++
  }
  return n
}

describe('① 부품이 세 규칙을 갖고 있다', () => {
  it('줄바꿈 금지', () => {
    expect(COMP).toMatch(/whitespace-nowrap/)
  })
  it('글자보다 좁아지지 않는다 (flex: 1 0 auto — 똑같이 나누지 않는다)', () => {
    expect(COMP).toMatch(/flex:\s*'1 0 auto'/)
    expect(COMP, '`flex-1` 은 글자보다 좁아질 수 있다 — 그게 이번 결함이다').not.toMatch(/className=\{`[^`]*\bflex-1\b/)
  })
  it('그래도 넘치면 옆으로 민다 (잘리거나 접히는 대신)', () => {
    expect(COMP).toMatch(/overflow-x-auto/)
  })
})

describe('② 세 화면이 부품을 쓴다', () => {
  for (const f of [
    'src/pages/SellerGroupBuyPage.tsx',
    'src/pages/seller-orders/MobileOrderList.tsx',
    'src/pages/seller-analytics/AnalyticsOverview.tsx',
  ]) {
    it(f, () => {
      expect(R(f)).toMatch(/<SegmentedTabs\b/)
    })
  }
})

describe('③ 같은 모양이 저장소 어디에도 새로 생기지 않는다', () => {
  it('검사기가 실제로 잡는다 (0건이 통과가 아니라 고장일 수 있다)', () => {
    const bad = '<button type="button" onClick={() => go(1)} aria-pressed={on} className={`flex-1 rounded-lg px-4 py-2`}>판매 중지 0</button>'
    const ok = '<button type="button" onClick={() => go(1)} aria-pressed={on} className={`flex-1 whitespace-nowrap px-3`}>판매 중지 0</button>'
    expect(wrapProneTabs(bad)).toBe(1)
    expect(wrapProneTabs(ok)).toBe(0)
  })

  it('탭 버튼 + flex-1 + 줄바꿈 허용 = 0건', () => {
    const files = execSync("git ls-files 'src/**/*.tsx'", { encoding: 'utf-8' }).split('\n').filter(Boolean)
    expect(files.length, '검사 대상이 비었다 — 경로가 낡았다').toBeGreaterThan(200)
    const found = files.filter((f) => wrapProneTabs(R(f)) > 0)
    expect(found, '탭은 `SegmentedTabs` 로 그린다 — 손으로 그리면 좁은 폰에서 라벨이 두 줄로 접힌다').toEqual([])
  })
})
