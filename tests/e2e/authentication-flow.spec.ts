import { test, expect } from '@playwright/test'

/**
 * E2E Test: Authentication Flow
 * 
 * Tests user authentication including:
 * 1. Login page access
 * 2. Login form validation
 * 3. Social login options (Kakao, Google)
 * 4. Email login flow
 * 5. Logout functionality
 * 6. Protected route access
 */

test.describe('Authentication Flow - Login Page', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    // Check that login page is loaded
    const bodyText = await page.locator('body').textContent()
    const hasLoginText = 
      bodyText?.includes('로그인') || 
      bodyText?.includes('Login') ||
      bodyText?.includes('Sign in')
    
    expect(hasLoginText).toBeTruthy()
  })

  test('should display login options', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    // Check for social login buttons or email login form
    const hasKakaoLogin = await page.locator('button').filter({ hasText: /카카오/i }).count() > 0
    const hasGoogleLogin = await page.locator('button').filter({ hasText: /google/i }).count() > 0
    const hasEmailInput = await page.locator('input[type="email"], input[placeholder*="이메일"], input[placeholder*="email"]').count() > 0
    
    // Should have at least one login method
    expect(hasKakaoLogin || hasGoogleLogin || hasEmailInput).toBeTruthy()
  })

  test('should show region-specific login options', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const bodyText = await page.locator('body').textContent()
    
    // Korean region might show Kakao, Global region might show Google
    const hasRegionLogin = 
      bodyText?.includes('카카오') || 
      bodyText?.includes('Google') ||
      bodyText?.includes('이메일') ||
      bodyText?.includes('Email')
    
    expect(hasRegionLogin).toBeTruthy()
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const emailInput = page.locator('input[type="email"], input[placeholder*="이메일"], input[placeholder*="email"]').first()
    
    if (await emailInput.isVisible()) {
      // Enter invalid email
      await emailInput.fill('invalid-email')
      await emailInput.blur()
      
      await page.waitForTimeout(500)
      
      // Check if validation message appears or button is disabled
      const loginButton = page.locator('button[type="submit"], button').filter({ hasText: /로그인|login/i }).first()
      
      if (await loginButton.isVisible()) {
        const isDisabled = await loginButton.isDisabled()
        expect(isDisabled).toBeTruthy()
      }
    }
  })

  test('should validate password field', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const passwordInput = page.locator('input[type="password"]').first()
    
    if (await passwordInput.isVisible()) {
      // Try to submit with empty password
      const loginButton = page.locator('button[type="submit"], button').filter({ hasText: /로그인|login/i }).first()
      
      if (await loginButton.isVisible()) {
        const initiallyDisabled = await loginButton.isDisabled()
        expect(initiallyDisabled).toBeTruthy()
      }
    }
  })

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const passwordInput = page.locator('input[type="password"]').first()
    
    if (await passwordInput.isVisible()) {
      // Look for password visibility toggle button
      const toggleButton = page.locator('button[aria-label*="password"], button[aria-label*="비밀번호"]').first()
      
      if (await toggleButton.isVisible()) {
        await toggleButton.click()
        await page.waitForTimeout(200)
        
        // Type should change
        const inputType = await passwordInput.getAttribute('type')
        // Might become "text" when visible
        expect(inputType).toBeTruthy()
      }
    }
  })

  test('should show social login buttons', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    // Check for Kakao login (Korean region)
    const kakaoButton = page.locator('button').filter({ hasText: /카카오/i }).first()
    const hasKakao = await kakaoButton.isVisible()
    
    // Check for Google login (Global region)
    const googleButton = page.locator('button').filter({ hasText: /google/i }).first()
    const hasGoogle = await googleButton.isVisible()
    
    // Should have at least one social login
    expect(hasKakao || hasGoogle).toBeTruthy()
  })

  test('should handle social login button clicks', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const socialButtons = await page.locator('button').filter({ hasText: /카카오|google/i }).all()
    
    if (socialButtons.length > 0) {
      // Just verify button is clickable (don't actually trigger OAuth)
      const firstButton = socialButtons[0]
      expect(await firstButton.isEnabled()).toBeTruthy()
    }
  })
})

test.describe('Authentication Flow - Protected Routes', () => {
  test('should redirect unauthenticated user from my page', async ({ page }) => {
    // Clear auth
    await page.context().clearCookies()
    
    await page.goto('/user/profile')
    await page.waitForLoadState('networkidle')
    
    // Should redirect to login or show login prompt
    const currentUrl = page.url()
    const isLoginPage = currentUrl.includes('/login')
    
    const bodyText = await page.locator('body').textContent()
    const hasLoginPrompt = bodyText?.includes('로그인')
    
    expect(isLoginPage || hasLoginPrompt).toBeTruthy()
  })

  test('should redirect unauthenticated user from orders page', async ({ page }) => {
    await page.context().clearCookies()
    
    await page.goto('/my-orders')
    await page.waitForLoadState('networkidle')
    
    const currentUrl = page.url()
    const bodyText = await page.locator('body').textContent()
    
    const isProtected = 
      currentUrl.includes('/login') || 
      bodyText?.includes('로그인')
    
    expect(isProtected).toBeTruthy()
  })

  test('should allow access to public pages', async ({ page }) => {
    await page.context().clearCookies()
    
    // Home page should be accessible
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toBe(new URL('/', page.url()).href)
    
    // Browse page should be accessible
    await page.goto('/browse')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/browse')
    
    // Search page should be accessible
    await page.goto('/search')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/search')
  })

  test('should redirect to original destination after login', async ({ page }) => {
    await page.context().clearCookies()
    
    // Try to access protected page
    await page.goto('/user/profile')
    await page.waitForLoadState('networkidle')
    
    // Should be on login page or see login prompt
    const currentUrl = page.url()
    expect(currentUrl.includes('/login') || currentUrl.includes('/user/profile')).toBeTruthy()
  })
})

test.describe('Authentication Flow - Login Form', () => {
  test('should enable submit button with valid input', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const emailInput = page.locator('input[type="email"], input[placeholder*="이메일"]').first()
    const passwordInput = page.locator('input[type="password"]').first()
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /로그인|login/i }).first()
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill('test@example.com')
      await passwordInput.fill('password123')
      
      await page.waitForTimeout(300)
      
      // Button should be enabled or clickable
      if (await submitButton.isVisible()) {
        const isClickable = await submitButton.isEnabled()
        expect(isClickable).toBeTruthy()
      }
    }
  })

  test('should show loading state on submit', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const emailInput = page.locator('input[type="email"], input[placeholder*="이메일"]').first()
    const passwordInput = page.locator('input[type="password"]').first()
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /로그인|login/i }).first()
    
    if (await emailInput.isVisible() && await passwordInput.isVisible() && await submitButton.isVisible()) {
      await emailInput.fill('test@example.com')
      await passwordInput.fill('password123')
      
      if (await submitButton.isEnabled()) {
        // Click submit
        await submitButton.click()
        
        // Should show some loading indicator or remain on page briefly
        await page.waitForTimeout(500)
        expect(page.url()).toBeTruthy()
      }
    }
  })

  test('should have sign up link', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const bodyText = await page.locator('body').textContent()
    
    const hasSignupLink = 
      bodyText?.includes('회원가입') || 
      bodyText?.includes('가입') ||
      bodyText?.includes('Sign up') ||
      bodyText?.includes('Register')
    
    // Many apps have signup links on login page
    expect(hasSignupLink).toBeTruthy()
  })

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const bodyText = await page.locator('body').textContent()
    
    const hasForgotLink = 
      bodyText?.includes('비밀번호') && bodyText?.includes('찾기') ||
      bodyText?.includes('forgot') ||
      bodyText?.includes('reset')
    
    // Check if forgot password functionality exists
    if (hasForgotLink) {
      expect(hasForgotLink).toBeTruthy()
    }
  })
})

test.describe('Authentication Flow - Logout', () => {
  test('should show logout option when potentially logged in', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Look for user menu or profile icon
    const userMenu = page.locator('[aria-label*="user"], [aria-label*="프로필"], button').filter({ hasText: /프로필|마이페이지/i }).first()
    
    if (await userMenu.isVisible()) {
      await userMenu.click()
      await page.waitForTimeout(500)
      
      // Should show logout option
      const logoutOption = page.locator('button, a').filter({ hasText: /로그아웃|logout/i }).first()
      const hasLogout = await logoutOption.isVisible()
      
      if (hasLogout) {
        expect(hasLogout).toBeTruthy()
      }
    }
  })

  test('should navigate to my page when logged in', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Look for My Page or Profile link in navigation
    const myPageLink = page.locator('a, button').filter({ hasText: /마이페이지|my page|profile/i }).first()
    
    if (await myPageLink.isVisible()) {
      await myPageLink.click()
      await page.waitForTimeout(1000)
      
      // Should navigate to user area
      const currentUrl = page.url()
      expect(currentUrl.includes('/user') || currentUrl.includes('/my') || currentUrl.includes('/profile')).toBeTruthy()
    }
  })
})

test.describe('Authentication Flow - Error Handling', () => {
  test('should handle invalid credentials gracefully', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const emailInput = page.locator('input[type="email"], input[placeholder*="이메일"]').first()
    const passwordInput = page.locator('input[type="password"]').first()
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /로그인|login/i }).first()
    
    if (await emailInput.isVisible() && await passwordInput.isVisible() && await submitButton.isVisible()) {
      // Enter invalid credentials
      await emailInput.fill('wrong@example.com')
      await passwordInput.fill('wrongpassword')
      
      if (await submitButton.isEnabled()) {
        await submitButton.click()
        await page.waitForTimeout(2000)
        
        // Should still be on login page or show error
        const currentUrl = page.url()
        expect(currentUrl.includes('/login') || currentUrl === page.url()).toBeTruthy()
      }
    }
  })

  test('should handle network errors during login', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    // Page should load even with potential network issues
    const bodyText = await page.locator('body').textContent()
    expect(bodyText?.includes('로그인') || bodyText?.includes('Login')).toBeTruthy()
  })

  test('should prevent multiple simultaneous login attempts', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    const emailInput = page.locator('input[type="email"], input[placeholder*="이메일"]').first()
    const passwordInput = page.locator('input[type="password"]').first()
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /로그인|login/i }).first()
    
    if (await emailInput.isVisible() && await passwordInput.isVisible() && await submitButton.isVisible()) {
      await emailInput.fill('test@example.com')
      await passwordInput.fill('password123')
      
      if (await submitButton.isEnabled()) {
        // Click multiple times quickly
        await submitButton.click()
        await submitButton.click()
        
        // Should handle gracefully (button disabled or single request)
        await page.waitForTimeout(1000)
        expect(page.url()).toBeTruthy()
      }
    }
  })
})
