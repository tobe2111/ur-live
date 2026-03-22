# 프론트엔드 YouTube 연동 가이드

## 1. 필요한 패키지 설치

```bash
npm install @react-oauth/google react-google-login axios zustand
# 또는
yarn add @react-oauth/google react-google-login axios zustand
```

## 2. 환경 변수 설정

`.env.local`:
```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:3000/api
```

## 3. 핵심 컴포넌트 구조

```
src/
├── components/
│   ├── seller/
│   │   ├── YoutubeLiveButton.tsx      # YouTube 연동 버튼
│   │   ├── LiveDashboard.tsx          # 방송 대시보드
│   │   ├── ProductOverlay.tsx         # 상품 오버레이
│   │   └── StreamStatus.tsx           # 방송 상태 표시
│   └── auth/
│       └── GoogleOAuthButton.tsx      # OAuth 로그인
├── hooks/
│   ├── useYoutubeLive.ts              # YouTube Live 훅
│   └── useWebRTC.ts                   # WebRTC 스트리밍
├── services/
│   ├── youtubeService.ts              # YouTube API 서비스
│   └── websocketService.ts            # WebSocket 통신
└── stores/
    └── useLiveStore.ts                # 방송 상태 관리 (Zustand)
```

---

## 4. 코드 예시

### 4.1 Zustand Store (방송 상태 관리)

```typescript
// src/stores/useLiveStore.ts
import { create } from 'zustand';

interface Product {
  id: number;
  name: string;
  price: number;
  discount: number;
  image: string;
  buyLink: string;
}

interface LiveStream {
  id: string;
  title: string;
  status: 'scheduled' | 'live' | 'ended';
  rtmpUrl?: string;
  streamKey?: string;
  youtubeUrl?: string;
  products: Product[];
  currentProduct?: Product;
}

interface LiveStore {
  stream: LiveStream | null;
  isYoutubeConnected: boolean;
  isLoading: boolean;
  
  // Actions
  setStream: (stream: LiveStream) => void;
  setYoutubeConnected: (connected: boolean) => void;
  updateCurrentProduct: (product: Product) => void;
  startLive: () => Promise<void>;
  stopLive: () => Promise<void>;
}

export const useLiveStore = create<LiveStore>((set, get) => ({
  stream: null,
  isYoutubeConnected: false,
  isLoading: false,

  setStream: (stream) => set({ stream }),
  
  setYoutubeConnected: (connected) => set({ isYoutubeConnected: connected }),
  
  updateCurrentProduct: (product) => 
    set((state) => ({
      stream: state.stream 
        ? { ...state.stream, currentProduct: product }
        : null
    })),

  startLive: async () => {
    set({ isLoading: true });
    try {
      // API 호출 로직 (뒤에서 구현)
      const response = await fetch('/api/seller/youtube/start-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '오늘의 특가 라이브!',
          products: get().stream?.products || []
        })
      });
      
      const data = await response.json();
      set({ stream: data.stream });
    } catch (error) {
      console.error('라이브 시작 실패:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  stopLive: async () => {
    try {
      await fetch(`/api/seller/youtube/stop-live/${get().stream?.id}`, {
        method: 'POST'
      });
      set({ stream: null });
    } catch (error) {
      console.error('라이브 종료 실패:', error);
    }
  }
}));
```

### 4.2 Google OAuth 버튼

```tsx
// src/components/auth/GoogleOAuthButton.tsx
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useLiveStore } from '@/stores/useLiveStore';
import api from '@/lib/api';

export default function GoogleOAuthButton() {
  const setYoutubeConnected = useLiveStore((state) => state.setYoutubeConnected);

  const handleSuccess = async (credentialResponse: any) => {
    try {
      console.log('[YouTube Auth] Google 로그인 성공');
      
      // 백엔드로 credential 전송
      const response = await api.post('/api/seller/youtube/connect', {
        credential: credentialResponse.credential
      });

      if (response.data.success) {
        console.log('[YouTube Auth] ✅ YouTube 채널 연결 완료');
        setYoutubeConnected(true);
        
        // 토큰 저장
        localStorage.setItem('youtube_connected', 'true');
        
        alert('YouTube 채널이 연결되었습니다! 이제 라이브를 시작할 수 있습니다.');
      }
    } catch (error) {
      console.error('[YouTube Auth] 연결 실패:', error);
      alert('YouTube 연결에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleError = () => {
    console.error('[YouTube Auth] Google 로그인 실패');
    alert('Google 로그인에 실패했습니다.');
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <div className="flex flex-col items-center gap-4">
        <h3 className="text-lg font-semibold">YouTube 채널 연결</h3>
        <p className="text-sm text-gray-600 text-center">
          YouTube 라이브 방송을 시작하려면<br />
          먼저 YouTube 채널을 연결해주세요
        </p>
        
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          scope="https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl"
          text="signin_with"
          shape="rectangular"
          theme="outline"
          size="large"
        />
        
        <p className="text-xs text-gray-500 mt-2">
          * YouTube 채널이 없다면 먼저 생성해주세요
        </p>
      </div>
    </GoogleOAuthProvider>
  );
}
```

### 4.3 라이브 대시보드 (메인)

```tsx
// src/components/seller/LiveDashboard.tsx
import { useState, useEffect } from 'react';
import { useLiveStore } from '@/stores/useLiveStore';
import GoogleOAuthButton from '@/components/auth/GoogleOAuthButton';
import { Play, Square, Video, Package } from 'lucide-react';

export default function LiveDashboard() {
  const {
    stream,
    isYoutubeConnected,
    isLoading,
    startLive,
    stopLive,
    updateCurrentProduct
  } = useLiveStore();

  const [products, setProducts] = useState([
    {
      id: 1,
      name: '프리미엄 무선 이어폰',
      price: 89000,
      discount: 30,
      image: 'https://example.com/product1.jpg',
      buyLink: '/products/1'
    },
    // 더 많은 상품...
  ]);

  // YouTube 연결 상태 확인
  useEffect(() => {
    const connected = localStorage.getItem('youtube_connected') === 'true';
    useLiveStore.getState().setYoutubeConnected(connected);
  }, []);

  const handleStartLive = async () => {
    if (!isYoutubeConnected) {
      alert('먼저 YouTube 채널을 연결해주세요!');
      return;
    }

    try {
      await startLive();
      alert('라이브 방송이 시작되었습니다!');
    } catch (error) {
      alert('라이브 시작에 실패했습니다.');
    }
  };

  const handleStopLive = async () => {
    if (confirm('라이브 방송을 종료하시겠습니까?')) {
      await stopLive();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">라이브 방송 대시보드</h1>
          <p className="text-gray-600">
            원클릭으로 YouTube 라이브를 시작하세요
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 방송 컨트롤 */}
          <div className="lg:col-span-2">
            {!isYoutubeConnected ? (
              /* YouTube 연결 필요 */
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <Video className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <GoogleOAuthButton />
              </div>
            ) : stream?.status === 'live' ? (
              /* 방송 중 */
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-lg font-semibold">방송 중</span>
                  </div>
                  <button
                    onClick={handleStopLive}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Square className="w-5 h-5" />
                    방송 종료
                  </button>
                </div>

                {/* 방송 정보 */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">방송 제목</p>
                    <p className="font-semibold">{stream.title}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-1">YouTube URL</p>
                    <a
                      href={stream.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {stream.youtubeUrl}
                    </a>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">현재 소개 중인 상품</p>
                    {stream.currentProduct ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={stream.currentProduct.image}
                          alt={stream.currentProduct.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div>
                          <p className="font-semibold">{stream.currentProduct.name}</p>
                          <p className="text-red-500 font-bold">
                            {stream.currentProduct.discount}% 할인
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">상품을 선택해주세요</p>
                    )}
                  </div>
                </div>

                {/* Prism 앱 연결 안내 */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-semibold mb-2">
                    📱 Prism Live Studio 앱으로 방송하기
                  </p>
                  <p className="text-sm text-blue-700 mb-3">
                    RTMP 정보가 자동으로 설정되었습니다. Prism 앱을 열어주세요.
                  </p>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                    Prism 앱 열기
                  </button>
                </div>
              </div>
            ) : (
              /* 방송 시작 대기 */
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <Play className="w-20 h-20 mx-auto mb-4 text-green-500" />
                <h2 className="text-2xl font-bold mb-4">라이브 방송 시작</h2>
                <p className="text-gray-600 mb-6">
                  원클릭으로 YouTube 라이브를 시작하세요
                </p>
                
                <button
                  onClick={handleStartLive}
                  disabled={isLoading}
                  className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-lg font-semibold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? '준비 중...' : '🎥 라이브 시작하기'}
                </button>

                <p className="text-sm text-gray-500 mt-4">
                  * 방송은 자동으로 YouTube 채널에 생성됩니다
                </p>
              </div>
            )}
          </div>

          {/* 오른쪽: 상품 목록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold">방송 상품 목록</h3>
              </div>

              <div className="space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      stream?.currentProduct?.id === product.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => stream?.status === 'live' && updateCurrentProduct(product)}
                  >
                    <div className="flex gap-3">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {product.price.toLocaleString()}원
                        </p>
                        <span className="text-xs text-red-500 font-semibold">
                          {product.discount}% 할인
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {stream?.status !== 'live' && (
                <p className="text-xs text-gray-500 text-center mt-4">
                  방송 중에 상품을 클릭하면<br />
                  실시간으로 화면에 표시됩니다
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4.4 상품 오버레이 컴포넌트 (OBS Browser Source용)

```tsx
// src/components/seller/ProductOverlay.tsx
import { useEffect, useState } from 'react';
import { useLiveStore } from '@/stores/useLiveStore';

export default function ProductOverlay() {
  const currentProduct = useLiveStore((state) => state.stream?.currentProduct);

  if (!currentProduct) {
    return null;
  }

  return (
    <div className="fixed bottom-8 right-8 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 max-w-md animate-slide-in">
      <div className="flex items-center gap-4">
        <img
          src={currentProduct.image}
          alt={currentProduct.name}
          className="w-24 h-24 object-cover rounded-lg"
        />
        
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">{currentProduct.name}</h3>
          
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-red-500">
              {currentProduct.discount}%
            </span>
            <span className="text-lg line-through text-gray-400">
              {currentProduct.price.toLocaleString()}원
            </span>
          </div>
          
          <div className="text-2xl font-bold text-gray-900 mb-3">
            {Math.floor(currentProduct.price * (1 - currentProduct.discount / 100)).toLocaleString()}원
          </div>
          
          <a
            href={currentProduct.buyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white text-center font-semibold rounded-lg hover:from-red-600 hover:to-pink-600 transition-all"
          >
            🛒 지금 구매하기
          </a>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
```

---

## 5. WebSocket 실시간 통신

```typescript
// src/services/websocketService.ts
class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(streamId: string) {
    const wsUrl = `ws://localhost:3000/ws/live/${streamId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebSocket] 연결됨');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'product_update':
          useLiveStore.getState().updateCurrentProduct(data.product);
          break;
        
        case 'viewer_count':
          console.log('현재 시청자:', data.count);
          break;
        
        case 'chat_message':
          console.log('채팅:', data.message);
          break;
      }
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] 연결 끊김');
      this.attemptReconnect(streamId);
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] 에러:', error);
    };
  }

  private attemptReconnect(streamId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocket] 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => this.connect(streamId), 3000);
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export default new WebSocketService();
```

---

## 6. 사용 방법

### 6.1 라우팅 설정

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LiveDashboard from './components/seller/LiveDashboard';
import ProductOverlay from './components/seller/ProductOverlay';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/seller/live" element={<LiveDashboard />} />
        <Route path="/overlay" element={<ProductOverlay />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 6.2 OBS Browser Source 설정

1. OBS Studio 열기
2. Sources → Add → Browser
3. URL: `http://localhost:5173/overlay`
4. Width: 1920, Height: 1080
5. Custom CSS (투명 배경):
   ```css
   body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }
   ```

---

## 7. 다음 단계

1. 백엔드 API 구현 (다음 문서 참조)
2. Prism Live Studio 딥링크 연동
3. WebRTC 웹 인코더 추가 (선택사항)
4. 모바일 최적화

