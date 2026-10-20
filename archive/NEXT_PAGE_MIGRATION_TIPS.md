# 다음 페이지 마이그레이션 가이드

## 📚 마이그레이션 패턴 (공통)

### 기본 템플릿
```typescript
// 1️⃣ Import 변경
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'

// 2️⃣ Store 선택
const useAuth = isKorea() ? useAuthKR : useAuthWorld

// 3️⃣ Selector 사용 (필요한 상태만 구독)
const user = useAuth(state => state.user)
const isAuthReady = useAuth(state => state.isAuthReady)

// 4️⃣ Actions (함수 참조만, 리렌더 없음)
const loginWithEmail = useAuth(state => state.loginWithEmail)
const signupWithEmail = useAuth(state => state.signupWithEmail)
const logout = useAuth(state => state.logout)
```

---

## 🎯 Priority 1: RegisterPage.tsx

### 현재 코드 (추정)
```typescript
import { useAuth } from '@/contexts/AuthContext'

const { signupWithEmail, isLoggedIn, isAuthReady } = useAuth()

async function handleRegister(e) {
  await signupWithEmail(email, password, displayName)
  navigate('/')
}
```

### 마이그레이션
```typescript
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'

// Store 선택
const useAuth = isKorea() ? useAuthKR : useAuthWorld

// ✅ Selector
const user = useAuth(state => state.user)
const isAuthReady = useAuth(state => state.isAuthReady)
const isLoggedIn = !!user

// ✅ Action
const signupWithEmailAction = useAuth(state => state.signupWithEmail)

async function handleRegister(e) {
  e.preventDefault()
  try {
    // ✅ Direct call
    await signupWithEmailAction(email, password, displayName)
    navigate('/')
  } catch (err) {
    setError(err.message)
  }
}
```

**변경 파일**: `src/pages/RegisterPage.tsx`  
**예상 시간**: 10분  
**위험도**: 낮음 (LoginPage와 유사)

---

## 🎯 Priority 2: CheckoutPage.tsx

### 현재 코드 (추정)
```typescript
import { useAuth } from '@/contexts/AuthContext'

const { user, loading: authLoading, isAuthReady } = useAuth()

if (!isAuthReady) return <Loading />
if (!user) return <Navigate to="/login?returnUrl=/checkout" />
```

### 마이그레이션
```typescript
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'

// Store 선택
const useAuth = isKorea() ? useAuthKR : useAuthWorld

// ✅ Read-only state (actions 불필요)
const user = useAuth(state => state.user)
const isAuthReady = useAuth(state => state.isAuthReady)
const authLoading = useAuth(state => state.isLoading)

// ✅ Auth Guard
if (!isAuthReady) {
  return <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
  </div>
}

if (!user) {
  return <Navigate to="/login?returnUrl=/checkout" replace />
}

// Checkout logic...
```

**변경 파일**: `src/pages/CheckoutPage.tsx`  
**예상 시간**: 15분  
**위험도**: 중간 (결제 흐름 테스트 필요)

---

## 🎯 Priority 3: ProductDetailPage.tsx

### 현재 코드 (추정)
```typescript
import { useAuth } from '@/contexts/AuthContext'

const { isLoggedIn } = useAuth()

const handleAddToWishlist = async () => {
  if (!isLoggedIn) {
    navigate('/login?returnUrl=' + location.pathname)
    return
  }
  // Add to wishlist...
}
```

### 마이그레이션
```typescript
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'

// Store 선택
const useAuth = isKorea() ? useAuthKR : useAuthWorld

// ✅ Minimal subscription
const user = useAuth(state => state.user)
const isLoggedIn = !!user

const handleAddToWishlist = async () => {
  if (!isLoggedIn) {
    const currentUrl = location.pathname + location.search
    navigate('/login?returnUrl=' + encodeURIComponent(currentUrl))
    return
  }
  
  // Add to wishlist...
  await api.post('/api/wishlist', { productId })
}
```

**변경 파일**: `src/pages/ProductDetailPage.tsx`  
**예상 시간**: 10분  
**위험도**: 낮음 (선택적 인증만)

---

## 🎯 Priority 4-6: Admin/Seller Pages

### AdminLoginPage.tsx
```typescript
// ✅ Similar to LoginPage pattern
const useAuth = isKorea() ? useAuthKR : useAuthWorld
const user = useAuth(state => state.user)
const isAuthReady = useAuth(state => state.isAuthReady)
const userRole = useAuth(state => state.userRole)
const logout = useAuth(state => state.logout)

useEffect(() => {
  if (isAuthReady && user && userRole === 'admin') {
    navigate('/admin/dashboard')
  }
}, [isAuthReady, user, userRole])
```

### AdminPage.tsx / SellerPage.tsx
```typescript
// ✅ Role-based guard
const useAuth = isKorea() ? useAuthKR : useAuthWorld
const user = useAuth(state => state.user)
const isAuthReady = useAuth(state => state.isAuthReady)
const userRole = useAuth(state => state.userRole)

if (!isAuthReady) return <Loading />
if (!user) return <Navigate to="/admin/login" />
if (userRole !== 'admin') return <Navigate to="/" />

// Admin/Seller logic...
```

**변경 파일**: 
- `src/pages/AdminLoginPage.tsx`
- `src/pages/AdminPage.tsx`
- `src/pages/SellerLoginPage.tsx`
- `src/pages/SellerPage.tsx`

**예상 시간**: 각 10-15분  
**위험도**: 중간 (Role 확인 필요)

---

## 📋 마이그레이션 체크리스트

### 페이지별 완료 상태
- [x] 1. LoginPage.tsx ✅ (완료)
- [ ] 2. RegisterPage.tsx ⏳
- [ ] 3. CheckoutPage.tsx ⏳
- [ ] 4. ProductDetailPage.tsx ⏳
- [ ] 5. AdminLoginPage.tsx ⏳
- [ ] 6. AdminPage.tsx ⏳
- [ ] 7. SellerLoginPage.tsx ⏳
- [ ] 8. SellerPage.tsx ⏳
- [ ] 9. UserProfilePage.tsx ✅ (완료)

### 공통 컴포넌트
- [ ] 10. RouteGuards.tsx ⏳
- [ ] 11. TopNav.tsx ⏳

---

## 🚀 빠른 마이그레이션 스크립트

### 자동화 도구 (선택적)
```bash
#!/bin/bash
# migrate-page.sh <filename>

FILE=$1
BACKUP="${FILE}.OLD.tsx"

# 백업
cp "src/pages/${FILE}.tsx" "src/pages/${BACKUP}"

# 패턴 교체 (sed 사용)
sed -i "s/import { useAuth } from '@\/contexts\/AuthContext'/import { useAuthKR } from '@\/shared\/stores\/useAuthKR'\nimport { useAuthWorld } from '@\/shared\/stores\/useAuthWorld'\nimport { isKorea } from '@\/config\/region'/g" "src/pages/${FILE}.tsx"

# 테스트
npm run build:kr

# 성공 시 커밋
git add "src/pages/${FILE}.tsx" "src/pages/${BACKUP}"
git commit -m "feat(auth): Migrate ${FILE} to Zustand"
```

---

## 🧪 테스트 전략

### 각 페이지별 테스트
1. **LoginPage** ✅
   - [x] Kakao 로그인
   - [x] 이메일 로그인
   - [x] 비밀번호 재설정
   - [x] returnUrl 처리

2. **RegisterPage** ⏳
   - [ ] 회원가입 흐름
   - [ ] 이메일 중복 체크
   - [ ] 자동 로그인

3. **CheckoutPage** ⏳
   - [ ] 로그인 사용자만 접근
   - [ ] 비로그인 → login 리다이렉트
   - [ ] 결제 흐름

4. **ProductDetailPage** ⏳
   - [ ] 위시리스트 추가 (로그인 필요)
   - [ ] 비로그인 시 login 리다이렉트

5. **Admin/Seller Pages** ⏳
   - [ ] Role 기반 접근 제어
   - [ ] 권한 없을 시 리다이렉트

---

## 📊 예상 일정

| 페이지 | 예상 시간 | 우선순위 | 위험도 |
|--------|----------|----------|--------|
| LoginPage | ✅ 완료 | High | Low |
| RegisterPage | 10분 | High | Low |
| CheckoutPage | 15분 | High | Medium |
| ProductDetailPage | 10분 | High | Low |
| AdminLoginPage | 15분 | Medium | Medium |
| AdminPage | 15분 | Medium | Medium |
| SellerLoginPage | 15분 | Medium | Medium |
| SellerPage | 15분 | Medium | Medium |
| UserProfilePage | ✅ 완료 | High | Low |
| **총합** | **~2시간** | - | - |

---

## 🎓 학습 포인트

### LoginPage에서 배운 것
1. ✅ **Selector 패턴**: 리렌더 최소화
2. ✅ **직접 호출**: Firebase signInWithCustomToken
3. ✅ **명시적 의존성**: 디버깅 쉬움
4. ✅ **KR/World 분기**: isKorea() 활용

### 다음 페이지에 적용할 것
1. ✅ **일관된 패턴**: 모든 페이지 동일 구조
2. ✅ **점진적 마이그레이션**: 한 번에 하나씩
3. ✅ **테스트 우선**: 배포 전 검증
4. ✅ **백업 유지**: .OLD.tsx 파일 보관

---

## 📞 다음 단계

### 즉시 (오늘)
1. ⏳ Cloudflare Pages 자동 배포 대기
2. ⏳ LoginPage Kakao 로그인 테스트
3. ⏳ Debug 페이지 확인

### 이번 주
4. RegisterPage.tsx 마이그레이션
5. CheckoutPage.tsx 마이그레이션
6. ProductDetailPage.tsx 마이그레이션

### 다음 주
7. Admin/Seller 페이지 마이그레이션 (4개)
8. RouteGuards/TopNav 마이그레이션
9. 호환성 레이어 제거 검토

---

**문서 작성**: 2026-03-05  
**Git Commit**: fe63377  
**Status**: ✅ LoginPage 완료, 다음 페이지 준비
