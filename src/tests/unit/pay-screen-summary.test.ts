/**
 * 🧾 결제 화면 계약 (2026-09-03 — 대표 확정 "안 2 · 다크 적용")
 *
 * ■ 무엇을 고정하나
 *   ① 요약이 **표시 전용**이다 — 쿼리 값이 금액 판단에 새어들지 않는다.
 *   ② 사진이 안 넘어와도 화면이 뜬다(구 링크·셀러 결제는 요약이 없다).
 *   ③ 토스 마운트 상자는 **늘 밝은 섬**이다(`light-island`) — 위젯이 흰색으로 렌더되고
 *      우리는 그 테마를 못 바꾼다. 이 클래스가 빠지면 다크에서 전역 `.dark input` 규칙이
 *      위젯의 이메일 입력을 **흰 글자 on 흰 배경**으로 만든다(09-03 지도 검색창과 같은 사고).
 *   ④ SDK 마운트 계약(id·hidden)은 불변 — 위젯이 붙을 자리를 바꾸면 결제가 통째로 죽는다.
 *   ⑤ 주 행동은 브랜드 색이다(검정 아님).
 *
 * ⚠️ 못 잡는 것: 실제 렌더 픽셀 · 토스가 그 안에 무엇을 그리는지 · 결제 성공 여부.
 *    결제 로직 자체(requestPayment·금액검증·키 분기)는 Toss V2 감사-잠금이고 이 파일은 안 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readPaySummary, appendPaySummary, displayDiscountPct, isDisplayableImageUrl } from '../../shared/pay-summary'

const PAGE = readFileSync(resolve(__dirname, '../../pages/TossWidgetPayPage.tsx'), 'utf-8')

describe('결제 요약 — 표시 전용 파라미터', () => {
  it('이상한 값은 그 항목만 조용히 생략한다 (화면은 계속 뜬다)', () => {
    const q: Record<string, string> = {
      image: 'javascript:alert(1)', merchant: '   ', origAmount: 'abc', qty: '-3',
    }
    expect(readPaySummary((k) => q[k] ?? null)).toEqual({
      image: undefined, merchant: undefined, origAmount: undefined, qty: undefined,
    })
  })

  it('http(s) 사진만 받아들인다 — 스킴 주입 차단', () => {
    expect(isDisplayableImageUrl('https://x.test/a.jpg')).toBe(true)
    expect(isDisplayableImageUrl('http://x.test/a.jpg')).toBe(true)
    expect(isDisplayableImageUrl('javascript:alert(1)')).toBe(false)
    expect(isDisplayableImageUrl('data:image/png;base64,AAA')).toBe(false)
    expect(isDisplayableImageUrl('/relative.jpg')).toBe(false)
    expect(isDisplayableImageUrl(null)).toBe(false)
  })

  it('수량 1 은 표시하지 않는다 (모든 주문에 "1개" 가 붙으면 소음이다)', () => {
    const q: Record<string, string> = { qty: '1' }
    expect(readPaySummary((k) => q[k] ?? null).qty).toBeUndefined()
    const q2: Record<string, string> = { qty: '3' }
    expect(readPaySummary((k) => q2[k] ?? null).qty).toBe(3)
  })

  it('빈 값은 URL 에 아예 안 싣는다', () => {
    const p = appendPaySummary(new URLSearchParams(), { merchant: '', qty: 1 })
    expect([...p.keys()]).toEqual([])
  })

  it('할인율은 정가가 판매가보다 클 때만 — 음수/0 이 안 나온다', () => {
    expect(displayDiscountPct(16500, 22000)).toBe(25)
    expect(displayDiscountPct(22000, 16500)).toBe(0)  // 정가가 더 싸면 표시 안 함
    expect(displayDiscountPct(16500, undefined)).toBe(0)
    expect(displayDiscountPct(NaN, 22000)).toBe(0)
  })
})

describe('결제 화면 배선', () => {
  it('요약 값이 금액 판단에 새어들지 않는다 — 청구액은 amount 하나뿐', () => {
    // `origAmount`/`qty` 가 실제 결제 금액 계산이나 setAmount 에 닿으면 안 된다.
    const setAmountLine = PAGE.split('\n').find((l) => l.includes('setAmount')) || ''
    expect(setAmountLine, 'setAmount 에 요약 값이 섞였다').not.toMatch(/origAmount|summary\./)
    expect(PAGE, '요약 값으로 금액을 다시 계산한다').not.toMatch(/amount\s*[-+*/]\s*summary\./)
  })

  it('사진이 없어도 화면이 뜬다 — 요약은 전부 선택값이다', () => {
    expect(PAGE, '사진을 조건 없이 렌더한다').toMatch(/\{summary\.image && \(/)
  })

  it('토스 마운트 상자는 늘 밝은 섬이다 (다크에서 흰 글자 on 흰 배경 차단)', () => {
    for (const id of ['toss-widget-pay-method', 'toss-widget-pay-agreement']) {
      const line = PAGE.split('\n').find((l) => l.includes(`id="${id}"`))
      expect(line, `${id} 상자를 못 찾았다 — 이 검사가 헛돈다`).toBeTruthy()
      expect(line!, `${id} 에 light-island 가 없다`).toContain('light-island')
    }
  })

  it('SDK 마운트 계약은 그대로다 — id 와 hidden', () => {
    for (const id of ['toss-widget-pay-method', 'toss-widget-pay-agreement']) {
      const line = PAGE.split('\n').find((l) => l.includes(`id="${id}"`))!
      expect(line, `${id} 의 error 숨김이 사라졌다`).toContain("hidden={state === 'error'}")
    }
  })

  it('주 행동은 브랜드 색이다 — 검정 알약이 아니다', () => {
    const cta = PAGE.slice(PAGE.indexOf('onClick={handlePay}'))
    const cls = cta.slice(0, 700)
    expect(cls, 'CTA 가 아직 검정이다').not.toMatch(/bg-gray-800|bg-gray-900|bg-black/)
    expect(cls, 'CTA 가 브랜드 색이 아니다').toMatch(/bg-brand\b/)
  })

  it('다크 대응이 있다 — 이 파일은 오래 dark: 가 0개라 테마 가드가 통째로 건너뛰었다', () => {
    // 테마 일관성 검사는 `dark:` 가 하나도 없는 파일을 스킵한다("순수 다크인지 강제 화이트인지 모호").
    // 그 사각지대 때문에 결제 화면이 다크 지원 0인 채로 초록불을 받아 왔다.
    expect((PAGE.match(/\bdark:/g) || []).length, '다시 dark: 0개가 되면 가드가 또 눈을 감는다')
      .toBeGreaterThan(5)
  })
})
