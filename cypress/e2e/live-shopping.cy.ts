/// <reference types="cypress" />

describe('라이브 쇼핑 플로우 E2E 테스트', () => {
  const testSeller = {
    email: 'seller@example.com',
    password: 'Seller1234!',
  }

  const testBuyer = {
    email: 'buyer@example.com',
    password: 'Buyer1234!',
  }

  describe('판매자: 라이브 방송 시작 및 관리', () => {
    beforeEach(() => {
      // 판매자 로그인
      cy.visit('/seller/login')
      cy.get('[data-cy=email-input]').type(testSeller.email)
      cy.get('[data-cy=password-input]').type(testSeller.password)
      cy.get('[data-cy=login-button]').click()
    })

    it('새 라이브 방송을 생성할 수 있다', () => {
      cy.visit('/seller/streams/new')
      
      // 방송 정보 입력
      cy.get('[data-cy=stream-title]').type('테스트 라이브 방송')
      cy.get('[data-cy=stream-description]').type('테스트용 라이브 쇼핑 방송입니다')
      cy.get('[data-cy=youtube-url]').type('https://youtube.com/watch?v=test123')
      
      // 상품 선택
      cy.get('[data-cy=add-product]').click()
      cy.get('[data-cy=product-selector]').first().click()
      
      // 방송 생성
      cy.get('[data-cy=create-stream]').click()
      cy.contains('라이브 방송이 생성되었습니다').should('be.visible')
      cy.url().should('include', '/seller/streams/')
    })

    it('라이브 방송 중 상품을 변경할 수 있다', () => {
      cy.visit('/seller/live-control/test-stream-1')
      
      // 현재 상품 확인
      cy.get('[data-cy=current-product]').should('be.visible')
      
      // 상품 변경
      cy.get('[data-cy=change-product]').click()
      cy.get('[data-cy=product-list]').children().eq(1).click()
      
      // 변경 확인
      cy.contains('상품이 변경되었습니다').should('be.visible')
    })

    it('실시간 시청자 수와 채팅을 확인할 수 있다', () => {
      cy.visit('/seller/live-control/test-stream-1')
      
      // 시청자 수 확인
      cy.get('[data-cy=viewer-count]').should('be.visible')
      
      // 채팅 메시지 확인
      cy.get('[data-cy=chat-messages]').should('be.visible')
    })
  })

  describe('구매자: 라이브 시청 및 구매', () => {
    beforeEach(() => {
      // 구매자 로그인
      cy.visit('/login')
      cy.get('[data-cy=email-input]').type(testBuyer.email)
      cy.get('[data-cy=password-input]').type(testBuyer.password)
      cy.get('[data-cy=login-button]').click()
    })

    it('라이브 방송 목록에서 방송을 선택하여 시청할 수 있다', () => {
      cy.visit('/')
      
      // 라이브 방송 카드 확인
      cy.get('[data-cy=live-stream-card]').should('have.length.at.least', 1)
      
      // 첫 번째 방송 클릭
      cy.get('[data-cy=live-stream-card]').first().click()
      
      // 라이브 페이지 확인
      cy.url().should('include', '/live/')
      cy.get('[data-cy=video-player]').should('be.visible')
    })

    it('라이브 방송 중 채팅을 보낼 수 있다', () => {
      cy.visit('/live/test-stream-1')
      
      // 채팅 입력
      cy.get('[data-cy=chat-input]').type('좋아요!{enter}')
      
      // 채팅이 표시되는지 확인
      cy.get('[data-cy=chat-messages]').should('contain', '좋아요!')
    })

    it('라이브 방송 중 상품을 장바구니에 추가할 수 있다', () => {
      cy.visit('/live/test-stream-1')
      
      // 현재 판매 중인 상품 확인
      cy.get('[data-cy=current-product]').should('be.visible')
      
      // 장바구니에 추가
      cy.get('[data-cy=add-to-cart]').click()
      cy.contains('장바구니에 추가되었습니다').should('be.visible')
    })

    it('라이브 방송 중 즉시 구매할 수 있다', () => {
      cy.visit('/live/test-stream-1')
      
      // 바로 구매 버튼 클릭
      cy.get('[data-cy=buy-now]').click()
      
      // 결제 페이지로 이동
      cy.url().should('include', '/checkout')
      cy.get('[data-cy=product-name]').should('be.visible')
    })

    it('라이브 방송을 전체화면으로 볼 수 있다', () => {
      cy.visit('/live/test-stream-1')
      
      // 전체화면 버튼 클릭
      cy.get('[data-cy=fullscreen-button]').click()
      
      // 전체화면 확인 (실제로는 브라우저 API 제한으로 E2E에서는 확인 어려움)
      cy.get('[data-cy=video-container]').should('have.class', 'fullscreen')
    })

    it('라이브 방송 상품 리스트를 확인할 수 있다', () => {
      cy.visit('/live/test-stream-1')
      
      // 상품 목록 보기 클릭
      cy.get('[data-cy=show-products]').click()
      
      // 상품 목록 확인
      cy.get('[data-cy=product-list]').should('be.visible')
      cy.get('[data-cy=product-item]').should('have.length.at.least', 1)
    })
  })

  describe('라이브 방송 예약', () => {
    it('예약된 라이브 방송을 확인할 수 있다', () => {
      cy.visit('/')
      
      // 예약 방송 섹션 확인
      cy.get('[data-cy=scheduled-streams]').should('be.visible')
      cy.get('[data-cy=scheduled-stream-card]').should('have.length.at.least', 1)
    })

    it('예약 알림을 설정할 수 있다', () => {
      cy.visit('/')
      cy.get('[data-cy=scheduled-stream-card]').first().within(() => {
        cy.get('[data-cy=notify-button]').click()
      })
      
      cy.contains('알림이 설정되었습니다').should('be.visible')
    })
  })

  describe('라이브 방송 공유', () => {
    it('라이브 방송 URL을 복사할 수 있다', () => {
      cy.visit('/live/test-stream-1')
      
      // 공유 버튼 클릭
      cy.get('[data-cy=share-button]').click()
      
      // URL 복사 버튼 클릭
      cy.get('[data-cy=copy-url]').click()
      
      cy.contains('링크가 복사되었습니다').should('be.visible')
    })
  })

  describe('라이브 통계', () => {
    it('판매자가 실시간 통계를 확인할 수 있다', () => {
      // 판매자 로그인
      cy.visit('/seller/login')
      cy.get('[data-cy=email-input]').type(testSeller.email)
      cy.get('[data-cy=password-input]').type(testSeller.password)
      cy.get('[data-cy=login-button]').click()
      
      cy.visit('/seller/live-control/test-stream-1')
      
      // 통계 확인
      cy.get('[data-cy=total-viewers]').should('be.visible')
      cy.get('[data-cy=total-sales]').should('be.visible')
      cy.get('[data-cy=conversion-rate]').should('be.visible')
    })
  })
})
