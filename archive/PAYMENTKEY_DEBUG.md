# PaymentKey 디버깅 가이드

## 문제:
토스페이먼츠에서 `INVALID_API_KEY` 에러가 발생하는 이유는
**Frontend에서 생성한 paymentKey의 소유자**와 
**Backend에서 confirm 시 사용하는 Secret Key의 소유자**가
다르기 때문일 수 있습니다.

## 확인 방법:

### 1. PaymentKey 접두사 확인
결제 완료 후 Success URL에서:
```
https://live.ur-team.com/payment/success?
  paymentKey=turte20260213100710BHH31
            ^^^^^^
            이 부분!
```

**PaymentKey 접두사 의미:**
- `turte...`: 특정 MID의 결제
- 이 MID가 우리 시크릿 키의 MID와 같아야 함!

### 2. 토스 개발자센터 확인
https://developers.tosspayments.com/my/api-keys

**확인사항:**
- "결제위젯 연동 키" 섹션
- MID (상점 아이디) 확인
- 클라이언트 키: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
- 시크릿 키: test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
- **이 키들이 속한 MID가 무엇인지?**

### 3. 코드에서 사용 중인 MID 확인
Frontend (CheckoutPage.tsx):
```typescript
const clientKey = 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'
// ↑ 이 키가 속한 MID는?
```

Backend (.dev.vars, Cloudflare Secret):
```
TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
// ↑ 이 키가 속한 MID는?
```

### 4. 가능한 원인:

#### 원인 A: 여러 MID가 있는 경우
토스페이먼츠 계약 시 여러 상점 ID를 받았다면:
- MID 1: urteamizy1 (일반 결제)
- MID 2: urteamizy2 (자동결제) 
- 등등...

각 MID마다 다른 키 세트가 있습니다!

#### 원인 B: 키를 다른 MID에서 복사한 경우
- Frontend 키: MID A에서 복사
- Backend 키: MID B에서 복사
- → 매칭 안됨!

### 5. 해결 방법:

토스 개발자센터에서:
1. **단 하나의 MID만 선택**
2. 그 MID의 클라이언트 키 복사
3. **같은 MID**의 시크릿 키 복사
4. 둘 다 교체

## 테스트 방법:

1. 새로운 시크릿 모드
2. 결제 진행
3. Success URL의 paymentKey 확인
4. paymentKey 접두사와 MID 매칭 확인
