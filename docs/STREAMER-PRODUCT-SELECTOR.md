# 라이브 방송 상품 선택 UI 구현 완료

**날짜**: 2026-02-18  
**커밋**: c3322da  
**배포 URL**: https://live.ur-team.com/

---

## ✅ 구현된 기능

### 1. **스트리머 전용 상품 선택 UI**

#### 권한 확인
- `user_type === 'seller'` 확인
- `stream.seller_id === user_id` 확인
- 스트리머만 상품 변경 버튼 표시

#### 상품 선택 모달
- **위치**: 화면 우측 상단에 "상품 변경" 버튼
- **디자인**: 보라색-핑크 그라데이션 버튼 (purple-500 to pink-500)
- **모달 구성**:
  - 상품 목록 (2열 그리드)
  - 상품 이미지, 이름, 가격, 평점, 판매량
  - 현재 선택된 상품에 "현재 상품" 배지 표시
  - 선택 시 API 호출 및 상태 업데이트

### 2. **시청자용 현재 상품 강조 표시**

#### "지금 추천!" 배지
- **위치**: 상품 정보 카드 위쪽
- **디자인**: 보라색-핑크 그라데이션 + 별 아이콘 + 펄스 애니메이션
- **표시 조건**: `stream.current_product_id === product.id`

### 3. **백엔드 API 연동**

#### API 엔드포인트
```
POST /api/seller/streams/:streamId/change-product
```

#### 요청 형식
```json
{
  "productId": 123
}
```

#### 응답 형식
```json
{
  "success": true,
  "data": {
    "streamId": "2",
    "productId": 123,
    "message": "상품이 변경되었습니다."
  }
}
```

#### 권한 검증
- Bearer 토큰 필수
- 셀러 계정만 접근 가능
- 스트림 소유권 확인
- 상품 소유권 확인

---

## 📁 수정된 파일

### `/home/user/webapp/src/pages/LivePageV2.tsx`

#### 1. Stream 인터페이스 확장
```typescript
interface Stream {
  // ... 기존 필드
  current_product_id?: number | null
  seller_id?: number
}
```

#### 2. 상태 추가
```typescript
const [isStreamer, setIsStreamer] = useState(false)
const [showProductSelector, setShowProductSelector] = useState(false)
const [currentStream, setCurrentStream] = useState<Stream | null>(null)
const [changingProduct, setChangingProduct] = useState(false)
```

#### 3. 스트리머 권한 확인 로직
```typescript
const userType = localStorage.getItem('user_type')
const userId = getUserId()
if (userType === 'seller' && userId && stream.seller_id === parseInt(userId)) {
  setIsStreamer(true)
}
```

#### 4. 상품 변경 함수
```typescript
const handleChangeProduct = async (productId: number) => {
  const sessionToken = localStorage.getItem('seller_session_token') || localStorage.getItem('session')
  
  const response = await api.post(
    `/api/seller/streams/${streamId}/change-product`,
    { productId },
    {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    }
  )
  
  // 현재 스트림 정보 업데이트
  setCurrentStream({
    ...currentStream,
    current_product_id: productId
  })
}
```

#### 5. ReelCard 컴포넌트 확장
- `isCurrentProduct` prop 추가
- 현재 상품 배지 UI 추가

---

## 🎨 UI/UX 디자인

### 스트리머 전용 버튼
```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all">
  <ShoppingBag size={18} />
  <span className="font-medium">상품 변경</span>
</button>
```

### 상품 선택 모달
- **배경**: 검은색 반투명 (bg-black/80 backdrop-blur-sm)
- **패널**: 회색 그라데이션 (from-gray-900 to-gray-800)
- **상품 카드**: 2열 그리드, hover 효과
- **현재 상품**: 보라색 테두리 + 배지

### 현재 상품 배지 (시청자용)
```tsx
<div className="absolute -top-8 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg animate-pulse">
  <Star size={14} className="fill-white text-white" />
  <span className="text-xs font-bold text-white">지금 추천!</span>
</div>
```

---

## 🧪 테스트 방법

### 1. 스트리머로 로그인
```
1. https://live.ur-team.com/seller-login 접속
2. 셀러 계정으로 로그인
3. localStorage에 user_type='seller' 저장 확인
```

### 2. 라이브 페이지 접속
```
https://live.ur-team.com/live/2?login=success&session=YOUR_SESSION&userId=YOUR_ID&userName=YOUR_NAME
```

### 3. 상품 선택 버튼 확인
- 우측 상단에 "상품 변경" 버튼이 표시되어야 함
- 클릭 시 상품 목록 모달이 열림

### 4. 상품 변경
- 모달에서 상품 클릭
- "상품이 변경되었습니다!" 알림 확인
- 현재 상품 배지가 업데이트됨

### 5. 시청자 화면 확인
- 다른 브라우저/시크릿 모드로 접속
- 선택된 상품에 "지금 추천!" 배지가 표시되어야 함

---

## 📝 데이터베이스 스키마

### `live_streams` 테이블
```sql
CREATE TABLE live_streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled',
  current_product_id INTEGER,
  -- ... 기타 필드
  FOREIGN KEY (seller_id) REFERENCES users(id),
  FOREIGN KEY (current_product_id) REFERENCES products(id)
);
```

---

## 🔐 보안 고려사항

### 권한 검증 (백엔드)
1. **Bearer 토큰 검증**
   - Authorization 헤더 필수
   - 유효한 세션 토큰 확인

2. **셀러 계정 확인**
   - `session.user_type === 'seller'` 검증
   - seller_id 추출

3. **스트림 소유권 확인**
   - `stream.seller_id === sellerId` 검증

4. **상품 소유권 확인**
   - `product.seller_id === sellerId` 검증
   - `product.is_active === 1` 확인

### 권한 검증 (프론트엔드)
1. **스트리머 권한 확인**
   - localStorage의 `user_type` 확인
   - `stream.seller_id === user_id` 확인

2. **UI 조건부 렌더링**
   - `isStreamer === true`일 때만 버튼 표시

---

## 🚀 배포 정보

- **GitHub**: https://github.com/tobe2111/ur-live (main 브랜치)
- **커밋**: c3322da
- **Cloudflare Pages**: https://live.ur-team.com/
- **배포 시간**: 2026-02-18 07:46:25 GMT

---

## 📊 성능 최적화

### 상태 관리
- `currentStream` 상태로 current_product_id 실시간 업데이트
- API 호출 후 로컬 상태 즉시 업데이트 (낙관적 업데이트)

### 애니메이션
- `animate-pulse` 클래스 사용 (Tailwind 내장)
- GPU 가속 transform/opacity 사용

### 코드 분할
- 모달 UI는 조건부 렌더링으로 필요할 때만 로드

---

## 🐛 알려진 제한사항

1. **실시간 동기화 미구현**
   - 현재는 페이지 새로고침 시 업데이트됨
   - 향후 WebSocket 또는 SSE로 실시간 동기화 필요

2. **상품 목록 로딩**
   - 현재 reels 배열에서 가져옴
   - 향후 `/api/seller/products` API로 전체 목록 조회 필요

3. **오프라인 지원 미구현**
   - 네트워크 오류 시 재시도 로직 없음

---

## 📚 참고 자료

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Hono Framework](https://hono.dev/)
- [React Hooks](https://react.dev/reference/react)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 🎉 완료!

스트리머가 라이브 방송 중 상품을 실시간으로 변경하고, 시청자에게 강조 표시할 수 있는 기능이 완성되었습니다.
