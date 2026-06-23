import { test, expect, type Locator } from '@playwright/test'

/**
 * 🛡️ 2026-06-22 모바일 뷰포트 스모크 — "하단 잘림 / 네비 실종" 부류 회귀를 *실제 동작*으로 차단.
 *
 * 정적검사/단위테스트가 못 잡는 것: 원인이 CSS든 JS든(예: keyboard-open stuck, 100vh, min-h-0 누락)
 *   결과적으로 "하단 네비가 안 보임 / 적용 버튼이 화면 밖" 인지 = 레이아웃을 실제로 렌더해 봐야 안다.
 *   → 모바일 뷰포트로 핵심 페이지를 띄워 핵심 요소가 *뷰포트 안에 보이는지* 검증.
 *
 * 실행: npm run test:e2e:mobile  (webServer = vite dev, playwright.config.ts)
 */

const MOBILE = { width: 390, height: 844 }
test.use({ viewport: MOBILE })

async function expectWithinViewport(el: Locator, vpHeight: number) {
  await expect(el).toBeVisible()
  const box = await el.boundingBox()
  expect(box, '요소의 boundingBox 가 있어야 함').not.toBeNull()
  // 요소가 뷰포트 세로 범위 안(±2px 여유)에 있어야 함 — 화면 밖으로 밀리면 실패.
  expect(box!.y).toBeGreaterThanOrEqual(-2)
  expect(box!.y + box!.height).toBeLessThanOrEqual(vpHeight + 2)
}

test.describe('모바일 뷰포트 스모크', () => {
  test('홈(/): 하단 네비가 화면 안에 보인다', async ({ page }) => {
    await page.goto('/')
    // 하단 네비(BottomNav) — keyboard-open stuck / display:none 회귀 시 사라져 실패.
    await expectWithinViewport(page.getByTestId('bottom-nav'), MOBILE.height)
  })

  test('동네딜 지도(/restaurant-map): 하단 네비 + 필터 적용 버튼이 화면 안에 도달한다', async ({ page }) => {
    await page.goto('/restaurant-map')

    // 1) 하단 네비 보임
    await expectWithinViewport(page.getByTestId('bottom-nav'), MOBILE.height)

    // 2) 필터 팝업 열고 → '적용' 버튼이 화면 안에 보임 (min-h-0 누락 시 footer 가 밀려 안 보임)
    await page.getByTestId('open-filter').click()
    await expectWithinViewport(page.getByTestId('filter-apply'), MOBILE.height)
  })
})
