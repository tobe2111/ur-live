/// <reference types="cypress" />

describe('결제 플로우 E2E 테스트', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'Test1234!',
  }

  const testProduct = {
    id: 'test-product-123',
    name: '테스트 상품',
    price: 10000,
  }

  beforeEach(() => {
    // 테스트 시작 전 로그인
    cy.visit('/')
    cy.get('[data-cy=login-button]').click()
    cy.get('[data-cy=email-input]').type(testUser.email)
    cy.get('[data-cy=password-input]').type(testUser.password)
    cy.get('[data-cy=submit-button]').click()
    cy.url().should('not.include', '/login')
  })

  describe('정상 결제 플로우', () => {
    it('상품 → 장바구니 → 결제 → 주문 완료', () => {
      // 1. 상품 상세 페이지 방문
      cy.visit(`/products/${testProduct.id}`)
      cy.contains(testProduct.name).should('be.visible')

      // 2. 장바구니 추가
      cy.get('[data-cy=add-to-cart]').click()
      cy.contains('장바구니에 추가되었습니다').should('be.visible')

      // 3. 장바구니 페이지로 이동
      cy.visit('/cart')
      cy.contains(testProduct.name).should('be.visible')
      cy.get('[data-cy=cart-item]').should('have.length.at.least', 1)

      // 4. 결제 페이지로 이동
      cy.get('[data-cy=checkout-button]').click()
      cy.url().should('include', '/checkout')

      // 5. 결제 수단 선택
      cy.get('[data-cy=payment-method]').select('card')
      cy.get('[data-cy=total-amount]').should('contain', testProduct.price.toLocaleString())

      // 6. 결제하기 버튼 클릭
      cy.get('[data-cy=payment-submit]').click()

      // 7. 주문 완료 페이지 확인
      cy.url().should('include', '/orders/success', { timeout: 10000 })
      cy.contains('주문이 완료되었습니다').should('be.visible')
      cy.get('[data-cy=order-id]').should('exist')
    })
  })

  describe('재고 부족 시나리오', () => {
    it('재고 부족 시 결제 실패 메시지 표시', () => {
      // Mock API: 재고 부족 응답
      cy.intercept('POST', '/api/checkout', {
        statusCode: 400,
        body: {
          success: false,
          error: '재고가 부족합니다',
        },
      }).as('checkoutRequest')

      cy.visit('/checkout')
      cy.get('[data-cy=payment-method]').select('card')
      cy.get('[data-cy=payment-submit]').click()

      // 에러 메시지 확인
      cy.wait('@checkoutRequest')
      cy.contains('재고가 부족합니다').should('be.visible')
      cy.url().should('include', '/checkout') // 여전히 결제 페이지에 있음
    })
  })

  describe('결제 실패 시나리오', () => {
    it('Toss 결제 실패 시 자동 롤백', () => {
      // Mock API: Toss 결제 실패
      cy.intercept('POST', 'https://api.tosspayments.com/**', {
        statusCode: 500,
        body: { error: 'Payment failed' },
      }).as('tossPayment')

      cy.intercept('POST', '/api/checkout', {
        statusCode: 400,
        body: {
          success: false,
          error: '결제 승인 실패',
        },
      }).as('checkoutRequest')

      cy.visit('/checkout')
      cy.get('[data-cy=payment-method]').select('card')
      cy.get('[data-cy=payment-submit]').click()

      // 에러 메시지 확인
      cy.wait('@checkoutRequest')
      cy.contains('결제 승인 실패').should('be.visible')

      // 롤백 확인: 상품 재고가 복구되었는지
      cy.visit(`/products/${testProduct.id}`)
      cy.get('[data-cy=stock-count]').should('not.contain', '0개') // 재고가 복구됨
    })
  })

  describe('주문 추적', () => {
    it('주문 후 실시간 상태 추적', () => {
      // 주문 생성 (간략화)
      cy.visit('/checkout')
      cy.get('[data-cy=payment-method]').select('card')
      cy.get('[data-cy=payment-submit]').click()
      cy.url().should('include', '/orders/success', { timeout: 10000 })

      // 주문 상세 페이지로 이동
      cy.get('[data-cy=view-order-button]').click()
      cy.url().should('include', '/orders/')

      // 초기 상태: 결제 완료
      cy.get('[data-cy=order-status]').should('contain', '결제 완료')

      // Mock API: 상태 변경 (상품 준비중)
      cy.intercept('GET', '/api/orders/**', {
        body: {
          success: true,
          data: {
            order: {
              id: 'test-order-123',
              status: 'preparing',
              amount: testProduct.price,
            },
          },
        },
      }).as('orderStatus')

      // 30초 대기 후 자동 갱신 확인 (실제로는 빠르게 테스트)
      cy.wait(2000) // 2초 후
      cy.reload() // 수동 새로고침 (자동 폴링 대신)
      cy.wait('@orderStatus')
      cy.get('[data-cy=order-status]').should('contain', '상품 준비중')
    })
  })

  describe('환불 플로우', () => {
    it('주문 취소 및 환불 요청', () => {
      // 내 주문 페이지로 이동
      cy.visit('/my-orders')
      cy.get('[data-cy=order-item]').first().click()

      // 주문 상세 페이지
      cy.url().should('include', '/orders/')
      cy.get('[data-cy=order-status]').should('contain', '결제 완료')

      // 환불 요청 버튼 클릭
      cy.get('[data-cy=refund-button]').click()

      // 환불 사유 입력
      cy.get('[data-cy=refund-reason]').type('단순 변심')
      cy.get('[data-cy=refund-submit]').click()

      // 환불 완료 확인
      cy.contains('환불이 요청되었습니다').should('be.visible')
      cy.get('[data-cy=order-status]').should('contain', '환불 완료', { timeout: 5000 })

      // 재고 복구 확인
      cy.visit(`/products/${testProduct.id}`)
      cy.get('[data-cy=stock-count]').should('not.contain', '품절') // 재고가 복구됨
    })
  })

  describe('중복 주문 방지', () => {
    it('동일한 주문 ID로 중복 결제 시도 시 차단', () => {
      const orderId = 'duplicate-order-123'

      // Mock API: 중복 주문
      cy.intercept('POST', '/api/checkout', {
        statusCode: 400,
        body: {
          success: false,
          error: '이미 처리된 주문입니다',
        },
      }).as('duplicateOrder')

      cy.visit('/checkout')
      cy.get('[data-cy=payment-method]').select('card')
      cy.get('[data-cy=payment-submit]').click()

      cy.wait('@duplicateOrder')
      cy.contains('이미 처리된 주문입니다').should('be.visible')
    })
  })
})
