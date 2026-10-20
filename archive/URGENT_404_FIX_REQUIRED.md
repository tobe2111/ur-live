# 🚨 긴급: 전체 페이지 404 해결 방법

## 문제 상황
**모든 페이지에서 404 Not Found 발생**

## 근본 원인 ⚠️

Cloudflare Pages가 **잘못된 디렉토리에서 배포**되고 있습니다:

```
현재 배포: dist/ 디렉토리
  ├── _worker.js
  ├── _routes.json
  └── (웹사이트 파일 없음! ❌)

실제 파일 위치: dist/client/ 디렉토리
  ├── index.html ✅
  ├── assets/ ✅
  ├── _worker.js ✅
  └── _routes.json ✅
```

## 즉시 해결 방법 🔧

### 옵션 1: GitHub Actions를 통한 자동 배포 (권장) ✨

1. **GitHub Actions 워크플로가 이미 올바르게 설정되어 있습니다!**
   ```yaml
   # .github/workflows/main.yml (51번째 줄)
   - name: Deploy to Cloudflare Pages
     run: npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
   ```

2. **Git push만 하면 자동으로 올바른 디렉토리로 배포됩니다:**
   ```bash
   cd /home/user/webapp
   git push origin main
   ```

3. **배포 확인:**
   - GitHub → Actions 탭에서 진행 상황 확인
   - 완료 후 https://live.ur-team.com 접속 테스트

### 옵션 2: Cloudflare 대시보드에서 수동 배포

**Cloudflare API Token이 만료되어 CLI 배포가 불가능합니다.**

따라서 대시보드를 통한 수동 배포가 필요합니다:

1. https://dash.cloudflare.com/ 접속
2. **Pages** → **ur-live** 프로젝트 선택
3. **Create deployment** 버튼 클릭
4. **Production** 브랜치 선택
5. 파일 업로드:
   - 로컬 `dist/client/` 디렉토리의 모든 파일 선택
   - 또는 GitHub repository에서 직접 배포

### 옵션 3: 새 API Token 발급 후 CLI 배포

1. **Cloudflare 대시보드에서 새 API Token 생성:**
   - https://dash.cloudflare.com/profile/api-tokens
   - **Create Token** → **Edit Cloudflare Workers** 템플릿 선택
   - 또는 **Custom Token** 생성:
     - **Account** → **Cloudflare Pages** → **Edit** 권한
     - **Account Resources** → 해당 계정 선택

2. **Token을 환경 변수에 설정:**
   ```bash
   export CLOUDFLARE_API_TOKEN="새로_발급받은_토큰"
   export CLOUDFLARE_ACCOUNT_ID="1a2c006f0fb54894f81283a5ea787b83"
   ```

3. **배포 실행:**
   ```bash
   cd /home/user/webapp
   npm run build
   npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
   ```

## 현재 상태 확인 ✅

### 해결된 사항:
- ✅ `.env.production` Firebase API 키 수정 완료
  - **이전**: `AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM` (toss-live-commerce) ❌
  - **현재**: `AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s` (urteam-live-commerce) ✅

- ✅ Cloudflare Pages 환경 변수 설정 완료 (27개)
  - 모든 `VITE_*` 프론트엔드 변수 추가됨
  - Firebase, Kakao, Toss, Sentry 설정 완료

- ✅ 빌드 파일에 올바른 API 키 포함 확인
  ```javascript
  VITE_FIREBASE_API_KEY:"AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"
  ```

- ✅ GitHub Actions 워크플로 올바르게 설정됨
  - `dist/client` 디렉토리를 정확히 배포하도록 설정

### 아직 해결되지 않은 사항:
- ❌ **배포 디렉토리 문제**: 이전 배포가 `dist/`를 사용했고, 최신 배포가 적용되지 않음
- ⚠️ **Cloudflare API Token 만료**: CLI 배포 불가능

## 권장 조치 🎯

**가장 빠르고 확실한 방법:**

1. **Git Push (자동 배포)**
   ```bash
   cd /home/user/webapp
   git push origin main
   ```

2. **GitHub Actions 확인**
   - https://github.com/tobe2111/ur-live/actions
   - "Deploy to Cloudflare Pages" 워크플로 실행 확인
   - 완료까지 약 3-5분 소요

3. **배포 완료 후 테스트**
   - https://live.ur-team.com 접속
   - 브라우저 캐시 완전 삭제 (Ctrl+Shift+Delete)
   - 또는 시크릿 모드로 접속
   - 콘솔에서 API 키 확인:
     ```javascript
     console.log(import.meta.env.VITE_FIREBASE_API_KEY)
     // 출력: "AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"
     ```

4. **카카오 로그인 테스트**
   - "카카오로 로그인" 클릭
   - OAuth 인증 완료
   - `auth/api-key-not-valid` 오류 없이 정상 로그인 확인

## 검증 체크리스트 📋

배포 후 다음 사항을 확인하세요:

- [ ] 메인 페이지 (`https://live.ur-team.com/`) 정상 로드
- [ ] 404 오류 해결 확인
- [ ] 브라우저 콘솔에서 올바른 Firebase API 키 확인
- [ ] 카카오 로그인 정상 작동
- [ ] `auth/api-key-not-valid` 오류 없음
- [ ] 사용자 인증 흐름 정상 동작
- [ ] 모든 정적 리소스 (CSS, JS, 이미지) 로드 확인

## 기술적 세부사항 📝

### 빌드 구조
```
dist/
├── _worker.js          (570 KB)
├── _routes.json        (49 bytes)
└── client/             ← 🎯 이 디렉토리를 배포해야 함!
    ├── _worker.js      (복사본)
    ├── _routes.json    (복사본)
    ├── index.html
    ├── assets/
    │   ├── index-C5f_vRgc.js  (640 KB, gzipped 202 KB)
    │   └── [기타 번들 파일들...]
    ├── locales/
    ├── static/
    └── [기타 HTML 페이지들...]
```

### 환경 변수 (27개)
**프론트엔드 (17개 VITE_*):**
- VITE_API_BASE_URL
- VITE_REGION, VITE_DEFAULT_LANGUAGE
- VITE_FIREBASE_* (8개)
- VITE_KAKAO_* (3개)
- VITE_TOSS_CLIENT_KEY
- VITE_SENTRY_* (2개)

**백엔드 (10개):**
- FIREBASE_*, JWT_SECRET, REFRESH_TOKEN_SECRET
- KAKAO_REST_API_KEY, TOSS_SECRET_KEY

## 문제 해결 히스토리 📚

1. **초기 문제**: `auth/api-key-not-valid` 오류
2. **원인 1**: `.env` 파일에 잘못된 Firebase API 키
3. **해결 1**: `.env` 수정
4. **원인 2**: `.env.production`이 `.env`를 오버라이드함
5. **해결 2**: `.env.production` 수정 및 재빌드
6. **원인 3**: Cloudflare Pages 환경 변수 누락
7. **해결 3**: 27개 환경 변수 추가
8. **원인 4**: 빌드에 여전히 잘못된 API 키 포함
9. **해결 4**: 클린 빌드 실행, API 키 확인
10. **현재 문제**: 배포 디렉토리 불일치로 전체 페이지 404

## 추가 참고 자료 📖

- **Cloudflare Pages 문서**: https://developers.cloudflare.com/pages/
- **Wrangler CLI 문서**: https://developers.cloudflare.com/workers/wrangler/
- **Firebase API Key 관리**: https://firebase.google.com/docs/projects/api-keys

---

**작성일**: 2026-03-18 13:50 KST  
**우선순위**: 🔴 긴급 (CRITICAL)  
**예상 해결 시간**: 5분 (Git push 방식) 또는 10분 (수동 배포)  
**담당**: DevOps / 배포 관리자  
**상태**: ⏳ 조치 대기 중

---

## 요약

**해야 할 일**: `git push origin main` 실행하여 GitHub Actions를 통해 자동 배포

**결과**: 404 문제 해결, Firebase API 키 정상 작동, 카카오 로그인 가능

**검증**: https://live.ur-team.com 접속 및 로그인 테스트
