# Environment Variables Reference

> **목적**: UR Live 프로젝트의 모든 환경 변수 정의 및 설정 가이드

## 📋 환경 변수 분류

### 1. Firebase 설정 (필수 - 8개)

| 변수명 | 설명 | 예시 | 용도 |
|--------|------|------|------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key | `AIzaSyD...` | Firebase 초기화 |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase 인증 도메인 | `project.firebaseapp.com` | OAuth 리다이렉트 |
| `VITE_FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID | `ur-live-prod` | 프로젝트 식별 |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage 버킷 주소 | `project.appspot.com` | 파일 업로드 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM 발신자 ID | `123456789012` | 푸시 알림 |
| `VITE_FIREBASE_APP_ID` | Firebase 앱 ID | `1:123:web:abc` | 앱 식별 |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics ID | `G-ABC123` | 분석 추적 |
| `VITE_REGION` | 서비스 지역 | `KR` 또는 `GLOBAL` | 빌드 모드 |

### 2. Kakao OAuth (KR 전용 - 3개)

| 변수명 | 설명 | 예시 | 용도 |
|--------|------|------|------|
| `VITE_KAKAO_REST_API_KEY` | Kakao REST API Key | `abc123def456...` | 서버 API 호출 |
| `VITE_KAKAO_JAVASCRIPT_KEY` | Kakao JavaScript Key | `xyz789abc123...` | 클라이언트 SDK |
| `VITE_KAKAO_AUTH_URL` | Kakao 인증 서버 | `https://kauth.kakao.com` | OAuth 엔드포인트 |

### 3. TossPayments (KR 전용 - 1개)

| 변수명 | 설명 | 예시 | 용도 |
|--------|------|------|------|
| `VITE_TOSS_CLIENT_KEY` | Toss 클라이언트 키 | `test_gck_docs_...` | 결제 위젯 |

### 4. Google OAuth (GLOBAL 전용 - 1개)

| 변수명 | 설명 | 예시 | 용도 |
|--------|------|------|------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID | `123-abc.apps.googleusercontent.com` | Google 로그인 |

### 5. Stripe (GLOBAL 전용 - 1개)

| 변수명 | 설명 | 예시 | 용도 |
|--------|------|------|------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe 공개 키 | `pk_test_...` 또는 `pk_live_...` | 결제 처리 |

### 6. Worker Secrets (런타임 - 9개)

⚠️ **주의**: 이 변수들은 Cloudflare Worker에서만 사용되며, `wrangler pages secret put` 명령으로 설정합니다.

| 변수명 | 설명 | 설정 방법 | 용도 |
|--------|------|-----------|------|
| `FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID | `wrangler secret put` | Admin SDK |
| `FIREBASE_DATABASE_URL` | Realtime DB URL | `wrangler secret put` | Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Service Account Key | `wrangler secret put` | Admin SDK 인증 |
| `FIREBASE_CLIENT_EMAIL` | Service Account Email | `wrangler secret put` | Admin SDK 인증 |
| `KAKAO_CLIENT_SECRET` | Kakao OAuth Secret | `wrangler secret put` | 토큰 검증 |
| `TOSS_SECRET_KEY` | Toss Secret Key | `wrangler secret put` | 결제 검증 |
| `JWT_SECRET` | JWT 서명 키 | `wrangler secret put` | 세션 관리 |
| `RESEND_API_KEY` | Resend API Key | `wrangler secret put` | 이메일 발송 |
| `EMAIL_FROM` | 발신자 이메일 | `wrangler secret put` | 이메일 발신 |

### 7. 선택적 변수 (Optional)

| 변수명 | 설명 | 기본값 | 용도 |
|--------|------|--------|------|
| `VITE_API_BASE_URL` | API 서버 주소 | (현재 도메인) | API 엔드포인트 |
| `VITE_SENTRY_DSN` | Sentry DSN | (없음) | 에러 모니터링 |
| `DISCORD_WEBHOOK_URL` | Discord Webhook | (없음) | 알림 전송 |
| `VITE_DAUM_POSTCODE_KEY` | Daum 우편번호 API | (없음) | 주소 검색 |

## 🔐 보안 수준별 분류

### Public (클라이언트 노출 가능)
```bash
VITE_FIREBASE_API_KEY         # ✅ 공개 가능 (Firebase 자체 보안)
VITE_FIREBASE_AUTH_DOMAIN     # ✅ 공개 가능
VITE_FIREBASE_PROJECT_ID      # ✅ 공개 가능
VITE_KAKAO_JAVASCRIPT_KEY     # ✅ 공개 가능 (JavaScript SDK용)
VITE_TOSS_CLIENT_KEY          # ✅ 공개 가능 (클라이언트 키)
VITE_GOOGLE_CLIENT_ID         # ✅ 공개 가능
VITE_STRIPE_PUBLISHABLE_KEY   # ✅ 공개 가능
```

### Private (절대 노출 금지)
```bash
KAKAO_CLIENT_SECRET           # 🔒 Worker only
TOSS_SECRET_KEY              # 🔒 Worker only
JWT_SECRET                   # 🔒 Worker only
FIREBASE_PRIVATE_KEY         # 🔒 Worker only
FIREBASE_CLIENT_EMAIL        # 🔒 Worker only
RESEND_API_KEY               # 🔒 Worker only
```

## 📦 빌드 모드별 설정

### KR 빌드 (`npm run build:kr`)

**필수 환경 변수**:
```bash
# Firebase (8개)
VITE_FIREBASE_API_KEY=실제값
VITE_FIREBASE_AUTH_DOMAIN=실제값
VITE_FIREBASE_PROJECT_ID=실제값
VITE_FIREBASE_STORAGE_BUCKET=실제값
VITE_FIREBASE_MESSAGING_SENDER_ID=실제값
VITE_FIREBASE_APP_ID=실제값
VITE_FIREBASE_MEASUREMENT_ID=실제값
VITE_REGION=KR

# Kakao (3개)
VITE_KAKAO_REST_API_KEY=실제값
VITE_KAKAO_JAVASCRIPT_KEY=실제값
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com

# TossPayments (1개)
VITE_TOSS_CLIENT_KEY=실제값
```

### GLOBAL 빌드 (`npm run build:global`)

**필수 환경 변수**:
```bash
# Firebase (8개)
VITE_FIREBASE_API_KEY=실제값
VITE_FIREBASE_AUTH_DOMAIN=실제값
VITE_FIREBASE_PROJECT_ID=실제값
VITE_FIREBASE_STORAGE_BUCKET=실제값
VITE_FIREBASE_MESSAGING_SENDER_ID=실제값
VITE_FIREBASE_APP_ID=실제값
VITE_FIREBASE_MEASUREMENT_ID=실제값
VITE_REGION=GLOBAL

# Google OAuth (1개)
VITE_GOOGLE_CLIENT_ID=실제값

# Stripe (1개)
VITE_STRIPE_PUBLISHABLE_KEY=실제값
```

## 🛠️ 설정 방법

### 로컬 개발 (.env 파일)

```bash
cd /home/user/webapp

# .env 파일 생성/수정
cat > .env << 'EOF'
# Firebase 설정
VITE_FIREBASE_API_KEY=AIzaSyD...
VITE_FIREBASE_AUTH_DOMAIN=ur-live-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ur-live-prod
VITE_FIREBASE_STORAGE_BUCKET=ur-live-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123
VITE_REGION=KR

# Kakao OAuth
VITE_KAKAO_REST_API_KEY=abc123...
VITE_KAKAO_JAVASCRIPT_KEY=xyz789...
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com

# TossPayments
VITE_TOSS_CLIENT_KEY=test_gck_docs_...
EOF

# 로컬 실행
npm run dev
```

### Cloudflare Pages (Dashboard UI)

#### 방법 1: Web UI (권장)

```
1. Cloudflare Dashboard 로그인
2. Workers & Pages → ur-live → Settings
3. Environment variables 섹션
4. "Add variable" 클릭
5. 변수명과 값 입력
6. Environment: "Production" 또는 "Preview" 선택
7. "Save" 클릭
```

#### 방법 2: Wrangler CLI

```bash
cd /home/user/webapp

# Build 환경 변수 (Pages UI에서 설정)
# 각 변수를 Cloudflare UI에 수동 입력

# Worker secrets (CLI로 설정)
echo "실제값" | npx wrangler pages secret put FIREBASE_PROJECT_ID
echo "실제값" | npx wrangler pages secret put FIREBASE_PRIVATE_KEY
echo "실제값" | npx wrangler pages secret put KAKAO_CLIENT_SECRET
echo "실제값" | npx wrangler pages secret put TOSS_SECRET_KEY
echo "실제값" | npx wrangler pages secret put JWT_SECRET
echo "실제값" | npx wrangler pages secret put RESEND_API_KEY
echo "실제값" | npx wrangler pages secret put EMAIL_FROM

# 설정 확인
npx wrangler pages secret list
```

### GitHub Actions (CI/CD)

`.github/workflows/ci-cd.yml`:
```yaml
env:
  # 빌드 시 필요한 환경 변수
  VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
  VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
  VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
  # ... 나머지 변수들
```

**GitHub Secrets 등록**:
```
1. GitHub 저장소 → Settings
2. Secrets and variables → Actions
3. "New repository secret" 클릭
4. 각 VITE_ 변수 추가
```

## ✅ 검증 방법

### 빌드 시 검증 (자동)

프로젝트는 `src/lib/env/kr.ts`, `src/lib/env/global.ts`에서 자동 검증합니다:

```typescript
// 빌드 실행 시 자동 체크
npm run build:kr

// 누락된 변수가 있으면:
// ❌ Error: Missing required environment variable: VITE_KAKAO_REST_API_KEY
// 빌드 실패 (exit code 1)
```

### 수동 검증 스크립트

```bash
cd /home/user/webapp

# KR 환경 변수 체크
npm run validate:kr

# GLOBAL 환경 변수 체크
npm run validate:global
```

### 런타임 검증

```bash
# 개발 서버 실행 후 브라우저 콘솔 확인
npm run dev

# 콘솔에서 실행:
console.log(import.meta.env.VITE_FIREBASE_API_KEY)  // 값 출력되어야 함
```

## 🚨 트러블슈팅

### 문제 1: "Missing required environment variable"

**원인**: 필수 변수 누락
**해결**:
```bash
# .env 파일 확인
cat .env

# 누락된 변수 추가
echo "VITE_변수명=값" >> .env
```

### 문제 2: 빌드는 성공하지만 런타임 오류

**원인**: Worker secrets 미설정
**해결**:
```bash
npx wrangler pages secret put SECRET_NAME
```

### 문제 3: Cloudflare에서 환경 변수 인식 안됨

**원인**: 변수 설정 후 재배포 필요
**해결**:
```
1. Settings → Environment variables에서 변수 추가
2. Deployments → "Retry deployment" 클릭
```

### 문제 4: `VITE_` 접두사 오류

**원인**: Vite는 `VITE_` 접두사가 없는 변수를 클라이언트에 노출하지 않음
**해결**:
```bash
# ❌ 잘못된 변수명
FIREBASE_API_KEY=abc123

# ✅ 올바른 변수명
VITE_FIREBASE_API_KEY=abc123
```

## 📊 환경별 체크리스트

### 로컬 개발 환경

- [ ] `.env` 파일 존재
- [ ] 모든 `VITE_*` 변수 설정
- [ ] `npm run dev` 정상 실행
- [ ] 브라우저 콘솔에 변수 값 출력 확인

### Cloudflare Pages (Production)

- [ ] Settings → Environment variables에 모든 `VITE_*` 변수 추가
- [ ] Worker secrets 설정 완료 (`wrangler pages secret list`로 확인)
- [ ] 테스트 배포 성공
- [ ] Production URL에서 정상 동작 확인

### CI/CD (GitHub Actions)

- [ ] GitHub Secrets에 모든 변수 등록
- [ ] `.github/workflows/ci-cd.yml`에서 변수 참조
- [ ] Actions 실행 시 빌드 성공
- [ ] 자동 배포 성공

## 🔄 변수 업데이트 프로세스

### 1. 로컬 테스트

```bash
cd /home/user/webapp

# .env 파일 수정
vim .env

# 로컬 테스트
npm run dev
```

### 2. Git 커밋 (⚠️ .env는 커밋하지 않음)

```bash
git add src/  # 코드만 커밋
git commit -m "feat: Add new feature"
git push origin main
```

### 3. Cloudflare 업데이트

```bash
# 새 변수 추가 (필요 시)
echo "새값" | npx wrangler pages secret put NEW_VARIABLE

# 또는 Dashboard UI에서 추가
# Settings → Environment variables → Add variable
```

### 4. 배포 확인

```
1. Deployments 탭에서 자동 배포 확인
2. 배포 성공 후 Production URL 접속
3. 브라우저 콘솔에서 변수 확인
```

## 📚 참고 문서

- [Vite 환경 변수 가이드](https://vitejs.dev/guide/env-and-mode.html)
- [Cloudflare Pages 환경 변수](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)
- [Wrangler Secrets 관리](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
- [Firebase 설정 가이드](https://firebase.google.com/docs/web/setup)

---

**생성일**: 2026-03-05
**프로젝트**: UR Live
**버전**: 1.0.0
