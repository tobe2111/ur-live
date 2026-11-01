/**
 * 🗺️🎬💗 2026-10-14 대표 확정 세 건 — 지도 칩(다안) · 이용권 없는 쇼츠 카드(나안) · 위시리스트(가안+나안).
 *
 * 순수 함수는 **실제로 돌려서** 재고, 배선은 소스로 고정한다.
 * ⚠️ 못 보는 것: 실제 렌더 모양(눈으로 본다) · 피드가 비었을 때의 체감.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mapPathFor } from '@/components/main/MapViewChip'
import { pickNearbyPasses, sidoFromShortsRegion, NEARBY_PICK_COUNT } from '@/pages/videos/nearby-picks'
import { pickSimilar, topCategory } from '@/pages/wishlist/WishlistRecommend'
import { itemSaving, summarize } from '@/pages/wishlist/wishlist-signals'
import { POPULAR_PASS_FEED_URL } from '@/hooks/usePopularPassFeed'

const read = (p: string) => readFileSync(p, 'utf-8')

describe('① 지도 칩 — 지금 카테고리 그대로 지도로', () => {
  it('전체·없음은 /map, 카테고리는 쿼리로', () => {
    expect(mapPathFor('all')).toBe('/map')
    expect(mapPathFor(null)).toBe('/map')
    expect(mapPathFor('meal_voucher')).toBe('/map?category=meal_voucher')
  })
  it('상단 카테고리 줄에 붙어 있고 지도 위에선 숨는다', () => {
    const nav = read('src/components/main/DesktopTopNav.tsx')
    expect(nav).toMatch(/\{!hideDealCats && <MapViewChip dealCat=\{activeDealCat\} \/>\}/)
  })
  it('지도 페이지가 그 쿼리를 읽는다(짝)', () => {
    expect(read('src/pages/RestaurantMapPage.tsx')).toMatch(/\.get\('category'\)/)
  })
})

describe('② 이용권 없는 쇼츠 — 이 지역 인기 이용권 세 장', () => {
  const feed = [
    { id: 1, image_url: 'a.jpg', restaurant_address: '부산 해운대구 우동', category: 'meal_voucher' },
    { id: 2, image_url: 'b.jpg', restaurant_address: '서울 종로구', category: 'meal_voucher' },
    { id: 3, image_url: 'c.jpg', restaurant_address: '부산 수영구', category: 'stay_voucher' },
    { id: 4, image_url: null, restaurant_address: '부산 중구', category: 'meal_voucher' },
    { id: 5, image_url: 'e.jpg', restaurant_address: '부산 동구', deal_only: 1 },
  ]
  it('그 지역 것만, 사진 없는 것·교환권은 뺀다', () => {
    const r = pickNearbyPasses(feed, '부산')
    expect(r.label).toBe('부산 인기 이용권')
    expect(r.items.map((x) => x.id)).toEqual([1, 3])
    expect(r.more).toBe('/region/%EB%B6%80%EC%82%B0')
    expect(r.items.find((x) => x.id === 3)?.to).toBe('/stays/3')
  })
  it('그 지역 것이 없으면 "이 지역" 이라 부르지 않는다', () => {
    const r = pickNearbyPasses(feed, '제주')
    expect(r.label).toBe('지금 인기 이용권')
    expect(r.more).toBe('/map')
    expect(r.items.length).toBe(NEARBY_PICK_COUNT)
  })
  it('묶음 키(충남세종)도 시/도로 읽는다', () => {
    expect(sidoFromShortsRegion('충남세종')).toBe('충남')
    expect(sidoFromShortsRegion(null)).toBeNull()
  })
  it('뷰어: 이용권이 있으면 구매 바, 없으면 같은 자리에 이 카드', () => {
    const v = read('src/pages/VideosPage.tsx')
    expect(v).toMatch(/cur && cur\.product_id \? \(/)
    expect(v).toMatch(/: cur && nearbyFeed \? \(/)
    expect(read('src/pages/videos/NearbyPassesCard.tsx')).toMatch(/absolute inset-x-\[10px\] bottom-\[10px\] z-20[^"]*bg-white\/95/)
  })
  it('홈 피드와 같은 예열 주소를 쓴다(새 캐시 키 0)', () => {
    expect(read('src/worker/cron/cache-prewarm.ts')).toContain(`'${POPULAR_PASS_FEED_URL}'`)
  })
})

describe('③ 위시리스트 — 아끼는 돈 · 주소/거리 · 비슷한 이용권', () => {
  const wished = [
    { product_id: 10, category: 'meal_voucher', price: 31000, original_price: 35000, deal_only: 0 },
    { product_id: 11, category: 'meal_voucher', price: 38600, original_price: 46000, deal_only: 0 },
    { product_id: 12, category: 'etc_voucher', price: 500, original_price: 1000, deal_only: 1 },
  ]
  it('아끼는 돈은 카드의 정가-판매가 합(교환권 제외)', () => {
    expect(itemSaving(wished[0] as never)).toBe(4000)
    expect(itemSaving(wished[2] as never)).toBe(0)
    expect(summarize(wished as never).savings).toBe(11400)
  })
  it('비슷한 이용권: 찜한 것·교환권 제외, 같은 카테고리 먼저', () => {
    const feed = [
      { id: 10, category: 'meal_voucher', image_url: 'x' },
      { id: 20, category: 'stay_voucher', image_url: 'x' },
      { id: 21, category: 'meal_voucher', image_url: 'x' },
      { id: 22, category: 'meal_voucher', image_url: 'x', deal_only: 1 },
      { id: 23, category: 'beauty_voucher', image_url: 'x' },
    ]
    expect(pickSimilar(feed, wished as never).map((p) => p.id)).toEqual([21, 20, 23])
    expect(topCategory(wished as never)).toBe('meal_voucher')
  })
  it('서버가 주소·좌표를 내려주고 카드가 받는다', () => {
    expect(read('src/features/wishlists/api/wishlists.routes.ts')).toMatch(/p\.restaurant_address, p\.restaurant_lat, p\.restaurant_lng/)
    const page = read('src/pages/WishlistPage.tsx')
    expect(page).toMatch(/restaurant_lat: item\.restaurant_lat/)
    expect(page).toMatch(/userLoc=\{userLoc\}/)
    expect(page).toMatch(/<WishlistRecommend /)
  })
  it('모바일 나안: 요약 카드 + 한 줄 목록, 격자와 동시에 그리지 않는다', () => {
    const page = read('src/pages/WishlistPage.tsx')
    expect(page).toMatch(/<WishlistSummaryCard s=\{summary\} \/>/)
    expect(page).toMatch(/!isLgViewport \? <WishlistRows items=\{shown\} userLoc=\{userLoc\} \/> : \(/)
    const m = read('src/pages/wishlist/WishlistMobile.tsx')
    expect(m).toMatch(/lg:hidden/)
    expect(m).toMatch(/<DealRow/)
  })
  it('거리는 홈 카드와 같은 표기(1km 미만 소수 한 자리, 10km 이상은 말하지 않음)', async () => {
    const { wishDistance } = await import('@/pages/wishlist/WishlistMobile')
    const loc = { lat: 37.5, lng: 127 }
    expect(wishDistance({ restaurant_lat: 37.5045, restaurant_lng: 127 } as never, loc)).toBe('0.5km')
    expect(wishDistance({ restaurant_lat: 37.53, restaurant_lng: 127 } as never, loc)).toBe('3km')
    expect(wishDistance({ restaurant_lat: 38, restaurant_lng: 127 } as never, loc)).toBeNull()
    expect(wishDistance({ restaurant_lat: 37.5, restaurant_lng: 127 } as never, null)).toBeNull()
  })
})

describe('④ 교환권 페이지 상단 배너(라안) — 홈 배너와 같은 테이블·같은 캐러셀', () => {
  it('자리가 하나 늘고 라벨·규격이 같이 있다(어드민이 그대로 읽는다)', async () => {
    const m = await import('@/shared/constants/home-showcase')
    expect(m.BANNER_SLOTS).toContain('vouchers')
    expect(m.BANNER_SLOT_LABELS.vouchers).toMatch(/교환권/)
    expect(m.BANNER_SLOT_SPECS.vouchers.recommendedWidth).toBeGreaterThanOrEqual(1600)
    expect(m.isBannerSlot('vouchers')).toBe(true)
  })
  it('PC 에서도 한 장씩(single) · 폰·PC 모두 4:1 띠(모바일 나안) · 폰은 설명 줄 없음', () => {
    const c = read('src/components/home/HomeBannerStrip.tsx')
    expect(c).toMatch(/variant === 'vouchers'[\s\S]{0,120}<StripRail [^>]*single \/>/)
    expect(c).toMatch(/const perView = single \? 1 : pcPerView/)
    expect(c).toMatch(/const SINGLE_CARD_CLS = '!aspect-\[4\/1\] lg:!w-full !py-3 \[&>span\]:hidden lg:\[&>span\]:block /)
    // 📏 대표 "문장은 한줄로": 제목은 한 줄 고정(폭 72% — 오른쪽 28% 는 그림 자리)
    // ✂️ 대표 "한 줄이거나, 끊는 자리를 정한 두 줄": 폭 54%(유달이 왼쪽) · 최대 두 줄 · 제목의 줄바꿈이 끊는 자리 · 낱말 단위
    // 🔁 2026-10-14: 교환권 머리(hero) 클래스도 같은 토큰을 쓰게 돼 파일 전체 검색이 헛돈다 — 띠 상수만 본다.
    const single = (c.match(/const SINGLE_CARD_CLS = '([^']*)'/) || [])[1] || ''
    expect(single, 'SINGLE_CARD_CLS 를 못 찾았다 — 이 검사가 헛돈다').not.toBe('')
    expect(single).toMatch(/\[&>strong\]:!line-clamp-2/)
    expect(single).toMatch(/\[&>strong\]:!max-w-\[54%\]/)
    expect(single).toMatch(/\[&>strong\]:!whitespace-pre-line/)
    expect(single).toMatch(/\[&>strong\]:!\[word-break:keep-all\]/)
    // ↕️ 대표 "글자를 높이 기준으로 중앙에" — 띠는 세로 가운데, 아래 어둡게 까는 막 없음
    expect(c).toMatch(/SINGLE_CARD_CLS = '[^']*!justify-center[^']*\[&>div\]:hidden'/)
    // 넘김 버튼은 띠에서 위로 — 아래 오른쪽은 유달이 자리(라이브에서 "2/4" 가 유달이를 가렸다)
    expect(c).toMatch(/\$\{single \? 'top-2' : 'bottom-3'\}/)
    expect(c).toMatch(/single \? SINGLE_CARD_CLS : ''/)
  })
  // 🔀 2026-11-01 뒤집음 — 대표 *"배너 없는게 낫겠고"* (A안). 종전 이 검사는 *"PC·모바일 둘 다 붙어 있다"*
  //   였다. 배너를 뺀 것이 결정이므로 **같은 자리를 반대 방향으로 잠근다** — 가드를 지우면 다음 세션이
  //   "교환권에도 배너를 달자"로 조용히 되돌린다(그러면 첫 상품이 다시 196px 아래로 내려간다).
  it('교환권 페이지에는 배너를 두지 않는다 (A안, 2026-11-01)', () => {
    const v = read('src/pages/VouchersPage.tsx')
    expect(v).not.toMatch(/HomeBannerStrip/)
    expect(v).toMatch(/\{heroMode && <VouchersTopRow\b/)
    // 머리가 한 줄이라 배너 응답을 기다리는 '어두운 판' 예약 장치도 필요 없다.
    expect(v).not.toMatch(/VouchersHero/)
  })
})
