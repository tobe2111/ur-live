# ur-live 프로젝트 사용 가이드

## ✅ 현재 상황
- GitHub 저장소: `tobe2111/ur-live` ✅
- 최신 커밋: `ba0ad895` (Firebase 환경변수 관련) ✅
- 사용할 프로젝트: **ur-live** ✅

---

## 📋 Step 1: ur-live 프로젝트 확인

### Cloudflare Dashboard 접속
```
https://dash.cloudflare.com/
→ Workers & Pages
→ ur-live 선택
```

### 확인 사항
1. **GitHub 연결 상태**
   - Settings → Builds & deployments
   - Repository: `tobe2111/ur-live` 연결 확인
   
2. **최신 배포 상태**
   - Deployments 탭
   - 최신 배포가 Success 상태인지 확인
   - 배포 시간 확인

---

## 📋 Step 2: DNS 레코드 확인 및 정리

### DNS 페이지 이동
```
Cloudflare Dashboard
→ Websites (왼쪽 메뉴)
→ ur-team.com
→ DNS
→ Records
```

### live 관련 레코드 확인
현재 상태를 확인하세요:

#### 케이스 A: live 레코드가 없음
→ 바로 Step 3로

#### 케이스 B: live 레코드가 있음 (ur-live-working 관련)
```
Type: CNAME
Name: live
Content: ur-live-working.pages.dev
```
→ **Delete** 버튼 클릭하여 삭제
→ 2분 대기

#### 케이스 C: live 레코드가 있음 (ur-live 관련)
```
Type: CNAME
Name: live
Content: ur-live.pages.dev
```
→ 이미 올바르게 연결됨! Step 4로

---

## 📋 Step 3: ur-live에 도메인 연결

### Custom domains 페이지
```
Workers & Pages
→ ur-live
→ Custom domains
```

### 도메인 추가
1. **Set up a custom domain** 버튼 클릭
2. **live.ur-team.com** 입력
3. **Continue** 클릭
4. **Activate domain** 클릭

Cloudflare가 자동으로 DNS 레코드를 생성합니다.

---

## 📋 Step 4: 환경변수 확인

### Environment variables 페이지
```
Workers & Pages
→ ur-live
→ Settings
→ Environment variables
→ Production
```

### 확인할 변수들

#### 🔥 Firebase 프론트엔드 (VITE_*) - 8개
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_DATABASE_URL
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_MEASUREMENT_ID

#### 🔥 Firebase 백엔드 - 5개
- FIREBASE_API_KEY
- FIREBASE_CLIENT_EMAIL
- FIREBASE_DATABASE_URL
- FIREBASE_PRIVATE_KEY
- FIREBASE_SERVICE_ACCOUNT_KEY

#### 🟡 Kakao - 3개
- KAKAO_REST_API_KEY
- VITE_KAKAO_APP_KEY
- VITE_KAKAO_JAVASCRIPT_KEY
- VITE_KAKAO_REST_API_KEY

#### 💳 Toss - 2개
- TOSS_SECRET_KEY
- VITE_TOSS_CLIENT_KEY

#### 🔑 JWT - 2개
- JWT_SECRET
- REFRESH_TOKEN_SECRET

#### ⚙️ 기타 - 5개
- ENVIRONMENT
- REGION
- FRONTEND_URL
- VITE_API_BASE_URL
- VITE_REGION

**총 약 25-30개 환경변수가 있어야 합니다.**

### ⚠️ 만약 환경변수가 없거나 부족하면
→ .env 파일의 값을 참고하여 추가 필요
→ 특히 Firebase 관련 변수가 가장 중요!

---

## 📋 Step 5: 재배포 (환경변수 추가/수정한 경우)

환경변수를 추가하거나 수정했다면:

```
Deployments 탭
→ 최신 배포 옆의 ⋮ (점 3개)
→ Retry deployment
→ 3-5분 대기
```

---

## 📋 Step 6: 테스트

### 브라우저 캐시 삭제 후 테스트
```
1. Ctrl + Shift + R (강력 새로고침)
   또는
2. 시크릿 모드 (Ctrl + Shift + N)
```

### 로그인 테스트
```
https://live.ur-team.com/login
→ 카카오 로그인 버튼 클릭
→ 로그인 진행
→ 프로필 페이지 로드 확인
```

### 확인 사항
- ✅ Firebase API key 에러 없음
- ✅ 카카오 로그인 성공
- ✅ 프로필 페이지 정상 로드
- ✅ 상품 페이지 정상 작동
- ✅ 라이브 페이지 접속 가능

---

## 🔍 문제 발생 시

### 문제 1: Firebase API key 에러
→ Environment variables의 Firebase 관련 변수 확인
→ 특히 VITE_FIREBASE_API_KEY 값 확인

### 문제 2: 도메인 연결 안 됨
→ DNS Records에서 live 레코드 확인
→ CNAME이 ur-live.pages.dev를 가리키는지 확인

### 문제 3: 구버전 페이지 로드
→ Cloudflare 캐시 삭제:
  Websites → ur-team.com → Caching → Purge Everything
→ 브라우저 강력 새로고침

### 문제 4: 환경변수가 반영 안 됨
→ 환경변수 수정 후 반드시 Retry deployment
→ 빌드 시간 약 3-5분 소요

---

## 📊 예상 소요 시간

| 단계 | 시간 |
|------|------|
| ur-live 프로젝트 확인 | 2분 |
| DNS 레코드 정리 | 3분 |
| 도메인 연결 | 2분 |
| 환경변수 확인 | 5분 |
| 재배포 (필요시) | 3-5분 |
| 테스트 | 2분 |
| **총합** | **15-20분** |

---

## ✅ 성공 체크리스트

- [ ] ur-live 프로젝트 확인 완료
- [ ] DNS 레코드 정리 완료
- [ ] live.ur-team.com 도메인 연결 완료
- [ ] 환경변수 확인 완료
- [ ] 배포 완료 (Success 상태)
- [ ] 로그인 테스트 성공
- [ ] 모든 기능 정상 작동

---

## 🚀 다음 단계 (성공 후)

1. **ur-live-working 정리**
   - Custom domains 제거
   - 프로젝트 삭제 (선택)

2. **최종 테스트**
   - 모든 페이지 점검
   - 카카오 로그인
   - 상품 조회
   - 라이브 스트리밍
   - 결제 기능

3. **문서 정리**
   - 환경변수 목록 최신화
   - 배포 가이드 업데이트

---

**작성일**: 2026-03-18
**상태**: ur-live 프로젝트로 복귀 진행 중
