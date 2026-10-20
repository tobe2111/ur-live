// ============================================================
// E2E Smoke Tests — Phase 1+2+3 신규 라우트 라우팅 검증
// ============================================================
//
// 목적: 신규 페이지가 404 없이 로드되는지 + 인증 가드 작동 확인.
// (실제 기능 테스트는 unit 또는 integration 으로)

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe('신규 라우트 — 인증 가드 작동', () => {
  test('비인증 → /agency/pk 접근 시 로그인 페이지 또는 401', async ({ page }) => {
    await page.goto(`${BASE_URL}/agency/pk`)
    // 비인증 시 /agency/login 으로 redirect 또는 로그인 화면 표시
    await page.waitForLoadState('networkidle')
    // 인증 가드가 작동하면 URL 이 /agency/login 으로 가거나 로그인 폼이 보여야 함
    const url = page.url()
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0
    expect(url.includes('/login') || hasLoginForm).toBeTruthy()
  })

  test('비인증 → /agency/transfers 인증 가드', async ({ page }) => {
    await page.goto(`${BASE_URL}/agency/transfers`)
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0
    expect(url.includes('/login') || hasLoginForm).toBeTruthy()
  })

  test('비인증 → /agency/invites 인증 가드', async ({ page }) => {
    await page.goto(`${BASE_URL}/agency/invites`)
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0
    expect(url.includes('/login') || hasLoginForm).toBeTruthy()
  })

  test('비인증 → /seller/castings 인증 가드', async ({ page }) => {
    await page.goto(`${BASE_URL}/seller/castings`)
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0
    expect(url.includes('/login') || hasLoginForm).toBeTruthy()
  })

  test('비인증 → /admin/castings 인증 가드', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/castings`)
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0
    expect(url.includes('/login') || hasLoginForm).toBeTruthy()
  })

  test('비인증 → /admin/tiktok-discovery 인증 가드', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/tiktok-discovery`)
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0
    expect(url.includes('/login') || hasLoginForm).toBeTruthy()
  })
})

test.describe('공개 페이지 — 인증 없이 접근 가능', () => {
  test('/a/<slug> 공개 페이지: 존재하지 않는 slug → 404 메시지', async ({ page }) => {
    await page.goto(`${BASE_URL}/a/nonexistent-test-slug-xyz`)
    await page.waitForLoadState('networkidle')
    // 404 메시지 또는 "찾을 수 없습니다" 텍스트 보여야 함
    const text = await page.locator('body').textContent()
    expect(text).toMatch(/찾을 수 없|에이전시.*없|not found|404|🤔/i)
  })

  test('/seller/register?invite=INVALID — 가입 폼 자체는 로드됨', async ({ page }) => {
    await page.goto(`${BASE_URL}/seller/register?invite=INVALIDTESTCODE12345`)
    await page.waitForLoadState('networkidle')
    // 가입 폼 input 들이 보여야 함
    const inputs = await page.locator('input[type="email"], input[type="text"]').count()
    expect(inputs).toBeGreaterThan(0)
  })
})

test.describe('PWA — Service Worker 등록 확인 (PROD only)', () => {
  test.skip(process.env.NODE_ENV !== 'production', 'PWA SW 는 PROD 빌드에서만 활성')

  test('SW 가 /sw.js 에서 등록 가능', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    // 5초 대기 (SW register 시간)
    await page.waitForTimeout(5000)

    const swRegistered = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations()
      return regs.some(r => r.active?.scriptURL.endsWith('/sw.js'))
    })
    expect(swRegistered).toBe(true)
  })
})
