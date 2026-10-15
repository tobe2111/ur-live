/**
 * 🧭 지도·검색 → 상세가 중간 페이지를 거치지 않는다 (2026-10-15 — 대표 *"지도에서 이용권 들어갈 때 쓸데없는
 * 페이지들이 로딩 중에 잠깐잠깐 뜨거든? 이런 부분들 전체 페이지 전수조사 해야해. 로딩 속도에도 문제가 있을거야."*).
 *
 * 라이브 실측(아이폰13, `urdeal.kr/map?q=부산`): 지도 카드·목록이 이용권을 **`/products/:id`(쇼핑 상세)** 로
 * 보냈다. 쇼핑 상세가 청크·데이터를 받은 **뒤에야** 종류를 알고 `/pass/:id` 로 다시 보내서
 * [로더 → 쇼핑 상세 → 로더 → 이용권 상세] — 같은 상품을 두 번 받았다. 그리고 바로 가도 이용권 상세의
 * 청크·데이터를 **누른 뒤에야** 받기 시작해 풀스크린 로더가 ~0.7초 떴다(홈 카드는 미리 받고 있었다).
 *
 * ⚠️ 못 보는 것: 실제 프레임(브라우저) · 종류를 모르는 호출부(category 없음)는 여전히 `/products` 를 거친다.
 * 주입: scripts/mutations/map-detail-direct-2026-10-15.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { detailHref } from '@/shared/product-flow'

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

describe('① detailHref — 종류에 맞는 정본 상세로 바로', () => {
  it('이용권 · 숙소 · 교환권 · 쇼핑', () => {
    expect(detailHref({ id: 7, category: 'meal_voucher' })).toBe('/pass/7')
    expect(detailHref({ id: 7, category: 'stay_voucher' })).toBe('/stays/7')
    expect(detailHref({ id: 7, deal_only: 1, category: '커피/음료' })).toBe('/vouchers/7')
    expect(detailHref({ id: 7, category: 'lifestyle' })).toBe('/products/7')
    expect(detailHref({ id: 7 })).toBe('/products/7')
  })
})

describe('② 지도·검색이 /products 를 거치지 않는다', () => {
  const files = [
    'src/pages/RestaurantMapPage.tsx',
    'src/pages/restaurant-map/SelectedDealCard.tsx',
    'src/pages/restaurant-map/SelectedPeekCard.tsx',
    'src/pages/restaurant-map/SelectedDetailCard.tsx',
    'src/pages/SearchPage.tsx',
  ]
  for (const f of files) {
    it(f, () => {
      const s = code(f)
      expect(s, '이용권을 쇼핑 상세로 보낸다 — 거기서 다시 /pass 로 튄다').not.toMatch(/navigate\(`\/products\/\$\{/)
      expect(s, '정본 주소를 손으로 적었다 — 숙소·교환권이 엉뚱한 상세로 간다').not.toMatch(/navigate\(`\/pass\/\$\{/)
      expect(s).toMatch(/navigate\(detailHref\(/)
    })
  }
})

describe('③ 누르기 전에 상세를 데운다', () => {
  it('선택 카드가 뜬 순간 데운다', () => {
    expect(code('src/pages/restaurant-map/SelectedDealCard.tsx')).toMatch(/useEffect\(\(\) => \{ prefetchDetail\(selected\) \}/)
  })
  it('목록 줄은 손가락이 닿은 순간', () => {
    expect(code('src/pages/restaurant-map/RestaurantRow.tsx')).toMatch(/onPointerDown=\{onIntent \? \(\) => onIntent\(r\) : undefined\}/)
    expect(code('src/pages/restaurant-map/RestaurantList.tsx')).toMatch(/onIntent=\{onIntent\} \/>\s*$/m)
    expect(code('src/pages/RestaurantMapPage.tsx')).toMatch(/onIntent=\{prefetchDetail\}/)
    expect(code('src/pages/SearchPage.tsx')).toMatch(/onIntent=\{prefetchDetail\}/)
  })
  it('홈 카드와 같은 캐시 키 · 같은 lazy 모듈', () => {
    const s = code('src/pages/restaurant-map/prefetch-detail.ts')
    expect(s).toMatch(/prefetchGroupBuyProduct\(qc, k\)/)
    // 2026-10-15: 화면 코드는 App.tsx 가 등록한 같은 로더(`loadRoute`)로 받는다 — 직접 import() 하면 '준비됨' 이 안 된다(boot-page).
    expect(s).toMatch(/loadRoute\('gbDetail'\)/)
    expect(s).toMatch(/warmStayDetail\(p\.id\)/)
    expect(code('src/pages/stays/stay-detail-warm.ts')).toMatch(/loadRoute\('stayDetail'\)/)
    const app = readFileSync('src/App.tsx', 'utf-8')
    expect(app).toMatch(/lazyPage\(\(\) => import\('\.\/pages\/StayDetailPage'\)\);[^\n]*registerRoutePreload\('stayDetail', StayDetailPage\.load\)/)
    expect(app).toMatch(/lazyPage\(\(\) => import\('\.\/pages\/GroupBuyDetailPage'\)\);[^\n]*registerRoutePreload\('gbDetail', GroupBuyDetailPage\.load\)/)
  })
})

describe('④ 유어샵 핀 — 교환권은 교환권 상세로', () => {
  it('deal_only=1 → /vouchers', () => {
    expect(code('src/worker/routes/curator.routes.ts')).toMatch(/Number\(prod!\.deal_only\) === 1 \? '\/vouchers' : '\/pass'/)
  })
})
