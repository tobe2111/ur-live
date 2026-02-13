# 🔍 최종 디버깅 가이드

## 공식 문서 분석 완료!

모든 코드가 토스페이먼츠 공식 가이드에 맞게 구현되었습니다.

## ✅ 확인된 구현:

1. **결제위젯 SDK** 사용 (`test_gck_` / `test_gsk_`)
2. **API 버전**: `2022-11-16` (결제위젯 고정 버전)
3. **Amount 타입**: `Number()` 명시적 변환
4. **Authorization**: `Basic ` + Base64(SecretKey + `:`)

## 🧪 최종 테스트 방법:

### 1. 브라우저 Console에서 직접 테스트:

```javascript
// 새 시크릿 모드에서 실행
fetch('/api/payments/confirm', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentKey: 'YOUR_PAYMENT_KEY',  // Success URL에서 복사
    orderId: 'YOUR_ORDER_ID',        // Success URL에서 복사
    amount: 106000                   // Number 타입!
  })
})
.then(r => r.json())
.then(d => {
  console.log('=== 상세 결과 ===');
  console.log('Success:', d.success);
  console.log('Error:', d.error);
  console.log('Code:', d.code);
  console.log('Full Response:', JSON.stringify(d, null, 2));
})
```

### 2. 체크 포인트:

#### A. Cloudflare 환경 변수 확인:
```bash
npx wrangler pages secret list --project-name toss-live-commerce
```

**확인사항:**
- `TOSS_SECRET_KEY` 존재하는가?
- 값이 `test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY`인가?

#### B. 토스 개발자센터 확인:
https://developers.tosspayments.com/my/api-keys

**확인사항:**
- 결제위젯 연동 키 섹션
- Client Key: `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN`
- Secret Key: `test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY`
- 두 키가 **같은 화면**에 표시되는가?

#### C. 결제 UI 설정 확인:
https://developers.tosspayments.com/

상점관리자 → 결제 UI 설정 → variantKey `DEFAULT` 설정되어 있는가?

## 🚨 자주 발생하는 문제:

### 문제 1: 키가 다른 계정에서 복사됨
**증상:** `INVALID_API_KEY`
**해결:** 토스 개발자센터에서 **같은 화면**에 표시된 키 세트 사용

### 문제 2: 환경 변수 미반영
**증상:** `결제 시스템 설정이 올바르지 않습니다`
**해결:** 
```bash
npx wrangler pages secret put TOSS_SECRET_KEY --project-name toss-live-commerce
# 값 입력: test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
```

### 문제 3: 결제 세션 만료
**증상:** `NOT_FOUND_PAYMENT_SESSION` 또는 `EXPIRED_PAYMENT`
**원인:** 결제 완료 후 5분 이상 경과
**해결:** 새로 결제 진행

### 문제 4: Amount 타입 오류
**증상:** 400 에러
**우리 코드:** ✅ 이미 `Number()` 사용 중

## 📊 정상 작동 시 예상 로그:

```
[Payment] 📊 amount 타입: number
[Payment] 📊 amount 값: 106000
[Payment] 요청 본문: {"orderId":"...","amount":106000,"paymentKey":"..."}
[Payment] 📡 토스페이먼츠 API 응답:
  - HTTP 상태: 200
  - 응답 OK?: true
[Payment] ✅ 결제 승인 성공! paymentKey: turte...
```

## 🔧 긴급 수정이 필요한 경우:

만약 여전히 실패한다면, Console에서 정확한 에러 메시지를 복사해서:
1. Error message
2. Error code
3. HTTP status

이 세 가지를 보내주세요.
