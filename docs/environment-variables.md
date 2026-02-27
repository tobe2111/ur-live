# 🔐 UR LIVE 환경변수 설정 가이드

## 📋 전체 환경변수 리스트 (14개)

### 1️⃣ **Firebase 설정** (2개)
```bash
# Firebase Realtime Database URL
FIREBASE_DATABASE_URL=https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app

# Firebase API Key (서버용)
FIREBASE_API_KEY=AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s
```

**설명:**
- `FIREBASE_DATABASE_URL`: Firebase Realtime Database의 REST API 엔드포인트
- `FIREBASE_API_KEY`: Firebase 인증용 API 키 (서버 측에서만 사용)

**획득 방법:**
1. Firebase Console (https://console.firebase.google.com)
2. 프로젝트 "urteam-live-commerce" 선택
3. 프로젝트 설정 → 일반 → 웹 API 키 복사

---

### 2️⃣ **JWT 인증** (2개)
```bash
# JWT Secret Key (최소 32자)
JWT_SECRET=your-super-secret-key-min-32-chars-here

# Refresh Token Secret (다른 키 사용 권장)
REFRESH_TOKEN_SECRET=your-refresh-token-secret-key-here
```

**설명:**
- `JWT_SECRET`: Access Token 서명용 비밀키
- `REFRESH_TOKEN_SECRET`: Refresh Token 서명용 비밀키

**생성 방법:**
```bash
# Node.js에서 랜덤 키 생성
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### 3️⃣ **Toss Payments** (2개)
```bash
# Toss Payments Client Key (프론트엔드용)
VITE_TOSS_CLIENT_KEY=test_ck_OyL0qZ4G1VOPLJAz9LEXY3wYxAdE

# Toss Payments Secret Key (서버용)
TOSS_SECRET_KEY=test_sk_D5GePWvyJnrK0W0k6q8gLzN97Eoq
```

**설명:**
- `VITE_TOSS_CLIENT_KEY`: 프론트엔드에서 Toss 위젯 초기화용
- `TOSS_SECRET_KEY`: 서버에서 결제 승인 API 호출용

**획득 방법:**
1. Toss Payments 개발자 센터 (https://developers.tosspayments.com)
2. 로그인 → 내 애플리케이션 → API 키 확인

---

### 4️⃣ **카카오 소셜 로그인** (2개)
```bash
# Kakao JavaScript Key (프론트엔드용)
VITE_KAKAO_JAVASCRIPT_KEY=your-kakao-javascript-key

# Kakao REST API Key (서버용)
KAKAO_REST_API_KEY=your-kakao-rest-api-key
```

**설명:**
- `VITE_KAKAO_JAVASCRIPT_KEY`: 카카오 SDK 초기화용
- `KAKAO_REST_API_KEY`: OAuth 토큰 교환용

**획득 방법:**
1. Kakao Developers (https://developers.kakao.com)
2. 내 애플리케이션 → 앱 키 확인

---

### 5️⃣ **바로빌 (세금계산서)** (3개)
```bash
# Barobill Corp Number (사업자번호)
BAROBILL_CORP_NUM=your-corp-number

# Barobill API Key
BAROBILL_API_KEY=your-barobill-api-key

# Barobill Admin ID
BAROBILL_ADMIN_ID=your-barobill-admin-id
```

**설명:**
- `BAROBILL_CORP_NUM`: 사업자 등록번호 (10자리)
- `BAROBILL_API_KEY`: 바로빌 API 인증 키
- `BAROBILL_ADMIN_ID`: 바로빌 관리자 ID

**획득 방법:**
1. 바로빌 (https://www.baroservice.com)
2. 로그인 → API 설정 → API 키 발급

---

### 6️⃣ **Discord Webhook (모니터링)** (1개)
```bash
# Discord Webhook URL (알림용)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
```

**설명:**
- Discord 채널에 시스템 알림 전송용 Webhook URL
- Firebase 연결 수 90명 도달 시 자동 알림

**획득 방법:**
1. Discord 서버 → 채널 설정 → 연동 → 웹후크
2. 웹후크 생성 → 웹후크 URL 복사

---

### 7️⃣ **YouTube API** (1개)
```bash
# YouTube Data API Key
YOUTUBE_API_KEY=your-youtube-api-key
```

**설명:**
- YouTube 동영상 정보 조회용 API 키
- 라이브 스트리밍 메타데이터 가져오기

**획득 방법:**
1. Google Cloud Console (https://console.cloud.google.com)
2. API 및 서비스 → 사용자 인증 정보 → API 키 만들기

---

### 8️⃣ **기타** (1개)
```bash
# Environment (production | development)
NODE_ENV=production
```

---

## 🔧 환경변수 설정 방법

### **로컬 개발 환경** (.dev.vars 파일)
```bash
# /home/user/webapp/.dev.vars 생성
FIREBASE_DATABASE_URL=https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_API_KEY=AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s
JWT_SECRET=your-jwt-secret-key-here
# ... 나머지 변수들
```

### **프로덕션 환경** (Cloudflare Pages Secrets)
```bash
# Wrangler CLI로 시크릿 설정
cd /home/user/webapp

# Firebase
npx wrangler pages secret put FIREBASE_DATABASE_URL --project-name=ur-live
npx wrangler pages secret put FIREBASE_API_KEY --project-name=ur-live

# JWT
npx wrangler pages secret put JWT_SECRET --project-name=ur-live
npx wrangler pages secret put REFRESH_TOKEN_SECRET --project-name=ur-live

# Toss Payments
npx wrangler pages secret put TOSS_SECRET_KEY --project-name=ur-live

# Kakao
npx wrangler pages secret put KAKAO_REST_API_KEY --project-name=ur-live

# Barobill
npx wrangler pages secret put BAROBILL_CORP_NUM --project-name=ur-live
npx wrangler pages secret put BAROBILL_API_KEY --project-name=ur-live
npx wrangler pages secret put BAROBILL_ADMIN_ID --project-name=ur-live

# Discord
npx wrangler pages secret put DISCORD_WEBHOOK_URL --project-name=ur-live

# YouTube
npx wrangler pages secret put YOUTUBE_API_KEY --project-name=ur-live
```

---

## ⚠️ 보안 주의사항

### ✅ DO:
- `.dev.vars` 파일을 `.gitignore`에 추가
- 환경변수는 절대 코드에 하드코딩 금지
- 프로덕션 키는 Cloudflare Secrets로 관리
- 정기적으로 API 키 로테이션

### ❌ DON'T:
- GitHub에 환경변수 파일 커밋
- 프론트엔드 코드에 서버 API 키 노출
- 테스트 키를 프로덕션에 사용
- 환경변수를 콘솔에 로그 출력

---

## 📊 환경변수 요약표

| 변수명 | 타입 | 필수 | 용도 |
|--------|------|------|------|
| FIREBASE_DATABASE_URL | 서버 | ✅ | Firebase DB URL |
| FIREBASE_API_KEY | 서버 | ✅ | Firebase 인증 |
| JWT_SECRET | 서버 | ✅ | JWT 서명 |
| REFRESH_TOKEN_SECRET | 서버 | ✅ | Refresh Token |
| TOSS_CLIENT_KEY | 프론트 | ✅ | Toss 위젯 |
| TOSS_SECRET_KEY | 서버 | ✅ | Toss API |
| KAKAO_JAVASCRIPT_KEY | 프론트 | ✅ | Kakao SDK |
| KAKAO_REST_API_KEY | 서버 | ✅ | Kakao OAuth |
| BAROBILL_CORP_NUM | 서버 | ⭕ | 세금계산서 |
| BAROBILL_API_KEY | 서버 | ⭕ | 바로빌 API |
| BAROBILL_ADMIN_ID | 서버 | ⭕ | 바로빌 관리 |
| DISCORD_WEBHOOK_URL | 서버 | ⭕ | Discord 알림 |
| YOUTUBE_API_KEY | 서버 | ⭕ | YouTube API |
| NODE_ENV | 공통 | ✅ | 환경 구분 |

**범례:**
- ✅ 필수 (서비스 작동에 반드시 필요)
- ⭕ 선택 (해당 기능 사용 시 필요)
