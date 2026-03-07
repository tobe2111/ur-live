# Priority 2 진행 상황 - 테스트 확장

## 📅 시작일: 2026-03-07

---

## 🎯 목표

Priority 1 완료 후 Priority 2의 첫 번째 작업인 **테스트 확장**을 진행합니다.

### 목표 지표:
- ✅ 27개 컴포넌트 단위 테스트 작성
- ⏳ 테스트 커버리지 85%+ 달성
- ⏳ E2E 테스트 100+ 시나리오 구현

---

## 📊 현재 진행 상황

### 1. 테스트 인프라 (완료 ✅)
```
✅ Vitest 설정 완료
✅ React Testing Library 설정 완료
✅ 테스트 디렉토리 구조 생성
✅ Coverage 설정 (70% 임계값)
```

### 2. Home 컴포넌트 테스트 (진행 중 🔄)

#### 작성된 테스트:
1. **BannerSection.test.tsx** (8 테스트)
   - ✅ 배너 이미지 렌더링
   - ✅ 배너 설명 표시
   - ✅ 링크 처리
   - ✅ 빈 배열 처리
   - ✅ 다중 배너 처리 (첫 번째만 표시)
   - ✅ 설명 없는 배너 처리
   - ✅ 스타일 클래스 검증

2. **HeroSection.test.tsx** (10 테스트 - 수정 필요)
   - 컴포넌트 인터페이스 불일치 발견
   - 실제: `liveStreamCount`, `onShopNowClick`
   - 테스트 수정 필요

3. **FeaturesSection.test.tsx** (8 테스트 - 수정 필요)
   - 컴포넌트 export 확인 필요

4. **CTASection.test.tsx** (9 테스트 - 수정 필요)
   - 컴포넌트 export 확인 필요

---

## 🔍 발견된 이슈

### 이슈 1: Import/Export 불일치
**문제:** 테스트에서 default import를 사용했지만, 실제 컴포넌트는 named export

**해결 방법:**
```typescript
// ❌ 잘못된 방법
import HeroSection from '@/components/home/HeroSection'

// ✅ 올바른 방법
import { HeroSection } from '@/components/home/HeroSection'
```

### 이슈 2: 컴포넌트 인터페이스 불일치
**문제:** 테스트에서 가정한 props와 실제 컴포넌트 props가 다름

**예시:**
```typescript
// 테스트에서 가정
<HeroSection streams={mockStreams} />

// 실제 컴포넌트
<HeroSection 
  liveStreamCount={number} 
  onShopNowClick={() => void} 
/>
```

---

## 📋 다음 작업 계획

### 즉시 수행:
1. ✅ BannerSection.test.tsx 수정 완료
2. ⏳ HeroSection.test.tsx 컴포넌트 인터페이스 맞춰 수정
3. ⏳ FeaturesSection.test.tsx named export 수정
4. ⏳ CTASection.test.tsx named export 수정

### 단기 (1주):
1. Home 컴포넌트 테스트 완성 (4개)
2. Search 컴포넌트 테스트 작성 (4개)
3. Browse 컴포넌트 테스트 작성 (3개)

### 중기 (2주):
1. Product 컴포넌트 테스트 (3개)
2. MyPage 컴포넌트 테스트 (3개)
3. Cart & Live 컴포넌트 테스트 (7개)
4. E2E 테스트 프레임워크 설정 (Playwright)

---

## 📈 예상 일정

| 단계 | 컴포넌트 | 예상 시간 | 상태 |
|------|---------|----------|------|
| Phase 1 | Home (4개) | 6시간 | 🔄 진행중 (50%) |
| Phase 2 | Search (4개) | 8시간 | ⏳ 대기중 |
| Phase 3 | Browse (3개) | 8시간 | ⏳ 대기중 |
| Phase 4 | Product (3개) | 6시간 | ⏳ 대기중 |
| Phase 5 | MyPage (3개) | 8시간 | ⏳ 대기중 |
| Phase 6 | Cart & Live (7개) | 14시간 | ⏳ 대기중 |
| **총계** | **27개** | **50시간** | **4% 완료** |

---

## 🧪 테스트 전략

### 단위 테스트 작성 원칙:
1. **AAA 패턴** (Arrange, Act, Assert)
2. **한 가지 개념만 테스트**
3. **독립적인 테스트**
4. **의미있는 테스트 이름**
5. **Edge case 포함**

### 테스트할 항목:
- ✅ 렌더링 정상 여부
- ✅ Props 전달 및 표시
- ✅ 사용자 인터랙션
- ✅ 조건부 렌더링
- ✅ Edge cases (빈 데이터, null, undefined)
- ✅ 스타일 클래스 적용
- ⏳ API 호출 (MSW 사용)
- ⏳ 에러 처리

---

## 💡 개선 사항

### 발견된 베스트 프랙티스:
1. **컴포넌트 인터페이스 먼저 확인**
   - 테스트 작성 전 실제 컴포넌트 props 확인 필수

2. **Export 방식 통일 검토**
   - 현재: named export와 default export 혼재
   - 권장: named export로 통일 고려

3. **TypeScript 인터페이스 공유**
   - 테스트와 컴포넌트 간 타입 공유 방안 검토

---

## 🔧 기술 스택

### 현재 사용중:
- ✅ **Vitest** - 테스트 러너
- ✅ **React Testing Library** - 컴포넌트 테스트
- ✅ **jsdom** - DOM 환경 시뮬레이션
- ⏳ **MSW** (Mock Service Worker) - API mocking (설정 예정)
- ⏳ **Playwright** - E2E 테스트 (설정 예정)

### 테스트 커버리지 목표:
```
✅ Lines: 70% (현재 임계값)
⏳ Lines: 85% (목표)
⏳ Functions: 85%
⏳ Branches: 80%
⏳ Statements: 85%
```

---

## 📝 학습 내용

### 테스트 작성 시 주의사항:
1. **컴포넌트 export 방식 확인**
   ```typescript
   // Named export
   export function Component() {}
   import { Component } from './Component'
   
   // Default export
   export default function Component() {}
   import Component from './Component'
   ```

2. **Router 컴포넌트 테스트**
   ```typescript
   render(
     <BrowserRouter>
       <Component />
     </BrowserRouter>
   )
   ```

3. **비동기 작업 테스트**
   ```typescript
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeDefined()
   })
   ```

---

## 🎯 다음 커밋 계획

### Commit 1: Home 컴포넌트 테스트 완성
```
test: Complete unit tests for Home components

- Fix BannerSection test (8 tests passing)
- Fix HeroSection test (update to match actual interface)
- Fix FeaturesSection test (named export)
- Fix CTASection test (named export)

Total: 4 components, ~35 tests
Coverage: Home components 85%+
```

### Commit 2: Search 컴포넌트 테스트
```
test: Add unit tests for Search components

- SearchHeader.test.tsx
- SearchStates.test.tsx
- ProductCard.test.tsx
- SortFilterBar.test.tsx

Total: 4 components, ~30 tests
```

### Commit 3: Browse 컴포넌트 테스트
```
test: Add unit tests for Browse components

- BrowseProductCard.test.tsx (wishlist logic)
- CategoryHeader.test.tsx
- ProductGrid.test.tsx

Total: 3 components, ~25 tests
```

---

## 📌 참고 문서

- [Vitest 공식 문서](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**현재 상태:** 🔄 진행중 (Phase 1: 50%)  
**다음 업데이트:** 테스트 수정 완료 후  
**목표 완료일:** 2주 내
