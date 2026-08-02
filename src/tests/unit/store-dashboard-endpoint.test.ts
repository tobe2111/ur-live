/**
 * 🔴 **매장 종합 대시보드가 없는 주소를 부르고 있었다** (2026-08-02)
 *
 * `StoreOwnerDashboardPage` 는 `/api/seller/store-dashboard/stats` 를 불렀는데,
 * 핸들러는 `sellerAnalyticsRoutes` 안에 있고 그 라우터는 **`/api/seller/analytics`** 에 마운트된다.
 * 즉 실제 주소엔 `analytics` 가 들어간다 — **호출은 404 였다.**
 *
 * ## 왜 아무도 몰랐나
 * 이 화면은 **nav 어디에서도 도달할 수 없다**(orphan baseline 등재). 밟는 사람이 없으니
 * 404 도 안 보였다. *"실패가 아니라 조용한 부재"* 가 **버그를 숨기는** 형태로 나타난 사례다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 같은 클래스의 **다른** 화면(페이지→API 경로 전수 검증은 각 라우터의 하위 경로를 해석해야 해서
 *     문자열 비교로는 불가. prefix 매칭은 `/api/seller` 에 걸려 **이 버그를 못 잡는다** — 실측 확인)
 *   - 이 화면이 **실제로 유용한지**(링크 여부는 대표 판단 — 셀러 nav 는 2026-07-19 확정으로 간소화됨)
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'

const page = readCode('src/pages/StoreOwnerDashboardPage.tsx')
const routes = readCode('src/features/seller/api/seller-analytics.routes.ts')
const worker = readRaw('src/worker/index.ts')

describe('🔴 매장 대시보드 통계 주소', () => {
  it('페이지가 analytics 를 포함한 주소를 부른다', () => {
    expect(page).toContain("'/api/seller/analytics/store-dashboard/stats'")
  })

  it('🔴 analytics 없는 옛 주소로 되돌아가지 않는다 — 그게 404 였다', () => {
    expect(page).not.toContain("'/api/seller/store-dashboard/stats'")
  })

  it('핸들러가 그 자리에 실재한다 (라우터 + 마운트 두 조각을 모두 확인)', () => {
    expect(routes).toContain("get('/store-dashboard/stats'")
    // 마운트 경로가 바뀌면 위 호출도 같이 바뀌어야 한다 — 한쪽만 고치면 다시 404 다.
    expect(worker).toMatch(/^app\.route\('\/api\/seller\/analytics', sellerAnalyticsRoutes\);/m)
  })
})
