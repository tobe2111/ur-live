# 🚨 긴급 수정: live.ur-team.com 404 에러 해결

## 📅 2026-03-05

---

## 🔴 **문제 상황**

```
1. live.ur-team.com 접속 → 404 Error
2. KAKAO_REST_API_KEY is required 에러
3. /user/profile 경로 404
```

---

## 🔍 **문제 원인 분석**

### 1. Cloudflare Pages 프로젝트 상태 확인 필요

현재 `live.ur-team.com`이 어떤 Cloudflare Pages 프로젝트에 연결되어 있는지 확인이 필요합니다.

**가능한 시나리오:**

#### A) 프로젝트가 아직 없음
```
→ Cloudflare Pages 프로젝트가 생성되지 않음
→ 또는 이름이 다름
```

#### B) 환경 변수 미설정
```
→ 프로젝트는 있지만 환경 변수가 없음
→ KAKAO_REST_API_KEY 등이 설정되지 않음
```

#### C) 잘못된 빌드 배포됨
```
→ 오래된 빌드가 배포됨
→ 환경 변수 검증 실패로 빌드 중단
```

---

## ✅ **해결 방법**

### 1단계: Cloudflare Dashboard 확인

```
1. https://dash.cloudflare.com/ 접속
2. Workers & Pages 메뉴 클릭
3. 현재 프로젝트 목록 확인

확인할 것:
- "ur-live" 또는 "ur-live-kr" 프로젝트 존재 여부
- live.ur-team.com 도메인 연결 상태
- 최근 배포 상태 (Success/Failed)
```

### 2단계: 프로젝트가 있는 경우

#### A) 환경 변수 확인 및 추가

```
프로젝트 클릭
→ Settings
→ Environment variables
→ Production 탭

필수 환경 변수 (12개):

🔥 Firebase (8개):
1. VITE_FIREBASE_API_KEY
2. VITE_FIREBASE_AUTH_DOMAIN
3. VITE_FIREBASE_PROJECT_ID
4. VITE_FIREBASE_STORAGE_BUCKET
5. VITE_FIREBASE_MESSAGING_SENDER_ID
6. VITE_FIREBASE_APP_ID
7. VITE_FIREBASE_MEASUREMENT_ID
8. VITE_FIREBASE_DATABASE_URL

💬 Kakao (3개):
9. VITE_KAKAO_REST_API_KEY ← 🚨 이것이 없어서 에러!
10. VITE_KAKAO_JAVASCRIPT_KEY
11. VITE_KAKAO_AUTH_URL

💳 TossPayments (1개):
12. VITE_TOSS_CLIENT_KEY
```

#### B) 재배포

```
환경 변수 추가 후:

프로젝트 페이지
→ Deployments 탭
→ 최신 배포 선택
→ "Retry deployment" 버튼 클릭

또는

→ "Manage deployments" 메뉴
→ "Redeploy" 선택
```

### 3단계: 프로젝트가 없는 경우

#### 새 프로젝트 생성

```bash
# 방법 1: Wrangler CLI로 배포
cd /home/user/webapp
npm run build:kr
npx wrangler pages deploy dist --project-name=ur-live

# 방법 2: GitHub 연동 (권장)
```

**GitHub 연동 방법:**

```
1. Cloudflare Dashboard
   → Workers & Pages
   → Create application
   → Pages
   → Connect to Git

2. GitHub Repository 선택
   → tobe2111/ur-live

3. 프로젝트 설정
   ┌─────────────────────────────────────┐
   │ Project name: ur-live               │
   │ Production branch: main             │
   │ Build command: (비워두기)           │
   │ Build output directory: (비워두기)  │
   └─────────────────────────────────────┘

4. Save and Deploy

5. 환경 변수 설정 (위의 12개)

6. 커스텀 도메인 연결
   → Custom domains
   → Set up a custom domain
   → live.ur-team.com
```

---

## 🔧 **즉시 수정 스크립트**

### 환경 변수 템플릿 확인

```bash
cd /home/user/webapp
cat .env.kr.template
```

이 파일에 필요한 모든 환경 변수가 나열되어 있습니다.

### 로컬에서 수동 배포 (긴급)

```bash
# 1. 빌드
cd /home/user/webapp
npm run build:kr

# 2. Cloudflare에 직접 배포
npx wrangler pages deploy dist \
  --project-name=ur-live \
  --branch=main

# Wrangler 인증이 필요한 경우:
npx wrangler login
```

---

## 📋 **체크리스트**

현재 상태 확인:

- [ ] Cloudflare Pages 프로젝트 "ur-live" 또는 "ur-live-kr" 존재?
- [ ] live.ur-team.com 도메인 연결됨?
- [ ] 환경 변수 12개 모두 설정됨?
  - [ ] Firebase (8개)
  - [ ] Kakao (3개) ← 🚨 특히 KAKAO_REST_API_KEY
  - [ ] TossPayments (1개)
- [ ] 최근 배포 성공?
- [ ] 빌드 로그에 에러 없음?

---

## 🔍 **빌드 로그 확인**

Cloudflare Pages 프로젝트에서:

```
Deployments 탭
→ 최신 배포 클릭
→ "View build log" 확인

확인할 것:
- 환경 변수 검증 실패 메시지
- 빌드 명령어 실행 여부
- 파일 업로드 성공 여부
```

---

## 🚨 **긴급 임시 해결책**

환경 변수를 찾을 수 없는 경우, 임시로 빌드 타임에 하드코딩할 수 있습니다 (보안 위험 있음, 프로덕션에서는 절대 사용 금지):

```bash
# .env.local 파일 생성
cd /home/user/webapp
cat > .env.local << 'EOF'
VITE_KAKAO_REST_API_KEY=your_actual_key_here
# ... 다른 환경 변수들
EOF

# 빌드
npm run build:kr

# 배포
npx wrangler pages deploy dist --project-name=ur-live
```

⚠️ **주의**: `.env.local`은 절대 Git에 커밋하지 마세요!

---

## 📊 **예상 수정 시간**

```
환경 변수만 추가: 5분
재배포 대기: 3분
─────────────────
Total: 8분
```

---

## 🎯 **권장 해결 순서**

```
1. Cloudflare Dashboard 접속 (1분)
2. 프로젝트 존재 여부 확인 (1분)
3. 환경 변수 12개 추가 (3분)
4. 재배포 트리거 (1분)
5. 배포 완료 대기 (3분)
6. live.ur-team.com 접속 확인 (1분)
─────────────────────────────────
Total: 10분
```

---

## ❓ **FAQ**

### Q: 환경 변수 값을 어디서 얻나요?

**A:** 
```
Firebase: Firebase Console → 프로젝트 설정
Kakao: https://developers.kakao.com/ → 앱 설정
Toss: TossPayments 관리자 페이지
```

### Q: 프로젝트 이름이 뭔지 모르겠어요

**A:**
```bash
# Cloudflare 프로젝트 목록 확인
npx wrangler pages project list
```

### Q: 도메인이 다른 프로젝트에 연결되어 있어요

**A:**
```
1. 기존 프로젝트에서 도메인 제거
2. 새 프로젝트에 도메인 추가
3. DNS가 업데이트될 때까지 대기 (최대 24시간)
```

---

## 📞 **추가 지원**

문제가 계속되면:

1. Cloudflare Pages 프로젝트 스크린샷
2. 빌드 로그 전체
3. 환경 변수 설정 스크린샷 (값 가림)

위 정보를 제공해주세요.

---

**📍 우선순위: 🚨 긴급**  
**📍 예상 수정 시간: 10분**  
**📍 다음 단계: Cloudflare Dashboard 확인**
