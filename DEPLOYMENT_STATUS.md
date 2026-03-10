# 배포 현황 (2026-03-10)

## 📊 전체 진행 상황

```
Phase 1 (YouTube Integration): ✅ 100% 완료
Phase 2 (Zero-Click Streaming): ✅ 100% 완료 (코드)
Deployment: ⏳ 60% 완료 (사용자 액션 필요)
```

---

## ✅ 완료된 작업

### 1. 코드 개발 (100%)
- [x] YouTube OAuth 인증 시스템
- [x] YouTube Live API 통합 (방송 생성/시작/종료)
- [x] RTMP URL/Key 생성 및 제공
- [x] Prism QR 코드 자동 생성
- [x] 웹 브라우저 직접 스트리밍 (MediaRecorder → WebSocket → FFmpeg)
- [x] 실시간 제품 오버레이 시스템
- [x] YouTube Live Chat 통합 (폴링/캐싱)
- [x] 판매자 대시보드 UI (`/seller/live-broadcast`)
- [x] 데이터베이스 스키마 (마이그레이션 0105, 0106)
- [x] API 엔드포인트 (11개)
- [x] TypeScript 타입 정의
- [x] 에러 핸들링 & 로깅

### 2. 문서화 (100%)
- [x] `YOUTUBE_LIVE_GUIDE.md` - YouTube 통합 가이드
- [x] `PHASE_2_IMPLEMENTATION.md` - Phase 2 기술 상세
- [x] `DEPLOYMENT_GUIDE.md` - 전체 배포 가이드
- [x] `MINIMAL_DEPLOYMENT_CHECKLIST.md` - 최소 배포 체크리스트
- [x] `docs/GOOGLE_OAUTH_SETUP.md` - OAuth 설정
- [x] `docs/BACKEND_YOUTUBE_API.md` - 백엔드 API
- [x] `docs/FRONTEND_YOUTUBE_INTEGRATION.md` - 프론트엔드 통합
- [x] `docs/ISSUES_AND_SOLUTIONS.md` - 문제 해결
- [x] `docs/PRISM_INTEGRATION.md` - Prism 통합

### 3. 로컬 준비 (60%)
- [x] ✅ `qrcode.react` 패키지 설치
- [x] ✅ `.env.example` YouTube 변수 추가
- [x] ✅ Git 커밋 & 푸시
- [ ] ⏳ 데이터베이스 마이그레이션 (사용자 액션 필요)
- [ ] ⏳ Cloudflare Pages 시크릿 설정 (사용자 액션 필요)
- [ ] ⏳ Google Cloud OAuth 설정 (사용자 액션 필요)

---

## ⏳ 남은 작업 (사용자가 직접 수행)

### Step 1: 데이터베이스 마이그레이션 (5분)

**옵션 A: Wrangler CLI (권장)**
```bash
cd /home/user/webapp
npx wrangler d1 migrations apply toss-live-commerce-db --remote
```

**옵션 B: 개별 파일 실행**
```bash
npx wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0105_add_seller_youtube_oauth.sql
npx wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0106_add_live_chat_and_overlay.sql
```

**검증**:
```bash
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT COUNT(*) FROM seller_youtube_oauth;"
```

---

### Step 2: Google Cloud Console 설정 (10분)

1. **프로젝트 생성**:
   - https://console.cloud.google.com/
   - 새 프로젝트: `UR-Live YouTube Integration`

2. **API 활성화**:
   - YouTube Data API v3
   - YouTube Live Streaming API

3. **OAuth 클라이언트 ID 생성**:
   - 애플리케이션 유형: 웹 애플리케이션
   - 승인된 리디렉션 URI:
     - `https://live.ur-team.com/seller/youtube/callback`
     - `http://localhost:5173/seller/youtube/callback`

4. **OAuth 동의 화면 설정**:
   - 범위 추가:
     - `https://www.googleapis.com/auth/youtube`
     - `https://www.googleapis.com/auth/youtube.force-ssl`
     - `https://www.googleapis.com/auth/youtube.readonly`

5. **클라이언트 ID & Secret 복사** (다음 단계에서 사용)

---

### Step 3: Cloudflare Pages 시크릿 설정 (3분)

```bash
cd /home/user/webapp

# YouTube Client ID (Google Cloud에서 복사한 값 붙여넣기)
npx wrangler pages secret put YOUTUBE_CLIENT_ID --project-name=ur-live

# YouTube Client Secret (Google Cloud에서 복사한 값 붙여넣기)
npx wrangler pages secret put YOUTUBE_CLIENT_SECRET --project-name=ur-live

# Redirect URI
npx wrangler pages secret put YOUTUBE_REDIRECT_URI --project-name=ur-live
# 입력 값: https://live.ur-team.com/seller/youtube/callback
```

**검증**:
```bash
npx wrangler pages secret list --project-name=ur-live | grep YOUTUBE
```

예상 출력:
```
YOUTUBE_CLIENT_ID
YOUTUBE_CLIENT_SECRET
YOUTUBE_REDIRECT_URI
```

---

### Step 4: 빌드 & 배포 (5분)

```bash
cd /home/user/webapp

# 빌드
npm run build

# 배포
npm run deploy
```

---

### Step 5: 기능 테스트 (10분)

1. **판매자 로그인**:
   - https://live.ur-team.com/seller/login

2. **YouTube 계정 연결**:
   - 대시보드 → "YouTube Live" 버튼
   - `/seller/live-broadcast` 페이지
   - "YouTube 계정 연결" 버튼 클릭
   - Google 계정 선택 & 권한 승인

3. **라이브 스트림 생성**:
   - 제목: `테스트 라이브 방송`
   - 제품 선택
   - "방송 만들기" 클릭
   - ✅ RTMP URL & Stream Key 확인

4. **Prism QR 코드**:
   - QR 코드 표시 확인
   - 모바일로 스캔
   - RTMP 정보 자동 입력 확인

5. **OBS 스트리밍** (선택):
   - RTMP URL/Key 복사
   - OBS 설정
   - 방송 시작

---

## 📁 파일 구조

```
/home/user/webapp/
├── src/
│   ├── features/
│   │   ├── youtube/
│   │   │   ├── api/
│   │   │   │   ├── youtube.routes.ts         (11 API 엔드포인트)
│   │   │   │   └── youtube-chat.routes.ts    (채팅 API)
│   │   │   ├── services/
│   │   │   │   └── youtube-api.service.ts    (YouTube API 래퍼)
│   │   │   └── types.ts                      (TypeScript 타입)
│   │   └── streaming/
│   │       └── rtmp-bridge.ts                (WebSocket → RTMP)
│   ├── components/
│   │   └── streaming/
│   │       ├── WebStreaming.tsx              (브라우저 스트리밍)
│   │       ├── PrismQRCode.tsx               (QR 코드)
│   │       └── LiveControlPanel.tsx          (제어판)
│   └── pages/
│       ├── SellerLiveBroadcastPage.tsx       (메인 대시보드)
│       └── RTMPSetupPage.tsx                 (QR 랜딩)
├── migrations/
│   ├── 0105_add_seller_youtube_oauth.sql     (OAuth 테이블)
│   └── 0106_add_live_chat_and_overlay.sql    (채팅/오버레이)
├── ffmpeg-service/                           (Option B 전용)
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── docs/
│   ├── GOOGLE_OAUTH_SETUP.md
│   ├── BACKEND_YOUTUBE_API.md
│   ├── FRONTEND_YOUTUBE_INTEGRATION.md
│   ├── ISSUES_AND_SOLUTIONS.md
│   └── PRISM_INTEGRATION.md
├── YOUTUBE_LIVE_GUIDE.md
├── PHASE_2_IMPLEMENTATION.md
├── DEPLOYMENT_GUIDE.md
├── MINIMAL_DEPLOYMENT_CHECKLIST.md
└── DEPLOYMENT_STATUS.md (이 파일)
```

---

## 🎯 성공 기준

### ✅ Phase 1 성공 (최소 배포)
- [ ] `/seller/live-broadcast` 페이지 로드 (에러 없음)
- [ ] YouTube 계정 연결 버튼 작동
- [ ] OAuth 인증 후 채널 목록 표시
- [ ] 방송 생성 시 RTMP URL/Key 반환
- [ ] Prism QR 코드 생성 & 스캔 가능

### 🚀 Phase 2 성공 (전체 기능)
- [ ] 브라우저 직접 스트리밍 (FFmpeg 서비스 필요)
- [ ] 실시간 제품 오버레이 전환
- [ ] YouTube Live Chat 표시 & 자동 응답
- [ ] 시청자 통계 실시간 업데이트

---

## 💰 비용

### Option A (최소 배포)
- **Cloudflare Pages**: $0
- **Cloudflare D1**: $0
- **YouTube API**: $0 (10,000 유닛/일 무료)
- **총 비용**: **$0/월**

### Option B (전체 기능)
- Option A + **Google Cloud Run (FFmpeg)**: $0.50-$1/시간
- **총 비용**: **$0 + 사용량 기반**

---

## 📊 API 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/youtube/auth-url` | OAuth URL 생성 |
| POST | `/api/youtube/oauth/callback` | OAuth 콜백 처리 |
| GET | `/api/youtube/channels` | 연결된 채널 목록 |
| POST | `/api/youtube/live/create` | 방송 생성 |
| POST | `/api/youtube/live/:id/start` | 방송 시작 |
| POST | `/api/youtube/live/:id/end` | 방송 종료 |
| DELETE | `/api/youtube/oauth/:id` | 계정 연결 해제 |
| GET | `/api/youtube/chat/:streamId` | 채팅 메시지 가져오기 |
| POST | `/api/youtube/chat/:streamId` | 채팅 메시지 전송 |
| GET | `/api/youtube/chat/:streamId/cached` | 캐시된 채팅 (D1) |
| POST | `/api/youtube/overlay/:streamId` | 오버레이 업데이트 |

---

## 🔧 데이터베이스 스키마

### seller_youtube_oauth
```sql
- id, seller_id, google_email
- access_token, refresh_token, expires_at
- channel_id, channel_title, channel_thumbnail
- subscriber_count, is_active
- created_at, updated_at
```

### live_streams (확장)
```sql
- youtube_broadcast_id, youtube_stream_key
- youtube_live_chat_id, rtmp_url, rtmp_key
- youtube_embed_url
```

### live_chat_cache
```sql
- id, stream_id, chat_id
- author, message, timestamp
- created_at
```

### live_stream_overlays
```sql
- id, stream_id, current_product_id
- overlay_position, show_price, show_discount
- show_buy_button, custom_css
- updated_at
```

### stream_analytics
```sql
- id, stream_id, event_type
- product_id, user_id, metadata
- timestamp, created_at
```

---

## 🐛 알려진 이슈 & 해결 방법

### 1. YOUTUBE_CLIENT_ID is not defined
**해결**: Cloudflare Pages 시크릿 설정 (Step 3)

### 2. OAuth Redirect URI Mismatch
**해결**: Google Cloud Console에서 URI 확인 & 수정

### 3. YouTube API Quota 초과
**해결**: 
- 할당량 모니터링: https://console.cloud.google.com/apis/dashboard
- 캐싱 활용 (D1 `live_chat_cache`)
- 필요시 할당량 증가 요청

### 4. D1 마이그레이션 실패
**해결**:
```bash
# 인증 확인
npx wrangler whoami

# 개별 실행
npx wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0105_add_seller_youtube_oauth.sql
```

---

## 📅 권장 일정

### Week 1 (현재)
- [ ] Step 1-5 완료 (사용자 액션)
- [ ] 내부 테스트 (팀원 2-3명)

### Week 2
- [ ] Prism QR 기능 홍보
- [ ] 베타 사용자 피드백 수집

### Week 3
- [ ] Option B 고려 (브라우저 스트리밍)
- [ ] FFmpeg 서비스 배포 (필요시)

### Week 4
- [ ] 정식 런칭
- [ ] 사용자 온보딩 튜토리얼

---

## 📞 지원 & 연락처

**문의**: support@ur-team.com
**문서**: https://github.com/tobe2111/ur-live/pull/4
**대시보드**: https://live.ur-team.com/seller/login

---

## 🎉 다음 단계

1. ✅ **지금 바로 시작**: `MINIMAL_DEPLOYMENT_CHECKLIST.md` 파일 열기
2. 📝 **Step 1-5 수행**: 약 30분 소요
3. 🧪 **테스트**: 판매자 계정으로 로그인 & 방송 생성
4. 🚀 **피드백**: 문제 발견 시 GitHub Issue 생성

---

**마지막 업데이트**: 2026-03-10 12:10 (KST)
**버전**: 1.0.0
**브랜치**: `fix/seller-streams-api-endpoint`
**PR**: https://github.com/tobe2111/ur-live/pull/4
