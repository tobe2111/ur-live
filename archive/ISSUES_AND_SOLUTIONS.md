# 잠재적 이슈 & 해결책 (Issue Prevention Guide)

## 🚨 1. OAuth 인증 관련 이슈

### 문제 1.1: "Redirect URI mismatch" 에러

**증상**:
```
Error 400: redirect_uri_mismatch
The redirect URI in the request, http://localhost:3000/callback, 
does not match the ones authorized for the OAuth client.
```

**원인**:
- Google Cloud Console에 등록한 Redirect URI와 코드의 URI가 일치하지 않음
- 프로토콜 차이 (http vs https)
- 포트 번호 차이

**해결책**:
```typescript
// ✅ 올바른 방법
const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://live.ur-team.com/auth/google/callback'
  : 'http://localhost:3000/auth/google/callback';

// ❌ 잘못된 방법
const REDIRECT_URI = 'http://localhost/callback'; // 포트 없음!
```

**Google Cloud Console 설정**:
```
승인된 리디렉션 URI:
✅ http://localhost:3000/auth/google/callback
✅ http://localhost:5173/auth/google/callback
✅ https://live.ur-team.com/auth/google/callback
❌ http://localhost/callback (포트 필수!)
```

---

### 문제 1.2: Refresh Token이 발급되지 않음

**증상**:
- 첫 로그인 후 `refresh_token`이 `undefined`

**원인**:
- OAuth 요청 시 `access_type=offline` 파라미터 누락
- 사용자가 이미 승인한 경우 재발급 안 됨

**해결책**:
```typescript
// ✅ 올바른 OAuth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',  // ✅ 필수!
  prompt: 'consent',       // ✅ 재승인 강제
  scope: [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ]
});
```

**테스트 방법**:
1. Google 계정 설정 → 보안 → 타사 앱 액세스 관리
2. 우리 앱 연결 해제
3. 다시 로그인하여 refresh_token 확인

---

### 문제 1.3: "Access blocked: Authorization Error" (OAuth 동의 화면 미게시)

**증상**:
- 테스트 사용자가 아닌 계정으로 로그인 시 차단됨

**원인**:
- OAuth 동의 화면이 "테스트" 상태 (최대 100명)

**해결책**:
```
1. Google Cloud Console → OAuth 동의 화면
2. "앱 게시" 클릭
3. Google 검토 요청 (7-14일 소요)
4. 승인 후 모든 사용자 로그인 가능
```

**임시 해결책 (개발 중)**:
- 테스트 사용자 목록에 셀러 이메일 추가 (최대 100명)

---

## 🎥 2. YouTube API 관련 이슈

### 문제 2.1: "The user has not created a YouTube channel" 에러

**증상**:
```json
{
  "error": {
    "code": 404,
    "message": "The user does not have a YouTube channel."
  }
}
```

**원인**:
- 셀러가 YouTube 채널이 없음

**해결책**:
```typescript
// 채널 존재 여부 확인 후 안내
async function checkYouTubeChannel(oauth2Client) {
  try {
    const response = await youtube.channels.list({
      auth: oauth2Client,
      part: ['id'],
      mine: true
    });

    if (!response.data.items || response.data.items.length === 0) {
      return {
        hasChannel: false,
        error: 'NO_CHANNEL'
      };
    }

    return {
      hasChannel: true,
      channelId: response.data.items[0].id
    };
  } catch (error) {
    return {
      hasChannel: false,
      error: error.message
    };
  }
}

// UI에서 처리
if (!channelCheck.hasChannel) {
  alert(
    '⚠️ YouTube 채널이 없습니다!\n\n' +
    '라이브 방송을 위해 먼저 YouTube 채널을 생성해주세요.\n\n' +
    '1. YouTube 접속\n' +
    '2. 우측 상단 프로필 → "채널 만들기"\n' +
    '3. 완료 후 다시 연결하기'
  );
  
  window.open('https://www.youtube.com/create_channel', '_blank');
  return;
}
```

---

### 문제 2.2: "Quota exceeded" (API 할당량 초과)

**증상**:
```json
{
  "error": {
    "code": 403,
    "message": "The request cannot be completed because you have exceeded your quota."
  }
}
```

**원인**:
- YouTube Data API 일일 할당량 10,000 units 초과
- `liveBroadcasts.insert` = 1,600 units
- 하루 최대 6회 방송 생성 가능 (1,600 * 6 = 9,600)

**해결책**:

1. **할당량 증가 요청**:
   ```
   Google Cloud Console → YouTube Data API v3 → 할당량
   → "할당량 증가 요청" 클릭
   → 이유: "Commercial live streaming platform"
   → 요청 units: 100,000 (일반적으로 승인됨)
   ```

2. **효율적인 API 사용**:
   ```typescript
   // ❌ 비효율적 (매번 새 방송 생성)
   await createLiveBroadcast(); // 1,600 units

   // ✅ 효율적 (재사용 가능한 스트림)
   const stream = await getOrCreateReusableStream(); // 최초 1회만
   await bindBroadcastToStream(broadcastId, stream.id); // 50 units
   ```

3. **캐싱 활용**:
   ```typescript
   // 채널 정보는 1시간마다 갱신
   const channelCache = await redis.get(`channel:${sellerId}`);
   if (channelCache) {
     return JSON.parse(channelCache);
   }

   const channelInfo = await youtubeService.getChannelInfo();
   await redis.setex(`channel:${sellerId}`, 3600, JSON.stringify(channelInfo));
   ```

---

### 문제 2.3: 라이브 방송이 "비공개"로 생성됨

**증상**:
- YouTube에서 방송 확인 불가
- 시청자가 접근 불가

**원인**:
- `privacyStatus: 'private'`로 설정

**해결책**:
```typescript
// ✅ 올바른 설정
const broadcast = await youtube.liveBroadcasts.insert({
  requestBody: {
    status: {
      privacyStatus: 'public', // 'public', 'unlisted', 'private'
      selfDeclaredMadeForKids: false, // 아동 대상 여부 (필수!)
    }
  }
});
```

**주의사항**:
- `selfDeclaredMadeForKids`는 반드시 설정 (YouTube 정책)
- 아동 대상 콘텐츠는 개인화 광고 제한됨

---

## 🔐 3. 보안 관련 이슈

### 문제 3.1: Stream Key 노출

**증상**:
- 프론트엔드 콘솔에 Stream Key 출력
- 타인이 무단 방송 가능

**해결책**:
```typescript
// ❌ 위험! (프론트엔드에 전송)
res.json({
  rtmpUrl: 'rtmp://...',
  streamKey: 'xxxx-yyyy-zzzz' // ❌ 노출 위험!
});

// ✅ 안전 (마스킹)
res.json({
  rtmpUrl: 'rtmp://...',
  streamKey: 'xxxx-****-****', // 마스킹
  streamKeyFull: encryptStreamKey(streamKey) // 암호화
});

// 프론트엔드에서 복호화
const decryptedKey = await api.post('/api/decrypt-stream-key', {
  encrypted: streamKeyFull
});
```

**추가 보안**:
```typescript
// 1. IP 화이트리스트
const ALLOWED_IPS = [
  '123.456.789.0', // 셀러 사무실 IP
  '::ffff:127.0.0.1' // localhost
];

if (!ALLOWED_IPS.includes(req.ip)) {
  return res.status(403).json({ error: 'Forbidden IP' });
}

// 2. 사용 횟수 제한
await redis.incr(`stream_key_access:${sellerId}`);
const accessCount = await redis.get(`stream_key_access:${sellerId}`);

if (parseInt(accessCount) > 10) {
  return res.status(429).json({ error: 'Too many requests' });
}
```

---

### 문제 3.2: OAuth Token 탈취

**증상**:
- DB에 저장된 토큰이 평문으로 노출

**해결책**:
```typescript
// ✅ 암호화 저장
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encryptToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(token);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptToken(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString();
}

// DB 저장
await Seller.update({
  youtube_access_token: encryptToken(tokens.access_token),
  youtube_refresh_token: encryptToken(tokens.refresh_token)
});

// DB 조회
const seller = await Seller.findByPk(sellerId);
const accessToken = decryptToken(seller.youtube_access_token);
```

---

## 📡 4. 네트워크 & 스트리밍 이슈

### 문제 4.1: RTMP 연결 실패

**증상**:
- Prism/OBS에서 "Failed to connect to server" 에러

**원인**:
1. RTMP URL 형식 오류
2. Stream Key 오타
3. 방화벽 차단 (포트 1935)
4. YouTube 서버 지역 문제

**해결책**:
```typescript
// 1. RTMP URL 검증
function validateRtmpUrl(url: string): boolean {
  const rtmpRegex = /^rtmp:\/\/[a-z0-9.-]+\/[a-z0-9-_]+$/i;
  return rtmpRegex.test(url);
}

// 2. 여러 YouTube 서버 제공 (Fallback)
const YOUTUBE_RTMP_SERVERS = [
  'rtmp://a.rtmp.youtube.com/live2', // Primary
  'rtmp://b.rtmp.youtube.com/live2', // Secondary
  'rtmp://c.rtmp.youtube.com/live2'  // Tertiary
];

// 3. 연결 테스트
async function testRtmpConnection(url: string, key: string): Promise<boolean> {
  try {
    // ffmpeg로 1초 테스트 스트림 전송
    await exec(`ffmpeg -re -f lavfi -i testsrc=duration=1:size=1280x720:rate=30 \
      -c:v libx264 -f flv ${url}/${key}`);
    return true;
  } catch {
    return false;
  }
}
```

---

### 문제 4.2: 방송 딜레이 (지연)

**증상**:
- 실시간 방송인데 30초~2분 지연 발생

**원인**:
- YouTube의 기본 지연 설정 (Low Latency 미활성화)
- 인코더 버퍼 설정

**해결책**:
```typescript
// YouTube API로 Low Latency 활성화
await youtube.liveBroadcasts.insert({
  requestBody: {
    contentDetails: {
      latencyPreference: 'ultraLow', // 'normal', 'low', 'ultraLow'
      enableAutoStart: true,
      enableAutoStop: true
    }
  }
});
```

**Prism/OBS 설정**:
```
Video Bitrate: 4000-6000 kbps
Audio Bitrate: 128-160 kbps
Keyframe Interval: 2 seconds
CPU Usage Preset: veryfast (딜레이 최소화)
```

---

## 🐛 5. 프론트엔드 이슈

### 문제 5.1: WebSocket 재연결 실패

**증상**:
- 방송 중 WebSocket 끊김 → 상품 오버레이 업데이트 안 됨

**해결책**:
```typescript
// ✅ 지수 백오프 재연결
class RobustWebSocket {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000; // 1초

  attemptReconnect(streamId: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] 최대 재연결 횟수 초과');
      alert('연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // 지수 백오프: 1초 → 2초 → 4초 → 8초 ...
    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[WebSocket] 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect(streamId);
    }, delay);
  }

  connect(streamId: string) {
    this.ws = new WebSocket(`wss://live.ur-team.com/ws/live/${streamId}`);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0; // 재연결 성공 시 리셋
      console.log('[WebSocket] ✅ 연결됨');
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] 연결 끊김, 재연결 시도...');
      this.attemptReconnect(streamId);
    };
  }
}
```

---

### 문제 5.2: 메모리 누수 (Memory Leak)

**증상**:
- 방송 중 브라우저가 점점 느려짐
- 메모리 사용량 계속 증가

**원인**:
- WebSocket 이벤트 리스너 미제거
- 타이머 정리 안 함

**해결책**:
```typescript
// ✅ 올바른 정리
useEffect(() => {
  const ws = new WebSocket(wsUrl);
  const intervalId = setInterval(fetchStreamStatus, 5000);

  return () => {
    // Cleanup! (컴포넌트 언마운트 시)
    ws.close();
    clearInterval(intervalId);
  };
}, []);
```

---

## 📊 6. 성능 최적화

### 문제 6.1: API 요청 과다 (Rate Limiting)

**해결책**:
```typescript
// Debounce + Throttle
import { debounce, throttle } from 'lodash';

// 상품 업데이트: Debounce (마지막 요청만)
const updateProduct = debounce(async (product) => {
  await api.post('/api/live/update-product', { product });
}, 500);

// 시청자 수 조회: Throttle (최대 10초에 1회)
const fetchViewerCount = throttle(async () => {
  const response = await api.get('/api/live/viewer-count');
  setViewerCount(response.data.count);
}, 10000);
```

---

## 🧪 7. 테스트 체크리스트

### 필수 테스트 시나리오:

- [ ] **OAuth 로그인**:
  - [ ] 첫 로그인 (refresh_token 확인)
  - [ ] 재로그인 (기존 토큰 재사용)
  - [ ] 토큰 만료 후 자동 갱신

- [ ] **YouTube 채널**:
  - [ ] 채널 있는 계정
  - [ ] 채널 없는 계정 (에러 처리)

- [ ] **라이브 방송**:
  - [ ] 방송 생성 성공
  - [ ] Prism 연동 (딥링크/QR)
  - [ ] RTMP 스트리밍 송출
  - [ ] 방송 종료

- [ ] **WebSocket**:
  - [ ] 상품 실시간 업데이트
  - [ ] 연결 끊김 재연결
  - [ ] 여러 브라우저 동시 접속

- [ ] **보안**:
  - [ ] Stream Key 노출 검증
  - [ ] CSRF 토큰 검증
  - [ ] Rate Limiting 동작 확인

---

## 🚀 8. 프로덕션 배포 전 체크리스트

- [ ] OAuth 동의 화면 게시 승인 완료
- [ ] YouTube API 할당량 증가 신청
- [ ] HTTPS 적용 (Let's Encrypt)
- [ ] 환경 변수 암호화 (AWS Secrets Manager / Vault)
- [ ] 에러 로깅 (Sentry / Datadog)
- [ ] 성능 모니터링 (New Relic / Grafana)
- [ ] DB 백업 자동화
- [ ] CDN 설정 (Cloudflare / CloudFront)
- [ ] 로드 밸런싱 (Nginx / AWS ALB)
- [ ] 스케일링 테스트 (동시 100명 방송)

---

## 📞 9. 긴급 상황 대응

### YouTube API 장애 시:
```
1. 상태 페이지 확인: https://www.google.com/appsstatus
2. 대체 플랫폼 준비: Twitch / Facebook Live
3. 셀러에게 알림: "YouTube 일시 장애, 복구 중"
```

### DB 장애 시:
```
1. 읽기 전용 모드 전환
2. Redis 캐시로 임시 운영
3. DB 복구 후 데이터 동기화
```

---

## 📚 10. 유용한 리소스

- [YouTube Live Streaming API 문서](https://developers.google.com/youtube/v3/live/docs)
- [Google OAuth 2.0 플레이그라운드](https://developers.google.com/oauthplayground/)
- [RTMP 명세서](https://www.adobe.com/devnet/rtmp.html)
- [Prism Live Studio 가이드](https://prismlive.com/ko/guide/)

