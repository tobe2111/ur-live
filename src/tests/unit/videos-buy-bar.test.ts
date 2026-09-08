/**
 * 🧾 유어쇼츠 구매 바 — 대표 확정 "안 B + 기존 가격정보" (2026-09-08)
 *
 * 대표: *"구매바는 안 b 로 하지만 기존 가격정보도 넣으면 되잖아."*
 *
 * ## 🩸 내가 틀렸던 것 — 여기가 이 파일에서 제일 값진 부분이다
 * 시안을 내면서 *"안 B 에는 정가가 안 들어간다 — 글자 자리 220px 에 가격 줄이 228px 필요"* 라고
 * 보고했고 그래서 안 C(버튼을 아래로)를 추천했다. **머리로 계산했고 틀렸다.**
 * 대표가 "넣으면 되잖아" 라고 해서 **브라우저로 실제로 재 보니**:
 *
 * | 뷰포트 | 글자 자리 | 보통 | 숙소 6자리 | 최악(7자리·2자리%) |
 * |---|---|---|---|---|
 * | 430px | 267px | 139px | 162px | 175px |
 * | 390px | 227px | 139px | 162px | 175px |
 * | 360px | 197px | 139px | 162px | 175px |
 *
 * 가장 좁은 360px 에서도 **22px 남는다**. 최악값은 `9,900,000원 99% 9,900,000원`.
 * ⇒ 교훈: 폭이 문제라고 말하기 전에 **재라**. 이 레포는 6자리 가격에서 이미 한 번 깨진 적이
 * 있어서(2026-08-31 홈 카드) 경계한 것 자체는 맞았지만, 경계와 측정은 다른 일이다.
 *
 * ## 이 검사가 못 하는 것
 * 실제 렌더 폭은 여기서 안 잰다(jsdom 은 폰트를 모른다). 위 표는 Chromium 실측이고,
 * 여기서는 **그 결과가 성립하게 하는 구조**(한 줄 유지·크기 위계)만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { priceDisplay } from '@/shared/price-display'

const V = readCode('src/pages/VideosPage.tsx')
const CARD = readCode('src/pages/main-home/GroupBuyFeedCard.tsx')

describe('가격 표시 규칙 SSOT — 같은 상품은 어느 화면에서든 같은 할인율', () => {
  it('선언값이 0 이어도 정가·판매가로 계산한다 (2026-08-19 실사고)', () => {
    // 서버가 discount_rate 컬럼 기본값 0 을 내려준 경우. `??` 로 짜면 그 0 이 채택돼
    // 명백한 할인에도 배지가 안 떴다.
    const r = priceDisplay({ price: 30100, original_price: 38000, discount_rate: 0 })
    expect(r.discount).toBe(21)
    expect(r.showOriginal).toBe(true)
  })

  it('선언값이 더 크면 선언값을 쓴다 (둘 중 큰 값)', () => {
    const r = priceDisplay({ price: 9000, original_price: 10000, discount_rate: 30 })
    expect(r.discount).toBe(30) // 계산값 10 보다 큼
  })

  it('정가가 판매가 이하면 취소선을 그리지 않는다 (거짓 할인 금지)', () => {
    expect(priceDisplay({ price: 10000, original_price: 10000 }).showOriginal).toBe(false)
    expect(priceDisplay({ price: 10000, original_price: 8000 }).showOriginal).toBe(false)
    expect(priceDisplay({ price: 10000, original_price: 0 }).showOriginal).toBe(false)
  })

  it('아무것도 없으면 할인 줄 자체를 안 만든다', () => {
    expect(priceDisplay({ price: 10000 }).hasDiscountLine).toBe(false)
    expect(priceDisplay({}).price).toBe(0)
  })

  it('null·undefined·문자열이 와도 안 터진다 (서버 응답은 늘 느슨하다)', () => {
    expect(priceDisplay({ price: null, original_price: null, discount_rate: null }).discount).toBe(0)
    expect(priceDisplay({ price: undefined }).price).toBe(0)
  })

  it('🔒 두 화면이 같은 함수를 쓴다 — 정의가 두 벌이면 조용히 갈린다', () => {
    expect(V, '구매 바가 SSOT 를 안 쓴다').toMatch(/priceDisplay\(/)
    expect(CARD, '홈 딜 카드가 SSOT 를 안 쓴다').toMatch(/priceDisplay\(/)
    // 카드가 옛 계산을 되살리면(복붙 복귀) 다시 두 벌이 된다.
    expect(CARD, '카드에 할인율 계산이 되살아났다').not.toMatch(/const computedDiscount\s*=/)
    expect(V, '구매 바가 자체 계산을 시작했다').not.toMatch(/original_price\s*-\s*/)
  })
})

describe('안 B — 무엇을 사는지 말한다', () => {
  const bar = V.slice(V.indexOf('inset-x-2.5 bottom-2.5'))

  it('상품명 줄이 있다 (안 A 에는 없어서 무엇을 사는지 몰랐다)', () => {
    // 🩸 처음엔 `/cur\.product_name/` 로 썼다가 **헛돌았다** — 렌더를 `{false && cur.product_name && (`
    //   로 꺼도 그 이름이 줄에 남아 통과했다. 이름이 아니라 **렌더 조건 자체**를 앵커로 잡는다.
    //   (같은 함정을 이 기능에서 벌써 두 번 밟았다: `key={cur.video_id}` ↔ `data-key=`.)
    expect(bar).toMatch(/\{cur\.product_name && \(/)
    expect(bar, '상품명 렌더가 꺼졌다').not.toMatch(/\{false && cur\.product_name/)
  })

  it('정가 취소선이 있다 — 대표 지시 "기존 가격정보도 넣으면 되잖아"', () => {
    expect(bar).toMatch(/pd\.showOriginal/)
    expect(bar).toMatch(/line-through/)
    expect(bar).toMatch(/pd\.originalPrice/)
  })

  it('할인율과 판매가도 그대로 있다', () => {
    expect(bar).toMatch(/pd\.discount > 0/)
    expect(bar).toMatch(/formatNumber\(pd\.price\)/)
  })

  it('🔒 가격 줄이 한 줄로 유지된다 — 6자리에서 줄이 깨지지 않는 이유', () => {
    // 실측 표(파일 상단)가 성립하는 전제. 이게 빠지면 긴 가격에서 줄바꿈이 나 바가 높아진다.
    const priceLine = bar.slice(bar.indexOf('pd.showOriginal') - 300, bar.indexOf('formatNumber(pd.price)'))
    expect(priceLine).toMatch(/whitespace-nowrap/)
  })

  it('🔒 크기 위계 — 판매가가 가장 크고 정가가 가장 작다', () => {
    // 정가를 판매가와 같은 크기로 키우면 실측 폭이 무너지고(위 표의 전제),
    // 무엇보다 "지금 얼마인가" 가 안 읽힌다.
    expect(bar).toMatch(/text-\[15px\][^"]*font-bold/)   // 판매가
    expect(bar).toMatch(/text-\[11px\][^"]*line-through/) // 정가 — 가장 작게
  })

  it('🔒 흰 바 위에서는 라이트 할인색(text-sale)을 쓴다', () => {
    // 레일 카드는 사진 위 어두운 스크림이라 다크 값(#FF5C69)을 직접 쓴다. 여기는 흰 바다 —
    // 그 값을 그대로 가져오면 흰 배경에서 옅어진다.
    expect(bar).toMatch(/text-sale/)
    expect(bar, '흰 바에 다크 표면용 값이 들어왔다').not.toMatch(/#FF5C69/)
  })

  it('구매 버튼은 여전히 오른쪽이다 (안 C 로 바뀌지 않았다)', () => {
    // 안 C 는 버튼을 아래로 내려 영상을 20% 가린다. 대표는 안 B 를 골랐다.
    expect(bar).toMatch(/shrink-0 rounded-\[10px\] bg-brand/)
    expect(bar, '버튼이 전체폭이 됐다 = 안 C').not.toMatch(/w-full[^"]*bg-brand/)
  })
})

/**
 * 🔴 2026-09-08 — 이용권이 안 붙은 영상도 뷰어에 온다(공개 쿼리 LEFT JOIN, 대표 확정).
 * 그때 구매 바를 그리면 `/group-buy/null` 로 가는 버튼이 된다.
 */
describe('살 게 없으면 구매 바를 안 그린다', () => {
  it('구매 바가 product_id 뒤에 있다', () => {
    expect(V).toMatch(/\{cur && cur\.product_id \?/)
  })

  it('매장명이 없으면 빈 줄을 남기지 않는다', () => {
    expect(V).not.toMatch(/\{cur\.store_name \|\| ''\}/)
    expect(V).toMatch(/\{cur\.store_name && \(/)
  })
})
