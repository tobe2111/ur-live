/**
 * 🔎 **카드 사진의 이름이 어느 매장인지 말한다** (2026-10-11 대표 신고 · SEO)
 *
 * ■ 무엇을 보고 만들었나
 *   대표가 Google 이미지에서 **헤이춘천 사진**을 눌렀더니 출처가 `urdeal.kr` 인데 제목이
 *   사이트 기본값(*"유어딜 - 우리 동네 맛집·카페·뷰티 이용권 할인"*)이었다.
 *   *"이용권 명칭이 뜨게 해야 노출이 되지 않겠어?"*
 *
 * ■ 실측으로 규명한 기제 (2026-10-11)
 *   | 페이지 | 그 사진이 어떻게 있나 | 제목 |
 *   |---|---|---|
 *   | `/pass/2732` 상세 | **CSS `background-image`**(서버 HTML 의 `<img>` 는 마스코트 1개뿐) | ✅ "주말 1박 숙박권 (스탠다드 룸) 공동구매 - 헤이춘천" |
 *   | 홈 · `/stays` 목록 | **진짜 `<img>`** | ❌ 사이트 기본값 |
 *   ⇒ Google 이 집을 수 있는 `<img>` 가 **목록 페이지에만** 있어 거기로 귀속되고,
 *     그 페이지 제목은 매장·권종을 한 글자도 안 말한다.
 *
 *   그런데 그 `<img>` 의 `alt` 마저 `p.name` 뿐이었다 — `"주말 1박 숙박권 (스탠다드 룸)"`.
 *   호텔 수십 곳이 공유하는 문자열이라 **사진에 붙은 유일한 이름이 매장을 안 말한다.**
 *
 * ■ 이 시험이 **못 고치는/못 보는 것** (과신 금지)
 *   - 사진의 **귀속 페이지**는 안 바뀐다. 상세 히어로가 `<img>` 가 되기 전까지 Google 은
 *     여전히 목록 페이지를 출처로 본다(제목도 그 페이지 것). 그건 별건이다.
 *   - 실제 검색 노출이 오르는지는 여기서 못 잰다(서치콘솔 몫).
 *   - `alt` 가 화면에 보이지 않으므로 그림으로도 확인되지 않는다 — 그래서 이 시험이 필요하다.
 */
import { describe, it, expect } from 'vitest'
import { cardImageAlt, stripStorePrefix } from '@/utils/deal-title'
import { readCode } from '../helpers/source-text'

describe('① 사진 이름 규칙', () => {
  it('🔴 매장명이 앞에 붙는다 — 대표가 본 그 상품', () => {
    expect(cardImageAlt('주말 1박 숙박권 (스탠다드 룸)', '헤이춘천'))
      .toBe('헤이춘천 주말 1박 숙박권 (스탠다드 룸)')
  })

  it('상품명이 이미 매장명으로 시작하면 **두 번 쓰지 않는다**', () => {
    expect(cardImageAlt('헤이춘천 주말 1박 숙박권', '헤이춘천')).toBe('헤이춘천 주말 1박 숙박권')
    expect(cardImageAlt('헤이춘천 - 주말 1박 숙박권', '헤이춘천')).toBe('헤이춘천 주말 1박 숙박권')
  })

  it('중복 제거는 카드 제목과 **같은 함수**를 쓴다(두 규칙이 갈리면 안 된다)', () => {
    const name = '홍대돈까스 치즈돈가스 2인 세트'
    const store = '홍대돈까스'
    expect(cardImageAlt(name, store)).toBe(`${store} ${stripStorePrefix(name, store)}`)
  })

  it('매장이 없으면 상품명만 — 교환권(브랜드 없음)도 깨지지 않는다', () => {
    expect(cardImageAlt('스타벅스 아메리카노 교환권', null)).toBe('스타벅스 아메리카노 교환권')
    expect(cardImageAlt('아메리카노', '')).toBe('아메리카노')
  })

  it('상품명이 없으면 매장명, 둘 다 없으면 폴백 — 빈 alt 를 만들지 않는다', () => {
    expect(cardImageAlt('', '헤이춘천')).toBe('헤이춘천')
    expect(cardImageAlt(null, null, '숙소')).toBe('숙소')
    expect(cardImageAlt(undefined, undefined, undefined)).toBe('')
  })

  it('공백만 있는 값도 빈 것으로 본다', () => {
    expect(cardImageAlt('   ', '  ', '카페')).toBe('카페')
  })
})

describe('② 배선 — 카드가 실제로 그 함수를 쓴다', () => {
  // 🩸 함수만 검사하면 호출부가 옛 `p.name` 으로 남아도 초록이 된다(이 레포가 반복해 당한 클래스).
  const FEED = 'src/pages/main-home/GroupBuyFeedCard.tsx'
  const VOUCHER = 'src/pages/vouchers/shared.tsx'

  it('동네딜 카드가 매장명을 넘긴다', () => {
    const s = readCode(FEED)
    expect(s).toContain('cardImageAlt(p.name, p.restaurant_name')
    expect(s, '옛 alt 가 남아 있다').not.toContain('alt={p.name || cat.label}')
  })

  // 🎟️ 2026-10-14: 모바일 3열 타일(`VoucherTile`, 대표 B안)이 셋째 자리로 늘었다 — 불변식(전부 브랜드를 넘긴다)은 그대로.
  it('교환권 카드·행·타일 **전부** 브랜드를 넘긴다', () => {
    const s = readCode(VOUCHER)
    const n = s.split('cardImageAlt(p.name, p.brand_name)').length - 1
    expect(n, '카드·행·타일 중 일부만 고쳐졌다').toBe(3)
    expect(s.includes('alt={p.name}'), '옛 alt 가 남아 있다').toBe(false)
  })

  it('소비자 카드에 `alt={p.name}` 만 쓰는 자리가 더 없다(전수)', () => {
    for (const f of [FEED, VOUCHER, 'src/components/deal/DealCardMedia.tsx']) {
      expect(readCode(f), `${f} 에 매장명 없는 alt 가 남았다`).not.toContain('alt={p.name}')
    }
  })
})
