# 배송지 저장 API 오류 수정

## ⚠️ 문제 상황

**에러 메시지:**
```
api/shipping-addresses:1  Failed to load resource: the server responded with a status of 400 ()
배송지 저장에 실패했습니다.
```

**증상:**
- 새 배송지 추가 시 400 Bad Request 오류 발생
- "배송지 저장에 실패했습니다" 메시지 표시
- 배송지가 DB에 저장되지 않음

---

## 🔍 근본 원인

### **필드명 불일치 (snake_case vs camelCase)**

프론트엔드와 백엔드 사이에 필드명 규칙이 다름:

#### ❌ Before (문제 코드)

**프론트엔드 (CheckoutPage.tsx):**
```tsx
// ✅ snake_case로 전송
const response = await axios.post('/api/shipping-addresses', {
  user_id: parseInt(userId),          // snake_case
  recipient_name: newAddress.recipient_name,
  phone: newAddress.phone,
  postal_code: newAddress.postal_code,
  address: newAddress.address,
  address_detail: newAddress.address_detail,
  is_default: newAddress.is_default
})
```

**백엔드 (src/index.tsx):**
```tsx
// ❌ camelCase로 받기 시도
const { userId, recipientName, phone, postalCode, address, addressDetail, isDefault } = await c.req.json();
//      ^^^^^^  ^^^^^^^^^^^^^        ^^^^^^^^^^                                        ^^^^^^^^^
//      camelCase로 받으려 함

if (!userId || !recipientName || !phone || !address) {
  return c.json({ success: false, error: '필수 정보를 입력해주세요' }, 400);
}
```

**결과:**
- `userId`는 undefined (실제로는 `user_id`로 전송됨)
- `recipientName`은 undefined (실제로는 `recipient_name`으로 전송됨)
- 필수 검증에서 실패 → 400 Bad Request 반환

---

## ✅ 해결 방법

### 1. **백엔드에서 snake_case로 받기**

프론트엔드가 보내는 형식(snake_case)에 맞춰 백엔드 수정:

```tsx
app.post('/api/shipping-addresses', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    // ✅ snake_case로 받기 (프론트엔드가 snake_case로 전송)
    const body = await c.req.json();
    const userId = body.user_id;               // snake_case
    const recipientName = body.recipient_name; // snake_case
    const phone = body.phone;
    const postalCode = body.postal_code;       // snake_case
    const address = body.address;
    const addressDetail = body.address_detail; // snake_case
    const isDefault = body.is_default;         // snake_case
    
    console.log('[POST /api/shipping-addresses] Received:', JSON.stringify(body));
    
    if (!userId || !recipientName || !phone || !address) {
      console.error('[POST /api/shipping-addresses] Missing required fields:', { userId, recipientName, phone, address });
      return c.json({ success: false, error: '필수 정보를 입력해주세요' }, 400);
    }
    
    // ... DB 저장 로직
```

---

### 2. **중복 엔드포인트 제거**

같은 엔드포인트가 2번 정의되어 있어 혼란을 야기:

**중복 발견:**
```bash
1453:app.post('/api/shipping-addresses', cors(), async (c) => {
3146:app.post('/api/shipping-addresses', async (c) => {  # ❌ 중복!

1498:app.put('/api/shipping-addresses/:id', cors(), async (c) => {
3168:app.put('/api/shipping-addresses/:id', async (c) => {  # ❌ 중복!
```

**해결:**
- 첫 번째 엔드포인트 (1453, 1498 라인)만 유지
- 두 번째 중복 엔드포인트 (3146, 3168 라인) 제거

---

### 3. **로깅 추가**

디버깅을 위한 상세 로그 추가:

```tsx
console.log('[POST /api/shipping-addresses] Received:', JSON.stringify(body));

if (!userId || !recipientName || !phone || !address) {
  console.error('[POST /api/shipping-addresses] Missing required fields:', { userId, recipientName, phone, address });
  return c.json({ success: false, error: '필수 정보를 입력해주세요' }, 400);
}

console.log('[POST /api/shipping-addresses] Success:', { id: result.meta.last_row_id });
```

---

## 📊 Before vs After

### ❌ Before (오류 발생)

**프론트엔드 → 백엔드:**
```json
{
  "user_id": 1,           // snake_case
  "recipient_name": "홍길동",
  "phone": "010-1234-5678",
  "postal_code": "12345",
  "address": "서울시 강남구",
  "address_detail": "101호",
  "is_default": 0
}
```

**백엔드 파싱:**
```tsx
const { userId, recipientName, ... } = await c.req.json();
// userId = undefined ❌ (실제로는 user_id로 전송됨)
// recipientName = undefined ❌ (실제로는 recipient_name으로 전송됨)

if (!userId || !recipientName || ...) {
  return c.json({ error: '필수 정보를 입력해주세요' }, 400); // ❌ 400 오류
}
```

---

### ✅ After (정상 동작)

**프론트엔드 → 백엔드:** (동일)
```json
{
  "user_id": 1,
  "recipient_name": "홍길동",
  ...
}
```

**백엔드 파싱:**
```tsx
const body = await c.req.json();
const userId = body.user_id;           // ✅ 1
const recipientName = body.recipient_name; // ✅ "홍길동"

console.log('[POST] Received:', JSON.stringify(body)); // 로그 확인

if (!userId || !recipientName || ...) {
  // ✅ 모든 필드가 정상적으로 파싱됨
}

// ✅ DB 저장 성공
return c.json({ success: true, data: { id: 123 } });
```

---

## 🚀 배포 정보

| 항목 | 값 |
|------|-----|
| **Preview URL** | https://df8aca0e.toss-live-commerce.pages.dev |
| **Production URL** | https://live.ur-team.com |
| **커밋 해시** | `5109a41` |
| **배포 일시** | 2025-02-11 |

---

## ✅ 테스트 방법

### 1. 새 배송지 추가

```bash
1. https://live.ur-team.com/login
   → user@example.com / user123 로그인

2. https://live.ur-team.com/checkout 접속

3. "배송지 선택하기 (필수)" 버튼 클릭

4. "새 배송지 추가" 버튼 클릭

5. 배송지 정보 입력:
   - 받는 사람: 홍길동
   - 휴대폰 번호: 010-1234-5678
   - 주소 검색 → 주소 선택
   - 상세 주소: 101호

6. "저장" 버튼 클릭

7. ✅ "배송지가 저장되었습니다" 메시지 표시
8. ✅ 배송지 목록에 추가됨
9. ✅ 체크아웃 페이지에서 선택 가능
```

### 2. F12 콘솔 로그 확인

```bash
1. 위 1~6 단계 동일

2. F12 콘솔 열기

3. "저장" 버튼 클릭

4. ✅ 콘솔 로그 확인:
   [POST /api/shipping-addresses] Received: {"user_id":1,"recipient_name":"홍길동",...}
   [POST /api/shipping-addresses] Success: { id: 123 }
```

### 3. 네트워크 탭 확인

```bash
1. F12 → Network 탭

2. "저장" 버튼 클릭

3. ✅ POST /api/shipping-addresses 요청 확인:
   - Status: 200 OK (이전: 400 Bad Request)
   - Response: {"success":true,"data":{"id":123}}
```

---

## 📝 변경 파일

```
src/index.tsx
```

**변경 내용:**
1. ✅ POST `/api/shipping-addresses` 엔드포인트 수정 (snake_case로 받기)
2. ✅ PUT `/api/shipping-addresses/:id` 엔드포인트 수정 (snake_case로 받기)
3. ✅ 중복된 POST 엔드포인트 제거 (3146번 줄)
4. ✅ 중복된 PUT 엔드포인트 제거 (3168번 줄)
5. ✅ 상세 로그 추가 (디버깅 용이)

**코드 변경 요약:**
```diff
- const { userId, recipientName, phone, postalCode, address, addressDetail, isDefault } = await c.req.json();
+ const body = await c.req.json();
+ const userId = body.user_id;
+ const recipientName = body.recipient_name;
+ const phone = body.phone;
+ const postalCode = body.postal_code;
+ const address = body.address;
+ const addressDetail = body.address_detail;
+ const isDefault = body.is_default;
+ 
+ console.log('[POST /api/shipping-addresses] Received:', JSON.stringify(body));
```

---

## 🔑 핵심 교훈

### 1. **필드명 규칙 통일의 중요성**
- 프론트엔드와 백엔드 사이 필드명 규칙을 통일해야 함
- snake_case vs camelCase 불일치는 흔한 버그 원인
- TypeScript 인터페이스로 타입 안전성 확보 권장

### 2. **중복 코드 제거**
- 같은 엔드포인트를 여러 번 정의하면 혼란 야기
- 첫 번째 정의만 유효 (나중 것은 무시됨)
- 정기적으로 코드 검토 필요

### 3. **로깅의 중요성**
- 요청/응답 로그로 디버깅 시간 단축
- 에러 발생 시 원인 파악 용이
- 프로덕션 환경에서는 민감 정보 마스킹 필요

### 4. **API 테스트 자동화**
- 수동 테스트만으로는 한계
- Postman, curl 등으로 API 직접 테스트 권장
- 단위 테스트/통합 테스트 추가 고려

---

## 🎯 예방 조치

### 1. **TypeScript 인터페이스 활용**

```tsx
// 공통 타입 정의 (types/shipping-address.ts)
interface ShippingAddress {
  user_id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
}

// 프론트엔드
const data: ShippingAddress = { ... }
await axios.post('/api/shipping-addresses', data)

// 백엔드
const body = await c.req.json() as ShippingAddress
const userId = body.user_id // 타입 안전
```

### 2. **Zod 스키마 검증**

```tsx
import { z } from 'zod'

const ShippingAddressSchema = z.object({
  user_id: z.number(),
  recipient_name: z.string().min(1),
  phone: z.string().min(1),
  postal_code: z.string(),
  address: z.string().min(1),
  address_detail: z.string().optional(),
  is_default: z.number().int().min(0).max(1)
})

// 백엔드에서 검증
const body = ShippingAddressSchema.parse(await c.req.json())
```

---

## ✅ 최종 결과

✅ **배송지 저장 API 정상 작동**  
✅ **필드명 불일치 해결 (snake_case 통일)**  
✅ **중복 엔드포인트 제거**  
✅ **로깅 강화 (디버깅 용이)**  
✅ **400 오류 완전 해결**  

**이제 배송지 추가/수정이 완벽하게 작동합니다! 🎉**

---

## 📚 관련 문서

1. **MANDATORY_ADDRESS_IMPLEMENTATION.md** - 배송지 필수 입력 구현
2. **PAYMENT_DUPLICATE_FIX.md** - 결제 중복 요청 방지
3. **BRANDPAY_COMPLETE_IMPLEMENTATION.md** - 브랜드페이 완전 구현
4. **CHECKOUT_ERROR_DEBUG.md** - 체크아웃 오류 디버깅
5. **CHECKOUT_TEST_GUIDE.md** - 체크아웃 테스트 가이드
