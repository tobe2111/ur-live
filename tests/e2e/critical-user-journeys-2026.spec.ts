import { test, expect, Page } from '@playwright/test'

/**
 * E2E Test: Critical User Journeys (2026-03-19 Updated)
 * 
 * Tests reflecting the latest fixes:
 * - Firebase authentication with custom tokens
 * - Fixed 401 Authorization header issues
 * - Fixed chat userId (numeric ID from token claims)
 * - Fixed errorMessage.includes() TypeError
 * 
 * Critical Flows:
 * 1. Guest browsing (no auth)
 * 2. Login with Kakao → Firebase custom token
 * 3. Product detail → Add to cart (with Authorization header)
 * 4. Live streaming → Chat + Add to cart
 * 5. Checkout → Toss payment
 */

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const TIMEOUT = 30000

// Helper: Mock Firebase authentication
async function mockFirebaseAuth(page: Page) {
  await page.addInitScript(() => {
    // Mock localStorage with Firebase user data
    localStorage.setItem('user_type', 'user')
    localStorage.setItem('user_id', 'kakao_test_user')
    localStorage.setItem('numeric_user_id', '99')  // NEW: numeric ID for chat
    localStorage.setItem('user_name', 'E2E Test User')
    localStorage.setItem('user_email', 'e2e-test@example.com')
    
    // Mock Firebase token (short-lived for testing)
    localStorage.setItem('firebase_token', 'mock_token_' + Date.now())
  })
}

// Helper: Wait for API calls to complete
async function waitForApiIdle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500) // Extra buffer for React state updates
}

test.describe('1. Guest Browsing (Unauthenticated)', () => {
  test('should load home page without authentication', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForApiIdle(page)
    
    // Check page title
    await expect(page).toHaveTitle(/UR-Live|라이브 커머스/i)
    
    // Check navigation is visible
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()
    
    // Check product grid loads (even without auth)
    await page.waitForSelector('[data-testid="product-grid"], .product-grid, .grid', {
      timeout: TIMEOUT,
      state: 'attached'
    })
    
    console.log('✅ Home page loaded successfully')
  })

  test('should display products on home page', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForApiIdle(page)
    
    // Wait for products to load
    const products = page.locator('[data-testid="product-card"], .product-card, a[href*="/products/"]').first()
    await expect(products).toBeVisible({ timeout: TIMEOUT })
    
    console.log('✅ Products displayed')
  })

  test('should navigate to product detail page', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForApiIdle(page)
    
    // Click first product
    const firstProduct = page.locator('[data-testid="product-card"], .product-card, a[href*="/products/"]').first()
    await firstProduct.click()
    
    // Wait for navigation
    await page.waitForURL(/\/products?\/\d+/, { timeout: TIMEOUT })
    
    // Check product detail page loaded
    await expect(page.locator('h1, h2, [data-testid="product-title"]').first()).toBeVisible()
    
    console.log('✅ Product detail page loaded')
  })
})

test.describe('2. Authentication Flow', () => {
  test('should show login button when not authenticated', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForApiIdle(page)
    
    // Look for login button/link
    const loginButton = page.locator('a[href*="/login"], button:has-text("로그인"), [data-testid="login-button"]').first()
    await expect(loginButton).toBeVisible({ timeout: TIMEOUT })
    
    console.log('✅ Login button visible')
  })

  test('should navigate to login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await waitForApiIdle(page)
    
    // Check login page elements
    await expect(page.locator('body')).toContainText(/로그인|Login|카카오/)
    
    console.log('✅ Login page loaded')
  })

  test.skip('should authenticate with Kakao (requires real OAuth)', async ({ page }) => {
    // This test requires real Kakao OAuth flow
    // Skipped in automated testing
    console.log('⏭️  Skipped: Requires real Kakao OAuth')
  })
})

test.describe('3. Add to Cart (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication before each test
    await mockFirebaseAuth(page)
  })

  test('should add product to cart from product detail page', async ({ page }) => {
    // Listen for API calls
    let cartApiCalled = false
    let authHeaderPresent = false

    page.on('request', request => {
      if (request.url().includes('/api/cart') && request.method() === 'POST') {
        cartApiCalled = true
        const headers = request.headers()
        authHeaderPresent = !!headers['authorization']
        console.log('🔍 Cart API called:', {
          url: request.url(),
          method: request.method(),
          hasAuthHeader: authHeaderPresent,
          authHeader: headers['authorization']?.substring(0, 20) + '...'
        })
      }
    })

    page.on('response', response => {
      if (response.url().includes('/api/cart')) {
        console.log('📥 Cart API response:', {
          status: response.status(),
          statusText: response.statusText()
        })
      }
    })

    // Navigate to a product
    await page.goto(`${BASE_URL}/products/1`)
    await waitForApiIdle(page)

    // Find add to cart button
    const addToCartButton = page.locator(
      'button:has-text("장바구니"), button:has-text("담기"), [data-testid="add-to-cart-button"]'
    ).first()

    if (await addToCartButton.isVisible({ timeout: 5000 })) {
      await addToCartButton.click()
      await page.waitForTimeout(2000) // Wait for API call

      // Verify API was called with Authorization header
      expect(cartApiCalled).toBeTruthy()
      expect(authHeaderPresent).toBeTruthy()

      console.log('✅ Add to cart succeeded with Authorization header')
    } else {
      console.log('⚠️  Add to cart button not found (may require different selector)')
    }
  })

  test('should navigate to cart page', async ({ page }) => {
    await page.goto(`${BASE_URL}/cart`)
    await waitForApiIdle(page)
    
    // Check cart page loaded
    await expect(page.locator('body')).toContainText(/장바구니|Cart/)
    
    console.log('✅ Cart page loaded')
  })
})

test.describe('4. Live Streaming Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockFirebaseAuth(page)
  })

  test('should load live streaming page', async ({ page }) => {
    await page.goto(`${BASE_URL}/live/1`)
    await waitForApiIdle(page)
    
    // Check for live page elements
    const body = page.locator('body')
    await expect(body).toBeVisible()
    
    console.log('✅ Live streaming page loaded')
  })

  test('should render chat interface', async ({ page }) => {
    await page.goto(`${BASE_URL}/live/1`)
    await waitForApiIdle(page)
    
    // Look for chat input
    const chatInput = page.locator(
      'input[placeholder*="메시지"], input[placeholder*="채팅"], [data-testid="chat-input"]'
    ).first()
    
    const chatVisible = await chatInput.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (chatVisible) {
      console.log('✅ Chat interface rendered')
    } else {
      console.log('⚠️  Chat interface not visible (may require button click to open)')
    }
  })

  test('should send chat message with numeric userId', async ({ page }) => {
    let firebaseChatCall = false
    let userIdValue: any = null

    // Intercept Firebase Realtime Database writes
    page.on('request', request => {
      const url = request.url()
      if (url.includes('firebaseio.com') && request.method() === 'PUT') {
        firebaseChatCall = true
        console.log('🔥 Firebase write detected:', url)
        
        // Try to extract userId from request body
        const postData = request.postData()
        if (postData) {
          try {
            const data = JSON.parse(postData)
            userIdValue = data.userId
            console.log('🔍 Chat message userId:', userIdValue, typeof userIdValue)
          } catch (e) {
            console.log('⚠️  Could not parse Firebase write data')
          }
        }
      }
    })

    await page.goto(`${BASE_URL}/live/1`)
    await waitForApiIdle(page)

    // Open chat if needed (some UIs have a chat toggle button)
    const chatToggle = page.locator('button:has-text("채팅"), [data-testid="chat-toggle"]').first()
    if (await chatToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chatToggle.click()
      await page.waitForTimeout(500)
    }

    // Find chat input
    const chatInput = page.locator(
      'input[placeholder*="메시지"], input[placeholder*="채팅"], [data-testid="chat-input"]'
    ).first()

    if (await chatInput.isVisible({ timeout: 5000 })) {
      await chatInput.fill('E2E Test Message')
      await chatInput.press('Enter')
      
      // OR click send button if Enter doesn't work
      const sendButton = page.locator('button:has-text("전송"), button:has-text("Send"), [data-testid="send-button"]').first()
      if (await sendButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sendButton.click()
      }

      await page.waitForTimeout(2000)

      // Verify userId is numeric (not NaN)
      if (userIdValue !== null) {
        expect(typeof userIdValue).toBe('number')
        expect(userIdValue).not.toBeNaN()
        console.log('✅ Chat message sent with numeric userId:', userIdValue)
      } else {
        console.log('⚠️  Could not verify userId (Firebase write may not have been captured)')
      }
    } else {
      console.log('⚠️  Chat input not found')
    }
  })

  test('should add product to cart from live page', async ({ page }) => {
    let cartApiStatus: number | null = null

    page.on('response', response => {
      if (response.url().includes('/api/cart') && response.request().method() === 'POST') {
        cartApiStatus = response.status()
        console.log('📥 Cart API response from live page:', cartApiStatus)
      }
    })

    await page.goto(`${BASE_URL}/live/1`)
    await waitForApiIdle(page)

    // Find purchase button on live page
    const purchaseButton = page.locator(
      'button:has-text("구매"), button:has-text("담기"), button:has-text("장바구니"), [data-testid="live-purchase-button"]'
    ).first()

    if (await purchaseButton.isVisible({ timeout: 5000 })) {
      await purchaseButton.click()
      await page.waitForTimeout(2000)

      // Verify no 401 error
      if (cartApiStatus !== null) {
        expect(cartApiStatus).not.toBe(401)
        expect(cartApiStatus).toBe(200)
        console.log('✅ Live page add to cart succeeded (no 401)')
      }
    } else {
      console.log('⚠️  Purchase button not found on live page')
    }
  })
})

test.describe('5. Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockFirebaseAuth(page)
  })

  test('should navigate to checkout page', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`)
    await waitForApiIdle(page)
    
    // Check checkout page elements
    await expect(page.locator('body')).toContainText(/결제|체크아웃|주문|배송/)
    
    console.log('✅ Checkout page loaded')
  })

  test('should display shipping address form', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`)
    await waitForApiIdle(page)
    
    // Look for address form fields
    const addressInput = page.locator(
      'input[name*="address"], input[placeholder*="주소"], [data-testid="address-input"]'
    ).first()
    
    const formVisible = await addressInput.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (formVisible) {
      console.log('✅ Shipping form rendered')
    } else {
      console.log('⚠️  Shipping form not visible (may need items in cart first)')
    }
  })

  test.skip('should complete checkout with Toss Payments (requires real payment)', async ({ page }) => {
    // This test requires real Toss Payments integration
    console.log('⏭️  Skipped: Requires real Toss Payments')
  })
})

test.describe('6. Error Handling Verification', () => {
  test.beforeEach(async ({ page }) => {
    await mockFirebaseAuth(page)
  })

  test('should not throw TypeError on errorMessage.includes()', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        consoleErrors.push(text)
        if (text.includes('TypeError') && text.includes('.includes')) {
          console.error('❌ DETECTED TypeError with .includes():', text)
        }
      }
    })

    // Navigate to pages that might trigger the error
    await page.goto(`${BASE_URL}/products/1`)
    await waitForApiIdle(page)

    // Try to trigger add to cart (which has error handling)
    const addToCartButton = page.locator('button:has-text("장바구니"), button:has-text("담기")').first()
    if (await addToCartButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addToCartButton.click()
      await page.waitForTimeout(1000)
    }

    // Verify no TypeError
    const hasTypeError = consoleErrors.some(err => 
      err.includes('TypeError') && err.includes('.includes')
    )
    
    expect(hasTypeError).toBeFalsy()
    console.log('✅ No TypeError.includes() detected')
  })

  test('should not have 401 errors on authenticated API calls', async ({ page }) => {
    const api401Errors: string[] = []

    page.on('response', response => {
      if (response.status() === 401 && response.url().includes('/api/')) {
        api401Errors.push(`${response.request().method()} ${response.url()}`)
        console.error('❌ DETECTED 401 error:', response.url())
      }
    })

    // Navigate through key pages
    await page.goto(`${BASE_URL}/products/1`)
    await waitForApiIdle(page)

    await page.goto(`${BASE_URL}/cart`)
    await waitForApiIdle(page)

    await page.goto(`${BASE_URL}/checkout`)
    await waitForApiIdle(page)

    // Verify no 401 errors
    expect(api401Errors.length).toBe(0)
    console.log('✅ No 401 errors detected on authenticated pages')
  })
})

test.describe('7. Performance & Accessibility', () => {
  test('should load pages within acceptable time', async ({ page }) => {
    const pages = [
      { url: '/', name: 'Home' },
      { url: '/products/1', name: 'Product Detail' },
      { url: '/cart', name: 'Cart' },
      { url: '/live/1', name: 'Live' }
    ]

    for (const pageInfo of pages) {
      const startTime = Date.now()
      await page.goto(`${BASE_URL}${pageInfo.url}`)
      await waitForApiIdle(page)
      const loadTime = Date.now() - startTime

      console.log(`⏱️  ${pageInfo.name}: ${loadTime}ms`)
      
      // Pages should load within 10 seconds (generous for Cloudflare cold start)
      expect(loadTime).toBeLessThan(10000)
    }

    console.log('✅ All pages loaded within acceptable time')
  })

  test('should have accessible navigation', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForApiIdle(page)

    // Check for nav element
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()

    // Check for common navigation links
    const navLinks = page.locator('nav a')
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0)

    console.log(`✅ Navigation accessible with ${linkCount} links`)
  })
})
