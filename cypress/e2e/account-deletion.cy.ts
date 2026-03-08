/**
 * Cypress E2E Test: Account Deletion Flow
 * 
 * 테스트 시나리오:
 * 1. 로그인한 사용자가 마이페이지로 이동
 * 2. 계정 설정 페이지로 이동
 * 3. 계정 삭제 링크 클릭
 * 4. 경고 페이지에서 모든 동의 체크박스 선택
 * 5. "회원탈퇴" 텍스트 입력
 * 6. 탈퇴 처리 및 완료 페이지 확인
 * 
 * Prerequisites:
 * - 테스트용 사용자 계정이 로그인된 상태
 * - Firebase Authentication이 정상 작동
 * - API 엔드포인트 /api/account/delete가 응답
 */

describe('Account Deletion Flow', () => {
  beforeEach(() => {
    // 테스트 전 상태 초기화
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('should complete the full account deletion flow', () => {
    // 1. 로그인 페이지로 이동
    cy.visit('/login');
    cy.url().should('include', '/login');

    // 2. 테스트 계정으로 로그인 (이메일/비밀번호)
    // Note: 실제 테스트 환경에서는 테스트 전용 계정 사용
    cy.get('input[type="email"]').type('test-delete@example.com');
    cy.get('input[type="password"]').type('test123456');
    cy.get('button[type="submit"]').contains('로그인').click();

    // 3. 로그인 성공 후 홈으로 리다이렉트 확인
    cy.url().should('not.include', '/login');
    cy.wait(1000);

    // 4. 마이페이지로 이동
    cy.visit('/mypage');
    cy.url().should('include', '/mypage');

    // 5. "계정 설정" 버튼 찾기 (하단에 위치)
    cy.scrollTo('bottom');
    cy.contains('계정 설정').should('be.visible').click();

    // 6. 계정 설정 페이지로 이동 확인
    cy.url().should('include', '/account/settings');

    // 7. 페이지 하단으로 스크롤하여 "계정 삭제" 링크 찾기
    cy.scrollTo('bottom');
    cy.wait(500);
    cy.contains('계정 삭제').should('be.visible').click();

    // 8. 경고 페이지로 이동 확인
    cy.url().should('include', '/account/delete/warning');

    // 9. 경고 메시지들이 표시되는지 확인
    cy.contains('회원 탈퇴 전 꼭 확인해주세요').should('be.visible');
    cy.contains('모든 데이터가 영구 삭제됩니다').should('be.visible');

    // 10. 페이지 하단으로 스크롤 (모든 경고 메시지 읽기)
    cy.scrollTo('bottom');
    cy.wait(500);

    // 11. 첫 번째 체크박스: 데이터 삭제 동의
    cy.get('input[type="checkbox"]').eq(0).check({ force: true });
    cy.get('input[type="checkbox"]').eq(0).should('be.checked');

    // 12. 두 번째 체크박스: 혜택 상실 동의
    cy.get('input[type="checkbox"]').eq(1).check({ force: true });
    cy.get('input[type="checkbox"]').eq(1).should('be.checked');

    // 13. 세 번째 체크박스: 환불 불가 동의
    cy.get('input[type="checkbox"]').eq(2).check({ force: true });
    cy.get('input[type="checkbox"]').eq(2).should('be.checked');

    // 14. "회원탈퇴" 텍스트 입력
    cy.get('input[placeholder*="회원탈퇴"]').type('회원탈퇴');
    cy.get('input[placeholder*="회원탈퇴"]').should('have.value', '회원탈퇴');

    // 15. "정말 탈퇴하기" 버튼이 활성화되었는지 확인
    cy.contains('정말 탈퇴하기').should('not.be.disabled');

    // 16. API 호출 모킹 (실제 삭제를 방지)
    cy.intercept('DELETE', '/api/account/delete', {
      statusCode: 200,
      body: {
        success: true,
        message: '회원 탈퇴가 완료되었습니다.',
        deletedAt: new Date().toISOString(),
      },
    }).as('deleteAccount');

    // 17. "정말 탈퇴하기" 버튼 클릭
    cy.contains('정말 탈퇴하기').click();

    // 18. 확인 다이얼로그 처리
    cy.on('window:confirm', () => true);

    // 19. API 호출 대기
    cy.wait('@deleteAccount');

    // 20. 탈퇴 완료 페이지로 리다이렉트 확인
    cy.url().should('include', '/account/deleted');

    // 21. 완료 메시지 확인
    cy.contains('회원 탈퇴가 완료되었습니다').should('be.visible');
    cy.contains('그동안 UR Live를 이용해주셔서 감사합니다').should('be.visible');

    // 22. 로그아웃 상태 확인 (localStorage에 토큰 없음)
    cy.window().then((win) => {
      const userId = win.localStorage.getItem('userId');
      expect(userId).to.be.null;
    });
  });

  it('should prevent deletion without all confirmations', () => {
    // 1. 경고 페이지로 직접 이동 (로그인 상태 가정)
    cy.visit('/account/delete/warning');

    // 2. 일부 체크박스만 선택
    cy.get('input[type="checkbox"]').eq(0).check({ force: true });
    cy.get('input[type="checkbox"]').eq(1).check({ force: true });
    // 세 번째 체크박스는 선택하지 않음

    // 3. "정말 탈퇴하기" 버튼이 비활성화 상태인지 확인
    cy.contains('정말 탈퇴하기').should('be.disabled');
  });

  it('should prevent deletion without exact confirmation text', () => {
    // 1. 경고 페이지로 직접 이동
    cy.visit('/account/delete/warning');

    // 2. 모든 체크박스 선택
    cy.get('input[type="checkbox"]').eq(0).check({ force: true });
    cy.get('input[type="checkbox"]').eq(1).check({ force: true });
    cy.get('input[type="checkbox"]').eq(2).check({ force: true });

    // 3. 잘못된 텍스트 입력
    cy.get('input[placeholder*="회원탈퇴"]').type('탈퇴');

    // 4. "정말 탈퇴하기" 버튼이 비활성화 상태인지 확인
    cy.contains('정말 탈퇴하기').should('be.disabled');

    // 5. 정확한 텍스트 입력
    cy.get('input[placeholder*="회원탈퇴"]').clear().type('회원탈퇴');

    // 6. 버튼이 활성화되는지 확인
    cy.contains('정말 탈퇴하기').should('not.be.disabled');
  });

  it('should handle API errors gracefully', () => {
    // 1. 경고 페이지로 이동
    cy.visit('/account/delete/warning');

    // 2. 모든 동의 항목 체크
    cy.get('input[type="checkbox"]').eq(0).check({ force: true });
    cy.get('input[type="checkbox"]').eq(1).check({ force: true });
    cy.get('input[type="checkbox"]').eq(2).check({ force: true });
    cy.get('input[placeholder*="회원탈퇴"]').type('회원탈퇴');

    // 3. API 에러 모킹
    cy.intercept('DELETE', '/api/account/delete', {
      statusCode: 500,
      body: {
        success: false,
        message: '서버 오류가 발생했습니다.',
      },
    }).as('deleteAccountError');

    // 4. "정말 탈퇴하기" 버튼 클릭
    cy.contains('정말 탈퇴하기').click();
    cy.on('window:confirm', () => true);

    // 5. API 호출 대기
    cy.wait('@deleteAccountError');

    // 6. 에러 알림 확인
    cy.on('window:alert', (text) => {
      expect(text).to.include('오류');
    });

    // 7. 여전히 경고 페이지에 머물러 있는지 확인
    cy.url().should('include', '/account/delete/warning');
  });
});
