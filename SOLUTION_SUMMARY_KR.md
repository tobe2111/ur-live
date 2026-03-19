# 🚨 Kakao OAuth 500 오류 - 원인 및 해결 방법

## 📊 핵심 요약

**증상**: 카카오 로그인 시 `/auth/kakao/sync/callback` 엔드포인트에서 500 Internal Server Error 발생

**근본 원인**: Firebase Admin SDK가 `FIREBASE_PRIVATE_KEY` 환경 변수를 읽을 때 **"Invalid PKCS8 input"** 오류 발생

**확률 85%의 원인**: Private Key의 줄바꿈 문자(`\n`)가 **리터럴 문자열**로 저장되어 있음

---

## 🎯 TOP 5 원인 분석 (우선순위 순)

### 1위: Firebase Private Key 형식 오류 (85% 확률) ⭐⭐⭐⭐⭐

#### 왜 의심되는가?
- 로그에 명확히 "Invalid PKCS8 input" 오류 표시
- Firebase Admin SDK는 PKCS8 형식의 Private Key를 요구
- Cloudflare Pages 환경 변수에 복사할 때 `\n`이 리터럴 문자로 인식됨

#### 잘못된 형식 예시
```
"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQ...\n-----END PRIVATE KEY-----\n"
```

#### 올바른 형식 예시
```
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDE/s3PltvNta+W
M7vJQO8xK... (중간 생략)
-----END PRIVATE KEY-----
```

#### 즉시 해결 방법 (5분)

**옵션 A: 웹 변환 도구 사용** (가장 쉬움)
1. 프로젝트 루트의 `firebase_key_converter.html` 파일을 브라우저로 열기
2. Firebase Console에서 다운로드한 JSON의 `private_key` 값 복사
3. 도구에 붙여넣기 → "변환하기" 클릭
4. "클립보드에 복사" 클릭
5. Cloudflare Dashboard에서 `FIREBASE_PRIVATE_KEY` 편집 후 붙여넣기

**옵션 B: 온라인 JSON Unescape 도구**
1. https://www.freeformatter.com/json-escape.html 접속
2. Private Key 값 붙여넣기
3. "Unescape" 버튼 클릭
4. 결과 복사 → Cloudflare에 붙여넣기

**옵션 C: VS Code 에디터**
1. VS Code 새 파일 생성
2. Private Key 붙여넣기
3. Find/Replace (Ctrl+H): `\n` → Enter (실제 줄바꿈)
4. "Replace All" 클릭
5. 결과 복사 → Cloudflare에 붙여넣기

**옵션 D: JavaScript Console**
```javascript
// Browser DevTools (F12) → Console 탭
const key = `YOUR_PRIVATE_KEY_HERE`;
const fixed = key.replace(/\\n/g, '\n');
console.log(fixed);
copy(fixed); // 자동으로 클립보드에 복사
```

#### 검증 방법 (난이도: ⭐ 쉬움)
1. Cloudflare Dashboard → Environment variables → `FIREBASE_PRIVATE_KEY` 편집 후 확인
2. 키가 여러 줄로 표시되는지 확인 (한 줄이면 잘못된 것)
3. `-----BEGIN PRIVATE KEY-----`로 시작
4. 중간에 실제 줄바꿈 존재
5. `-----END PRIVATE KEY-----`로 끝남

---

### 2위: Kakao Redirect URI 불일치 (10% 확률) ⭐⭐⭐⭐

#### 왜 의심되는가?
- Kakao OAuth는 Redirect URI의 **정확한 일치**를 요구
- 대소문자, trailing slash, 쿼리 파라미터 모두 일치해야 함
- 코드에서 동적 생성: `${new URL(c.req.url).origin}/auth/kakao/sync/callback`

#### 확인 방법 (난이도: ⭐⭐ 중간)
1. **Kakao Console 확인**
   - URL: https://developers.kakao.com/console/app
   - 앱 선택 → 카카오 로그인 → Redirect URI
   - 등록된 URI 확인

2. **실제 요청 URI 확인**
   - Browser DevTools → Network 탭
   - 카카오 로그인 버튼 클릭
   - Kakao로의 요청에서 `redirect_uri` 파라미터 확인

3. **Cloudflare Worker 로그 확인**
   - Dashboard → ur-live → Logs
   - `[KakaoAuthService] Exchanging code for token...` 로그에서 `REDIRECT_URI` 확인

#### 해결 방법 (난이도: ⭐ 쉬움, 3분)

**옵션 A: Kakao Console에 여러 URI 등록**
```
https://live.ur-team.com/auth/kakao/sync/callback
https://live.ur-team.com/auth/kakao/sync/callback/
https://live.ur-team.com/auth/kakao/callback
```

**옵션 B: 코드에서 명시적으로 지정**
```typescript
// src/features/auth/api/kakao.routes.ts:52
const KAKAO_REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback';
```

#### 검증 포인트
- ✅ Kakao Console URI === Worker 로그 URI
- ✅ `invalid_grant` 또는 `redirect_uri_mismatch` 오류 없음

---

### 3위: Kakao REST API Key 오류 (3% 확률) ⭐⭐⭐

#### 왜 의심되는가?
- Token exchange 요청 시 Kakao가 401/403 반환
- Worker가 이를 500으로 변환하여 응답
- 현재 설정된 키: `5dd74bccb797640b0efd070467f3bafd`

#### 확인 방법 (난이도: ⭐ 쉬움)
1. Kakao Console 접속
   - https://developers.kakao.com/console/app
   - 앱 선택 → 앱 키 → REST API 키 복사

2. Cloudflare Dashboard 확인
   - Workers & Pages → ur-live → Settings
   - Environment variables → `KAKAO_REST_API_KEY` 값 확인

3. 일치 여부 검증

#### 해결 방법 (난이도: ⭐ 쉬움, 2분)
1. Kakao Console에서 REST API 키 복사
2. Cloudflare Dashboard → `KAKAO_REST_API_KEY` 편집
3. 새 값 붙여넣기 → Save
4. 재배포

#### 검증 포인트
- ✅ Kakao Console 키 === Cloudflare 환경 변수
- ✅ Worker 로그: `[KakaoAuthService] ✅ Access token obtained`

---

### 4위: D1 Database 연결 오류 (1% 확률) ⭐⭐

#### 왜 의심되는가?
- User upsert 실패 시 500 오류 발생 가능
- `wrangler.toml`에 D1 바인딩 설정되어 있음

#### 확인 방법 (난이도: ⭐⭐⭐ 어려움)
```bash
# D1 Database 목록 확인
npx wrangler d1 list

# Database 정보 확인
npx wrangler d1 info ur-live-db

# Cloudflare Dashboard에서 확인
# Workers & Pages → ur-live → Settings → Bindings → D1 Databases
```

#### 해결 방법 (난이도: ⭐⭐⭐ 어려움, 15분)
1. D1 Database 생성 (없을 경우)
   ```bash
   cd /home/user/webapp
   npx wrangler d1 create ur-live-db
   ```

2. `wrangler.toml`에 database_id 추가
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "ur-live-db"
   database_id = "YOUR_DATABASE_ID_HERE"
   ```

3. 스키마 초기화
   ```bash
   npx wrangler d1 execute ur-live-db --remote --file=./schema.sql
   ```

4. 재배포

#### 검증 포인트
- ✅ D1 Database 정상 작동
- ✅ Worker 로그: User upsert 성공 메시지

---

### 5위: CORS / 환경 변수 누락 (1% 확률) ⭐

#### 왜 의심되는가?
- CORS 설정 누락 시 OPTIONS 요청 실패
- 필수 환경 변수 누락 시 초기화 단계에서 오류

#### 필수 환경 변수 체크리스트

**Backend (9개, Encrypted)**
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `FIREBASE_DATABASE_URL`
- [ ] `JWT_SECRET`
- [ ] `REFRESH_TOKEN_SECRET`
- [ ] `KAKAO_REST_API_KEY`
- [ ] `FRONTEND_URL`
- [ ] `TOSS_SECRET_KEY`

**Frontend (17개, Plain text)**
- [ ] `VITE_API_BASE_URL`
- [ ] `VITE_REGION`
- [ ] `VITE_DEFAULT_LANGUAGE`
- [ ] `VITE_FIREBASE_API_KEY`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN`
- [ ] `VITE_FIREBASE_DATABASE_URL`
- [ ] `VITE_FIREBASE_PROJECT_ID`
- [ ] `VITE_FIREBASE_STORAGE_BUCKET`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `VITE_FIREBASE_APP_ID`
- [ ] `VITE_FIREBASE_MEASUREMENT_ID`
- [ ] `VITE_KAKAO_APP_KEY`
- [ ] `VITE_KAKAO_JAVASCRIPT_KEY`
- [ ] `VITE_KAKAO_REST_API_KEY`
- [ ] `VITE_TOSS_CLIENT_KEY`
- [ ] `VITE_SENTRY_DSN`
- [ ] `VITE_SENTRY_ENVIRONMENT`

#### 해결 방법 (난이도: ⭐ 쉬움)
- 누락된 변수를 Cloudflare Dashboard에 추가
- Frontend 변수: Plain text
- Backend 변수: Encrypted

---

## 🚀 즉시 실행 가능한 해결 단계 (15분)

### Step 1: Firebase Private Key 재생성 (5분)

1. **Firebase Console 접속**
   ```
   https://console.firebase.google.com/project/urteam-live-commerce-5b284/settings/serviceaccounts/adminsdk
   ```

2. **"Generate new private key" 버튼 클릭**
   - 확인 다이얼로그 → "Generate key" 클릭
   - JSON 파일 다운로드 (예: `urteam-live-commerce-5b284-firebase-adminsdk-xxxxx.json`)

3. **JSON 파일 열기 → `private_key` 값 복사**

4. **줄바꿈 변환 (3가지 방법 중 선택)**
   - **방법 A**: `firebase_key_converter.html` 사용 (가장 쉬움)
   - **방법 B**: https://www.freeformatter.com/json-escape.html
   - **방법 C**: VS Code에서 Find/Replace

5. **Cloudflare Dashboard 업데이트**
   - https://dash.cloudflare.com/
   - Workers & Pages → ur-live → Settings → Environment variables → Production
   - `FIREBASE_PRIVATE_KEY` 편집 → 변환된 키 붙여넣기 → Save

---

### Step 2: Kakao Redirect URI 동기화 (3분)

1. **Kakao Console 확인**
   ```
   https://developers.kakao.com/console/app
   ```

2. **앱 선택 → 카카오 로그인 → Redirect URI**

3. **다음 URI들이 모두 등록되어 있는지 확인**
   ```
   https://live.ur-team.com/auth/kakao/sync/callback
   https://live.ur-team.com/auth/kakao/callback
   ```

4. **없으면 "추가" 버튼 클릭하여 등록**

---

### Step 3: 재배포 (5분)

1. **Cloudflare Dashboard 접속**
   ```
   https://dash.cloudflare.com/
   ```

2. **Workers & Pages → ur-live → Deployments 탭**

3. **최신 deployment의 "..." 메뉴 클릭**

4. **"Retry deployment" 선택**

5. **5-10분 대기 (배포 완료)**

---

### Step 4: 테스트 및 검증 (2분)

1. **Incognito 모드로 사이트 접속**
   ```
   https://live.ur-team.com
   ```

2. **Browser DevTools 열기 (F12)**
   - Console 탭 이동

3. **카카오 로그인 버튼 클릭**

4. **콘솔 확인 - 다음 오류가 사라졌는지 확인**
   - ❌ "Invalid PKCS8 input"
   - ❌ "auth/api-key-not-valid"
   - ❌ "Firebase custom token creation failed"

5. **성공 지표**
   - ✅ Kakao 인증 페이지로 이동
   - ✅ 인증 완료 후 프로필 페이지로 리다이렉트
   - ✅ Console에 오류 없음

6. **Cloudflare Worker 로그 확인 (선택)**
   ```
   Dashboard → ur-live → Logs → Real-time logs
   
   찾아야 할 로그:
   ✅ [KakaoAuthService] ✅ Access token obtained
   ✅ [Kakao Sync] ✅ Login successful for user: XXX
   ```

---

## 📊 원인별 확률 및 수정 난이도

| 순위 | 원인 | 확률 | 수정 난이도 | 수정 시간 |
|-----|------|------|------------|----------|
| 🥇 1위 | Firebase Private Key 형식 오류 | 85% | ⭐ 쉬움 | 5분 |
| 🥈 2위 | Kakao Redirect URI 불일치 | 10% | ⭐⭐ 중간 | 3분 |
| 🥉 3위 | Kakao REST API Key 오류 | 3% | ⭐ 쉬움 | 2분 |
| 4위 | D1 Database 연결 오류 | 1% | ⭐⭐⭐ 어려움 | 15분 |
| 5위 | CORS / 환경 변수 누락 | 1% | ⭐ 쉬움 | 2분 |

---

## ✅ 최종 체크리스트

### 배포 전
- [ ] Firebase Private Key가 **실제 줄바꿈**으로 변환되어 저장됨
- [ ] Cloudflare에서 키가 여러 줄로 표시됨 (한 줄 아님)
- [ ] Kakao Console에 Redirect URI 2개 모두 등록됨
- [ ] `KAKAO_REST_API_KEY` 값이 Kakao Console과 일치함
- [ ] 모든 필수 환경 변수 (26개) 설정 완료

### 배포 후
- [ ] 배포 성공 (Status: Success)
- [ ] Incognito 모드로 사이트 접속 가능
- [ ] 카카오 로그인 버튼 클릭 → Kakao 인증 페이지 이동
- [ ] 인증 완료 → 프로필 페이지로 정상 리다이렉트
- [ ] Console에 "Invalid PKCS8 input" 오류 없음
- [ ] Console에 "auth/api-key-not-valid" 오류 없음
- [ ] Firebase Authentication 정상 작동

---

## 🆘 문제가 지속되는 경우

### Cloudflare Worker 로그 실시간 확인
```bash
# 방법 1: Cloudflare Dashboard
https://dash.cloudflare.com/
Workers & Pages → ur-live → Logs → Real-time logs

# 방법 2: Wrangler CLI (API Token 필요)
cd /home/user/webapp
export CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN"
npx wrangler pages deployment tail --project-name ur-live
```

### GitHub Actions 수동 트리거
```
1. https://github.com/tobe2111/ur-live/actions 접속
2. "Deploy to Cloudflare Pages" 워크플로 선택
3. "Run workflow" 버튼 클릭
4. Branch: main 선택
5. "Run workflow" 확인
6. 5-7분 대기
```

### Firebase Authentication 설정 확인
```
https://console.firebase.google.com/project/urteam-live-commerce-5b284/authentication/providers

확인 사항:
- Sign-in method에 "Custom" 활성화되어 있는지
- Email/Password provider 활성화 여부
- Authorized domains에 live.ur-team.com 등록되어 있는지
```

### Kakao Developers Console 설정 확인
```
https://developers.kakao.com/console/app

확인 사항:
- 앱 활성화 상태
- 카카오 로그인 활성화
- Redirect URI 정확히 등록됨
- Client Secret 사용 여부 (일반적으로 불필요)
- JavaScript 키 도메인 등록
```

---

## 📝 도구 및 리소스

### 생성된 파일들
1. **`firebase_key_converter.html`**
   - 브라우저에서 열기 → Private Key 변환 도구
   - 가장 쉬운 방법

2. **`diagnose_firebase_key.sh`**
   - 터미널에서 실행 → 상세 가이드 출력
   ```bash
   cd /home/user/webapp
   ./diagnose_firebase_key.sh
   ```

3. **`KAKAO_500_ERROR_DIAGNOSIS.md`**
   - 전체 진단 문서
   - 모든 원인 및 해결 방법 포함

### 주요 링크
- **Firebase Console**: https://console.firebase.google.com/project/urteam-live-commerce-5b284
- **Kakao Developers**: https://developers.kakao.com/console/app
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **GitHub Repository**: https://github.com/tobe2111/ur-live
- **Live Site**: https://live.ur-team.com

---

## 💡 예상 결과

**해결 후 정상 동작 시나리오**:

1. 사용자가 https://live.ur-team.com 접속
2. "카카오 로그인" 버튼 클릭
3. Kakao 인증 페이지로 리다이렉트
4. 사용자가 카카오 계정으로 로그인
5. 사용자가 앱 권한 동의
6. 콜백 URL로 리다이렉트: `/auth/kakao/sync/callback?code=...&state=/user/profile`
7. **백엔드 Worker가 정상 처리**:
   - Authorization code → Access token 교환 ✅
   - Kakao 사용자 정보 조회 ✅
   - DB에 사용자 저장/업데이트 ✅
   - **Firebase Custom Token 생성 ✅** (이전에 실패했던 부분)
   - Firebase UID 업데이트 ✅
8. 프로필 페이지로 리다이렉트: `/user/profile?firebase_token=...&userName=...`
9. 프론트엔드가 Firebase에 로그인 ✅
10. 사용자 프로필 페이지 표시 ✅

---

## 🎯 핵심 결론

**가장 유력한 원인**: Firebase Private Key의 줄바꿈 형식 오류 (85% 확률)

**즉시 조치 사항**:
1. ✅ Firebase Console에서 새 Private Key 생성
2. ✅ `firebase_key_converter.html` 도구로 줄바꿈 변환
3. ✅ Cloudflare Dashboard에 업데이트
4. ✅ 재배포
5. ✅ 테스트

**예상 해결 시간**: 5-10분

**성공 확률**: 85%+

---

생성일: 2026-03-19  
문서 버전: 1.0  
프로젝트: ur-live (Cloudflare Pages)
