# 📸 어드민 배너 관리 가이드

## ✅ **배너 수정 완료!**

메인 페이지의 히어로 배너가 **이미지 전용 배너**로 변경되었습니다.

---

## 🎨 **변경 사항**

### Before (❌ 텍스트 포함):
```
┌───────────────────────────────┐
│                               │
│    LIMITED EDITION            │
│    NEW DROPS ARE HERE         │
│    Shop the latest...         │
│    [SHOP NOW]                 │
│                               │
└───────────────────────────────┘
```
- 텍스트가 이미지와 겹침
- 비율 변경 시 텍스트 위치 어색
- 다국어 지원 어려움

### After (✅ 이미지 전용):
```
┌───────────────────────────────┐
│                               │
│     [클릭 가능한 이미지]       │
│         16:9 비율             │
│                               │
└───────────────────────────────┘
```
- 깔끔한 이미지만 표시
- 전체 배너 클릭 시 `/browse` 페이지로 이동
- 비율 변경에 유연하게 대응
- 이미지에 텍스트 포함 가능 (디자인에서 처리)

---

## 🖼️ **배너 이미지 관리 방법**

### 1️⃣ **어드민 대시보드 접속**

```bash
# 로컬
http://localhost:5173/admin/login

# 프로덕션
https://live.ur-team.com/admin/login
```

**로그인 정보**:
- 어드민 계정 필요 (`user_type: 'admin'`)
- 로그인 후 자동으로 대시보드로 이동

---

### 2️⃣ **배너 관리 페이지**

로그인 후 다음 경로로 이동:
- **URL**: `/admin/banners` 또는 어드민 메뉴에서 "배너 관리" 선택

**기능**:
- ✅ 배너 목록 조회
- ✅ 새 배너 추가
- ✅ 배너 수정/삭제
- ✅ 배너 활성화/비활성화
- ✅ 배너 순서 변경
- ✅ 노출 기간 설정

---

### 3️⃣ **배너 추가하기**

1. **[+ 새 배너 추가]** 버튼 클릭

2. **배너 정보 입력**:
   ```
   제목: "2024 신상품 출시"
   이미지 URL: "/images/hero-banner.jpg" 또는 업로드된 이미지 URL
   링크 URL: "/browse" 또는 "/products/123" (선택사항)
   설명: "새로운 상품을 만나보세요" (선택사항)
   활성화: ✅ (체크)
   표시 순서: 0 (첫 번째)
   시작일: 2024-01-01 (선택사항)
   종료일: 2024-12-31 (선택사항)
   ```

3. **저장** 버튼 클릭

4. **즉시 반영**: 메인 페이지 새로고침 시 새 배너 표시

---

### 4️⃣ **이미지 준비 가이드**

#### **권장 사양**:
| 항목 | 값 |
|---|---|
| **비율** | 16:9 (가로:세로) |
| **해상도** | 1920×1080px (Full HD) |
| **파일 형식** | JPG, PNG, WebP |
| **파일 크기** | 500KB 이하 (권장) |
| **최대 크기** | 2MB |

#### **예시 해상도**:
- ✅ **1920×1080px** (Full HD, 권장)
- ✅ **1280×720px** (HD, 모바일용)
- ✅ **3840×2160px** (4K, 고해상도)

#### **디자인 팁**:
1. **텍스트는 이미지에 포함**
   - Photoshop, Figma 등에서 텍스트 추가
   - 중요한 텍스트는 중앙에 배치
   - 폰트 크기: 큰 제목 80-120px, 부제목 40-60px

2. **안전 영역 (Safe Area)**
   - 이미지 가장자리 10% 영역에는 중요한 내용 배치 X
   - 중앙 80% 영역 활용

3. **모바일 최적화**
   - 텍스트가 작은 화면에서도 읽히는지 확인
   - 가로로 긴 이미지보다 중앙 집중형 디자인 권장

4. **파일 최적화**
   - TinyPNG (https://tinypng.com/) 사용
   - WebP 형식 권장 (최신 브라우저 지원)

---

## 🔧 **배너 API 사용 (개발자용)**

### GET: 활성 배너 목록
```bash
GET /api/banners
```
**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "신상품 출시",
      "image_url": "/images/hero-banner.jpg",
      "link_url": "/browse",
      "is_active": true,
      "display_order": 0
    }
  ]
}
```

### POST: 배너 생성 (어드민 전용)
```bash
POST /api/admin/banners
Authorization: Bearer {admin_token}

{
  "title": "신상품 출시",
  "image_url": "/images/hero-banner.jpg",
  "link_url": "/browse",
  "description": "새로운 상품",
  "is_active": true,
  "display_order": 0,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

### PUT: 배너 수정 (어드민 전용)
```bash
PUT /api/admin/banners/:id
Authorization: Bearer {admin_token}

{
  "title": "수정된 제목",
  "is_active": false
}
```

### DELETE: 배너 삭제 (어드민 전용)
```bash
DELETE /api/admin/banners/:id
Authorization: Bearer {admin_token}
```

---

## 📂 **이미지 업로드 방법**

### Option 1: 직접 서버에 업로드
```bash
# public/images 폴더에 이미지 저장
cp hero-banner.jpg /home/user/webapp/public/images/

# URL: /images/hero-banner.jpg
```

### Option 2: CDN 사용 (권장)
1. **Cloudflare Images** 사용
   - 대시보드에서 이미지 업로드
   - URL: `https://imagedelivery.net/{account_id}/{image_id}/public`

2. **Cloudflare R2** 사용
   - 오브젝트 스토리지에 업로드
   - URL: `https://pub-{bucket_id}.r2.dev/hero-banner.jpg`

### Option 3: 어드민 대시보드 직접 업로드 (미래 기능)
```typescript
// TODO: 파일 업로드 기능 추가
<input type="file" accept="image/*" onChange={handleUpload} />
```

---

## 🎯 **배너 전략**

### 1. **캠페인별 배너**
```
1월: 신년 세일 배너
2월: 밸런타인데이 배너
3월: 봄 신상품 배너
...
```

### 2. **다중 배너 운영**
- 여러 배너를 등록하고 순서대로 표시
- 자동 슬라이드 기능 (향후 추가 가능)

### 3. **A/B 테스팅**
- 동일 기간에 다른 배너 테스트
- 클릭률 분석 (향후 추가 가능)

---

## 🐛 **문제 해결**

### Q1. 배너가 표시되지 않아요
**A1**: 
1. 배너가 활성화되어 있는지 확인 (`is_active: true`)
2. 이미지 URL이 올바른지 확인
3. 브라우저 캐시 삭제 (Ctrl+Shift+R)

### Q2. 이미지가 깨져 보여요
**A2**:
1. 이미지 비율 확인 (16:9 권장)
2. 이미지 해상도 확인 (1920×1080px 이상)
3. 파일 크기 확인 (2MB 이하)

### Q3. 배너 순서를 바꾸고 싶어요
**A3**:
- `display_order` 값 수정 (작을수록 먼저 표시)
- 어드민 대시보드에서 드래그 앤 드롭으로 순서 변경

### Q4. 배너를 클릭해도 이동하지 않아요
**A4**:
- `link_url` 필드에 올바른 경로 입력 (예: `/browse`, `/products/123`)
- 현재는 기본적으로 `/browse`로 이동

---

## 📊 **배너 성과 분석 (향후 추가 예정)**

```sql
-- 배너 클릭 추적 테이블
CREATE TABLE banner_clicks (
  id INTEGER PRIMARY KEY,
  banner_id INTEGER,
  user_id INTEGER,
  clicked_at TIMESTAMP,
  referrer TEXT
);

-- 배너별 클릭률 분석
SELECT 
  b.title,
  COUNT(bc.id) as clicks,
  COUNT(DISTINCT bc.user_id) as unique_users
FROM banners b
LEFT JOIN banner_clicks bc ON b.id = bc.banner_id
GROUP BY b.id;
```

---

## 🚀 **배너 최적화 체크리스트**

- [ ] 이미지 비율 16:9 확인
- [ ] 이미지 해상도 1920×1080px 이상
- [ ] 파일 크기 500KB 이하로 최적화
- [ ] 텍스트 가독성 테스트 (모바일/데스크톱)
- [ ] 링크 URL 동작 확인
- [ ] 활성화 상태 확인
- [ ] 노출 기간 설정 (선택사항)
- [ ] 다중 기기에서 테스트

---

## 📚 **관련 파일**

### 프론트엔드:
- `src/components/main/HeroBanner.tsx` - 배너 컴포넌트
- `src/pages/AdminBannersPage.tsx` - 배너 관리 페이지
- `src/pages/MainHomePage.tsx` - 메인 페이지

### 백엔드:
- `src/index.tsx` - 배너 API 엔드포인트
  - `GET /api/banners` (공개)
  - `GET /api/admin/banners` (어드민 전용)
  - `POST /api/admin/banners` (어드민 전용)
  - `PUT /api/admin/banners/:id` (어드민 전용)
  - `DELETE /api/admin/banners/:id` (어드민 전용)

### 데이터베이스:
```sql
-- D1 banners 테이블
CREATE TABLE banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## ✅ **요약**

1. **배너 수정 완료**: 텍스트 제거, 이미지 전용 배너로 변경
2. **어드민 대시보드**: `/admin/banners`에서 배너 관리
3. **이미지 권장 사양**: 1920×1080px, 16:9 비율, 500KB 이하
4. **클릭 동작**: 배너 클릭 시 `/browse` 페이지로 이동
5. **API 지원**: 배너 CRUD 모두 구현 완료

**이제 어드민 대시보드에서 배너 이미지를 업로드하고 관리할 수 있습니다!** 🎉

---

**Git 커밋**: `c6bc03d` - feat: Convert hero banner to image-only with click navigation  
**GitHub**: https://github.com/tobe2111/ur-live/commit/c6bc03d
