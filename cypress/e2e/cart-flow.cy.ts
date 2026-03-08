describe('Cart Flow E2E Tests', () => {
  beforeEach(() => {
    // 테스트 전 장바구니 초기화
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  describe('장바구니 기본 기능', () => {
    it('빈 장바구니 상태를 표시한다', () => {
      cy.visit('/cart')
      
      cy.contains('장바구니가 비어있습니다').should('be.visible')
      cy.contains('쇼핑 계속하기').should('be.visible')
    })

    it('상품 페이지에서 장바구니에 상품을 추가할 수 있다', () => {
      cy.visit('/')
      
      // 첫 번째 상품 클릭
      cy.get('[data-testid="product-card"]').first().click()
      
      // 장바구니 추가 버튼 클릭
      cy.contains('장바구니 담기').click()
      
      // 성공 메시지 확인
      cy.contains('장바구니에 추가되었습니다').should('be.visible')
      
      // 장바구니 페이지로 이동
      cy.visit('/cart')
      
      // 상품이 표시되는지 확인
      cy.get('[data-testid="cart-item"]').should('have.length', 1)
    })

    it('장바구니에서 상품 수량을 증가시킬 수 있다', () => {
      // 사전 조건: 장바구니에 상품 1개 추가
      cy.addProductToCart(1)
      cy.visit('/cart')
      
      // 초기 수량 확인
      cy.get('[data-testid="quantity"]').should('contain', '1')
      
      // 수량 증가 버튼 클릭
      cy.get('[data-testid="increase-quantity"]').click()
      
      // 수량이 2로 증가했는지 확인
      cy.get('[data-testid="quantity"]').should('contain', '2')
      
      // 총 금액이 업데이트되었는지 확인
      cy.get('[data-testid="total-price"]').should('not.be.empty')
    })

    it('장바구니에서 상품 수량을 감소시킬 수 있다', () => {
      // 사전 조건: 장바구니에 상품 2개 추가
      cy.addProductToCart(1, 2)
      cy.visit('/cart')
      
      // 초기 수량 확인
      cy.get('[data-testid="quantity"]').should('contain', '2')
      
      // 수량 감소 버튼 클릭
      cy.get('[data-testid="decrease-quantity"]').click()
      
      // 수량이 1로 감소했는지 확인
      cy.get('[data-testid="quantity"]').should('contain', '1')
    })

    it('수량이 1일 때 감소 버튼이 비활성화된다', () => {
      cy.addProductToCart(1, 1)
      cy.visit('/cart')
      
      // 감소 버튼이 비활성화되어 있는지 확인
      cy.get('[data-testid="decrease-quantity"]').should('be.disabled')
    })

    it('장바구니에서 개별 상품을 삭제할 수 있다', () => {
      cy.addProductToCart(1)
      cy.visit('/cart')
      
      // 삭제 버튼 클릭
      cy.get('[data-testid="remove-item"]').click()
      
      // 확인 모달
      cy.contains('삭제하시겠습니까').should('be.visible')
      cy.contains('확인').click()
      
      // 빈 장바구니 메시지 확인
      cy.contains('장바구니가 비어있습니다').should('be.visible')
    })
  })

  describe('장바구니 선택 기능', () => {
    beforeEach(() => {
      // 여러 상품 추가
      cy.addProductToCart(1)
      cy.addProductToCart(2)
      cy.addProductToCart(3)
      cy.visit('/cart')
    })

    it('전체 선택 기능이 작동한다', () => {
      // 전체 선택 체크박스 클릭
      cy.get('[data-testid="select-all"]').click()
      
      // 모든 상품이 선택되었는지 확인
      cy.get('[data-testid="cart-item-checkbox"]:checked').should('have.length', 3)
    })

    it('전체 선택 해제 기능이 작동한다', () => {
      // 전체 선택
      cy.get('[data-testid="select-all"]').click()
      
      // 전체 선택 해제
      cy.get('[data-testid="select-all"]').click()
      
      // 모든 상품이 선택 해제되었는지 확인
      cy.get('[data-testid="cart-item-checkbox"]:checked').should('have.length', 0)
    })

    it('선택한 상품만 삭제할 수 있다', () => {
      // 첫 번째와 두 번째 상품 선택
      cy.get('[data-testid="cart-item-checkbox"]').eq(0).check()
      cy.get('[data-testid="cart-item-checkbox"]').eq(1).check()
      
      // 선택 삭제 버튼 클릭
      cy.contains('선택 삭제').click()
      
      // 확인
      cy.contains('확인').click()
      
      // 1개 상품만 남았는지 확인
      cy.get('[data-testid="cart-item"]').should('have.length', 1)
    })
  })

  describe('장바구니 결제 플로우', () => {
    it('선택한 상품으로 결제 페이지로 이동할 수 있다', () => {
      cy.addProductToCart(1)
      cy.visit('/cart')
      
      // 상품 선택
      cy.get('[data-testid="cart-item-checkbox"]').check()
      
      // 주문하기 버튼 클릭
      cy.contains('주문하기').click()
      
      // 결제 페이지로 이동했는지 확인
      cy.url().should('include', '/checkout')
    })

    it('상품을 선택하지 않으면 결제할 수 없다', () => {
      cy.addProductToCart(1)
      cy.visit('/cart')
      
      // 상품 선택 해제
      cy.get('[data-testid="cart-item-checkbox"]').uncheck()
      
      // 주문하기 버튼이 비활성화되어 있는지 확인
      cy.contains('주문하기').should('be.disabled')
    })
  })

  describe('장바구니 금액 계산', () => {
    it('10만원 미만일 때 배송비 3,000원을 추가한다', () => {
      // 50,000원 상품 추가
      cy.addProductToCart(1, 1, 50000)
      cy.visit('/cart')
      
      // 배송비 확인
      cy.contains('배송비').parent().should('contain', '3,000원')
      
      // 총 결제금액 확인
      cy.get('[data-testid="total-price"]').should('contain', '53,000원')
    })

    it('10만원 이상일 때 무료배송을 표시한다', () => {
      // 100,000원 상품 추가
      cy.addProductToCart(1, 2, 50000)
      cy.visit('/cart')
      
      // 무료배송 확인
      cy.contains('배송비').parent().should('contain', '무료')
      
      // 총 결제금액 확인
      cy.get('[data-testid="total-price"]').should('contain', '100,000원')
    })

    it('무료배송까지 남은 금액을 안내한다', () => {
      // 70,000원 상품 추가
      cy.addProductToCart(1, 1, 70000)
      cy.visit('/cart')
      
      // 무료배송 안내 메시지
      cy.contains('30,000원 더 담으면 무료배송').should('be.visible')
    })
  })
})
