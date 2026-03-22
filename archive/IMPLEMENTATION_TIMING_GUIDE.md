# 🎯 결제 시스템 고도화 & 운영 전환 타이밍 가이드

## 📋 현재 상태
- ✅ **핵심 결제 플로우**: 100% 완성
- ✅ **테스트 환경**: 토스페이먼츠 테스트 API로 작동
- ✅ **PG 추상화**: 다른 PG사 전환 준비 완료

---

## ⏰ 구현 타이밍 가이드

### 🔴 **즉시 필요 (운영 전 필수)**

#### 1. 운영 키 전환 ⭐⭐⭐ **[PG 승인 후 즉시]**
**시점**: 토스페이먼츠(또는 다른 PG) 사업자 승인 완료 후

**왜 필요한가?**
- 테스트 키는 실제 결제 불가
- 운영 환경에서 실제 고객 결제 받으려면 필수

**작업 내용** (30분):
```bash
# 1. 토스페이먼츠 대시보드에서 운영 키 발급
# 2. 환경 변수만 교체
VITE_TOSS_CLIENT_KEY=live_gck_xxx  # 프론트엔드
wrangler secret put TOSS_SECRET_KEY  # 백엔드 → live_gsk_xxx 입력

# 3. 배포
npm run build
npm run deploy

# 4. 실제 카드로 100원 결제 테스트
```

**🚨 주의**: 코드 수정 없음! 환경 변수만 바꾸면 됨

---

#### 2. 결제 취소/환불 API ⭐⭐⭐ **[운영 오픈 전]**
**시점**: 실제 서비스 오픈 1주일 전

**왜 필요한가?**
- 고객이 "주문 취소" 버튼 누르면 결제도 취소되어야 함
- 법적으로 7일 이내 청약철회 의무

**작업 내용** (2-3시간):
```typescript
// 1. 백엔드 API 추가
app.post('/api/orders/:orderId/cancel', async (c) => {
  const orderId = c.req.param('orderId');
  const { cancelReason } = await c.req.json();

  // 주문 조회
  const order = await DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId).first();

  // 결제 취소 (PG 추상화 사용)
  const provider = PaymentProviderFactory.createProvider('tosspayments', secretKey);
  await provider.cancelPayment(order.payment_key, cancelReason);

  // DB 업데이트
  await DB.prepare('UPDATE orders SET status = "cancelled" WHERE id = ?')
    .bind(orderId).run();

  // 재고 복원
  // ...

  return c.json({ success: true });
});

// 2. 프론트엔드 UI 추가 (MyOrdersPage)
// "주문 취소" 버튼 → POST /api/orders/:orderId/cancel
```

**언제 구현?**
- ✅ **Beta 테스트 중**: 선택 사항 (관리자가 수동 처리)
- ✅ **정식 오픈 전**: 필수 (고객 셀프 취소 필요)

---

#### 3. 에러 모니터링 (Sentry) ⭐⭐ **[운영 오픈 전]**
**시점**: 실제 서비스 오픈 1주일 전

**왜 필요한가?**
- 운영 중 결제 실패 시 즉시 알림 받아야 함
- 고객 문의 전에 선제 대응

**작업 내용** (1시간):
```bash
# 1. Sentry 가입 (무료)
# 2. DSN 발급

# 3. 환경 변수 추가
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_DSN=https://xxx@sentry.io/xxx

# 4. 결제 API에 에러 트래킹 추가
try {
  await provider.confirmPayment(...);
} catch (err) {
  Sentry.captureException(err);  // ← 추가
  console.error('결제 실패:', err);
}
```

**언제 구현?**
- ✅ **Beta 테스트 중**: 선택 사항
- ✅ **정식 오픈 전**: 강력 권장

---

### 🟡 **빠를수록 좋음 (사용자 경험)**

#### 4. 가상계좌 웹훅 처리 ⭐⭐ **[가상계좌 결제 지원 시]**
**시점**: 가상계좌 결제 방식 활성화 전

**왜 필요한가?**
- 가상계좌는 즉시 입금 안됨 (1-3일 소요)
- 입금 완료 시 주문 상태를 자동으로 업데이트해야 함

**작업 내용** (3-4시간):
```typescript
// 웹훅 엔드포인트
app.post('/api/payments/webhook', async (c) => {
  const body = await c.req.json();
  
  // 토스페이먼츠 웹훅 검증
  // ...

  if (body.eventType === 'VIRTUAL_ACCOUNT_DEPOSITED') {
    // 주문 상태 업데이트
    await DB.prepare(`
      UPDATE orders 
      SET status = 'paid', payment_status = 'completed'
      WHERE order_no = ?
    `).bind(body.orderId).run();

    // 재고 차감 (가상계좌는 입금 후 차감)
    // ...
  }

  return c.json({ success: true });
});
```

**토스페이먼츠 대시보드 설정**:
```
웹훅 URL: https://live.ur-team.com/api/payments/webhook
```

**언제 구현?**
- ❌ **카드 결제만**: 불필요
- ✅ **가상계좌 지원**: 필수

---

#### 5. 주문 상태 관리 시스템 ⭐⭐ **[배송 시작 후]**
**시점**: 첫 주문 배송 시작 전

**왜 필요한가?**
- 고객이 "배송 조회" 하려면 주문 상태 필요
- 셀러가 "배송 시작" 버튼 눌러야 함

**작업 내용** (4-6시간):
```typescript
// 주문 상태 전환
// pending → paid → preparing → shipping → delivered

// 셀러가 배송 시작 처리
app.post('/api/seller/orders/:orderId/ship', async (c) => {
  const { trackingNumber, carrier } = await c.req.json();
  
  await DB.prepare(`
    UPDATE orders 
    SET status = 'shipping',
        tracking_number = ?,
        carrier = ?,
        shipped_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(trackingNumber, carrier, orderId).run();

  return c.json({ success: true });
});

// 프론트엔드: 셀러 주문 관리 페이지
// "배송 시작" 버튼 + 운송장 번호 입력
```

**언제 구현?**
- ✅ **첫 주문 전**: 권장
- ✅ **주문 10개 이상**: 필수 (수동 관리 힘듦)

---

### 🟢 **천천히 구현 (비즈니스 성장 후)**

#### 6. 결제 수단 다양화 ⭐ **[사용자 요청 시]**
**시점**: 고객이 "이 결제 수단 추가해주세요" 요청 후

**현재 지원**:
- ✅ 카드 결제
- ✅ 간편결제 (네이버페이, 카카오페이 등)
- ✅ 가상계좌
- ✅ 계좌이체

**추가 가능**:
- 휴대폰 결제
- 페이팔 (해외 결제)
- 무통장 입금

**작업 내용**: 토스페이먼츠 설정만 변경 (코드 수정 없음)

**언제 구현?**
- ✅ **사용자 요청 시**
- ✅ **특정 결제 수단 선호도 높을 때**

---

#### 7. 정산 시스템 ⭐ **[셀러 10명 이상]**
**시점**: 셀러가 많아지고 정산 문의가 빈번할 때

**왜 필요한가?**
- 셀러에게 판매 금액 자동 정산
- 수수료 계산 자동화

**작업 내용** (1-2일):
```typescript
// settlements 테이블 생성
// 셀러별 정산 내역 조회 API
// 정산 요청/승인 플로우
// 세금계산서 자동 발행 (바로빌 연동)
```

**언제 구현?**
- ❌ **셀러 1-5명**: 불필요 (수동 정산)
- ✅ **셀러 10명 이상**: 권장
- ✅ **셀러 50명 이상**: 필수

---

#### 8. 실시간 알림 (폴링) ⭐ **[사용자 요청 시]**
**시점**: "실시간으로 보고 싶어요" 피드백 받은 후

**현재**: 페이지 새로고침 시 업데이트
**개선**: 10초마다 자동 업데이트

**작업 내용** (2-3시간):
```typescript
// LivePage에 폴링 추가
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await axios.get(`/api/live-streams/${streamId}`);
    setCurrentProduct(response.data.current_product);
  }, 10000);  // 10초마다
  
  return () => clearInterval(interval);
}, [streamId]);
```

**언제 구현?**
- ✅ **사용자 요청 시**
- ✅ **라이브 방송 활발할 때**

---

## 📊 우선순위 타임라인

### Phase 0: 현재 (테스트 환경)
```
✅ 핵심 결제 플로우 완성
✅ 테스트 API로 작동 확인
```

### Phase 1: PG 승인 직후 (1일)
```
🔴 운영 키 전환 (30분)
   └─ 환경 변수만 교체, 실제 카드 테스트

✅ 이 시점부터 실제 결제 가능
```

### Phase 2: Beta 테스트 (1주)
```
🟡 Sentry 에러 모니터링 (1시간)
   └─ 운영 중 에러 추적

🟡 주문 취소/환불 API (2-3시간)
   └─ 고객 셀프 취소 기능

🟡 주문 상태 관리 (4-6시간)
   └─ 배송 시작/완료 처리
```

### Phase 3: 정식 오픈 (2주)
```
🟢 가상계좌 웹훅 (3-4시간)
   └─ 가상계좌 결제 지원 시

🟢 결제 수단 추가
   └─ 사용자 요청 시
```

### Phase 4: 성장기 (1-3개월)
```
🟢 정산 시스템 (1-2일)
   └─ 셀러 10명 이상

🟢 실시간 알림 (2-3시간)
   └─ 사용자 피드백 후

🟢 이미지 최적화, 성능 개선 등
```

---

## 🎯 권장 일정

### 시나리오 1: PG 승인 나옴 (토스페이먼츠 or 포트원)
```
Day 1: 운영 키 전환 + 실제 결제 테스트
Day 2-3: 주문 취소/환불 API 구현
Day 4-5: 주문 상태 관리 구현
Day 6-7: Beta 테스트 (내부/친구)
Day 8: 정식 오픈!

이후:
- 사용자 피드백 받으면서 추가 기능 구현
- 가상계좌 웹훅, 정산 시스템 등
```

### 시나리오 2: PG 승인 안나옴 (대기 중)
```
현재: 테스트 API로 계속 개발/테스트
    └─ 다른 기능 먼저 구현 (상품 관리, 라이브 개선 등)

PG 승인 나면:
    └─ 시나리오 1과 동일
```

### 시나리오 3: PG 변경 (토스 → 포트원)
```
Day 1: PortOneProvider 구현 (2-3시간)
Day 2: 환경 변수 변경 + 테스트
Day 3: 운영 키 전환 + 실제 결제 테스트
Day 4~: 시나리오 1과 동일
```

---

## 🚨 반드시 기억할 것

### ❌ 지금 당장 안해도 되는 것
- 정산 시스템 (셀러 적을 때)
- 실시간 알림 (사용자 불만 없으면)
- 이미지 최적화 (트래픽 적을 때)
- 부하 테스트 (사용자 적을 때)

### ✅ PG 승인 나면 바로 해야 하는 것
1. 운영 키 전환 (30분)
2. 실제 카드 100원 결제 테스트
3. 주문 취소/환불 API (2-3시간)
4. Sentry 에러 모니터링 (1시간)

**총 소요 시간: 1일 이내**

### ⚡ 정식 오픈 전 필수
- 주문 취소/환불 API
- 에러 모니터링
- 주문 상태 관리

**총 소요 시간: 1주일 이내**

---

## 💡 최종 조언

### 현재 단계 (테스트 환경)
```
✅ 핵심 기능 완성됨
✅ 테스트 API로 충분히 검증 가능
✅ PG 승인 기다리면서 다른 기능 개발
```

### PG 승인 후 (1일 작업)
```
→ 운영 키 전환
→ 실제 결제 테스트
→ 주문 취소 API 추가
→ 바로 오픈 가능!
```

### 이후 점진적 개선
```
→ 사용자 피드백 받으면서
→ 가상계좌, 정산 시스템 등 추가
→ 비즈니스 성장에 맞춰 기능 확장
```

---

## 🎯 결론

**질문**: "고도화, 운영 전환은 어느 시점에 구현해야해?"

**답변**:
1. **운영 전환 (키 교체)**: PG 승인 나면 즉시 (30분 작업)
2. **필수 고도화**: 정식 오픈 1주일 전 (주문 취소, 에러 모니터링)
3. **선택 고도화**: 사용자 피드백/비즈니스 성장 후 (정산, 실시간 알림)

**지금 할 일**:
- ✅ 테스트 환경에서 충분히 검증
- ✅ 다른 기능 먼저 구현 (상품 관리, UI 개선 등)
- ✅ PG 승인 기다림

**PG 승인 나면**:
- ✅ 1일 만에 운영 전환 가능
- ✅ 1주일 만에 정식 오픈 가능

**핵심**: 코드는 이미 완성됨! PG 승인만 나면 바로 오픈 가능! 🚀

---

**작성일**: 2026-02-11  
**작성자**: AI Assistant  
**프로젝트**: Toss Live Commerce
