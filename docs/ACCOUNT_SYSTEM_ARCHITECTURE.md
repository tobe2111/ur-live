# 🔐 계정 시스템 구조 설명

## 📊 시스템 아키텍처

### **1명의 사람 = 여러 개의 독립적인 계정**

```
실제 사람 (김철수)
│
├─ 일반 유저 계정
│  ├─ email: kim@gmail.com
│  ├─ user_id: 3
│  ├─ user_session_token: 'user_3_xxx'
│  └─ 권한: 제품 구매, 주문, 장바구니
│
├─ 셀러 계정 (별도 가입)
│  ├─ email: seller@shop.com
│  ├─ seller_id: 5
│  ├─ seller_session_token: 'seller_5_xxx'
│  └─ 권한: 제품 등록/관리, 라이브 방송, 주문 관리
│
└─ (각 계정은 완전히 독립적, 별도 로그인 필요)

관리자 계정 (단 1명)
├─ email: admin@ur-team.com
├─ admin_id: 1
├─ admin_session_token: 'admin_1_xxx'
└─ 권한: 전체 시스템 관리
```

---

## 🔄 사용 시나리오

### **시나리오 1: 유저 → 셀러 전환**

김철수씨는 쇼핑도 하고 판매도 합니다:

```
1. 일반 유저로 로그인
   - email: kim@gmail.com
   - localStorage: { user_type: 'user', user_session_token: 'user_3_xxx' }
   - 제품 구매 ✅
   
2. 로그아웃

3. 셀러 계정으로 로그인
   - email: seller@shop.com
   - localStorage: { user_type: 'seller', seller_session_token: 'seller_5_xxx' }
   - 제품 판매 ✅
   
4. 로그아웃

5. 다시 일반 유저로 로그인
   - 제품 구매 ✅
```

### **시나리오 2: 새로운 셀러 가입**

이미 일반 유저였던 사람이 셀러로 전환:

```
1. 현재: 일반 유저 계정만 있음
   - kim@gmail.com
   
2. 셀러 가입 (/seller/register)
   - 새로운 셀러 계정 생성
   - email: seller@shop.com (다른 이메일)
   - seller_id: 5 (새로운 ID)
   
3. 이제 2개 계정 보유
   - 유저 계정: kim@gmail.com
   - 셀러 계정: seller@shop.com
```

---

## 🔐 localStorage 관리

### **유저로 로그인 시**
```javascript
localStorage = {
  user_type: 'user',
  user_session_token: 'user_3_1234567890_abc',
  user_id: '3',
  user_name: '김철수'
}

// API 요청
GET /api/cart
Authorization: Bearer user_3_1234567890_abc ✅
```

### **셀러로 로그인 시 (로그아웃 후)**
```javascript
localStorage = {
  user_type: 'seller',
  seller_session_token: 'seller_5_9876543210_xyz',
  seller_id: '5',
  seller_name: '철수네 가게',
  seller_email: 'seller@shop.com'
}

// API 요청
GET /api/seller/products
Authorization: Bearer seller_5_9876543210_xyz ✅
```

### **관리자로 로그인 시**
```javascript
localStorage = {
  user_type: 'admin',
  admin_session_token: 'admin_1_5555555555_admin',
  admin_id: '1',
  admin_name: '시스템 관리자'
}

// API 요청
GET /api/admin/users
Authorization: Bearer admin_1_5555555555_admin ✅
```

---

## ⚙️ API 토큰 선택 로직

### **구현 코드 (`src/lib/api.ts`)**

```typescript
// 요청 인터셉터: 현재 로그인된 계정 타입에 따라 토큰 선택
api.interceptors.request.use((config) => {
  const userType = localStorage.getItem('user_type')
  let token: string | null = null
  
  // 현재 로그인된 계정 타입에 맞는 토큰 선택
  if (userType === 'seller') {
    token = localStorage.getItem('seller_session_token')
  } else if (userType === 'admin') {
    token = localStorage.getItem('admin_session_token')
  } else {
    token = localStorage.getItem('user_session_token')
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  
  return config
})
```

### **왜 이렇게 구현했는가?**

1. **계정 독립성**: 각 계정은 완전히 독립적
2. **세션 분리**: 한 번에 하나의 계정만 로그인
3. **보안**: 다른 계정의 토큰 사용 방지
4. **단순성**: user_type 하나로 모든 API 요청 처리

---

## 🚫 잘못된 시나리오 (방지됨)

### **❌ 동시에 여러 계정 로그인?**

```
김철수씨가 유저 계정과 셀러 계정을 동시에 로그인?
→ ❌ 불가능!

이유:
- localStorage의 user_type은 하나만 존재
- 로그인 시 이전 세션은 덮어씌워짐
- 한 번에 하나의 계정만 활성화
```

### **✅ 올바른 사용법**

```
1. 유저 계정으로 쇼핑
2. 로그아웃
3. 셀러 계정으로 판매
4. 로그아웃
5. 다시 유저 계정으로 쇼핑
```

---

## 🔄 로그인/로그아웃 흐름

### **로그인 시**
```typescript
// 1. API 호출
POST /api/auth/login
{
  username: 'seller@shop.com',
  password: 'xxx',
  userType: 'seller'  // 중요!
}

// 2. 응답
{
  success: true,
  data: {
    sessionToken: 'seller_5_xxx',
    user: { id: 5, type: 'seller', ... }
  }
}

// 3. localStorage 저장
localStorage.setItem('user_type', 'seller')
localStorage.setItem('seller_session_token', 'seller_5_xxx')
localStorage.setItem('seller_id', '5')

// 4. 이전 세션 자동 제거 (로그아웃 효과)
// user_session_token은 사라짐 (또는 무시됨)
```

### **로그아웃 시**
```typescript
// localStorage 클리어
localStorage.removeItem('user_type')
localStorage.removeItem('seller_session_token')
localStorage.removeItem('seller_id')
// ... 기타 관련 키
```

---

## 📊 API 엔드포인트 권한

### **일반 유저 전용** (user_session_token 필요)
```
GET  /api/products         # 제품 목록
GET  /api/products/:id     # 제품 상세
POST /api/cart             # 장바구니 추가
GET  /api/cart             # 장바구니 조회
POST /api/orders           # 주문 생성
GET  /api/orders           # 주문 내역
```

### **셀러 전용** (seller_session_token 필요)
```
GET  /api/seller/stats     # 매출 통계
GET  /api/seller/products  # 내 제품 관리
POST /api/seller/products  # 제품 등록
GET  /api/seller/orders    # 주문 관리
GET  /api/seller/streams   # 라이브 스트림 관리
POST /api/seller/streams   # 라이브 생성
```

### **관리자 전용** (admin_session_token 필요)
```
GET  /api/admin/users      # 전체 사용자 관리
GET  /api/admin/sellers    # 셀러 승인 관리
GET  /api/admin/settlement # 정산 관리
POST /api/admin/approve    # 셀러 승인
```

---

## 🎯 핵심 포인트

1. **1명의 사람 = 여러 독립적인 계정 가능**
   - 유저 계정 + 셀러 계정 동시 보유 ✅
   - 하지만 동시 로그인은 불가 ❌

2. **각 계정은 별도 로그인 필요**
   - 유저 → 로그아웃 → 셀러 로그인
   - 셀러 → 로그아웃 → 유저 로그인

3. **user_type이 현재 활성 계정 결정**
   - user_type='user' → user_session_token 사용
   - user_type='seller' → seller_session_token 사용
   - user_type='admin' → admin_session_token 사용

4. **관리자는 딱 1명**
   - admin_id: 1
   - 시스템 전체 관리 권한

---

## 🔧 구현 완료 체크리스트

- [x] 유저/셀러/관리자 독립적인 로그인
- [x] user_type 기반 토큰 선택
- [x] 로그인 시 이전 세션 덮어쓰기
- [x] 401 에러 시 적절한 로그인 페이지로 리다이렉트
- [x] 각 계정 타입별 API 엔드포인트 권한 분리

---

**작성 일자**: 2026-02-19  
**버전**: 1.0  
**상태**: ✅ 완료
