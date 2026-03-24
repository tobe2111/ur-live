# 홈페이지 UI/UX 개선 작업 목록 📋

> 날짜: 2026-02-24  
> 보고자: 사용자 피드백  
> 우선순위: 높음

---

## 🔍 발견된 문제들

### 1️⃣ 헤더 아이콘 버튼 기능 미작동 🔴 **높음**
**문제**:
- 돋보기 아이콘: 검색 페이지로 이동하지 않음
- 종 모양 아이콘: 알림창 역할을 하지 않음
- 사람 모양 아이콘: 로그인 후에도 마이페이지로 이동하지 않음

**현재 상태**:
- HomePage.tsx 헤더에 검색/알림 아이콘 **없음**
- 사용자 프로필 아이콘은 있지만 제대로 작동하지 않음

**해결 방법**:
```typescript
// lucide-react에서 필요한 아이콘 import
import { Search, Bell, User } from 'lucide-react'

// 헤더에 아이콘 버튼 추가
<div className="flex items-center space-x-3">
  {/* 검색 버튼 */}
  <Link to="/search" className="...">
    <Search className="w-5 h-5" />
  </Link>
  
  {/* 알림 버튼 */}
  <button onClick={handleNotifications} className="...">
    <Bell className="w-5 h-5" />
  </button>
  
  {/* 프로필 버튼 */}
  {user ? (
    <Link to="/user/profile" className="...">
      <User className="w-5 h-5" />
    </Link>
  ) : (
    <Link to="/login" className="...">
      <User className="w-5 h-5" />
    </Link>
  )}
</div>
```

---

### 2️⃣ 카테고리 페이지 상품 목록 미표시 🔴 **높음**
**문제**:
- `/browse?category=food` 등 카테고리 페이지 클릭 시 옛날 페이지 표시
- 각 카테고리별 상품 목록이 나와야 함

**카테고리 목록** (5개):
1. `food` - 식품
2. `fashion` - 패션
3. `beauty` - 뷰티
4. `electronics` - 가전
5. `lifestyle` - 라이프스타일

**해결 방법**:
- BrowsePage 또는 CategoryPage 컴포넌트 수정
- URL 파라미터 `category` 읽기
- 해당 카테고리 상품만 필터링하여 표시

**API 호출**:
```typescript
const category = searchParams.get('category')
const response = await api.get(`/api/products?category=${category}`)
```

---

### 3️⃣ 상품 상세 페이지 뒤로가기 버튼 미작동 🟡 **중간**
**문제**:
- `/product/19`에서 뒤로가기 버튼 클릭 시 이전 페이지로 이동하지 않음

**콘솔 로그 분석**:
```
[LoginPage] 이미 로그인됨 - 리다이렉트: /product/19
```
- 뒤로가기 → `/login` → 자동 리다이렉트 → `/product/19` (무한 루프)

**원인**:
- `navigate(-1)` 사용 시 히스토리가 `/login`을 거쳐감
- LoginPage의 자동 리다이렉트 로직이 뒤로가기를 방해

**해결 방법**:
```typescript
// navigate(-1) 대신 명시적 경로 사용
const handleBack = () => {
  const referrer = document.referrer
  if (referrer && referrer.includes(window.location.host)) {
    navigate(-1)
  } else {
    navigate('/') // fallback to home
  }
}
```

---

### 4️⃣ "See all" 버튼 전체 상품 목록 미연결 🟡 **중간**
**문제**:
- "UR 특가" 섹션의 "See all" 버튼 클릭 시 전체 상품 목록 표시 안 됨

**해결 방법**:
```typescript
<Link to="/browse" className="...">
  See all
</Link>

// BrowsePage에서:
// category 파라미터 없으면 전체 상품 표시
const category = searchParams.get('category')
const response = await api.get(
  category 
    ? `/api/products?category=${category}` 
    : `/api/products`  // 전체 상품
)
```

---

### 5️⃣ 상품 ID 18 삭제 ✅ **완료**
**문제**:
- `/product/18` 상품 삭제 필요

**해결**:
```sql
-- delete-product-18.sql
DELETE FROM products WHERE id = 18;
```

**실행**:
```bash
npx wrangler d1 execute ur-live-production --file=delete-product-18.sql
```

---

### 6️⃣ 라이브 스트림 DB 데이터 사라짐 ✅ **완료**
**문제**:
- 라이브 3개 DB 데이터 없어짐

**해결**:
```sql
-- restore-live-streams.sql
INSERT OR IGNORE INTO live_streams (id, title, ...) VALUES (1, '🔥 겨울 신상 패딩 특가!', ...);
INSERT OR IGNORE INTO live_streams (id, title, ...) VALUES (2, '💄 신상 화장품 언박싱', ...);
INSERT OR IGNORE INTO live_streams (id, title, ...) VALUES (3, '⚡ 스마트홈 가전 대전!', ...);
```

**실행**:
```bash
npx wrangler d1 execute ur-live-production --file=restore-live-streams.sql
```

---

## 📊 작업 우선순위

| 순위 | 작업 | 우선순위 | 상태 | 예상 시간 |
|------|------|----------|------|-----------|
| 1 | 라이브 스트림 DB 복구 | 🔴 높음 | ✅ 완료 | 5분 |
| 2 | 상품 ID 18 삭제 | 🟢 낮음 | ✅ 완료 | 2분 |
| 3 | 헤더 아이콘 기능 수정 | 🔴 높음 | 🔄 진행 중 | 30분 |
| 4 | 카테고리 페이지 구현 | 🔴 높음 | ⏳ 대기 | 45분 |
| 5 | 뒤로가기 버튼 수정 | 🟡 중간 | ⏳ 대기 | 15분 |
| 6 | See all 버튼 연결 | 🟡 중간 | ⏳ 대기 | 10분 |

---

## 🚀 즉시 실행 가능한 작업

### ✅ 완료된 작업
1. **라이브 스트림 복구 SQL 작성** (`restore-live-streams.sql`)
2. **상품 ID 18 삭제 SQL 작성** (`delete-product-18.sql`)

### 🔄 다음 단계
1. **DB 작업 실행**:
   ```bash
   # 프로덕션 DB에서 실행
   cd /home/user/webapp
   npx wrangler d1 execute ur-live-production --file=restore-live-streams.sql
   npx wrangler d1 execute ur-live-production --file=delete-product-18.sql
   ```

2. **헤더 아이콘 수정**:
   - HomePage.tsx 수정
   - Search, Bell, User 아이콘 추가
   - 각 아이콘에 올바른 링크/기능 연결

3. **카테고리 페이지 구현**:
   - BrowsePage 컴포넌트 생성/수정
   - URL 파라미터 기반 상품 필터링
   - 5개 카테고리 지원

4. **뒤로가기 버튼 수정**:
   - ProductDetailPage navigate 로직 개선

5. **See all 버튼 연결**:
   - HomePage "See all" → `/browse` 링크

---

## 📝 참고사항

### 파일 위치
- **HomePage**: `src/pages/HomePage.tsx`
- **ProductDetailPage**: `src/pages/ProductDetailPage.tsx`
- **BrowsePage**: `src/pages/BrowsePage.tsx` (확인 필요)
- **SQL 파일**: `/home/user/webapp/*.sql`

### API 엔드포인트
- 상품 목록: `GET /api/products?category={category}`
- 라이브 스트림: `GET /api/live-streams`
- 상품 상세: `GET /api/products/{id}`

---

**완성도**: 30% (2/6 완료)  
**다음 우선순위**: 헤더 아이콘 기능 수정 → 카테고리 페이지 구현

**DB 작업부터 즉시 실행 가능합니다!**
