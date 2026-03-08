/**
 * 🧪 E2E 테스트: 셀러 로그인 플로우
 * 
 * 테스트 시나리오:
 * 1. 셀러 로그인 페이지 접근
 * 2. 이메일/비밀번호 로그인 (JWT)
 * 3. 셀러 대시보드 접근
 * 4. 로그아웃
 */

describe('셀러 로그인 플로우', () => {
  beforeEach(() => {
    cy.clearAuth()
  })

  it('✅ 셀러 로그인 페이지가 올바르게 렌더링됨', () => {
    cy.visit('/seller/login')
    cy.url().should('include', '/seller/login')
    
    cy.contains('셀러 로그인').should('be.visible')
    cy.get('[data-testid="email-input"]').should('be.visible')
    cy.get('[data-testid="password-input"]').should('be.visible')
    cy.get('[data-testid="login-submit"]').should('be.visible')
  })

  it('✅ 셀러 이메일/비밀번호 로그인 성공', () => {
    // Mock API 응답
    cy.mockApiResponse('/api/auth/seller/login', 'POST', {
      token: 'mock-seller-jwt-token',
      user: {
        id: 1,
        email: 'seller@test.com',
        name: 'Test Seller',
        role: 'seller',
      },
    })

    cy.visit('/seller/login')

    cy.get('[data-testid="email-input"]').type('seller@test.com')
    cy.get('[data-testid="password-input"]').type('sellerpass123')
    cy.get('[data-testid="login-submit"]').click()

    // 셀러 대시보드로 리다이렉트
    cy.url().should('include', '/seller/dashboard', { timeout: 10000 })
    
    // 셀러 이름 표시 확인
    cy.get('[data-testid="seller-name"]', { timeout: 5000 }).should('contain', 'Test Seller')
  })

  it('❌ 잘못된 셀러 비밀번호로 로그인 실패', () => {
    cy.mockApiResponse('/api/auth/seller/login', 'POST', {
      error: 'Invalid seller credentials',
    }, 401)

    cy.visit('/seller/login')

    cy.get('[data-testid="email-input"]').type('seller@test.com')
    cy.get('[data-testid="password-input"]').type('wrongpassword')
    cy.get('[data-testid="login-submit"]').click()

    // 에러 메시지 확인
    cy.contains('Invalid', { timeout: 5000 }).should('be.visible')
    cy.url().should('include', '/seller/login')
  })

  it('✅ 셀러 대시보드 메뉴 접근', () => {
    cy.mockApiResponse('/api/auth/seller/login', 'POST', {
      token: 'mock-seller-jwt-token',
      user: { id: 1, email: 'seller@test.com', name: 'Test Seller', role: 'seller' },
    })

    cy.visit('/seller/login')
    cy.get('[data-testid="email-input"]').type('seller@test.com')
    cy.get('[data-testid="password-input"]').type('sellerpass123')
    cy.get('[data-testid="login-submit"]').click()

    cy.url().should('include', '/seller/dashboard', { timeout: 10000 })

    // 대시보드 메뉴 확인
    cy.get('[data-testid="seller-menu"]').should('be.visible')
    
    // 주요 메뉴 항목 확인 (예시)
    cy.contains('상품 관리').should('be.visible')
    cy.contains('주문 관리').should('be.visible')
    cy.contains('라이브 방송').should('be.visible')
  })

  it('✅ 셀러 로그아웃', () => {
    cy.mockApiResponse('/api/auth/seller/login', 'POST', {
      token: 'mock-seller-jwt-token',
      user: { id: 1, email: 'seller@test.com', name: 'Test Seller', role: 'seller' },
    })

    cy.visit('/seller/login')
    cy.get('[data-testid="email-input"]').type('seller@test.com')
    cy.get('[data-testid="password-input"]').type('sellerpass123')
    cy.get('[data-testid="login-submit"]').click()

    cy.url().should('include', '/seller/dashboard', { timeout: 10000 })

    // 로그아웃
    cy.logout()

    // 셀러 로그인 페이지로 리다이렉트
    cy.url().should('include', '/seller/login')
  })
})
