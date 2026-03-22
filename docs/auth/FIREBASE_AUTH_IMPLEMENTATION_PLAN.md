# 🔥 Firebase Auth 완전 마이그레이션 계획서

> **작성일**: 2026-02-27  
> **예상 소요 시간**: 5-6시간  
> **목표**: 73점 → 100점 (보안 5배 향상, 개발 시간 90% 단축)

---

## 🎯 **마이그레이션 전략**

### **1. 사용자 타입별 인증 처리**
| 사용자 타입 | 현재 방식 | Firebase Auth 전환 방식 |
|------------|----------|------------------------|
| **일반 사용자** (viewer) | D1 users + SESSION_KV | Firebase Email/Password Auth |
| **카카오 로그인** (viewer) | Custom Token (Kakao OAuth) → D1 | Firebase Custom Token (Kakao OAuth) → D1 sync |
| **셀러** (seller) | D1 sellers + JWT | Firebase Email/Password Auth (custom claims: role=seller) |
| **관리자** (admin) | D1 admins + JWT | Firebase Email/Password Auth (custom claims: role=admin) |

### **2. 데이터베이스 전략**
- **Firebase Auth**: 인증만 담당 (email, password, uid, custom claims)
- **Cloudflare D1**: 비즈니스 데이터 저장 (firebase_uid로 연결)
  ```sql
  users table: id, firebase_uid, email, name, kakao_id, ...
  sellers table: id, firebase_uid, email, business_name, ...
  admins table: id, firebase_uid, email, role, ...
  ```

### **3. 무한 로그인 루프 방지 전략** ⚠️
**원인**: Firebase Auth 상태 변경 → AuthContext 리렌더링 → 중복 리다이렉트

**해결책**:
1. `AuthContext`에 `isAuthReady` 플래그 추가 (Firebase Auth 초기화 완료 여부)
2. `onAuthStateChanged` 리스너는 **한 번만** 등록
3. 로그인 페이지에서 `isAuthReady && user` 체크 후 리다이렉트
4. Protected Route에서 `isAuthReady` 체크 (로딩 스피너 표시)

---

## 📦 **Phase 1: 백엔드 Firebase Auth 설정** (30분)

### 1.1 Firebase Admin SDK 커스텀 토큰 생성 ✅ (완료)
```typescript
// src/lib/firebase-auth.ts
export async function generateFirebaseCustomToken(
  userId: string,
  claims?: Record<string, any>
): Promise<string>
```

### 1.2 D1 스키마 마이그레이션 ✅ (완료)
```sql
-- migrations/add_firebase_uid.sql
ALTER TABLE users ADD COLUMN firebase_uid TEXT;
ALTER TABLE sellers ADD COLUMN firebase_uid TEXT;
ALTER TABLE admins ADD COLUMN firebase_uid TEXT;

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_sellers_firebase_uid ON sellers(firebase_uid);
CREATE INDEX idx_admins_firebase_uid ON admins(firebase_uid);
```

### 1.3 Firebase JWT 검증 미들웨어 ✅ (완료)
```typescript
// src/lib/firebase-jwt-verify.ts
export async function verifyFirebaseToken(idToken: string, env: Env)
```

---

## 🎨 **Phase 2: 프론트엔드 AuthContext 리팩토링** (1.5시간)

### 2.1 Firebase Auth 초기화
```typescript
// src/contexts/AuthContext.tsx
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth(app);
const [user, setUser] = useState<User | null>(null);
const [isAuthReady, setIsAuthReady] = useState(false);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    setIsAuthReady(true);
  });
  return () => unsubscribe();
}, []);
```

### 2.2 로그인 함수
```typescript
const login = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await userCredential.user.getIdToken();
  
  // D1과 동기화
  await api.post('/api/auth/firebase/sync', { idToken });
  
  localStorage.setItem('firebase_token', idToken);
};
```

### 2.3 카카오 로그인 (Custom Token)
```typescript
const loginWithKakao = async (kakaoAccessToken: string) => {
  // 백엔드에서 Custom Token 받기
  const { customToken, user } = await api.post('/api/auth/kakao/firebase', { 
    accessToken: kakaoAccessToken 
  });
  
  // Firebase Auth에 Custom Token으로 로그인
  const userCredential = await signInWithCustomToken(auth, customToken);
  const idToken = await userCredential.user.getIdToken();
  
  localStorage.setItem('firebase_token', idToken);
};
```

---

## 🔐 **Phase 3: 셀러/관리자 인증 업그레이드** (1.5시간)

### 3.1 Custom Claims로 역할 관리
```typescript
// 백엔드: 셀러 가입 시 Custom Claims 추가
const customToken = await generateFirebaseCustomToken(userId, {
  role: 'seller',
  sellerId: sellerId
});

// 프론트엔드: Custom Claims 확인
const idTokenResult = await user.getIdTokenResult();
if (idTokenResult.claims.role === 'seller') {
  navigate('/seller');
} else if (idTokenResult.claims.role === 'admin') {
  navigate('/admin');
}
```

### 3.2 Protected Route 강화
```typescript
// src/components/ProtectedRoute.tsx
if (!isAuthReady) {
  return <LoadingSpinner />;
}

if (!user) {
  return <Navigate to="/login" />;
}

const idTokenResult = await user.getIdTokenResult();
if (requiredRole && idTokenResult.claims.role !== requiredRole) {
  return <Navigate to="/unauthorized" />;
}

return <Outlet />;
```

---

## 🧪 **Phase 4: UI 업데이트** (1.5시간)

### 4.1 일반 사용자 로그인 페이지
```typescript
// src/pages/LoginPage.tsx
const handleEmailLogin = async (email: string, password: string) => {
  await signInWithEmailAndPassword(auth, email, password);
  const idToken = await auth.currentUser.getIdToken();
  
  // D1 동기화
  await api.post('/api/auth/firebase/sync', { idToken });
  
  navigate('/');
};
```

### 4.2 비밀번호 재설정
```typescript
import { sendPasswordResetEmail } from 'firebase/auth';

const handleForgotPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email);
  alert('비밀번호 재설정 이메일이 발송되었습니다.');
};
```

### 4.3 셀러 로그인 페이지 (SellerLoginPage.tsx)
```typescript
const handleSellerLogin = async (email: string, password: string) => {
  // Firebase Auth 로그인
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await userCredential.user.getIdToken();
  
  // Custom Claims 확인
  const idTokenResult = await userCredential.user.getIdTokenResult();
  if (idTokenResult.claims.role !== 'seller') {
    throw new Error('셀러 계정이 아닙니다.');
  }
  
  // D1 동기화
  await api.post('/api/auth/seller/sync', { idToken });
  
  navigate('/seller');
};
```

### 4.4 관리자 로그인 페이지 (AdminLoginPage.tsx)
```typescript
const handleAdminLogin = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await userCredential.user.getIdToken();
  
  // Custom Claims 확인
  const idTokenResult = await userCredential.user.getIdTokenResult();
  if (idTokenResult.claims.role !== 'admin') {
    throw new Error('관리자 계정이 아닙니다.');
  }
  
  await api.post('/api/auth/admin/sync', { idToken });
  
  navigate('/admin');
};
```

---

## 🧹 **Phase 5: 레거시 코드 제거** (1시간)

### 5.1 제거할 파일/함수
- `SESSION_KV` 사용하는 모든 코드
- `getSessionInfo()` 함수
- `/api/auth/login` (D1 기반 로그인 엔드포인트)
- `/api/auth/user/login`, `/api/auth/user/register`

### 5.2 유지할 코드
- `/api/auth/kakao/callback` (Custom Token 생성으로 변환)
- `/api/auth/kakao/sync` (D1 동기화)

---

## 🧪 **Phase 6: 테스팅 & 배포** (1시간)

### 6.1 테스트 시나리오
1. ✅ 일반 사용자: 이메일 회원가입 → 로그인 → 로그아웃
2. ✅ 카카오 로그인: 카카오 OAuth → Custom Token → Firebase Auth
3. ✅ 셀러: 이메일 로그인 → Custom Claims 확인 → /seller 접근
4. ✅ 관리자: 이메일 로그인 → Custom Claims 확인 → /admin 접근
5. ✅ 비밀번호 재설정: 이메일 발송 → 비밀번호 변경
6. ✅ 무한 루프 방지: 로그인 후 리다이렉트 1회만 발생

### 6.2 배포 체크리스트
- [ ] Firebase 환경변수 Cloudflare Pages에 추가
- [ ] D1 마이그레이션 실행 (프로덕션)
- [ ] Firebase Security Rules 업데이트
- [ ] 기존 세션 무효화 공지

---

## 📊 **기대 효과**

### Before (D1 + SESSION_KV)
- 보안: ★★★☆☆ (커스텀 해싱, 취약점 多)
- 개발 시간: ~7시간 (회원가입, 로그인, 비밀번호 재설정, 소셜 로그인)
- 비용: KV 읽기/쓰기 비용 ($0.04/월)
- 유지보수: 어려움 (보안 패치 직접 관리)

### After (Firebase Auth)
- 보안: ★★★★★ (bcrypt, 자동 보안 패치)
- 개발 시간: ~0.7시간 (SDK 사용)
- 비용: $0/월 (Free tier)
- 유지보수: 쉬움 (Firebase가 자동 관리)

---

## ⚠️ **리스크 관리**

### 1. 무한 로그인 루프
**예방**: `isAuthReady` 플래그로 초기화 완료 후에만 리다이렉트

### 2. 카카오 로그인 실패
**예방**: Custom Token 생성 로직 백엔드에서 철저히 테스트

### 3. 기존 사용자 마이그레이션
**예방**: firebase_uid가 null인 경우 첫 로그인 시 Firebase 계정 생성

---

## 🚀 **다음 단계**

1. ✅ Phase 1: 백엔드 설정 (완료)
2. ⏳ Phase 2: AuthContext 리팩토링 (진행 중)
3. ⏳ Phase 3: 셀러/관리자 인증 업그레이드 (대기)
4. ⏳ Phase 4: UI 업데이트 (대기)
5. ⏳ Phase 5: 레거시 코드 제거 (대기)
6. ⏳ Phase 6: 테스팅 & 배포 (대기)

---

**추정 완료 시간**: 2026-02-27 21:00 (약 5-6시간)
