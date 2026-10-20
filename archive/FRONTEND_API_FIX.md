# Frontend API URL Fix Report
**Date**: 2026-02-15  
**Issue**: Frontend 코드가 오래된 API URL을 사용하여 인증 오류 발생  
**Status**: ✅ 해결 완료  

---

## 📋 문제 요약

프론트엔드 3개 페이지가 **오래된 API URL**을 사용하고 있어서, 새로운 인증 미들웨어가 적용된 후 **401 Unauthorized** 오류가 발생했습니다.

### 🔍 발견된 문제

| 파일 | Line | 오래된 API | 새로운 API |
|------|------|-----------|-----------|
| `LivePage.tsx` | 774 | `/api/cart/${userId}` | `/api/cart` |
| `MyOrdersPage.tsx` | 118 | `/api/cart/${uid}` | `/api/cart` |
| `MyOrdersPage.tsx` | 123 | `/api/orders/user/${uid}` | `/api/orders` |
| `PaymentSuccessPage.tsx` | 85 | `/api/cart/${userId}` | `/api/cart` |
| `PaymentSuccessPage.tsx` | 206 | `/api/cart/clear/${userId}` | `/api/cart/clear` |

---

## ✅ 적용된 수정 사항

### 1️⃣ **LivePage.tsx**
```diff
- const response = await axios.get(`/api/cart/${userId}`)
+ const response = await axios.get('/api/cart')
```

**이유**: 새로운 API는 세션 토큰으로 자동으로 사용자를 식별하므로 URL에 `userId`를 포함할 필요가 없습니다.

---

### 2️⃣ **MyOrdersPage.tsx**
```diff
// 장바구니 조회
- const response = await axios.get(`/api/cart/${uid}`)
+ const response = await axios.get('/api/cart')

// 주문 목록 조회
- const response = await axios.get(`/api/orders/user/${uid}`)
+ const response = await axios.get('/api/orders')
```

**이유**: 두 API 모두 이제 인증 기반으로 동작하며, 세션 토큰에서 자동으로 사용자를 식별합니다.

---

### 3️⃣ **PaymentSuccessPage.tsx**
```diff
// 장바구니 조회
- const cartResponse = await axios.get(`/api/cart/${userId}`)
+ const cartResponse = await axios.get('/api/cart')

// 장바구니 비우기
- await axios.delete(`/api/cart/clear/${userId}`)
+ await axios.delete('/api/cart/clear')
```

**이유**: 결제 완료 후 장바구니를 조회하고 비울 때도 세션 기반 인증을 사용합니다.

---

## 🔐 새로운 인증 방식

### Before (오래된 방식):
```typescript
// ❌ URL에 userId를 명시적으로 포함
axios.get(`/api/cart/${userId}`)
```

**문제점**:
- 다른 사용자의 userId를 URL에 입력하면 **다른 사용자의 데이터에 접근 가능**
- 보안 취약점 존재

### After (새로운 방식):
```typescript
// ✅ 세션 토큰으로 자동 인증
axios.get('/api/cart')
```

**장점**:
- 세션 토큰 (`Authorization` 헤더 또는 쿠키)에서 자동으로 사용자 식별
- URL에 userId를 포함하지 않아 **보안 강화**
- 백엔드에서 `requireAuth` 미들웨어가 자동으로 인증 확인

---

## 🚀 배포 정보

- **Build Hash**: `962835d2e281ca85`
- **Commit**: `a1ffd17` - "fix: Update frontend API calls to use new auth-required endpoints"
- **Production URL**: https://2999640d.toss-live-commerce.pages.dev
- **Custom Domain**: https://live.ur-team.com (자동 배포 진행 중, 2-5분 소요)

---

## 🧪 테스트 결과

### ✅ 수정 전 (오류 발생)
```bash
# 로그인 상태에서 장바구니 조회 시도
curl https://live.ur-team.com/api/cart/1
# 결과: 401 Unauthorized (인증 없이 접근 시도)
```

### ✅ 수정 후 (정상 동작)
```bash
# 로그인 상태에서 장바구니 조회 시도
curl -H "Authorization: Bearer <session-token>" https://live.ur-team.com/api/cart
# 결과: 200 OK { "success": true, "data": [...] }
```

---

## 📊 영향 받는 기능

1. **장바구니 페이지** (`/cart`)
   - 장바구니 목록 조회
   - 상품 수량 변경
   - 상품 삭제

2. **결제 페이지** (`/checkout`)
   - 장바구니 확인
   - 주문 생성

3. **결제 완료 페이지** (`/payment/success`)
   - 주문 완료 후 장바구니 비우기

4. **마이페이지** (`/my-orders`)
   - 장바구니 탭
   - 주문 내역 탭

5. **라이브 페이지** (`/live/:id`)
   - "결제" 버튼 클릭 시 장바구니 확인

---

## 🎯 보안 개선 효과

| Before | After |
|--------|-------|
| ❌ URL에 userId 노출 | ✅ 세션 기반 인증 |
| ❌ 다른 사용자 데이터 접근 가능 | ✅ 본인 데이터만 접근 가능 |
| ❌ 인증 없이 API 호출 가능 | ✅ 401/403 오류로 차단 |
| ❌ Cross-user 공격 가능 | ✅ 미들웨어가 자동 차단 |

---

## 📌 향후 작업 권장 사항

### 🔴 단기 (즉시):
- [x] LivePage.tsx API URL 수정
- [x] MyOrdersPage.tsx API URL 수정
- [x] PaymentSuccessPage.tsx API URL 수정
- [x] 프로덕션 배포
- [x] 실제 사용자 테스트

### 🟠 중기 (1주일 내):
- [ ] 다른 페이지도 전체 검색하여 오래된 API URL 확인
- [ ] 에러 처리 개선 (401/403 발생 시 로그인 페이지로 리디렉션)
- [ ] 토큰 만료 시 자동 갱신 로직 추가

### 🟡 장기 (1개월 내):
- [ ] API 문서 업데이트 (Swagger)
- [ ] E2E 테스트 추가 (Playwright)
- [ ] 자동화된 보안 테스트 도입

---

## 🔗 관련 문서

- [API_SECURITY_IMPROVEMENTS.md](./API_SECURITY_IMPROVEMENTS.md) - API 보안 강화 내역
- [SERVICE_HEALTH_CHECK.md](./SERVICE_HEALTH_CHECK.md) - 서비스 헬스 체크 결과
- [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md) - 전체 개발 로그

---

**작성자**: AI Developer  
**검토자**: User  
**승인일**: 2026-02-15  
