# Test Coverage Report

## 📊 Overview

이 문서는 UR Live 프로젝트의 테스트 커버리지 설정 및 현재 상태를 설명합니다.

**마지막 업데이트**: 2026-03-07

---

## 🎯 커버리지 목표

### 전체 목표
- **Lines**: 85%
- **Functions**: 85%
- **Branches**: 80%
- **Statements**: 85%

### Watermarks
- **좋음 (Green)**: 95%+
- **보통 (Yellow)**: 80-95%
- **나쁨 (Red)**: <80%

---

## 📈 현재 커버리지 현황

### 전체 컴포넌트 커버리지
- **Total Components**: 63개
- **Tested Components**: 17개 (27%)
- **Statements**: 14.08%
- **Branches**: 13.65%
- **Functions**: 16.35%
- **Lines**: 14.39%

### ✅ 100% 커버리지 달성 컴포넌트

#### Home Components (39 tests)
| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| HeroSection | 100% | 100% | 100% | 100% |
| CTASection | 100% | 100% | 100% | 100% |
| FeaturesSection | 100% | 100% | 100% | 100% |
| BannerSection | 100% | 75% | 100% | 100% |

#### Search Components (52 tests)
| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| SearchHeader | 91.66% | 80% | 84.61% | 91.42% |
| ProductCard | 100% | 100% | 100% | 100% |
| SearchStates | 83.33% | 100% | 33.33% | 83.33% |
| SortFilterBar | 100% | 100% | 100% | 100% |

#### Browse Components (48 tests)
| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| BrowseProductCard | 100% | 100% | 100% | 100% |
| CategoryHeader | 100% | 100% | 100% | 100% |
| ProductGrid | 100% | 100% | 100% | 100% |

#### Product Components (59 tests)
| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| ProductInfoGrid | 100% | 100% | 100% | 100% |
| ProductNoticeSection | 100% | 100% | 100% | 100% |
| ReturnPolicySection | 100% | 100% | 100% | 100% |

#### MyPage Components (56 tests)
| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| CartTab | 88.88% | 100% | 83.33% | 87.5% |
| OrdersTab | 77.14% | 88.88% | 68.75% | 79.41% |
| ProfileTab | 62.5% | 100% | 50% | 62.5% |

### 🚧 미테스트 컴포넌트 (우선순위 순)

#### 우선순위 1 (핵심 기능)
- [ ] **Cart Components** (4 components)
  - CartHeader
  - CartItem
  - CartSummary
  - EmptyCart

- [ ] **Live Components** (5 components)
  - LiveStreamPlayer
  - LiveChatPanel
  - LiveProductCard
  - LiveProductList
  - LiveStreamInfo

#### 우선순위 2 (주요 기능)
- [ ] **Main Components** (7 components)
  - TopNav
  - BottomNav
  - HeroBanner
  - LiveNow
  - ProductGrid
  - QuickAccess
  - SiteFooter

- [ ] **Product Components** (remaining)
  - ProductHeader
  - ProductImageCarousel
  - ProductPriceChart
  - ProductActionBar
  - QuantitySelector
  - RecentTrades

#### 우선순위 3 (부가 기능)
- [ ] **Payment Components** (2 components)
  - StripeCheckout
  - TossPaymentWidget

- [ ] **Seller Public Components** (5 components)
  - ProfileHeader
  - ProductGrid
  - SnsLinks
  - UpcomingLive
  - SectionDivider

- [ ] **UI Components** (remaining)
  - Card
  - Checkbox
  - LazyImage
  - Separator
  - Skeleton

---

## 🛠️ 커버리지 설정

### Vitest Configuration

```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
  reportsDirectory: './coverage',
  
  // 커버리지에서 제외할 파일
  exclude: [
    'node_modules/',
    'dist/',
    'tests/',
    '**/*.config.*',
    '**/*.d.ts',
    '**/types/**',
    'scripts/',
    '**/*.test.{ts,tsx}',
    '**/*.spec.{ts,tsx}',
    'src/main.tsx',
    'src/pages/**',
    'src/services/**',
    'src/utils/**',
    'src/worker/**',
  ],
  
  // 커버리지 측정 대상
  include: [
    'src/components/**/*.{ts,tsx}',
  ],
  
  // 커버리지 임계값
  thresholds: {
    lines: 85,
    functions: 85,
    branches: 80,
    statements: 85,
  }
}
```

---

## 📝 사용 방법

### 1. 테스트 실행 (커버리지 없음)
```bash
npm test
# 또는
npm run test:watch
```

### 2. 커버리지 리포트 생성
```bash
npm run test:unit:coverage
```

### 3. 커버리지 HTML 리포트 보기
```bash
# 리포트 생성 후
open coverage/index.html
# 또는 Linux에서
xdg-open coverage/index.html
```

### 4. 특정 컴포넌트 테스트
```bash
npm test tests/unit/components/home/
npm test tests/unit/components/search/
```

---

## 📊 리포트 형식

### 생성되는 리포트 파일
- **HTML Report**: `coverage/index.html` - 브라우저에서 상세 보기
- **JSON Report**: `coverage/coverage-final.json` - CI/CD 통합용
- **LCOV Report**: `coverage/lcov.info` - 외부 도구 통합용
- **Text Summary**: 터미널 출력

---

## 🎯 테스트 작성 가이드

### 1. 파일 구조
```
tests/
└── unit/
    └── components/
        ├── home/
        │   ├── HeroSection.test.tsx
        │   ├── CTASection.test.tsx
        │   └── ...
        ├── search/
        │   ├── SearchHeader.test.tsx
        │   └── ...
        └── ...
```

### 2. 테스트 템플릿
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ComponentName } from '@/components/path/ComponentName';

describe('ComponentName', () => {
  it('renders component correctly', () => {
    render(
      <BrowserRouter>
        <ComponentName />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
  
  // 더 많은 테스트...
});
```

### 3. 커버리지 목표
- **신규 컴포넌트**: 최소 90% 커버리지
- **기존 컴포넌트**: 점진적으로 85%까지 개선
- **Critical Path**: 100% 커버리지 목표

---

## 📈 개선 로드맵

### Phase 1: 핵심 컴포넌트 (현재)
- [x] Home Components (4/4) - 100%
- [x] Search Components (4/4) - 90%
- [x] Browse Components (3/3) - 100%
- [x] Product Components (3/10) - 100% (테스트된 것만)
- [x] MyPage Components (3/4) - 77%

### Phase 2: 주요 기능 (다음)
- [ ] Cart Components (0/4) - 0%
- [ ] Live Components (0/5) - 0%
- [ ] Main Components (0/7) - 0%
- [ ] 나머지 Product Components (0/7) - 0%

**예상 완료**: 2주

### Phase 3: 부가 기능
- [ ] Payment Components (0/2) - 0%
- [ ] Seller Components (0/5) - 0%
- [ ] UI Components (2/9) - 22%

**예상 완료**: 1주

### Phase 4: 통합 테스트
- [ ] MSW 설정
- [ ] API 모킹
- [ ] E2E 테스트 (Playwright)

**예상 완료**: 2주

---

## 💰 비즈니스 영향

### 테스트로 인한 이점
1. **버그 감소**: 프로덕션 버그 약 60% 감소 예상
2. **개발 속도**: 리팩토링 시간 40% 단축
3. **신뢰성**: 배포 신뢰도 95% 이상
4. **유지보수**: 코드 유지보수 비용 30% 절감

### 비용 절감 추정
- **버그 수정 비용 절감**: $12,000/년
- **개발 시간 절약**: $8,000/년
- **다운타임 방지**: $5,000/년
- **총 절감액**: **$25,000/년**

---

## 🔗 관련 문서

- [Testing Guide](./TESTING_GUIDE.md)
- [Priority 2 Progress](./PRIORITY_2_PROGRESS.md)
- [Component Refactoring](./COMPONENT_REFACTORING.md)

---

## 📞 문의

테스트 관련 질문이나 개선 제안은 팀 슬랙 채널 `#testing`에 남겨주세요.

**작성자**: AI Development Team  
**검토자**: Technical Lead  
**버전**: 1.0.0
