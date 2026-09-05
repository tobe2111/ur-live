/**
 * 💰 이용권 카드 가격 블록 계약 (2026-08-31 — 대표 *"할인율이 사진 안으로 들어가면 안돼 … 쿠팡처럼"*)
 *
 * ■ 왜 테스트인가 — 이 자리는 **하루에 두 번 뒤집혔다**
 *   아침에 "6자리 가격이 두 줄로 깨진다"를 고치려고 할인율 배지를 **사진 위로** 옮겼는데,
 *   대표가 사진을 가린다고 되돌리라고 했다. 되돌리면서 원래 문제(줄 깨짐)가 살아나면 안 되므로
 *   쿠팡식 2줄 가격으로 간다. 그 두 가지를 **동시에** 지켜야 한다는 것이 이 파일의 존재 이유다.
 *
 * ■ 불변식
 *   ① 할인율은 사진 위 오버레이가 아니다 — 사진을 가리지 않는다.
 *   ② 정가(취소선)와 판매가는 **다른 줄**에 있다 — 한 줄에 두면 119,000원 같은 6자리에서
 *      반드시 줄이 깨지고, 그 카드만 높이가 늘어 그리드가 들쭉날쭉해진다.
 *   ③ 할인율은 브랜드 로즈로 강조된다 — 커머스에서 가장 먼저 읽혀야 하는 신호다.
 *
 * ⚠️ 이 테스트가 **못 잡는 것**: 실제 렌더 높이·줄바꿈(그건 미리보기 하네스가 눈으로 본다) ·
 *    CSS 로 위치를 다시 옮기는 경우 · 다른 카드 컴포넌트(이건 이 파일 하나만 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(__dirname, '../../pages/main-home/GroupBuyFeedCard.tsx'), 'utf-8')
/** 사진 오버레이 영역 = <DealCardMedia> 의 overlay prop 안. 그 밖이 카드 본문이다. */
const overlay = SRC.slice(SRC.indexOf('overlay={'), SRC.indexOf('      <div className="pt-'))
const body = SRC.slice(SRC.indexOf('      <div className="pt-'))

describe('이용권 카드 가격 블록', () => {
  it('① 할인율을 사진 위에 올리지 않는다', () => {
    // 오버레이 안에서 `{discount}%` 를 렌더하면 사진을 가린다.
    expect(overlay).not.toMatch(/\{discount\}%/)
  })

  it('② 할인율은 카드 본문의 가격 블록에 있다', () => {
    expect(body).toMatch(/\{discount\}%/)
  })

  it('③ 정가(취소선)와 판매가가 같은 줄에 있지 않다 — 6자리 가격 줄 깨짐 방지', () => {
    // 두 값을 감싸는 가장 가까운 `<p …>` 가 서로 달라야 한다.
    // ⚠️ 2026-09-03: 예전엔 판매가를 `formatNumber(price)` 라는 **함수 이름 그대로** 찾았다.
    //   교환권을 '딜' 로 찍으려고 포매터를 `formatPrice(price, …)` 로 바꾸자 이 검사가
    //   빨간불이 됐다 — 규칙(두 줄)은 안 깨졌는데 **철자**가 달라졌을 뿐이다.
    //   이 레포가 여러 번 밟은 "가드가 파일이 아니라 규칙을 고정해야 한다" 의 같은 사례다.
    //   ⇒ 포매터 이름이 아니라 **`price` 를 찍는 자리**를 찾는다.
    const orig = body.indexOf('line-through')
    const sale = body.search(/format\w*\(price[,)]/)
    expect(orig).toBeGreaterThan(-1)
    expect(sale).toBeGreaterThan(-1)
    const between = body.slice(Math.min(orig, sale), Math.max(orig, sale))
    // 사이에 `</p>` 가 있으면 서로 다른 줄이다.
    expect(between).toContain('</p>')
  })

  it('④ 할인율은 브랜드 로즈로 강조한다', () => {
    const line = body.split('\n').find((l) => l.includes('{discount}%')) || ''
    expect(line).toMatch(/text-brand/)
  })
})
