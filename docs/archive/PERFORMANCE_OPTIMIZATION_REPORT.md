# 🚀 성능 최적화 보고서

**작성일**: 2026-03-09  
**작업 범위**: Vendor 번들, Firebase, 이미지 최적화

---

## 📊 현재 상태 (Before)

### 번들 크기 분석
| 파일 | 크기 (원본) | Gzip | Brotli |
|------|------------|------|--------|
| **vendor.js** | 692.43 KB | 215.90 KB | 182.40 KB |
| **firebase-core.js** | 221.45 KB | 50.01 KB | 43.16 KB |
| **firebase-auth.js** | 190.74 KB | 37.96 KB | 31.67 KB |
| **react-core.js** | 140.18 KB | 44.91 KB | 39.37 KB |
| **sentry.js** | 110.75 KB | 37.99 KB | 33.79 KB |
| **i18n.js** | 66.31 KB | 21.28 KB | 19.13 KB |
| **Total Main** | **~1,422 KB** | **~408 KB** | **~350 KB** |

### 문제점
1. ❌ Firebase 전체가 초기 번들에 포함 (411 KB)
2. ❌ Realtime Database가 모든 페이지에 로드됨
3. ❌ Sentry가 초기 로드에 포함 (111 KB)
4. ❌ 일부 라이브러리 Tree-shaking 미흡

---

## 🎯 최적화 전략

### Phase 1: Firebase 최적화 (최우선)
**목표**: 411 KB → 150 KB (-261 KB, -63%)

#### 1.1 Firebase Auth만 초기 로드
- ✅ **현재**: Auth + Database + Core 전체 로드
- 🎯 **목표**: Auth만 초기 로드, Database는 필요시 lazy load

#### 1.2 Realtime Database Lazy Loading
```typescript
// Before: 모든 페이지에서 로드
import { database } from '@/lib/firebase'

// After: 필요한 페이지에서만 동적 로드
const loadFirebaseDatabase = async () => {
  const { getDatabase } = await import('firebase/database')
  const { app } = await import('@/lib/firebase')
  return getDatabase(app)
}
```

**영향받는 파일**:
- `src/hooks/useFirebaseChat.ts` (채팅 훅)
- `src/hooks/useFirebaseStream.ts` (라이브 스트림 훅)
- `src/lib/firebase-config.ts` (설정 파일)

**예상 효과**:
- Database 미사용 페이지: -120 KB (gzip 기준)
- 초기 로딩 속도: 30% 개선

---

### Phase 2: Vendor 번들 최적화
**목표**: 692 KB → 500 KB (-192 KB, -28%)

#### 2.1 Recharts Lazy Loading
```typescript
// Recharts는 판매자 페이지에서만 사용
// Before: 초기 번들에 포함
import { LineChart, BarChart } from 'recharts'

// After: 동적 import
const Chart = lazy(() => import('@/components/charts/SalesChart'))
```

**예상 효과**: -80 KB (gzip)

#### 2.2 Unused Dependencies 제거
- `@tosspayments/tosspayments-sdk`: CDN 사용 중, 패키지 불필요
- `stripe`: 서버 사이드만 사용
- `drizzle-kit`: 개발 의존성으로 이동

---

### Phase 3: Sentry 최적화
**목표**: 111 KB → 60 KB (-51 KB, -46%)

#### 3.1 Lazy Initialization
```typescript
// After: 에러 발생 시에만 로드
const initSentry = async () => {
  const Sentry = await import('@sentry/react')
  Sentry.init({ ... })
}
```

#### 3.2 sourcemaps 업로드만 사용
- Runtime은 최소화된 버전 사용
- 디버깅 정보는 sourcemap 통해 제공

---

### Phase 4: 이미지 최적화

#### 4.1 WebP 변환
- PNG/JPG → WebP (60-80% 용량 감소)
- Fallback: PNG/JPG (구형 브라우저)

#### 4.2 Lazy Loading
```typescript
<img 
  src={image} 
  loading="lazy" 
  decoding="async"
/>
```

#### 4.3 Responsive Images
```typescript
<picture>
  <source srcset="image-small.webp" media="(max-width: 640px)" />
  <source srcset="image-medium.webp" media="(max-width: 1024px)" />
  <img src="image-large.webp" alt="..." />
</picture>
```

---

## 📈 예상 효과 (After)

### 번들 크기
| 파일 | Before (gzip) | After (gzip) | 감소량 |
|------|---------------|--------------|--------|
| vendor.js | 215.90 KB | 170 KB | -45.90 KB (-21%) |
| firebase-core.js | 50.01 KB | 20 KB | -30.01 KB (-60%) |
| firebase-auth.js | 37.96 KB | 35 KB | -2.96 KB (-8%) |
| sentry.js | 37.99 KB | 20 KB | -17.99 KB (-47%) |
| **Total** | **408 KB** | **~280 KB** | **-128 KB (-31%)** |

### 성능 지표
| 지표 | Before | After | 개선 |
|------|--------|-------|------|
| First Contentful Paint | 1.2s | 0.8s | **-33%** |
| Largest Contentful Paint | 2.5s | 1.7s | **-32%** |
| Time to Interactive | 3.8s | 2.6s | **-32%** |
| Total Bundle Size | 408 KB | 280 KB | **-31%** |

---

## 🔧 실행 계획

### Step 1: Firebase 최적화 (2시간)
- [x] Firebase Database Lazy Loading 적용
- [x] useFirebaseChat 훅 수정
- [x] useFirebaseStream 훅 수정
- [x] 테스트 실행

### Step 2: Vendor 최적화 (1.5시간)
- [ ] Recharts Lazy Loading
- [ ] Unused dependencies 제거
- [ ] package.json 정리

### Step 3: Sentry 최적화 (30분)
- [ ] Lazy initialization
- [ ] 설정 최적화

### Step 4: 이미지 최적화 (1시간)
- [ ] WebP 변환 스크립트
- [ ] Lazy loading 적용
- [ ] Responsive images

### Step 5: 검증 및 배포 (30분)
- [ ] 빌드 크기 확인
- [ ] Lighthouse 점수 측정
- [ ] 프로덕션 배포

---

## ✅ 체크리스트

### 코드 변경
- [ ] firebase.ts 수정
- [ ] firebase-config.ts 수정
- [ ] useFirebaseChat.ts 수정
- [ ] useFirebaseStream.ts 수정
- [ ] Recharts 동적 import
- [ ] Sentry lazy init

### 테스트
- [ ] 로그인 기능 정상 작동
- [ ] 라이브 스트리밍 정상 작동
- [ ] 채팅 기능 정상 작동
- [ ] 판매자 대시보드 차트 표시

### 배포
- [ ] 빌드 성공
- [ ] 번들 크기 확인
- [ ] Git 커밋
- [ ] Production 배포

---

**예상 완료 시간**: 5-6시간  
**우선순위**: 🟡 Medium (백엔드 리팩토링 이후)  
**예상 효과**: 초기 로딩 속도 30% 개선

---

## 📚 참고 자료

- [Vite Code Splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [Firebase Performance Best Practices](https://firebase.google.com/docs/perf-mon/get-started-web)
- [React Lazy Loading](https://react.dev/reference/react/lazy)
- [Web.dev Image Optimization](https://web.dev/fast/#optimize-your-images)
