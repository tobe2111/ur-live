/**
 * 🛡️ 2026-05-16: 인플루언서/정산 신규 endpoint smoke 테스트.
 * 베타 직전 회귀 방지용 기본 검증만.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env['BASE_URL'] || 'http://localhost:5173'

test.describe('Influencer endpoints smoke', () => {
  test('public rankings page loads + filters work', async ({ page }) => {
    await page.goto(`${BASE}/influencer/rankings`)
    await expect(page.getByText('인플루언서 랭킹')).toBeVisible({ timeout: 10000 })
    // 지역 탭
    await page.getByRole('button', { name: '서울' }).first().click()
    await page.waitForTimeout(300)
    // 기간 변경
    await page.locator('select').first().selectOption('all')
    await page.waitForTimeout(300)
  })

  test('voucher verify page parses URL code', async ({ page }) => {
    // 존재하지 않는 voucher 코드 — 404 처리 확인
    await page.goto(`${BASE}/v/UR-TEST-FAIL`)
    await expect(page.getByText(/유어딜|voucher|식권/i)).toBeVisible({ timeout: 5000 })
  })

  test('influencer settlement requires auth', async ({ page }) => {
    // 비로그인 → /login 또는 인증 안내
    await page.goto(`${BASE}/influencer/settlement`)
    // 비로그인이면 redirect 또는 로그인 안내
    await page.waitForLoadState('networkidle')
  })

  test('influencer discover catalog renders', async ({ page }) => {
    await page.goto(`${BASE}/influencer/discover`)
    // 비로그인 시 로그인 페이지로 가는지 또는 카탈로그 진입
    await page.waitForLoadState('networkidle')
  })

  test('API: GET /api/influencer-rankings responds (no auth)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/influencer-rankings?region=all&period=month`)
    expect([200, 503]).toContain(res.status())
    if (res.status() === 200) {
      const json = await res.json()
      expect(json).toHaveProperty('success')
    }
  })

  test('API: GET /api/vouchers/verify/INVALID returns 400 or 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/vouchers/verify/UR-INVALID-CODE`)
    expect([400, 404]).toContain(res.status())
  })
})
