# 🚨 Cloudflare Pages 빌드 실패 해결 가이드

> **발생한 에러**: `❌ [Env Validator] 빌드 타임 검증 실패`  
> **원인**: Build command가 `npm run build`로 설정되어 GLOBAL 모드로 빌드 시도  
> **해결**: Build command를 `npm run build:kr`로 변경 필요

---

## 🔍 문제 분석

### 에러 로그
```
15:13:25.868	🌍 [Vite Config] Building for region: GLOBAL
15:13:25.870	🔍 [Env Validator] 환경 변수 검증 시작 (Mode: production, Region: GLOBAL)
15:13:25.870	❌ [Env Validator] 빌드 타임 검증 실패
15:13:25.907	Failed: error occurred while running build command
```

### 원인

| Build Command | Vite Mode | Region | 필요한 환경 변수 |
|---------------|-----------|--------|------------------|
| `npm run build` | `production` | **GLOBAL** ❌ | Google, Stripe |
| `npm run build:kr` | `kr` | **KR** ✅ | Kakao, Toss |
| `npm run build:global` | `global` | **GLOBAL** | Google, Stripe |

**문제**: 
- Cloudflare Pages에서 `npm run build` 실행
- Vite는 모드를 지정하지 않으면 `production` 모드 사용
- `vite.config.ts`에서 `production` 모드는 GLOBAL로 인식
- GLOBAL 환경 변수 (`VITE_GOOGLE_CLIENT_ID`, `VITE_STRIPE_PUBLISHABLE_KEY`) 없음
- 빌드 실패

### 관련 코드 (vite.config.ts)
```typescript
export default defineConfig(({ mode }) => {
  // 🎯 Region 분기 (KR vs GLOBAL)
  const isKR = mode === 'kr' || mode === 'development'  // dev는 기본 KR
  const isGlobal = mode === 'global'
  
  // ⚠️ production 모드는 isKR도 isGlobal도 아님
  // → 기본값으로 GLOBAL 취급됨!
```

---

## ✅ 해결 방법

### Option 1: Build Command 변경 (권장)

**Cloudflare Dashboard에서 설정 변경**:

```
1. Cloudflare Dashboard 로그인
   https://dash.cloudflare.com/

2. Workers & Pages → ur-live 프로젝트 선택

3. Settings → Builds & deployments

4. Build configurations → Edit configuration

5. Build command 변경:
   Before: npm run build
   After:  npm run build:kr

6. Save 클릭
```

### Option 2: 환경 변수 추가 (GLOBAL 빌드용)

GLOBAL 모드로 빌드하려면 다음 환경 변수 추가:

```bash
# Settings → Environment variables → Add variable

VITE_GOOGLE_CLIENT_ID=실제_구글_클라이언트_ID
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_실제_스트라이프_키
```

⚠️ **주의**: KR 사이트 (live.ur-team.com)는 KR 빌드를 사용해야 합니다!

### Option 3: package.json 수정 (영구 해결)

로컬에서 package.json 수정:

```json
{
  "scripts": {
    "build": "vite build --mode kr && vite build --config vite.worker.config.ts && node fix-routes.js && node force-update.js",
    "build:production": "vite build --mode kr && vite build --config vite.worker.config.ts && node fix-routes.js && node force-update.js"
  }
}
```

이렇게 하면 `npm run build`가 기본적으로 KR 모드로 실행됩니다.

---

## 🎯 권장 설정

### KR 사이트 (live.ur-team.com)

```yaml
Build command: npm run build:kr
Build output directory: /dist
Root directory: /

필수 환경 변수 (12개):
✅ VITE_FIREBASE_API_KEY
✅ VITE_FIREBASE_AUTH_DOMAIN
✅ VITE_FIREBASE_PROJECT_ID
✅ VITE_FIREBASE_STORAGE_BUCKET
✅ VITE_FIREBASE_MESSAGING_SENDER_ID
✅ VITE_FIREBASE_APP_ID
✅ VITE_FIREBASE_MEASUREMENT_ID
✅ VITE_REGION=KR
✅ VITE_KAKAO_REST_API_KEY
✅ VITE_KAKAO_JAVASCRIPT_KEY
✅ VITE_KAKAO_AUTH_URL=https://kauth.kakao.com
✅ VITE_TOSS_CLIENT_KEY
```

### GLOBAL 사이트 (world.ur-team.com)

```yaml
Build command: npm run build:global
Build output directory: /dist-global
Root directory: /

필수 환경 변수 (10개):
✅ VITE_FIREBASE_API_KEY
✅ VITE_FIREBASE_AUTH_DOMAIN
✅ VITE_FIREBASE_PROJECT_ID
✅ VITE_FIREBASE_STORAGE_BUCKET
✅ VITE_FIREBASE_MESSAGING_SENDER_ID
✅ VITE_FIREBASE_APP_ID
✅ VITE_FIREBASE_MEASUREMENT_ID
✅ VITE_REGION=GLOBAL
✅ VITE_GOOGLE_CLIENT_ID
✅ VITE_STRIPE_PUBLISHABLE_KEY
```

---

## 🔧 즉시 실행 단계

### 1️⃣ Cloudflare Dashboard 접속
```
https://dash.cloudflare.com/
→ Workers & Pages
→ ur-live 프로젝트
```

### 2️⃣ Build Command 변경
```
Settings → Builds & deployments
→ Build configurations → Edit

Build command: npm run build:kr
```

### 3️⃣ 재배포
```
Deployments 탭
→ "Retry deployment" 클릭
→ 빌드 로그 확인 (약 3분)
```

### 4️⃣ 빌드 로그 확인
```
✅ 성공 시:
🌍 [Vite Config] Building for region: KR
🔍 [Env Validator] 환경 변수 검증 시작 (Mode: kr, Region: KR)
✅ [Env Validator] 빌드 타임 검증 완료

❌ 실패 시:
- 환경 변수 누락 메시지 확인
- ENVIRONMENT_VARIABLES.md 참고하여 변수 추가
```

---

## 📋 체크리스트

### 설정 확인

- [ ] Build command: `npm run build:kr` 설정 완료
- [ ] Build output directory: `/dist` 설정 완료
- [ ] Root directory: `/` (비워두기)
- [ ] Framework preset: `None` 또는 `Custom`

### 환경 변수 확인 (KR)

- [ ] `VITE_FIREBASE_API_KEY`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN`
- [ ] `VITE_FIREBASE_PROJECT_ID`
- [ ] `VITE_FIREBASE_STORAGE_BUCKET`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `VITE_FIREBASE_APP_ID`
- [ ] `VITE_FIREBASE_MEASUREMENT_ID`
- [ ] `VITE_REGION=KR`
- [ ] `VITE_KAKAO_REST_API_KEY`
- [ ] `VITE_KAKAO_JAVASCRIPT_KEY`
- [ ] `VITE_KAKAO_AUTH_URL`
- [ ] `VITE_TOSS_CLIENT_KEY`

### 재배포

- [ ] "Retry deployment" 클릭
- [ ] 빌드 로그에서 "Region: KR" 확인
- [ ] 빌드 성공 확인 (약 3분)
- [ ] https://live.ur-team.com 접속 테스트

---

## 🆘 추가 트러블슈팅

### 빌드는 성공했는데 404 에러가 계속 발생

**원인**: 오래된 캐시

**해결**:
```
1. Settings → Caching
2. "Purge everything" 클릭
3. 브라우저에서 Ctrl+Shift+R (강력 새로고침)
```

### 환경 변수를 추가했는데도 실패

**원인**: 변수 추가 후 재배포 필요

**해결**:
```
1. Settings → Environment variables에서 변수 확인
2. Deployments → "Retry deployment" 클릭
```

### "Missing required environment variable" 에러

**원인**: 필수 환경 변수 누락

**해결**:
```
1. 에러 메시지에서 누락된 변수명 확인
2. ENVIRONMENT_VARIABLES.md 참고
3. Settings → Environment variables에서 추가
4. "Retry deployment" 클릭
```

---

## 📚 관련 문서

- **CLOUDFLARE_PAGES_GITHUB_SETUP.md** - 전체 설정 가이드
- **ENVIRONMENT_VARIABLES.md** - 환경 변수 레퍼런스
- **DEPLOYMENT_PROTOCOL_2026.md** - 배포 프로토콜

---

## ✅ 요약

| 항목 | 내용 |
|------|------|
| **문제** | `npm run build` → GLOBAL 모드 → 환경 변수 없음 → 빌드 실패 |
| **해결** | Build command를 `npm run build:kr`로 변경 |
| **설정 위치** | Cloudflare Dashboard → Settings → Builds & deployments |
| **예상 시간** | 5분 (설정 변경) + 3분 (빌드) = **8분** |
| **검증** | 빌드 로그에서 "Region: KR" 확인 |

---

**즉시 실행**: Cloudflare Dashboard에서 Build command를 `npm run build:kr`로 변경하고 재배포하세요!

**생성일**: 2026-03-05  
**프로젝트**: UR Live  
**상태**: 🚨 긴급 - 즉시 조치 필요
