# 향후 구현 필요 항목 📋

마지막 업데이트: 2026-02-19

---

## 🚀 즉시 가능 단계 (1-2주 내)

### 1️⃣ YouTube Live API 자동 생성 기능 활성화 ⏸️ **[보류 중]**

**현재 상태:**
- ✅ 백엔드 API 구현 완료
- ✅ 프론트엔드 UI 구현 완료
- ❌ YouTube OAuth Token 설정 필요

**구현된 기능:**
- `POST /api/seller/youtube/create-live` - YouTube 라이브 자동 생성
- `POST /api/seller/youtube/end-live/:streamId` - YouTube 라이브 자동 종료
- `GET /api/seller/youtube/stats/:streamId` - 실시간 통계 조회
- `GET /api/seller/youtube/chat/:streamId` - 채팅 메시지 조회
- SellerStreamNewPage에 "YouTube 자동 생성" 모드 추가

**필요한 작업:**
1. Google Cloud Console 설정
   - YouTube Data API v3 활성화
   - OAuth 2.0 클라이언트 ID 생성
   - Authorized redirect URIs 설정

2. OAuth Access Token 발급
   - OAuth Playground 또는 자체 OAuth 플로우
   - Scopes: `youtube`, `youtube.force-ssl`

3. Cloudflare Secret 등록
   ```bash
   npx wrangler secret put YOUTUBE_ACCESS_TOKEN
   npx wrangler secret put YOUTUBE_API_KEY  # (선택사항)
   ```

**장점:**
- 셀러가 YouTube Studio 접속 불필요
- 모든 작업이 UR-Live 내에서 완결
- OBS 스트림 키 자동 발급
- 시간 절약 (10분 → 3분)

**현재 사용 가능한 방식:**
- ✅ **수동 URL 입력 방식** (기존 방식)
  - 셀러가 자신의 YouTube 계정에서 라이브 생성
  - UR-Live에 YouTube URL 입력
  - 정상 작동 중

**우선순위:** 🟡 중간 (OAuth 설정 필요 시 활성화)

---

### 2️⃣ Cloudflare R2 활성화 (이미지 업로드) 🔴 **[높음]**

**현재 상태:**
- ✅ 프론트엔드 이미지 압축 라이브러리 설치 (`browser-image-compression`)
- ✅ ImageUpload 컴포넌트 구현 완료
- ✅ SellerProductNewPage, SellerProductEditPage에 적용
- ❌ Cloudflare R2 버킷 미생성

**필요한 작업:**
1. Cloudflare Dashboard에서 R2 활성화
2. R2 버킷 생성
   ```bash
   npx wrangler r2 bucket create ur-live-images
   ```
3. wrangler.jsonc에 R2 설정 추가 (주석 해제)
4. 이미지 업로드 API 엔드포인트 구현
   - `POST /api/seller/upload-image` - R2에 이미지 업로드
   - `GET /api/images/:key` - R2에서 이미지 가져오기

**예상 비용:**
- 무료 티어: 10GB 저장, 10GB 다운로드
- 약 320명 셀러 지원 가능 (셀러당 20개 상품 × 2개 이미지 × 800KB)

**우선순위:** 🔴 높음

---

### 3️⃣ 알림 벨 UI 컴포넌트 🟡 **[중간]**

**현재 상태:**
- ✅ 백엔드 알림 API 5개 구현 완료
- ✅ 알림 자동 생성 (주문, 배송, 재고 부족)
- ❌ 프론트엔드 알림 벨 UI 미구현

**필요한 작업:**
1. NotificationBell 컴포넌트 생성
   - 헤더 우측 상단에 벨 아이콘
   - 읽지 않은 알림 배지 표시
   - 드롭다운으로 최근 알림 표시

2. 실시간 알림 업데이트
   - 5초마다 `/api/notifications` 호출 (polling)
   - 또는 WebSocket 연결 (고급)

3. 알림 클릭 시 해당 페이지로 이동
   - 주문 알림 → `/seller/orders`
   - 배송 알림 → `/user/orders`
   - 재고 알림 → `/seller/products`

**우선순위:** 🟡 중간

---

## 📈 중요 단계 (2-4주)

### 4️⃣ 리뷰 시스템 🟢 **[낮음]**

**필요한 기능:**
- 상품 리뷰 작성/수정/삭제
- 별점 평가 (1-5점)
- 사진 첨부
- 베스트 리뷰 선정
- 셀러 답글 기능

**DB 테이블:**
- `reviews` (id, product_id, user_id, rating, content, images, created_at)
- `review_replies` (id, review_id, seller_id, content, created_at)

**우선순위:** 🟢 낮음

---

### 5️⃣ 쿠폰 시스템 🟡 **[중간]**

**필요한 기능:**
- 쿠폰 생성 (할인율, 할인금액, 최소 주문금액)
- 쿠폰 코드 발급
- 쿠폰 적용 (장바구니, 결제)
- 쿠폰 사용 내역
- 기간 제한 쿠폰

**DB 테이블:**
- `coupons` (id, code, type, value, min_order, valid_from, valid_until)
- `coupon_usages` (id, coupon_id, user_id, order_id, used_at)

**우선순위:** 🟡 중간

---

### 6️⃣ 포인트 시스템 🟡 **[중간]**

**필요한 기능:**
- 주문 시 포인트 적립 (주문 금액의 1-5%)
- 포인트 사용 (결제 시 차감)
- 포인트 내역 조회
- 포인트 만료 (1년)
- 이벤트 포인트 지급

**DB 테이블:**
- `points` (id, user_id, amount, type, order_id, expires_at, created_at)
- 사용자별 포인트 잔액 계산

**우선순위:** 🟡 중간

---

### 7️⃣ 찜하기/위시리스트 🟢 **[낮음]**

**필요한 기능:**
- 상품 찜하기/취소
- 찜한 상품 목록 조회
- 찜한 상품 가격 변동 알림
- 찜한 상품 재고 알림

**DB 테이블:**
- `wishlists` (id, user_id, product_id, created_at)

**우선순위:** 🟢 낮음

---

## 🚀 고급 단계 (2개월 이상)

### 8️⃣ WebRTC 자체 스트리밍 🔴 **[높음, 장기]**

**현재 방식:**
- YouTube 임베드 방식 사용
- 2-5초 지연

**WebRTC 방식:**
- UR-Live 자체 스트리밍 서버
- 0.5초 이하 지연
- 실시간 채팅 통합
- 커스터마이징 가능

**필요한 기술:**
- WebRTC 서버 (Janus, Kurento, Jitsi)
- TURN/STUN 서버
- 비디오 인코딩/디코딩
- CDN 연동

**예상 비용:**
- 서버 비용: $100-500/월
- CDN 비용: 트래픽에 따라 증가
- 개발 기간: 2-3개월

**우선순위:** 🔴 높음 (장기 목표)

---

### 9️⃣ VOD (다시보기) 기능 🟡 **[중간]**

**필요한 기능:**
- 라이브 방송 자동 녹화
- VOD 목록 관리
- 타임스탬프 북마크
- 특정 상품 구간 표시
- VOD 공유 기능

**저장소:**
- Cloudflare Stream (비디오 스트리밍)
- 또는 R2 (저장) + Workers (스트리밍)

**예상 비용:**
- Cloudflare Stream: $5/월 + $1/1000분

**우선순위:** 🟡 중간

---

### 🔟 AI 추천 시스템 🟢 **[낮음, 장기]**

**필요한 기능:**
- 사용자 행동 기반 상품 추천
- 유사 상품 추천
- 라이브 방송 추천
- 개인화된 메인 페이지

**기술 스택:**
- Cloudflare AI Workers
- 협업 필터링 알고리즘
- 또는 외부 ML API (OpenAI, Anthropic)

**우선순위:** 🟢 낮음 (장기 목표)

---

## 📊 우선순위 요약

| 순위 | 항목 | 우선순위 | 예상 기간 | 비용 |
|------|------|----------|-----------|------|
| 1 | R2 이미지 업로드 | 🔴 높음 | 1-2일 | ~₩6,000/월 |
| 2 | 알림 벨 UI | 🟡 중간 | 2-3일 | 무료 |
| 3 | YouTube 자동 생성 활성화 | 🟡 중간 | 1일 | 무료 (OAuth 설정만) |
| 4 | 쿠폰 시스템 | 🟡 중간 | 1주 | 무료 |
| 5 | 포인트 시스템 | 🟡 중간 | 1주 | 무료 |
| 6 | 리뷰 시스템 | 🟢 낮음 | 1-2주 | 무료 |
| 7 | 위시리스트 | 🟢 낮음 | 3-5일 | 무료 |
| 8 | VOD 다시보기 | 🟡 중간 | 2-3주 | ~₩10,000/월 |
| 9 | WebRTC 스트리밍 | 🔴 높음 | 2-3개월 | ~$200/월 |
| 10 | AI 추천 시스템 | 🟢 낮음 | 1-2개월 | ~₩50,000/월 |

---

## 💡 다음 작업 추천 순서

1. **R2 이미지 업로드** (1-2일) - 셀러 경험 개선
2. **알림 벨 UI** (2-3일) - 사용자 편의성 향상
3. **쿠폰 시스템** (1주) - 마케팅 도구
4. **포인트 시스템** (1주) - 고객 충성도 향상
5. **YouTube 자동 생성 활성화** (OAuth 설정 시) - 셀러 편의성
6. **WebRTC 스트리밍** (장기 목표) - 경쟁력 강화

---

**문서 작성일:** 2026-02-19  
**다음 업데이트 예정:** 구현 완료 시 체크 ✅
