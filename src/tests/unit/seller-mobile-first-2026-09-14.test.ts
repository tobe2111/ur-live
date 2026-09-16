/**
 * 📱 **셀러 대시보드 모바일 우선 재설계 — 되돌아가면 조용히 깨지는 배선** (2026-09-14 대표 승인 "그대로 모두 진행").
 *   시안: `docs/design/seller-dashboard-mobile-first-2026-09.md` (홈 M2 · 이용권 M4 · 주문 M3 · 하단 탭 5).
 *
 * ⚠️ 못 막는 것: 간격·크기·"보기 좋은가". 그건 렌더해서 봤다(폰 430 · PC 1440 · 신규/운영/매장없음 세 인격).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { SELLER_PRIMARY_NAV, activePrimaryKey, isCoveredByPrimary } from '@/components/seller/seller-primary-nav'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))

describe('T1 다섯 대분류 SSOT — 폰 하단 탭과 PC 사이드바가 같은 목록을 쓴다', () => {
  it('다섯이고 순서가 홈·주문·이용권·정산·더보기다', () => {
    expect(SELLER_PRIMARY_NAV.map(t => t.key)).toEqual(['home', 'orders', 'vouchers', 'settlements', 'more'])
  })
  it('🔒 하단 탭은 목록을 손으로 적지 않고 모델에서 받는다', () => {
    const tabs = read('src/components/seller-layout/SellerBottomTabs.tsx')
    expect(tabs).toMatch(/const \{ primary \} = useSellerNavModel\(\)/)
    expect(tabs).not.toMatch(/'\/seller\/orders'/)
  })
  it('🔒 홈은 더보기에 다시 뜨지 않는다 (폰 실측: "대시보드" 줄이 중복됐다)', () => {
    expect(isCoveredByPrimary('/seller')).toBe(true)
    expect(activePrimaryKey('/seller/orders/123')).toBe('orders')
  })
  it('🔒 레이아웃 본문 끝이 탭 바 높이만큼 비어 있다 — 없으면 마지막 줄이 탭에 가린다', () => {
    const layout = read('src/components/SellerLayout.tsx')
    expect(layout).toMatch(/paddingBottom: `calc\(\$\{SELLER_TABBAR_H\}px \+ env\(safe-area-inset-bottom\)/)
    expect(layout).toMatch(/<SellerBottomTabs pendingOrders=\{pendingOrders\} \/>/)
    // 햄버거·서랍은 없다 — 폰 메뉴는 하단 탭 + 더보기가 전부다.
    expect(layout).not.toMatch(/sidebarOpen/)
  })
  it('🔒 /seller/more 라우트가 실재한다 (다섯 번째 탭의 착지점)', () => {
    expect(readFileSync('src/routes/seller.routes.tsx', 'utf8')).toContain('path="/seller/more"')
  })
})

describe('T2 홈 M2 — 매장 게이트가 흔들리지 않는다', () => {
  const page = read('src/pages/SellerPage.tsx')
  it('🔒 MyStoresPanel 은 한 자리에만 있다 — 게이트 여부로 부모가 바뀌면 재마운트돼 게이트가 풀렸다 잠겼다를 반복한다(실측)', () => {
    expect(page.match(/<MyStoresPanel /g)?.length).toBe(1)
    expect(page).toContain('storeGated === true ?')
  })
  /**
   * 🔄 2026-09-15 재조준 — 대표가 이 시안 결정을 **뒤집었다**: *"모바일로 볼 때는 왜 매장 등록하는게 안보이지?"*
   *   종전 이 자리는 `gateOnly={!isPc}` 를 잠갔다(폰 홈에 매장 블록 없음, 관리는 `더보기 › 매장`).
   *   그런데 그러면 폰 홈에서 매장을 **추가할** 길이 한 곳도 없다 — 오늘 티켓은 이름만 말하고 누를 수 없다.
   *   ⇒ 이제 폰에서도 그린다. `gateOnly` 옵션 자체는 남긴다(다른 자리에서 쓸 수 있는 계약).
   *   상세: src/tests/unit/seller-mobile-fixes-2026-09-15.test.ts ②
   */
  it('🔒 폰 홈에도 매장 블록이 있다 (2026-09-15 대표 지시로 09-14 시안 결정 대체)', () => {
    expect(page).not.toMatch(/<MyStoresPanel[^>]*gateOnly/)
    expect(read('src/pages/seller-page/MyStoresPanel.tsx')).toMatch(/if \(gateOnly\) return null/)
  })
  it('🔒 홈 숫자는 서버가 실제로 주는 이름만 읽는다 (옛 홈은 없는 summary.* 를 읽어 언제나 0 이었다)', () => {
    const hook = read('src/pages/seller-page/useSellerHome.ts')
    expect(hook).toMatch(/d\.today_revenue/)
    expect(hook).toMatch(/d\.daily_revenue/)
    expect(hook).not.toMatch(/summary\./)
  })
  it('🔒 서버 오늘 매출은 KST 달력일 + 결제 완료만 센다 (종전: UTC 날짜 + 결제 실패까지 합산)', () => {
    const api = read('src/features/seller/api/seller-settlements.routes.ts')
    const i = api.indexOf("get('/dashboard/stats'")
    const body = api.slice(i, i + 2500)
    expect(body).toMatch(/status IN \('PAID','DONE'\) AND DATE\(created_at, '\+9 hours'\) = \?/)
    expect(body).not.toMatch(/AND DATE\(created_at\) = \?/)
  })
})

describe('T3 이용권 M4 · 주문 M3', () => {
  it('🔒 판매 스위치는 상품 관리와 같은 계약(HIDDEN) — PAUSED 는 서버가 400 을 준다', () => {
    const row = read('src/pages/seller-group-buy/VoucherRow.tsx')
    expect(row).toMatch(/status: next \? 'ACTIVE' : 'HIDDEN'/)
    expect(row).toMatch(/role="switch"/)
  })
  it('🔒 폰 주문 타임라인의 [주문 확인]이 실제 상태 전이에 배선돼 있다', () => {
    const page = read('src/pages/SellerOrdersPage.tsx')
    expect(page).toMatch(/onConfirm=\{\(o\) => handleStatusChange\(o\.order_number, 'PREPARING'\)\}/)
    const list = read('src/pages/seller-orders/MobileOrderList.tsx')
    expect(list).toMatch(/\{hot && onConfirm && \(/)
  })
  it('🔒 이용권 탭에 검은 그라디언트 카드가 돌아오지 않는다', () => {
    const page = read('src/pages/SellerGroupBuyPage.tsx')
    expect(page).not.toMatch(/from-gray-800|bg-gray-900/)
  })
  // 🩸 2026-09-14 CI(surface-role-leak 8건 · 빌드 경고 "Circular chunk: app-seller-components -> app-components"):
  //   `components/seller-layout/` 에 manualChunks 규칙이 없어 하단 탭·nav 모델이 generic `app-components` 로
  //   떨어졌고, 그 파일들이 `components/seller/seller-primary-nav` 를 import 해 순환이 생겨 상세·유어샵·교환권
  //   표면이 셀러 봉투(+app-dashboard)를 첫 페인트에 받았다. 에러 0·화면 정상 — 바이트만 샜다.
  it('🔒 components/seller-layout/ 는 셀러 봉투 규칙을 갖고, 그 규칙이 components/ catch-all 보다 앞에 있다', () => {
    const vite = readFileSync('vite.config.ts', 'utf8')
    const rule = vite.indexOf("id.includes('/src/components/seller-layout/')) return 'app-seller-components'")
    const catchAll = vite.indexOf("id.includes('/src/components/')) return 'app-components'")
    expect(rule, 'seller-layout 규칙이 없다').toBeGreaterThan(0)
    expect(catchAll, 'components catch-all 을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(0)
    expect(rule, 'seller-layout 규칙이 catch-all 뒤에 있어 닿지 않는다').toBeLessThan(catchAll)
  })
  it.each(['ko', 'en', 'ja', 'zh', 'es', 'fr'])('%s 로케일에 다섯 탭 이름이 있다', (lng) => {
    const j = JSON.parse(readFileSync(`public/locales/${lng}/translation.json`, 'utf8'))
    for (const k of ['home', 'orders', 'vouchers', 'settlements', 'more']) expect(j.seller?.tab?.[k], k).toBeTruthy()
  })
})
