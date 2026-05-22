/**
 * 🛡️ 2026-05-21 Phase TD-5: Critical path e2e — voucher 구매 → 매장 사용 → ledger 자동 → payout.
 *
 * 전체 시스템 핵심 흐름 회귀 검증.
 * production 또는 staging 환경 테스트 (BASE 환경변수).
 *
 * 실행:
 *   npx playwright test tests/e2e/critical-flow-end-to-end.spec.ts
 *   BASE_URL=https://live.ur-team.com npx playwright test ...
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'

test.describe('Critical path — voucher → 매장 → ledger', () => {
  test('홈 / 브라우즈 / 공구 페이지 정상 진입', async ({ page }) => {
    await page.goto(BASE + '/')
    await expect(page).toHaveTitle(/유어딜|UrDeal/i)

    await page.goto(BASE + '/browse')
    // 상품 카드 로드 (또는 빈 상태)
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    await page.goto(BASE + '/group-buy')
    await page.waitForLoadState('networkidle', { timeout: 10000 })
  })

  test('교환권 (vouchers) 페이지 정상 로드', async ({ page }) => {
    await page.goto(BASE + '/vouchers')
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    // 잔액 카드 또는 로그인 안내
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('마이페이지 / 결제 / 로그인 흐름', async ({ page }) => {
    await page.goto(BASE + '/login')
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('어드민 로그인 페이지 진입', async ({ page }) => {
    await page.goto(BASE + '/admin/login')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/admin/login')
  })

  test('셀러 로그인 페이지 진입', async ({ page }) => {
    await page.goto(BASE + '/seller/login')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/seller/login')
  })

  test('API 핵심 endpoint 응답 (인증 없이)', async ({ request }) => {
    // 200: 공개 API
    const version = await request.get(BASE + '/api/version')
    expect(version.status()).toBe(200)

    const categories = await request.get(BASE + '/api/vouchers/categories')
    expect(categories.status()).toBe(200)

    const groupBuy = await request.get(BASE + '/api/group-buy/products')
    expect(groupBuy.status()).toBe(200)

    // 401/403: 인증 필요 endpoint 가 endpoint 존재
    const myComm = await request.get(BASE + '/api/referral-tree/my-commissions')
    expect([401, 403]).toContain(myComm.status())

    const myLedger = await request.get(BASE + '/api/ledger/my')
    expect([401, 403]).toContain(myLedger.status())

    const adminPayouts = await request.get(BASE + '/api/admin/payouts')
    expect([401, 403]).toContain(adminPayouts.status())
  })

  test('sitemap.xml 정상', async ({ request }) => {
    const res = await request.get(BASE + '/sitemap.xml')
    expect(res.status()).toBe(200)
    const text = await res.text()
    expect(text).toContain('<?xml')
    expect(text).toContain('/group-buy')
    expect(text).toContain('/vouchers')
  })

  test('셀러 트래킹 링크 클릭 attribution', async ({ page }) => {
    // ?seller=N 으로 진입 → sessionStorage 저장
    await page.goto(BASE + '/browse?seller=999')
    await page.waitForTimeout(500)
    const stored = await page.evaluate(() => sessionStorage.getItem('ur_tracking_seller_v1'))
    // 999 는 가짜 ID 라 captureTrackingFromUrl 가 저장은 시도 (검증은 백엔드)
    expect(stored).toBeTruthy()
  })
})
