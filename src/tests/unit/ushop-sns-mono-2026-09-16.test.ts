/**
 * 🎨 유어샵 헤더 SNS 링크는 **잉크 한 색 글리프** (2026-09-16 — 대표 *"로고 너무 촌스러운데..??"*)
 *
 * 종전엔 브랜드 색 타일 셋이었다: 순수 빨강 `#FF0000` · 3-stop 인스타 그라디언트 · 검정 `#1D1F29`.
 * 바로 아래 '유어샵 편집' 블루 버튼까지 치면 **한 화면에 색 면이 넷**이라
 * 🎫 표면 규칙 ②("강조색 하나, 자리 셋")를 정면으로 어겼고, 인스타 타일은 ⑥("그라디언트 0")도 어겼다.
 * 그리고 순수 원색 빨강은 그 자체로 2015년쯤의 인상을 만든다.
 *
 * ⇒ 타일을 없애고 `currentColor` 글리프로. 링크는 자랑거리가 아니라 링크다 —
 *   화면의 유일한 색 면은 '유어샵 편집' 버튼 하나로 돌아온다(2026-09-02 안3 의 원래 규칙).
 *
 * ## 이 시험이 **못** 하는 것
 * "촌스러운가" 는 못 잰다. 규칙 위반(브랜드 색 면·그라디언트)이 **되돌아오는 것**만 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'

const SRC = readCode('src/pages/curator-page/CuratorHeader.tsx')
// SNS 블록만 본다 — 파일 전체를 보면 남의 색까지 걸린다.
const SNS = sliceFrom(SRC, "aria-label=\"YouTube\"", 'SNS 편집', 3000)

describe('① 브랜드 색 면이 없다', () => {
  it('세 타일의 배경색이 사라졌다', () => {
    expect(SRC, '유튜브 순수 빨강').not.toMatch(/#FF0000/i)
    expect(SRC, '인스타 그라디언트').not.toMatch(/linear-gradient/)
    expect(SNS, 'SNS 자리에 색 면 없음').not.toMatch(/\bbg-\[#/)
  })

  it('세 링크 다 currentColor 로 그린다', () => {
    // 색을 바깥 className 이 정하므로 테마·hover 를 저절로 따라간다.
    expect(SNS.match(/currentColor/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(SNS, 'svg 안에 흰색 박기 금지').not.toMatch(/(fill|stroke)="#fff"/)
  })
})

describe('② 세 링크가 같은 모양을 공유한다', () => {
  it('같은 치수·같은 잉크', () => {
    const tiles = SNS.match(/w-9 h-9 rounded-full[^"]*text-gray-500 dark:text-gray-400/g) ?? []
    expect(tiles.length, '유튜브·인스타·틱톡 셋').toBe(3)
    // 셋이 글자 하나까지 같아야 한 줄로 읽힌다.
    expect(new Set(tiles).size).toBe(1)
  })

  it('탭 영역이 34px 보다 줄지 않았다', () => {
    // 타일을 없애면서 터치 영역까지 없애면 접근성 회귀다 — 36px 원으로 오히려 키웠다.
    expect(SNS).toMatch(/w-9 h-9/)
    expect(SNS).not.toMatch(/w-\[34px\]/)
  })
})

describe('③ 왼쪽 선이 위 줄과 맞는다', () => {
  it('글리프 줄만 당기고 편집 버튼은 안 당긴다', () => {
    // 타일이 없으면 글리프가 원 안에서 가운데라 ~8px 들어가 보인다.
    expect(SRC).toMatch(/flex items-center -ml-2 empty:hidden/)
    // 당김은 글리프 묶음에만 — 편집 버튼까지 당기면 SNS 가 없는 사람 화면에서 버튼만 튀어나간다.
    expect(SRC).not.toMatch(/flex items-center gap-2 mt-3 -ml-2/)
  })
})
