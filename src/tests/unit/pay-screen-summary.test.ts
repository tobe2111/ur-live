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
    // ⚠️ setAmount 는 이제 두 곳이다(초기화 + 딜 조절) — **전부** 본다. 한 줄만 보면 새 줄이 샌다.
    const setAmountLines = PAGE.split('\n').filter((l) => l.includes('setAmount('))
    expect(setAmountLines.length, 'setAmount 검사가 0건을 돌고 있다 — 헛도는 가드').toBeGreaterThan(0)
    for (const line of setAmountLines) {
      expect(line, 'setAmount 에 요약 값이 섞였다').not.toMatch(/origAmount|summary\./)
    }
    // 🔀 2026-09-19 재조준 (대표 확정 "C안" · 승인 "최소 범위"): 종전 규약은 *"요약에서 만든 숫자는
    //   display* 로 이름 짓는다"* 였고, 그 전제는 **요약이 표시 전용**이라는 것이었다. 이제 이 화면이
    //   딜을 조절하므로 총액·청구액은 표시용이 아니라 **청구의 근거**다 ⇒ 이름 규약으로는 더 못 가른다.
    //   대신 진짜 지키려던 것을 그대로 옮겨 적는다: **화면이 금액을 지어내지 않는다.**
    // 🩸 2026-09-19: 종전 정규식은 산술 기호가 `summary.x` **뒤**에 오는 모양만 봤다. 새 코드가
    //   `amount + (summary.dealUsed ?? 0)` 처럼 **앞**에 두자 매치가 0 이 됐고, 이 검사 자신의
    //   "0건이면 헛도는 가드" 단언이 그걸 잡았다. ⇒ 한 줄 안에서 요약과 산술이 **함께** 있으면 본다.
    const derived = [...PAGE.matchAll(/const\s+(\w+)\s*=\s*([^\n]*summary\.\w+[^\n]*)/g)]
      .filter((m) => /[-+*/]/.test(m[2]))
      .map((m) => m[1])
    expect(derived.length, '요약 파생값 검사가 0건을 돌고 있다 — 헛도는 가드').toBeGreaterThan(0)
    const ALLOWED = new Set(['goodsAmount', 'chargeAmount'])
    for (const name of derived) {
      expect(name, `${name} — 요약에서 만든 숫자는 display* 로 이름 짓거나, 청구 근거면 ALLOWED 에 근거와 함께 올릴 것`)
        .toMatch(new RegExp(`^(display|${[...ALLOWED].join('|')})`))
    }
    // ✅ 그 둘의 안전성은 **서버가 다시 본다**: 승인 뒤 `derivePartialDeal` 이 청구액에서 딜을 역산해
    //   게이트·최소 카드액·잔액을 재검증하고, 실제 차감은 원자 CAS 다. 화면이 고를 수 있는 건 범위 안뿐.
    // 🔒 그리고 **상한은 서버가 준다** — 이 화면은 잔액을 조회하지 않는다(조회하면 게이트가 꺼진 날
    //   화면이 거짓말을 한다. 2026-09-04 이 값을 치르고 배운 규칙이다).
    expect(PAGE, '결제 화면이 딜 잔액을 직접 조회한다 — 상한은 서버가 준 dealMax 여야 한다')
      .not.toMatch(/points\/balance|getDealBalance|dealBalance/)
    expect(PAGE, '딜 상한을 서버 값(dealMax)에서 안 받는다').toMatch(/summary\.dealMax/)
    // 청구액 자체는 끝까지 한 값이다 — 어디서도 다시 대입하지 않는다.
    expect(PAGE, 'amount 를 재대입한다').not.toMatch(/^\s*amount\s*=[^=]/m)
    expect(PAGE, 'chargeAmount 를 재대입한다').not.toMatch(/^\s*chargeAmount\s*=[^=]/m)
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

  it('부분결제를 화면이 설명한다 — 딜 사용 · 상품 금액 · 카드 결제', () => {
    // 🪙 딜이 섞이면 청구액이 상품값보다 적다. 이유를 안 보이면 사용자는
    //   10,000원짜리를 눌렀는데 8,000원이 뜨는 걸 그냥 겪는다.
    // ⚠️ 이름만 찾으면 헛돈다 — `summary.dealUsed` 는 이 파일 여러 곳에 있어서 블록을 통째로
    //   꺼도(`{false ? (`) 통과했다(2026-09-04 되돌려-검증이 잡았다). **조건 자체**를 앵커한다.
    // 🔀 2026-09-19 재조준(불변식은 그대로): 조건이 `summary.dealUsed` → `goodsAmount > chargeAmount`.
    //   이 화면에서 딜을 조절할 수 있게 되면서, **URL 이 준 초기 딜**이 아니라 *지금 실제로 쓰는 딜*을
    //   봐야 한다 — 0 에서 시작해 여기서 딜을 고른 사람에게 종전 조건은 그 줄을 안 보여 줬다.
    expect(PAGE, '딜 사용 블록의 렌더 조건이 사라졌다').toContain('{goodsAmount > chargeAmount ? (')
    expect(PAGE, '상품 금액(= 카드 + 딜) 줄이 없다').toContain('상품 금액')
    expect(PAGE, '딜 사용 줄이 없다').toContain('딜 사용')
    // 합이 맞는 게 계약이다 — 상품 금액은 청구액에 딜을 **더해서** 만든다(따로 받아오지 않는다).
    expect(PAGE, '상품 금액을 청구액+딜로 계산하지 않는다').toContain('amount + (summary.dealUsed ?? 0)')
    // 딜이 섞이면 라벨도 바뀌어야 한다(그 숫자는 '결제 금액 전부'가 아니라 카드 몫이다).
    expect(PAGE, "딜이 있을 때 라벨이 '카드 결제' 로 안 바뀐다").toContain("'카드 결제' : '결제 금액'")
  })

  it('딜 사용액은 **서버가 계산한 값**만 쓴다 (화면이 잔액으로 추정하지 않는다)', () => {
    // 화면은 서버 게이트가 켜졌는지 모른다. 잔액만 보고 "8,000원 될 거예요" 를 지어내면
    // 게이트가 꺼진 순간 그 안내가 거짓말이 된다.
    const detail = readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf8')
    expect(detail, '/join 응답의 dealUsed 를 안 받는다').toContain('dealUsed: serverDealUsed')
    expect(detail, '서버 값이 아닌 것을 싣고 있다').toContain('dealUsed: Number(serverDealUsed) || undefined')
    expect(detail, '잔액으로 추정하고 있다').not.toMatch(/dealUsed:\s*dealBalance/)
  })

  it('다크 대응이 있다 — 이 파일은 오래 dark: 가 0개라 테마 가드가 통째로 건너뛰었다', () => {
    // 테마 일관성 검사는 `dark:` 가 하나도 없는 파일을 스킵한다("순수 다크인지 강제 화이트인지 모호").
    // 그 사각지대 때문에 결제 화면이 다크 지원 0인 채로 초록불을 받아 왔다.
    expect((PAGE.match(/\bdark:/g) || []).length, '다시 dark: 0개가 되면 가드가 또 눈을 감는다')
      .toBeGreaterThan(5)
  })
})
