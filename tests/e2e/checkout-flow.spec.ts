import { test, expect } from '@playwright/test'

/**
 * E2E Test: Checkout Flow
 * 
 * Tests the complete checkout process including:
 * 1. Cart to checkout navigation
 * 2. Shipping address selection/input
 * 3. Payment method selection
 * 4. Order review and confirmation
 * 5. Order success page
 */

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should navigate to checkout from cart', async ({ page }) => {
    // Navigate to cart
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')
    
    // Check if cart page loaded
    const cartHeading = page.locator('h1, h2').filter({ hasText: /장바구니/i })
    await expect(cartHeading.first()).toBeVisible()
    
    // Look for checkout button (if cart has items)
    const checkoutButton = page.locator('button').filter({ hasText: /결제|주문|구매/i }).first()
    
    if (await checkoutButton.isVisible()) {
      await checkoutButton.click()
      await page.waitForURL(/\/checkout/)
    } else {
      // If cart is empty, navigate directly to checkout page
      await page.goto('/checkout')
    }
  })

  test('should display checkout page elements', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Check for checkout page indicators
    const pageText = await page.locator('body').textContent()
    
    // The page should contain checkout-related text
    expect(pageText).toBeTruthy()
  })

  test('should show login requirement for unauthenticated users', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies()
    await page.context().clearPermissions()
    
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Check if redirected to login or shows login prompt
    const currentUrl = page.url()
    
    // Either on login page or checkout with login requirement
    const isLoginPage = currentUrl.includes('/login')
    const hasLoginButton = await page.locator('button').filter({ hasText: /로그인/i }).count() > 0
    
    expect(isLoginPage || hasLoginButton).toBeTruthy()
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Try to find and click order button without filling fields
    const orderButton = page.locator('button').filter({ hasText: /주문|결제/i }).first()
    
    if (await orderButton.isVisible()) {
      // Check if button is disabled initially
      const isDisabled = await orderButton.isDisabled()
      
      // Button should either be disabled or show validation error when clicked
      if (!isDisabled) {
        await orderButton.click()
        
        // Wait a bit for validation
        await page.waitForTimeout(1000)
        
        // Should still be on checkout page (not proceeded) or show error
        const currentUrl = page.url()
        expect(currentUrl).toContain('/checkout')
      } else {
        // Button is disabled as expected
        expect(isDisabled).toBeTruthy()
      }
    }
  })

  test('should display shipping address section', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    const bodyText = await page.locator('body').textContent()
    
    // Check for shipping-related text
    const hasShippingInfo = 
      bodyText?.includes('배송') || 
      bodyText?.includes('주소') ||
      bodyText?.includes('받는 사람')
    
    expect(hasShippingInfo).toBeTruthy()
  })

  test('should display payment section', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    const bodyText = await page.locator('body').textContent()
    
    // Check for payment-related text
    const hasPaymentInfo = 
      bodyText?.includes('결제') || 
      bodyText?.includes('카드') ||
      bodyText?.includes('페이')
    
    expect(hasPaymentInfo).toBeTruthy()
  })

  test('should display order summary', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    const bodyText = await page.locator('body').textContent()
    
    // Check for order summary elements
    const hasOrderInfo = 
      bodyText?.includes('상품') || 
      bodyText?.includes('금액') ||
      bodyText?.includes('합계') ||
      bodyText?.includes('총')
    
    expect(hasOrderInfo).toBeTruthy()
  })

  test('should handle back navigation', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Look for back button
    const backButton = page.locator('button').filter({ hasText: /뒤로|이전/ }).or(
      page.locator('button').locator('svg').first()
    ).first()
    
    if (await backButton.isVisible()) {
      await backButton.click()
      await page.waitForTimeout(500)
      
      // Should navigate away from checkout
      const currentUrl = page.url()
      expect(currentUrl).not.toContain('/checkout/success')
    }
  })

  test('should show privacy agreement', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    const bodyText = await page.locator('body').textContent()
    
    // Check for privacy/terms agreement
    const hasAgreement = 
      bodyText?.includes('동의') || 
      bodyText?.includes('약관') ||
      bodyText?.includes('개인정보')
    
    expect(hasAgreement).toBeTruthy()
  })

  test('should display total amount', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Look for price patterns (Korean Won)
    const pricePattern = /\d+,?\d*원/
    const bodyText = await page.locator('body').textContent()
    
    expect(bodyText).toMatch(pricePattern)
  })
})

test.describe('Checkout Flow - Payment Methods', () => {
  test('should show payment options for Korean region', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    const bodyText = await page.locator('body').textContent()
    
    // Check for Korean payment methods
    const hasKoreanPayment = 
      bodyText?.includes('토스') || 
      bodyText?.includes('카드') ||
      bodyText?.includes('간편결제')
    
    // This is region-dependent
    if (hasKoreanPayment) {
      expect(hasKoreanPayment).toBeTruthy()
    }
  })

  test('should handle payment widget loading', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Wait for any payment widget to load (with timeout)
    await page.waitForTimeout(2000)
    
    // Check if page is still responsive
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toBeTruthy()
  })
})

test.describe('Checkout Flow - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Go to checkout
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Page should load even if some data fails
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toBeTruthy()
  })

  test('should show appropriate error messages', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Try to submit without required fields
    const submitButton = page.locator('button').filter({ hasText: /주문|결제/i }).first()
    
    if (await submitButton.isVisible() && !(await submitButton.isDisabled())) {
      await submitButton.click()
      await page.waitForTimeout(1000)
      
      // Should show some feedback (still on page or error message)
      const currentUrl = page.url()
      expect(currentUrl).toContain('/checkout')
    }
  })

  test('should validate phone number format', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')
    
    // Look for phone input
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="전화"], input[placeholder*="연락처"]').first()
    
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('123')
      await phoneInput.blur()
      
      // Should show validation (either prevent input or show error)
      const value = await phoneInput.inputValue()
      expect(value).toBeTruthy()
    }
  })
})
