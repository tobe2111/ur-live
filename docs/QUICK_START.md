# 🚀 자동 듀얼 배포 - 빠른 시작 가이드

## ⏱️ 36분이면 끝!

```
┌─────────────────────────────────────────────────────────────┐
│                  자동 배포 시스템 설정                        │
│                                                             │
│  git push origin main                                       │
│         ↓                                                   │
│  6분 후 자동 배포 완료! ✅                                   │
│         ↓                                                   │
│  ✅ live.ur-team.com (KR)                                   │
│  ✅ world.ur-team.com (GLOBAL)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 **설정 체크리스트**

### ☑️ 1단계: Cloudflare API 토큰 (5분)
```
Cloudflare Dashboard
→ My Profile → API Tokens
→ Create Token

필요한 것:
✅ API Token
✅ Account ID
```

### ☑️ 2단계: GitHub Secrets (2분)
```
GitHub Repository → Settings → Secrets

추가할 것:
✅ CLOUDFLARE_API_TOKEN
✅ CLOUDFLARE_ACCOUNT_ID
```

### ☑️ 3단계: KR 프로젝트 (10분)
```
Cloudflare → Workers & Pages → Create

설정:
✅ 프로젝트명: ur-live-kr
✅ 환경 변수: 12개
✅ 도메인: live.ur-team.com
```

### ☑️ 4단계: GLOBAL 프로젝트 (10분)
```
Cloudflare → Workers & Pages → Create

설정:
✅ 프로젝트명: ur-live-global
✅ 환경 변수: 10개
✅ 도메인: world.ur-team.com
```

### ☑️ 5단계: 워크플로우 추가 (3분)
```
GitHub → .github/workflows/ → Create file

파일명: dual-deploy.yml
내용: 워크플로우 코드 복사
```

### ☑️ 6단계: 테스트 (6분)
```
GitHub Actions → 최신 Run 확인
→ 모든 Job 성공 ✅
→ 사이트 접속 확인
```

---

## 🎯 **상세 가이드 위치**

### 단계별 상세 설명
```bash
cat /home/user/webapp/SETUP_STEP_BY_STEP.md
```
또는
https://github.com/tobe2111/ur-live/blob/main/SETUP_STEP_BY_STEP.md

### 기술 문서
```bash
cat /home/user/webapp/AUTOMATIC_DUAL_DEPLOYMENT_GUIDE.md
```

---

## 🔑 **필수 정보**

### Cloudflare 프로젝트명
```
KR:     ur-live-kr
GLOBAL: ur-live-global
```

### 도메인
```
KR:     live.ur-team.com
GLOBAL: world.ur-team.com
```

### 환경 변수 개수
```
KR:     12개 (Firebase 8 + Kakao 3 + Toss 1)
GLOBAL: 10개 (Firebase 8 + Google 1 + Stripe 1)
```

---

## ⚡ **빠른 명령어**

### 로컬에서 빌드 테스트
```bash
# KR 빌드
npm run build:kr

# GLOBAL 빌드
npm run build:global
```

### 워크플로우 파일 확인
```bash
cat .github/workflows/dual-deploy.yml
```

### 첫 배포
```bash
git add .
git commit -m "feat: Enable auto deployment"
git push origin main

# GitHub Actions에서 확인:
# https://github.com/tobe2111/ur-live/actions
```

---

## 📊 **예상 시간표**

```
시작: 00:00
  ↓
1단계 (API 토큰): 00:00 ~ 00:05
  ↓
2단계 (Secrets): 00:05 ~ 00:07
  ↓
3단계 (KR 프로젝트): 00:07 ~ 00:17
  ↓
4단계 (GLOBAL 프로젝트): 00:17 ~ 00:27
  ↓
5단계 (워크플로우): 00:27 ~ 00:30
  ↓
6단계 (테스트): 00:30 ~ 00:36
  ↓
완료: 00:36 ✅
```

---

## ❓ **빠른 문제 해결**

### API 토큰이 작동하지 않음
```
→ 권한 확인: Cloudflare Pages Edit
→ Account ID 재확인
```

### 배포가 실패함
```
→ GitHub Actions 로그 확인
→ 환경 변수 누락 체크
→ 프로젝트명 오타 확인
```

### 사이트가 안 열림
```
→ DNS 설정 확인 (24시간 소요 가능)
→ Cloudflare Dashboard에서 도메인 상태 확인
```

---

## 🎉 **완료 후**

### 사용법
```bash
# 1. 코드 수정
vim src/pages/HomePage.tsx

# 2. 커밋 & 푸시
git add .
git commit -m "feat: Update"
git push origin main

# 3. 6분 후 자동 배포 완료! ✅
```

### 배포 확인
```
GitHub: https://github.com/tobe2111/ur-live/actions
KR 사이트: https://live.ur-team.com
GLOBAL 사이트: https://world.ur-team.com
```

---

## 📚 **전체 문서 목록**

1. **SETUP_STEP_BY_STEP.md** ⭐ (지금 따라하기)
   - 36분 완료 가이드
   - 모든 단계 상세 설명

2. **AUTOMATIC_DUAL_DEPLOYMENT_GUIDE.md**
   - 기술 문서
   - 시스템 아키텍처

3. **DUAL_DEPLOYMENT_COMPLETE.md**
   - 완료 보고서
   - 설정 체크리스트

4. **QUICK_START.md** (이 파일)
   - 빠른 참조 가이드

---

**📍 시작하기**: `SETUP_STEP_BY_STEP.md` 파일 열기  
**📍 소요 시간**: 36분  
**📍 난이도**: ⭐⭐⭐ (중간)

지금 바로 시작하세요! 🚀
