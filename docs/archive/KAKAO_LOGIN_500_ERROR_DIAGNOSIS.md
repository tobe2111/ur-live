# 🚨 카카오 로그인 500 에러 진단 및 해결 가이드

**작성일**: 2026-02-10  
**증상**: 카카오 로그인 시 500 Internal Server Error 발생

---

## 🔍 1단계: 에러 원인 분석

### 📌 발견된 잠재적 문제점

#### ⚠️ **문제 1: Redirect URI 불일치 (가능성 높음)**

**현재 코드 (src/index.tsx:685)**
```typescript
const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/sync/callback`;
```

**잠재적 문제:**
- 동적으로 생성되는 redirect_uri가 카카오 개발자 콘솔에 등록된 URI와 **정확히 일치하지 않을 수 있음**
- 특히 다음 경우 문제 발생:
  - ❌ `http` vs `https` 차이
  - ❌ 포트 번호 차이 (`https://example.com` vs `https://example.com:443`)
  - ❌ 슬래시 차이 (`/auth/kakao/callback` vs `/auth/kakao/callback/`)
  - ❌ 서브도메인 차이 (`www.example.com` vs `example.com`)

**카카오 에러 코드:**
```json
{
  "error": "redirect_uri_mismatch",
  "error_description": "redirect_uri is not matched"
}
```

---

#### ⚠️ **문제 2: REST API 키 불일치**

**현재 코드 (src/index.tsx:684)**
```typescript
const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd';
```

**잠재적 문제:**
- 하드코딩된 기본값 `5dd74bccb797640b0efd070467f3bafd`가 실제로는 **다른 앱의 키**일 수 있음
- Cloudflare Pages 환경 변수 `KAKAO_REST_API_KEY`가 설정되지 않았을 경우 기본값 사용
- 테스트용 키가 프로덕션에 그대로 노출됨

**카카오 에러 코드:**
```json
{
  "error": "invalid_client",
  "error_description": "client authentication failed"
}
```

---

#### ⚠️ **문제 3: 카카오싱크 필수 파라미터 누락 (가능성 낮음)**

**현재 구현:**
```typescript
// service_terms API 호출은 있지만 선택적 처리
const termsResponse = await fetch('https://kapi.kakao.com/v2/user/service_terms', {
  headers: {
    'Authorization': `Bearer ${tokenData.access_token}`,
  },
});
```

**확인 사항:**
- ✅ `service_terms` API 호출 구현됨
- ✅ 약관 동의 상태 저장 (`service_terms_json`)
- ✅ 실패 시 경고만 출력 (non-critical)

**결론**: 카카오싱크 필수 파라미터는 정상적으로 처리되고 있음

---

## 🛠️ 2단계: 에러 확인 방법

### A. 실시간 로그 확인

Cloudflare Pages는 실시간 로그를 제공하지 않으므로, **Sentry나 커스텀 로깅**이 필요합니다.

**임시 해결책: 에러를 URL 파라미터로 전달**

현재 코드에서 이미 구현됨:
```typescript
// 토큰 요청 실패 시
return c.redirect(`${state}?error=token_request_failed&detail=${encodeURIComponent(errorText)}`);
```

**확인 방법:**
1. 카카오 로그인 시도
2. 리다이렉트된 URL 확인: `https://live.ur-team.com/?error=token_request_failed&detail=...`
3. `detail` 파라미터에서 정확한 에러 메시지 확인

---

### B. 브라우저 개발자 도구 확인

1. **Chrome 개발자 도구** (F12) 열기
2. **Network** 탭으로 이동
3. 카카오 로그인 클릭
4. `https://kauth.kakao.com/oauth/token` 요청 찾기
5. **Response** 탭에서 에러 메시지 확인

**예상 에러 응답:**
```json
{
  "error": "redirect_uri_mismatch",
  "error_description": "redirect_uri is not matched",
  "error_code": "KOE320"
}
```

또는

```json
{
  "error": "invalid_client",
  "error_description": "client authentication failed",
  "error_code": "KOE006"
}
```

---

### C. 카카오 개발자 콘솔 확인

1. [Kakao Developers](https://developers.kakao.com) 접속
2. **내 애플리케이션** 선택
3. **카카오 로그인** > **Redirect URI** 확인

**등록해야 하는 URI:**
```
✅ https://live.ur-team.com/auth/kakao/sync/callback
✅ http://localhost:3000/auth/kakao/sync/callback (개발용)
```

**중요: 정확히 일치해야 합니다!**
- ❌ `https://live.ur-team.com/auth/kakao/callback` (다름!)
- ✅ `https://live.ur-team.com/auth/kakao/sync/callback` (정확)

---

## 🔧 3단계: 해결 방법

### 🎯 해결책 1: Redirect URI 확인 및 수정 (우선순위 1)

#### Step 1: 카카오 개발자 콘솔에서 Redirect URI 확인

1. [Kakao Developers](https://developers.kakao.com) 접속
2. **내 애플리케이션** > **카카오 로그인** > **Redirect URI**
3. 다음 URI가 등록되어 있는지 확인:

```
https://live.ur-team.com/auth/kakao/sync/callback
```

**없다면 추가:**
1. **Redirect URI 등록** 클릭
2. `https://live.ur-team.com/auth/kakao/sync/callback` 입력
3. **저장** 클릭

#### Step 2: 코드 수정 (선택적)

만약 Redirect URI를 변경하고 싶다면:

```typescript
// 현재 (동적)
const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/sync/callback`;

// 변경 (고정) - 더 안전함
const KAKAO_REDIRECT_URI = c.env.KAKAO_REDIRECT_URI || 
  (new URL(c.req.url).origin === 'https://live.ur-team.com' 
    ? 'https://live.ur-team.com/auth/kakao/sync/callback'
    : `${new URL(c.req.url).origin}/auth/kakao/sync/callback`);
```

---

### 🎯 해결책 2: REST API 키 확인 (우선순위 2)

#### Step 1: 올바른 REST API 키 확인

1. [Kakao Developers](https://developers.kakao.com) 접속
2. **내 애플리케이션** > **앱 키** 메뉴
3. **REST API 키** 복사

**예시:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

#### Step 2: Cloudflare Pages 환경 변수 설정

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 접속
2. **Workers & Pages** > `toss-live-commerce` 선택
3. **Settings** > **Environment variables**
4. 환경 변수 추가:

```
변수명: KAKAO_REST_API_KEY
값: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6 (실제 키 입력)
환경: Production
```

5. **Save** 클릭
6. 자동으로 재배포됨

#### Step 3: 재배포 확인

```bash
# 로컬에서 재배포 (선택적)
cd /home/user/webapp
npm run build
npx wrangler pages deploy dist --project-name toss-live-commerce
```

---

### 🎯 해결책 3: HTTPS 확인 (우선순위 3)

카카오 로그인은 **보안상 HTTPS 환경에서만 정상 작동**합니다.

#### 확인 방법:

1. 브라우저에서 `https://live.ur-team.com` 접속
2. 주소창 왼쪽 자물쇠 아이콘 확인
3. **"연결이 안전함"** 또는 **"보안"** 표시 확인

#### 문제 발생 시:

- ❌ **"안전하지 않음"** 표시 → SSL 인증서 문제
- ❌ `http://live.ur-team.com`으로 접속됨 → HTTPS 리다이렉트 설정 필요

**해결:**
```bash
# Cloudflare Pages는 자동으로 HTTPS를 제공하므로 문제 없음
# 만약 커스텀 도메인 사용 시 Cloudflare DNS 설정 확인
```

---

## 📋 4단계: 체크리스트

### ✅ 카카오 개발자 콘솔 설정

- [ ] **앱 키 확인**: REST API 키가 올바른가?
- [ ] **Redirect URI 등록**: `https://live.ur-team.com/auth/kakao/sync/callback` 등록됨?
- [ ] **플랫폼 등록**: `https://live.ur-team.com` 등록됨?
- [ ] **카카오 로그인 활성화**: ON으로 설정됨?
- [ ] **동의항목 설정**: 닉네임(필수), 이메일(선택) 설정됨?

### ✅ Cloudflare Pages 환경 변수

- [ ] **KAKAO_REST_API_KEY**: 올바른 값 설정됨?
- [ ] **Production 환경**: 환경 변수가 Production에 설정됨?
- [ ] **재배포 완료**: 환경 변수 추가 후 자동 재배포 완료?

### ✅ HTTPS 확인

- [ ] **SSL 인증서**: `https://live.ur-team.com` 접속 시 자물쇠 표시?
- [ ] **HTTPS 리다이렉트**: `http://` 접속 시 자동으로 `https://`로 리다이렉트?

---

## 🚀 5단계: 테스트

### A. 로컬 테스트 (선택적)

```bash
# 1. 로컬 환경 변수 설정
echo "KAKAO_REST_API_KEY=your_actual_key" > .dev.vars

# 2. 빌드 및 실행
npm run build
pm2 restart webapp

# 3. 브라우저에서 테스트
# http://localhost:3000/login
```

### B. 프로덕션 테스트

1. 브라우저에서 `https://live.ur-team.com/login` 접속
2. **카카오 로그인** 버튼 클릭
3. 카카오 로그인 화면으로 이동
4. 로그인 후 정상적으로 리다이렉트되는지 확인

**성공 시:**
```
https://live.ur-team.com/?success=true
```

**실패 시:**
```
https://live.ur-team.com/?error=token_request_failed&detail=redirect_uri_mismatch
```

---

## 🔍 6단계: 에러 메시지별 해결 방법

### 에러 1: `redirect_uri_mismatch`

**원인**: Redirect URI가 카카오 개발자 콘솔에 등록된 URI와 일치하지 않음

**해결:**
1. 카카오 개발자 콘솔 > **Redirect URI** 확인
2. `https://live.ur-team.com/auth/kakao/sync/callback` 등록
3. 정확히 일치하는지 확인 (슬래시, 프로토콜 등)

---

### 에러 2: `invalid_client`

**원인**: REST API 키가 잘못되었거나 만료됨

**해결:**
1. 카카오 개발자 콘솔 > **앱 키** 확인
2. REST API 키 복사
3. Cloudflare Pages 환경 변수 `KAKAO_REST_API_KEY`에 설정
4. 재배포

---

### 에러 3: `invalid_grant`

**원인**: Authorization code가 만료되었거나 이미 사용됨

**해결:**
- Authorization code는 1회용이며 10분 후 만료됨
- 다시 로그인 시도

---

### 에러 4: `unauthorized_client`

**원인**: 카카오 로그인이 비활성화되었거나 승인 대기 중

**해결:**
1. 카카오 개발자 콘솔 > **카카오 로그인**
2. **활성화 설정** ON 확인
3. **비즈 앱 전환** 필요 시 신청

---

## 📞 7단계: 추가 지원

### A. 카카오 데브톡 확인

카카오 서버 장애 여부 확인:
- [카카오 데브톡 공지사항](https://devtalk.kakao.com/t/topic/120717)
- 공지가 없다면 우리 쪽 설정 문제

### B. 카카오 개발자 문의

- [카카오 개발자 고객센터](https://developers.kakao.com/console/qna)
- **1:1 문의** 또는 **Q&A** 게시판 활용

---

## 🎯 최종 체크: 가장 가능성 높은 원인

### 1위: Redirect URI 불일치 (80% 확률)
```
✅ 해결: 카카오 개발자 콘솔에서 정확한 URI 등록
```

### 2위: REST API 키 불일치 (15% 확률)
```
✅ 해결: Cloudflare Pages 환경 변수 설정
```

### 3위: 카카오 서버 문제 (5% 확률)
```
✅ 해결: 카카오 데브톡 확인 후 대기
```

---

## 📝 참고 자료

- [카카오 로그인 REST API 문서](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [카카오싱크 가이드](https://developers.kakao.com/docs/latest/ko/kakaosync/common)
- [OAuth 2.0 에러 코드](https://developers.kakao.com/docs/latest/ko/kakaologin/trouble-shooting)

---

## 🚨 긴급 대응 (임시 우회)

만약 빠른 시간 내에 해결이 어렵다면:

### 임시 해결책: Mock 로그인 활성화

```typescript
// src/pages/LoginPage.tsx에서
// 카카오 로그인 대신 간단한 이메일 로그인 사용
```

**권장하지 않음**: 프로덕션 환경에서는 반드시 카카오 로그인 수정 필요

---

## ✅ 완료 후 확인

- [ ] 카카오 로그인 성공
- [ ] 사용자 정보 정상 저장
- [ ] 리다이렉트 정상 작동
- [ ] 에러 메시지 없음

축하합니다! 🎉 카카오 로그인이 정상 작동합니다.
