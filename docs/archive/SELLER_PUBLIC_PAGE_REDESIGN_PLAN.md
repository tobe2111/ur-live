# 셀러 공개 페이지 리디자인 - Influencer Link-in-Bio 스타일

## 📋 디자인 분석 결과

### 현재 페이지 (SellerPublicPage)
**URL**: `/s/:sellerId`
**스타일**: Apple 스타일 (밝은 회색 배경, 카드 레이아웃)
**구조**:
- Header (뒤로가기, 판매자명)
- Profile Section (프로필 이미지, 이름, Bio, SNS 링크, 통계)
- Tab Navigation (라이브/상품)
- Content Area (라이브 스트림 그리드 또는 상품 그리드)

### 새 디자인 (Influencer Link-in-Bio)
**스타일**: 미니멀, 모노크롬, 타이포그래피 중심
**구조**:
- ProfileHeader (이름, 간단한 설명)
- UpcomingLive (예정된 라이브 리스트)
- ProductGrid (2열 상품 그리드)
- SnsLinks (Instagram, KakaoTalk 링크)

**주요 특징**:
1. **수직 스크롤 단일 페이지** (탭 없음)
2. **화이트/라이트 그레이** 컬러 스킴
3. **작은 텍스트 크기, 넓은 자간** (tracking-wide, uppercase)
4. **미니멀 카드 디자인** (subtle border, hover effects)
5. **모바일 최적화** (max-w-md)

---

## 🎯 필수 구현 기능 리스트

### 1. **프로필 섹션** ✅
- [x] 판매자 이름 표시 (small font, bold)
- [x] 태그라인/설명 표시 (Fashion Curator · Seoul · 127K Followers)
- [ ] **데이터 연동**: seller.name, seller.bio 또는 seller.business_name

### 2. **예정된 라이브 섹션** ✅
- [x] 라이브 썸네일 이미지 (80x80px, rounded)
- [x] D-Day 배지 (ACCENT: D-Day, MUTED: D-3, D-7)
- [x] 날짜/시간 표시 (Feb 18, 8PM KST)
- [x] 라이브 제목
- [x] 라이브 설명
- [ ] **데이터 연동**: 
  - scheduled_at으로 D-Day 계산
  - YouTube 썸네일 사용
  - 클릭 시 라이브 페이지 이동

### 3. **상품 그리드 섹션** ✅
- [x] 2열 그리드 레이아웃
- [x] 정사각형 이미지 (aspect-square)
- [x] 브랜드명 (작은 텍스트, uppercase)
- [x] 상품명 (truncate)
- [x] 가격 표시
- [x] Hover 시 이미지 확대 효과
- [ ] **데이터 연동**:
  - product.image_url
  - product.name (category를 brand처럼 사용 가능)
  - product.price
  - 클릭 시 상품 상세 페이지 이동

### 4. **SNS 링크 섹션** ✅
- [x] Instagram 링크
- [x] KakaoTalk 링크
- [x] 아이콘 + 텍스트 + 계정명
- [x] 카드 형태 버튼
- [ ] **데이터 연동**:
  - seller.sns_instagram
  - seller.sns_youtube (YouTube 추가 가능)
  - seller.website_url
  - target="_blank" 새 창 열기

### 5. **섹션 구분선** ✅
- [x] 얇은 회색 구분선
- [x] 섹션 간 여백

### 6. **반응형 디자인** ✅
- [x] 모바일 최적화 (max-w-md = 448px)
- [x] 중앙 정렬
- [x] 터치 친화적 버튼 크기

---

## 🚀 구현 계획

### Phase 1: 컴포넌트 생성 (1시간)
1. **컴포넌트 구조**:
   ```
   src/components/seller-public/
   ├── ProfileHeader.tsx       (판매자 이름, 설명)
   ├── UpcomingLive.tsx        (예정 라이브 리스트)
   ├── ProductGrid.tsx         (상품 2열 그리드)
   ├── SnsLinks.tsx            (SNS 링크 버튼)
   └── SectionDivider.tsx      (구분선)
   ```

2. **데이터 인터페이스**:
   ```typescript
   interface SellerPublicData {
     seller: {
       name: string
       business_name?: string
       bio?: string
       follower_count?: number
       sns_instagram?: string
       sns_youtube?: string
       website_url?: string
     }
     upcomingStreams: {
       id: number
       title: string
       description: string
       scheduled_at: string
       youtube_video_id: string
     }[]
     products: {
       id: number
       name: string
       category?: string
       price: number
       image_url: string
     }[]
   }
   ```

### Phase 2: 페이지 재구성 (30분)
1. SellerPublicPage.tsx 완전 재작성
2. 기존 API 호출 유지
3. 새 컴포넌트로 교체
4. 네비게이션 통합 (라이브/상품 클릭 이동)

### Phase 3: 스타일링 (30분)
1. Tailwind CSS classes 적용
2. 컬러 시스템 (흰색, 밝은 회색, 검정, 빨강 accent)
3. 타이포그래피 (작은 크기, 넓은 자간)
4. 호버 효과, 트랜지션

### Phase 4: 데이터 통합 (30분)
1. API 응답 → 컴포넌트 props 매핑
2. D-Day 계산 로직
3. 이미지 fallback 처리
4. 빈 상태 처리 (No data)

### Phase 5: 테스트 & 최적화 (30분)
1. 다양한 셀러 계정 테스트
2. 모바일 반응형 테스트
3. 이미지 로딩 최적화
4. 성능 체크

**총 예상 시간**: 3-3.5시간

---

## 🎨 디자인 세부사항

### 컬러 팔레트
```css
--background: #FFFFFF (white)
--foreground: #0D0D0D (거의 검정)
--muted-foreground: #8C8C8C (회색)
--border: #EBEBEB (밝은 회색)
--card: #FFFFFF
--secondary: #F7F7F7 (hover 배경)
--accent: #FF0000 (D-Day 배지, 강조)
```

### 타이포그래피
```css
/* 판매자 이름 */
font-size: 14px (text-sm)
font-weight: bold
tracking: 0.05em (tracking-wide)

/* 섹션 헤더 */
font-size: 10px (text-[10px])
font-weight: semibold
tracking: 0.25em (tracking-[0.25em])
text-transform: uppercase
color: muted-foreground

/* 상품명 */
font-size: 11px (text-[11px])
font-weight: medium
line-clamp: 1 (truncate)

/* 브랜드명 */
font-size: 9px (text-[9px])
font-weight: semibold
tracking: 0.15em
text-transform: uppercase
```

### 간격 (Spacing)
```css
/* 섹션 패딩 */
padding: 1.5rem (px-6 py-6)

/* 카드 간격 */
gap: 0.75rem (gap-3)

/* 프로필 상단 여백 */
padding-top: 3rem (pt-12)
```

---

## 📝 추가 기능 제안

### 선택적 구현 (우선순위 낮음)
1. **다크 모드 지원** (이미 컬러 시스템이 CSS 변수로 되어 있음)
2. **공유 버튼** (셀러 페이지 URL 복사)
3. **팔로우 버튼** (사용자 로그인 필요)
4. **라이브 알림 신청** (scheduled 라이브 알림)
5. **상품 필터/정렬** (카테고리별, 가격순)

---

## 🔗 파일 참조

**디자인 소스**:
- `/home/user/uploaded_files/app/page.tsx`
- `/home/user/uploaded_files/components/profile-header.tsx`
- `/home/user/uploaded_files/components/upcoming-live.tsx`
- `/home/user/uploaded_files/components/product-grid.tsx`
- `/home/user/uploaded_files/components/sns-links.tsx`
- `/home/user/uploaded_files/app/globals.css`

**현재 구현**:
- `/home/user/webapp/src/pages/SellerPublicPage.tsx`

---

**작성일**: 2026-02-19  
**목적**: 셀러 공개 페이지를 Influencer Link-in-Bio 스타일로 재디자인  
**예상 작업 시간**: 3-3.5시간
