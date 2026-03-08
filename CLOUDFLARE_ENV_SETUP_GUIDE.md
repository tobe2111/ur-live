# 🚀 Cloudflare Pages 환경변수 설정 가이드 (즉시 실행)

**상태**: 🔴 **CRITICAL** - 카카오 로그인을 위해 필수  
**소요 시간**: 5분  
**난이도**: ⭐⭐ (복사-붙여넣기)

---

## ✅ 준비 완료!

`.dev.vars` 파일에 이미 Firebase 인증 정보가 있습니다:
- ✅ `FIREBASE_PRIVATE_KEY` (RSA Private Key)
- ✅ `FIREBASE_CLIENT_EMAIL` (Service Account Email)

이제 이 정보를 **Cloudflare Pages Production 환경**에 복사하기만 하면 됩니다!

---

## 📋 **단계별 실행 가이드**

### Step 1: Cloudflare Dashboard 접속

1. 브라우저에서 https://dash.cloudflare.com 열기
2. 로그인 (Cloudflare 계정)

### Step 2: ur-live 프로젝트 찾기

1. 왼쪽 메뉴에서 **"Workers & Pages"** 클릭
2. 프로젝트 목록에서 **"ur-live"** 찾아서 클릭

### Step 3: Settings → Environment Variables

1. 상단 탭에서 **"Settings"** 클릭
2. 스크롤 내려서 **"Environment variables"** 섹션 찾기
3. **"Add variables"** 또는 **"Edit variables"** 버튼 클릭

### Step 4: FIREBASE_PRIVATE_KEY 추가

**Variable name**: 
```
FIREBASE_PRIVATE_KEY
```

**Value** (아래 전체를 복사해서 붙여넣기):
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDNApqNEslAbGWU
lYOzI0txgwNfcJq11jBotxHWr2duF1GfPcHieAtIOHUTnVUCIlH2bfK5x7Q9ter+
cwW9sdv6Bjvp5+Y45xd6VsUrtQWr/JW5rf3KaawABR37TCkw4gFWeF7LL2hYTqKX
joYatvDPecBkQg9KXHfA9dRlwz8eX1W976CPNcvjfU9/fcFaWMxRb+H+mpz+XXsH
79gM7Fu+CUfUGLJr9Nnu99S9HHKrXb7zOwl7q1ZTvOSQqu8ZLOpfnV7dmHqPyKHQ
m+3uWm5VL6xZe1E083auNEA1dhLx8hYEu1H4a9Eya80zXAqbKSJSfOi2BQB0tnjI
iTXQDJBrAgMBAAECggEAYV0sM3XJmMwiTjfYDXrkuKtFLc2X3GY2JXVUhoZVc+al
QCCfdUQX75vIlqExH0tXa9b54RukUW6VhXTxNA9FbvAJAmS9ZSbzconFKKXXZMAY
B9BHaRtYscW8YH3iTjH3+q4+Lvd78fyeoaXxsLxTj+W95p+tDV7vDPhzgEUDNBOu
lHaKbll3kByuVAa12yhXIEGw4SQI1Y42865tVLHrpJFreU7zbje090xgdZyAsj5X
qTPt2Cns9Z/hUCJoRkYswuq70GYt4DQycgnC/hO1SI6+qNdrdHZpevrs9jNtySHb
HyjIUxHurDubQJ37eNSqDniViAMTf0Xyoyh/V8o6iQKBgQD49uWl3QRcvP947Rm9
Nc0E0K3appMyvQIX/S0hdjkBjuORxxRnrxXDFPUXQEFXsng8M0t3crVXTFqKPIuy
0K6jXQlkgxptGMb6jC4Pg+tw833+DMsmxQK4Xc5cDMWz19/Ay+zUnWIkAMB7/0PY
MyyekDNU0Y71gDTPwp5abNxiPQKBgQDSzbmOnRKIsS+fvSS1yQSI8pvGCASRx4Ez
Z35D+UQGhlKPqMSodYknbLtbt+tQaVjXUE15RvydwbRD39+jHyjSBLIse7AqJnFm
VofNOh96CTf1csbp1ObysfmR3ibVt3uRgqJTgi+rYhhZx7zd6+u+uvhfjW/JpYLJ
rNL+D68vxwKBgHdjzxUPPDxM1iZjbWhzGHIqsHSeVRCL2ykt3CqjywqYP0F1Oq/O
Ip1+u1n/Ela/2zDjWFlbxOKsVu7bwhJqSJVG1G5DALU4oJMeDiialpl/6vedov5g
k8FeGsvBxD1OVJrcMCJ1ps6lHalY7GwNfmQ7uqH+LJRGewz2w4GRms3xAoGAQWpH
p6LEapiZT7eRGbwsZRbsEfLRAC/pvvrhqtRCMMgj/KKBjEkU66AJL/gN1KEsSXyI
3haSM541g06IhoUX1LxSUg176EiPrhMyBxR/Sg5sSAV7Bnrjw/JIoORQJsfOV6Qz
HTjr9AH3znx19mPMfx5kDrrEMs3inRS9UMurMGcCgYEA7rh14Jf6YTLxMPOZtaM3
VxQAmiwWMeXZR58Ay0zguA7FvCgajJvVGK7ev3T0BlUEhUrMHbB98bJy+OJA5IEK
NZ5USZL9t+oYWMmcTi2O3gqgk7KevlZnREr2BeL+DUL3bro9DfmbhCMXvyBjGEGo
+44vEawC/8f0mt/wlMASMOs=
-----END PRIVATE KEY-----
```

**Environment**: `Production` 선택  
**Encrypted**: ✅ 체크 (자동으로 암호화됨)

**"Save"** 클릭

---

### Step 5: FIREBASE_CLIENT_EMAIL 추가

같은 페이지에서 **"Add variable"** 다시 클릭

**Variable name**: 
```
FIREBASE_CLIENT_EMAIL
```

**Value**:
```
firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com
```

**Environment**: `Production` 선택  
**"Save"** 클릭

---

### Step 6: 재배포 트리거

환경변수 추가 후 자동으로 재배포되지만, 확실하게 하려면:

**Option A - Cloudflare Dashboard**:
1. **"Deployments"** 탭 클릭
2. 최신 deployment 찾기
3. **"Retry deployment"** 버튼 클릭

**Option B - Git Push** (권장):
```bash
# Empty commit으로 재배포 트리거
git commit --allow-empty -m "chore: Trigger redeploy after Firebase env vars"
git push origin main
```

---

## ✅ 검증 방법

### 1. 환경변수 설정 확인

Cloudflare Dashboard → ur-live → Settings → Environment variables:
- ✅ `FIREBASE_PRIVATE_KEY` (Production) - Value는 `•••••` 로 숨겨짐
- ✅ `FIREBASE_CLIENT_EMAIL` (Production) - 이메일 주소 보임

### 2. 재배포 완료 확인

**GitHub Actions** (2-3분 대기):
- https://github.com/tobe2111/ur-live/actions
- 최신 workflow가 ✅ 초록색이면 성공

### 3. 카카오 로그인 테스트

1. https://live.ur-team.com/login 접속
2. **카카오 로그인** 버튼 클릭
3. 카카오 계정 로그인
4. **성공 시**: 홈페이지(/) 또는 이전 페이지로 리다이렉트
5. **실패 시**: URL에 `error=...` 파라미터 확인

### 4. Console 로그 확인 (F12)

**Before (현재)**:
```
[Kakao Sync] 🔴 Firebase Custom Token 생성 실패
error=database_error&detail=Failed to create Firebase custom token
```

**After (수정 후)**:
```
[Kakao Sync] ✅ Firebase Custom Token 발급 완료 for user: 123
[AuthContext] 🔥 Firebase Custom Token 로그인 시작
[AuthContext] ✅ Firebase 로그인 성공: kakao_4735311250
```

---

## 🔐 보안 체크리스트

- ✅ Private Key는 Cloudflare에만 저장 (Git에 커밋 안 됨)
- ✅ Dashboard에서 값이 `•••••`로 숨겨짐
- ✅ HTTPS 통신만 사용
- ✅ Service Account 권한 최소화

---

## 🚨 문제 발생 시

### "Firebase credentials not configured" 에러

**원인**: 환경변수가 제대로 설정되지 않음

**해결**:
1. Cloudflare Dashboard에서 변수명 확인 (대소문자 구분)
2. Value에 공백/줄바꿈이 잘못 들어갔는지 확인
3. 재배포 완료 여부 확인 (Deployments 탭)

### "Invalid private key" 에러

**원인**: Private Key 형식 오류

**해결**:
1. `-----BEGIN PRIVATE KEY-----`와 `-----END PRIVATE KEY-----` 포함 확인
2. 줄바꿈이 제대로 포함되었는지 확인
3. 복사할 때 공백이나 특수문자가 추가되지 않았는지 확인

### 여전히 로그인 실패

**임시 해결책**: 이메일 로그인 사용
1. https://live.ur-team.com/login
2. "이메일로 로그인" 탭
3. 이메일/비밀번호 입력

---

## 📞 완료 후 알려주세요!

환경변수 설정을 완료하시면:
1. "환경변수 추가 완료!" 메시지 주세요
2. 재배포 완료 여부 확인
3. 카카오 로그인 테스트 결과 공유

---

**우선순위**: 🔴 **CRITICAL**  
**예상 소요 시간**: 5분  
**다음 단계**: D1 마이그레이션 (firebase_uid 컬럼 추가)
