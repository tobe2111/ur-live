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
 * 🔤 **로고 폰트는 `display=swap` 으로 둔다 — 그리고 왜 optional 이 아닌지** (2026-09-21).
 *
 * 대표 신고 *"로딩 중에 urdeal 로고도 안보이고"* 를 **폰트 탓으로 오진**해 `swap` → `optional` 로
 * 바꿔 배포했다가(#1527) 같은 날 되돌렸다. 되돌린 근거는 추측이 아니라 측정이다.
 *
 * ## 측정 (Chromium, 폰트를 영영 안 오게 막고 워드마크 박스의 칠해진 픽셀을 셈)
 * ```
 * 대기(ms)    20    50    80   110   150   250   500
 * swap      1626  1626  1626  1626  1626  1626  1626   (38.3%)
 * optional  1626  1626  1626  1626  1626  1626  1626   (38.3%)
 * ```
 * **둘이 완전히 같다.** `swap` 의 블록 구간은 명세상 "extremely small" 이고 Chrome 실측 ~0 이라
 * 폴백 글자가 **즉시** 그려진다 — 애초에 그게 `swap` 의 존재 이유다(anti-FOIT).
 * ⇒ 폰트는 그 증상의 원인이 **아니다**. 원인은 아직 못 찾았다(다음 세션이 이어갈 것).
 *
 * ## 그래서 왜 `swap` 을 고정하나
 * `optional` 은 폰트가 제때 안 오면 **그 로드에서는 아예 안 쓴다**(다음 로드용으로만 받아 둔다).
 * 로더는 1초쯤 떠 있으므로 첫 방문자는 로고를 Poppins 로 거의 못 보게 된다 — 얻는 것 없이 잃는다.
 *
 * ## 이 테스트가 못 막는 것
 * "로더에 글자가 실제로 보이는가" 는 **브라우저 프레임 캡처**로만 판정된다(여긴 문자열 검사다).
 */
describe('🔤 로고 폰트 — swap 고정 (optional 로 되돌아가지 않는다)', () => {
  const HTML = readFileSync('index.html', 'utf8')

  it('Poppins 링크가 display=swap 으로 온다', () => {
    const link = HTML.match(/https:\/\/fonts\.googleapis\.com\/css2\?family=Poppins[^"]*/)?.[0] ?? ''
    expect(link, 'Poppins 링크를 못 찾았다 — 이 검사가 헛돌고 있다').not.toBe('')
    expect(link).toContain('display=swap')
    expect(link, 'optional 은 첫 로드에서 폰트를 통째로 건너뛴다 — 위 측정 참조').not.toContain('display=optional')
  })

  it('되돌린 이유가 파일에 남아 있다 (다음 세션이 같은 오진을 반복하지 않게)', () => {
    expect(HTML, 'index.html 의 정정 주석이 사라졌다').toMatch(/measurement|측정으로 뒤집혔다/)
  })
})
