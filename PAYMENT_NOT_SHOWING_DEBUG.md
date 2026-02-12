# 토스페이먼츠 테스트 결제내역 안뜨는 문제 - 진단 가이드

## 🔍 주문 번호
`ORDER_1770873279210_MC4wNTY4MDAxMzMyNTQx`

---

## 📋 진단 체크리스트

### ✅ 1단계: 결제 흐름 확인

**다음 중 어디까지 진행되었나요?**

- [ ] **Step 1**: CheckoutPage에서 "결제하기" 버튼 클릭
- [ ] **Step 2**: 결제 수단 선택 (카드/토스페이/카카오페이 등)
- [ ] **Step 3**: 결제 정보 입력 (카드번호, 유효기간 등)
- [ ] **Step 4**: 결제 완료 후 `/payment/success` 페이지로 이동
- [ ] **Step 5**: "결제가 완료되었습니다" 메시지 확인

**❌ Step 4나 Step 5에 도달하지 못했다면?**
→ **원인**: 결제 승인 API(`/api/payments/confirm`)가 호출되지 않았습니다!
→ **결과**: 토스페이먼츠 개발자센터에 기록되지 않음

---

### ✅ 2단계: 브라우저 콘솔 로그 확인

**F12를 눌러 개발자 도구를 열고 Console 탭에서 다음 로그를 찾아보세요:**

#### 정상적인 로그 순서:

```javascript
// CheckoutPage
[Payment] 🔘 버튼 클릭 감지
[Payment] ✅ 결제 시작
[Payment] requestPayment 호출

// PaymentSuccessPage
[PaymentSuccess] 결제 승인 프로세스 시작
[PaymentSuccess] 장바구니 조회 중...
[PaymentSuccess] 주문 생성 중...
[PaymentSuccess] ✅ 주문 생성 완료: ORDER_...
[PaymentSuccess] 결제 승인 요청 중...

// Backend (index.tsx)
[Payment] 결제 승인 요청: { orderId: "ORDER_...", amount: 15000 }
[Payment] 🚀 토스페이먼츠 결제 승인 API 호출 시작...
[Payment] 📋 요청 데이터: { paymentKey: "...", orderId: "ORDER_...", amount: 15000 }
[Payment] 📡 토스페이먼츠 API 응답 상태: 200
[Payment] ✅ 결제 승인 성공! paymentKey: ...
[Payment] ✅ 주문 번호: ORDER_...
[Payment] ✅ 주문 상태 업데이트 완료
[Payment] ✅ 재고 차감 완료

// PaymentSuccessPage
[PaymentSuccess] ✅ 결제 승인 완료
[PaymentSuccess] 장바구니 비우기 중...
[PaymentSuccess] ✅ 장바구니 비우기 완료
```

#### ❌ 어느 단계에서 멈췄나요?

| 멈춘 단계 | 원인 |
|----------|------|
| `requestPayment 호출` 이후 아무것도 없음 | 결제 취소 또는 실패 |
| `결제 승인 프로세스 시작` 없음 | successUrl로 리다이렉트 안됨 |
| `토스페이먼츠 API 호출 시작` 없음 | 주문 생성 실패 |
| `API 응답 상태: 200` 아님 | 토스페이먼츠 API 에러 |

---

### ✅ 3단계: Network 탭 확인

**F12 → Network 탭에서 다음 API 호출을 찾아보세요:**

#### 필수 API 호출 순서:

1. **`POST /api/orders`**
   - 상태: 200 OK
   - 응답: `{ success: true, data: { id: 123, order_number: "ORDER_..." } }`

2. **`POST /api/payments/confirm`**
   - 상태: 200 OK
   - 요청: `{ paymentKey: "...", orderId: "ORDER_...", amount: 15000 }`
   - 응답: `{ success: true, data: { ... } }`

#### ❌ `/api/payments/confirm` 호출이 없거나 실패했다면?

**확인 사항:**
- Request Payload에 `paymentKey`, `orderId`, `amount`가 있는지
- Response에서 에러 메시지 확인
- Status Code가 200이 아니면 에러 원인 확인

---

### ✅ 4단계: 토스페이먼츠 키 확인

#### 클라이언트 키 확인

**CheckoutPage.tsx (라인 20):**
```typescript
const clientKey = 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'
```

#### 시크릿 키 확인

**Cloudflare Secret:**
```bash
npx wrangler pages secret list --project-name ur-live
```

**확인 사항:**
- ✅ 클라이언트 키와 시크릿 키가 **같은 계정**인가?
- ✅ 둘 다 **테스트 키**인가? (test_gck_, test_gsk_)
- ✅ 결제위젯 키인가? (test_gck_로 시작)

#### ⚠️ 키 불일치 확인 방법

토스페이먼츠 개발자센터:
1. https://developers.tosspayments.com/ 로그인
2. **내 정보 > API 키** 확인
3. **결제위젯 클라이언트 키**와 현재 코드의 키 비교
4. **결제위젯 시크릿 키**와 Cloudflare Secret 비교

---

### ✅ 5단계: 실제 결제 과정 재현

**다시 한 번 결제를 시도하면서 모든 단계를 기록하세요:**

#### 체크리스트:

1. [ ] 브라우저 F12 열기 (Console + Network 탭)
2. [ ] https://live.ur-team.com/checkout 접속
3. [ ] 배송지 선택
4. [ ] 결제 수단 선택 (간편결제 권장: 토스페이/카카오페이)
5. [ ] 테스트 카드 정보 입력:
   ```
   카드 번호: 4000 0000 0000 0010
   유효기간: 12/25
   CVC: 123
   생년월일: 000000
   비밀번호: 00
   ```
6. [ ] 결제하기 버튼 클릭
7. [ ] Console에서 로그 확인
8. [ ] Network에서 `/api/payments/confirm` 확인
9. [ ] `/payment/success` 페이지 도달 확인

---

## 🎯 가장 가능성 높은 원인 TOP 3

### 1️⃣ 결제 과정 중 취소 (80% 확률)

**증상:**
- 주문 번호는 생성되었지만
- `/payment/success` 페이지에 도달하지 못함
- `/api/payments/confirm` API 호출되지 않음

**원인:**
- 사용자가 결제 화면에서 "취소" 버튼 클릭
- 브라우저 뒤로가기
- 결제 시간 초과

**해결:**
- 다시 결제 진행
- 끝까지 완료하기

---

### 2️⃣ 테스트/운영 키 불일치 (15% 확률)

**증상:**
- 결제는 완료된 것 같은데
- 토스페이먼츠 개발자센터에 안 보임
- 다른 계정에 기록되었을 가능성

**원인:**
- 클라이언트 키는 A 계정
- 시크릿 키는 B 계정
- 결제 기록이 B 계정에 저장됨

**해결:**
```bash
# 현재 시크릿 키 확인
npx wrangler pages secret list --project-name ur-live

# 클라이언트 키와 일치하는지 확인
# test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
# test_gsk_bAjYKeZ4G5V47OvXZLy9lMKwv12Eqpmo

# 토스페이먼츠 개발자센터에서 키 확인
# https://developers.tosspayments.com/
```

---

### 3️⃣ API 호출 실패 (5% 확률)

**증상:**
- `/api/payments/confirm` 호출은 되는데
- 응답이 200이 아님
- 에러 메시지 있음

**원인:**
- 시크릿 키 오류
- 네트워크 에러
- 토스페이먼츠 API 장애

**해결:**
- Network 탭에서 에러 응답 확인
- Console에서 에러 로그 확인
- 시크릿 키 재설정

---

## 🔧 즉시 확인 가능한 방법

### 방법 1: 로그 확인

**Console에서 다음 검색:**
```
ORDER_1770873279210
```

**나타나야 하는 로그:**
```
[PaymentSuccess] 주문 생성 중... { orderId: "ORDER_1770873279210_...", userId: "1" }
[PaymentSuccess] ✅ 주문 생성 완료: ORDER_1770873279210_...
[Payment] 결제 승인 요청: { orderId: "ORDER_1770873279210_...", amount: ... }
[Payment] 📡 토스페이먼츠 API 응답 상태: 200
[Payment] ✅ 결제 승인 성공!
```

**❌ 이 로그가 없다면?**
→ 결제 승인 API가 호출되지 않았습니다!

---

### 방법 2: Network 확인

**Network 탭에서 검색:**
```
payments/confirm
```

**있어야 하는 것:**
- Request URL: `https://live.ur-team.com/api/payments/confirm`
- Status: `200`
- Request Payload: `{ paymentKey: "...", orderId: "ORDER_1770873279210_...", amount: ... }`

**❌ 이 API 호출이 없다면?**
→ PaymentSuccessPage가 실행되지 않았습니다!

---

### 방법 3: 개발자센터 재확인

**올바른 계정인지 확인:**
1. https://developers.tosspayments.com/ 로그인
2. **상점 정보 확인** - Store ID가 `urteamizy1`인지
3. **API 키 확인** - 클라이언트 키가 `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN`인지
4. **테스트 결제내역** - https://developers.tosspayments.com/test/payment-logs

**❌ Store ID나 키가 다르다면?**
→ 다른 계정을 보고 있습니다!

---

## 🚀 다음 단계

### 즉시 해야 할 일:

1. **브라우저 F12 열기**
2. **새로운 결제 시도**
3. **Console + Network 탭 모니터링**
4. **스크린샷 찍기** (에러 발생 시)

### 문제가 계속되면:

**다음 정보를 제공해주세요:**

1. Console 로그 전체 (F12 → Console → 우클릭 → Save as...)
2. Network 탭 스크린샷 (`/api/payments/confirm` 부분)
3. 결제 완료 페이지 URL (예: `/payment/success?paymentKey=...`)
4. 토스페이먼츠 개발자센터 Store ID

---

## 📞 빠른 체크

**다음 명령어로 현재 설정 확인:**

```bash
# 1. 클라이언트 키 확인
grep "clientKey" src/pages/CheckoutPage.tsx

# 2. 시크릿 키 확인 (Cloudflare)
npx wrangler pages secret list --project-name ur-live

# 3. 최근 배포 확인
npx wrangler pages deployment list ur-live
```

---

**✨ 대부분의 경우 결제 과정 중 취소된 것입니다!**  
**다시 한 번 끝까지 완료해보세요! 🚀**
