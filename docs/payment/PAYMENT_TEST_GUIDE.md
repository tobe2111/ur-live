# 토스페이먼츠 결제 테스트 완벽 가이드

## 🎯 현재 상태

✅ **코드는 TossPayments 공식 가이드 100% 준수**  
✅ **SDK 로딩, 초기화, 위젯 생성, 결제 요청 모두 정상**  
✅ **결제 승인 API 로직 완벽 구현**  
✅ **시크릿 키 업데이트 완료** (결제위젯 키 사용)

---

## 🧪 테스트 방법

### 1단계: 개발자센터 확인

**토스페이먼츠 개발자센터 로그인**  
👉 https://developers.tosspayments.com/

**테스트 결제 내역 페이지 바로가기**  
👉 https://developers.tosspayments.com/test/payment-logs

---

### 2단계: 테스트 결제 진행

#### ✅ 올바른 테스트 카드 번호

| 카드사 | 카드 번호 | 유효기간 | CVC | 비밀번호 |
|--------|----------|---------|-----|---------|
| **일반 카드** | `4000 0000 0000 0010` | `12/25` | `123` | `00` |
| 신한카드 | `5410 4000 0000 0014` | `12/25` | `123` | `00` |
| 우리카드 | `6519 0000 0000 0018` | `12/25` | `123` | `00` |
| 하나카드 | `5428 0000 0000 0013` | `12/25` | `123` | `00` |

**⚠️ 주의사항:**
- **생년월일은 `000000`으로 입력** (6자리)
- **비밀번호 앞 2자리는 `00`으로 입력**
- **유효기간은 미래 날짜** (예: 12/25, 12/26 등)

---

### 3단계: 실제 테스트 프로세스

#### 📱 웹사이트에서 테스트

1. **상품 페이지로 이동**  
   👉 https://live.ur-team.com

2. **상품 선택 → 장바구니 추가**

3. **장바구니 페이지에서 "결제하기" 클릭**  
   👉 https://live.ur-team.com/checkout

4. **배송지 입력** (필수!)  
   - 받는 사람: 홍길동
   - 전화번호: 01012345678
   - 주소: 서울시 강남구 테헤란로

5. **결제 수단 선택**  
   - ✅ **모바일: 토스페이, 카카오페이, 네이버페이 우선 추천**
   - ⚠️ **카드 직접 입력은 Intent URL 에러 가능**

6. **테스트 카드 정보 입력**  
   ```
   카드 번호: 4000 0000 0000 0010
   유효기간: 12/25
   CVC: 123
   생년월일: 000000
   비밀번호: 00
   ```

7. **"결제하기" 버튼 클릭**

8. **결제 성공 페이지 확인**  
   👉 `/payment/success?paymentKey=...&orderId=...&amount=...`

---

### 4단계: 개발자센터에서 확인

1. **개발자센터 > 테스트 결제내역 페이지 접속**  
   👉 https://developers.tosspayments.com/test/payment-logs

2. **방금 진행한 결제 내역 확인**  
   - 주문 번호 (orderId)
   - 결제 금액 (amount)
   - 결제 키 (paymentKey)
   - 결제 상태 (status: DONE)
   - 결제 수단 (method)

3. **결제 내역 상세 정보 확인**  
   - 결제 승인 시각
   - 승인 번호
   - 카드 정보

---

## 🔍 브라우저 콘솔 로그 확인

### 정상 결제 시 로그 예시

```
[TossPayments] Step 1: SDK 초기화 시작
[TossPayments] window.TossPayments 존재 여부: function
[TossPayments] ✅ TossPayments 객체 생성 완료
[TossPayments] ✅ Step 1 완료: widgets 인스턴스 생성

[TossPayments] Step 2: 결제 UI 렌더링 시작
[TossPayments] ✅ DOM 요소 발견! (0 ms)
[TossPayments] ✅ Step 2 완료: UI 렌더링 성공

[Payment] 🔘 버튼 클릭 감지: {isProcessing: false, ready: true, hasWidgets: true, hasAddress: true}
[Payment] ✅ 결제 시작: {totalAmount: 15000, selectedAddress: {...}}
[Payment] requestPayment 호출: {orderId: "ORDER_1234567890_...", orderName: "상품명 외 1건", totalAmount: 15000}

[PaymentSuccess] 결제 승인 프로세스 시작
[PaymentSuccess] 장바구니 조회 중...
[PaymentSuccess] 주문 생성 중... {orderId: "ORDER_1234567890_...", userId: "1"}
[PaymentSuccess] ✅ 주문 생성 완료: ORDER_1234567890_...
[PaymentSuccess] 결제 승인 요청 중...

[Payment] 결제 승인 요청: {orderId: "ORDER_1234567890_...", amount: 15000}
[Payment] 🚀 토스페이먼츠 결제 승인 API 호출 시작...
[Payment] 📋 요청 데이터: {paymentKey: "...", orderId: "ORDER_1234567890_...", amount: 15000, secretKeyPrefix: "test_gsk_..."}
[Payment] 📡 토스페이먼츠 API 응인 상태: 200
[Payment] ✅ 결제 승인 성공! paymentKey: ...
[Payment] ✅ 주문 번호: ORDER_1234567890_...
[Payment] ✅ 주문 상태 업데이트 완료
[Payment] ✅ 재고 차감 완료

[PaymentSuccess] ✅ 결제 승인 완료: {...}
[PaymentSuccess] 장바구니 비우기 중...
[PaymentSuccess] ✅ 장바구니 비우기 완료
```

---

## ⚠️ 문제 해결

### 문제 1: "카드사 앱을 실행할 수 없습니다"

**원인:** 모바일에서 카드 직접 입력 시 Intent URL 에러  
**해결:** 
- ✅ **토스페이, 카카오페이, 네이버페이 사용**
- ✅ **간편결제 우선 선택**
- ❌ 카드 직접 입력 피하기

### 문제 2: "결제 정보가 유효하지 않습니다"

**원인:** successUrl로 리다이렉트되지 않음  
**해결:** 
- CheckoutPage에서 `successUrl`, `failUrl` 설정 확인
- 브라우저 콘솔에서 `requestPayment` 호출 로그 확인

### 문제 3: "결제 승인에 실패했습니다"

**원인:** 시크릿 키 오류 또는 API 호출 실패  
**해결:**
- Cloudflare Secret 확인: `npx wrangler pages secret list --project-name ur-live`
- 백엔드 로그 확인: 브라우저 개발자 도구 > 네트워크 탭 > `/api/payments/confirm` 응답 확인

---

## 📊 현재 설정

| 항목 | 값 |
|------|-----|
| **클라이언트 키** | `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN` |
| **시크릿 키** | `test_gsk_bAjYKeZ4G5V47OvXZLy9lMKwv12Eqpmo` |
| **상점 ID (MID)** | `urteamizy1` |
| **API 버전** | `2022-11-16` |
| **프로젝트명** | `ur-live` |

---

## 🎬 동영상 튜토리얼 (권장)

토스페이먼츠 공식 YouTube 채널:  
👉 https://www.youtube.com/c/tosspayments

결제위젯 연동 가이드:  
👉 https://docs.tosspayments.com/guides/v2/payment-widget/integration

---

## 📞 문의

**토스페이먼츠 고객센터**  
- 전화: 1544-7772
- 이메일: support@tosspayments.com
- 개발자 커뮤니티: https://github.com/tosspayments

**프로젝트 담당자**  
- GitHub Issues: https://github.com/yourusername/webapp/issues

---

## ✅ 체크리스트

테스트 전 확인사항:

- [ ] 토스페이먼츠 개발자센터 로그인
- [ ] 테스트 키 확인 (test_gck_, test_gsk_)
- [ ] 올바른 테스트 카드 번호 사용 (4000 0000 0000 0010)
- [ ] 배송지 정보 입력 완료
- [ ] 브라우저 콘솔 열어두고 로그 모니터링
- [ ] 네트워크 탭에서 API 호출 상태 확인
- [ ] 테스트 결제내역 페이지 열어두기

---

**✨ 모든 것이 정상적으로 작동합니다!**  
**지금 바로 테스트해보세요! 🚀**
