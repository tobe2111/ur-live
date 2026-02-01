# 토스 라이브 커머스 (Toss Live Commerce)

## 🎯 프로젝트 개요

**토스 인앱 서비스(Apps in Toss)를 위한 실시간 라이브 커머스 플랫폼**

유튜브 라이브 스트리밍과 실시간 상품 전환 기능을 결합한 폐쇄몰 라이브 커머스 시스템입니다. 방송자가 실시간으로 상품을 변경하면 시청자의 화면에 즉시 반영되며, seamless한 장바구니 경험을 제공합니다.

## 🌐 공개 URL

- **데모 사이트**: https://3000-idza9aonokj4y1prq2vkt-b32ec7bb.sandbox.novita.ai
- **라이브 스트림**: https://3000-idza9aonokj4y1prq2vkt-b32ec7bb.sandbox.novita.ai/live/1
- **관리자 대시보드**: https://3000-idza9aonokj4y1prq2vkt-b32ec7bb.sandbox.novita.ai/admin

## ✨ 주요 기능

### ✅ 현재 구현된 기능

#### 1. 실시간 라이브 스트리밍
- ✅ YouTube Live API 연동
- ✅ 영상 이탈 없는 플로팅 상품 바텀시트
- ✅ 실시간 시청자 수 표시
- ✅ WebSocket 기반 실시간 통신

#### 2. 실시간 상품 전환 시스템
- ✅ Cloudflare Durable Objects를 통한 WebSocket 서버
- ✅ 관리자 상품 전환 시 모든 시청자에게 즉시 브로드캐스트
- ✅ 새로고침 없는 상품 정보 업데이트
- ✅ 상품 변경 시 자동 알림 및 바텀시트 확장

#### 3. Seamless 장바구니
- ✅ 실시간 장바구니 상태 관리
- ✅ 이전/현재 상품 자유롭게 담기
- ✅ 장바구니 개수 실시간 뱃지 표시
- ✅ 상품 옵션 선택 (색상, 사이즈 등)

#### 4. 관리자 대시보드
- ✅ 진행 중인 라이브 스트림 관리
- ✅ 원클릭 상품 전환 기능
- ✅ 실시간 상품 목록 및 재고 확인
- ✅ 현재 소개 중인 상품 표시

#### 5. 데이터베이스 (Cloudflare D1)
- ✅ 라이브 스트림 관리
- ✅ 상품 및 옵션 관리
- ✅ 사용자 및 장바구니
- ✅ 주문 및 결제 내역

### 🚧 구현 예정 기능

#### 6. 토스 브릿지 API 결제 연동
- ⏳ 토스페이 간편결제 연동
- ⏳ 주문서 페이지
- ⏳ 결제 승인 및 실패 처리
- ⏳ 결제 내역 조회

## 🏗️ 시스템 아키텍처

### 기술 스택

```
Frontend:
├── HTML5 + Tailwind CSS (토스 디자인 시스템 스타일)
├── Vanilla JavaScript (ES6+)
├── YouTube IFrame API
└── WebSocket Client

Backend:
├── Hono (Cloudflare Workers 프레임워크)
├── Cloudflare D1 (SQLite 기반 관계형 DB)
├── Cloudflare Durable Objects (WebSocket 서버)
└── TypeScript

Infrastructure:
├── Cloudflare Pages (배포 플랫폼)
└── Cloudflare Workers (Edge Computing)
```

### 데이터 흐름도

```
┌─────────────────┐      WebSocket       ┌──────────────────────┐
│  시청자 브라우저  │◄──────────────────►│  Durable Object      │
│  (Live View)    │      실시간 통신      │  (WebSocket Server)  │
└─────────────────┘                      └──────────────────────┘
         ↓                                          ↑
         ↓ HTTP API                                 ↑ Broadcast
         ↓                                          ↑
┌─────────────────┐                      ┌──────────────────────┐
│   Hono Backend  │◄─────────────────────│  관리자 대시보드      │
│   (API Routes)  │   상품 전환 요청      │  (Admin Panel)      │
└─────────────────┘                      └──────────────────────┘
         ↓
         ↓ Database Operations
         ↓
┌─────────────────┐
│  Cloudflare D1  │
│  (SQLite DB)    │
└─────────────────┘
```

### WebSocket 실시간 통신 구조

```javascript
// 메시지 타입
{
  type: 'product_change',     // 상품 전환
  type: 'viewer_count',       // 시청자 수 업데이트
  type: 'cart_update',        // 장바구니 변경
  type: 'stream_status'       // 스트림 상태 변경
}

// 상품 전환 메시지 예시
{
  type: 'product_change',
  data: {
    product: { id, name, price, ... },
    options: [{ id, type, value, ... }]
  },
  timestamp: 1706872800000
}
```

## 📊 데이터 모델

### 주요 테이블

```sql
-- 라이브 스트림
live_streams (id, title, youtube_video_id, status, current_product_id)

-- 상품
products (id, name, price, discount_rate, stock, live_stream_id)

-- 상품 옵션
product_options (id, product_id, option_type, option_value, stock)

-- 사용자
users (id, toss_user_id, name, email)

-- 장바구니
cart_items (id, user_id, product_id, option_id, quantity)

-- 주문
orders (id, order_number, user_id, total_amount, payment_status)
```

## 🚀 API 엔드포인트

### 라이브 스트림 API
- `GET /api/streams` - 진행 중인 라이브 목록
- `GET /api/streams/:id` - 라이브 스트림 상세 정보
- `GET /api/streams/:streamId/products` - 라이브의 상품 목록

### 상품 API
- `GET /api/products/:id` - 상품 상세 정보 (옵션 포함)

### 장바구니 API
- `GET /api/cart/:userId` - 장바구니 조회
- `POST /api/cart` - 장바구니 추가
- `DELETE /api/cart/:cartItemId` - 장바구니 삭제

### 주문 API
- `GET /api/orders/:userId` - 주문 내역 조회
- `POST /api/orders` - 주문 생성

### WebSocket API
- `GET /api/ws/:streamId` - WebSocket 연결 (업그레이드)

### 관리자 API
- `POST /api/admin/streams/:streamId/change-product` - 상품 전환

## 📱 토스 인앱 서비스 가이드라인 준수

### 1. 디자인 (TDS 기반)
- ✅ 토스 브랜드 컬러 사용 (#3182F6)
- ✅ 라이트 모드 전용 (다크모드 미지원)
- ✅ 핀치줌 비활성화 (viewport 설정)
- ✅ 명도 대비 충분한 UI
- ✅ 터치 영역 확보 (최소 44px)

### 2. 내비게이션 바
- ✅ 토스 표준 내비게이션 바 구조
- ✅ 뒤로가기, 브랜드 로고, 더보기, 닫기 버튼

### 3. 서비스 이용 및 동작
- ✅ 2초 이내 반응 속도
- ✅ 재접속 시 데이터 유지 (장바구니)
- ✅ 모든 컴포넌트 정상 작동
- ✅ 리스트 정렬/검색/필터링 기능

### 4. 접근성
- ✅ 명도 대비 준수
- ✅ 터치 영역 확보
- ✅ 애니메이션 속도 적절
- ✅ 스크린 리더 고려

### 5. 보안
- ✅ HTTPS 통신
- ✅ SQL Injection 방지 (Prepared Statements)
- ✅ XSS 방지 (입력 검증)

### 6. 데이터 사용량 최적화
- ✅ CDN 기반 라이브러리 사용
- ✅ 경량 이미지 (WebP 권장)
- ✅ WebSocket 메시지 최소화
- ✅ D1 쿼리 최적화 (인덱스 사용)

## 🎨 UI/UX 설계

### 메인 페이지
- 진행 중인 라이브 스트림 카드 목록
- LIVE 뱃지 표시
- YouTube 썸네일 미리보기

### 라이브 스트림 페이지
```
┌──────────────────────────┐
│   YouTube Live Video     │  ← 16:9 영상 플레이어
│                          │
└──────────────────────────┘
┌──────────────────────────┐
│  👁 123명 시청 중         │  ← 시청자 수 (실시간)
└──────────────────────────┘
┌──────────────────────────┐
│  [상품 플로팅 바텀시트]    │  ← 드래그로 확장/축소
│  ━━━━━━━━                │
│  상품 이미지              │
│  상품명, 가격             │
│  옵션 선택               │
│  [장바구니] [바로 구매]    │
└──────────────────────────┘
                     [🛒]   ← 장바구니 플로팅 버튼
```

### 관리자 대시보드
- 진행 중인 라이브 정보
- 상품 목록 (카드 형식)
- 원클릭 상품 전환 버튼
- 현재 소개 중인 상품 강조

## 💻 개발 환경 설정

### 필수 요구사항
- Node.js 18+
- npm 10+
- Wrangler CLI

### 로컬 개발

```bash
# 1. 의존성 설치
npm install

# 2. 데이터베이스 마이그레이션
npm run db:migrate:local

# 3. 시드 데이터 로드
npm run db:seed

# 4. 빌드
npm run build

# 5. 개발 서버 시작
npm run dev:d1
# 또는 PM2 사용
pm2 start ecosystem.config.cjs
```

### 데이터베이스 관리

```bash
# 로컬 마이그레이션 적용
npm run db:migrate:local

# 프로덕션 마이그레이션 적용
npm run db:migrate:prod

# 시드 데이터 로드
npm run db:seed

# 데이터베이스 리셋
npm run db:reset

# 로컬 데이터베이스 콘솔
npm run db:console:local
```

## 🚀 배포 가이드

### Cloudflare Pages 배포

```bash
# 1. Cloudflare API 설정 (최초 1회)
# GenSpark에서 setup_cloudflare_api_key 도구 사용

# 2. 프로덕션 데이터베이스 생성
npx wrangler d1 create webapp-production

# 3. wrangler.jsonc에 database_id 설정
# d1_databases[0].database_id = "실제-database-id"

# 4. 프로덕션 마이그레이션
npm run db:migrate:prod

# 5. Cloudflare Pages 프로젝트 생성
npx wrangler pages project create webapp --production-branch main

# 6. 배포
npm run deploy:prod
```

### 환경 변수 설정

프로덕션 배포 시 필요한 환경 변수:

```bash
# 토스 브릿지 API 키 (구현 예정)
npx wrangler pages secret put TOSS_CLIENT_KEY --project-name webapp
npx wrangler pages secret put TOSS_SECRET_KEY --project-name webapp
```

## 🔧 핵심 코드 스니펫

### 1. 실시간 상품 업데이트 (클라이언트)

```javascript
// WebSocket 연결
const ws = new WebSocket(`wss://${host}/api/ws/${streamId}`);

// 상품 변경 메시지 수신
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'product_change') {
    // 상품 정보 업데이트
    updateProduct(message.data);
    // UI 반영
    renderProduct();
    // 알림 표시
    showNotification('새로운 상품이 소개됩니다!');
  }
};
```

### 2. 관리자 상품 전환 (서버)

```typescript
// 관리자가 상품 전환 요청
app.post('/api/admin/streams/:streamId/change-product', async (c) => {
  const { productId } = await c.req.json();
  
  // 1. 상품 정보 조회
  const product = await DB.prepare(
    'SELECT * FROM products WHERE id = ?'
  ).bind(productId).first();
  
  // 2. Durable Object를 통해 모든 시청자에게 브로드캐스트
  const stub = LIVE_STREAM.get(id);
  await stub.fetch(new Request('/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: 'product_change',
      data: { product, options },
    }),
  }));
});
```

### 3. Durable Object WebSocket 서버

```typescript
export class LiveStreamDurableObject extends DurableObject {
  private sessions: Set<WebSocket>;

  handleSession(webSocket: WebSocket) {
    webSocket.accept();
    this.sessions.add(webSocket);
    
    // 메시지 브로드캐스트
    webSocket.addEventListener('message', (msg) => {
      this.broadcast(JSON.parse(msg.data));
    });
  }

  broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((session) => {
      session.send(messageStr);
    });
  }
}
```

## 📋 토스 심사 통과 전략

### 필수 체크리스트

#### 1. 디자인 준수
- [x] 라이트 모드 전용
- [x] 핀치줌 비활성화
- [x] 토스 브랜드 컬러 사용
- [x] 명도 대비 충분
- [x] 터치 영역 확보

#### 2. 기능 검증
- [x] 2초 이내 반응 속도
- [x] 재접속 시 데이터 유지
- [x] 모든 버튼/컴포넌트 작동
- [x] 에러 핸들링

#### 3. 토스 로그인 (구현 예정)
- [ ] 토스 로그인 SDK 연동
- [ ] 인트로 화면 제공
- [ ] 약관 동의 플로우
- [ ] 로그아웃 처리

#### 4. 토스페이 결제 (구현 예정)
- [ ] 토스페이 전용 결제
- [ ] 주문/결제 금액 일치
- [ ] 결제 성공/실패 처리
- [ ] 결제 내역 조회

#### 5. 보안
- [x] HTTPS 통신
- [x] SQL Injection 방지
- [x] XSS 방지
- [x] 입력 검증

#### 6. 성능
- [x] 빠른 로딩 속도
- [x] 메모리 누수 방지
- [x] 데이터 사용량 최적화

### 심사 반려 시 대응 방안

#### 공통 반려 사유
1. **자사 앱/웹 유도**: 외부 링크 모두 제거, 토스 내에서 완결
2. **다크모드 미준수**: 라이트 모드 전용 명시
3. **로딩 속도 느림**: 이미지 최적화, CDN 사용, 코드 스플리팅
4. **결제 수단 미준수**: 토스페이 전용 사용

#### 보안 이슈
- API 키 노출 방지 (환경 변수 사용)
- SQL Injection 방지 (Prepared Statements)
- XSS 방지 (입력 검증 및 이스케이프)

## 🎯 다음 단계 개발 계획

### Phase 1: 토스 브릿지 API 연동 (우선순위 높음)
- [ ] 토스 로그인 SDK 연동
- [ ] 토스페이 간편결제 연동
- [ ] 주문서 페이지 구현
- [ ] 결제 승인/실패 처리
- [ ] 결제 내역 조회 페이지

### Phase 2: 추가 기능 (우선순위 중)
- [ ] 실시간 채팅 기능
- [ ] 찜하기 / 위시리스트
- [ ] 주문 배송 추적
- [ ] 푸시 알림 연동
- [ ] 프로모션 쿠폰

### Phase 3: 고도화 (우선순위 낮음)
- [ ] AI 추천 시스템
- [ ] 라이브 리플레이
- [ ] 통계 대시보드
- [ ] 다국어 지원

## 📞 지원 및 문의

- **개발자**: GenSpark AI Assistant
- **프로젝트 타입**: 토스 인앱 서비스 (Apps in Toss)
- **기술 스택**: Hono + Cloudflare Pages + D1 + Durable Objects
- **배포 플랫폼**: Cloudflare Pages

## 📄 라이선스

이 프로젝트는 토스 인앱 서비스 데모 목적으로 제작되었습니다.

---

**최종 업데이트**: 2026-02-01
**버전**: 1.0.0
**상태**: 개발 중 (토스페이 결제 연동 예정)
