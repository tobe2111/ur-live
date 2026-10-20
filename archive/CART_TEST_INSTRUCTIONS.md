# Cart 페이지 기능 테스트 지침

## 현황
- **문제**: 기존 테스트 계정 (`buyer@test.com`)의 password_hash가 bcrypt 형식(`$2b$10$placeholder`)으로 되어 있으나, 백엔드는 PBKDF2 및 레거시 SHA-256만 지원
- **해결책**: 웹사이트에서 신규 계정 생성 → PBKDF2 해시로 자동 생성됨
- **수정 완료**: `password_hash_version` 컬럼 참조 제거 (commit 4fd74eca)

## 테스트 순서

### 1. 신규 계정 생성
1. https://live.ur-team.com/register 접속
2. 계정 정보 입력:
   - 이메일: `cart_test_001@test.com`
   - 비밀번호: `test1234!`
   - 이름: `카트 테스트`
   - 전화번호: `010-1234-5678` (선택)
3. 회원가입 완료 → 자동 로그인됨

### 2. 상품 담기 테스트
1. https://live.ur-team.com/ (메인 페이지) 접속
2. 상품 클릭하여 상세 페이지 이동
3. "장바구니 담기" 버튼 클릭
4. 성공 메시지 확인: "✓ 장바구니에 담김"

### 3. Cart 페이지 기능 테스트
URL: https://live.ur-team.com/cart

#### ✅ 확인 항목:
- [ ] 담긴 상품이 올바르게 표시됨 (상품명, 이미지, 가격)
- [ ] 수량 변경 버튼 (- / +) 동작
   - 최소 수량: 1 (1일 때 - 버튼 비활성화)
   - 재고량 초과 시 + 버튼 비활성화
- [ ] 삭제 버튼 (🗑️) 동작
- [ ] 여러 셀러의 상품이 있을 경우 셀러별 그룹화
- [ ] 배송비 표시 (무료 배송 조건 포함)
- [ ] 합계 금액 계산 (상품 가격 + 배송비)
- [ ] "결제하기" 버튼 클릭 시 /checkout 이동

### 4. 예상 문제 및 해결
- **401 Unauthorized**: 로그인 세션 만료 → 재로그인
- **API 응답 형식 불일치**: 브라우저 개발자 도구 Console 확인 → 프론트엔드 코드 수정
- **Zustand Store 동작**: 장바구니 아이템 추가 시 localStorage에 저장되는지 확인

## 코드 수정 이력
- `src/worker/routes/auth.routes.ts` (lines 55-59, 131-138): `password_hash_version` 제거
- 커밋: `4fd74eca` - "fix: Remove password_hash_version column references for DB compatibility"

## 다음 단계
Cart 테스트 완료 후:
1. Checkout 페이지 테스트
2. MyOrders 페이지 테스트
