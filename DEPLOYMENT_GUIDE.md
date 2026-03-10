# 🚀 운영 원리 & 배포 가이드

## 📊 전체 시스템 운영 원리

### 1️⃣ **Phase 1: YouTube Live 기본 통합** (이미 완성)

```
셀러 대시보드
    ↓
[YouTube 계정 연동하기] 버튼 클릭
    ↓
Google OAuth 로그인 (한 번만)
    ↓
YouTube 채널 정보 저장 (D1 데이터베이스)
    ↓
[라이브 방송 만들기] 버튼 클릭
    ↓
YouTube Live API 호출:
  - liveBroadcasts.insert (방송 생성)
  - liveStreams.insert (RTMP URL/Key 생성)
  - liveBroadcasts.bind (방송 ↔ 스트림 연결)
    ↓
RTMP 정보 저장 & 셀러에게 표시
    ↓
셀러가 3가지 방법 중 선택:
  1. 🌐 브라우저 직접 방송
  2. 📱 Prism QR 코드
  3. 💻 OBS/전통 방식
```

**데이터 흐름:**
```
Frontend (React)
  → API Call: POST /api/youtube/live/create
  → Backend (Cloudflare Workers)
    → YouTube API (liveBroadcasts.insert, liveStreams.insert)
    → D1 Database (live_streams 테이블에 저장)
  ← Response: { rtmpUrl, rtmpKey, youtubeUrl }
  → Display to seller (3 options)
```

---

### 2️⃣ **옵션 1: 브라우저 직접 방송** (🌐 Web Streaming)

```
셀러: [브라우저에서 바로 시작] 클릭
    ↓
브라우저: getUserMedia() → 카메라/마이크 권한 요청
    ↓
승인됨
    ↓
비디오 캡처 시작
    ↓
Canvas API로 상품 오버레이 렌더링
  (상품 이미지, 가격, 할인율, 구매 버튼)
    ↓
MediaRecorder로 비디오 녹화
  (WebM format, 100ms 청크)
    ↓
WebSocket 연결 (Durable Object)
    ↓
비디오 청크를 WebSocket으로 전송
    ↓
Durable Object: 청크를 FFmpeg 서비스로 전달
    ↓
FFmpeg 서비스 (Google Cloud Run / AWS Lambda):
  - WebM → H.264 + AAC 변환
  - RTMP로 YouTube에 푸시
    ↓
YouTube Live 🔴 방송 시작!
```

**데이터 흐름:**
```
Browser
  → MediaRecorder (video/webm chunks)
  → WebSocket (ws://live.ur-team.com/ws/stream/123)
  → Cloudflare Durable Object (RTMPBridge)
    → HTTP POST to FFmpeg Service
    → FFmpeg transcoding (WebM → H.264)
    → RTMP push (rtmp://a.rtmp.youtube.com/live2/stream-key)
    → YouTube Live Server
    ← Live video stream displayed on YouTube
```

**중요:** 이 방식은 **외부 FFmpeg 서비스가 필수**입니다!

---

### 3️⃣ **옵션 2: Prism QR 코드** (📱 2-탭 설정)

```
셀러: [라이브 방송 만들기] 완료
    ↓
QR 코드 표시 (RTMP 정보 포함)
    ↓
셀러: 핸드폰으로 QR 스캔
    ↓
모바일 페이지 열림 (/rtmp-setup?url=...&key=...)
    ↓
[모두 복사하기] 버튼 클릭 (1탭)
    ↓
Prism Live Studio 앱 열기
    ↓
Custom RTMP 선택 → 붙여넣기 (1탭)
    ↓
[Go Live] 버튼
    ↓
Prism이 RTMP로 YouTube에 직접 전송
    ↓
YouTube Live 🔴 방송 시작!
```

**데이터 흐름:**
```
Dashboard
  → Generate QR Code (qrcode.react)
  → Encode: https://live.ur-team.com/rtmp-setup?url=rtmp://...&key=xxxx
Mobile Phone
  → Scan QR → Open URL
  → Display RTMP credentials
  → Seller copies & pastes into Prism
  → Prism → RTMP → YouTube (direct, no server)
```

이 방식은 **서버 불필요** (Prism이 직접 YouTube에 전송)

---

### 4️⃣ **옵션 3: OBS/전통 방식** (💻 전문가용)

```
셀러: RTMP URL 복사
셀러: Stream Key 복사
    ↓
OBS Studio 열기
    ↓
Settings → Stream → Custom
    ↓
URL/Key 붙여넣기
    ↓
[Start Streaming]
    ↓
OBS가 RTMP로 YouTube에 직접 전송
    ↓
YouTube Live 🔴 방송 시작!
```

이 방식도 **서버 불필요**

---

### 5️⃣ **실시간 상품 오버레이** (모든 방식 공통)

```
방송 중...
    ↓
셀러: 라이브 컨트롤 패널에서 상품 전환 클릭
    ↓
WebSocket으로 모든 시청자에게 브로드캐스트
    ↓
브라우저 방송: Canvas 오버레이 즉시 업데이트
OBS/Prism 방송: 시청자 브라우저에 오버레이 표시
    (별도 <StreamOverlay> 컴포넌트)
    ↓
모든 시청자가 새 상품 정보 보게 됨
```

**데이터 흐름:**
```
Seller Dashboard
  → Click product in LiveControlPanel
  → WebSocket.send({ type: 'switch_product', productId: 123 })
  → Durable Object broadcasts to all viewers
  → All viewers' browsers:
    - Web streaming: Update Canvas overlay
    - OBS/Prism streaming: Update <StreamOverlay> component
  → Instant product display update
```

---

### 6️⃣ **YouTube Live Chat 통합**

```
방송 시작됨
    ↓
백엔드: YouTube Live Chat API 5초마다 폴링
    ↓
새 메시지 발견
    ↓
D1 데이터베이스에 캐시 (quota 절약)
    ↓
WebSocket으로 셀러 대시보드에 전송
    ↓
라이브 컨트롤 패널에 채팅 표시
    ↓
"구매" 키워드 감지?
    ↓
Yes → 자동 응답 전송:
  "@시청자 구매 링크: https://live.ur-team.com/product/123 🛒"
    ↓
YouTube Live Chat에 메시지 표시
```

**데이터 흐름:**
```
Backend Polling (every 5s)
  → GET youtube.com/v3/liveChat/messages?liveChatId=...
  ← { messages: [...] }
  → Cache in D1 (live_chat_cache table)
  → WebSocket broadcast to seller dashboard
  → Display in LiveControlPanel
  
Keyword Detection:
  "구매", "링크", "buy" detected
  → POST youtube.com/v3/liveChat/messages
  → Body: { message: "@User 구매 링크: ..." }
  → YouTube displays auto-reply in chat
```

---

## 🚀 지금 바로 배포하는 방법

### **방법 A: 기본 기능만 배포** (브라우저 방송 제외)

이 방법은 **Prism QR + OBS 방식만** 지원 (FFmpeg 서비스 불필요)

```bash
# Step 1: 의존성 설치
cd /home/user/webapp
npm install qrcode.react

# Step 2: 데이터베이스 마이그레이션
npx wrangler d1 migrations apply toss-live-commerce-db --remote

# Step 3: Google OAuth 설정 (위의 Step 3 참고)
# YouTube Client ID/Secret 발급

# Step 4: 환경 변수 설정
npx wrangler pages secret put YOUTUBE_CLIENT_ID
npx wrangler pages secret put YOUTUBE_CLIENT_SECRET
npx wrangler pages secret put YOUTUBE_REDIRECT_URI

# Step 5: 배포
npm run build
npm run deploy

# Step 6: 테스트
# https://live.ur-team.com/seller/login
```

**이 방법으로 작동하는 것:**
- ✅ YouTube OAuth 연동
- ✅ 라이브 방송 생성
- ✅ Prism QR 코드
- ✅ OBS/전통 방식
- ✅ 라이브 채팅 통합
- ✅ 상품 오버레이 (시청자 브라우저)

**작동 안 하는 것:**
- ❌ 브라우저 직접 방송 (FFmpeg 서비스 필요)

---

### **방법 B: 전체 기능 배포** (브라우저 방송 포함)

#### **1. FFmpeg 서비스 배포 (Google Cloud Run)**

```bash
# ffmpeg-service 폴더로 이동
cd /home/user/webapp/ffmpeg-service

# Google Cloud에 로그인
gcloud auth login

# 프로젝트 설정 (없으면 생성)
gcloud projects create ur-live-ffmpeg --set-as-default
gcloud config set project ur-live-ffmpeg

# Cloud Run API 활성화
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# 배포 (자동으로 Dockerfile 빌드)
gcloud run deploy ffmpeg-rtmp-bridge \
  --source . \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --max-instances 10

# 배포 완료 후 URL 복사 (예: https://ffmpeg-rtmp-bridge-xxx-an.a.run.app)
```

#### **2. Cloudflare에 FFmpeg URL 설정**

```bash
cd /home/user/webapp

# FFmpeg 서비스 URL 저장
npx wrangler pages secret put FFMPEG_SERVICE_URL
# 입력: https://ffmpeg-rtmp-bridge-xxx-an.a.run.app
```

#### **3. wrangler.toml에 Durable Objects 추가**

파일 수정 필요: `/home/user/webapp/wrangler.toml`

```toml
# 파일 끝에 추가
[[durable_objects.bindings]]
name = "RTMP_BRIDGE"
class_name = "RTMPBridge"
script_name = "ur-live"

[[migrations]]
tag = "v1"
new_classes = ["RTMPBridge"]
```

#### **4. 프론트엔드 재배포**

```bash
npm run build
npm run deploy
```

#### **5. 브라우저 방송 테스트**

```
1. https://live.ur-team.com/seller/live-broadcast
2. "라이브 방송 만들기"
3. "브라우저에서 바로 시작" 탭 선택
4. 카메라 권한 승인
5. "방송 시작" 클릭
6. YouTube에서 라이브 확인!
```

---

## 💰 비용 예상

### **Cloudflare (기본)**
- Workers: 무료 (100,000 requests/day)
- D1 Database: 무료 (5GB storage)
- Pages: 무료 (500 builds/month)

### **Google Cloud (브라우저 방송용)**
- Cloud Run: 
  - 첫 2백만 requests 무료
  - 이후 $0.40 per million requests
  - CPU: $0.00002400 per vCPU-second
  - Memory: $0.00000250 per GiB-second
- **예상:** 라이브 1시간당 약 $0.50~$1.00

### **YouTube API**
- 무료 quota: 10,000 units/day
- Chat polling: 720 units/hour (5초마다)
- 초과 시: 추가 quota 신청 (무료)

---

## 📊 모니터링

### **FFmpeg 서비스 상태 확인**

```bash
# Health check
curl https://ffmpeg-rtmp-bridge-xxx.run.app/health

# 활성 스트림 확인
curl https://ffmpeg-rtmp-bridge-xxx.run.app/streams
```

### **Cloudflare 로그 확인**

```bash
# Worker 로그
npx wrangler tail

# D1 쿼리
npx wrangler d1 execute toss-live-commerce-db --remote \
  --command="SELECT * FROM live_streams ORDER BY created_at DESC LIMIT 5"
```

### **YouTube API Quota 확인**

Google Cloud Console → APIs & Services → Dashboard → YouTube Data API v3

---

## 🐛 문제 해결

### **문제 1: "YouTube authentication required"**
**원인:** OAuth 토큰 만료  
**해결:** 셀러 대시보드에서 YouTube 다시 연동

### **문제 2: 브라우저 방송이 시작 안 됨**
**원인:** FFmpeg 서비스 미배포 또는 URL 설정 오류  
**해결:** 
```bash
# FFmpeg URL 확인
npx wrangler pages secret list | grep FFMPEG

# 재설정
npx wrangler pages secret put FFMPEG_SERVICE_URL
```

### **문제 3: 채팅이 안 보임**
**원인:** YouTube API quota 초과  
**해결:** 
```bash
# 캐시된 채팅 사용 (quota 없이)
# 코드에서 /api/youtube/chat/:id/cached 엔드포인트 사용
```

---

## ✅ 체크리스트

### **최소 배포 (Prism/OBS만)**
- [ ] npm install qrcode.react
- [ ] Database migration (0105, 0106)
- [ ] Google OAuth Client ID/Secret 발급
- [ ] Cloudflare secrets 설정 (YOUTUBE_*)
- [ ] npm run deploy
- [ ] 셀러 로그인 → YouTube 연동 테스트
- [ ] QR 코드 생성 테스트

### **전체 배포 (브라우저 방송 포함)**
- [ ] 위의 최소 배포 완료
- [ ] FFmpeg 서비스 배포 (Google Cloud Run)
- [ ] FFMPEG_SERVICE_URL 설정
- [ ] wrangler.toml에 Durable Objects 추가
- [ ] npm run deploy (재배포)
- [ ] 브라우저 방송 테스트

---

## 🎯 추천 배포 순서

1. **먼저 최소 배포로 시작** (FFmpeg 없이)
   - Prism QR + OBS 방식만
   - 빠르게 테스트 가능
   - 비용 0원

2. **테스트 후 브라우저 방송 추가**
   - FFmpeg 서비스 배포
   - 사용자 반응 보고 결정

3. **단계적 출시**
   - Week 1: YouTube 연동 + Prism QR
   - Week 2: 브라우저 방송 베타
   - Week 3: 전체 기능 공개

---

이제 배포할 준비 완료! 🚀

어떤 방법으로 시작할까요?
- A: 최소 배포 (Prism/OBS만, 빠르고 간단)
- B: 전체 배포 (브라우저 방송 포함, 완전판)
