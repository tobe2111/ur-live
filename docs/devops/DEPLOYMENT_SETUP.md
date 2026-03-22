# 🚀 배포 설정 가이드

## 📋 프로젝트 구조

### Cloudflare Pages 프로젝트:
```
ur-live (메인 프로젝트)
├── 도메인: live.ur-team.com ✅
├── 도메인: ur-live.pages.dev
└── 상태: 프로덕션 활성

toss-live-commerce (사용 안 함)
├── 도메인: toss-live-commerce.pages.dev
└── 상태: 테스트/개발용 (삭제 가능)
```

### 왜 toss-live-commerce가 생겼나?
- 신규 프로젝트(ur-live-deploy)에서 배포하면서 자동 생성됨
- 글로벌 버전 복사본 작업 중 생긴 부산물
- **도메인이 연결되지 않아서 프로덕션에 영향 없음**

---

## ✅ 올바른 배포 방법

### 1. 수동 배포 (현재 방식)
```bash
cd /home/user/webapp
npm run deploy:prod
```

이 명령어가 자동으로:
- ✅ 빌드 (`npm run build`)
- ✅ `ur-live` 프로젝트에 배포
- ✅ `live.ur-team.com`에 즉시 반영

---

### 2. GitHub Actions 자동 배포 (설정 필요)

#### 현재 상태:
```
✅ 워크플로우 파일: .github/workflows/deploy.yml
✅ 프로젝트 설정: ur-live
❌ GitHub Secrets: 미설정
```

#### 설정 방법:

**Step 1: GitHub Secrets 추가**

https://github.com/tobe2111/ur-live/settings/secrets/actions

1. **New repository secret** 클릭

2. **CLOUDFLARE_API_TOKEN** 추가:
   ```
   Name: CLOUDFLARE_API_TOKEN
   Value: 1a0LHCdTDsr5zwQSsQd_x_DAWswECBk5-TXfnd4x
   ```

3. **CLOUDFLARE_ACCOUNT_ID** 추가:
   ```
   Name: CLOUDFLARE_ACCOUNT_ID
   Value: 1a2c006f0fb54894f81283a5ea787b83
   ```

**Step 2: 자동 배포 확인**

이제 `git push origin main`만 하면:
```
GitHub Actions 자동 실행
  ↓
빌드 (15분)
  ↓
ur-live 프로젝트에 배포
  ↓
live.ur-team.com 자동 업데이트 ✅
```

---

## 🔧 환경 변수 설정

### Cloudflare Dashboard에서 설정:

https://dash.cloudflare.com → Workers & Pages → ur-live → Settings → Environment variables

**Production 탭에 추가:**

```
JWT_SECRET=your-super-secret-jwt-key-change-in-production
TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
RESEND_API_KEY=re_joVyybjq_KmHKX5g2DmTdqfPBvnxBgyXF
EMAIL_FROM=noreply@ur-team.com
VITE_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm
KAKAO_JS_KEY=975a2e7f97254b08f15dba4d177a2865
```

---

## 📊 배포 흐름도

### 수동 배포:
```
코드 수정
  ↓
git commit & push
  ↓
npm run deploy:prod (로컬 실행)
  ↓
ur-live 프로젝트 배포
  ↓
live.ur-team.com 업데이트 (즉시)
```

### 자동 배포 (GitHub Secrets 설정 후):
```
코드 수정
  ↓
git push origin main
  ↓
GitHub Actions 트리거
  ↓
자동 빌드 & 배포
  ↓
live.ur-team.com 업데이트 (15분 후)
```

---

## 🎯 로컬 작업 + 자동 배포 설정

### 장점:
- ✅ 샌드박스 타임아웃 없음
- ✅ 로컬에서 빠른 개발
- ✅ Git push만 하면 자동 배포
- ✅ GitHub Actions로 빌드 로그 확인 가능

### 단점:
- ❌ 로컬 환경 설정 필요 (Node.js, Git)
- ❌ 배포 시간 15분 (GitHub Actions 빌드)
- ❌ AI 도움 받기 어려움

---

## 🗑️ toss-live-commerce 프로젝트 정리

### 필요 없는 이유:
- 도메인 연결 안 됨
- 메인 프로젝트는 `ur-live`
- 테스트/개발용으로만 사용됨

### 삭제 방법 (선택):
1. Cloudflare Dashboard 접속
2. Workers & Pages → toss-live-commerce
3. Settings → Delete project

**삭제해도 프로덕션(`ur-live`)에는 영향 없음**

---

## ⚠️ 중요 사항

### 배포 시 주의:
1. ✅ **항상 `ur-live` 프로젝트에 배포**
2. ✅ `npm run deploy:prod` 사용
3. ❌ `--project-name toss-live-commerce` 사용 금지

### Git 브랜치:
```
main (프로덕션)
  ↓
live.ur-team.com
```

---

## 📞 문제 해결

### Q1: 배포했는데 사이트가 안 바뀌어요
```
A: CDN 캐시 때문입니다.
- 강력 새로고침: Ctrl + Shift + R (Windows) / Cmd + Shift + R (Mac)
- 시크릿 모드로 확인
- 5~10분 대기
```

### Q2: GitHub Actions가 실패해요
```
A: GitHub Secrets를 확인하세요.
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
```

### Q3: 수동 배포가 느려요
```
A: GitHub Actions 자동 배포를 사용하세요.
- 로컬에서 빌드 불필요
- GitHub 서버에서 빌드
```

---

**작성일**: 2026-02-27  
**프로젝트**: ur-live  
**프로덕션 URL**: https://live.ur-team.com
