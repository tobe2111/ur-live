# 🔍 충돌 가능성 분석 보고서

## 📊 현재 시스템 분석

### **LivePageV2.tsx 현황**
- **상품 로딩 방식**: Long Polling (25초 대기)
- **API 엔드포인트**: 
  - `/api/streams/${streamId}/current-product` (초기 로드)
  - `/api/streams/${streamId}/product-wait?lastTimestamp=${timestamp}` (Long Polling)
- **Hook 수**: 41개 (useState, useEffect)
- **폴링 Interval**: ❌ 없음 (Long Polling 방식 사용)

### **SellerLiveControlPage.tsx 현황**
- **시청자 수 업데이트**: 10초 interval (line 74)
- **상품 변경 API**: `/api/seller/streams/${streamId}/change-product`
- **폴링 Interval**: ✅ 10초 (시청자 수만)

---

## ⚠️ 잠재적 충돌 가능성

### 1️⃣ **Long Polling vs Firebase 리스너** (충돌 가능성: 중간)
**문제:**
- 현재 Long Polling이 25초 대기 중
- Firebase 리스너가 추가되면 **두 가지 방식이 동시에 작동**
- 상품 변경 시 두 번 업데이트될 수 있음

**해결 방법:**
- Long Polling useEffect를 **완전히 제거**
- Firebase 리스너로 **완전 대체**

### 2️⃣ **currentProduct State 중복 업데이트** (충돌 가능성: 낮음)
**문제:**
- `setCurrentProduct()` 호출이 여러 곳에서 발생
- Firebase 리스너와 기존 로직이 동시에 state 업데이트

**해결 방법:**
- Firebase 리스너만 `setCurrentProduct()` 호출하도록 변경
- 기존 Long Polling 제거로 자연스럽게 해결

### 3️⃣ **시청자 수 업데이트** (충돌 가능성: 없음)
**문제:**
- 시청자 수는 10초마다 별도로 업데이트 중
- Firebase에도 `viewer_count` 필드 존재

**해결 방법:**
- **충돌 없음** - Firebase는 셀러가 상품 변경 시에만 업데이트
- 시청자 수는 기존 10초 interval 유지 (YouTube API 호출)

### 4️⃣ **채팅 시스템** (충돌 가능성: 없음)
**문제:**
- 채팅은 이미 Firebase 사용 중
- `useLiveChat()` hook 존재

**해결 방법:**
- **충돌 없음** - 채팅과 상품 노드는 완전히 분리
- 기존 채팅 로직 그대로 유지

---

## ✅ 안전한 마이그레이션 전략

### **Phase 1: Firebase 추가 (기존 로직 유지)** ✅ 완료
- Firebase 리스너 추가
- 기존 Long Polling 유지
- 두 방식 병렬 운영 (테스트 목적)

### **Phase 2: Long Polling 제거** ⬅️ **진행 중**
- Line 1048-1115의 useEffect **전체 제거**
- Firebase 리스너로 완전 대체
- 기존 API 엔드포인트 유지 (다른 곳에서 사용 가능)

### **Phase 3: 최적화**
- 불필요한 API 엔드포인트 제거 (선택)
- Firebase 전용 에러 처리 추가

---

## 📋 영향 받는 파일

### **수정 필요 (2개)**
1. `src/pages/LivePageV2.tsx` (line 1048-1115)
   - Long Polling useEffect 제거
   - Firebase 리스너 추가

2. `src/pages/SellerLiveControlPage.tsx` (line 79-100)
   - loadData() 함수 유지 (초기 로드)
   - 10초 interval 유지 (시청자 수)

### **수정 불필요 (유지)**
1. `src/hooks/useLiveChat.ts` - 채팅 (Firebase 기존 사용)
2. `src/lib/api.ts` - API 클라이언트
3. `src/index.tsx` - 서버 API (Firebase 동기화 이미 추가됨)

---

## 🎯 충돌 방지 체크리스트

### ✅ 확인된 안전 사항
- [x] 채팅 시스템과 독립적
- [x] 시청자 수 업데이트와 독립적
- [x] 기존 API 엔드포인트 유지 (다른 페이지 호환)
- [x] State 이름 충돌 없음 (`currentProduct` 동일하게 사용)
- [x] 서버 API 변경 최소화 (Firebase 동기화만 추가)

### ⚠️ 주의 필요
- [ ] Long Polling과 Firebase 리스너 **동시 실행 방지**
  → **해결 방법**: Long Polling useEffect 제거
  
- [ ] 두 번 렌더링 방지
  → **해결 방법**: Firebase 리스너만 state 업데이트

---

## 💡 결론

### **충돌 위험도: 낮음** ✅

**이유:**
1. Long Polling 제거로 중복 업데이트 방지
2. Firebase 노드 분리 (streams, products, chats)
3. State 이름 동일 사용 (리팩토링 불필요)
4. 기존 API 엔드포인트 유지 (하위 호환성)

### **안전한 마이그레이션 가능** ✅

**전략:**
1. ✅ Firebase 리스너 추가 (완료)
2. ⏳ Long Polling useEffect 제거 (진행 중)
3. ⏳ 테스트 및 검증
4. ✅ 배포

---

## 🚀 다음 단계

**즉시 진행:**
1. LivePageV2.tsx - Long Polling 제거 + Firebase 통합
2. SellerLiveControlPage.tsx - Firebase 리스너 추가 (상품 변경 시)
3. 로컬 테스트 (재고 변경, 상품 변경)
4. 배포

**예상 시간:** 1~2시간  
**충돌 위험:** 낮음 ✅
