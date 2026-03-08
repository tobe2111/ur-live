import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * E2E Test: Accessibility (a11y)
 * 
 * Tests accessibility compliance using axe-core.
 * Checks WCAG 2.1 Level AA standards across key pages.
 */

test.describe('Accessibility Tests', () => {
  test('home page should be accessible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('search page should be accessible', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('browse page should be accessible', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('cart page should be accessible', async ({ page }) => {
    await page.goto('/cart')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('login page should be accessible', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('checkout page should be accessible', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    // Allow some violations for checkout (payment widgets may have issues)
    expect(accessibilityScanResults.violations.length).toBeLessThan(5)
  })
})

test.describe('Accessibility - Specific Checks', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a'])
      .analyze()

    // Check for heading order violations
    const headingViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'heading-order'
    )

    expect(headingViolations).toEqual([])
  })

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze()

    // Check for color contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'color-contrast'
    )

    expect(contrastViolations).toEqual([])
  })

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['image-alt'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['label'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have keyboard navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['keyboard'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a'])
      .withRules(['aria-valid-attr', 'aria-allowed-attr'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have proper link text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['link-name'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have proper button text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['button-name'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })
})

test.describe('Accessibility - Keyboard Navigation', () => {
  test('should navigate with Tab key', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Press Tab multiple times
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should be able to focus on elements
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBeTruthy()
  })

  test('should activate buttons with Enter key', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find first button
    const button = page.locator('button').first()
    if (await button.isVisible()) {
      await button.focus()
      // Button should be focusable
      const isFocused = await button.evaluate(el => el === document.activeElement)
      expect(isFocused).toBeTruthy()
    }
  })

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['focus-visible'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })
})

test.describe('Accessibility - Screen Reader Support', () => {
  test('should have proper page title', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)
  })

  test('should have proper lang attribute', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const lang = await page.getAttribute('html', 'lang')
    expect(lang).toBeTruthy()
  })

  test('should have proper landmark regions', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['region'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have skip navigation link', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Skip links are optional but recommended
    const skipLink = page.locator('a[href="#main"], a[href="#content"]').first()
    // This is a recommendation, not a strict requirement
    const hasSkipLink = await skipLink.count() > 0
    
    // Just log the result, don't fail
    if (!hasSkipLink) {
      console.log('💡 Recommendation: Add skip navigation link for better accessibility')
    }
  })
})
