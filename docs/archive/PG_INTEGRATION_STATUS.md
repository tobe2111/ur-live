# PG 통합 현황 분석 보고서

## 📊 현재 상태 요약

### ✅ **결론: PG 교체 유연성이 있습니다만, 개선이 필요합니다**

**현재 평가: ⚠️ 부분적으로 유연함 (60/100점)**

---

## 🔍 상세 분석

### 1️⃣ **현재 구현된 PG사**

| PG사 | 상태 | 환경변수 | 하드코딩 여부 |
|------|------|---------|------------|
| **NicePay** | ✅ 구현됨 | `c.env.NICEPAY_CLIENT_ID`, `c.env.NICEPAY_SECRET_KEY`, `c.env.NICEPAY_MID` | ⚠️ 일부 하드코딩 |
| **Toss Payments** | 📝 언급만 있음 | 없음 | ❌ 미구현 |
| **PortOne (구 아임포트)** | ❌ 없음 | 없음 | ❌ 미구현 |

---

### 2️⃣ **환경변수 관리**

#### **✅ 좋은 점:**
```typescript
// 환경변수 사용 (src/index.tsx)
const NICEPAY_CLIENT_ID = c.env.NICEPAY_CLIENT_ID;
const NICEPAY_SECRET_KEY = c.env.NICEPAY_SECRET_KEY;
const NICEPAY_MID = c.env.NICEPAY_MID;
```

#### **⚠️ 문제점:**
```typescript
// 하드코딩된 fallback 값
html.replace('%%NICEPAY_CLIENT_ID%%', 
  c.env.NICEPAY_CLIENT_ID || 'S2_d5ec29558e9d46419bf01eb828ca0834'  // ❌ 테스트 키 하드코딩
)
html.replace('%%NICEPAY_MID%%', 
  c.env.NICEPAY_MID || 'nictest00m'  // ❌ 테스트 MID 하드코딩
)
```

#### **환경변수 파일 현황:**
- `.dev.vars` (로컬): ✅ 존재 (Kakao만)
- `wrangler.jsonc`: ❌ PG 환경변수 없음
- Cloudflare Secrets: ❓ 설정 여부 불명

---

### 3️⃣ **결제 플로우 구조**

#### **A. Frontend (CheckoutPage.tsx)**
```typescript
// ⚠️ 현재: 결제 기능 비활성화
<Button onClick={() => alert('결제 서비스 준비 중입니다.')}>
  주문 문의하기
</Button>
```

**문제점:**
- 실제 결제 통합 없음
- PG 선택 로직 없음
- 단일 PG만 가정

#### **B. Backend (src/index.tsx)**

**주문 생성 API:**
```typescript
app.post('/api/orders', async (c) => {
  // ✅ PG와 독립적인 주문 생성
  // - 장바구니 → 주문 변환
  // - 재고 차감
  // - 주문 번호 생성
})
```

**NicePay 콜백:**
```typescript
app.post('/api/payments/nicepay/callback', async (c) => {
  // ⚠️ NicePay 전용 로직
  // - authResultCode 파싱
  // - NicePay API 호출
  // - 주문 상태 업데이트
})

app.post('/api/payments/nicepay/cancel', async (c) => {
  // ⚠️ NicePay 전용 취소 로직
})
```

---

### 4️⃣ **아키텍처 평가**

#### **✅ 잘된 점:**

1. **주문과 결제 분리**
   ```
   주문 생성 → 결제 → 결제 콜백 → 주문 완료
   ```
   - `/api/orders`: PG 독립적 ✅
   - 주문 번호 선생성 ✅

2. **환경변수 사용**
   - 코드에서 `c.env` 사용 ✅

#### **❌ 문제점:**

1. **PG 로직이 하드코딩됨**
   ```typescript
   // ❌ NicePay 전용 콜백
   app.post('/api/payments/nicepay/callback', ...)
   
   // ❌ NicePay 전용 취소
   app.post('/api/payments/nicepay/cancel', ...)
   ```

2. **PG 추상화 레이어 없음**
   - Strategy Pattern 미적용
   - 각 PG별 별도 구현 필요

3. **설정 파일 미완성**
   - `wrangler.jsonc`에 PG 환경변수 없음
   - `.dev.vars`에 NicePay 설정 없음

---

## 📋 PG 교체 시나리오

### **시나리오 1: NicePay → Toss Payments**

#### **필요한 작업:**

1. **환경변수 추가**
   ```bash
   # wrangler.jsonc (또는 Cloudflare Secrets)
   TOSS_CLIENT_KEY=xxx
   TOSS_SECRET_KEY=xxx
   ```

2. **API 엔드포인트 추가**
   ```typescript
   // src/index.tsx
   app.post('/api/payments/toss/callback', async (c) => {
     // Toss 콜백 처리
   })
   
   app.post('/api/payments/toss/cancel', async (c) => {
     // Toss 취소 처리
   })
   ```

3. **Frontend 수정**
   ```typescript
   // CheckoutPage.tsx
   // Toss Payment Widget 연동
   ```

**예상 작업량:** ⚠️ **3~5일** (중규모)

---

### **시나리오 2: 멀티 PG 지원 (NicePay + Toss)**

#### **필요한 작업:**

1. **PG 추상화 레이어 구축**
   ```typescript
   // src/services/payment/PaymentProvider.ts
   interface PaymentProvider {
     requestPayment(order: Order): Promise<PaymentRequest>
     verifyPayment(data: any): Promise<PaymentResult>
     cancelPayment(orderId: string): Promise<CancelResult>
   }
   
   class NicePayProvider implements PaymentProvider { ... }
   class TossPayProvider implements PaymentProvider { ... }
   ```

2. **설정 기반 PG 선택**
   ```typescript
   // wrangler.jsonc
   {
     "vars": {
       "DEFAULT_PG": "nicepay",  // or "toss"
       "AVAILABLE_PGS": ["nicepay", "toss"]
     }
   }
   ```

3. **통합 콜백 핸들러**
   ```typescript
   app.post('/api/payments/callback', async (c) => {
     const pg = c.req.query('pg')  // nicepay or toss
     const provider = getPaymentProvider(pg)
     return await provider.verifyPayment(await c.req.json())
   })
   ```

**예상 작업량:** ⚠️ **1~2주** (대규모 리팩토링)

---

## 🎯 권장 개선 사항

### **Priority 1: 즉시 개선 (1일)**

1. **하드코딩 제거**
   ```typescript
   // ❌ Before
   c.env.NICEPAY_CLIENT_ID || 'S2_...'
   
   // ✅ After
   if (!c.env.NICEPAY_CLIENT_ID) {
     throw new Error('NICEPAY_CLIENT_ID not configured')
   }
   const clientId = c.env.NICEPAY_CLIENT_ID
   ```

2. **환경변수 문서화**
   ```bash
   # .dev.vars.example
   NICEPAY_CLIENT_ID=your_client_id
   NICEPAY_SECRET_KEY=your_secret_key
   NICEPAY_MID=your_merchant_id
   
   # Optional: for multi-PG
   TOSS_CLIENT_KEY=
   TOSS_SECRET_KEY=
   ```

3. **Cloudflare Secrets 설정**
   ```bash
   npx wrangler secret put NICEPAY_CLIENT_ID
   npx wrangler secret put NICEPAY_SECRET_KEY
   npx wrangler secret put NICEPAY_MID
   ```

---

### **Priority 2: 단기 개선 (3~5일)**

1. **PG 추상화 인터페이스 정의**
   ```typescript
   // src/types/payment.ts
   export interface PaymentProvider {
     name: 'nicepay' | 'toss' | 'portone'
     requestPayment(params: PaymentRequest): Promise<PaymentResponse>
     verifyCallback(data: any): Promise<VerifyResult>
     cancelPayment(params: CancelRequest): Promise<CancelResponse>
   }
   ```

2. **설정 기반 PG 초기화**
   ```typescript
   // src/services/payment/index.ts
   export function getPaymentProvider(pg?: string): PaymentProvider {
     const pgName = pg || process.env.DEFAULT_PG || 'nicepay'
     
     switch (pgName) {
       case 'nicepay': return new NicePayProvider()
       case 'toss': return new TossPayProvider()
       default: throw new Error(`Unknown PG: ${pgName}`)
     }
   }
   ```

---

### **Priority 3: 중기 개선 (1~2주)**

1. **멀티 PG 지원 구조**
2. **PG별 수수료 관리**
3. **PG 상태 모니터링**
4. **PG 자동 장애조치 (Failover)**

---

## 📊 현재 유연성 점수

| 항목 | 점수 | 설명 |
|------|------|------|
| **환경변수 분리** | 70/100 | ✅ 사용하지만 하드코딩 fallback 있음 |
| **PG 추상화** | 20/100 | ❌ 추상화 레이어 없음 |
| **설정 관리** | 40/100 | ⚠️ .dev.vars만 있고 wrangler.jsonc 미설정 |
| **멀티 PG 지원** | 0/100 | ❌ 단일 PG만 지원 |
| **문서화** | 30/100 | ⚠️ 부족 |

**종합 점수:** **32/100** (낮음)

---

## ✅ 결론

### **질문: PG사는 언제든 교체 유연하게 할 수 있도록 설정되어 있나?**

**답변:** ⚠️ **부분적으로 가능하지만, 상당한 코드 수정이 필요합니다**

#### **현재 상태:**
- ✅ 주문과 결제가 분리되어 있어 기본 구조는 좋음
- ⚠️ 환경변수 사용하지만 하드코딩 fallback 존재
- ❌ PG별 전용 엔드포인트 (`/api/payments/nicepay/*`)
- ❌ 추상화 레이어 없어서 각 PG마다 별도 구현 필요

#### **교체 난이도:**
- **NicePay → 다른 단일 PG**: ⚠️ 중간 (3~5일)
- **멀티 PG 지원**: ⚠️ 높음 (1~2주)

#### **즉시 개선 권장사항:**
1. 하드코딩 제거
2. Cloudflare Secrets 설정
3. `.dev.vars.example` 생성
4. PG 설정 문서화

