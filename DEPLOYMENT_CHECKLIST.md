# 🚀 배포 체크리스트 (Deployment Checklist)

## ⚠️ **배포 전 필수 확인**

### 1️⃣ **Cloudflare Pages Secrets 확인**

```bash
# Secret 목록 확인
npx wrangler pages secret list --project-name ur-live

# 필수 Secret 확인 항목:
□ TOSS_SECRET_KEY (토스페이먼츠 시크릿 키)
```

**Secret이 없으면 추가:**
```bash
# TOSS_SECRET_KEY 추가 (테스트용)
echo "test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY" | npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live

# TOSS_SECRET_KEY 추가 (프로덕션용 - 실제 키 사용)
echo "live_gsk_YOUR_ACTUAL_KEY" | npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
```

---

### 2️⃣ **로컬 빌드 테스트**

```bash
# 빌드 성공 확인
npm run build

# 빌드 파일 확인
ls -lh dist/_worker.js
ls -lh dist/assets/
```

---

### 3️⃣ **D1 마이그레이션 확인**

```bash
# 로컬 DB에 적용된 마이그레이션 확인
npx wrangler d1 migrations list toss-live-commerce-db --local

# 프로덕션 DB에 적용된 마이그레이션 확인
npx wrangler d1 migrations list toss-live-commerce-db --remote

# 새 마이그레이션이 있으면 적용
npx wrangler d1 migrations apply toss-live-commerce-db --remote
```

---

### 4️⃣ **Git 커밋 상태 확인**

```bash
# 모든 변경사항 커밋 확인
git status

# 마지막 커밋 확인
git log -1 --oneline
```

---

### 5️⃣ **배포 실행**

```bash
# GitHub에 푸시
git push origin main

# Cloudflare Pages에 배포
npx wrangler pages deploy dist --project-name ur-live
```

---

### 6️⃣ **배포 후 검증**

```bash
# 배포 URL 확인 (Cloudflare 응답에서 확인)
# 예: https://xxxxx.ur-live.pages.dev

# 1. 메인 페이지 확인
curl -I https://live.ur-team.com

# 2. API 헬스 체크 (있다면)
curl https://live.ur-team.com/api/streams

# 3. 인증 필요한 API 테스트 (브라우저에서)
# - 로그인 테스트
# - 결제 테스트
# - 장바구니 추가 테스트
```

---

## 🔴 **자주 발생하는 문제 및 해결**

### 문제 1: 결제 시 400 에러
```bash
❌ 증상: POST /api/payments/confirm 400 Bad Request
✅ 원인: TOSS_SECRET_KEY가 설정되지 않음
✅ 해결:
npx wrangler pages secret list --project-name ur-live | grep TOSS_SECRET_KEY
# 없으면 위의 1️⃣ 단계 실행
```

### 문제 2: 로그인 후 401 에러
```bash
❌ 증상: 로그인 성공 → API 호출 시 401 Unauthorized
✅ 원인: SESSION_KV에 세션 저장 안 됨
✅ 해결: AUTH_SYSTEM_LOCK.md 참고하여 인증 로직 확인
```

### 문제 3: 데이터베이스 에러
```bash
❌ 증상: no such table: xxx
✅ 원인: 마이그레이션이 프로덕션에 적용 안 됨
✅ 해결:
npx wrangler d1 migrations apply toss-live-commerce-db --remote
```

### 문제 4: 정적 파일 404
```bash
❌ 증상: /static/app.js 404 Not Found
✅ 원인: 빌드 시 파일이 누락됨
✅ 해결: npm run build 다시 실행 후 dist/ 확인
```

---

## 📋 **체크리스트 요약**

배포 전에 이 항목들을 순서대로 확인하세요:

- [ ] 1. Cloudflare Secrets 확인 (`TOSS_SECRET_KEY`)
- [ ] 2. 로컬 빌드 성공 (`npm run build`)
- [ ] 3. D1 마이그레이션 확인 (필요 시 적용)
- [ ] 4. Git 커밋 완료 (`git status`)
- [ ] 5. GitHub 푸시 (`git push origin main`)
- [ ] 6. Cloudflare Pages 배포 (`wrangler pages deploy`)
- [ ] 7. 배포 URL 확인
- [ ] 8. 주요 기능 테스트 (로그인, 결제, 장바구니)

---

## 🎯 **배포 자동화 스크립트 (선택 사항)**

`deploy.sh` 파일을 만들어 사용하면 편리합니다:

```bash
#!/bin/bash
set -e  # 에러 발생 시 중단

echo "🚀 UR-Live 배포 시작..."

echo "1️⃣ Secrets 확인..."
if ! npx wrangler pages secret list --project-name ur-live | grep TOSS_SECRET_KEY > /dev/null; then
    echo "❌ TOSS_SECRET_KEY가 설정되지 않았습니다!"
    echo "실행: echo 'YOUR_KEY' | npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live"
    exit 1
fi
echo "✅ Secrets 확인 완료"

echo "2️⃣ 빌드 중..."
npm run build
echo "✅ 빌드 완료"

echo "3️⃣ Git 푸시..."
git push origin main
echo "✅ Git 푸시 완료"

echo "4️⃣ Cloudflare Pages 배포 중..."
npx wrangler pages deploy dist --project-name ur-live
echo "✅ 배포 완료"

echo ""
echo "🎉 배포 성공!"
echo "📍 URL: https://live.ur-team.com"
```

사용법:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📚 **관련 문서**

- `AUTH_SYSTEM_LOCK.md` - 인증 시스템 설정 (절대 변경 금지)
- `WHY_PROBLEMS_REPEAT.md` - 문제 반복 원인 및 해결책
- `README.md` - 프로젝트 전체 문서
- `wrangler.jsonc` - Cloudflare 설정

---

**마지막 업데이트**: 2026-02-20  
**작성자**: Claude (AI Assistant)
