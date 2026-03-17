# 🚨 긴급 복구 가이드

**목표**: 모듈화 구조 유지 + 에러 제거 + 기본 기능 복원

---

## ✅ 현재 상태 (2026-03-17)

### 빌드 상태
- ✅ `npm run build` 성공
- ✅ Worker 번들 생성 완료 (`dist/_worker.js` 564.6kb)
- ✅ Client 빌드 완료 (175개 파일)

### 배포 상태
- 🌐 **프로덕션 URL**: https://live.ur-team.com
- 🌐 **최신 배포**: https://90cc213e.toss-live-commerce.pages.dev
- ✅ **Health Check**: `GET /api/health` → 200 OK
- ✅ **Products API**: `GET /api/products` → 200 OK (11개 상품)
- ✅ **Streams API**: `GET /api/streams?status=live` → 200 OK (3개 라이브)

### 알려진 문제
- ⚠️ **카카오 로그인 버튼**: 클릭 불가 (CSS 또는 이벤트 리스너 문제)
- ⚠️ **상품 상세페이지**: `["product","22"] data is undefined` 오류
- ⚠️ **DB 데이터**: 더미 데이터만 존재 (실제 사용자 데이터 소실)
- ⚠️ **환경변수**: Cloudflare Pages 빌드 환경변수 설정 필요

---

## 🔧 로컬 빌드 & 배포 명령어

### 1. 로컬 빌드
```bash
cd /home/user/webapp
npm run build
```

### 2. Wrangler 배포 (수동)
```bash
export CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN"
export CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID"

npx wrangler pages deploy dist/client \
  --project-name=ur-live-working \
  --branch=main
```

### 3. GitHub Actions 자동 배포
```bash
git add .
git commit -m "fix: 모듈화 이후 긴급 복구"
git push origin main
```

GitHub Actions가 자동으로:
1. `npm ci` - 의존성 설치
2. `npm run build` - 프로젝트 빌드
3. `wrangler pages deploy` - Cloudflare Pages 배포

---

## 🎯 핵심 기능 복원 우선순위

### ✅ 완료된 항목
1. D1 바인딩 복구 (`wrangler.toml`의 `[env.production]`에 추가)
2. CSP 정책 수정 (YouTube, Firebase Database 허용)
3. `/api/streams/:id/products` 500 에러 임시 수정
4. Products API 정상 작동 (200 OK)
5. Streams API 정상 작동 (200 OK)

### ⚠️ 남은 작업
1. **카카오 로그인 버튼 수정**
   - 문제: 버튼이 흐릿하고 클릭 불가
   - 원인: CSS `pointer-events: none` 또는 상위 요소 차단
   - 해결: `src/client/pages/LoginPage.tsx` 버튼 스타일 확인

2. **상품 상세페이지 데이터 로딩 수정**
   - 문제: `["product","22"] data is undefined` 오류
   - 원인: React Query 데이터 구조 불일치 또는 API 응답 구조 변경
   - 해결: `src/client/pages/ProductDetailPage.tsx` 데이터 접근 로직 수정

3. **DB 데이터 복구**
   - 문제: 더미 데이터만 존재, 실제 사용자 데이터 소실
   - 원인: DB 초기화 또는 마이그레이션 중 데이터 손실
   - 해결: Cloudflare D1 백업 확인 또는 새 데이터 등록

4. **`live_stream_products` 테이블 생성**
   - 문제: 테이블 미존재로 라이브-상품 연동 불가
   - 해결: 마이그레이션 SQL 실행
   ```sql
   CREATE TABLE IF NOT EXISTS live_stream_products (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     stream_id INTEGER NOT NULL,
     product_id INTEGER NOT NULL,
     display_order INTEGER DEFAULT 0,
     added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
     UNIQUE(stream_id, product_id)
   );
   ```

---

## 🔍 디버깅 가이드

### 1. 빌드 에러 발생 시
```bash
# 전체 빌드 로그 확인
npm run build 2>&1 | tee build.log

# Worker 빌드만 테스트
node scripts/build-worker.js

# Client 빌드만 테스트
npx vite build
```

### 2. 런타임 에러 확인
- **브라우저 콘솔**: https://live.ur-team.com (F12)
- **Cloudflare Workers 로그**: Cloudflare Dashboard → Workers & Pages → ur-live-working → Logs
- **Sentry**: https://sentry.io (설정된 경우)

### 3. API 엔드포인트 테스트
```bash
# Health Check
curl https://live.ur-team.com/api/health

# Products API
curl https://live.ur-team.com/api/products?limit=5

# Streams API
curl https://live.ur-team.com/api/streams?status=live

# Cart API (인증 필요)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://live.ur-team.com/api/cart
```

---

## 📋 환경변수 설정

### Cloudflare Pages 빌드 환경변수 (프론트엔드)
다음 환경변수들이 **빌드 타임에 주입**되어야 함:
```
VITE_REGION=KR
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://live.ur-team.com
VITE_FIREBASE_API_KEY=AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
VITE_FIREBASE_AUTH_DOMAIN=toss-live-commerce.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=toss-live-commerce
VITE_FIREBASE_STORAGE_BUCKET=toss-live-commerce.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=408717649003
VITE_FIREBASE_APP_ID=1:408717649003:web:29aa3cb5f92056dd1ec4f4
VITE_FIREBASE_MEASUREMENT_ID=G-78M73BGT77
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_JAVASCRIPT_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
VITE_SENTRY_DSN=https://...
VITE_SENTRY_ENVIRONMENT=production
```

### Cloudflare Pages 런타임 환경변수 (백엔드)
다음 환경변수들이 **Worker 실행 시** 필요:
```
ENVIRONMENT=production
FRONTEND_URL=https://live.ur-team.com
REGION=KR
JWT_SECRET=<비밀키>
KAKAO_REST_API_KEY=<카카오 REST API 키>
TOSS_SECRET_KEY=<토스 시크릿 키>
... (기타 비밀 환경변수)
```

---

## 🚀 배포 URL 확인

### 프로덕션
- **Main Domain**: https://live.ur-team.com
- **Cloudflare Pages**: https://ur-live-working.pages.dev

### 최신 배포 (Preview)
- **Preview URL**: https://90cc213e.toss-live-commerce.pages.dev
- **배포 시간**: 2026-03-17

---

## 📝 주요 파일 위치

### 빌드 관련
- `package.json` - 빌드 스크립트 정의
- `vite.config.ts` - Vite 빌드 설정
- `tsconfig.json` - TypeScript 설정 (Client)
- `tsconfig.worker.json` - TypeScript 설정 (Worker)
- `scripts/build-worker.js` - Worker 번들 빌드 스크립트
- `wrangler.toml` - Cloudflare Workers 설정

### Worker (백엔드)
- `src/worker/index.ts` - Worker 단일 진입점
- `src/worker/routes/*.ts` - 공용 API 라우트
- `src/features/*/api/*.ts` - 기능별 API 라우트
- `src/worker/middleware/*.ts` - 미들웨어

### Client (프론트엔드)
- `src/client/main.tsx` - React 앱 진입점
- `src/client/pages/*.tsx` - 페이지 컴포넌트
- `src/client/lib/api.ts` - API 클라이언트

### 배포
- `.github/workflows/main.yml` - GitHub Actions 워크플로우

---

## ⚠️ 주의사항

### 절대 하지 말아야 할 것
- ❌ 모듈화 구조 변경 (Worker 단일 진입점, feature routes 분리 구조)
- ❌ 타입 강화 (`any` 제거, strict 타입 추가 등)
- ❌ 로그 교체 (`console.log` → 로깅 라이브러리)
- ❌ 구조 리팩토링 (폴더 이동, 파일명 변경 등)
- ❌ 새 엔드포인트 추가 (기존 기능 복원 우선)

### 수정 시 주의사항
- ✅ 에러만 제거 (기능 추가 X)
- ✅ 모듈화 이전 기능대로 복원
- ✅ 테스트 후 커밋
- ✅ 변경사항은 최소화

---

## 📞 긴급 문의

### Cloudflare Dashboard
- **Account ID**: 1a2c006f0fb54894f81283a5ea787b83
- **Project**: ur-live-working
- **D1 Database**: toss-live-commerce-db

### GitHub Repository
- **Repo**: https://github.com/tobe2111/ur-live
- **Branch**: main

---

**최종 업데이트**: 2026-03-17
**작성자**: Claude AI Assistant
**문서 목적**: 긴급 복구 및 기본 기능 복원 가이드
