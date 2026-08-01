/**
 * 🔴 몰 OG 메타 불변식 〔세션 ③-a, 대표 UX 기준 ②〕
 *
 * *"OG 메타가 곧 매대다. sitemap 과 동일하게 몰 스코프 확인 필수 — A몰 링크에 본진이나 B몰 정보가 뜨면 안 된다."*
 *
 * **sitemap 과 같은 클래스인 이유**: 잘못 나간 미리보기는 **카톡방에 박제**된다. 카카오 스크랩 캐시는
 * 오래 살고, 우리가 고쳐도 이미 뿌려진 대화방의 카드는 그대로다 — **회수 시점의 통제권이 없다.**
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 호출부가 이 함수를 **안 쓰고** 직접 메타를 만드는 경우(배선 시점의 문제 — 워커 배선 PR 에서 볼 것)
 *   - 카카오 스크랩 캐시 자체(우리 코드 밖)
 *   - `mall_id` 가 **잘못 스탬프된** 경우(등록 경로 → ③-b)
 */
import { describe, it, expect } from 'vitest'
import { buildMallMeta } from '@/worker/utils/mall-ssr-meta'

const origin = 'https://urdeal.kr'
const mall = { id: 3, name: '동네상회' }
const product = {
  id: 10, name: '수제 사과잼', image_url: 'https://cdn/x.jpg',
  gb_price: 7000, price: 10000, deadline: '2026-08-01 10:00:00', mall_id: 3,
}
const base = { mall, product, origin, pathname: '/my-shop/group-buy/10' }

describe('🔴 몰 스코프 — 불일치·불명이면 만들지 않는다 (fail-closed)', () => {
  it('다른 몰 상품이면 null — A몰 링크에 B몰 카드가 박히지 않는다', () => {
    expect(buildMallMeta({ ...base, product: { ...product, mall_id: 4 } })).toBeNull()
  })

  it('본진(1) 상품이 몰 링크에 실리지 않는다', () => {
    expect(buildMallMeta({ ...base, product: { ...product, mall_id: 1 } })).toBeNull()
  })

  it('mall_id 가 없으면 null — "아마 맞겠지"로 뿌리지 않는다', () => {
    // 컬럼 미적용·조회 누락 등으로 **모르는** 상태다. 모르면 기본 카드로 폴백하는 게 맞다.
    expect(buildMallMeta({ ...base, product: { ...product, mall_id: null } })).toBeNull()
    expect(buildMallMeta({ ...base, product: { ...product, mall_id: undefined } })).toBeNull()
  })

  it('몰·상품이 없으면 null', () => {
    expect(buildMallMeta({ ...base, mall: null })).toBeNull()
    expect(buildMallMeta({ ...base, product: null })).toBeNull()
  })

  it('이름이 비면 null — 빈 카드를 뿌리지 않는다', () => {
    expect(buildMallMeta({ ...base, product: { ...product, name: '  ' } })).toBeNull()
    expect(buildMallMeta({ ...base, mall: { id: 3, name: '' } })).toBeNull()
  })
})

describe('카드 내용 — 몰 이름·사진·공구가·마감일', () => {
  it('몰 이름이 **먼저** 온다 — 누구의 판인지가 먼저 읽혀야 한다', () => {
    const m = buildMallMeta(base)!
    expect(m.title.startsWith('동네상회')).toBe(true)
    expect(m.title).toContain('수제 사과잼')
  })

  it('공구가와 정가를 함께 — 할인 폭이 보여야 카드가 일한다', () => {
    const m = buildMallMeta(base)!
    expect(m.description).toContain('7,000원')
    expect(m.description).toContain('10,000원')
  })

  it('마감일은 KST 기준 — UTC-naive 타임스탬프를 로컬로 오해석하지 않는다', () => {
    // D1 `CURRENT_TIMESTAMP` 는 'YYYY-MM-DD HH:MM:SS'(UTC, Z 없음). 이 레포의 반복 사고 클래스.
    const m = buildMallMeta(base)!
    expect(m.description).toContain('8월 1일 마감')   // 2026-08-01 10:00Z → KST 19:00, 같은 날
  })

  it('UTC 늦은 시각은 KST 에서 다음 날 — 하루 밀림 방지', () => {
    const m = buildMallMeta({ ...base, product: { ...product, deadline: '2026-08-01 16:00:00' } })!
    expect(m.description).toContain('8월 2일 마감')   // 16:00Z + 9h = 익일 01:00 KST
  })

  it('공구가가 없으면 상시가만', () => {
    const m = buildMallMeta({ ...base, product: { ...product, gb_price: null } })!
    expect(m.description).toContain('10,000원')
    expect(m.description).not.toContain('공구가')
  })

  it('공구가가 상시가보다 높으면 특가로 안 쓴다 — 가격을 올리는 방향 금지', () => {
    const m = buildMallMeta({ ...base, product: { ...product, gb_price: 15000 } })!
    expect(m.description).not.toContain('15,000원')
  })

  it('가격·마감이 전부 없어도 카드는 성립한다', () => {
    const m = buildMallMeta({ ...base, product: { ...product, gb_price: null, price: null, deadline: null } })!
    expect(m.description).toContain('동네상회')
  })
})

describe('이미지·canonical', () => {
  it('절대 URL 은 그대로, 상대는 origin 접두', () => {
    expect(buildMallMeta(base)!.ogImage).toBe('https://cdn/x.jpg')
    expect(buildMallMeta({ ...base, product: { ...product, image_url: '/a.png' } })!.ogImage)
      .toBe('https://urdeal.kr/a.png')
  })

  it('이미지가 없으면 기본 OG — 깨진 카드보다 낫다', () => {
    expect(buildMallMeta({ ...base, product: { ...product, image_url: '' } })!.ogImage)
      .toContain('/og-image.svg')
  })

  it('canonical 은 요청 경로 그대로', () => {
    expect(buildMallMeta(base)!.canonical).toBe('https://urdeal.kr/my-shop/group-buy/10')
  })
})
