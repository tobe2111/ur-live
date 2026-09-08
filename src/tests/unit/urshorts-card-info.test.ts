/**
 * 🏷️ 유어쇼츠 홈 레일 카드 — 대표 확정 "안 라" (2026-09-08)
 *
 * 대표: *"안 라. 만약 영상 속 정보 모르면 그냥 안보이게 하는거지?"*
 *
 * 카드에 담기는 것: **매장 / 상품명 / 정가 / 할인율·판매가** + 우상단 재생시간.
 *
 * ## 🔴 "모르는 것은 그리지 않는다" 가 이 파일의 핵심
 * 이전 카드는 매장명을 `{item.store_name || ''}` 로 그려서, **값이 없어도 빈 줄이 남았다.**
 * 화면엔 그냥 여백으로 보이니 아무도 버그로 안 읽는데, 카드마다 글자 시작 높이가 달라져
 * 레일이 들쭉날쭉해진다. 값이 있을 때만 그 줄을 만든다.
 *
 * ## 무엇이 빌 수 있는가 (서버 계약 — 2026-09-08 에 넓어졌다)
 * **전부 빌 수 있다.** 원래는 `product_name`·`price` 만은 공개 쿼리의 INNER JOIN 이 보장했는데,
 * 대표가 *"이용권 정보를 입력하지 않으면 그냥 정보 없이 두는걸로"* 로 확정해 `LEFT JOIN` 이 됐다.
 * ⇒ 이용권이 안 붙은 영상은 **글자 띠 자체를 안 그린다**(`hasInfo`). 조건 없이 그리면 빈 검정
 *   그라디언트만 남는데, 그건 "정보 없음"이 아니라 결함으로 보인다.
 *
 * ## 실측 (Chromium, 125×222)
 * | 상태 | 글자 띠 | 사진 가림 |
 * |---|---|---|
 * | 전부 있음 | 82px | 37% |
 * | 매장명 없음 | 69px | 31% |
 * | 할인 없음 | 67px | 30% |
 * | 이름·시간 없음 | 54px | 24% |
 *
 * 재생시간은 **우상단**이다. 시안에서는 우하단이었는데 글자가 네 줄이 되면서 아래를
 * 스크림이 다 차지한다 — 그대로 두면 가격 위에 배지가 얹힌다(렌더로 확인하고 옮겼다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { priceDisplay } from '@/shared/price-display'

const R = readCode('src/components/home/UrShortsRail.tsx')
const card = R.slice(R.indexOf('function ShortCard'), R.indexOf('const MemoCard'))

describe('안 라 — 카드가 담는 것', () => {
  it('매장 · 상품명 · 정가 · 할인율 · 판매가가 모두 있다', () => {
    expect(card, '매장명').toMatch(/item\.store_name/)
    expect(card, '상품명').toMatch(/item\.product_name/)
    expect(card, '정가').toMatch(/pd\.originalPrice/)
    expect(card, '할인율').toMatch(/pd\.discount/)
    expect(card, '판매가').toMatch(/formatNumber\(pd\.price\)/)
  })

  it('재생시간을 분:초로 만든다', () => {
    expect(card).toMatch(/durLabel/)
    expect(card).toMatch(/padStart\(2, '0'\)/)
  })
})

describe('🔴 모르는 것은 그리지 않는다', () => {
  it('매장명이 없으면 빈 줄을 남기지 않는다 (예전 `|| \'\'` 회귀 금지)', () => {
    // 이게 이 카드의 원래 결함이었다 — 값이 없어도 줄이 남아 카드 높이가 갈렸다.
    // ⚠️ 카드 전체로 검사하면 **aria-label 의 `|| ''`** 에 걸린다(그건 문자열 조립이라 정상).
    //    그리는 자리(스크림)만 본다.
    const scrim = card.slice(card.indexOf('bg-gradient-to-t'))
    expect(scrim, "매장명이 `|| ''` 로 돌아갔다").not.toMatch(/item\.store_name \|\| ''/)
    expect(scrim).toMatch(/\{item\.store_name && \(/)
  })

  it('상품명·정가·재생시간도 조건부다', () => {
    expect(card).toMatch(/\{item\.product_name && \(/)
    expect(card).toMatch(/\{pd\.showOriginal && \(/)
    expect(card).toMatch(/\{durLabel && \(/)
  })

  it('🔴 이용권이 없으면 글자 띠를 통째로 안 그린다 (빈 그라디언트 금지)', () => {
    // LEFT JOIN 이후 상품 없는 행이 여기까지 온다. 띠를 무조건 그리면 사진 아래가
    // 이유 없이 어두워진다 — 값이 하나도 없을 때 띠가 사라지는 것이 대표 지시의 실체다.
    expect(card).toMatch(/const hasInfo = /)
    expect(card, '띠가 hasInfo 뒤에 없다').toMatch(/\{hasInfo && \(\s*\n?\s*<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t/)
  })

  it('가격이 0 이면 "0원"을 안 쓴다', () => {
    expect(card).toMatch(/\{pd\.price > 0 && \(/)
  })

  it('재생시간이 0 이거나 없으면 라벨을 만들지 않는다', () => {
    expect(card).toMatch(/dur > 0 \?/)
  })

  it('🔒 정가가 판매가 이하면 취소선을 안 그린다 (SSOT 가 판정)', () => {
    // 카드가 자체 판단하지 않고 priceDisplay 의 showOriginal 을 그대로 쓴다.
    expect(priceDisplay({ price: 19000, original_price: 19000 }).showOriginal).toBe(false)
    expect(priceDisplay({ price: 13300, original_price: 19000 }).showOriginal).toBe(true)
  })
})

describe('🔒 지키는 계약', () => {
  it('할인율 정의가 홈 카드·구매 바와 같다 (세 번째 정의 금지)', () => {
    expect(card, 'SSOT 를 안 쓴다').toMatch(/priceDisplay\(item\)/)
    expect(card, '카드가 다시 자체 계산한다').not.toMatch(/Number\(item\.discount_rate\)/)
  })

  it('재생시간 배지는 위쪽이다 — 아래로 내리면 가격 위에 얹힌다', () => {
    const badge = card.slice(card.indexOf('{durLabel && ('), card.indexOf('{durLabel && (') + 320)
    expect(badge).toMatch(/top-1\.5/)
    expect(badge, '아래로 내려가면 네 줄 스크림과 겹친다').not.toMatch(/bottom-/)
  })

  it('사진 위 스크림에서는 다크 표면용 할인색을 쓴다', () => {
    // 스크림은 테마와 무관하게 늘 어둡다 — 라이트 값(#DC2626)은 안 읽힌다.
    expect(card).toMatch(/text-\[#FF5C69\]/)
  })

  it('🔒 홈 첫 화면 비용 0 — 썸네일은 near 일 때만 그린다', () => {
    // 이 카드의 `load` prop 이 그 게이트다. 무조건 그리면 홈이 요청을 더 낸다.
    expect(card).toMatch(/\{load && thumb \?/)
  })
})
