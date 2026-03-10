# Prism Live Studio 통합 가이드

## 🎯 목표

셀러가 우리 웹 대시보드에서 "방송 시작" 버튼을 누르면, Prism Live Studio 앱이 자동으로 열리고 RTMP 설정이 자동으로 완료되도록 만들기.

---

## 📱 1. Prism 통합 방법 (3가지 옵션)

### Option 1: 딥링크 (Deep Link) - 가장 간단

**장점**: 
- 구현이 매우 간단
- 앱 설치만 되어 있으면 자동 실행
- 추가 API 연동 불필요

**단점**:
- Prism 공식 딥링크 스킴이 공개되지 않음 (추정)
- RTMP URL/Key 수동 복붙 필요할 수 있음

**구현**:
```typescript
// 프론트엔드
const openPrismApp = (rtmpUrl: string, streamKey: string) => {
  // Prism 딥링크 (추정)
  const prismUrl = `prism://stream?rtmp=${encodeURIComponent(rtmpUrl)}&key=${encodeURIComponent(streamKey)}`;
  
  window.location.href = prismUrl;
  
  // 앱이 설치되지 않은 경우 대비
  setTimeout(() => {
    if (confirm('Prism Live Studio 앱이 설치되어 있지 않습니다. 다운로드하시겠습니까?')) {
      window.open('https://prismlive.com/download/', '_blank');
    }
  }, 2000);
};
```

---

### Option 2: QR 코드 - 모바일 우선

**장점**:
- 모바일(핸드폰)에서 Prism 앱 사용 시 편리
- 크로스 디바이스 지원 (PC 웹 → 모바일 앱)

**단점**:
- QR 코드 스캔 필요 (한 단계 추가)

**구현**:
```tsx
// QR 코드 생성
import QRCode from 'qrcode.react';

export function PrismQRCode({ rtmpUrl, streamKey }: Props) {
  const prismData = JSON.stringify({
    type: 'prism_rtmp',
    rtmpUrl,
    streamKey,
    timestamp: Date.now()
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <QRCode
        value={prismData}
        size={256}
        level="H"
        includeMargin
      />
      <p className="text-sm text-gray-600 text-center">
        📱 Prism Live Studio 앱에서<br />
        "QR 스캔" 기능으로 이 코드를 스캔하세요
      </p>
    </div>
  );
}
```

---

### Option 3: 네이버 클라우드 Prism B2B API (프로페셔널)

**장점**:
- 완전 자동화 (제로클릭!)
- 앱에서 우리 서비스 계정 직접 선택 가능
- OAuth 토큰 공유로 인증 통합

**단점**:
- 네이버 클라우드 B2B 계약 필요
- 초기 설정 복잡
- 월 비용 발생

**구현**:
```typescript
// 네이버 클라우드 Prism B2B API 연동 (추정)
import axios from 'axios';

const PRISM_B2B_API_URL = 'https://prism-api.ncloud.com/v1';
const PRISM_B2B_API_KEY = process.env.PRISM_B2B_API_KEY;

async function createPrismSession(sellerId: number, rtmpConfig: RtmpConfig) {
  try {
    const response = await axios.post(
      `${PRISM_B2B_API_URL}/sessions`,
      {
        partner_id: 'your-partner-id',
        user_id: sellerId.toString(),
        rtmp_url: rtmpConfig.rtmpUrl,
        stream_key: rtmpConfig.streamKey,
        auto_start: true, // 앱에서 자동 시작
        expires_in: 3600  // 1시간 유효
      },
      {
        headers: {
          'Authorization': `Bearer ${PRISM_B2B_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Prism 세션 ID 반환
    return {
      success: true,
      sessionId: response.data.session_id,
      deepLink: response.data.deep_link // prism://session/{session_id}
    };
  } catch (error) {
    console.error('[Prism B2B] 세션 생성 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 사용 예시
const prismSession = await createPrismSession(seller.id, {
  rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
  streamKey: 'xxxx-xxxx-xxxx-xxxx'
});

if (prismSession.success) {
  // 앱 자동 실행
  window.location.href = prismSession.deepLink;
}
```

---

## 🔧 2. 권장 구현: 하이브리드 방식

**최적의 UX**: 딥링크 + QR 코드 + 수동 복사 (3중 대비)

```tsx
// src/components/seller/PrismConnector.tsx
import { useState } from 'react';
import { Copy, QrCode, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode.react';

interface PrismConnectorProps {
  rtmpUrl: string;
  streamKey: string;
}

export default function PrismConnector({ rtmpUrl, streamKey }: PrismConnectorProps) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  // 1. 딥링크로 앱 실행 시도
  const openPrismApp = () => {
    const prismUrl = `prism://stream?rtmp=${encodeURIComponent(rtmpUrl)}&key=${encodeURIComponent(streamKey)}`;
    
    console.log('[Prism] 앱 실행 시도:', prismUrl);
    window.location.href = prismUrl;
    
    // 2초 후에도 앱이 열리지 않으면 다운로드 안내
    setTimeout(() => {
      if (confirm('Prism Live Studio 앱이 설치되어 있지 않습니다.\n\n다운로드 페이지로 이동하시겠습니까?')) {
        window.open('https://prismlive.com/ko/pcapp/', '_blank');
      }
    }, 2000);
  };

  // 2. RTMP 정보 복사
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      alert(`${label}이(가) 복사되었습니다!`);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 3. QR 데이터
  const qrData = JSON.stringify({
    type: 'rtmp',
    url: rtmpUrl,
    key: streamKey
  });

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <ExternalLink className="w-5 h-5 text-purple-600" />
        Prism Live Studio로 방송하기
      </h3>

      {/* 방법 1: 원클릭 앱 실행 (추천) */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded">
            추천
          </span>
          <p className="font-semibold">방법 1: 자동 연결</p>
        </div>
        <button
          onClick={openPrismApp}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
        >
          🎥 Prism 앱 열기 (자동 설정)
        </button>
        <p className="text-xs text-gray-600 mt-2">
          * Prism Live Studio 앱이 설치되어 있어야 합니다
        </p>
      </div>

      {/* 방법 2: QR 코드 (모바일) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold">방법 2: QR 코드 (모바일)</p>
          <button
            onClick={() => setShowQR(!showQR)}
            className="text-sm text-purple-600 hover:underline flex items-center gap-1"
          >
            <QrCode className="w-4 h-4" />
            {showQR ? '숨기기' : 'QR 보기'}
          </button>
        </div>
        
        {showQR && (
          <div className="flex justify-center bg-white p-4 rounded-lg">
            <QRCode value={qrData} size={200} level="H" />
          </div>
        )}
      </div>

      {/* 방법 3: 수동 복사 (대비책) */}
      <div>
        <p className="font-semibold mb-3">방법 3: 수동 입력</p>
        
        <div className="space-y-3">
          {/* RTMP URL */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">RTMP URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={rtmpUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(rtmpUrl, 'RTMP URL')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1 transition-colors"
              >
                <Copy className="w-4 h-4" />
                복사
              </button>
            </div>
          </div>

          {/* Stream Key */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Stream Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={streamKey}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(streamKey, 'Stream Key')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1 transition-colors"
              >
                <Copy className="w-4 h-4" />
                복사
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            <strong>⚠️ 주의:</strong> Stream Key는 절대 타인에게 공유하지 마세요.<br />
            누출 시 무단 방송이 가능합니다.
          </p>
        </div>
      </div>

      {/* Prism 사용 가이드 링크 */}
      <div className="mt-6 pt-6 border-t border-purple-200">
        <p className="text-sm text-gray-600 mb-2">
          📚 Prism Live Studio 사용법
        </p>
        <a
          href="https://prismlive.com/ko/guide/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-purple-600 hover:underline"
        >
          가이드 보기 →
        </a>
      </div>
    </div>
  );
}
```

---

## 📱 3. Prism 앱 설정 자동화 (프리셋)

Prism에서 "프리셋" 기능을 사용하면 설정을 저장해둘 수 있습니다.

```json
// prism_preset.json (셀러에게 제공)
{
  "preset_name": "우리 라이브커머스",
  "rtmp": {
    "url": "rtmp://a.rtmp.youtube.com/live2",
    "key": "[자동입력됨]"
  },
  "video": {
    "resolution": "1920x1080",
    "fps": 30,
    "bitrate": 4500
  },
  "audio": {
    "bitrate": 160,
    "sample_rate": 48000
  },
  "overlay": {
    "enabled": true,
    "url": "https://live.ur-team.com/overlay?stream={STREAM_ID}"
  }
}
```

---

## 🎨 4. 완성된 워크플로우

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 셀러: "라이브 시작" 버튼 클릭                           │
│    └─> YouTube Live 자동 생성 (백엔드)                      │
│    └─> RTMP URL + Stream Key 생성                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 대시보드에 3가지 옵션 표시:                              │
│    ┌───────────────────────────────────────────┐            │
│    │ [추천] 🎥 Prism 앱 자동 열기              │            │
│    │  - 딥링크로 앱 실행                       │            │
│    │  - RTMP 정보 자동 입력 (이상적)           │            │
│    └───────────────────────────────────────────┘            │
│    ┌───────────────────────────────────────────┐            │
│    │ 📱 QR 코드 스캔 (모바일)                  │            │
│    │  - 핸드폰 Prism 앱으로 스캔               │            │
│    └───────────────────────────────────────────┘            │
│    ┌───────────────────────────────────────────┐            │
│    │ 📋 수동 복사 (대비책)                     │            │
│    │  - RTMP URL 복사 → Prism 앱에 붙여넣기    │            │
│    │  - Stream Key 복사 → Prism 앱에 붙여넣기  │            │
│    └───────────────────────────────────────────┘            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Prism Live Studio 앱:                                     │
│    - 카메라/마이크 선택                                      │
│    - "방송 시작" 버튼 클릭                                   │
│    └─> YouTube로 실시간 스트리밍 송출!                       │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 우리 대시보드:                                           │
│    - 실시간 시청자 수 표시                                   │
│    - 상품 클릭 → OBS Browser Source로 오버레이 표시          │
│    - 채팅 메시지 모니터링                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 5. 추가 개선 아이디어

### 5.1 웹 기반 인코더 (Prism 대체)

Prism 없이도 방송 가능하도록 WebRTC 인코더 제공:

```tsx
// src/components/seller/WebRTCEncoder.tsx
import { useRef, useEffect } from 'react';

export default function WebRTCEncoder({ rtmpUrl, streamKey }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080 },
        audio: true
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // WebRTC → RTMP 변환 (FFmpeg.wasm 또는 백엔드 중계)
      await startStreaming(mediaStream, rtmpUrl, streamKey);

    } catch (error) {
      console.error('[WebRTC] 카메라 접근 실패:', error);
      alert('카메라 권한을 허용해주세요.');
    }
  };

  return (
    <div>
      <video ref={videoRef} autoPlay muted className="w-full rounded-lg" />
      <button onClick={startCamera} className="...">
        🎥 웹 브라우저에서 방송 시작
      </button>
    </div>
  );
}
```

### 5.2 모바일 전용 UI

```tsx
// 모바일에서는 QR 코드 대신 딥링크 우선
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
  // 즉시 딥링크 실행
  window.location.href = prismDeepLink;
}
```

---

## 📚 6. 참고 자료

- [Prism Live Studio 공식 가이드](https://prismlive.com/ko/guide/)
- [네이버 클라우드 Prism B2B](https://www.ncloud.com/product/media/prism)
- [YouTube Live Streaming API](https://developers.google.com/youtube/v3/live/docs)
- [RTMP 프로토콜 명세](https://en.wikipedia.org/wiki/Real-Time_Messaging_Protocol)

---

## ✅ 체크리스트

- [ ] Prism Live Studio 앱 다운로드 링크 제공
- [ ] 딥링크 테스트 (iOS/Android/Desktop)
- [ ] QR 코드 생성 및 스캔 테스트
- [ ] RTMP URL/Key 복사 기능 작동 확인
- [ ] 방송 시작 후 실시간 상태 동기화
- [ ] 에러 핸들링 (앱 미설치, 권한 거부 등)

