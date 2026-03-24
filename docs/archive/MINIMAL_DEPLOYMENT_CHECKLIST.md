# 최소 배포 체크리스트 (Option A)

**목표**: YouTube Live 통합 기능을 최소한의 비용($0)으로 배포
**소요 시간**: 약 30분
**필요 계정**: Google Cloud Console, Cloudflare Pages

---

## ✅ 1단계: 의존성 설치 (완료 ✓)

```bash
cd /home/user/webapp
npm install qrcode.react
```

**결과**: ✅ QR 코드 라이브러리 설치 완료

---

## ✅ 2단계: 데이터베이스 마이그레이션

### 2-1. 로컬에서 마이그레이션 파일 확인

```bash
cd /home/user/webapp
ls -la migrations/0105*.sql
ls -la migrations/0106*.sql
```

**확인 사항**:
- `0105_add_seller_youtube_oauth.sql` - YouTube OAuth 테이블
- `0106_add_live_chat_and_overlay.sql` - 채팅 & 오버레이 테이블

### 2-2. Cloudflare D1 마이그레이션 적용

**⚠️ 주의**: Cloudflare 인증이 필요합니다.

#### 옵션 A: Wrangler CLI (권장)

```bash
cd /home/user/webapp

# 현재 적용된 마이그레이션 확인
npx wrangler d1 migrations list toss-live-commerce-db --remote

# 마이그레이션 적용
npx wrangler d1 migrations apply toss-live-commerce-db --remote
```

#### 옵션 B: Cloudflare 대시보드

1. https://dash.cloudflare.com/ 로그인
2. D1 → `toss-live-commerce-db` 선택
3. "Console" 탭 선택
4. 아래 SQL 실행:

```sql
-- 파일: migrations/0105_add_seller_youtube_oauth.sql 내용 복사 & 실행
-- 파일: migrations/0106_add_live_chat_and_overlay.sql 내용 복사 & 실행
```

#### 옵션 C: Wrangler execute (개별 파일 실행)

```bash
npx wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0105_add_seller_youtube_oauth.sql
npx wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0106_add_live_chat_and_overlay.sql
```

**검증**:
```bash
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('seller_youtube_oauth', 'live_chat_cache', 'live_stream_overlays', 'stream_analytics');"
```

---

## ✅ 3단계: Google Cloud Console 설정 (약 10분)

### 3-1. Google Cloud 프로젝트 생성

1. https://console.cloud.google.com/ 접속
2. "새 프로젝트" 클릭 → 이름: `UR-Live YouTube Integration`
3. 프로젝트 선택

### 3-2. YouTube API 활성화

1. 좌측 메뉴: **API 및 서비스** → **라이브러리**
2. 검색: `YouTube Data API v3` → **사용 설정**
3. 검색: `YouTube Live Streaming API` → **사용 설정**

### 3-3. OAuth 2.0 클라이언트 ID 생성

1. 좌측 메뉴: **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. 이름: `UR-Live Web Client`
5. **승인된 리디렉션 URI** 추가:
   - `https://live.ur-team.com/seller/youtube/callback`
   - `http://localhost:5173/seller/youtube/callback` (로컬 테스트용)
6. **만들기** 클릭
7. 팝업에서 **클라이언트 ID**와 **클라이언트 보안 비밀번호** 복사 (안전한 곳에 보관)

### 3-4. OAuth 동의 화면 설정

1. 좌측 메뉴: **OAuth 동의 화면**
2. 사용자 유형: **외부** (또는 **내부** - 조직 내부용)
3. 앱 정보 입력:
   - 앱 이름: `UR Live`
   - 사용자 지원 이메일: `support@ur-team.com`
   - 승인된 도메인: `ur-team.com`
4. 범위 추가:
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.force-ssl`
   - `https://www.googleapis.com/auth/youtube.readonly`
5. 저장 후 **게시** (또는 테스트 사용자 추가)

---

## ✅ 4단계: Cloudflare Pages 시크릿 설정 (약 3분)

### 4-1. YouTube API 시크릿 추가

```bash
cd /home/user/webapp

# YouTube Client ID 입력
npx wrangler pages secret put YOUTUBE_CLIENT_ID --project-name=ur-live

# YouTube Client Secret 입력
npx wrangler pages secret put YOUTUBE_CLIENT_SECRET --project-name=ur-live

# Redirect URI 입력
npx wrangler pages secret put YOUTUBE_REDIRECT_URI --project-name=ur-live
# 입력 값: https://live.ur-team.com/seller/youtube/callback
```

### 4-2. 시크릿 확인

```bash
npx wrangler pages secret list --project-name=ur-live
```

**예상 출력**:
```
YOUTUBE_CLIENT_ID
YOUTUBE_CLIENT_SECRET
YOUTUBE_REDIRECT_URI
JWT_SECRET
TOSS_SECRET_KEY
... (기타 기존 시크릿)
```

---

## ✅ 5단계: 빌드 & 배포 (약 5분)

### 5-1. 빌드

```bash
cd /home/user/webapp
npm run build
```

**예상 출력**:
```
vite v6.x.x building for production...
✓ 1234 modules transformed.
dist/index.html                   2.34 kB
dist/assets/index-abc123.js      456.78 kB
✓ built in 45s
```

### 5-2. 배포

```bash
npm run deploy
```

또는:

```bash
npx wrangler pages deploy dist --project-name=ur-live
```

**예상 출력**:
```
✨ Success! Uploaded 123 files (4.56 MB)
✅ Deployment complete!
🌎 https://live.ur-team.com
```

---

## ✅ 6단계: 기능 테스트 (약 10분)

### 6-1. 판매자 로그인

1. https://live.ur-team.com/seller/login 접속
2. 테스트 계정으로 로그인:
   - 이메일: `test@example.com`
   - 비밀번호: `test1234`

### 6-2. YouTube 계정 연결

1. 대시보드 → **YouTube Live** 버튼 클릭
2. `/seller/live-broadcast` 페이지로 이동
3. **"YouTube 계정 연결"** 버튼 클릭
4. Google 계정 선택 & 권한 승인
5. ✅ "연결됨" 상태 확인

### 6-3. 라이브 스트림 생성

1. **"새 라이브 방송 만들기"** 섹션에서:
   - 제목: `테스트 라이브 방송`
   - 설명: `첫 번째 테스트`
   - 제품 선택: (기존 제품 중 1개 선택)
2. **"방송 만들기"** 버튼 클릭
3. ✅ RTMP URL & Stream Key 표시 확인

### 6-4. Prism QR 코드 테스트

1. **"Prism 앱으로 열기"** 섹션에서 QR 코드 확인
2. 모바일로 QR 코드 스캔
3. `/seller/rtmp-setup?url=rtmp://...` 페이지 열림
4. ✅ RTMP 정보가 자동으로 채워진 것 확인
5. "복사" 버튼 클릭 → Prism 앱에 붙여넣기

### 6-5. OBS 스트리밍 테스트 (선택)

1. OBS Studio 실행
2. 설정 → 스트림:
   - 서비스: `커스텀`
   - 서버: (RTMP URL 복사)
   - 스트림 키: (Stream Key 복사)
3. "방송 시작" 클릭
4. YouTube Studio에서 라이브 스트림 확인

---

## 📊 배포 완료 체크리스트

- [x] ✅ 1단계: `qrcode.react` 패키지 설치
- [ ] ⏳ 2단계: D1 마이그레이션 적용 (0105, 0106)
- [ ] ⏳ 3단계: Google Cloud OAuth 설정
- [ ] ⏳ 4단계: Cloudflare Pages 시크릿 설정
- [ ] ⏳ 5단계: 빌드 & 배포
- [ ] ⏳ 6단계: 기능 테스트

---

## 🎯 성공 기준

✅ **최소 배포 성공 조건**:
1. `/seller/live-broadcast` 페이지가 에러 없이 로드됨
2. YouTube 계정 연결 버튼이 작동함
3. OAuth 인증 후 채널 목록이 표시됨
4. 방송 생성 시 RTMP URL/Key가 반환됨
5. Prism QR 코드가 생성되고 스캔 가능함

---

## 🐛 문제 해결

### 문제 1: `YOUTUBE_CLIENT_ID is not defined`

**원인**: Cloudflare Pages 시크릿이 설정되지 않음

**해결**:
```bash
npx wrangler pages secret put YOUTUBE_CLIENT_ID --project-name=ur-live
```

### 문제 2: OAuth Redirect URI Mismatch

**원인**: Google Cloud Console에 등록된 URI와 실제 요청 URI 불일치

**해결**:
1. Google Cloud Console → OAuth 클라이언트 ID
2. 승인된 리디렉션 URI 확인:
   - `https://live.ur-team.com/seller/youtube/callback`

### 문제 3: YouTube API Quota 초과

**원인**: 하루 10,000 유닛 제한 초과

**해결**:
1. Google Cloud Console → API 및 서비스 → 할당량
2. YouTube Data API v3 할당량 확인
3. 필요시 할당량 증가 요청

### 문제 4: D1 마이그레이션 실패

**원인**: Cloudflare 인증 실패 또는 테이블 이미 존재

**해결**:
```bash
# 인증 확인
npx wrangler whoami

# 수동 실행
npx wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0105_add_seller_youtube_oauth.sql
```

---

## 💰 비용 (Option A)

- **Cloudflare Pages**: $0 (무료 플랜)
- **Cloudflare D1**: $0 (무료 플랜 - 5GB, 500만 읽기/일)
- **Google Cloud (YouTube API)**: $0 (무료 - 10,000 유닛/일)
- **총 비용**: **$0/월**

---

## 📌 다음 단계

Option A 배포 후:
1. 🧪 **내부 테스트** (1주일) - 팀원들이 테스트
2. 📢 **베타 런칭** (2주일) - Prism QR 기능 홍보
3. 🚀 **Option B** (선택) - 브라우저 직접 스트리밍 (FFmpeg 서비스 필요, $0.50-$1/시간)

---

## 📚 관련 문서

- `DEPLOYMENT_GUIDE.md` - 전체 배포 가이드 (Option A + B)
- `PHASE_2_IMPLEMENTATION.md` - Phase 2 기술 상세
- `YOUTUBE_LIVE_GUIDE.md` - YouTube Live API 통합 가이드
- `docs/GOOGLE_OAUTH_SETUP.md` - Google OAuth 설정 가이드

---

**작성일**: 2026-03-10
**버전**: 1.0.0
**작성자**: Claude Code Agent
