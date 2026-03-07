# E2E Testing Guide

## Overview
This document explains the end-to-end (E2E) testing setup for the UR-Live E-Commerce platform using Playwright.

## Prerequisites
- Node.js 18+
- Playwright installed (`@playwright/test`)
- Development server running

## Test Setup

### Installation
```bash
npm install -D @playwright/test@latest
npx playwright install chromium
```

### Configuration
The E2E tests are configured in `playwright.config.ts`:
- **Test directory**: `./tests/e2e`
- **Base URL**: `http://localhost:5173`
- **Timeout**: 30 seconds per test
- **Browsers**: Chromium (default), Firefox, and WebKit available
- **CI settings**: Retries on CI, single worker for stability

## Running E2E Tests

### Development
```bash
# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug

# Generate test code
npm run test:e2e:codegen
```

### CI/Production
```bash
# Run all E2E tests
npm run test:e2e

# Run with HTML reporter
npm run test:e2e:ci

# View test report
npm run test:e2e:report
```

## Test Structure

### Critical User Flows
The E2E tests cover the most important user journeys:

#### 1. Product Discovery
- Home page loading and product display
- Navigation to product detail pages
- Product information visibility

#### 2. Search Functionality
- Search input interaction
- Search results display
- Product filtering

#### 3. Cart Management
- Navigate to cart page
- Empty cart state
- Cart item management

#### 4. Navigation
- Page-to-page navigation
- Mobile responsive navigation
- Bottom navigation bar

#### 5. Performance
- Page load times
- Core Web Vitals
- Image loading

## Writing E2E Tests

### Basic Test Pattern
```typescript
import { test, expect } from '@playwright/test'

test('should perform user action', async ({ page }) => {
  // Navigate to page
  await page.goto('/')
  
  // Wait for page to load
  await page.waitForLoadState('networkidle')
  
  // Interact with elements
  await page.click('[data-testid="button"]')
  
  // Assert expectations
  await expect(page.locator('h1')).toBeVisible()
})
```

### Best Practices

#### 1. Use Data Test IDs
```tsx
// Component
<button data-testid="add-to-cart">Add to Cart</button>

// Test
await page.click('[data-testid="add-to-cart"]')
```

#### 2. Wait for Network Idle
```typescript
await page.waitForLoadState('networkidle')
```

#### 3. Use Assertions Wisely
```typescript
// Good: Wait for element
await expect(page.locator('h1')).toBeVisible()

// Bad: Direct check without waiting
expect(await page.locator('h1').isVisible()).toBe(true)
```

#### 4. Handle Dynamic Content
```typescript
// Wait for specific content
await page.waitForSelector('text=Product loaded')

// Or use retry logic
await expect(page.locator('[data-testid="product"]')).toBeVisible({ timeout: 10000 })
```

## Test Organization

### File Structure
```
tests/
└── e2e/
    ├── critical-flows.spec.ts   # Main user journeys
    ├── checkout.spec.ts          # Checkout process
    ├── authentication.spec.ts    # Login/logout flows
    └── mobile.spec.ts            # Mobile-specific tests
```

### Test Naming Convention
```typescript
describe('Feature Name', () => {
  test('should do something specific', async ({ page }) => {
    // Test implementation
  })
})
```

## Debugging

### Visual Debugging
```bash
# Run with headed browser
npm run test:e2e:headed

# Run with UI mode (recommended)
npm run test:e2e:ui

# Debug specific test
npm run test:e2e:debug -- tests/e2e/critical-flows.spec.ts
```

### Screenshots and Videos
- Screenshots are captured on failure (configured in `playwright.config.ts`)
- Videos are retained on failure
- Find artifacts in `test-results/` directory

### Traces
```bash
# View trace for failed test
npx playwright show-trace test-results/[test-name]/trace.zip
```

## CI Integration

### GitHub Actions Example
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e:ci

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Performance Testing

### Load Time Assertions
```typescript
test('should load page within 5 seconds', async ({ page }) => {
  const startTime = Date.now()
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const loadTime = Date.now() - startTime
  expect(loadTime).toBeLessThan(5000)
})
```

### Core Web Vitals
```typescript
test('should have good Core Web Vitals', async ({ page }) => {
  await page.goto('/')
  const metrics = await page.evaluate(() => JSON.stringify(window.performance.timing))
  // Analyze metrics
})
```

## Troubleshooting

### Common Issues

#### 1. Test Flakiness
- Use `waitForLoadState('networkidle')` before interactions
- Add explicit waits for dynamic content
- Increase timeouts for slow operations

#### 2. Element Not Found
- Verify selector is correct
- Check if element is in viewport
- Wait for element to be visible/enabled

#### 3. Test Timeout
- Increase timeout in test or config
- Check if page is actually loading
- Verify network connectivity

### Tips
1. **Run tests locally first** before pushing to CI
2. **Use UI mode** for debugging test failures
3. **Keep tests independent** - each test should work in isolation
4. **Mock external services** when possible to improve reliability
5. **Use page object model** for complex pages

## Future Improvements

### Short-term (1-2 weeks)
- [ ] Add checkout flow tests
- [ ] Test authentication flows
- [ ] Add mobile-specific tests
- [ ] Implement visual regression testing

### Long-term (1-2 months)
- [ ] Add performance monitoring
- [ ] Implement API testing
- [ ] Add accessibility testing (with axe-core)
- [ ] Cross-browser testing (Firefox, WebKit)

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI Configuration](https://playwright.dev/docs/ci)

## Support

For questions or issues:
- Check this documentation first
- Review existing tests in `tests/e2e/`
- Consult Playwright documentation
- Ask the development team
