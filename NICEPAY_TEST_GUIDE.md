# NicePay 결제 테스트 가이드
**작성일**: 2026-02-06  
**프로젝트**: 유어 라이브 커머스  
**테스트 환경**: Production (https://live.ur-team.com)

---

## 🎯 테스트 목적

NicePay 결제 시스템의 전체 흐름을 검증하고, 실제 운영 환경에서 정상 작동하는지 확인합니다.

---

## ✅ 사전 준비 체크리스트

### 1. 환경 변수 확인
```bash
# Cloudflare Pages Secrets 확인
npx wrangler pages secret list --project-name toss-live-commerce
```

**확인 사항**:
- ✅ `NICEPAY_CLIENT_ID`: R2_b5b7a7a3bcce40b19147228bf3f5c50e (운영용)
- ✅ `NICEPAY_SECRET_KEY`: 2cfdb18d599b453fbef70ee392269c8d
- ✅ `KAKAO_JS_KEY`: 975a2e7f97254b08f15dba4d177a2865

### 2. 배포 확인
- ✅ **Latest Deploy**: https://4e0ea937.toss-live-commerce.pages.dev
- ✅ **Production**: https://live.ur-team.com (5-10분 후 반영)
- ✅ **Git Commit**: 0b92455

### 3. API 엔드포인트 확인
```bash
# 헬스 체크
curl https://live.ur-team.com/api/streams
curl https://live.ur-team.com/api/products/1
```

---

## 📋 테스트 시나리오

### Phase 1: 사용자 인증 (예상 시간: 2분)

#### 1.1 로그인 테스트
1. **URL 접속**: https://live.ur-team.com/live/1
2. **로그인 버튼 클릭**
   - 위치: 화면 우측 상단 "로그인" 버튼
3. **Kakao 인증 진행**
   - 카카오 로그인 페이지로 리다이렉트 확인
   - 계정 선택 또는 로그인
   - 서비스 약관 동의 (최초 1회)
4. **로그인 성공 확인**
   - URL이 원래 페이지로 돌아왔는지 확인 (예: `/live/1?streamId=1`)
   - 우측 상단에 사용자 이름 표시 확인
   - "로그아웃" 버튼 표시 확인

**브라우저 콘솔 확인**:
```javascript
console.log('User ID:', localStorage.getItem('userId'));
console.log('User Name:', localStorage.getItem('userName'));
console.log('Session Token:', localStorage.getItem('sessionToken'));
```

**예상 결과**:
```
User ID: 10
User Name: 홍길동
Session Token: user_10_1738826400000_abc123
```

---

### Phase 2: 장바구니 담기 (예상 시간: 1분)

#### 2.1 상품 선택
1. **상품 카드 확인**
   - 화면 하단에 현재 방송 중인 상품 표시 확인
   - 상품 이미지, 이름, 가격 표시 확인
2. **"장바구니에 추가" 버튼 클릭**
3. **성공 메시지 확인**
   - "장바구니에 추가되었습니다!" 알림 확인

**브라우저 콘솔 확인**:
```javascript
console.log('Has Cart Items:', localStorage.getItem('hasCartItems'));
```

**예상 결과**:
```
Has Cart Items: true
```

---

### Phase 3: 장바구니 페이지 (예상 시간: 2분)

#### 3.1 장바구니 이동
1. **"결제하기" 버튼 클릭**
   - 위치: 라이브 페이지 우측 하단
2. **장바구니 페이지 로딩 확인**
   - URL: https://live.ur-team.com/cart

#### 3.2 장바구니 내용 확인
**확인 사항**:
- [ ] 장바구니 아이템 목록 표시
- [ ] 상품 이미지, 이름, 가격, 수량 표시
- [ ] 소계 및 배송비 계산 (배송비: 3,000원)
- [ ] 총 금액 계산

**브라우저 콘솔 확인**:
```javascript
console.log('Cart Items:', cartItems);
console.log('Total Amount:', document.getElementById('total').textContent);
```

#### 3.3 배송지 정보 입력
**입력 필드**:
- **받는 사람**: 홍길동
- **전화번호**: 010-1234-5678
- **주소**: 서울시 강남구 테헤란로 123
- **상세주소**: 101동 1001호
- **우편번호**: 06234

---

### Phase 4: 결제 프로세스 (예상 시간: 3-5분)

#### 4.1 결제 준비
1. **"결제하기" 버튼 클릭**
   - 위치: 장바구니 페이지 하단
2. **주문 생성 API 호출 확인**

**브라우저 콘솔 확인**:
```javascript
// 네트워크 탭에서 확인
POST /api/orders/create
Request Body:
{
  "userId": 10,
  "items": [...],
  "shippingAddress": { ... }
}

Response:
{
  "success": true,
  "orderNo": "ORD1738826400123",
  "totalAmount": 50000
}
```

#### 4.2 NicePay 결제창 확인
**확인 사항**:
- [ ] NicePay 결제창 팝업이 정상적으로 열림
- [ ] 주문 정보 표시 확인:
  - 주문번호: ORD1738826400123
  - 금액: 50,000원
  - 상품명: "테스트 상품 외 1건" (또는 단일 상품명)

**브라우저 콘솔 확인**:
```javascript
console.log('NICEPAY_CLIENT_ID:', window.NICEPAY_CLIENT_ID);
console.log('AUTHNICE loaded:', typeof AUTHNICE);
```

**예상 결과**:
```
NICEPAY_CLIENT_ID: R2_b5b7a7a3bcce40b19147228bf3f5c50e
AUTHNICE loaded: object
```

**결제창이 뜨지 않는 경우 디버깅**:
```javascript
// SDK 로드 확인
console.log('Script loaded:', document.querySelector('script[src*="nicepay.co.kr"]'));

// Client ID 주입 확인
console.log('Client ID:', window.NICEPAY_CLIENT_ID);
```

#### 4.3 테스트 카드 결제
**NicePay 테스트 카드 정보**:
- **카드번호**: 5465-7801-2345-6789 (NicePay 테스트 카드)
- **유효기간**: 12/25
- **CVV**: 123
- **생년월일**: 900101
- **비밀번호 앞 2자리**: 00

**또는 실제 카드 사용**:
- 본인 명의 신용/체크카드 사용 (실제 결제됨)
- 소액(1,000원 등) 테스트 권장

**결제 진행**:
1. 카드 정보 입력
2. "결제" 버튼 클릭
3. 3D Secure 인증 (필요시)
4. 결제 완료 대기

---

### Phase 5: 결제 결과 처리 (예상 시간: 1-2분)

#### 5.1 결제 결과 페이지 리다이렉트
**확인 사항**:
- [ ] `/payment-result` 페이지로 자동 리다이렉트
- [ ] "결제 처리 중입니다..." 메시지 표시
- [ ] 로딩 스피너 표시

**브라우저 콘솔 확인**:
```javascript
// URL 파라미터 확인
const urlParams = new URLSearchParams(window.location.search);
console.log('Result Code:', urlParams.get('resultCode'));
console.log('TID:', urlParams.get('tid'));
console.log('Order ID:', urlParams.get('orderId'));
console.log('Amount:', urlParams.get('amount'));
console.log('Auth Token:', urlParams.get('authToken'));
```

**예상 결과**:
```
Result Code: 0000
TID: NICEPAY_TID_2026020612345678
Order ID: ORD1738826400123
Amount: 50000
Auth Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 5.2 서버 승인 API 호출
**네트워크 탭에서 확인**:
```javascript
POST /api/payments/nicepay/callback
Request Body:
{
  "AuthResultCode": "0000",
  "AuthResultMsg": "정상처리",
  "TID": "NICEPAY_TID_2026020612345678",
  "Amt": "50000",
  "Moid": "ORD1738826400123",
  "AuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response (성공):
{
  "success": true,
  "orderNumber": "ORD1738826400123",
  "tid": "NICEPAY_TID_2026020612345678",
  "amount": 50000
}
```

**Cloudflare Workers 로그 확인** (별도 터미널):
```bash
npx wrangler pages deployment tail --project-name toss-live-commerce --format pretty
```

**예상 로그**:
```
[NicePay Callback] 결제 인증 결과: {
  AuthResultCode: '0000',
  TID: 'NICEPAY_TID_2026020612345678',
  Moid: 'ORD1738826400123'
}
[NicePay Approval] 승인 요청: {
  url: 'https://api.nicepay.co.kr/v1/payments/approval',
  tid: 'NICEPAY_TID_2026020612345678',
  amt: '50000',
  ediDate: '20260206'
}
[NicePay Approval] ✅ 결제 승인 완료: orderNumber=ORD1738826400123, tid=NICEPAY_TID_2026020612345678
```

#### 5.3 주문 완료 페이지 리다이렉트
**확인 사항**:
- [ ] `/order-complete?orderNo=ORD1738826400123` 페이지로 리다이렉트
- [ ] 주문 번호 표시: "ORD1738826400123"
- [ ] 결제 금액 표시: "50,000원"
- [ ] "주문 내역 보기" 버튼 표시

---

### Phase 6: 주문 내역 확인 (예상 시간: 2분)

#### 6.1 주문 내역 페이지 이동
1. **"주문 내역 보기" 버튼 클릭**
   - 위치: 주문 완료 페이지
2. **URL 확인**: https://live.ur-team.com/my-orders

#### 6.2 주문 목록 확인
**확인 사항**:
- [ ] 방금 결제한 주문이 목록 최상단에 표시
- [ ] 주문 정보 표시:
  - 주문 번호: ORD1738826400123
  - 주문 날짜: 2026.02.06
  - 결제 상태: "승인됨" (초록색 배지)
  - 총 금액: 50,000원
  - 상품 이미지

#### 6.3 주문 상세 모달
1. **"상세 보기" 버튼 클릭**
2. **모달 내용 확인**:
   - [ ] 주문 번호
   - [ ] 주문 날짜
   - [ ] 결제 상태
   - [ ] 배송지 정보 (이름, 전화번호, 주소)
   - [ ] 주문 아이템 목록 (상품명, 수량, 가격)
   - [ ] 가격 요약 (소계, 배송비, 총액)

---

## 🔍 데이터베이스 검증

### 주문 데이터 확인
```bash
# D1 콘솔 접속
npx wrangler d1 execute toss-live-commerce-db --command "
SELECT 
  order_number, 
  total_amount, 
  payment_status, 
  payment_key,
  created_at
FROM orders 
WHERE order_number = 'ORD1738826400123'
"
```

**예상 결과**:
```
┌──────────────────────┬──────────────┬────────────────┬─────────────────────────────┬────────────────────────┐
│ order_number         │ total_amount │ payment_status │ payment_key                 │ created_at             │
├──────────────────────┼──────────────┼────────────────┼─────────────────────────────┼────────────────────────┤
│ ORD1738826400123     │ 50000        │ approved       │ NICEPAY_TID_2026020612345678│ 2026-02-06 12:30:00    │
└──────────────────────┴──────────────┴────────────────┴─────────────────────────────┴────────────────────────┘
```

### 장바구니 비우기 확인
```bash
npx wrangler d1 execute toss-live-commerce-db --command "
SELECT COUNT(*) as cart_count
FROM cart_items 
WHERE user_id = 10
"
```

**예상 결과**:
```
┌────────────┐
│ cart_count │
├────────────┤
│ 0          │
└────────────┘
```

---

## ⚠️ 문제 해결 가이드

### 문제 1: 결제창이 뜨지 않음

**증상**:
- "결제하기" 버튼 클릭 후 아무 반응 없음
- 콘솔 에러: `AUTHNICE is not defined`

**원인 및 해결**:
1. **NicePay SDK 로드 실패**
```javascript
// 브라우저 콘솔에서 확인
console.log('SDK Script:', document.querySelector('script[src*="nicepay.co.kr"]'));
```
- **해결**: 페이지 새로고침 또는 네트워크 확인

2. **Client ID 주입 실패**
```javascript
console.log('Client ID:', window.NICEPAY_CLIENT_ID);
```
- **해결**: `/cart` 라우트 확인, 환경 변수 재확인

### 문제 2: 결제 승인 실패

**증상**:
- 결제창에서 결제 완료했으나 "결제에 실패했습니다" 메시지
- `/order-complete` 페이지로 이동하지 않음

**원인 및 해결**:
1. **서버 승인 API 에러**
```bash
# Worker 로그 확인
npx wrangler pages deployment tail --project-name toss-live-commerce
```
- 로그에서 `[NicePay Approval]` 에러 메시지 확인

2. **환경 변수 오류**
```bash
# Secret 확인
npx wrangler pages secret list --project-name toss-live-commerce

# 필요시 재설정
echo "R2_b5b7a7a3bcce40b19147228bf3f5c50e" | npx wrangler pages secret put NICEPAY_CLIENT_ID --project-name toss-live-commerce
echo "2cfdb18d599b453fbef70ee392269c8d" | npx wrangler pages secret put NICEPAY_SECRET_KEY --project-name toss-live-commerce
```

3. **서명 검증 실패**
```javascript
// 네트워크 탭에서 응답 확인
{
  "success": false,
  "error": "서명 검증 실패"
}
```
- **원인**: Secret Key 불일치
- **해결**: Secret Key 재확인 및 재설정

### 문제 3: 금액 불일치

**증상**:
- 콘솔 로그: "결제 금액이 일치하지 않습니다"
- HTTP 400 응답

**원인**:
- 클라이언트에서 전송한 금액과 서버 DB의 주문 금액 불일치

**해결**:
```bash
# 주문 금액 확인
npx wrangler d1 execute toss-live-commerce-db --command "
SELECT order_number, total_amount 
FROM orders 
WHERE order_number = 'ORD1738826400123'
"
```
- 주문 생성 로직 재확인
- 배송비 계산 로직 확인

### 문제 4: 주문 내역 페이지 404

**증상**:
- `/my-orders` 접속 시 404 에러

**원인 및 해결**:
1. **라우트 미등록**
```bash
# _routes.json 확인
cat dist/_routes.json
```
- `/my-orders`가 include 목록에 있는지 확인

2. **정적 파일 없음**
```bash
# 파일 확인
ls -la public/static/my-orders.html
ls -la public/static/my-orders.js
```
- 파일이 없으면 재빌드

3. **Worker 라우트 미등록**
```bash
# src/index.tsx에서 라우트 확인
grep "app.get('/my-orders'" src/index.tsx
```

**해결**:
```bash
# 재빌드 및 배포
npm run build
npx wrangler pages deploy dist --project-name toss-live-commerce
```

---

## 📊 테스트 결과 기록

### 테스트 환경
- **날짜**: _______________
- **테스터**: _______________
- **브라우저**: Chrome / Safari / Firefox (선택)
- **기기**: Desktop / Mobile (선택)

### Phase 1: 사용자 인증
- [ ] 로그인 성공
- [ ] 사용자 이름 표시
- [ ] 세션 저장 확인

### Phase 2: 장바구니 담기
- [ ] 장바구니 추가 성공
- [ ] 알림 메시지 표시

### Phase 3: 장바구니 페이지
- [ ] 장바구니 아이템 표시
- [ ] 금액 계산 정확성
- [ ] 배송지 입력 완료

### Phase 4: 결제 프로세스
- [ ] 주문 생성 성공
- [ ] NicePay 결제창 정상 작동
- [ ] Client ID 정상 주입
- [ ] 테스트/실제 결제 완료

### Phase 5: 결제 결과 처리
- [ ] 결과 페이지 리다이렉트
- [ ] 서버 승인 API 성공
- [ ] Workers 로그 정상
- [ ] 주문 완료 페이지 이동

### Phase 6: 주문 내역 확인
- [ ] 주문 목록 표시
- [ ] 주문 상세 모달 작동
- [ ] 결제 상태 정확성

### 데이터베이스 검증
- [ ] 주문 데이터 저장 확인
- [ ] 장바구니 비우기 확인
- [ ] payment_status = 'approved'

---

## ✅ 테스트 완료 체크리스트

- [ ] 모든 Phase 테스트 통과
- [ ] 에러 없이 전체 흐름 완료
- [ ] 데이터베이스 데이터 정확성 확인
- [ ] 로그 정상 출력 확인
- [ ] 사용자 경험 만족스러움

---

## 🚀 다음 단계

테스트 완료 후:
1. ✅ **결과 보고서 작성** (이 문서 작성 완료)
2. 🔄 **발견된 이슈 수정**
3. 🎯 **다음 우선순위 작업 진행**:
   - Phase B: 주문 내역 페이지 완성 ✅ (완료)
   - Phase C: 상품 상세 페이지 구현
   - Phase D: 에러 처리 개선

---

## 📚 참고 문서

- **NicePay 구현 가이드**: `/home/user/webapp/NICEPAY_FINAL_IMPLEMENTATION.md`
- **구현 상태 보고서**: `/home/user/webapp/IMPLEMENTATION_STATUS.md`
- **남은 작업 목록**: `/home/user/webapp/REMAINING_TASKS.md`
- **Kakao Sync 리뷰**: `/home/user/webapp/KAKAO_SYNC_REVIEW.md`

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2026-02-06  
**문서 버전**: 1.0
