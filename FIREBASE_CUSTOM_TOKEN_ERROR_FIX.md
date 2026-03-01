# 🚨 긴급: Firebase Custom Token 생성 실패 해결 가이드

**날짜**: 2026-03-01  
**에러**: `Failed to create Firebase custom token`  
**상태**: 🔴 **CRITICAL** - Cloudflare 환경변수 누락

---

## 🔍 문제 분석

### 에러 증상
```
URL: /user/profile?error=database_error&detail=Failed to create Firebase custom token
Console: [Kakao Sync] 🔴 Firebase Custom Token 생성 실패
```

### 근본 원인
Cloudflare Pages 환경변수에 **Firebase Admin SDK 인증 정보**가 설정되지 않음:
- ❌ `FIREBASE_PRIVATE_KEY` (누락)
- ❌ `FIREBASE_CLIENT_EMAIL` (누락)

이 정보는 서버에서 **Firebase Custom Token**을 생성할 때 필요합니다.

---

## ✅ 해결 방법

### Step 1: Firebase Service Account JSON 다운로드

1. **Firebase Console** 접속: https://console.firebase.google.com
2. 프로젝트 선택: `urteam-live-commerce-5b284`
3. **⚙️ 프로젝트 설정** → **서비스 계정** 탭
4. **새 비공개 키 생성** 버튼 클릭
5. JSON 파일 다운로드 (예: `urteam-live-commerce-5b284-firebase-adminsdk-xxxxx.json`)

### Step 2: JSON 파일에서 필요한 값 추출

다운로드한 JSON 파일을 열면 다음과 같은 형식:

```json
{
  "type": "service_account",
  "project_id": "urteam-live-commerce-5b284",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

**필요한 값**:
- `private_key` → `FIREBASE_PRIVATE_KEY`
- `client_email` → `FIREBASE_CLIENT_EMAIL`

### Step 3: Cloudflare Pages에 환경변수 설정

#### Option A: Cloudflare Dashboard (추천)

1. https://dash.cloudflare.com 접속
2. **Workers & Pages** 선택
3. **ur-live** 프로젝트 클릭
4. **Settings** 탭 → **Environment variables** 섹션
5. **Add variables** 버튼 클릭

**추가할 변수 2개**:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `FIREBASE_PRIVATE_KEY` | JSON의 `private_key` 값 전체 복사 (개행 포함) | Production |
| `FIREBASE_CLIENT_EMAIL` | JSON의 `client_email` 값 | Production |

**⚠️ 주의사항**:
- `FIREBASE_PRIVATE_KEY`는 `-----BEGIN PRIVATE KEY-----`부터 `-----END PRIVATE KEY-----`까지 **전체**를 복사
- 개행 문자(`\n`)도 포함되어야 함
- 따옴표 없이 값만 입력

#### Option B: Wrangler CLI

```bash
# FIREBASE_CLIENT_EMAIL 설정
npx wrangler pages secret put FIREBASE_CLIENT_EMAIL
# 입력 프롬프트에서: firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com

# FIREBASE_PRIVATE_KEY 설정
npx wrangler pages secret put FIREBASE_PRIVATE_KEY
# 입력 프롬프트에서: -----BEGIN PRIVATE KEY----- 전체 내용 붙여넣기
```

### Step 4: 재배포 트리거

환경변수 추가 후 자동으로 재배포되지만, 수동으로 트리거하려면:

```bash
git commit --allow-empty -m "chore: Trigger redeploy after adding Firebase secrets"
git push origin main
```

또는 Cloudflare Dashboard에서:
1. **Deployments** 탭
2. **Retry deployment** 또는 **Create deployment** 클릭

---

## 🧪 검증 방법

### 1. 환경변수 확인

Cloudflare Dashboard → ur-live → Settings → Environment variables:
- ✅ `FIREBASE_PRIVATE_KEY` 존재 (값은 보이지 않음)
- ✅ `FIREBASE_CLIENT_EMAIL` 존재

### 2. 로그인 테스트

1. https://live.ur-team.com/login 접속
2. **카카오 로그인** 버튼 클릭
3. 카카오 로그인 완료
4. 개발자 도구 Console 확인:

**Before (현재 - 실패)**:
```
[Kakao Sync] 🔴 Firebase Custom Token 생성 실패
URL: /user/profile?error=database_error&detail=Failed to create Firebase custom token
```

**After (수정 후 - 성공)**:
```
[Kakao Sync] ✅ Firebase Custom Token 발급 완료 for user: 123
[AuthContext] 🔥 Firebase Custom Token 로그인 시작
[AuthContext] ✅ Firebase 로그인 성공: kakao_4735311250
[AuthContext] 🔄 로그인 완료 - 리다이렉트: /
```

### 3. Network 탭 확인

`/api/auth/kakao/sync` 요청:
- ✅ Status: 302 (Redirect)
- ✅ Location: `/?firebase_token=eyJ...` (토큰 포함)
- ❌ No `error=database_error` in URL

---

## 🔐 보안 고려사항

### Private Key 보호

- ✅ Cloudflare Pages Secrets에 저장 (암호화됨)
- ✅ Dashboard에서 값이 보이지 않음
- ❌ Git에 커밋하지 말 것 (`.gitignore` 확인)
- ❌ 클라이언트에 노출하지 말 것

### IAM 권한 확인

Firebase Service Account에 필요한 권한:
1. Firebase Console → **IAM 및 관리자** → **IAM**
2. Service Account 찾기: `firebase-adminsdk-xxxxx@...`
3. 권한 확인:
   - ✅ `Service Account Token Creator`
   - ✅ `Firebase Admin SDK Administrator Service Agent`

권한이 없으면 추가:
1. **액세스 권한 부여** 클릭
2. Service Account 이메일 입력
3. 역할: `Service Account Token Creator` 추가
4. **저장**

---

## 🚨 임시 해결책 (긴급)

환경변수 설정을 기다리는 동안 **임시로 이메일 로그인 사용**:

1. https://live.ur-team.com/login 접속
2. **이메일로 로그인** 탭 클릭
3. 이메일/비밀번호 입력
4. 로그인

이메일 로그인은 Firebase Custom Token을 사용하지 않으므로 정상 작동합니다.

---

## 📋 체크리스트

배포 전:
- [ ] Firebase Service Account JSON 다운로드 완료
- [ ] `FIREBASE_PRIVATE_KEY` Cloudflare에 추가
- [ ] `FIREBASE_CLIENT_EMAIL` Cloudflare에 추가
- [ ] 재배포 트리거

배포 후:
- [ ] 카카오 로그인 테스트 (정상 작동 확인)
- [ ] Console 로그 확인 (에러 없음)
- [ ] URL에 `error=` 파라미터 없음 확인
- [ ] 로그인 후 프로필 페이지 정상 표시

---

## 🔗 관련 문서

- Firebase Service Account: https://firebase.google.com/docs/admin/setup
- Cloudflare Pages Secrets: https://developers.cloudflare.com/pages/platform/functions/bindings/#secrets
- Firebase Custom Tokens: https://firebase.google.com/docs/auth/admin/create-custom-tokens

---

## 📞 문제 지속 시

위 단계를 모두 수행했는데도 문제가 지속되면:

1. **Cloudflare Workers 로그 확인**:
   - Dashboard → ur-live → Logs
   - 필터: `[Kakao Sync]` 또는 `[Firebase Custom Token]`

2. **환경변수 형식 확인**:
   ```bash
   # Private Key는 다음 형식이어야 함:
   -----BEGIN PRIVATE KEY-----
   MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
   (여러 줄)
   ...
   -----END PRIVATE KEY-----
   ```

3. **Service Account 재생성**:
   - Firebase Console에서 새 Service Account 생성
   - 새 JSON 다운로드 및 재설정

---

**생성일**: 2026-03-01  
**우선순위**: 🔴 CRITICAL  
**예상 해결 시간**: 5-10분 (환경변수 설정 후 재배포)
