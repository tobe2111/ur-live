# 마이그레이션 완료 계획 (Migration Completion Plan)
**작성일**: 2026-03-05  
**상태**: ✅ Phase 1 완료, Phase 2 진행 중

---

## 📊 현재 상황 분석 (Current Status)

### ✅ 이미 완료된 것
1. **Zustand 스토어 구축** (`src/shared/stores/`)
   - ✅ `useAuthKR.ts` - 한국용 인증 (Kakao + Firebase)
   - ✅ `useAuthWorld.ts` - 글로벌 인증 (Google + Firebase)
   - ✅ `useAuthUI.ts` - UI 상태 관리
   - ✅ 모든 스토어에 `isAuthReady` 포함

2. **호환성 레이어 추가** (`src/contexts/AuthContext.tsx`)
   - ✅ `useAuth()` Hook을 Zustand 스토어로 프록시
   - ✅ 기존 코드 수정 없이 작동 가능
   - ✅ `isAuthReady`, `isLoggedIn`, `loading` 모두 매핑됨

3. **App.tsx 마이그레이션**
   - ✅ `AuthProvider` 제거
   - ✅ Zustand 직접 사용으로 전환
   - ✅ 초기화 로직 App 레벨로 이동

4. **첫 페이지 마이그레이션 완료**
   - ✅ `UserProfilePage.tsx` - Zustand 직접 사용

---

## 🎯 Phase 2: 호환성 레이어로 안정화 (현재)

### 전략: "Big Bang" → "Strangler Fig"
❌ **이전 방식 (실패)**:
- 모든 페이지를 한 번에 수정 시도
- AuthProvider 삭제 → 즉시 에러 폭탄

✅ **새로운 방식 (성공)**:
1. **호환성 레이어 유지** - `useAuth()` 계속 작동
2. **점진적 최적화** - 한 페이지씩 Zustand 직접 사용으로 전환
3. **안정성 우선** - 기능 100% 작동 후 다음 단계

---

## 📝 Phase 2 완료 체크리스트

### 1️⃣ 호환성 레이어 검증 (✅ 완료)
- [x] `isAuthReady` 추가
- [x] `isLoggedIn` 계산 로직 추가
- [x] `loading` → `isLoading` 매핑
- [x] `role` → `userRole` 매핑
- [x] `resetPassword` → `sendPasswordResetEmail` 매핑

### 2️⃣ 빌드 & 배포
```bash
# 로컬 테스트
npm run dev:kr

# 프로덕션 빌드
npm run build:kr

# Cloudflare Pages 배포
npx wrangler pages deploy dist --project-name=ur-live
```

### 3️⃣ 기능 테스트
- [ ] 로그인 페이지: 이메일 로그인
- [ ] 로그인 페이지: 카카오 로그인
- [ ] 회원가입 페이지
- [ ] 체크아웃 페이지 (인증 필요)
- [ ] 상품 상세 페이지 (위시리스트 추가)
- [ ] 관리자 로그인
- [ ] 관리자 대시보드
- [ ] 셀러 로그인
- [ ] 셀러 대시보드
- [ ] 사용자 프로필 페이지

---

## 🔄 Phase 3: 점진적 최적화 (다음 단계)

### 우선순위별 페이지 마이그레이션

#### 🔴 High Priority (매일 사용)
1. `LoginPage.tsx` - 로그인 흐름 최적화
2. `CheckoutPage.tsx` - 결제 흐름 안정성
3. `ProductDetailPage.tsx` - 위시리스트 성능

#### 🟡 Medium Priority (주 1회 사용)
4. `RegisterPage.tsx`
5. `AdminLoginPage.tsx`
6. `SellerLoginPage.tsx`

#### 🟢 Low Priority (월 1회 사용)
7. `AdminPage.tsx`
8. `SellerPage.tsx`

### 마이그레이션 템플릿

**Before (호환성 레이어 사용)**:
```typescript
import { useAuth } from '@/contexts/AuthContext'

const { isLoggedIn, isAuthReady, user } = useAuth()
```

**After (Zustand 직접 사용)**:
```typescript
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'

const useAuth = isKorea() ? useAuthKR : useAuthWorld
const isLoggedIn = useAuth(state => !!state.user)
const isAuthReady = useAuth(state => state.isAuthReady)
const user = useAuth(state => state.user)
```

**Benefits**:
- ✅ **Selector 사용** → 불필요한 리렌더 방지
- ✅ **타입 안전성** → TypeScript 지원 강화
- ✅ **테스트 가능** → Zustand mock 쉬움

---

## 🧹 Phase 4: 정리 (최종 단계)

### 1️⃣ Dead Code 제거
```bash
# 확인 필요
- src/worker/* (194개 엔드포인트 누락)
- src/features/* (사용되지 않는 Feature 기반 구조)
- src/contexts/AuthContext.backup*.tsx
```

### 2️⃣ 문서화
- [ ] Zustand 스토어 API 문서
- [ ] 마이그레이션 가이드
- [ ] 트러블슈팅 FAQ

### 3️⃣ 테스트 추가
- [ ] `useAuthKR` Unit Tests
- [ ] `useAuthWorld` Unit Tests
- [ ] Integration Tests (로그인 흐름)

---

## 📈 성공 지표 (Success Metrics)

### Phase 2 완료 기준
- ✅ 모든 11개 페이지가 에러 없이 작동
- ✅ Kakao 로그인 → UserProfile 흐름 정상
- ✅ 프로덕션 배포 성공

### Phase 3 완료 기준
- 8개 페이지가 Zustand 직접 사용
- Lighthouse Performance 점수 90+ 유지
- 사용자 불만 0건

### Phase 4 완료 기준
- Dead code 0%
- 테스트 커버리지 80%+
- 문서화 100%

---

## 🚨 Rollback Plan (비상 계획)

만약 Phase 2에서 문제가 발생하면:

### Option 1: 호환성 레이어 수정
```typescript
// src/contexts/AuthContext.tsx 버그 수정
// 가장 빠르고 안전함
```

### Option 2: AuthProvider 복원
```bash
git show HEAD~5:src/contexts/AuthContext.tsx > src/contexts/AuthContext.tsx
# App.tsx에 <AuthProvider> 다시 추가
```

### Option 3: 이전 커밋으로 롤백
```bash
git revert HEAD
git push origin main
npx wrangler pages deploy dist --project-name=ur-live
```

---

## 🎓 교훈 (Lessons Learned)

### ❌ 실패한 접근
1. **Big Bang Migration** - 한 번에 모든 것 교체
2. **테스트 없이 배포** - 프로덕션에서 버그 발견
3. **Dead Code 방치** - 유지보수 복잡도 증가

### ✅ 성공하는 접근
1. **호환성 레이어** - 기존 코드 작동 보장
2. **점진적 마이그레이션** - 한 번에 하나씩
3. **테스트 우선** - 배포 전 검증
4. **문서화** - 다음 사람을 위한 가이드

---

## 📞 다음 단계 (Next Actions)

1. **즉시**: 
   - 빌드 & 배포
   - 카카오 로그인 테스트
   - UserProfile 페이지 확인

2. **이번 주**:
   - Phase 2 체크리스트 완료
   - 기능 테스트 모두 통과

3. **다음 주**:
   - Phase 3 시작 (High Priority 페이지 3개)
   - 성능 측정

4. **이번 달**:
   - Phase 4 시작 (정리 & 문서화)
   - 최종 리뷰

---

**문서 작성자**: Claude AI Assistant  
**최종 수정**: 2026-03-05  
**관련 문서**: 
- [Kakao Login Fix](./KAKAO_LOGIN_KOE101_FIX.md)
- [Architecture Analysis](./architecture-analysis.md)
- [Cloudflare Env Setup](./CLOUDFLARE_ENV_SETUP.md)
