# Toss Payments 결제위젯 연동 키 발급 가이드

## 🔑 현재 상황

**보유 중인 키**: API 개별 연동 키
- 클라이언트 키: `test_ck_d46qopOB89Okomkvlm6aVZmM75y0`
- 시크릿 키: `test_sk_DpexMgkW36b45d1zkdDJ3GbR5ozO`

**필요한 키**: 결제위젯 연동 키
- 클라이언트 키: `test_gck_xxx` (아직 없음)
- 시크릿 키: `test_gsk_xxx` (아직 없음)

---

## 📝 결제위젯 연동 키 발급 방법

### Step 1: Toss Payments 개발자센터 접속
```
URL: https://developers.tosspayments.com/
로그인: 기존 계정으로 로그인
```

### Step 2: API 키 페이지 접속
```
1. 개발자센터 → [내 개발정보]
2. [API 키] 메뉴 클릭
3. https://developers.tosspayments.com/my/api-keys
```

### Step 3: 결제위젯 연동 키 확인
```
페이지 상단에 두 가지 키 세트가 있습니다:
┌─────────────────────────────────────────┐
│ 결제위젯 연동 키                          │ ← 이것 필요!
│ - 테스트 클라이언트 키: test_gck_xxx     │
│ - 테스트 시크릿 키: test_gsk_xxx         │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ API 개별 연동 키                          │ ← 현재 보유
│ - 테스트 클라이언트 키: test_ck_xxx      │
│ - 테스트 시크릿 키: test_sk_xxx          │
└─────────────────────────────────────────┘
```

### Step 4: 키 복사
```
1. "결제위젯 연동 키" 섹션 찾기
2. 테스트 클라이언트 키 복사 (test_gck_로 시작)
3. 테스트 시크릿 키 복사 (test_gsk_로 시작)
```

---

## 🚀 발급 후 설정 방법

### 1. .env 파일 업데이트
```bash
# 결제위젯 연동 키로 변경
VITE_TOSS_CLIENT_KEY=test_gck_[발급받은_키]
TOSS_SECRET_KEY=test_gsk_[발급받은_키]
```

### 2. Cloudflare Pages 환경변수 설정
```
1. Cloudflare Dashboard 접속
2. Pages → toss-live-commerce 선택
3. Settings → Environment variables
4. Production 환경에 추가:
   - Variable name: VITE_TOSS_CLIENT_KEY
   - Value: test_gck_[발급받은_키]
   
   - Variable name: TOSS_SECRET_KEY
   - Value: test_gsk_[발급받은_키]

5. Preview 환경에도 동일하게 추가
6. Save 클릭
```

### 3. 재배포
```bash
cd /home/user/webapp
npm run build
npx wrangler pages deploy dist --project-name toss-live-commerce
```

### 4. 테스트
```
1. https://live.ur-team.com/checkout 접속
2. 로그인: user@example.com / user123
3. 장바구니에 상품 담기
4. 결제 페이지 확인
5. 결제 위젯 로드 확인
```

---

## ⚠️ 결제위젯 연동 키가 없는 경우

만약 개발자센터에 "결제위젯 연동 키" 섹션이 없다면:

### 해결 방법
```
1. 전자결제 신청 필요
   - 개발자센터 → [전자결제 신청]
   - 간단한 정보 입력으로 신청 가능
   
2. 또는 개발 연동 체험 상점 사용
   - 신청 없이 테스트 가능
   - 일부 기능 제한 있을 수 있음
```

---

## 🔄 대안: API 개별 연동 키 사용 (코드 변경 필요)

결제위젯 연동 키를 발급받을 수 없다면, 현재 보유한 API 개별 연동 키를 사용하도록 코드를 변경해야 합니다.

### 필요한 변경
1. **SDK 교체**: `@tosspayments/payment-widget-sdk` → `@tosspayments/payment-sdk`
2. **초기화 변경**: `loadPaymentWidget()` → `loadTossPayments()`
3. **결제 요청 변경**: `requestPayment()` 로직 변경
4. **CheckoutPage.tsx 전면 수정**

이 방법은 복잡하므로 **결제위젯 연동 키 발급을 강력히 권장**합니다.

---

## 📊 키 비교

| 항목 | 결제위젯 연동 키 | API 개별 연동 키 |
|------|-----------------|------------------|
| 형식 | test_gck_xxx / test_gsk_xxx | test_ck_xxx / test_sk_xxx |
| 사용 SDK | `@tosspayments/payment-widget-sdk` | `@tosspayments/payment-sdk` |
| 초기화 | `loadPaymentWidget()` | `loadTossPayments()` |
| UI | 자동 (위젯) | 수동 (커스텀) |
| 브랜드페이 | 통합 | 별도 SDK |
| 난이도 | 쉬움 | 복잡 |
| 현재 코드 | ✅ 호환 | ❌ 변경 필요 |

---

## 🎯 다음 단계

### 1. 결제위젯 연동 키 확인
- [ ] Toss Payments 개발자센터 로그인
- [ ] API 키 페이지 접속
- [ ] 결제위젯 연동 키 섹션 확인

### 2. 키 복사 및 설정
- [ ] 테스트 클라이언트 키 복사 (test_gck_xxx)
- [ ] 테스트 시크릿 키 복사 (test_gsk_xxx)
- [ ] .env 파일 업데이트
- [ ] Cloudflare Pages 환경변수 설정

### 3. 배포 및 테스트
- [ ] 재빌드
- [ ] 재배포
- [ ] 결제 위젯 로드 확인
- [ ] 테스트 결제 진행

---

**작성일**: 2026-02-11  
**작성자**: AI Assistant

**🔑 결제위젯 연동 키를 발급받으면 즉시 테스트 가능합니다!**
