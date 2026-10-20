/**
 * 🧪 E2E 테스트: 어드민 로그인 플로우
 * 
 * 테스트 시나리오:
 * 1. 어드민 로그인 페이지 접근
 * 2. 이메일/비밀번호 로그인 (JWT)
 * 3. 어드민 패널 접근
 * 4. 로그아웃
 */

describe('어드민 로그인 플로우', () => {
  beforeEach(() => {
    cy.clearAuth()
  })

  it('✅ 어드민 로그인 페이지가 올바르게 렌더링됨', () => {
    cy.visit('/admin/login')
    cy.url().should('include', '/admin/login')
    
    cy.contains('어드민').should('be.visible')
    cy.get('[data-testid="email-input"]').should('be.visible')
    cy.get('[data-testid="password-input"]').should('be.visible')
    cy.get('[data-testid="login-submit"]').should('be.visible')
  })

  it('✅ 어드민 이메일/비밀번호 로그인 성공', () => {
    cy.mockApiResponse('/api/auth/admin/login', 'POST', {
      token: 'mock-admin-jwt-token',
      user: {
        id: 1,
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'admin',
      },
    })

    cy.visit('/admin/login')

    cy.get('[data-testid="email-input"]').type('admin@test.com')
    cy.get('[data-testid="password-input"]').type('adminpass123')
    cy.get('[data-testid="login-submit"]').click()

    // 어드민 패널로 리다이렉트
    cy.url().should('include', '/admin', { timeout: 10000 })
  })

  it('❌ 일반 사용자가 어드민으로 로그인 시도 → 권한 거부', () => {
    cy.mockApiResponse('/api/auth/admin/login', 'POST', {
      error: 'Insufficient permissions',
    }, 403)

    cy.visit('/admin/login')

    cy.get('[data-testid="email-input"]').type('user@test.com')
    cy.get('[data-testid="password-input"]').type('userpass123')
    cy.get('[data-testid="login-submit"]').click()

    // 권한 에러 메시지 확인
    cy.contains('권한', { timeout: 5000 }).should('be.visible')
    cy.url().should('include', '/admin/login')
  })

  it('✅ 어드민 패널 메뉴 접근', () => {
    cy.mockApiResponse('/api/auth/admin/login', 'POST', {
      token: 'mock-admin-jwt-token',
      user: { id: 1, email: 'admin@test.com', name: 'Test Admin', role: 'admin' },
    })

    cy.visit('/admin/login')
    cy.get('[data-testid="email-input"]').type('admin@test.com')
    cy.get('[data-testid="password-input"]').type('adminpass123')
    cy.get('[data-testid="login-submit"]').click()

    cy.url().should('include', '/admin', { timeout: 10000 })

    // 어드민 메뉴 확인
    cy.get('[data-testid="admin-menu"]').should('be.visible')
    
    // 주요 관리 메뉴 항목 확인
    cy.contains('사용자 관리').should('be.visible')
    cy.contains('셀러 관리').should('be.visible')
    cy.contains('통계').should('be.visible')
  })

  it('✅ 어드민 로그아웃', () => {
    cy.mockApiResponse('/api/auth/admin/login', 'POST', {
      token: 'mock-admin-jwt-token',
      user: { id: 1, email: 'admin@test.com', name: 'Test Admin', role: 'admin' },
    })

    cy.visit('/admin/login')
    cy.get('[data-testid="email-input"]').type('admin@test.com')
    cy.get('[data-testid="password-input"]').type('adminpass123')
    cy.get('[data-testid="login-submit"]').click()

    cy.url().should('include', '/admin', { timeout: 10000 })

    // 로그아웃
    cy.logout()

    // 어드민 로그인 페이지로 리다이렉트
    cy.url().should('include', '/admin/login')
  })
})
