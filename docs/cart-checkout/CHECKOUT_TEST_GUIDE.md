# 체크아웃 페이지 테스트 가이드

## 📋 목차
1. [테스트 계정 준비](#테스트-계정-준비)
2. [결제 화면 접속 방법](#결제-화면-접속-방법)
3. [예상 결과](#예상-결과)
4. [트러블슈팅](#트러블슈팅)

---

## 1. 테스트 계정 준비

### 로그인 필수!
체크아웃 페이지는 **로그인이 필수**입니다. 로그인하지 않으면 자동으로 로그인 페이지로 리다이렉트됩니다.

### 테스트 계정 정보
```
이메일: user@example.com
비밀번호: user123
```

### 로그인 URL
```
https://live.ur-team.com/login
```

---

## 2. 결제 화면 접속 방법

### 방법 1: 전체 흐름 테스트 (권장)

1. **로그인**
   - https://live.ur-team.com/login
   - 계정: `user@example.com` / `user123`

2. **Live 방송 페이지 접속**
   - https://live.ur-team.com/live

3. **상품 장바구니에 담기**
   - Live 방송 화면 하단의 상품 목록에서
   - "장바구니 담기" 버튼 클릭

4. **장바구니 페이지 이동**
   - 우측 상단 장바구니 아이콘 클릭
   - 또는 https://live.ur-team.com/cart

5. **결제 페이지 이동**
   - 장바구니에서 "구매하기" 버튼 클릭
   - 또는 https://live.ur-team.com/checkout

### 방법 2: 직접 접속

```
https://live.ur-team.com/checkout
```

**주의**: 장바구니에 상품이 없으면 결제 화면이 제대로 표시되지 않을 수 있습니다.

---

## 3. 예상 결과

### ✅ 정상 작동 시

#### 1. 배송지 정보 표시
- 등록된 배송지 목록
- 새 배송지 추가 버튼

#### 2. 주문 상품 정보
```
예시:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
[상품 이미지]
프리미엄 헤드폰
옵션: 블랙
수량: 1
가격: 150,000원
배송비: 3,000원 (셀러별)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 3. 결제 금액 요약
```
상품금액        150,000원
배송비           3,000원
━━━━━━━━━━━━━━━━━━━━━━━━━━━
총 결제금액     153,000원
(부가세 포함)
```

#### 4. Toss Payments 결제 위젯
- **카드 결제** 옵션
- **계좌이체** 옵션
- **가상계좌** 옵션
- **휴대폰 결제** 옵션
- ~~브랜드페이~~ (테스트 환경에서는 미지원)

#### 5. 이용약관 동의
- 자동으로 렌더링된 체크박스

#### 6. 결제하기 버튼
```
[결제하기]  ← 활성화 상태
```

### ❌ 오류 발생 시

#### 1. 로그인 페이지로 리다이렉트
- **원인**: 로그인하지 않음
- **해결**: 위의 테스트 계정으로 로그인

#### 2. "결제 준비 중..." 멈춤
- **원인**: Toss SDK 로드 실패
- **해결**: F12 콘솔에서 에러 확인

#### 3. "등록할 수 있는 결제 수단이 존재하지 않습니다"
- **원인**: 브랜드페이 설정 문제 (이미 해결됨)
- **현재 상태**: 카드/계좌이체/가상계좌/휴대폰 결제만 표시

---

## 4. 트러블슈팅

### 🔍 브라우저 콘솔 로그 확인

#### F12 → Console 탭에서 다음 로그를 확인하세요:

```javascript
// ✅ 정상 로그
[CheckoutPage] Step 1: Loading TossPayments...
[CheckoutPage] Step 1 Success: TossPayments loaded
[CheckoutPage] Step 2: Setting amount...
[CheckoutPage] Step 2 Success: Amount set to 153000
[CheckoutPage] Step 3: Rendering payment UI...
[CheckoutPage] Step 3 Success: UI rendered
```

```javascript
// ❌ 오류 로그
[CheckoutPage] Failed to load TossPayments: ...
[CheckoutPage] Failed to set amount: ...
[CheckoutPage] Failed to render UI: ...
```

### 🛠️ 주요 오류 해결 방법

#### 1. "clientKey가 설정되지 않았습니다"
```bash
# 환경변수 확인
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

#### 2. "totalAmount가 0원입니다"
- 장바구니에 상품을 먼저 담으세요
- 최소 금액: 100원 이상

#### 3. "위젯이 초기화되지 않았습니다"
- 페이지 새로고침 (Ctrl + Shift + R)
- 브라우저 캐시 삭제

#### 4. 배송지 선택 불가
- 배송지를 먼저 등록하세요
- "새 배송지 추가" 버튼 클릭

---

## 5. 배송비 정책 확인

### 셀러별 배송비 설정

```sql
-- 셀러 A: 기본 배송비 3,000원
SELECT shipping_fee FROM sellers WHERE id = 1;  -- 3000

-- 셀러 B: 배송비 2,500원, 30,000원 이상 무료
SELECT shipping_fee, free_shipping_threshold FROM sellers WHERE id = 2;
-- 2500, 30000

-- 셀러 C: 항상 무료 배송
SELECT shipping_fee FROM sellers WHERE id = 3;  -- 0
```

### 배송비 계산 예시

#### Case 1: 단일 셀러 주문
```
상품 A (셀러 1): 50,000원
배송비: 3,000원
────────────────
총액: 53,000원
```

#### Case 2: 여러 셀러 주문
```
상품 A (셀러 1): 30,000원 → 배송비 3,000원
상품 B (셀러 2): 20,000원 → 배송비 2,500원
────────────────────────────────────────
총액: 55,500원
```

#### Case 3: 무료배송 조건 충족
```
상품 A (셀러 2): 35,000원 → 배송비 0원 (30,000원 이상)
상품 B (셀러 2): 15,000원 → 배송비 0원 (합산 50,000원)
────────────────────────────────────────
총액: 50,000원
```

---

## 6. 다음 단계

### 실제 결제 테스트

1. **테스트 카드번호 사용**
   - Toss Payments 테스트 카드번호 사용
   - https://docs.tosspayments.com/reference/test

2. **결제 승인 확인**
   - `/payment/success` 페이지로 리다이렉트
   - 주문 내역 DB 저장 확인

3. **주문 조회**
   - 마이페이지 → 주문내역
   - 또는 `/orders` 페이지

---

## 7. 관련 문서

- [Toss Payments 공식 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration?frontend=react)
- [셀러별 배송비 설정 가이드](./SELLER_SHIPPING_FEE_GUIDE.md)
- [공식 SDK 마이그레이션 가이드](./OFFICIAL_SDK_MIGRATION.md)
- [결제 위젯 디버그 가이드](./PAYMENT_DEBUG_GUIDE.md)

---

## 8. 지원

### 문의
- **Toss Payments**: 1544-7772
- **이메일**: support@tosspayments.com

### 배포 URL
- **Preview**: https://5728dec9.toss-live-commerce.pages.dev
- **Production**: https://live.ur-team.com

---

## ✅ 체크리스트

테스트 전 확인사항:

- [ ] 테스트 계정으로 로그인
- [ ] 장바구니에 상품 추가
- [ ] 배송지 등록
- [ ] F12 콘솔 열기
- [ ] 결제 페이지 접속
- [ ] 결제 위젯 로드 확인
- [ ] 결제 금액 확인
- [ ] 배송비 계산 확인
- [ ] 결제하기 버튼 활성화 확인

모든 항목이 체크되면 테스트 준비 완료! 🎉
