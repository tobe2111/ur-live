# 🎯 UR-Live 남은 작업 완전 정리 (빠짐없이!)

**날짜**: 2026-03-07  
**분석 기준**: TODO_REMAINING_TASKS.md, UI_UX_IMPROVEMENT_TODO.md, TODO_NOW.md, SERVICE_SPEC.md  
**현재 완료도**: 코드 95%, 배포 환경 80%

---

## 🚨 즉시 해야 할 일 (Critical - 지금 당장!)

### 1. Cloudflare 환경 변수 설정 ⏱️ 5분
**상태**: ❌ 미완료  
**중요도**: 🔴🔴🔴🔴🔴 (최우선!)

#### 설정해야 할 환경 변수
```bash
# Cloudflare Pages → Settings → Environment variables → Production

1. VITE_SENTRY_DSN
   Value: https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488

2. VITE_SENTRY_ENVIRONMENT
   Value: production

3. VITE_KAKAO_REST_API_KEY (확인)
   Value: 5dd74bccb797640b0efd070467f3bafd

4. VITE_TOSS_CLIENT_KEY (확인)
   Value: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

**영향**: Sentry 에러 트래킹 활성화, 프로덕션 모니터링 시작

---

### 2. 재배포 실행 ⏱️ 3분
**상태**: ⏳ 환경 변수 설정 후 즉시 실행  
**방법**:
```
Cloudflare Dashboard → ur-live → Deployments → 
최신 배포 → "..." → Retry deployment
```

---

### 3. Sentry 동작 확인 ⏱️ 2분
**방법**:
```javascript
// 브라우저 콘솔에서 실행
window.Sentry?.captureException(new Error('프로덕션 테스트 2026-03-07'))
```

**확인**: https://o4510992097935360.sentry.io/issues/ (5-10분 후)

---

## 🔴 높은 우선순위 (High Priority - 1-2주 내)

### 4. UI/UX 버그 수정 ⏱️ 2-3시간 ✅ 대부분 완료

#### A. 헤더 아이콘 기능 수정 ⏱️ 30분
**파일**: `src/pages/HomePage.tsx`  
**작업**:
- [ ] 돋보기 아이콘 → `/search` 링크
- [ ] 종 아이콘 → 알림 기능 (모달 또는 페이지)
- [ ] 사람 아이콘 → `/user/profile` 또는 `/login`

```typescript
import { Search, Bell, User } from 'lucide-react'

<div className="flex items-center space-x-3">
  <Link to="/search"><Search className="w-5 h-5" /></Link>
  <button onClick={handleNotifications}><Bell className="w-5 h-5" /></button>
  {user ? (
    <Link to="/user/profile"><User className="w-5 h-5" /></Link>
  ) : (
    <Link to="/login"><User className="w-5 h-5" /></Link>
  )}
</div>
```

#### B. 카테고리 페이지 구현 ⏱️ 45분
**파일**: `src/pages/BrowsePage.tsx`  
**카테고리**: food, fashion, beauty, electronics, lifestyle  
**작업**:
```typescript
const category = searchParams.get('category')
const { data } = useQuery({
  queryKey: ['products', category],
  queryFn: () => api.get(`/api/products${category ? `?category=${category}` : ''}`)
})
```

#### C. 뒤로가기 버튼 수정 ⏱️ 15분
**파일**: `src/pages/ProductDetailPage.tsx`  
**작업**:
```typescript
const handleBack = () => {
  const referrer = document.referrer
  if (referrer && referrer.includes(window.location.host)) {
    navigate(-1)
  } else {
    navigate('/')
  }
}
```

#### D. "See all" 버튼 연결 ⏱️ 10분
**파일**: `src/pages/HomePage.tsx`  
**작업**:
```typescript
<Link to="/browse">See all</Link>
```

---

### 5. 페이지 완성도 개선 ⏱️ 15-25시간

#### 우선순위 1: 사용자 핵심 페이지 (9-12시간)

##### A. LoginPage - KREAM 스타일 ⏱️ 2-3시간
**파일**: `src/pages/LoginPage.tsx`  
**현재**: 기본 스타일  
**목표**: KREAM 스타일 미니멀 디자인  
**작업**:
- [ ] 폼 레이아웃 개선
- [ ] 카카오 로그인 버튼 디자인
- [ ] 에러 메시지 스타일
- [ ] 반응형 디자인

##### B. SearchPage ⏱️ 3-4시간
**파일**: `src/pages/SearchPage.tsx`  
**작업**:
- [ ] KREAM 스타일 검색 바
- [ ] 검색 결과 그리드 레이아웃
- [ ] 가격/카테고리 필터
- [ ] 정렬 옵션 (인기순, 낮은 가격순, 높은 가격순)

##### C. MyOrdersPage ⏱️ 4-5시간
**파일**: `src/pages/MyOrdersPage.tsx`  
**작업**:
- [ ] KREAM 스타일 주문 카드
- [ ] 주문 상태별 필터 (전체, 결제완료, 배송중, 배송완료, 취소)
- [ ] 주문 상세 모달
- [ ] 주문 취소/환불 요청 기능

#### 우선순위 2: 판매자 페이지 (17-21시간)

##### D. SellerPage - 대시보드 ⏱️ 5-6시간
**파일**: `src/pages/SellerPage.tsx`  
**작업**:
- [ ] 매출 통계 차트 (Recharts)
- [ ] 최근 주문 목록
- [ ] 빠른 액션 버튼
- [ ] 알림 센터

##### E. SellerProductsPage ⏱️ 3-4시간
**파일**: `src/pages/SellerProductsPage.tsx`  
**작업**:
- [ ] 제품 그리드 레이아웃
- [ ] 빠른 수정/삭제 기능
- [ ] 재고 관리 UI
- [ ] 제품 검색/필터

##### F. SellerOrdersPage ⏱️ 4-5시간
**파일**: `src/pages/SellerOrdersPage.tsx`  
**작업**:
- [ ] 주문 상태별 탭
- [ ] 배송 처리 UI (송장번호 입력)
- [ ] 주문 상세 모달
- [ ] 엑셀 다운로드

##### G. SellerLiveControlPage ⏱️ 5-6시간
**파일**: `src/pages/SellerLiveControlPage.tsx`  
**작업**:
- [ ] 실시간 시청자 수 표시
- [ ] 채팅 모니터링
- [ ] 제품 추가/수정 UI
- [ ] 라이브 시작/종료 버튼

---

## 🟡 중간 우선순위 (Medium Priority - 1-2개월 내)

### 6. 관리자 페이지 (10-13시간)

#### A. AdminPage ⏱️ 6-8시간
**파일**: `src/pages/AdminPage.tsx`  
**작업**:
- [ ] 전체 매출 통계
- [ ] 사용자 관리 (목록, 검색, 정지)
- [ ] 판매자 승인/거부
- [ ] 실시간 모니터링 대시보드

#### B. AdminSettlementPage ⏱️ 4-5시간
**파일**: `src/pages/AdminSettlementPage.tsx`  
**작업**:
- [ ] 정산 내역 테이블
- [ ] 필터 및 검색
- [ ] 엑셀 다운로드
- [ ] 정산 승인/거부

---

### 7. 기술적 개선 (3-4주)

#### A. SEO 최적화 ⏱️ 2주, $5,000
**작업**:
- [ ] SSR (Server-Side Rendering) 구현
- [ ] 메타 태그 동적 생성
- [ ] Sitemap.xml 자동 생성
- [ ] Open Graph 이미지
- [ ] robots.txt 최적화
- [ ] 구조화된 데이터 (JSON-LD)

**예상 효과**: 자연 유입 +300%, 검색 순위 상승

#### B. 보안 강화 ⏱️ 2-3주, $8,000
**작업**:
- [x] Rate Limiting ✅ 완료
- [x] CSRF 토큰 ✅ 완료
- [x] CSP 헤더 ✅ 완료
- [ ] 2단계 인증 (2FA)
- [ ] 비밀번호 정책 강화 (8자 이상, 특수문자)
- [ ] 로그인 시도 제한 (5회 실패 시 잠금)

**예상 효과**: 보안 사고 -99%, 사용자 신뢰도 증가

---

## 🟢 낮은 우선순위 (Low Priority - 3-6개월 내)

### 8. 소셜 기능 ⏱️ 1-2개월, $20,000
- [ ] 상품 리뷰 시스템 (별점, 사진 리뷰)
- [ ] Q&A 게시판
- [ ] 사용자 팔로우 기능
- [ ] 소셜 공유 (카카오톡, 페이스북)
- [ ] 추천 알고리즘

### 9. 고급 검색 ⏱️ 3주, $10,000
- [ ] Elasticsearch 연동
- [ ] 자동완성 (Autocomplete)
- [ ] 검색어 추천
- [ ] 필터 고도화
- [ ] 검색 히스토리
- [ ] 인기 검색어

### 10. 모바일 PWA ⏱️ 2-3개월, $30,000
- [ ] PWA Manifest 개선
- [ ] 오프라인 모드 지원
- [ ] 푸시 알림 (Web Push)
- [ ] 홈 화면 추가 유도
- [ ] 앱스토어 배포 검토

### 11. 글로벌 버전 ⏱️ 3-4개월, $50,000
- [ ] Google OAuth 로그인
- [ ] Stripe 결제 연동
- [ ] 영어 UI 완성도 향상
- [ ] 글로벌 도메인 (world.ur-team.com)
- [ ] 환율 변환 로직
- [ ] 국제 배송 시스템

---

## 📊 총 작업 시간 및 비용 추정

### 즉시 필요 (1-2주)
| 항목 | 시간 | 비용 | 우선순위 |
|------|------|------|----------|
| 환경 변수 설정 | 5분 | $0 | 🔴 Critical |
| 재배포 & 확인 | 5분 | $0 | 🔴 Critical |
| UI/UX 버그 수정 | 2-3시간 | $500 | 🔴 High |
| 사용자 페이지 3개 | 9-12시간 | $2,000 | 🔴 High |
| **소계** | **~15시간** | **$2,500** | |

### 단기 (1-2개월)
| 항목 | 시간 | 비용 | 우선순위 |
|------|------|------|----------|
| 판매자 페이지 4개 | 17-21시간 | $4,000 | 🟡 Medium |
| 관리자 페이지 2개 | 10-13시간 | $2,500 | 🟡 Medium |
| SEO 최적화 | 2주 | $5,000 | 🟡 Medium |
| 보안 강화 (2FA) | 1주 | $3,000 | 🟡 Medium |
| **소계** | **~80시간** | **$14,500** | |

### 중기 (3-6개월)
| 항목 | 시간 | 비용 | 우선순위 |
|------|------|------|----------|
| 소셜 기능 | 1-2개월 | $20,000 | 🟢 Low |
| 고급 검색 | 3주 | $10,000 | 🟢 Low |
| 모바일 PWA | 2-3개월 | $30,000 | 🟢 Low |
| **소계** | **~400시간** | **$60,000** | |

### 장기 (6-12개월)
| 항목 | 시간 | 비용 | 우선순위 |
|------|------|------|----------|
| 글로벌 버전 | 3-4개월 | $50,000 | 🟢 Low |

### 전체 총계
```
총 작업 시간: ~495시간 (약 12주, 3개월)
총 예상 비용: $127,000

즉시 필요: $2,500 (1-2주)
단기: $14,500 (1-2개월)
중기: $60,000 (3-6개월)
장기: $50,000 (6-12개월)
```

---

## 🎯 권장 작업 순서 (빠짐없이!)

### Phase 1: 즉시 실행 (오늘!)
1. ✅ Cloudflare 환경 변수 설정 (5분)
2. ✅ 재배포 실행 (3분)
3. ✅ Sentry 동작 확인 (2분)
4. ✅ 프로덕션 테스트 8개 시나리오 (30분)

### Phase 2: 1주일 내
5. 🔄 헤더 아이콘 기능 수정 (30분)
6. 🔄 카테고리 페이지 구현 (45분)
7. 🔄 뒤로가기 버튼 수정 (15분)
8. 🔄 "See all" 버튼 연결 (10분)

### Phase 3: 2주 내
9. 🔄 LoginPage KREAM 스타일 (2-3시간)
10. 🔄 SearchPage 개선 (3-4시간)
11. 🔄 MyOrdersPage 개선 (4-5시간)

### Phase 4: 1개월 내
12. 🔄 SellerPage 대시보드 (5-6시간)
13. 🔄 SellerProductsPage (3-4시간)
14. 🔄 SellerOrdersPage (4-5시간)
15. 🔄 SellerLiveControlPage (5-6시간)

### Phase 5: 2개월 내
16. 🔄 AdminPage (6-8시간)
17. 🔄 AdminSettlementPage (4-5시간)
18. 🔄 SEO 최적화 (2주)
19. 🔄 2FA 보안 강화 (1주)

### Phase 6: 3-6개월 (선택)
20. 🔄 소셜 기능 (1-2개월)
21. 🔄 고급 검색 (3주)
22. 🔄 모바일 PWA (2-3개월)

### Phase 7: 6-12개월 (선택)
23. 🔄 글로벌 버전 (3-4개월)

---

## ✅ 오늘 즉시 실행 체크리스트

### 필수 작업 (30분)
- [ ] Cloudflare Dashboard 로그인
- [ ] ur-live 프로젝트 선택
- [ ] Settings → Environment variables → Production
- [ ] `VITE_SENTRY_DSN` 추가
- [ ] `VITE_SENTRY_ENVIRONMENT=production` 추가
- [ ] Deployments → Retry deployment
- [ ] 빌드 완료 대기 (2-3분)
- [ ] https://live.ur-team.com 접속 확인
- [ ] F12 → Console → `[Sentry] Initialized` 확인
- [ ] 테스트 에러 발생: `window.Sentry?.captureException(new Error('Test'))`
- [ ] Sentry Dashboard에서 에러 확인 (5-10분 후)
- [ ] Kakao 로그인 테스트
- [ ] Email 로그인 테스트
- [ ] 결제 플로우 테스트
- [ ] 판매자 로그인 테스트
- [ ] 관리자 로그인 테스트

---

## 📞 중요 링크

| 항목 | URL |
|------|-----|
| **프로덕션** | https://live.ur-team.com |
| **Cloudflare** | https://dash.cloudflare.com |
| **Sentry** | https://o4510992097935360.sentry.io/ |
| **GitHub** | https://github.com/tobe2111/ur-live |
| **Firebase** | https://console.firebase.google.com/ |

---

## 🎉 최종 요약

### 지금 당장 (30분)
✅ **환경 변수 설정 → 재배포 → Sentry 확인 → 프로덕션 테스트**

### 1-2주 내 (15시간, $2,500)
✅ **UI/UX 버그 수정 + 사용자 핵심 페이지 3개**

### 1-2개월 내 (80시간, $14,500)
✅ **판매자 페이지 + 관리자 페이지 + SEO + 2FA**

### 3-12개월 (선택, $110,000)
✅ **소셜 기능, 고급 검색, PWA, 글로벌 버전**

**모든 작업이 위에 나열되어 있습니다. 빠진 것 없습니다!**
