# 토스페이먼츠 결제 내역 갑자기 나타난 이유 분석

## 📊 사용자 질문
> "오, 이제 테스트 로그와 결제 내역에 찍혀 2026-02-13 02:17:35 - ORDER_1770916654032_MC40MjY3NTg1MDM0NjIx 만료 정지원 46,500 원 - 지리산 설날 떡국떡 파격 할인가
> 이 때부터의 내역이 찍히기 시작했는데 갑자기 나온 이유와 이 때부터 나온 이유 각각 알고싶어."

## 🔍 타임라인 분석

### 📅 2026-02-13 01:25:54 (KST 10:25)
**커밋: 68fae924** - `fix: Switch to API individual integration keys (MID: urteamizy1)`
```
- Client Key: test_gck_* → test_ck_* (API 개별연동 키로 변경)
- Secret Key: test_gsk_* → test_sk_* (API 개별연동 키로 변경)
- 이유: Payment Widget 키가 MID urteamizy1과 매칭되지 않음
```

**❌ 문제:** 이 커밋에서 **잘못된 키로 변경**했습니다!
- `test_ck_*` / `test_sk_*` 키는 **API 개별연동(Payment API)** 전용
- `test_gck_*` / `test_gsk_*` 키는 **결제위젯(Payment Widget)** 전용
- 결제위젯 코드에서 API 개별연동 키를 사용하니 `INVALID_API_KEY` 에러 발생!

### 📅 2026-02-13 02:36:19 (KST 11:36)
**커밋: e32f0d0c** - `Fix: 모든 Toss Payments API 버전을 2022-11-16으로 통일`
```
- API 버전을 2022-11-16으로 통일 (결제위젯 시크릿 키 전용)
```

**⚠️ 여전히 문제:** API 버전은 맞췄지만, 여전히 **API 개별연동 키** 사용 중!

### 📅 2026-02-13 02:53:09 (KST 11:53) ✅ 핵심!
**커밋: b9ecdb08** - `Fix: 결제위젯 SDK를 v2에서 v1으로 수정`
```diff
✅ index.html: SDK URL 변경
-   <script src="https://js.tosspayments.com/v2/standard"></script>
+   <script src="https://js.tosspayments.com/v1/payment-widget"></script>

✅ CheckoutPage.tsx: API 객체 변경
-   window.TossPayments (V2 API)
+   window.PaymentWidget (V1 Widget)

✅ 메서드 변경
-   setAmount() → updateAmount()
-   async 메서드 → 동기 메서드
```

**🎯 이 커밋이 중요한 이유:**
1. **SDK 버전을 V1으로 되돌림** → `test_gck_*` / `test_gsk_*` 키 사용 가능해짐
2. **PaymentWidget 객체 사용** → 결제위젯 전용 키와 호환
3. **하지만!** 여전히 `test_ck_*` / `test_sk_*` 키가 코드에 남아있어서 에러!

### 📅 2026-02-13 03:07~03:34 (KST 12:07~12:34)
**여러 커밋들:** V1 메서드 동기화, 공식 샘플 코드 매칭
```
166a80d: V1 renderAgreement 동기 메서드로 수정 (await 제거)
d7765ab: totalAmount 의존성 제거, requestPayment await 제거
37dd441: PaymentWidget() 함수 호출, on('ready') 이벤트 추가
```

**⚠️ 여전히 문제:** 코드는 완벽해졌지만, **Cloudflare 환경변수 TOSS_SECRET_KEY**가
여전히 `test_sk_*` (API 개별연동 키)로 설정되어 있음!

### 📅 2026-02-13 10:17:35 (KST 19:17) 🎉 성공!
**ORDER_1770916654032_MC40MjY3NTg1MDM0NjIx 생성됨!**

**배포 작업:** Cloudflare 환경변수 업데이트
```bash
echo "test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY" | \
  npx wrangler pages secret put TOSS_SECRET_KEY --project-name toss-live-commerce
```

**✅ 성공 이유:**
1. **Cloudflare 환경변수**를 올바른 결제위젯 시크릿 키로 업데이트
2. `test_sk_*` (API 개별연동) → `test_gsk_*` (결제위젯) 변경
3. 배포 완료 → https://282b2d38.toss-live-commerce.pages.dev

---

## 📝 정리: 왜 갑자기 나왔나?

### 1️⃣ 왜 이전에는 안 나왔나?
```
원인: 잘못된 키 조합 사용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frontend (CheckoutPage)      Backend (/api/payments/confirm)
────────────────────────────────────────────
test_gck_P9BRQ... (결제위젯)  test_sk_eDU7G... (API 개별연동) ❌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

결과: INVALID_API_KEY 에러!
- Frontend: 결제위젯 클라이언트 키로 결제 요청 생성
- Backend: API 개별연동 시크릿 키로 승인 시도
- Toss API: "이 두 키는 서로 다른 MID/Store에서 발급된 키입니다!" 🚫
```

### 2️⃣ 왜 2026-02-13 02:17:35부터 나왔나?
```
해결: 올바른 키 조합 사용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frontend (CheckoutPage)      Backend (/api/payments/confirm)
────────────────────────────────────────────
test_gck_P9BRQ... (결제위젯)  test_gsk_yL0qZ... (결제위젯) ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

결과: 결제 성공!
- Frontend: 결제위젯 클라이언트 키로 결제 요청 생성
- Backend: 결제위젯 시크릿 키로 승인 시도
- Toss API: "같은 MID/Store 키입니다! 승인 완료!" ✅
```

---

## 🎯 핵심 교훈

### 토스페이먼츠 키 종류
| 키 접두사 | 용도 | 페어링 | API 버전 |
|---------|------|--------|----------|
| `test_ck_*` / `test_sk_*` | **API 개별연동** (Payment API) | 반드시 같은 MID | 2022-11-16 |
| `test_gck_*` / `test_gsk_*` | **결제위젯** (Payment Widget) | 반드시 같은 MID | 2022-11-16 |

### ⚠️ 절대 안 되는 조합
```
❌ test_gck_* (결제위젯 클라이언트) + test_sk_* (API 개별연동 시크릿)
❌ test_ck_* (API 개별연동 클라이언트) + test_gsk_* (결제위젯 시크릿)
```

### ✅ 반드시 지켜야 하는 원칙
1. **Frontend와 Backend 키는 반드시 같은 종류를 사용**
2. **Cloudflare 환경변수 설정 후 반드시 재배포**
3. **키 변경 시 반드시 코드와 환경변수 모두 확인**

---

## 📊 최종 설정 (현재)

### Frontend (CheckoutPage.tsx)
```typescript
const clientKey = 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'; // ✅ 결제위젯 키
const paymentWidget = PaymentWidget(clientKey, customerKey);
```

### Backend (Cloudflare Secret)
```bash
TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY  # ✅ 결제위젯 키
```

### 백엔드 코드 (src/index.tsx)
```typescript
// API 버전도 2022-11-16으로 통일 (결제위젯 전용 버전)
headers: {
  'Authorization': 'Basic ' + btoa(secretKey + ':'),
  'Content-Type': 'application/json',
  'TossPayments-API-Version': '2022-11-16'
}
```

---

## ✅ 결론

**갑자기 나온 이유:**
- Cloudflare Secret `TOSS_SECRET_KEY`를 `test_sk_*` (API 개별연동)에서
  `test_gsk_*` (결제위젯)으로 변경한 순간!

**이 때부터 나온 이유:**
- Frontend와 Backend가 모두 **결제위젯 전용 키 페어**를 사용하게 되어
  토스페이먼츠 API가 정상적으로 키를 인증하고 결제를 승인!

**교훈:**
- 토스페이먼츠는 **키 종류(API 개별연동 vs 결제위젯)**가 매우 중요!
- Frontend와 Backend 키는 **반드시 같은 MID/Store에서 발급된 같은 종류**여야 함!
- 환경변수 변경 후에는 **반드시 재배포** 필요!
