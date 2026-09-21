/**
 * 💾 **이용권 편집 — 저장 버튼을 페이지 헤더로** (2026-09-21 대표:
 * *"https://urdeal.kr/seller/products 에서 변경사항 저장 버튼은 하단이 아닌 위에다가 둬줘"*).
 *
 * 편집 폼은 길어서(기본정보 · 이미지 · 매장정보 · 이용권 조건 · 옵션) 저장 버튼이 **맨 아래**에 있었다.
 * 한 칸만 고치고 저장하려 해도 끝까지 스크롤해야 했다.
 *
 * ## 🔑 버튼이 폼 **밖**으로 나가도 저장 동작이 갈리지 않는다
 * 헤더는 `<form>` 형제라 `type="submit"` 만으로는 이 폼을 제출하지 못한다 → **`form` 속성**으로 묶는다.
 * 그러면 브라우저가 그 폼을 제출하므로 `handleSubmit` · required 검증 · `submitting` 비활성이
 * 하단 버튼이던 시절과 **완전히 같다**. 버튼에 `onClick={handleSubmit}` 을 달면 그때부터
 * 폼 검증을 건너뛰는 두 번째 저장 경로가 생긴다 — 그래서 아래 검사가 그것을 금지한다.
 *
 * ## 이 테스트가 못 막는 것
 * 버튼이 **눈에 보이는 위치**에 있는지는 안 본다(jsdom 에 레이아웃이 없다). 배선만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const PAGE = stripComments(readFileSync('src/pages/SellerProductEditPage.tsx', 'utf8'))

describe('💾 이용권 편집 — 저장 버튼이 위에 있다', () => {
  it('폼에 id 가 있고 헤더 버튼이 form 속성으로 그 폼을 제출한다', () => {
    expect(PAGE).toMatch(/const EDIT_FORM_ID = '[\w-]+'/)
    expect(PAGE, '폼에 id 가 없으면 헤더 버튼이 묶을 대상이 없다').toMatch(/<form id=\{EDIT_FORM_ID\}/)
    expect(PAGE).toMatch(/form=\{EDIT_FORM_ID\}/)
  })

  it('저장 버튼이 DashboardPageHeader 의 actions 안에 있다 (= 화면 위)', () => {
    const actions = PAGE.split('actions={')[1]?.split('\n        />')[0] ?? ''
    expect(actions, 'actions 슬롯을 못 찾았다 — 이 검사가 헛돌고 있다').not.toBe('')
    expect(actions).toMatch(/form=\{EDIT_FORM_ID\}/)
    expect(actions).toMatch(/seller\.saveChanges/)
  })

  it('🔴 저장 경로가 하나뿐이다 — 하단 제출 버튼이 되살아나지 않는다', () => {
    const submits = [...PAGE.matchAll(/type="submit"/g)].length
    expect(submits, `type="submit" 이 ${submits}개 — 저장 버튼이 둘이면 하나는 아래로 돌아간 것이다`).toBe(1)
  })

  it('🔴 헤더 버튼이 폼 검증을 우회하지 않는다 (onClick 직접 제출 금지)', () => {
    // onClick={handleSubmit} 을 달면 required·브라우저 검증을 건너뛰는 두 번째 경로가 생긴다.
    expect(PAGE).not.toMatch(/onClick=\{handleSubmit\}/)
    expect(PAGE, 'submitting 중 중복 제출을 막는 비활성이 사라졌다').toMatch(/form=\{EDIT_FORM_ID\}\s*\n\s*disabled=\{submitting\}/)
  })
})

/**
 * 🔤 **로더 워드마크가 폰트를 기다리다 사라지던 것** (2026-09-21 대표: *"로딩 중에 urdeal 로고도 안보이고"*).
 *
 * 대표 스크린샷: 밝은 배경에 **브랜드 점 하나**뿐. 결정적 단서는 점이 **정중앙이 아니라는 것**이다
 * (이미지 폭 1915 의 중앙 957 vs 점 ~1026, **+69px**). 글자가 아예 없었다면 점이 가운데 왔을 테니,
 * **글자가 자리는 차지하는데 안 칠해진** 상태 — 웹폰트를 기다리는 동안 텍스트가 투명해지는 현상이다.
 * (오프라인 하네스 재현: 같은 마크업에서 워드마크가 레이아웃을 차지할 때 오프셋 **+59px**.)
 *
 * 색 문제가 아니다 — `/seller/*` 는 `DashboardLoader`(forceLight)라 글자가 잉크색(`#16181C`)이고
 * 배경(`#F4F5F7`)과 대비가 충분하다. 내 첫 가설(흰 글자)은 **틀렸고 이 주석이 그 정정이다.**
 *
 * 처방(대표 승인 "단어 하나 교체"): 구글 폰트 주소의 `display=swap` → `optional`.
 * `swap` 은 폰트를 기다리는 블록 구간 동안 글자를 안 그린다. `optional` 은 제때 안 오면 기다리지 않고
 * 폴백으로 **바로** 그린다 → 안 보이는 구간이 구조적으로 사라진다.
 * 이 레포는 본문 폰트(Pretendard)에 이미 같은 처방을 쓰고 있다.
 */
describe('🔤 로더 워드마크 — 폰트를 기다리며 사라지지 않는다', () => {
  const HTML = readFileSync('index.html', 'utf8')

  it('로고 폰트가 display=optional 로 온다 (swap 이면 안 보이는 구간이 생긴다)', () => {
    const link = HTML.match(/https:\/\/fonts\.googleapis\.com\/css2\?family=Poppins[^"]*/)?.[0] ?? ''
    expect(link, 'Poppins 링크를 못 찾았다 — 이 검사가 헛돌고 있다').not.toBe('')
    expect(link).toContain('display=optional')
    expect(link, 'swap 은 기다리는 동안 글자를 투명하게 둔다').not.toContain('display=swap')
  })

  it('본문 폰트도 같은 규칙을 유지한다 (두 벌이 갈리면 한쪽만 사라진다)', () => {
    expect(HTML).toMatch(/font-display:\s*optional/)
  })
})
