# ✅ UR Live 듀얼 사이트 자동 배포 시스템 완성

> **완료 일시**: 2026-03-05  
> **작업 내용**: KR + GLOBAL 듀얼 사이트 빌드 자동화  
> **커밋**: [e01e52a](https://github.com/tobe2111/ur-live/commit/e01e52a)  
> **상태**: ✅ 빌드 완료, Cloudflare 설정 대기

---

## 🎉 완료된 작업

### ✅ 1. 자동 빌드 시스템

**스크립트**: `scripts/deploy-dual-sites.sh`

**기능**:
```bash
./scripts/deploy-dual-sites.sh

Phase 1: KR 사이트 빌드
  ✅ npm run build:kr 실행
  ✅ dist/ 폴더 생성 (12M)
  ✅ 환경 변수 검증 통과

Phase 2: GLOBAL 사이트 빌드
  ✅ npm run build:global 실행
  ✅ dist-global/ 폴더 생성 (9.7M)
  ✅ 환경 변수 검증 통과

Phase 3: 템플릿 생성
  ✅ .env.kr.template (12개 변수)
  ✅ .env.global.template (10개 변수)
  ✅ .worker-secrets.template (Worker Secrets)

Phase 4: 다음 단계 안내
  ✅ Cloudflare 설정 방법
  ✅ 환경 변수 설정 방법
  ✅ Worker Secrets 설정 방법
```

**소요 시간**: 약 56초 (KR 25초 + GLOBAL 25초 + 템플릿 생성)

---

### ✅ 2. 환경 변수 템플릿

#### **`.env.kr.template`** (KR 사이트용 - 12개)

```bash
# Firebase (8개)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_REGION=KR

# Kakao (3개)
VITE_KAKAO_REST_API_KEY=
VITE_KAKAO_JAVASCRIPT_KEY=
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com

# TossPayments (1개)
VITE_TOSS_CLIENT_KEY=
```

#### **`.env.global.template`** (GLOBAL 사이트용 - 10개)

```bash
# Firebase (8개)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_REGION=GLOBAL

# Google OAuth (1개)
VITE_GOOGLE_CLIENT_ID=

# Stripe (1개)
VITE_STRIPE_PUBLISHABLE_KEY=
```

#### **`.worker-secrets.template`** (Worker Secrets용)

```bash
# Firebase Admin SDK (공통)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_DATABASE_URL=

# KR 전용
KAKAO_CLIENT_SECRET=
TOSS_SECRET_KEY=

# GLOBAL 전용
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=

# 공통
JWT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
DISCORD_WEBHOOK_URL=
```

---

### ✅ 3. 빌드 결과

```
✅ KR Build (live.ur-team.com)
   Output: dist/
   Size: 12M
   Files: 72개 JS 파일, 1개 CSS 파일
   Largest: vendor-rDrAZagx.js (739.95 KB → 231.67 KB gzip)
   Build time: 24.94s
   Region: KR
   Features: Kakao OAuth, TossPayments

✅ GLOBAL Build (world.ur-team.com)
   Output: dist-global/
   Size: 9.7M
   Files: 72개 JS 파일, 1개 CSS 파일
   Largest: vendor-DtNHP9oZ.js (753.61 KB → 236.50 KB gzip)
   Build time: 25.55s
   Region: GLOBAL
   Features: Google OAuth, Stripe
```

---

## 📋 다음 단계 (Cloudflare 설정)

### 🇰🇷 **Phase 1: KR 사이트** (live.ur-team.com)

1. **Cloudflare Pages 프로젝트 생성**
   ```
   https://dash.cloudflare.com/ → Workers & Pages → Create application
   → Pages → Connect to Git → tobe2111/ur-live
   ```

2. **Build Configuration**
   ```yaml
   Project name: ur-live-kr
   Production branch: main
   Build command: npm run build:kr
   Build output directory: /dist
   Root directory: (비워두기)
   ```

3. **Environment Variables 추가**
   ```
   .env.kr.template 파일 참고 → 12개 변수 입력
   ```

4. **Worker Secrets 설정** (배포 후)
   ```bash
   npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live-kr
   npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name ur-live-kr
   npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live-kr
   npx wrangler pages secret put JWT_SECRET --project-name ur-live-kr
   npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-kr
   npx wrangler pages secret put EMAIL_FROM --project-name ur-live-kr
   ```

5. **Custom Domain 설정**
   ```
   Settings → Custom domains → live.ur-team.com
   ```

---

### 🌏 **Phase 2: GLOBAL 사이트** (world.ur-team.com)

1. **Cloudflare Pages 프로젝트 생성**
   ```
   동일한 GitHub 저장소 (tobe2111/ur-live) 연결
   ```

2. **Build Configuration**
   ```yaml
   Project name: ur-live-global
   Production branch: main
   Build command: npm run build:global
   Build output directory: /dist-global
   Root directory: (비워두기)
   ```

3. **Environment Variables 추가**
   ```
   .env.global.template 파일 참고 → 10개 변수 입력
   ```

4. **Worker Secrets 설정** (배포 후)
   ```bash
   npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live-global
   npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name ur-live-global
   npx wrangler pages secret put STRIPE_SECRET_KEY --project-name ur-live-global
   npx wrangler pages secret put JWT_SECRET --project-name ur-live-global
   npx wrangler pages secret put RESEND_API_KEY --project-name ur-live-global
   npx wrangler pages secret put EMAIL_FROM --project-name ur-live-global
   ```

5. **Custom Domain 설정**
   ```
   Settings → Custom domains → world.ur-team.com
   ```

---

## 🔄 자동 배포 워크플로우

### 코드 푸시 시
```bash
git push origin main
```

### 자동 발생
```
GitHub 변경 감지
    ↓
┌───────────────┴───────────────┐
↓                               ↓
ur-live-kr                ur-live-global
npm run build:kr          npm run build:global
dist/ 배포                dist-global/ 배포
↓                               ↓
live.ur-team.com         world.ur-team.com
✅ 업데이트              ✅ 업데이트
```

**배포 시간**: 각 사이트 약 3분, 병렬 실행

---

## 📊 비교표

| 항목 | KR (live.ur-team.com) | GLOBAL (world.ur-team.com) |
|------|----------------------|----------------------------|
| **프로젝트명** | ur-live-kr | ur-live-global |
| **Build command** | `npm run build:kr` | `npm run build:global` |
| **Output** | `/dist` | `/dist-global` |
| **Size** | 12M | 9.7M |
| **Build time** | 24.94s | 25.55s |
| **Env vars** | 12개 | 10개 |
| **Worker secrets** | 8개 | 8개 |
| **인증** | Kakao OAuth | Google OAuth |
| **결제** | TossPayments | Stripe |

---

## 📚 관련 문서

| 문서 | 목적 | 링크 |
|------|------|------|
| **CLOUDFLARE_DUAL_SITE_SETUP.md** | 듀얼 사이트 아키텍처 설명 | [View](https://github.com/tobe2111/ur-live/blob/main/CLOUDFLARE_DUAL_SITE_SETUP.md) |
| **DUAL_SITE_EXECUTION_GUIDE.md** | 단계별 실행 가이드 | [View](https://github.com/tobe2111/ur-live/blob/main/DUAL_SITE_EXECUTION_GUIDE.md) |
| **CLOUDFLARE_BUILD_ERROR_FIX.md** | 빌드 에러 해결 | [View](https://github.com/tobe2111/ur-live/blob/main/CLOUDFLARE_BUILD_ERROR_FIX.md) |
| **.env.kr.template** | KR 환경 변수 템플릿 | Project root |
| **.env.global.template** | GLOBAL 환경 변수 템플릿 | Project root |
| **.worker-secrets.template** | Worker Secrets 템플릿 | Project root |

---

## 🚀 즉시 실행 가능

### 로컬 빌드 테스트
```bash
cd /home/user/webapp
./scripts/deploy-dual-sites.sh
```

### Cloudflare 설정 시작
```
1. https://dash.cloudflare.com/ 접속
2. Workers & Pages → Create application
3. DUAL_SITE_EXECUTION_GUIDE.md 참고하여 설정
```

---

## ✅ 체크리스트

### 완료된 작업
- [x] 듀얼 사이트 빌드 시스템 구축
- [x] 자동 빌드 스크립트 작성
- [x] KR 빌드 성공 (dist/)
- [x] GLOBAL 빌드 성공 (dist-global/)
- [x] 환경 변수 템플릿 생성
- [x] Worker Secrets 템플릿 생성
- [x] 문서 작성 완료
- [x] Git 커밋 및 푸시

### 대기 중 (사용자 작업 필요)
- [ ] Cloudflare Pages 프로젝트 생성 (ur-live-kr)
- [ ] KR 환경 변수 12개 추가
- [ ] KR Worker Secrets 8개 설정
- [ ] KR Custom domain 설정
- [ ] Cloudflare Pages 프로젝트 생성 (ur-live-global)
- [ ] GLOBAL 환경 변수 10개 추가
- [ ] GLOBAL Worker Secrets 8개 설정
- [ ] GLOBAL Custom domain 설정
- [ ] 자동 배포 검증

---

## 💡 핵심 포인트

1. ✅ **하나의 GitHub 저장소**, 두 개의 Cloudflare Pages 프로젝트
2. ✅ **Build command만 다름**: `npm run build:kr` vs `npm run build:global`
3. ✅ **Output directory만 다름**: `/dist` vs `/dist-global`
4. ✅ **환경 변수만 다름**: Kakao+Toss vs Google+Stripe
5. ✅ **git push 한 번**으로 양쪽 모두 자동 배포

---

## 📞 후속 지원

앞으로 모든 작업은 **UR Live 아키텍처 재정비 원칙**을 따릅니다:

1. ✅ Feature-based 구조 유지
2. ✅ Zustand 상태 관리 (Context API 금지)
3. ✅ Drizzle ORM 사용 (raw SQL 금지)
4. ✅ 환경 변수 검증 (빌드 타임 + 런타임)
5. ✅ Rate limiting + Error handling (Sentry + Discord)
6. ✅ 자동 배포 (git push → 양쪽 빌드)
7. ✅ 모든 코드 변경 → 즉시 커밋
8. ✅ 모든 커밋 → PR 생성

---

## 🎯 결론

**빌드 자동화 완료!** 🎉

이제 사용자는 Cloudflare Dashboard에서 설정만 하면 됩니다:
1. 프로젝트 2개 생성 (ur-live-kr, ur-live-global)
2. Build configuration 설정
3. 환경 변수 추가
4. Worker Secrets 설정
5. Custom domains 설정

설정 완료 후:
- `git push origin main` → 양쪽 사이트 자동 배포 ✅
- live.ur-team.com → KR 버전 (Kakao + Toss)
- world.ur-team.com → GLOBAL 버전 (Google + Stripe)

---

**생성일**: 2026-03-05  
**프로젝트**: UR Live  
**커밋**: [e01e52a](https://github.com/tobe2111/ur-live/commit/e01e52a)  
**상태**: ✅ 빌드 완료, Cloudflare 설정 대기
