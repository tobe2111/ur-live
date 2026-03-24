# PG 승인 이후 구현 체크리스트

## 🎯 개요

**PG 승인(전자결제 계약 완료) 이후** 반드시 수행해야 할 작업들입니다.

---

## ✅ 필수 작업

### 1. API 키 교체 (테스트 → 라이브)

#### 현재 (테스트 키)
```env
# .env
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
```

#### PG 승인 후 (라이브 키)
```env
# .env (운영)
VITE_TOSS_CLIENT_KEY=live_gck_XXXXXXXXXX  # 개발자센터에서 발급
TOSS_SECRET_KEY=live_gsk_XXXXXXXXXX       # 개발자센터에서 발급
```

**⚠️ 주의사항**:
- 라이브 키는 **실제 결제**가 발생합니다
- 절대 GitHub, 클라이언트에 노출 금지
- Cloudflare Workers 환경변수로 설정

---

### 2. Cloudflare Pages 환경변수 설정

#### Cloudflare Dashboard에서 설정
```
1. https://dash.cloudflare.com/ 접속
2. Pages → toss-live-commerce 선택
3. Settings → Environment variables
4. Production 탭에서 추가:

   VITE_TOSS_CLIENT_KEY = live_gck_XXXXXXXXXX
   TOSS_SECRET_KEY = live_gsk_XXXXXXXXXX
```

---

### 3. Toss Payments 개발자센터 설정

#### 3-1. 라이브 환경 redirectUrl 등록
```
URL: https://developers.tosspayments.com/my/brandpay
작업: 리다이렉트 URL 추가

테스트 환경:
https://live.ur-team.com/api/brandpay/callback  ✅ (이미 등록됨)

라이브 환경:
https://live.ur-team.com/api/brandpay/callback  ⚠️ (라이브 키로 재등록 필요)
```

#### 3-2. MID(상점 아이디) 확인
```
URL: https://developers.tosspayments.com/my/api-keys
작업: 계약 완료된 MID 확인 및 선택
```

#### 3-3. 결제위젯 어드민 설정
```
URL: https://app.tosspayments.com/
작업: 
1. 브랜드페이 서비스 활성화 확인
2. 결제 UI 커스터마이징 (필요 시)
3. 제공 결제수단 확인 (카드, 계좌이체, 가상계좌 등)
```

---

### 4. 결제 승인 API 구현 검증

#### 현재 구현 확인
```typescript
// src/index.tsx - 결제 승인 API
// ✅ 이미 구현됨: confirmPayment()

// 확인 필요 사항:
1. paymentKey, orderId, amount 검증
2. 중복 결제 방지 로직
3. DB 저장 로직
4. 에러 핸들링
```

#### 체크리스트
- [ ] `POST /api/payment/confirm` 엔드포인트 존재 확인
- [ ] 결제 정보 DB 저장 (orders, payments 테이블)
- [ ] 중복 결제 방지 (orderId 중복 체크)
- [ ] 금액 검증 (클라이언트 vs 서버)
- [ ] 에러 로깅
- [ ] 웹훅 구현 (가상계좌 등)

---

### 5. 결제 성공/실패 페이지 구현 검증

#### PaymentSuccessPage
```typescript
// src/pages/PaymentSuccessPage.tsx
// ✅ 이미 구현됨

// 확인 필요:
1. paymentKey로 결제 정보 조회
2. 주문 정보 표시
3. 주문 번호, 결제 금액 표시
4. 결제 영수증 링크
```

#### PaymentFailPage
```typescript
// src/pages/PaymentFailPage.tsx
// ✅ 이미 구현됨

// 확인 필요:
1. 에러 코드, 메시지 표시
2. 재시도 버튼
3. 고객센터 안내
```

---

### 6. 보안 강화

#### 6-1. 금액 검증 (서버 사이드)
```typescript
// ⚠️ 클라이언트에서 전달받은 금액 vs DB의 실제 금액 비교
// 중요: 클라이언트 금액을 그대로 믿으면 안 됨!

app.post('/api/payment/confirm', async (c) => {
  const { paymentKey, orderId, amount } = await c.req.json()
  
  // 1. DB에서 주문 정보 조회
  const order = await c.env.DB.prepare(`
    SELECT total_amount FROM orders WHERE order_id = ?
  `).bind(orderId).first()
  
  // 2. 금액 검증
  if (!order || order.total_amount !== amount) {
    return c.json({ 
      success: false, 
      error: '결제 금액이 일치하지 않습니다.' 
    }, 400)
  }
  
  // 3. Toss Payments API 호출
  // ...
})
```

#### 6-2. CSRF 토큰 (선택 사항)
```typescript
// 결제 요청 시 CSRF 토큰 추가
// 외부에서 결제 API를 직접 호출하지 못하도록 방어
```

#### 6-3. Rate Limiting
```typescript
// 동일 사용자의 연속 결제 요청 제한
// DDoS 공격 방어
```

---

### 7. 웹훅 구현

#### 7-1. 웹훅 엔드포인트 생성
```typescript
// src/index.tsx
app.post('/api/webhooks/toss', async (c) => {
  try {
    const event = await c.req.json()
    
    // 웹훅 시그니처 검증
    const signature = c.req.header('Toss-Signature')
    // ... 검증 로직
    
    // 이벤트 타입별 처리
    switch (event.eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        // 결제 상태 변경 (가상계좌 입금 등)
        break
      case 'DEPOSIT_CALLBACK':
        // 가상계좌 입금 완료
        break
    }
    
    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false }, 500)
  }
})
```

#### 7-2. 웹훅 URL 등록
```
URL: https://developers.tosspayments.com/my/settings
작업: 웹훅 URL 등록

웹훅 URL: https://live.ur-team.com/api/webhooks/toss
```

---

### 8. 테스트 시나리오

#### 8-1. 카드 결제
```
1. 로그인
2. 상품 장바구니 담기
3. 체크아웃
4. 카드 정보 입력
5. 결제 완료 확인
6. DB 저장 확인
7. 영수증 확인
```

#### 8-2. 브랜드페이 (처음)
```
1. 로그인
2. 체크아웃
3. 브랜드페이 선택
4. 카드 등록
5. 비밀번호 설정
6. /api/brandpay/callback 호출 확인
7. DB 토큰 저장 확인
8. 결제 완료
```

#### 8-3. 브랜드페이 (이후)
```
1. 로그인
2. 체크아웃
3. 등록된 카드 표시 확인
4. 비밀번호만 입력
5. 간편 결제 완료
```

#### 8-4. 가상계좌
```
1. 가상계좌 발급
2. 입금 대기
3. 웹훅으로 입금 알림 수신 확인
4. 결제 완료 처리
```

#### 8-5. 결제 취소
```
1. 결제 완료된 주문
2. 관리자/사용자가 취소 요청
3. cancelPayment() API 호출
4. 환불 처리 확인
```

---

### 9. 모니터링 & 로깅

#### 9-1. 결제 로그
```typescript
// 모든 결제 요청/응답 로깅
console.log('[Payment] Request:', {
  orderId,
  amount,
  userId,
  timestamp: new Date().toISOString()
})

console.log('[Payment] Response:', {
  paymentKey,
  status,
  timestamp: new Date().toISOString()
})
```

#### 9-2. 에러 트래킹
```typescript
// Sentry 또는 다른 에러 트래킹 도구 연동
// 결제 실패 알림
```

#### 9-3. 대시보드
```
Toss Payments 개발자센터에서 실시간 모니터링:
- 결제 성공/실패율
- 평균 결제 금액
- 결제수단별 통계
```

---

### 10. 운영 체크리스트

#### 배포 전
- [ ] 라이브 API 키 발급 완료
- [ ] Cloudflare 환경변수 설정 완료
- [ ] redirectUrl 라이브 환경 등록 완료
- [ ] 웹훅 URL 등록 완료
- [ ] 테스트 완료 (모든 결제수단)
- [ ] 에러 핸들링 확인
- [ ] 로깅 설정 완료

#### 배포 후
- [ ] 실제 카드로 소액 결제 테스트
- [ ] 브랜드페이 등록 테스트
- [ ] 가상계좌 발급 테스트
- [ ] 결제 취소 테스트
- [ ] 웹훅 수신 확인
- [ ] 영수증 발급 확인

#### 운영 중
- [ ] 일일 결제 통계 확인
- [ ] 에러 로그 모니터링
- [ ] 결제 실패율 추적
- [ ] 고객 문의 응대 (결제 관련)

---

## 🚨 주의사항

### 1. 절대 하지 말아야 할 것
```
❌ 라이브 키를 GitHub에 커밋
❌ 라이브 키를 클라이언트 코드에 포함
❌ 금액 검증 없이 결제 승인
❌ 중복 결제 방지 로직 없이 운영
❌ 에러 처리 없이 배포
```

### 2. 반드시 해야 할 것
```
✅ 라이브 키는 환경변수로만 관리
✅ 서버 사이드에서 금액 검증
✅ 모든 결제 요청 로깅
✅ 웹훅 시그니처 검증
✅ 에러 알림 설정
```

---

## 📚 공식 문서 참고

### 필수 문서
1. [브랜드페이 연동 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration-brandpay)
2. [결제 승인 API](https://docs.tosspayments.com/reference#결제-승인)
3. [웹훅](https://docs.tosspayments.com/reference/webhook)
4. [에러 코드](https://docs.tosspayments.com/reference/error-codes)
5. [보안 가이드](https://docs.tosspayments.com/blog/secret-key-best-practice)

---

## 🎯 최종 점검

PG 승인 후 배포 전 **반드시** 체크:

```
□ 라이브 API 키 발급 ✅
□ Cloudflare 환경변수 설정 ✅
□ redirectUrl 라이브 등록 ✅
□ 웹훅 URL 등록 ✅
□ 금액 검증 로직 ✅
□ 중복 결제 방지 ✅
□ 에러 핸들링 ✅
□ 로깅 ✅
□ 테스트 완료 ✅
□ 모니터링 설정 ✅
```

**모든 항목이 체크되면 운영 배포 가능합니다!** 🚀

---

## 💡 추가 개선 사항 (선택)

### 1. 결제 재시도 로직
```typescript
// 결제 실패 시 자동 재시도 (네트워크 오류 등)
async function retryPayment(paymentFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await paymentFn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

### 2. 결제 대기 시간 타임아웃
```typescript
// 결제창 열린 후 N분 이내 결제하지 않으면 주문 자동 취소
const PAYMENT_TIMEOUT = 30 * 60 * 1000 // 30분
```

### 3. 구매자 알림
```typescript
// 결제 완료 후 이메일/SMS 알림
// 가상계좌 발급 시 알림
```

---

**이 체크리스트를 철저하게 따라서 PG 승인 이후 안전하게 운영하세요!** ✅
