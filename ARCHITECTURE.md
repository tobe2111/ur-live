# 토스 라이브 커머스 시스템 아키텍처 문서

## 1. 전체 시스템 아키텍처

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 시청자 브라우저 │  │ 관리자 브라우저│  │  모바일 앱   │          │
│  │ (Live View)  │  │ (Admin Panel)│  │ (Toss App)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↓                  ↓                  ↓                  │
│    WebSocket           HTTP API         Toss Bridge              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌─────────────────────────────┐         │
│  │ Durable Objects  │  │    Hono Application         │         │
│  │ (WebSocket Srv)  │  │   (API Routes + SSR)        │         │
│  └──────────────────┘  └─────────────────────────────┘         │
│           ↓                        ↓                             │
│    State Management          Business Logic                      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌─────────────────────────────┐         │
│  │  Cloudflare D1   │  │   External Services         │         │
│  │  (SQLite DB)     │  │   - YouTube Live API        │         │
│  │                  │  │   - Toss Payments API       │         │
│  └──────────────────┘  └─────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 실시간 상품 전환 메커니즘

### 2.1 WebSocket 통신 흐름

```
관리자 (상품 전환 요청)
    │
    │ POST /api/admin/streams/1/change-product
    │ { productId: 2 }
    ↓
┌──────────────────────────────────────┐
│      Hono Backend (Worker)           │
│                                      │
│  1. 상품 정보 조회 (D1)               │
│  2. 라이브 스트림 업데이트             │
│  3. Durable Object 호출              │
└──────────────────────────────────────┘
    │
    │ HTTP Request to Durable Object
    │ POST /broadcast
    │ { type: 'product_change', data: {...} }
    ↓
┌──────────────────────────────────────┐
│   Durable Object (WebSocket Server)  │
│                                      │
│  1. 메시지 수신                       │
│  2. 현재 상품 상태 업데이트            │
│  3. 모든 연결된 세션에 브로드캐스트    │
└──────────────────────────────────────┘
    │
    │ WebSocket.send()
    │ (모든 시청자에게 동시 전송)
    ↓
┌──────────────────────────────────────┐
│   시청자 브라우저 (N명)                │
│                                      │
│  1. WebSocket 메시지 수신             │
│  2. 상품 정보 파싱                    │
│  3. UI 업데이트 (새로고침 없음)        │
│  4. 알림 표시                         │
└──────────────────────────────────────┘
```

### 2.2 시간 순서도 (Sequence Diagram)

```
관리자      Hono API      D1 DB      Durable Object    시청자 (N명)
  │            │            │              │                │
  │ 상품 전환   │            │              │                │
  │───────────>│            │              │                │
  │            │ 상품 조회   │              │                │
  │            │───────────>│              │                │
  │            │<───────────│              │                │
  │            │ 스트림 업데이트│            │                │
  │            │───────────>│              │                │
  │            │            │  브로드캐스트 │                │
  │            │───────────────────────────>│                │
  │            │            │              │ 메시지 전송     │
  │            │            │              │───────────────>│
  │            │            │              │───────────────>│
  │            │            │              │───────────────>│
  │<───────────│            │              │                │
  │  응답      │            │              │                │
  │            │            │              │                │  UI 업데이트
  │            │            │              │                │  (실시간)
```

## 3. Durable Object 상세 설계

### 3.1 LiveStreamDurableObject 클래스 구조

```typescript
class LiveStreamDurableObject {
  // 상태 관리
  private sessions: Set<WebSocket>      // 연결된 WebSocket 세션들
  private viewerCount: number           // 현재 시청자 수
  private currentProduct: Product       // 현재 소개 중인 상품

  // 생명주기 메서드
  constructor(state, env)
  
  // 요청 처리
  async fetch(request): Promise<Response>
    - WebSocket 업그레이드
    - HTTP API (브로드캐스트, 상태 조회)
  
  // WebSocket 관리
  handleSession(webSocket)
    - 세션 등록
    - 메시지 수신 처리
    - 연결 종료 처리
  
  // 브로드캐스트
  broadcast(message)
    - 모든 세션에 메시지 전송
    - 실패한 세션 제거
  
  broadcastViewerCount()
    - 시청자 수 업데이트 전송
}
```

### 3.2 WebSocket 메시지 프로토콜

```typescript
// 메시지 타입 정의
type WSMessageType = 
  | 'product_change'      // 상품 전환
  | 'viewer_count'        // 시청자 수 업데이트
  | 'cart_update'         // 장바구니 변경
  | 'stream_status'       // 스트림 상태 변경
  | 'chat_message';       // 채팅 메시지

// 기본 메시지 구조
interface WSMessage {
  type: WSMessageType;
  data: any;
  timestamp: number;
}

// 상품 전환 메시지
interface ProductChangeMessage {
  type: 'product_change';
  data: {
    product: {
      id: number;
      name: string;
      price: number;
      image_url: string;
      // ...
    };
    options: Array<{
      id: number;
      option_type: string;
      option_value: string;
      // ...
    }>;
  };
  timestamp: number;
}
```

## 4. 데이터베이스 스키마

### 4.1 ER Diagram

```
┌─────────────────┐         ┌─────────────────┐
│  live_streams   │1       *│    products     │
│─────────────────│────────>│─────────────────│
│ id (PK)         │         │ id (PK)         │
│ title           │         │ name            │
│ youtube_vid     │         │ price           │
│ status          │         │ stock           │
│ current_prod_id │         │ live_stream_id  │
└─────────────────┘         └─────────────────┘
                                    │1
                                    │
                                    │*
                            ┌───────────────────┐
                            │ product_options   │
                            │───────────────────│
                            │ id (PK)           │
                            │ product_id (FK)   │
                            │ option_type       │
                            │ option_value      │
                            │ stock             │
                            └───────────────────┘

┌─────────────────┐         ┌─────────────────┐
│     users       │1       *│   cart_items    │
│─────────────────│────────>│─────────────────│
│ id (PK)         │         │ id (PK)         │
│ toss_user_id    │         │ user_id (FK)    │
│ name            │         │ product_id (FK) │
│ email           │         │ option_id (FK)  │
└─────────────────┘         │ quantity        │
      │1                    └─────────────────┘
      │
      │*
┌─────────────────┐         ┌─────────────────┐
│     orders      │1       *│   order_items   │
│─────────────────│────────>│─────────────────│
│ id (PK)         │         │ id (PK)         │
│ order_number    │         │ order_id (FK)   │
│ user_id (FK)    │         │ product_id (FK) │
│ total_amount    │         │ quantity        │
│ payment_status  │         │ price           │
└─────────────────┘         └─────────────────┘
```

### 4.2 인덱스 전략

```sql
-- 성능 최적화를 위한 인덱스
CREATE INDEX idx_live_streams_status ON live_streams(status);
CREATE INDEX idx_products_live_stream ON products(live_stream_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_cart_items_user ON cart_items(user_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(payment_status);
CREATE INDEX idx_users_toss_id ON users(toss_user_id);
```

## 5. API 엔드포인트 명세

### 5.1 REST API

```
[라이브 스트림]
GET    /api/streams                - 진행 중인 라이브 목록
GET    /api/streams/:id            - 라이브 상세 정보
GET    /api/streams/:id/products   - 라이브의 상품 목록

[상품]
GET    /api/products/:id           - 상품 상세 (옵션 포함)

[장바구니]
GET    /api/cart/:userId           - 장바구니 조회
POST   /api/cart                   - 장바구니 추가
DELETE /api/cart/:cartItemId       - 장바구니 삭제

[주문]
GET    /api/orders/:userId         - 주문 내역
POST   /api/orders                 - 주문 생성

[관리자]
POST   /api/admin/streams/:id/change-product  - 상품 전환
```

### 5.2 WebSocket API

```
[연결]
GET    /api/ws/:streamId           - WebSocket 연결
       (Upgrade: websocket)

[메시지]
Client -> Server:
  - ping/pong (연결 유지)
  - 추가 메시지 타입 (향후 확장)

Server -> Client:
  - product_change: 상품 전환 알림
  - viewer_count: 시청자 수 업데이트
  - stream_status: 스트림 상태 변경
```

## 6. 프론트엔드 아키텍처

### 6.1 페이지 구조

```
/                               - 메인 (라이브 목록)
  │
  ├── /live/:streamId           - 라이브 스트림 뷰어
  │   ├── YouTube Player        - 영상 플레이어
  │   ├── Product Bottom Sheet  - 상품 플로팅 바텀시트
  │   └── Cart Floating Button  - 장바구니 버튼
  │
  ├── /cart                     - 장바구니
  │   ├── Cart Items List       - 장바구니 상품 목록
  │   ├── Shipping Form         - 배송 정보 입력
  │   └── Payment Button        - 결제 버튼
  │
  ├── /payment/success          - 결제 성공
  ├── /payment/fail             - 결제 실패
  │
  └── /admin                    - 관리자 대시보드
      ├── Current Stream Info   - 현재 라이브 정보
      └── Product List          - 상품 목록 및 전환
```

### 6.2 상태 관리

```javascript
// 라이브 스트림 페이지 상태
const liveState = {
  streamId: string,
  ws: WebSocket,
  currentProduct: Product | null,
  cart: CartItem[],
  userId: string,
  viewerCount: number,
  player: YouTubePlayer,
  sheetExpanded: boolean,
};

// 관리자 대시보드 상태
const adminState = {
  currentStream: LiveStream | null,
  products: Product[],
  selectedProductId: number | null,
};
```

## 7. 보안 고려사항

### 7.1 인증 및 권한

```
[시청자]
- 토스 로그인 (구현 예정)
- JWT 토큰 기반 세션 관리
- WebSocket 연결 시 토큰 검증

[관리자]
- 별도의 관리자 인증
- IP 화이트리스트 (옵션)
- API 키 기반 인증
```

### 7.2 데이터 보안

```
[전송 암호화]
- HTTPS 강제 (TLS 1.2+)
- WSS (WebSocket Secure)

[데이터베이스]
- Prepared Statements (SQL Injection 방지)
- 입력 검증 및 이스케이프
- 민감 정보 암호화 (결제 정보 등)

[API 보안]
- Rate Limiting
- CORS 정책
- XSS 방지
```

## 8. 성능 최적화

### 8.1 Cloudflare Edge 활용

```
[전역 배포]
- 전 세계 200+ 데이터센터
- 사용자와 가장 가까운 엣지에서 응답
- 낮은 레이턴시 (< 50ms)

[캐싱 전략]
- 정적 파일 CDN 캐싱
- API 응답 캐싱 (적절한 경우)
- 이미지 최적화 (Cloudflare Images)
```

### 8.2 데이터베이스 최적화

```
[쿼리 최적화]
- 인덱스 활용
- JOIN 최소화
- N+1 쿼리 방지

[연결 관리]
- D1의 자동 연결 풀링
- Prepared Statement 재사용
```

## 9. 모니터링 및 로깅

### 9.1 로그 수집

```
[애플리케이션 로그]
- console.log() → Cloudflare Workers Logs
- 에러 로그 별도 수집
- 성능 메트릭 (응답 시간, CPU 사용량)

[WebSocket 로그]
- 연결/종료 이벤트
- 메시지 전송/수신 통계
- 에러 발생 추적
```

### 9.2 알림

```
[중요 이벤트]
- 서버 에러 (5xx)
- 데이터베이스 오류
- WebSocket 연결 실패
- 높은 에러율
```

## 10. 확장 가능성

### 10.1 수평 확장

```
[Cloudflare 자동 스케일링]
- 요청량에 따라 자동 스케일
- 무제한 동시 연결 (Durable Objects)
- 글로벌 분산 처리
```

### 10.2 기능 확장

```
[향후 추가 기능]
- 실시간 채팅
- 좋아요/반응 이모지
- 라이브 리플레이
- AI 추천 시스템
- 다국어 지원
```

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-02-01
