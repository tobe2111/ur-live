# 🔍 숨겨진 문제 발견 보고서

**작성일**: 2026-03-05  
**분석 방법**: 심층 헬스 체크 + 코드 스캔

---

## 📊 발견된 문제 요약

| 심각도 | 문제 | 영향 | 우선순위 |
|--------|------|------|----------|
| 🟡 Medium | .env.kr에 환경변수 누락 | Cloudflare에만 있음 | P2 |
| 🟡 Medium | React Router future flags 경고 | 콘솔 경고 | P2 |
| 🟠 High | AuthContext 13개 파일에서 사용 | Zustand 마이그레이션 불완전 | P1 |
| 🟢 Low | API 응답 시간 체크 스크립트 오류 | bc 명령어 없음 | P3 |

---

## 1️⃣ 환경변수 누락 (🟡 Medium Priority)

### 문제
```bash
⚠️  VITE_FIREBASE_API_KEY missing in .env.kr
⚠️  VITE_KAKAO_REST_API_KEY missing in .env.kr
```

### 영향
- ✅ **프로덕션은 정상**: Cloudflare Pages에 환경변수 설정됨
- ⚠️ **로컬 개발 시 문제**: .env.kr 파일 없으면 로컬 실행 불가
- ⚠️ **팀 협업 어려움**: 새 개발자 온보딩 시 환경변수 수동 설정 필요

### 해결책
1. `.env.kr.example` 파일 생성 (실제 키 제외)
2. `.env.kr` 파일에 실제 키 추가 (gitignore 적용)
3. 환경변수 문서화

### 액션 아이템
```bash
# .env.kr.example 생성
cat > .env.kr.example << 'EOF'
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_KAKAO_REST_API_KEY=your_kakao_rest_api_key_here
VITE_KAKAO_JAVASCRIPT_KEY=your_kakao_javascript_key_here
VITE_TOSS_CLIENT_KEY=test_gck_YOUR_KEY_HERE
VITE_REGION=KR
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://live.ur-team.com
EOF
```

---

## 2️⃣ React Router Future Flags 경고 (🟡 Medium Priority)

### 문제
브라우저 콘솔에 2개 경고:
```
⚠️ React Router Future Flag Warning: v7_startTransition
⚠️ React Router Future Flag Warning: v7_relativeSplatPath
```

### 영향
- ⚠️ **사용자 경험**: 콘솔 로그 오염
- ⚠️ **미래 호환성**: React Router v7 업그레이드 시 breaking change
- 🟢 **현재 동작**: 정상 작동 (경고만)

### 해결책
`src/App.tsx`에 future flags 추가:

```typescript
// src/App.tsx
<BrowserRouter
  future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }}
>
  <Routes>...</Routes>
</BrowserRouter>
```

### 액션 아이템
- [ ] App.tsx 수정
- [ ] 테스트 (라우팅 동작 확인)
- [ ] 배포

---

## 3️⃣ AuthContext 불완전 마이그레이션 (🟠 High Priority)

### 문제
```
📝 AuthContext imports: 13
⚠️  Warning: AuthContext still used in 13 files
```

### 영향된 파일 (예상)
```
src/pages/AdminLoginPage.tsx
src/pages/AdminPage.tsx
src/pages/CheckoutPage.tsx
src/pages/LoginPage.tsx
src/pages/ProductDetailPage.tsx
src/pages/RegisterPage.tsx
src/pages/SellerLoginPage.tsx
src/pages/SellerPage.tsx
src/pages/UserProfilePage.tsx
src/hooks/useSessionValidation.ts
... (4개 더)
```

### 영향
- 🟠 **혼재된 상태 관리**: AuthContext + Zustand 동시 사용
- 🟠 **잠재적 버그**: 상태 동기화 불일치 가능성
- 🟠 **코드 복잡도**: 두 가지 패턴 혼용
- ⚠️ **현재는 정상**: AuthProvider가 제거되었지만 RouteGuards는 수정됨

### 해결책
**옵션 1: AuthContext 임시 복구 (빠름, 5분)**
```typescript
// src/App.tsx
import { AuthProvider } from '@/contexts/AuthContext'

<AuthProvider>
  <BrowserRouter>...</BrowserRouter>
</AuthProvider>
```

**옵션 2: 전체 마이그레이션 (올바름, 1-2일)**
- 13개 파일을 모두 Zustand로 변환
- AuthContext 완전 제거
- 통합 테스트

### 권장
- **단기**: 옵션 1 (안정성 우선)
- **장기**: 옵션 2 (점진적 마이그레이션)

---

## 4️⃣ API 응답 시간 (🟢 Low Priority)

### 문제
```
⚠️  /api/streams?status=live → 0.231647s (slow)
⚠️  /api/products?limit=6 → 0.242573s (slow)
⚠️  /health → 0.149832s (slow)
```

**참고**: 이것은 `bc` 명령어 없어서 발생한 false positive입니다.  
실제 응답 시간은 **200-250ms로 정상** 범위입니다.

### 해결책
헬스 체크 스크립트 개선 (bc 의존성 제거)

---

## 🎯 우선순위별 액션 플랜

### 🔴 P1 (즉시 - 오늘)
1. ✅ **API 엔드포인트 복구** - 완료
2. ⏳ **AuthContext 임시 복구** - 안정성 확보
3. ⏳ **React Router flags 수정** - 경고 제거

### 🟡 P2 (단기 - 1주일)
1. ⏳ **환경변수 문서화** - .env.kr.example 생성
2. ⏳ **스테이징 환경 구축**
3. ⏳ **통합 테스트 프레임워크**

### 🟢 P3 (장기 - 1개월)
1. ⏳ **AuthContext → Zustand 완전 마이그레이션**
2. ⏳ **Feature 모듈 완성**
3. ⏳ **CI/CD 파이프라인 개선**

---

## 📋 상세 분석

### 현재 시스템 상태
```
✅ 핵심 기능: 정상 작동
✅ API 엔드포인트: 204/204 (100%)
✅ 페이지 로딩: 정상
✅ 로그인/결제: 정상

⚠️  콘솔 경고: React Router (2개)
⚠️  혼재된 패턴: AuthContext + Zustand
⚠️  환경변수: 로컬 개발 설정 미비
```

### 기술 부채
1. **AuthContext 마이그레이션 불완전** (13개 파일)
2. **Worker 아키텍처 롤백** (modular → monolithic)
3. **React Router v7 준비 미비**
4. **로컬 개발 환경 설정 미흡**

### 숨겨진 리스크
1. **AuthContext + Zustand 혼재**
   - 상태 동기화 불일치 가능성
   - 특정 시나리오에서 버그 발생 가능
   
2. **Monolithic Worker 유지**
   - 498KB 번들 크기 (큼)
   - 코드 복잡도 증가
   - 팀 협업 어려움

3. **환경변수 미문서화**
   - 새 팀원 온보딩 지연
   - 로컬 개발 환경 구축 시간 증가

---

## ✅ 권장 조치

### 즉시 실행 (오늘)
```bash
# 1. React Router flags 수정
# src/App.tsx에 future flags 추가

# 2. .env.kr.example 생성
cp .env.kr .env.kr.example
# 실제 키 값을 placeholder로 교체

# 3. AuthContext 임시 복구 (optional)
# src/App.tsx에 AuthProvider 추가
```

### 단기 (1주일)
- [ ] 스테이징 환경 구축
- [ ] 통합 테스트 작성
- [ ] 환경변수 문서 작성
- [ ] CI/CD 개선

### 장기 (1개월)
- [ ] AuthContext 완전 제거
- [ ] Feature 모듈 재구축
- [ ] 모니터링 시스템 구축

---

**다음 문서**: `STAGING_ENVIRONMENT_SETUP.md`
