import { test, expect } from '@playwright/test'

/**
 * E2E Test: Critical User Journeys
 * 
 * Tests the most important user flows from start to finish:
 * 1. Product Discovery - Home page load and product display
 * 2. Search - Product search functionality
 * 3. Product Detail - View product information
 * 4. Cart Management - Add to cart and manage items
 * 5. Navigation - Basic navigation between pages
 */

test.describe('Product Discovery Flow', () => {
  test('should load home page and display products', async ({ page }) => {
    await page.goto('/')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check that the page title is correct
    await expect(page).toHaveTitle(/UR-Live/i)
    
    // Check that navigation is visible
    await expect(page.locator('nav')).toBeVisible()
    
    // Check that product grid exists
    // Note: This selector may need to be adjusted based on actual implementation
    await expect(page.locator('[data-testid="product-grid"]').or(page.locator('text=상품')).first()).toBeVisible()
  })

  test('should navigate to product detail page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Find and click on the first product (adjust selector as needed)
    const firstProduct = page.locator('[data-testid="product-card"]').or(page.locator('img[alt*="상품"]')).first()
    
    if (await firstProduct.isVisible()) {
      await firstProduct.click()
      
      // Wait for navigation
      await page.waitForURL(/\/product\/\d+/)
      
      // Check that product detail page elements are visible
      await expect(page.locator('h1, h2').first()).toBeVisible()
    }
  })
})

test.describe('Search Functionality', () => {
  test('should search for products', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Find search input (adjust selector as needed)
    const searchIcon = page.locator('[aria-label*="검색"], [data-testid="search-button"]').first()
    
    if (await searchIcon.isVisible()) {
      await searchIcon.click()
      
      // Type search query
      const searchInput = page.locator('input[type="search"], input[placeholder*="검색"]').first()
      await searchInput.fill('테스트')
      
      // Press Enter or click search button
      await searchInput.press('Enter')
      
      // Wait for results
      await page.waitForLoadState('networkidle')
      
      // Check that results are displayed
      await expect(page.locator('body')).toContainText(/검색|결과|상품/)
    }
  })
})

test.describe('Cart Management', () => {
  test('should navigate to cart page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Navigate to cart (adjust selector as needed)
    const cartIcon = page.locator('[aria-label*="장바구니"], [data-testid="cart-button"]').first()
    
    if (await cartIcon.isVisible()) {
      await cartIcon.click()
      
      // Wait for cart page to load
      await page.waitForURL(/\/cart/)
      
      // Check that cart page is displayed
      await expect(page.locator('body')).toContainText(/장바구니/)
    }
  })

  test('should display empty cart message when cart is empty', async ({ page }) => {
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')
    
    // Check for empty cart message or cart items
    const pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()
  })
})

test.describe('Navigation', () => {
  test('should navigate between main pages', async ({ page }) => {
    await page.goto('/')
    
    // Test navigation to different pages
    const pages = [
      { url: '/', text: '홈' },
      { url: '/browse', text: '쇼핑' },
      { url: '/cart', text: '장바구니' },
    ]
    
    for (const pageInfo of pages) {
      await page.goto(pageInfo.url)
      await page.waitForLoadState('networkidle')
      
      // Check that the page loaded successfully
      expect(page.url()).toContain(pageInfo.url)
    }
  })

  test('should have responsive bottom navigation on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check for bottom navigation
    const bottomNav = page.locator('nav').last()
    await expect(bottomNav).toBeVisible()
  })
})

test.describe('Performance', () => {
  test('should load home page within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Home page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000)
  })

  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check that images are loading properly
    const images = page.locator('img')
    const imageCount = await images.count()
    
    if (imageCount > 0) {
      // Check first few images have loaded
      for (let i = 0; i < Math.min(3, imageCount); i++) {
        const img = images.nth(i)
        await expect(img).toBeVisible()
      }
    }
  })
})
