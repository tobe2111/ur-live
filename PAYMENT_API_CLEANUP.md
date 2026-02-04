# 결제 API 정리 계획

**날짜**: 2026-02-04  
**현재 상태**: NicePay + Toss 혼재 (충돌 가능성)  
**목표**: NicePay만 사용

---

## 🔍 현재 상황

### 나이스페이먼츠 (사용 중) ✅
- `POST /api/orders/create` - 주문 생성
- `POST /api/payments/nicepay/confirm` - 결제 승인

### 토스페이먼츠 (사용 안 함, 제거 예정) ❌
1. `GET /api/toss/user-info` - 유어 브릿지 유저 정보
   - **사용 여부**: ❌ 사용 안 함
   - **목적**: 유어 앱 브릿지용 (웹에서 불필요)
   
2. `POST /api/toss/payment/prepare` - 결제 준비
   - **사용 여부**: ❌ TODO 주석 처리
   - **코드 상태**: 미구현 (Mock 데이터만 반환)
   
3. `POST /api/toss-pay/payments/create` - 유어페이 결제 생성
   - **사용 여부**: ❌ TEST_MODE = true (Mock)
   - **코드 상태**: 완전 구현되어 있지만 사용 안 함
   
4. `POST /api/toss-pay/callback` - 결제 콜백
   - **사용 여부**: ❌ 사용 안 함

---

## 🎯 제거 계획

### Phase 1: 안전 확인
1. ✅ 프론트엔드에서 Toss API 호출 여부 확인
2. ✅ CheckoutPage에서 사용 안 함 확인
3. ✅ 다른 페이지에서 사용 여부 확인

### Phase 2: Toss API 제거
1. src/index.tsx에서 다음 섹션 삭제:
   - Line 1981-2049: Toss Bridge API
   - Line 2292-2500+: Toss Pay API (추정)

2. 관련 타입 정의 제거 (있다면)

### Phase 3: 데이터베이스 정리
1. `users` 테이블의 `toss_user_id` 컬럼:
   - **판단**: 카카오 로그인으로 대체 가능
   - **결정**: 제거 가능 (마이그레이션 필요)

2. 관련 코드 제거:
   ```typescript
   // 이런 코드들 제거
   const tossUserId = c.req.header('X-Toss-User-Id');
   WHERE toss_user_id = ?
   ```

---

## ⚠️ 주의 사항

### 안전하게 제거 가능
- Toss API 4개 모두 사용 안 함
- 프론트엔드에서 호출 없음
- 제거해도 기존 기능 영향 없음

### 추가 확인 필요
- `toss_user_id` 컬럼이 다른 곳에서 사용되는지 확인
- 혹시 모를 레거시 코드 확인

---

## 📝 제거 순서

1. **즉시 제거 가능** (안전):
   - `POST /api/toss/payment/prepare`
   - `POST /api/toss-pay/payments/create`
   - `POST /api/toss-pay/callback`

2. **확인 후 제거**:
   - `GET /api/toss/user-info`
   - `toss_user_id` 관련 코드

3. **DB 마이그레이션** (선택):
   - `ALTER TABLE users DROP COLUMN toss_user_id`

---

## 🚀 다음 단계

**지금 제거할까요?**
1. Toss API 4개 모두 제거
2. 코드 정리 및 주석 제거
3. 테스트 후 배포

**아니면 나중에?**
- 일단 남겨두고 다른 기능 먼저 구현
- 나중에 정리

---

**추천**: 지금 제거하는 것이 좋습니다!
- 코드가 깔끔해짐
- 혼란 방지
- 유지보수 쉬워짐
