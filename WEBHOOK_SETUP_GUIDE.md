# 토스페이먼츠 웹훅 설정 가이드

## 🤔 웹훅이 필요한가?

### ❌ 웹훅이 **필요 없는** 경우 (현재 상황)

현재 프로젝트는 **즉시 승인되는 결제 수단**만 사용하므로 웹훅이 필수가 아닙니다.

| 결제 수단 | 승인 시점 | 웹훅 필요 여부 |
|----------|---------|--------------|
| 신용/체크카드 | ✅ 즉시 승인 | ❌ 불필요 |
| 토스페이 | ✅ 즉시 승인 | ❌ 불필요 |
| 카카오페이 | ✅ 즉시 승인 | ❌ 불필요 |
| 네이버페이 | ✅ 즉시 승인 | ❌ 불필요 |

**현재 결제 흐름:**
```
1. 사용자 결제 요청
2. successUrl로 리다이렉트
3. PaymentSuccessPage에서 /api/payments/confirm 호출
4. 백엔드에서 토스페이먼츠 승인 API 호출
5. 주문 상태 업데이트 완료 ✅
```

### ✅ 웹훅이 **필요한** 경우

다음 결제 수단을 추가할 때는 웹훅이 **필수**입니다:

| 결제 수단 | 승인 시점 | 웹훅 필요 여부 | 이유 |
|----------|---------|--------------|-----|
| **가상계좌** | 🕐 고객 입금 시 | ✅ **필수** | 입금 완료 알림 수신 |
| **정기결제** | 🕐 자동 청구 시 | ✅ **필수** | 청구 결과 알림 |
| **해외카드** | 🕐 승인 후 | ✅ **권장** | 승인 취소 알림 |
| **환불/취소** | 🕐 즉시 | ✅ **권장** | 상태 동기화 |

---

## 🎯 웹훅 등록 시점

### 언제 웹훅을 등록해야 하나?

다음 중 **하나라도 해당**되면 웹훅을 등록하세요:

- [ ] **가상계좌 결제**를 추가할 계획이 있음
- [ ] **정기 결제(구독)**를 구현할 계획이 있음
- [ ] **환불/취소 상태를 실시간으로 추적**하고 싶음
- [ ] **이중 보안 검증**을 원함 (successUrl + webhook 이중 체크)

### ✅ 현재 상태

- ✅ 웹훅 엔드포인트 이미 구현됨: `/api/payments/webhook` (index.tsx L4185)
- ✅ 이벤트 핸들러 구현됨:
  - `PAYMENT_STATUS_CHANGED` (결제 상태 변경)
  - `VIRTUAL_ACCOUNT_ISSUED` (가상계좌 발급)
- ⏳ 토스페이먼츠 개발자센터에 등록만 하면 바로 작동

---

## 📝 웹훅 등록 방법

### 1단계: 웹훅 URL 확인

**프로덕션 웹훅 URL:**
```
https://live.ur-team.com/api/payments/webhook
```

**테스트 웹훅 URL (선택사항):**
```
https://7de63cec.ur-live.pages.dev/api/payments/webhook
```

### 2단계: 토스페이먼츠 개발자센터에서 웹훅 등록

#### 📍 개발자센터 접속

1. **토스페이먼츠 개발자센터 로그인**  
   👉 https://developers.tosspayments.com/

2. **상점 관리 > 웹훅 설정**  
   👉 https://developers.tosspayments.com/my/merchant/webhook

#### 🔧 웹훅 설정

**입력 정보:**

| 항목 | 값 |
|------|-----|
| **웹훅 URL** | `https://live.ur-team.com/api/payments/webhook` |
| **HTTP 메서드** | `POST` |
| **Content-Type** | `application/json` |

**수신할 이벤트 선택:**

- [x] **가상계좌 입금 완료** (VIRTUAL_ACCOUNT_ISSUED)
- [x] **결제 상태 변경** (PAYMENT_STATUS_CHANGED)
- [ ] 정기 결제 (필요 시)
- [ ] 환불 완료 (필요 시)

#### 🧪 웹훅 테스트

1. **"웹훅 테스트" 버튼 클릭**
2. **테스트 이벤트 전송**
3. **응답 확인**: 
   ```json
   {
     "success": true
   }
   ```

---

## 🔍 웹훅 동작 확인

### 브라우저 로그 확인 (개발 환경)

웹훅이 정상적으로 수신되면 다음 로그가 출력됩니다:

```
[Webhook] 토스페이먼츠 웹훅 수신: {
  eventType: "PAYMENT_STATUS_CHANGED",
  orderId: "ORDER_1234567890_...",
  status: "DONE",
  timestamp: "2024-01-15T12:34:56.789Z"
}
[Webhook] 결제 상태 변경: { orderId: "ORDER_1234567890_...", status: "DONE" }
```

### 프로덕션 로그 확인

Cloudflare Pages 로그 확인:

```bash
# 실시간 로그 확인 (로컬에서)
npx wrangler pages deployment tail ur-live

# 또는 Cloudflare Dashboard에서 확인
https://dash.cloudflare.com/
→ Pages → ur-live → Logs
```

---

## 🛡️ 웹훅 보안

### 1. IP 화이트리스트 (선택사항)

토스페이먼츠 서버 IP만 허용:

```typescript
// src/index.tsx - /api/payments/webhook 엔드포인트에 추가
app.post('/api/payments/webhook', async (c) => {
  // 토스페이먼츠 IP 체크 (선택사항)
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
  
  const allowedIPs = [
    '52.79.128.0/20',  // 토스페이먼츠 IP 대역 예시
    // 실제 IP는 토스페이먼츠 문서 참고
  ];
  
  // IP 검증 로직 (선택사항)
  
  // ... 기존 로직
});
```

### 2. 시그니처 검증 (권장)

토스페이먼츠는 웹훅 요청에 서명을 포함합니다:

```typescript
app.post('/api/payments/webhook', async (c) => {
  const signature = c.req.header('X-TossPayments-Signature');
  const body = await c.req.text();
  
  // 시그니처 검증 (권장)
  // 자세한 방법은 토스페이먼츠 공식 문서 참고
  
  // ... 기존 로직
});
```

---

## 📊 웹훅 이벤트 종류

### 현재 구현된 이벤트

| 이벤트 타입 | 설명 | 핸들러 함수 |
|-----------|------|-----------|
| `PAYMENT_STATUS_CHANGED` | 결제 상태 변경 | `handlePaymentStatusChanged` |
| `VIRTUAL_ACCOUNT_ISSUED` | 가상계좌 발급 | `handleVirtualAccountIssued` |

### 추가 가능한 이벤트

| 이벤트 타입 | 설명 | 구현 필요 여부 |
|-----------|------|--------------|
| `PAYMENT_COMPLETED` | 결제 완료 | 선택사항 |
| `PAYMENT_CANCELED` | 결제 취소 | 환불 기능 시 필요 |
| `REFUND_COMPLETED` | 환불 완료 | 환불 기능 시 필요 |

---

## 🧪 웹훅 테스트 방법

### 로컬 개발 환경에서 테스트

#### 방법 1: ngrok 사용 (권장)

```bash
# 1. ngrok 설치 (https://ngrok.com/)
brew install ngrok  # macOS
# 또는
npm install -g ngrok

# 2. 로컬 서버 실행
cd /home/user/webapp
pm2 start ecosystem.config.cjs

# 3. ngrok 터널 생성
ngrok http 3000

# 4. ngrok URL을 토스페이먼츠 웹훅 URL로 등록
# 예: https://abc123.ngrok.io/api/payments/webhook
```

#### 방법 2: 수동 테스트

```bash
# curl로 직접 웹훅 요청 전송
curl -X POST https://live.ur-team.com/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "PAYMENT_STATUS_CHANGED",
    "orderId": "ORDER_TEST_123",
    "status": "DONE",
    "paymentKey": "test_payment_key_123"
  }'
```

### 응답 확인

**성공 응답:**
```json
{
  "success": true
}
```

**실패 응답:**
```json
{
  "success": false,
  "error": "에러 메시지"
}
```

---

## 🔧 문제 해결

### 문제 1: 웹훅이 수신되지 않음

**원인:**
- 웹훅 URL이 잘못 등록됨
- 서버가 다운되어 있음
- 방화벽이 토스페이먼츠 IP를 차단함

**해결:**
```bash
# 1. 웹훅 URL 확인
curl https://live.ur-team.com/api/payments/webhook

# 2. 서버 상태 확인
curl https://live.ur-team.com/api/health

# 3. 로그 확인
npx wrangler pages deployment tail ur-live
```

### 문제 2: 웹훅 처리 실패

**원인:**
- DB 연결 실패
- 잘못된 데이터 형식

**해결:**
```typescript
// 웹훅 핸들러에 에러 로깅 추가
app.post('/api/payments/webhook', async (c) => {
  try {
    // ... 기존 로직
  } catch (err) {
    console.error('[Webhook] ❌ 처리 실패:', {
      error: (err as Error).message,
      stack: (err as Error).stack,
      body: await c.req.json()
    });
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
```

---

## 📚 참고 문서

**토스페이먼츠 공식 문서:**
- 웹훅 가이드: https://docs.tosspayments.com/guides/v2/payments/webhook
- 웹훅 이벤트 목록: https://docs.tosspayments.com/reference/webhook

**프로젝트 문서:**
- 결제 테스트 가이드: `PAYMENT_TEST_GUIDE.md`
- 모바일 결제 가이드: `MOBILE_PAYMENT_INTENT_URL_FIX.md`

---

## ✅ 체크리스트

웹훅 설정 전 확인사항:

- [ ] 가상계좌/정기결제를 사용할 계획이 있는가?
- [ ] 웹훅 엔드포인트가 정상 작동하는가? (`/api/payments/webhook`)
- [ ] 프로덕션 URL이 HTTPS인가? (필수)
- [ ] 토스페이먼츠 개발자센터 접근 권한이 있는가?
- [ ] 웹훅 테스트를 완료했는가?

---

## 🎯 요약

### 현재 상황: **웹훅 등록 불필요** ✅

- 카드/간편결제는 즉시 승인되므로 웹훅 없이도 정상 작동
- successUrl → PaymentSuccessPage → `/api/payments/confirm` 흐름으로 충분

### 웹훅이 필요한 시점:

1. **가상계좌** 결제를 추가할 때 → **필수**
2. **정기 결제**를 구현할 때 → **필수**
3. **환불/취소** 상태를 실시간으로 추적하고 싶을 때 → **권장**

### 웹훅 엔드포인트:

```
✅ 이미 구현됨: /api/payments/webhook (index.tsx L4185)
⏳ 토스페이먼츠 개발자센터에 등록만 하면 즉시 작동
```

---

**✨ 현재는 웹훅 등록이 필요 없습니다!**  
**나중에 가상계좌/정기결제를 추가할 때 이 가이드를 참고하세요! 📋**
