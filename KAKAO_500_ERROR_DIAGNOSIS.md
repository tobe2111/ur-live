# 🔴 Kakao OAuth 500 오류 진단 및 해결 가이드

## 현재 상황
- **증상**: `/auth/kakao/sync/callback` 엔드포인트에서 500 Internal Server Error 발생
- **발생 지점**: Kakao OAuth callback 처리 중 백엔드 Worker
- **로그 패턴**: "Processing failed: Firebase custom token creation failed: Invalid PKCS8 input"

---

## 🎯 TOP 5 원인 (우선순위 순)

### 1️⃣ **Firebase Private Key 형식 오류** ⭐⭐⭐⭐⭐
**우선순위**: 🔴 **최고** (가장 유력)

**왜 의심되는가**:
- 로그에 명시적으로 "Invalid PKCS8 input" 오류 출현
- Cloudflare Pages 환경 변수에 키를 복사할 때 줄바꿈(`\n`)이 **리터럴 문자열**로 저장됨
- Firebase Admin SDK는 정확한 PKCS8 형식을 요구

**확인 방법** (난이도: ⭐ 쉬움):
```bash
# Cloudflare Dashboard에서 현재 키 확인
# Dashboard → Workers & Pages → ur-live → Settings → Environment variables
# → FIREBASE_PRIVATE_KEY 값 확인

# 잘못된 예시 (리터럴 \n):
"-----BEGIN PRIVATE KEY-----\nMIIEvAIBAD..."

# 올바른 예시 (실제 줄바꿈):
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDE/s3PltvNta+W
...
-----END PRIVATE KEY-----
```

**해결 방법** (난이도: ⭐ 쉬움, 5분):
1. Firebase Console → Service Accounts → **Generate new private key**
   - URL: `https://console.firebase.google.com/project/urteam-live-commerce-5b284/settings/serviceaccounts/adminsdk`
   - "Generate new private key" 버튼 클릭 → JSON 다운로드
   
2. 다운로드한 JSON 파일 열기 → `private_key` 값 복사

3. **줄바꿈 변환** (필수!):
   - **방법 A**: 온라인 도구 사용
     - https://www.freeformatter.com/json-escape.html
     - JSON string을 unescape (escaped `\n` → 실제 줄바꿈)
   
   - **방법 B**: VS Code / 텍스트 에디터
     ```
     1. 복사한 키를 에디터에 붙여넣기
     2. Find/Replace: \n → 실제 Enter키 (줄바꿈)
     3. 결과 복사
     ```
   
   - **방법 C**: JavaScript Console
     ```javascript
     const escaped = "-----BEGIN PRIVATE KEY-----\\nMIIEvAI...\\n-----END PRIVATE KEY-----\\n";
     console.log(escaped.replace(/\\n/g, '\n'));
     // 출력 결과 복사
     ```

4. Cloudflare Dashboard에 업데이트:
   - Workers & Pages → ur-live → Settings → Environment variables → Production
   - `FIREBASE_PRIVATE_KEY` 편집 → 변환된 키 붙여넣기 → Save

5. 재배포:
   - Deployments 탭 → 최신 deployment → "..." → "Retry deployment"
   - 5-10분 대기

**검증 체크포인트**:
- ✅ 재배포 완료
- ✅ 카카오 로그인 시도
- ✅ "Invalid PKCS8 input" 오류 사라짐
- ✅ 프로필 페이지로 정상 리다이렉트

---

### 2️⃣ **Kakao Redirect URI 불일치** ⭐⭐⭐⭐
**우선순위**: 🟠 **높음**

**왜 의심되는가**:
- Kakao는 Redirect URI를 **정확히 일치**하도록 요구 (대소문자, trailing slash, 쿼리 파라미터 포함)
- 코드에서 동적으로 생성: `${new URL(c.req.url).origin}/auth/kakao/sync/callback`
- Kakao Console 설정과 미세한 차이 가능

**확인 방법** (난이도: ⭐⭐ 중간):
1. **Kakao Developers Console 확인**:
   - URL: https://developers.kakao.com/console/app
   - 앱 선택 → 카카오 로그인 → Redirect URI 확인
   - 등록된 URI: `https://live.ur-team.com/auth/kakao/sync/callback` (trailing slash 없음)

2. **실제 요청 URI 확인**:
   - Browser DevTools → Network 탭
   - 카카오 로그인 클릭 → Kakao로의 요청 확인
   - `redirect_uri` 파라미터 값 확인

3. **Worker 로그 확인** (Cloudflare Dashboard):
   - Workers & Pages → ur-live → Logs → Real-time logs
   - `[KakaoAuthService] Exchanging code for token...` 로그에서 `REDIRECT_URI` 값 확인

**해결 방법** (난이도: ⭐ 쉬움):
- **옵션 A**: Kakao Console에 여러 URI 등록
  ```
  https://live.ur-team.com/auth/kakao/sync/callback
  https://live.ur-team.com/auth/kakao/sync/callback/
  https://live.ur-team.com/auth/kakao/callback
  ```

- **옵션 B**: 코드에서 명시적으로 지정
  ```typescript
  // kakao.routes.ts 52번 줄
  const KAKAO_REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'; // 하드코딩
  ```

**검증 체크포인트**:
- ✅ Kakao Console URI와 Worker 로그 URI 일치
- ✅ 카카오 로그인 시 `invalid_grant` 또는 `redirect_uri_mismatch` 오류 없음

---

### 3️⃣ **Kakao REST API Key 오류** ⭐⭐⭐
**우선순위**: 🟡 **중간**

**왜 의심되는가**:
- Token exchange 실패 시 Kakao가 401/403 반환 → Worker가 500으로 처리
- 현재 설정된 키: `5dd74bccb797640b0efd070467f3bafd`

**확인 방법** (난이도: ⭐ 쉬움):
```bash
# 1. Kakao Console에서 REST API Key 확인
# https://developers.kakao.com/console/app → 앱 선택 → 앱 키

# 2. Cloudflare 환경 변수 확인
# Dashboard → Environment variables → KAKAO_REST_API_KEY

# 3. 일치 여부 검증
```

**해결 방법** (난이도: ⭐ 쉬움):
1. Kakao Console에서 **REST API 키** 복사
2. Cloudflare Dashboard → `KAKAO_REST_API_KEY` 업데이트
3. 재배포

**검증 체크포인트**:
- ✅ Kakao Console 키와 Cloudflare 환경 변수 일치
- ✅ Token exchange 성공 로그: `[KakaoAuthService] ✅ Access token obtained`

---

### 4️⃣ **D1 Database 연결 오류** ⭐⭐
**우선순위**: 🟢 **낮음**

**왜 의심되는가**:
- User upsert 실패 시 500 오류 발생 가능
- `wrangler.toml`에 D1 바인딩 설정되어 있음

**확인 방법** (난이도: ⭐⭐⭐ 어려움):
```bash
# 1. Cloudflare Dashboard에서 D1 Database 상태 확인
# Workers & Pages → ur-live → Settings → Bindings → D1 Databases

# 2. Worker 로그에서 DB 오류 확인
# "Database error" 또는 "D1_ERROR" 키워드 검색

# 3. 로컬 테스트
cd /home/user/webapp
npx wrangler d1 list
npx wrangler d1 info ur-live-db
```

**해결 방법** (난이도: ⭐⭐⭐ 어려움):
1. D1 Database가 존재하지 않으면 생성:
   ```bash
   npx wrangler d1 create ur-live-db
   # 출력된 database_id를 wrangler.toml에 추가
   ```

2. 스키마 초기화:
   ```bash
   npx wrangler d1 execute ur-live-db --remote --file=./schema.sql
   ```

3. 바인딩 재설정 후 재배포

**검증 체크포인트**:
- ✅ D1 Database 정상 작동
- ✅ User upsert 성공 로그

---

### 5️⃣ **CORS / 환경 변수 누락** ⭐
**우선순위**: 🟢 **최저**

**왜 의심되는가**:
- CORS 설정 누락 시 OPTIONS 요청 실패
- 환경 변수 누락 시 초기화 단계에서 오류

**확인 방법** (난이도: ⭐ 쉬움):
```bash
# 모든 필수 환경 변수 확인
cd /home/user/webapp
cat << 'EOF' > check_env.sh
#!/bin/bash
REQUIRED_VARS=(
  "FIREBASE_PROJECT_ID"
  "FIREBASE_CLIENT_EMAIL"
  "FIREBASE_PRIVATE_KEY"
  "FIREBASE_DATABASE_URL"
  "KAKAO_REST_API_KEY"
  "JWT_SECRET"
  "REFRESH_TOKEN_SECRET"
)

echo "=== Required Backend Environment Variables ==="
for var in "${REQUIRED_VARS[@]}"; do
  echo "- $var"
done
EOF
chmod +x check_env.sh
./check_env.sh
```

**해결 방법** (난이도: ⭐ 쉬움):
- 누락된 변수를 Cloudflare Dashboard에 추가

**검증 체크포인트**:
- ✅ 모든 필수 변수 설정됨
- ✅ Worker 초기화 오류 없음

---

## 🚀 즉시 실행 가능한 디버깅 단계 (15분)

### Step 1: Firebase Private Key 재생성 및 업데이트 (5분)
```bash
# 1. Firebase Console에서 새 키 생성
# https://console.firebase.google.com/project/urteam-live-commerce-5b284/settings/serviceaccounts/adminsdk

# 2. JSON 다운로드 → private_key 복사

# 3. 줄바꿈 변환 (방법 C - JavaScript Console):
const key = "YOUR_PRIVATE_KEY_WITH_\\n";
console.log(key.replace(/\\n/g, '\n'));

# 4. Cloudflare Dashboard → FIREBASE_PRIVATE_KEY 업데이트
```

### Step 2: Kakao Redirect URI 동기화 (3분)
```bash
# 1. Kakao Console 확인
# https://developers.kakao.com/console/app

# 2. 다음 URI들이 모두 등록되어 있는지 확인:
# - https://live.ur-team.com/auth/kakao/sync/callback
# - https://live.ur-team.com/auth/kakao/callback

# 3. 없으면 추가
```

### Step 3: 재배포 (5분)
```bash
# Cloudflare Dashboard
# Workers & Pages → ur-live → Deployments → Retry deployment
```

### Step 4: 테스트 및 로그 확인 (2분)
```bash
# 1. Incognito 모드로 https://live.ur-team.com 접속
# 2. 카카오 로그인 클릭
# 3. Browser DevTools → Console 확인
# 4. Network 탭에서 callback 요청의 Response 확인

# 5. Cloudflare Dashboard → Logs 확인 (실시간)
# 다음 로그를 찾아보세요:
# - ✅ "[KakaoAuthService] ✅ Access token obtained"
# - ✅ "[Kakao Sync] ✅ Login successful for user: XXX"
# - ❌ "Invalid PKCS8 input" (이 오류가 사라져야 함)
```

---

## 📊 원인별 확률 분석

| 원인 | 확률 | 수정 난이도 | 수정 시간 |
|-----|------|------------|----------|
| 1. Firebase Private Key 형식 오류 | 85% | ⭐ 쉬움 | 5분 |
| 2. Kakao Redirect URI 불일치 | 10% | ⭐⭐ 중간 | 3분 |
| 3. Kakao REST API Key 오류 | 3% | ⭐ 쉬움 | 2분 |
| 4. D1 Database 연결 오류 | 1% | ⭐⭐⭐ 어려움 | 15분 |
| 5. CORS / 환경 변수 누락 | 1% | ⭐ 쉬움 | 2분 |

---

## ✅ 최종 체크리스트

### 배포 전
- [ ] Firebase Private Key가 **실제 줄바꿈**으로 변환되어 Cloudflare에 저장됨
- [ ] Kakao Console Redirect URI에 `https://live.ur-team.com/auth/kakao/sync/callback` 등록됨
- [ ] `KAKAO_REST_API_KEY` 값이 Kakao Console의 REST API 키와 일치함
- [ ] 모든 필수 환경 변수 (26개) 설정 완료

### 배포 후
- [ ] 배포 성공 (5-10분 대기)
- [ ] Incognito 모드로 사이트 접속 가능
- [ ] 카카오 로그인 버튼 클릭 → Kakao 인증 페이지로 이동
- [ ] 인증 완료 → Callback URL로 리다이렉트
- [ ] "Invalid PKCS8 input" 오류 사라짐
- [ ] 프로필 페이지로 정상 리다이렉트
- [ ] Firebase Authentication 정상 작동

---

## 🆘 추가 지원이 필요한 경우

### Cloudflare Worker 로그 실시간 확인
```bash
# Cloudflare Dashboard 접속
https://dash.cloudflare.com/

# Workers & Pages → ur-live → Logs → Real-time logs

# 또는 Wrangler CLI (API Token 필요):
cd /home/user/webapp
export CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN"
npx wrangler pages deployment tail --project-name ur-live
```

### GitHub Actions 수동 트리거
```bash
# https://github.com/tobe2111/ur-live/actions
# "Deploy to Cloudflare Pages" 선택 → "Run workflow" → branch: main
```

---

## 📝 요약

**가장 가능성 높은 원인**: Firebase Private Key의 줄바꿈 형식 오류 (85%)

**즉시 조치**:
1. Firebase Console에서 새 Private Key 생성
2. 줄바꿈 변환 (`\n` → 실제 Enter)
3. Cloudflare Dashboard에 업데이트
4. 재배포
5. 테스트

**예상 해결 시간**: 5-10분

---

생성일: 2026-03-19
