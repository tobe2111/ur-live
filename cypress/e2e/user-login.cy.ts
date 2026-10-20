/**
 * 🧪 E2E 테스트: 일반 사용자 로그인 플로우
 * 
 * 테스트 시나리오:
 * 1. 이메일/비밀번호 로그인
 * 2. Kakao OAuth 로그인 (리다이렉트 확인)
 * 3. 로그인 실패 (잘못된 비밀번호)
 * 4. 로그아웃
 */

describe('일반 사용자 로그인 플로우', () => {
  beforeEach(() => {
    cy.clearAuth()
    cy.visit('/login')
  })

  it('✅ 로그인 페이지가 올바르게 렌더링됨', () => {
    cy.url().should('include', '/login')
    cy.contains('로그인').should('be.visible')
    
    // 로그인 폼 요소 확인
    cy.get('[data-testid="email-input"]').should('be.visible')
    cy.get('[data-testid="password-input"]').should('be.visible')
    cy.get('[data-testid="login-submit"]').should('be.visible')
  })

  it('✅ 이메일/비밀번호 로그인 성공', () => {
    // Mock API 응답
    cy.mockApiResponse('/api/auth/email/login', 'POST', {
      success: true,
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      },
    })

    // 로그인 폼 입력
    cy.get('[data-testid="email-input"]').type('test@example.com')
    cy.get('[data-testid="password-input"]').type('testpassword123')
    cy.get('[data-testid="login-submit"]').click()

    // 로그인 성공 후 리다이렉트 확인
    cy.url().should('include', '/user', { timeout: 10000 })
    
    // 사용자 이름 표시 확인 (옵션)
    cy.contains('Test User', { timeout: 5000 }).should('be.visible')
  })

  it('❌ 잘못된 비밀번호로 로그인 실패', () => {
    // Mock API 에러 응답
    cy.mockApiResponse('/api/auth/email/login', 'POST', {
      error: 'Invalid credentials',
    }, 401)

    cy.get('[data-testid="email-input"]').type('test@example.com')
    cy.get('[data-testid="password-input"]').type('wrongpassword')
    cy.get('[data-testid="login-submit"]').click()

    // 에러 메시지 표시 확인
    cy.contains('Invalid credentials', { timeout: 5000 }).should('be.visible')
    
    // 여전히 로그인 페이지에 있음
    cy.url().should('include', '/login')
  })

  it('✅ Kakao 로그인 버튼 클릭 → OAuth 리다이렉트', () => {
    // Kakao 로그인 버튼 찾기
    cy.get('[data-testid="kakao-login-btn"]').should('be.visible').click()

    // OAuth 리다이렉트 확인 (실제 Kakao로 이동하지는 않고 URL 변경만 확인)
    // Note: 실제 E2E에서는 리다이렉트만 확인하고 OAuth는 mock
    cy.url().should('satisfy', (url) => {
      return url.includes('kauth.kakao.com') || url.includes('kakao')
    })
  })

  it('✅ 로그인 후 로그아웃', () => {
    // 먼저 로그인
    cy.mockApiResponse('/api/auth/email/login', 'POST', {
      success: true,
      user: { id: 1, email: 'test@example.com', name: 'Test User' },
    })

    cy.get('[data-testid="email-input"]').type('test@example.com')
    cy.get('[data-testid="password-input"]').type('testpassword123')
    cy.get('[data-testid="login-submit"]').click()

    cy.url().should('include', '/user', { timeout: 10000 })

    // 로그아웃
    cy.logout()

    // 로그인 페이지로 리다이렉트 확인
    cy.url().should('include', '/login')
  })

  it('✅ 빈 이메일로 로그인 시도 시 유효성 검사', () => {
    // 비밀번호만 입력
    cy.get('[data-testid="password-input"]').type('testpassword123')
    cy.get('[data-testid="login-submit"]').click()

    // 유효성 검사 메시지 또는 버튼 비활성화 확인
    cy.get('[data-testid="email-input"]').then(($input) => {
      // HTML5 validation 또는 커스텀 에러 메시지 확인
      expect($input[0].validity.valid).to.be.false
    })
  })

  it('✅ 로그인 페이지에서 회원가입 링크 클릭', () => {
    cy.get('[data-testid="signup-link"]').click()
    cy.url().should('include', '/signup')
  })
})
