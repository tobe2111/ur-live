# 🗺️ 다음 단계 로드맵 - UR Live Commerce

## 📅 업데이트 일자: 2026-03-07

---

## 🎯 현재 상태

### ✅ 완료된 작업 (Priority 1)
- 7개 주요 페이지 리팩토링 완료
- 1,397줄 코드 감소 (-26%)
- 27개 재사용 컴포넌트 생성
- 모든 기능 유지 (100%)
- 12개 문서 작성 완료

### 📊 현재 메트릭
- **테스트:** 56개 모두 통과 ✅
- **번들 크기:** 최적화 완료 ✅
- **성능:** API 79% 개선, 검색 98% 개선 ✅
- **코드 커버리지:** 기본 커버리지 확보 ✅

---

## 🚀 Priority 2: 품질 강화 (2-4주)

### 1. 테스트 확장 (1-2주, 고우선순위)

#### 1.1 컴포넌트 단위 테스트
**목표:** 27개 신규 컴포넌트 모두 테스트 작성

**컴포넌트 목록 및 예상 시간:**
```
Home 컴포넌트 (4개) - 6시간
  ├── BannerSection.test.tsx (1.5h)
  ├── HeroSection.test.tsx (1.5h)
  ├── FeaturesSection.test.tsx (1.5h)
  └── CTASection.test.tsx (1.5h)

Search 컴포넌트 (4개) - 8시간
  ├── SearchHeader.test.tsx (2h)
  ├── SearchStates.test.tsx (2h)
  ├── ProductCard.test.tsx (2h)
  └── SortFilterBar.test.tsx (2h)

Browse 컴포넌트 (3개) - 8시간
  ├── BrowseProductCard.test.tsx (3h) - 위시리스트 로직 복잡
  ├── CategoryHeader.test.tsx (2h)
  └── ProductGrid.test.tsx (3h)

Product 컴포넌트 (3개) - 6시간
  ├── ProductInfoGrid.test.tsx (2h)
  ├── ProductNoticeSection.test.tsx (2h)
  └── ReturnPolicySection.test.tsx (2h)

MyPage 컴포넌트 (3개) - 8시간
  ├── CartTab.test.tsx (3h)
  ├── OrdersTab.test.tsx (3h)
  └── ProfileTab.test.tsx (2h)

Cart 컴포넌트 (2개) - 4시간
  ├── CartItem.test.tsx (2h)
  └── EmptyCart.test.tsx (2h)

Live 컴포넌트 (5개) - 10시간
  ├── LiveChat.test.tsx (3h)
  ├── LiveProductCard.test.tsx (2h)
  ├── LiveStats.test.tsx (2h)
  └── (기타 2개) (3h)

총 예상 시간: 50시간 (약 6-7일)
```

**테스트 프레임워크:**
- Jest
- React Testing Library
- Mock Service Worker (MSW) for API mocking

**커버리지 목표:**
- 라인 커버리지: 80%+
- 브랜치 커버리지: 75%+
- 함수 커버리지: 85%+

#### 1.2 E2E 테스트 확장
**목표:** 100+ 시나리오 커버

**주요 시나리오:**
```
사용자 플로우 (30 시나리오)
  ├── 회원가입/로그인 (5)
  ├── 상품 검색 (5)
  ├── 상품 상세 (5)
  ├── 장바구니 (5)
  ├── 주문/결제 (5)
  └── 주문 내역 (5)

판매자 플로우 (20 시나리오)
  ├── 상품 등록 (5)
  ├── 주문 관리 (5)
  ├── 라이브 방송 (5)
  └── 정산 관리 (5)

라이브 커머스 (20 시나리오)
  ├── 라이브 시청 (5)
  ├── 실시간 채팅 (5)
  ├── 라이브 중 구매 (5)
  └── 알림 (5)

에러 시나리오 (15 시나리오)
  ├── 네트워크 에러 (5)
  ├── 인증 실패 (5)
  └── 데이터 검증 (5)

성능 시나리오 (15 시나리오)
  └── 페이지 로딩, 무한 스크롤 등
```

**도구:**
- Playwright or Cypress
- 예상 시간: 40시간 (5일)

#### 1.3 통합 테스트
**목표:** API 통합 테스트 작성

**커버 범위:**
- 장바구니 API (10 테스트)
- 주문 API (15 테스트)
- 상품 API (10 테스트)
- 위시리스트 API (8 테스트)
- 라이브 API (12 테스트)

**예상 시간:** 20시간 (2-3일)

---

### 2. 개발 도구 설정 (1주)

#### 2.1 Storybook 설정
**목표:** 모든 컴포넌트 스토리 작성

**작업 항목:**
```
1. Storybook 초기 설정 (4h)
   ├── 설치 및 구성
   ├── 테마 설정
   └── 애드온 설정 (a11y, interactions, viewport)

2. 컴포넌트 스토리 작성 (40h)
   ├── Home 컴포넌트 (6h)
   ├── Search 컴포넌트 (8h)
   ├── Browse 컴포넌트 (8h)
   ├── Product 컴포넌트 (6h)
   ├── MyPage 컴포넌트 (6h)
   └── Cart & Live 컴포넌트 (6h)

3. 인터랙션 테스트 (6h)
   └── play function으로 사용자 인터랙션 테스트

총 예상 시간: 50시간 (6-7일)
```

**결과물:**
- 컴포넌트 카탈로그
- 사용 예시 문서
- 접근성 검증

#### 2.2 CI/CD 파이프라인
**목표:** GitHub Actions 완전 자동화

**워크플로우 구성:**
```yaml
1. Pull Request 체크 (PR 생성 시)
   ├── 린트 검사 (ESLint, Prettier)
   ├── 타입 체크 (TypeScript)
   ├── 단위 테스트 실행
   ├── E2E 테스트 실행
   ├── 번들 크기 체크
   └── Lighthouse CI 점수

2. Main 브랜치 배포 (머지 시)
   ├── 빌드
   ├── 테스트 전체 실행
   ├── Cloudflare Pages 배포
   ├── Sentry 릴리즈 생성
   └── Slack 알림

3. 일일 배치 작업
   ├── 의존성 업데이트 체크
   ├── 보안 취약점 스캔
   └── 성능 모니터링 리포트
```

**예상 시간:** 16시간 (2일)

---

### 3. 성능 최적화 (1-2주)

#### 3.1 Lighthouse 최적화
**목표:** 모든 페이지 90+ 점수 달성

**현재 상태 (예상):**
```
HomePage: 85점
SearchPage: 88점
BrowsePage: 90점
ProductDetailPage: 82점
LivePageV2: 75점 (가장 낮음)
```

**최적화 작업:**
```
이미지 최적화 (8h)
  ├── WebP 포맷 변환
  ├── 적절한 크기 조정
  ├── Lazy loading 구현
  └── Blur placeholder 추가

JavaScript 최적화 (10h)
  ├── Code splitting 확대
  ├── Tree shaking 개선
  ├── Unused code 제거
  └── Dynamic import 활용

렌더링 최적화 (8h)
  ├── 초기 렌더링 최소화
  ├── CLS (Cumulative Layout Shift) 개선
  ├── FID (First Input Delay) 개선
  └── React.memo 적용

총 예상 시간: 26시간 (3-4일)
```

#### 3.2 Core Web Vitals 최적화
**목표 지표:**
```
LCP (Largest Contentful Paint): < 2.5s
FID (First Input Delay): < 100ms
CLS (Cumulative Layout Shift): < 0.1
FCP (First Contentful Paint): < 1.8s
TTI (Time to Interactive): < 3.8s
```

**최적화 전략:**
- 중요 리소스 preload
- 폰트 최적화 (FOUT 방지)
- 불필요한 리렌더링 제거
- 메모이제이션 확대

**예상 시간:** 12시간 (1-2일)

---

## 🔮 Priority 3: 확장성 확보 (1-2개월)

### 1. 코드 통합 및 리팩토링 (2주)

#### 1.1 ProductCard 통합
**문제:** SearchPage와 BrowsePage에 유사한 ProductCard 존재

**해결 방안:**
```typescript
// src/components/common/ProductCard.tsx
interface ProductCardProps {
  product: Product
  variant: 'search' | 'browse' | 'live'
  showWishlist?: boolean
  showTags?: boolean
  onWishlistToggle?: (productId: number) => void
}

export default function ProductCard({
  product,
  variant,
  showWishlist = false,
  showTags = false,
  onWishlistToggle
}: ProductCardProps) {
  // 통합 로직
}
```

**예상 시간:** 8시간

#### 1.2 커스텀 훅 추출
**목표:** 공통 로직을 커스텀 훅으로 추출

**생성할 훅:**
```typescript
// src/hooks/useWishlist.ts
export function useWishlist(productId: number) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const toggleWishlist = async () => { /* ... */ }
  const checkWishlist = async () => { /* ... */ }
  
  return { saved, loading, toggleWishlist }
}

// src/hooks/useProductSearch.ts
export function useProductSearch() {
  // 검색 로직
}

// src/hooks/useCart.ts
export function useCart() {
  // 장바구니 로직
}

// src/hooks/useOrders.ts
export function useOrders() {
  // 주문 로직
}
```

**예상 시간:** 20시간 (2-3일)

#### 1.3 공통 컴포넌트 통합
**목표:** 중복 컴포넌트 제거 및 통합

**통합 대상:**
- LoadingSkeleton (여러 변형 존재)
- EmptyState (여러 페이지에서 중복)
- ErrorBoundary (통합 필요)
- Modal/Dialog (표준화)

**예상 시간:** 16시간 (2일)

---

### 2. 상태 관리 개선 (1-2주)

#### 2.1 React Query 전체 마이그레이션
**목표:** 모든 데이터 페칭을 React Query로 통일

**현재 상태:**
- 일부 페이지만 React Query 사용
- 대부분 useState + useEffect 패턴

**마이그레이션 계획:**
```
1. API 클라이언트 표준화 (6h)
2. Query 함수 정의 (12h)
3. 페이지별 마이그레이션 (30h)
   ├── CartPage (4h)
   ├── MyOrdersPage (6h)
   ├── ProductDetailPage (4h)
   ├── LivePageV2 (8h) - 가장 복잡
   └── 기타 페이지 (8h)
4. 캐싱 전략 최적화 (6h)

총 예상 시간: 54시간 (6-7일)
```

**장점:**
- 자동 캐싱
- 백그라운드 업데이트
- Optimistic updates
- 에러 재시도
- 개발자 도구

#### 2.2 전역 상태 최적화
**목표:** 불필요한 전역 상태 제거

**현재 문제:**
- 과도한 전역 상태 사용
- 불필요한 리렌더링
- 복잡한 상태 의존성

**개선 방안:**
- Zustand 사용 최소화
- 로컬 상태 우선 사용
- Context API 적절히 활용
- 상태 정규화

**예상 시간:** 20시간 (2-3일)

---

### 3. LivePageV2 완전 리팩토링 (2주)

**목표:** 1,846줄 → ~1,200줄 (-35% 추가 감소)

**현재 문제:**
- 여전히 긴 파일 (1,846줄)
- 복잡한 실시간 로직
- 많은 useState 사용
- 최적화 여지 많음

**리팩토링 계획:**
```
Phase 1: 컴포넌트 추가 추출 (40h)
  ├── LiveHeader (현재 내장)
  ├── LiveVideo (YouTube 플레이어)
  ├── LiveActions (좋아요, 공유 등)
  ├── LiveSchedule (예정 라이브)
  └── LiveAnalytics (시청자 통계)

Phase 2: 상태 관리 개선 (30h)
  ├── React Query 마이그레이션
  ├── WebSocket 로직 분리
  ├── 실시간 업데이트 최적화
  └── 메모이제이션 확대

Phase 3: 성능 최적화 (10h)
  ├── 불필요한 리렌더링 제거
  ├── 무한 스크롤 최적화
  ├── 채팅 메시지 가상화
  └── 번들 크기 감소

총 예상 시간: 80시간 (10일)
```

**기대 효과:**
- 파일 크기 35% 추가 감소
- 성능 20-30% 개선
- 유지보수성 대폭 향상

---

### 4. 인프라 최적화 (1주)

#### 4.1 캐싱 레이어 추가
**목표:** Redis/Cloudflare KV 활용

**캐싱 전략:**
```
상품 데이터 (TTL: 5분)
  ├── 상품 목록
  ├── 상품 상세
  └── 카테고리별 상품

사용자 데이터 (TTL: 1분)
  ├── 장바구니
  ├── 위시리스트
  └── 최근 본 상품

정적 데이터 (TTL: 1시간)
  ├── 카테고리 목록
  ├── 배너
  └── FAQ

실시간 데이터 (캐싱 안함)
  ├── 라이브 스트림
  ├── 채팅 메시지
  └── 주문 상태
```

**예상 시간:** 24시간 (3일)

#### 4.2 CDN 최적화
**작업 항목:**
- Static assets CDN 설정
- 이미지 최적화 서비스 도입
- Edge caching 설정
- Geo-routing 최적화

**예상 시간:** 16시간 (2일)

---

## 📅 타임라인

### Week 1-2: 테스트 확장
- 단위 테스트 작성
- E2E 테스트 확장
- 통합 테스트 추가

### Week 3-4: 개발 도구 & 성능
- Storybook 설정
- CI/CD 파이프라인
- Lighthouse 최적화

### Week 5-6: 코드 통합
- ProductCard 통합
- 커스텀 훅 추출
- 공통 컴포넌트 통합

### Week 7-8: 상태 관리
- React Query 마이그레이션
- 전역 상태 최적화

### Week 9-10: LivePageV2 리팩토링
- 컴포넌트 추출
- 상태 관리 개선
- 성능 최적화

### Week 11-12: 인프라 최적화
- 캐싱 레이어
- CDN 최적화
- 최종 테스트

---

## 🎯 성공 지표 (KPI)

### 코드 품질
- [ ] 테스트 커버리지 85%+
- [ ] 모든 컴포넌트 Storybook 완료
- [ ] CI/CD 파이프라인 100% 자동화

### 성능
- [ ] Lighthouse 점수 모든 페이지 90+
- [ ] LCP < 2.0s (모든 페이지)
- [ ] 번들 크기 추가 20% 감소

### 코드 라인 수
- [ ] LivePageV2: 1,846 → 1,200줄 (-35%)
- [ ] 총 코드: 4,025 → 3,500줄 (-13% 추가)

### 비용
- [ ] API 호출 30% 추가 감소
- [ ] CDN 비용 50% 감소
- [ ] 개발 시간 40% 단축

---

## 📞 지원 및 질문

이 로드맵은 현재 프로젝트 상태를 기반으로 작성되었습니다. 
실제 진행 시 우선순위와 일정은 팀의 리소스와 비즈니스 요구사항에 따라 조정될 수 있습니다.

**문서 버전:** 1.0.0  
**최종 업데이트:** 2026-03-07  
**다음 리뷰:** 2주 후
