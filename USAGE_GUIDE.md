# 토스 라이브 커머스 - 실제 사용 가이드

## 📺 현재 사용 가능한 기능

### ✅ 작동하는 것
1. 라이브 스트림 목록 보기
2. YouTube 라이브 영상 시청
3. 실시간 상품 전환 (관리자)
4. 상품 정보 표시 (가격, 옵션, 재고)
5. 장바구니 추가 (API만)
6. 관리자 대시보드

### ❌ 작동하지 않는 것
1. 라이브 스트림 등록 UI (SQL 직접 입력 필요)
2. 상품 등록 UI (SQL 직접 입력 필요)
3. 장바구니 페이지 (UI 없음)
4. 결제 기능 (미완성)
5. 로그인 기능 (하드코딩)

---

## 🚀 실제 사용 흐름 (데모용)

### 관리자 워크플로우

#### 1. 라이브 스트림 생성 (수동)
```bash
# 데이터베이스에 직접 입력
cd /home/user/webapp
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO live_streams (title, description, youtube_video_id, status) 
VALUES ('새로운 라이브', '봄 시즌 특가', 'YOUR_YOUTUBE_VIDEO_ID', 'live');
"
```

#### 2. 상품 등록 (수동)
```bash
# 상품 추가
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO products (name, price, original_price, discount_rate, stock, live_stream_id) 
VALUES ('새로운 상품', 50000, 80000, 37, 100, 1);
"
```

#### 3. 관리자 대시보드 사용
```
1. https://.../admin 접속
2. 진행 중인 라이브 확인
3. 상품 목록에서 "이 상품으로 전환" 클릭
4. 시청자 화면에 즉시 반영됨 (3초 이내)
```

### 시청자 워크플로우

#### 1. 라이브 참여
```
1. https://.../ (메인) 접속
2. LIVE 배지 있는 방송 클릭
3. /live/1 페이지 이동
```

#### 2. 상품 보기 및 구매 시도
```
1. 하단 바텀시트에서 상품 확인
2. 옵션 선택 (색상, 사이즈)
3. "장바구니" 버튼 클릭
   → 장바구니 추가 성공! (API 작동)
   → 우측 하단 뱃지 숫자 증가
4. 장바구니 버튼 클릭
   → /cart 페이지로 이동 시도
   → ❌ 페이지 없음 (404)
```

---

## 🛠️ 완전한 사용을 위해 필요한 구현

### Priority 1: 관리자 기능
- [ ] 라이브 스트림 생성 UI
- [ ] 상품 등록/수정/삭제 UI
- [ ] 라이브 시작/종료 기능

### Priority 2: 구매자 기능
- [ ] 장바구니 페이지
- [ ] 결제 페이지
- [ ] 주문 내역 페이지
- [ ] 토스 로그인

### Priority 3: 부가 기능
- [ ] 실시간 채팅
- [ ] 찜하기
- [ ] 상품 검색

---

## 💡 빠른 테스트 방법

### 데이터 확인
```bash
# 라이브 스트림 확인
curl https://.../api/streams

# 현재 상품 확인
curl https://.../api/streams/1/current-product

# 장바구니 확인
curl https://.../api/cart/toss_user_001
```

### 관리자 테스트
```
1. /admin 접속
2. 상품 전환 버튼 클릭
3. 다른 브라우저에서 /live/1 열어서 확인
   → 3초 이내 자동 업데이트됨
```

---

## 🎯 다음 단계

실제 사용 가능한 시스템으로 만들려면:

1. **관리자 UI 완성**
   - 라이브 생성
   - 상품 관리
   
2. **구매 플로우 완성**
   - 장바구니 페이지
   - 결제 연동
   
3. **사용자 인증**
   - 토스 로그인

어떤 기능부터 구현할까요?
