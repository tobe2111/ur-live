# 🌍 UR LIVE 해외 버전 설정 가이드

## 📦 백업 파일 정보
- **다운로드 URL**: https://www.genspark.ai/api/files/s/KUbIKg8Z
- **파일 크기**: 35 MB
- **포함 내용**: 전체 소스코드 + Git 히스토리

---

## 🚀 새 프로젝트 설정 방법 (3가지)

### ✅ 방법 1: GitHub Public (가장 간단, 2분)

#### 1. GitHub 저장소 공개
1. https://github.com/tobe2111/ur-live 접속
2. **Settings** → **Danger Zone** → **Change visibility** → **Make public**

#### 2. 새 젠스파크 프로젝트 생성
- 이름: `ur-live-global`
- 유형: "빈 프로젝트 또는 앱"

#### 3. 새 프로젝트 터미널에서 명령
```
https://github.com/tobe2111/ur-live 를 클론해서 해외 버전으로 만들어줘.

작업 목록:
1. 프로젝트 이름을 ur-live-global로 변경
2. Stripe 결제 시스템으로 교체
3. Google/Facebook 로그인으로 교체
4. 통화를 USD로 변경
5. 모든 텍스트를 영어로 번역
6. wrangler.toml 설정 변경
```

---

### ✅ 방법 2: 백업 파일 사용 (GitHub 불필요, 10분)

#### 1. 백업 파일 다운로드
- URL: https://www.genspark.ai/api/files/s/KUbIKg8Z
- 로컬에 저장 (35 MB)

#### 2. 새 젠스파크 프로젝트 생성
- 이름: `ur-live-global`
- 유형: "빈 프로젝트 또는 앱"

#### 3. 백업 파일 업로드
- 젠스파크 프로젝트의 "파일 업로드" 기능 사용
- 또는 터미널에서:
```bash
wget https://www.genspark.ai/api/files/s/KUbIKg8Z -O webapp-backup.tar.gz
tar -xzf webapp-backup.tar.gz
mv webapp ur-live-global
cd ur-live-global
```

#### 4. 새 프로젝트 터미널에서 명령
```
업로드한 백업 파일의 압축을 풀고 해외 버전으로 설정해줘.

작업 목록:
1. npm install 실행
2. Stripe 결제 시스템으로 교체 (토스페이먼츠 제거)
3. Google/Facebook 로그인으로 교체 (카카오/네이버 제거)
4. 통화를 USD로 변경 (KRW → USD)
5. 모든 UI 텍스트를 영어로 번역
6. wrangler.toml에서 프로젝트명을 ur-live-global로 변경
7. 빌드 & 로컬 실행
```

---

### ✅ 방법 3: GitHub Private 유지 (인증 필요, 5분)

#### 1. 새 젠스파크 프로젝트 생성
- 이름: `ur-live-global`
- 유형: "빈 프로젝트 또는 앱"

#### 2. GitHub 인증
- 새 프로젝트 화면 상단의 **#github** 탭 클릭
- "GitHub App" 또는 "OAuth" 인증 완료

#### 3. 새 프로젝트 터미널에서 명령
```
https://github.com/tobe2111/ur-live 를 클론해서 해외 버전으로 만들어줘.

작업 목록:
1. GitHub 인증 확인
2. 저장소 클론
3. 프로젝트 이름을 ur-live-global로 변경
4. Stripe 결제 시스템으로 교체
5. Google/Facebook 로그인으로 교체
6. 통화를 USD로 변경
7. 모든 텍스트를 영어로 번역
```

---

## 🔧 해외 버전에서 변경할 주요 항목

### 1. 결제 시스템
```typescript
// ❌ 제거: 토스페이먼츠
TOSS_SECRET_KEY
TOSS_CLIENT_KEY

// ✅ 추가: Stripe
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
```

### 2. 로그인 시스템
```typescript
// ❌ 제거: 카카오/네이버
KAKAO_JS_KEY
NAVER_CLIENT_ID

// ✅ 추가: Google/Facebook
GOOGLE_CLIENT_ID
FACEBOOK_APP_ID
```

### 3. 통화 & 언어
```typescript
// ❌ 한국
currency: 'KRW'
locale: 'ko-KR'

// ✅ 해외
currency: 'USD'
locale: 'en-US'
```

### 4. 기타 서비스
```typescript
// ❌ 제거 (한국 전용)
ALIMTALK_SENDER_KEY  // 카카오 알림톡

// ✅ 추가 (글로벌)
SENDGRID_API_KEY     // 이메일 발송
```

---

## 📋 해외 버전 설정 체크리스트

### 파일 수정
- [ ] `wrangler.toml` - 프로젝트명을 `ur-live-global`로 변경
- [ ] `package.json` - name을 `ur-live-global`로 변경
- [ ] `src/index.tsx` - Stripe API 라우트 추가, 토스 제거
- [ ] `src/pages/CheckoutPage.tsx` - Stripe 결제 UI로 교체
- [ ] `src/pages/LoginPage.tsx` - Google 로그인 버튼으로 교체
- [ ] `public/app.js` - Stripe.js 로드, TossPayments 제거

### 환경변수 설정
```bash
# .dev.vars 파일 생성
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
GOOGLE_CLIENT_ID=...
JWT_SECRET=...
DISCORD_WEBHOOK_URL=...
```

### Cloudflare 리소스 생성
```bash
# D1 Database
npx wrangler d1 create ur-live-global-db

# KV Namespaces
npx wrangler kv:namespace create SESSION_KV
npx wrangler kv:namespace create CACHE_KV

# R2 Bucket
npx wrangler r2 bucket create ur-live-global-images
```

### 빌드 & 실행
```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000
```

---

## ⚠️ 주의사항

### 한국 버전은 그대로 유지
- **원본 프로젝트**: `/home/user/webapp` (변경 없음)
- **해외 버전**: 새 프로젝트에서 별도 작업

### 데이터베이스는 별도
- 한국 버전: `toss-live-commerce-db`
- 해외 버전: `ur-live-global-db` (새로 생성)

### 배포 URL도 별도
- 한국 버전: `https://ur-live.pages.dev`
- 해외 버전: `https://ur-live-global.pages.dev`

---

## 🆘 문제 해결

### Q1: "npm install 실패"
```bash
# Node.js 버전 확인
node -v  # 18+ 필요

# 캐시 삭제 후 재시도
rm -rf node_modules package-lock.json
npm install
```

### Q2: "Stripe 연동 방법 모르겠어요"
```
"Stripe 결제 연동 방법 자세히 알려줘"
```

### Q3: "Google 로그인 설정 모르겠어요"
```
"Google OAuth 로그인 설정 방법 알려줘"
```

### Q4: "영어 번역 시간이 너무 오래 걸려요"
```
"주요 페이지만 먼저 번역해줘 (HomePage, CheckoutPage, ProductDetailPage)"
```

---

## 📞 추가 지원

새 프로젝트에서 이 명령어를 사용하세요:

```
GLOBAL_VERSION_SETUP_GUIDE.md 파일을 읽고 해외 버전 설정을 시작해줘
```

---

**작성일**: 2026-02-26  
**원본 프로젝트**: https://github.com/tobe2111/ur-live  
**백업 파일**: https://www.genspark.ai/api/files/s/KUbIKg8Z
