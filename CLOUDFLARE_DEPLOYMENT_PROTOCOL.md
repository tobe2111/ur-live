# 🚀 Cloudflare 배포 프로토콜 (필수 준수)

## ⚠️ 중요: 환경변수 변경 시 필수 작업

**모든 Cloudflare Secret(환경변수) 변경 시 반드시 아래 프로토콜을 따라야 합니다.**

---

## 📋 배포 프로토콜

### 1️⃣ 환경변수 변경이 필요한 경우

다음과 같은 상황에서는 **반드시** Cloudflare Secret 업데이트가 필요합니다:

- ✅ 결제 시스템 키 변경 (TossPayments, NicePay 등)
- ✅ OAuth 클라이언트 시크릿 변경 (Kakao, Naver 등)
- ✅ API 키 변경 (Firebase, AWS 등)
- ✅ 데이터베이스 연결 정보 변경
- ✅ 기타 민감한 정보 변경

### 2️⃣ 필수 작업 순서

#### Step 1: Secret 업데이트
```bash
# 프로젝트 디렉토리로 이동
cd /home/user/webapp

# Secret 업데이트 (대화형)
npx wrangler pages secret put SECRET_NAME --project-name toss-live-commerce

# 또는 파이프라인 방식
echo "your_secret_value" | npx wrangler pages secret put SECRET_NAME --project-name toss-live-commerce
```

#### Step 2: Secret 확인
```bash
# 등록된 Secret 목록 확인
npx wrangler pages secret list --project-name toss-live-commerce
```

#### Step 3: 빌드
```bash
# 프로젝트 빌드 (필수!)
cd /home/user/webapp && npm run build
```

#### Step 4: 재배포
```bash
# Cloudflare Pages에 재배포 (필수!)
cd /home/user/webapp && npx wrangler pages deploy dist --project-name toss-live-commerce
```

#### Step 5: 배포 확인
```bash
# 배포 URL 확인
# Preview URL: https://[deployment-id].toss-live-commerce.pages.dev
# Production URL: https://live.ur-team.com

# API 테스트 (예시)
curl https://live.ur-team.com/api/health
```

---

## 🔑 현재 등록된 Secrets

### 결제 시스템
- `TOSS_SECRET_KEY` - 토스페이먼츠 결제위젯 시크릿 키
  - 값: `test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY` (결제위젯 전용)
  - 용도: 결제 승인 API (`/api/payments/confirm`)
  - **주의:** `test_gck_*`와 반드시 페어링 필요

### OAuth 인증
- `KAKAO_CLIENT_SECRET` - 카카오 로그인 클라이언트 시크릿
  - 용도: 카카오 OAuth 토큰 발급

---

## 📝 예시: TOSS_SECRET_KEY 변경

### ❌ 잘못된 방법
```bash
# Secret만 업데이트하고 재배포 안 함
echo "test_gsk_new_key" | npx wrangler pages secret put TOSS_SECRET_KEY
# ❌ 배포 안 함 → 변경사항 반영 안됨!
```

### ✅ 올바른 방법
```bash
# 1. Secret 업데이트
echo "test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY" | \
  npx wrangler pages secret put TOSS_SECRET_KEY --project-name toss-live-commerce

# 2. 빌드
cd /home/user/webapp && npm run build

# 3. 재배포
cd /home/user/webapp && npx wrangler pages deploy dist --project-name toss-live-commerce

# 4. 테스트
curl https://live.ur-team.com/api/health
```

---

## 🚨 중요: 왜 재배포가 필수인가?

### Cloudflare Pages/Workers 동작 방식
```
코드 변경 없이 Secret만 변경
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Secret 업데이트 → Cloudflare KV에 저장됨
2. 기존 Worker는 여전히 실행 중 (캐시된 버전)
3. Worker는 재배포하기 전까지 새로운 Secret을 읽지 않음!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
결과: Secret 변경 적용 안됨! ❌
```

### 재배포 후
```
Secret 업데이트 + 재배포
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Secret 업데이트 → Cloudflare KV에 저장됨
2. 재배포 → 새로운 Worker 인스턴스 생성
3. 새로운 Worker가 업데이트된 Secret을 읽어옴
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
결과: Secret 변경 적용됨! ✅
```

---

## 🎯 체크리스트

배포 전 반드시 확인:

- [ ] Secret이 올바르게 업데이트되었는가?
- [ ] `npm run build` 실행했는가?
- [ ] `wrangler pages deploy` 실행했는가?
- [ ] 배포 URL이 정상적으로 생성되었는가?
- [ ] API 엔드포인트가 정상 작동하는가?

---

## 📚 참고: package.json 스크립트

```json
{
  "scripts": {
    "build": "vite build",
    "deploy": "npm run build && wrangler pages deploy dist",
    "deploy:prod": "npm run build && wrangler pages deploy dist --project-name toss-live-commerce",
    "secret:list": "wrangler pages secret list --project-name toss-live-commerce",
    "secret:delete": "wrangler pages secret delete --project-name toss-live-commerce"
  }
}
```

---

## 🔄 자동 배포 워크플로우 (추후 구현)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy dist --project-name toss-live-commerce
```

---

## 📞 문제 해결

### Secret이 적용되지 않을 때
```bash
# 1. Secret 재등록
echo "your_secret_value" | npx wrangler pages secret put SECRET_NAME --project-name toss-live-commerce

# 2. 캐시 클리어 빌드
rm -rf dist .wrangler node_modules/.vite
npm run build

# 3. 강제 재배포
npx wrangler pages deploy dist --project-name toss-live-commerce --commit-dirty=true

# 4. 배포 확인
npx wrangler pages deployment list --project-name toss-live-commerce | head -5
```

### Secret 삭제가 필요할 때
```bash
# Secret 삭제
npx wrangler pages secret delete SECRET_NAME --project-name toss-live-commerce

# 재등록
echo "new_value" | npx wrangler pages secret put SECRET_NAME --project-name toss-live-commerce

# 재배포 (필수!)
npm run deploy:prod
```

---

## ✅ 결론

**"환경변수 변경 = 반드시 재배포"**

이 원칙을 지키지 않으면:
- ❌ INVALID_API_KEY 에러
- ❌ 인증 실패
- ❌ 결제 실패
- ❌ API 호출 실패

**반드시 기억하세요:**
1. Secret 업데이트
2. 빌드 (`npm run build`)
3. 재배포 (`wrangler pages deploy`)
4. 테스트!

---

**작성일:** 2026-02-13  
**마지막 업데이트:** 2026-02-13  
**작성자:** UR Team Dev
