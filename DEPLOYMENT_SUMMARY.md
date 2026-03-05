# 🚀 배포 요약 - Week 2 완료

## 📊 최종 상태

### Git 커밋
- **Latest Commit**: `685be74` - docs: Add Week 2 completion report
- **Previous**: `6838eaf` - feat(week2): Add Google Auth, Products API, Orders API separation
- **Repository**: https://github.com/tobe2111/ur-live

### 파일 통계
- **Feature 파일 수**: 17개 TypeScript 파일
- **Worker 번들**: 84 KB (목표: <100 MB ✅)
- **Main 번들**: ~1.8 MB

---

## 🏗️ 로컬 터미널 배포 방법

### 1️⃣ 사전 준비
```bash
# wrangler CLI 설치
npm install -g wrangler

# 프로젝트 클론 (처음 한 번만)
git clone https://github.com/tobe2111/ur-live.git
cd ur-live
npm install
```

### 2️⃣ Cloudflare 로그인 (처음 한 번만)
```bash
# 브라우저에서 자동 로그인
wrangler login

# 로그인 확인
wrangler whoami
```

### 3️⃣ 빌드 & 배포
```bash
# KR 버전 (Kakao + Toss)
npm run build:kr
wrangler pages deploy dist --project-name=ur-live --branch=main

# GLOBAL 버전 (Google + Stripe)
npm run build:global
wrangler pages deploy dist-global --project-name=ur-live-global --branch=main
```

### 4️⃣ 배포 확인
```bash
# 사이트 접속
curl -I https://live.ur-team.com/

# Worker 헬스체크
curl https://live.ur-team.com/health | jq

# 예상 출력:
# {
#   "status": "ok",
#   "worker": "ur-live-worker-v2.1",
#   "features": ["auth-kakao", "auth-google", "products", "orders"],
#   "region": "KR"
# }
```

---

## 📋 빠른 배포 명령어 (원라이너)

```bash
# KR 배포 (한 줄)
npm run build:kr && wrangler pages deploy dist --project-name=ur-live --branch=main

# GLOBAL 배포 (한 줄)
npm run build:global && wrangler pages deploy dist-global --project-name=ur-live-global --branch=main
```

---

## 🔧 트러블슈팅

### 문제: `wrangler: command not found`
```bash
# 해결: npx 사용
npx wrangler pages deploy dist --project-name=ur-live
```

### 문제: 404 에러 (SPA 라우팅)
```bash
# 해결: _redirects 파일 확인
echo "/* /index.html 200" > dist/_redirects
wrangler pages deploy dist --project-name=ur-live
```

### 문제: 빌드 실패
```bash
# 해결: 캐시 삭제 후 재빌드
rm -rf node_modules dist dist-global .vite
npm install
npm run build:kr
```

---

## 📊 배포 시간

| 단계 | 시간 |
|------|------|
| 빌드 | 20-30초 |
| 배포 | 30-60초 |
| CDN 전파 | 1-2분 |
| **총 시간** | **2-4분** |

---

## 🎯 Week 2 완료 항목

- ✅ Google Auth 분리 (`google.routes.ts`, `GoogleAuthService.ts`)
- ✅ Products API 분리 (`products.routes.ts`, `ProductService.ts`, `ProductRepository.ts`)
- ✅ Orders API 분리 (`orders.routes.ts`, `OrderService.ts`, `OrderRepository.ts`)
- ✅ Tree-shaking 보장 (KR 빌드에서 Stripe 제외)
- ✅ 로컬 배포 문서 작성 (`LOCAL_DEPLOYMENT.md`)
- ✅ Git 커밋 & 푸시
- ✅ GitHub Actions 배포 트리거

---

## 🔗 링크

- **GitHub**: https://github.com/tobe2111/ur-live
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **KR 프로덕션**: https://live.ur-team.com
- **상세 문서**: `LOCAL_DEPLOYMENT.md`, `WEEK2_COMPLETION_REPORT.md`

---

**작성일**: 2026-03-05  
**버전**: 2.1.0
