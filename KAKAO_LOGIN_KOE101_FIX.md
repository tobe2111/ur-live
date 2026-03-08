# 카카오 로그인 KOE101 오류 해결 가이드

## 🔴 문제 상황
- **오류 메시지**: "앱 관리자 설정 오류 (KOE101)"
- **발생 시점**: 카카오 로그인 버튼 클릭 시
- **원인**: 카카오 개발자 콘솔 설정과 코드의 불일치

---

## 🔍 원인 분석

### 1. 환경 변수 누락
**파일**: `.env.kr`
```bash
# ❌ 현재 상태 - REST API 키 누락
VITE_REGION=KR
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865  # JavaScript 키
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://live.ur-team.com

# ✅ 필요한 항목
VITE_KAKAO_REST_API_KEY=<REST_API_KEY>  # 🔥 이것이 누락됨!
```

### 2. Redirect URI 미등록
**현재 코드에서 사용 중인 Redirect URI**:
```
https://live.ur-team.com/auth/kakao/sync/callback
```

이 URI가 카카오 개발자 콘솔에 등록되지 않았을 가능성이 높습니다.

### 3. 키 타입 혼용 문제
- **index.html (line 256)**: JavaScript 키 `975a2e7f97254b08f15dba4d177a2865` 사용
- **LoginPage.tsx (line 95)**: REST API 키 사용 (환경 변수 없으면 fallback)

---

## ✅ 해결 방법

### Step 1: 카카오 개발자 콘솔 설정 확인

1. **카카오 개발자 콘솔 접속**
   - URL: https://developers.kakao.com/console/app
   - 해당 앱 선택

2. **앱 키 확인**
   - 좌측 메뉴: **[앱 설정] > [앱 키]**
   - 필요한 키:
     - **JavaScript 키**: `975a2e7f97254b08f15dba4d177a2865` (확인됨)
     - **REST API 키**: ?????? (확인 필요)

3. **카카오 로그인 활성화 확인**
   - 좌측 메뉴: **[제품 설정] > [카카오 로그인]**
   - **"활성화 설정" 상태**: ON으로 설정
   - **"OpenID Connect 활성화"**: ON 권장

4. **Redirect URI 등록**
   - 같은 페이지에서 **"Redirect URI" 섹션**으로 이동
   - 다음 URI를 추가:
     ```
     https://live.ur-team.com/auth/kakao/sync/callback
     ```
   - **저장** 버튼 클릭

5. **Web 플랫폼 등록 확인**
   - 좌측 메뉴: **[앱 설정] > [플랫폼]**
   - **Web 플랫폼** 추가:
     - 사이트 도메인: `https://live.ur-team.com`

### Step 2: 환경 변수 업데이트

**파일**: `.env.kr`
```bash
# 한국 버전 환경 변수
VITE_REGION=KR

# 🔥 카카오 키 추가 (개발자 콘솔에서 확인)
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY=<YOUR_REST_API_KEY_HERE>

# 기존 설정
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://live.ur-team.com
```

### Step 3: Cloudflare Pages 환경 변수 설정

Cloudflare Pages 대시보드에서도 환경 변수를 추가해야 합니다:

1. Cloudflare Pages 대시보드 접속
2. **ur-live** 프로젝트 선택
3. **Settings > Environment variables**
4. Production 환경에 추가:
   ```
   VITE_KAKAO_APP_KEY = 975a2e7f97254b08f15dba4d177a2865
   VITE_KAKAO_REST_API_KEY = <YOUR_REST_API_KEY_HERE>
   ```
5. **Save** 버튼 클릭

### Step 4: 재빌드 및 배포

```bash
cd /home/user/webapp

# KR 버전 빌드
npm run build:kr

# Cloudflare Pages 배포
export CLOUDFLARE_API_TOKEN=_3Q3YUJWmK_0D-6r65jdqXaOKwgnSj7oqlq2-t_P
export CLOUDFLARE_ACCOUNT_ID=1a2c006f0fb54894f81283a5db12e5cf
npx wrangler pages deploy dist --project-name=ur-live

# 5초 대기 후 테스트
sleep 5
curl -I https://live.ur-team.com/
```

---

## 🧪 테스트 체크리스트

### 카카오 로그인 플로우 테스트

- [ ] 1. https://live.ur-team.com/login 접속
- [ ] 2. "카카오로 시작하기" 버튼 클릭
- [ ] 3. 카카오 로그인 페이지로 리다이렉트 확인
- [ ] 4. KOE101 오류가 발생하지 않는지 확인
- [ ] 5. 로그인 완료 후 올바른 페이지로 리다이렉트 확인
- [ ] 6. 콘솔 로그에서 다음 메시지 확인:
  ```
  [Kakao SDK] Script loaded successfully
  [Kakao SDK] Initialized: true
  [Kakao Login] ✅ Firebase Custom Token 받기 완료
  ```

### 브라우저 콘솔 확인

**정상 로그**:
```
[Kakao SDK] Starting to load...
[Kakao SDK] Script loaded successfully
[Kakao SDK] Initialized: true
[LoginPage] returnUrl 저장: /
[Kakao Login] 🔥 Firebase Custom Token 요청 시작
[Kakao Login] ✅ Firebase Custom Token 받기 완료
[Kakao Login] ✅ Firebase 로그인 성공
```

**오류 로그 (KOE101)**:
```
❌ 앱 관리자 설정 오류 (KOE101)
서비스 설정에 오류가 있어, 이용할 수 없습니다.
```

---

## 🔧 추가 디버깅

### 카카오 SDK 초기화 상태 확인

브라우저 콘솔에서 실행:
```javascript
// Kakao SDK 로드 확인
console.log('Kakao SDK 로드됨:', typeof window.Kakao !== 'undefined')

// 초기화 상태 확인
console.log('Kakao 초기화됨:', window.Kakao?.isInitialized())

// 사용 중인 앱 키 확인
console.log('앱 키:', window.Kakao?._appKey)
```

**예상 결과**:
```
Kakao SDK 로드됨: true
Kakao 초기화됨: true
앱 키: 975a2e7f97254b08f15dba4d177a2865
```

### Redirect URI 확인

브라우저 콘솔에서 실행:
```javascript
// 카카오 로그인 URL 확인
const KAKAO_REST_API_KEY = '5dd74bccb797640b0efd070467f3bafd'  // fallback 키
const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'
const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=/`

console.log('카카오 로그인 URL:', kakaoAuthUrl)
```

이 URL을 브라우저에서 직접 접속해보고 KOE101 오류가 발생하는지 확인합니다.

---

## 📝 코드 수정 권장사항 (Optional)

### 환경 변수 검증 추가

**파일**: `src/pages/LoginPage.tsx`

```typescript
// ❌ 현재 코드 (line 95)
const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd'

// ✅ 개선된 코드 - 환경 변수 필수화
const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY

if (!KAKAO_REST_API_KEY) {
  console.error('[Kakao Login] ❌ VITE_KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다')
  setError('카카오 로그인 설정 오류. 관리자에게 문의하세요.')
  setLoading(false)
  return
}
```

### Sentry 에러 로깅 추가

```typescript
import * as Sentry from '@sentry/react'

async function handleKakaoLogin() {
  try {
    // ... 기존 로직 ...
  } catch (err: any) {
    console.error('[Kakao Login] ❌ 실패:', err)
    
    // Sentry에 에러 전송
    Sentry.captureException(err, {
      tags: {
        feature: 'kakao-login',
        error_code: err.code || 'UNKNOWN',
      },
      extra: {
        kakaoReady,
        redirectUri: REDIRECT_URI,
      }
    })
    
    setError(t('auth.kakaoLoginError'))
    setLoading(false)
  }
}
```

---

## 🚨 주의사항

1. **보안**: REST API 키는 서버 사이드에서만 사용하는 것이 권장됩니다.
   - 현재 클라이언트에서 사용 중이므로 노출 위험이 있습니다.
   - 가능하면 서버 API를 통해 카카오 OAuth를 처리하세요.

2. **JavaScript 키 vs REST API 키**:
   - **JavaScript 키**: 웹 브라우저에서 Kakao SDK 초기화용
   - **REST API 키**: OAuth 2.0 Authorization Code 플로우용

3. **Redirect URI**:
   - 반드시 카카오 개발자 콘솔에 등록된 URI와 **정확히 일치**해야 함
   - 대소문자, 슬래시(/) 하나 차이도 KOE101 오류 발생

---

## 📚 참고 문서

- [카카오 로그인 REST API 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [카카오 로그인 JavaScript SDK 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/js)
- [카카오 에러 코드](https://developers.kakao.com/docs/latest/ko/kakaologin/trouble-shooting)
- [KOE101 해결 방법 (카카오 데브톡)](https://devtalk.kakao.com/t/koe101/144909)

---

## ✅ 해결 완료 확인

모든 단계를 완료한 후:

1. 시크릿 모드로 브라우저 열기
2. https://live.ur-team.com/login 접속
3. "카카오로 시작하기" 클릭
4. KOE101 없이 정상 로그인 되는지 확인

문제가 계속되면:
- 카카오 개발자 콘솔 설정 재확인
- Cloudflare Pages 환경 변수 재확인
- 브라우저 캐시 삭제 후 재시도

---

**작성일**: 2026-03-05  
**버전**: v1.0  
**상태**: 🔴 조치 필요
