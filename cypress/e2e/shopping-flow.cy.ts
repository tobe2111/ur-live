/// <reference types="cypress" />

describe('전체 쇼핑 플로우 E2E 테스트', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'Test1234!',
  }

  beforeEach(() => {
    // 테스트 시작 전 로그인
    cy.visit('/')
    // Assume login functionality exists
    // cy.get('[data-cy=login-button]').click()
    // cy.get('[data-cy=email-input]').type(testUser.email)
    // cy.get('[data-cy=password-input]').type(testUser.password)
    // cy.get('[data-cy=submit-button]').click()
  })

  describe('상품 검색 → 상세 → 장바구니 → 결제', () => {
    it('전체 쇼핑 프로세스를 완료할 수 있다', () => {
      // 1. 홈페이지에서 검색
      cy.visit('/')
      cy.get('[data-cy=search-input]').type('테스트 상품{enter}')
      
      // 2. 검색 결과 페이지 확인
      cy.url().should('include', '/search?q=')
      cy.get('[data-cy=search-result]').should('have.length.at.least', 1)
      
      // 3. 첫 번째 상품 클릭
      cy.get('[data-cy=product-card]').first().click()
      
      // 4. 상품 상세 페이지 확인
      cy.url().should('include', '/products/')
      cy.get('[data-cy=product-title]').should('be.visible')
      cy.get('[data-cy=product-price]').should('be.visible')
      
      // 5. 장바구니에 추가
      cy.get('[data-cy=add-to-cart]').click()
      cy.contains('장바구니에 추가되었습니다').should('be.visible')
      
      // 6. 장바구니로 이동
      cy.get('[data-cy=cart-icon]').click()
      cy.url().should('include', '/cart')
      
      // 7. 장바구니 내용 확인
      cy.get('[data-cy=cart-item]').should('have.length.at.least', 1)
      cy.get('[data-cy=total-price]').should('be.visible')
      
      // 8. 수량 변경 테스트
      cy.get('[data-cy=quantity-increase]').first().click()
      cy.get('[data-cy=item-quantity]').first().should('contain', '2')
      
      // 9. 결제하기 클릭
      cy.get('[data-cy=checkout-button]').click()
      cy.url().should('include', '/checkout')
      
      // 10. 결제 정보 입력
      cy.get('[data-cy=payment-method]').select('card')
      cy.get('[data-cy=delivery-address]').type('서울시 강남구 테헤란로 123')
      cy.get('[data-cy=phone-number]').type('01012345678')
      
      // 11. 최종 가격 확인
      cy.get('[data-cy=final-total]').should('be.visible')
      
      // 12. 결제하기 버튼 클릭
      cy.get('[data-cy=payment-submit]').click()
      
      // 13. 주문 완료 확인
      cy.url().should('include', '/orders/success', { timeout: 10000 })
      cy.contains('주문이 완료되었습니다').should('be.visible')
      cy.get('[data-cy=order-number]').should('be.visible')
    })

    it('위시리스트에서 장바구니로 이동', () => {
      // 1. 상품 상세 페이지 방문
      cy.visit('/products/test-product-1')
      
      // 2. 위시리스트에 추가
      cy.get('[data-cy=wishlist-toggle]').click()
      cy.contains('위시리스트에 추가되었습니다').should('be.visible')
      
      // 3. 위시리스트 페이지로 이동
      cy.visit('/wishlist')
      cy.get('[data-cy=wishlist-item]').should('have.length.at.least', 1)
      
      // 4. 위시리스트에서 장바구니로 추가
      cy.get('[data-cy=move-to-cart]').first().click()
      
      // 5. 장바구니 확인
      cy.visit('/cart')
      cy.get('[data-cy=cart-item]').should('have.length.at.least', 1)
    })
  })

  describe('쿠폰 및 할인 적용', () => {
    it('쿠폰 코드를 입력하여 할인을 받을 수 있다', () => {
      // 장바구니에 상품 추가
      cy.visit('/products/test-product-1')
      cy.get('[data-cy=add-to-cart]').click()
      
      // 장바구니로 이동
      cy.visit('/cart')
      
      // 쿠폰 입력
      cy.get('[data-cy=coupon-input]').type('TEST10')
      cy.get('[data-cy=apply-coupon]').click()
      
      // 할인 적용 확인
      cy.contains('쿠폰이 적용되었습니다').should('be.visible')
      cy.get('[data-cy=discount-amount]').should('be.visible')
    })
  })

  describe('여러 상품 주문', () => {
    it('여러 상품을 동시에 주문할 수 있다', () => {
      // 첫 번째 상품 추가
      cy.visit('/products/test-product-1')
      cy.get('[data-cy=add-to-cart]').click()
      
      // 두 번째 상품 추가
      cy.visit('/products/test-product-2')
      cy.get('[data-cy=add-to-cart]').click()
      
      // 세 번째 상품 추가
      cy.visit('/products/test-product-3')
      cy.get('[data-cy=add-to-cart]').click()
      
      // 장바구니 확인
      cy.visit('/cart')
      cy.get('[data-cy=cart-item]').should('have.length', 3)
      
      // 결제
      cy.get('[data-cy=checkout-button]').click()
      cy.url().should('include', '/checkout')
    })
  })

  describe('배송지 관리', () => {
    it('새 배송지를 추가할 수 있다', () => {
      cy.visit('/checkout')
      
      // 배송지 추가 버튼 클릭
      cy.get('[data-cy=add-address]').click()
      
      // 배송지 정보 입력
      cy.get('[data-cy=address-name]').type('집')
      cy.get('[data-cy=recipient-name]').type('홍길동')
      cy.get('[data-cy=phone]').type('01012345678')
      cy.get('[data-cy=address]').type('서울시 강남구 테헤란로 123')
      cy.get('[data-cy=detail-address]').type('101동 101호')
      
      // 저장
      cy.get('[data-cy=save-address]').click()
      cy.contains('배송지가 추가되었습니다').should('be.visible')
    })
  })

  describe('결제 실패 처리', () => {
    it('결제 실패 시 적절한 메시지를 표시한다', () => {
      // Mock: 결제 실패 응답
      cy.intercept('POST', '/api/checkout', {
        statusCode: 400,
        body: {
          success: false,
          error: '결제 처리 중 오류가 발생했습니다',
        },
      }).as('failedPayment')
      
      cy.visit('/checkout')
      cy.get('[data-cy=payment-method]').select('card')
      cy.get('[data-cy=payment-submit]').click()
      
      cy.wait('@failedPayment')
      cy.contains('결제 처리 중 오류가 발생했습니다').should('be.visible')
    })
  })
})
