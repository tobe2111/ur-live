# 🚀 Multi-Region Quick Start Guide

멀티 리전 설정의 기본 구조가 완성되었습니다. 아래 단계를 따라 완전한 구현을 완료하세요.

---

## ✅ 완료된 작업

1. **Region 설정** (`src/config/region.ts`)
   - `isKorea()`, `isGlobal()` 헬퍼 함수
   - Region 기반 로그인/결제 프로바이더 분기

2. **i18n 인프라** (`src/i18n.ts`)
   - i18next 설정 완료
   - 한국어/영어 번역 파일 생성
   - 브라우저 언어 자동 감지

3. **언어 전환 UI** (`src/components/LanguageSwitcher.tsx`)
   - 헤더에 추가할 수 있는 드롭다운 컴포넌트

4. **환경 변수**
   - `.env.kr`: 한국 버전 설정
   - `.env.global`: 글로벌 버전 설정

---

## 📦 Step 1: 패키지 설치

```bash
cd /home/user/webapp

# i18n 패키지
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend

# Stripe 결제 (글로벌 전용)
npm install @stripe/stripe-js @stripe/react-stripe-js

# 번들 분석 도구 (선택사항)
npm install --save-dev vite-bundle-visualizer
```

---

## 🔧 Step 2: main.tsx 수정

`src/main.tsx`에 i18n import 추가:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './i18n' // ✅ 이 줄 추가

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

---

## 🎨 Step 3: Header에 언어 전환 추가

기존 헤더 컴포넌트에 `LanguageSwitcher` 추가:

```typescript
import LanguageSwitcher from '@/components/LanguageSwitcher'

// 헤더 컴포넌트 내부
<header className="...">
  {/* 기존 네비게이션 */}
  
  {/* 언어 전환 버튼 (오른쪽 끝) */}
  <LanguageSwitcher />
</header>
```

---

## 🔐 Step 4: LoginPage 업데이트 (선택사항)

**지금 당장 필요하지 않다면 나중에 글로벌 버전 배포 시 추가 가능**

`src/pages/LoginPage.tsx`에 다음 변경 사항 적용:

### 4.1 Import 추가
```typescript
import { useTranslation } from 'react-i18next'
import { isKorea } from '@/config/region'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
```

### 4.2 컴포넌트 내부
```typescript
export default function LoginPage() {
  const { t } = useTranslation() // ✅ 번역 함수 추가
  
  // ... 기존 코드 ...
  
  // Google 로그인 핸들러 (글로벌 전용)
  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    
    try {
      const { auth } = await import('@/lib/firebase')
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      
      // D1 DB에 사용자 정보 저장
      await api.post('/api/auth/google/register', {
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.displayName,
      })
      
      navigate(returnUrl, { replace: true })
    } catch (error: any) {
      console.error('[Google Login] Error:', error)
      setError(t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div>
      {/* 카카오 로그인 (한국 전용) */}
      {isKorea() && (
        <Button onClick={handleKakaoLogin}>
          {t('auth.loginWithKakao')}
        </Button>
      )}
      
      {/* Google 로그인 (글로벌 전용) */}
      {!isKorea() && (
        <Button onClick={handleGoogleLogin}>
          {t('auth.loginWithGoogle')}
        </Button>
      )}
      
      {/* 이메일 로그인 (공통) */}
      <Button onClick={() => setShowEmailLogin(true)}>
        {t('auth.loginWithEmail')}
      </Button>
    </div>
  )
}
```

---

## 💳 Step 5: 결제 컴포넌트 (선택사항)

**글로벌 버전 배포 시 Stripe 통합이 필요한 경우에만 추가**

상세한 구현은 `MULTI_REGION_SETUP.md` 파일 참조:
- `src/components/payment/TossPaymentWidget.tsx` (기존 Toss 로직 분리)
- `src/components/payment/StripeCheckout.tsx` (Stripe Elements 통합)

---

## 🧪 Step 6: 로컬 테스트

### 한국 버전 테스트
```bash
npm run dev:kr
# 또는
vite --mode kr
```

브라우저에서 http://localhost:3000 접속:
- 카카오 로그인 버튼 확인
- 언어 전환 (한국어 ↔ 영어)
- TossPayments 위젯 확인

### 글로벌 버전 테스트 (패키지 설치 후)
```bash
npm run dev:global
# 또는
vite --mode global
```

---

## 🚀 Step 7: 배포

### 한국 버전 배포 (기존 유지)
```bash
npm run deploy:kr
# 또는
npm run build:kr && wrangler pages deploy dist --project-name ur-live
```

### 글로벌 버전 배포 (나중에)
```bash
npm run deploy:global
# 또는
npm run build:global && wrangler pages deploy dist --project-name ur-live-global
```

---

## ⚡ 빠른 시작 (최소 구현)

**지금 당장 i18n만 사용하고 싶다면:**

```bash
# 1. 패키지 설치 (i18n만)
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend

# 2. main.tsx 수정
# import './i18n' 추가

# 3. 컴포넌트에서 사용
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  
  return <h1>{t('common.login')}</h1> // "로그인" or "Login"
}

# 4. 빌드 & 테스트
npm run build
npm run dev
```

---

## 📊 현재 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| Region 설정 | ✅ 완료 | src/config/region.ts |
| i18n 설정 | ✅ 완료 | src/i18n.ts |
| 번역 파일 (ko/en) | ✅ 완료 | public/locales |
| 언어 전환 UI | ✅ 완료 | LanguageSwitcher.tsx |
| 환경 변수 | ✅ 완료 | .env.kr, .env.global |
| 패키지 설치 | ⏳ 대기 | npm install 필요 |
| main.tsx 수정 | ⏳ 대기 | import './i18n' 추가 |
| LoginPage 수정 | 🔜 선택 | 글로벌 배포 시 필요 |
| 결제 분기 | 🔜 선택 | 글로벌 배포 시 필요 |

---

## 🎯 우선순위

### Phase 1: i18n 기본 (지금 바로 가능)
1. ✅ 패키지 설치
2. ✅ main.tsx import 추가
3. ✅ 헤더에 LanguageSwitcher 추가
4. ✅ 테스트

**결과**: 한국 버전에 다국어 지원 추가 (카카오 로그인 + Toss 결제는 그대로)

### Phase 2: 글로벌 버전 (나중에 필요할 때)
1. Firebase Console에서 Google 로그인 활성화
2. LoginPage에 Google 로그인 추가
3. Stripe 계정 생성 & API 키 발급
4. 결제 컴포넌트 작성 (Stripe Elements)
5. CheckoutPage 수정
6. 글로벌 도메인 배포

---

## 💡 팁

### 1. 한국 버전은 그대로 유지
- 기존 카카오 로그인 유지
- 기존 TossPayments 유지
- 단지 UI 텍스트만 i18n으로 다국어 지원

### 2. 번역 파일 확장
`public/locales/ko/translation.json` 또는 `en/translation.json`에 키 추가:
```json
{
  "myFeature": {
    "title": "내 기능",
    "description": "설명"
  }
}
```

사용:
```typescript
const { t } = useTranslation()
return <h1>{t('myFeature.title')}</h1>
```

### 3. 번들 크기 최적화
- 결제 SDK는 Lazy loading으로 필요할 때만 로드
- i18n 번역은 언어별로 자동 분리 (tree shaking)
- 한국 버전에는 Stripe 코드가 포함되지 않음 (vice versa)

---

## 📚 참고 문서

- **완전한 가이드**: `MULTI_REGION_SETUP.md` (결제 통합, 상세 코드 등)
- **i18next 공식 문서**: https://react.i18next.com/
- **Stripe React**: https://stripe.com/docs/stripe-js/react
- **TossPayments**: https://docs.tosspayments.com/

---

## 🆘 도움이 필요하면?

1. `MULTI_REGION_SETUP.md` 전체 가이드 확인
2. Git 커밋 `34fcde4` 참조
3. GitHub: https://github.com/tobe2111/ur-live

**예상 소요 시간**:
- Phase 1 (i18n만): 30분
- Phase 2 (글로벌 전체): 3-4시간
