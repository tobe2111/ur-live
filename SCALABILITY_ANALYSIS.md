# 🚀 확장성 분석 보고서 (Scalability Analysis)

## 📊 현재 아키텍처

### 1. **Cloudflare Pages + Workers**
- **배포 플랫폼**: Cloudflare Pages (전 세계 320+ 엣지 로케이션)
- **서버리스**: Auto-scaling 지원
- **요청 제한**: 
  - **Free Plan**: 100,000 요청/일
  - **Pro Plan ($20/월)**: 10,000,000 요청/월
  - **Business Plan ($200/월)**: 무제한

### 2. **Cloudflare D1 Database**
- **타입**: SQLite 기반 분산 데이터베이스
- **읽기**: 전 세계 엣지에서 로컬 읽기 (초고속)
- **쓰기**: 중앙 Primary 데이터베이스에 쓰기 후 복제
- **제한**:
  - **Free Plan**: 5,000,000 읽기/일, 100,000 쓰기/일
  - **Paid Plan**: 25,000,000 읽기/일, 50,000,000 쓰기/일

---

## ⚠️ 병목 지점 분석

### 🔴 **Critical Bottleneck (심각)**

#### 1. **D1 쓰기 작업 제한**
- **현재 제한**: 100,000 쓰기/일 (Free), 50,000,000 쓰기/일 (Paid)
- **문제 시나리오**:
  ```
  동시 접속자 1,000명
  → 각자 주문 1건 생성 (1,000 쓰기)
  → 상태 변경 3회 (3,000 쓰기)
  → 세금계산서 발행 (1,000 쓰기)
  → 로그 기록 (3,000 쓰기)
  = 총 8,000 쓰기 (1분 이내)
  ```
  
  **결론**: Free Plan으로는 하루 12,500명 주문 처리 가능 (100,000 / 8)

#### 2. **세션 관리 (D1 쓰기)**
```typescript
// 현재 코드: 모든 로그인마다 D1 쓰기
async function createSession(DB: any, userId: number, userType: 'admin' | 'seller', userData: any) {
  await DB.prepare(`
    INSERT INTO admin_sessions (session_token, ${userType}_id, user_type, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionToken, userId, userType, expiresAt).run(); // ⚠️ D1 쓰기
}
```

**문제점**:
- 로그인 1회 = D1 쓰기 1회
- 동시 로그인 1,000명 = 1,000 쓰기
- 세션 검증은 **매 API 요청마다 D1 읽기**

#### 3. **세금계산서 자동 발행 로그**
```typescript
// 배송완료 시마다 D1 쓰기 3회
await env.DB.prepare(`
  INSERT INTO tax_invoice_auto_issue_log (...) VALUES (...)
`).run(); // 1번 쓰기

await env.DB.prepare(`
  INSERT INTO tax_invoices (...) VALUES (...)
`).run(); // 2번 쓰기

await env.DB.prepare(`
  UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE order_number = ?
`).run(); // 3번 쓰기
```

---

## 🟡 **Medium Risk (중간 위험)**

#### 1. **CPU 시간 제한 (Workers)**
- **Free Plan**: 10ms CPU 시간/요청
- **Paid Plan**: 30ms CPU 시간/요청
- **문제**: 복잡한 쿼리나 계산 시 시간 초과

#### 2. **동시 연결 제한 (D1)**
- **D1 제한**: 동시 연결 수 제한 없음 (공식 문서 미명시)
- **실제 테스트 필요**: 1,000+ 동시 쿼리 시나리오

---

## ✅ **No Problem (문제 없음)**

#### 1. **정적 파일 서빙**
- Cloudflare CDN으로 서빙
- 무제한 대역폭 (Paid Plan)
- 전 세계 캐싱

#### 2. **읽기 작업 (조회)**
- D1 읽기: 5,000,000/일 (Free), 25,000,000/일 (Paid)
- 엣지 로컬 읽기로 초고속

---

## 🔧 해결 방안

### ✅ **즉시 적용 가능한 최적화**

#### 1. **세션 관리를 KV로 이동**
```typescript
// Before: D1 (느림, 쓰기 제한)
await DB.prepare(`INSERT INTO admin_sessions (...)`).run();

// After: KV (빠름, 제한 없음)
await c.env.KV.put(`session:${sessionToken}`, JSON.stringify(sessionData), {
  expirationTtl: 86400 // 24시간
});
```

**장점**:
- D1 쓰기 부담 감소
- 세션 검증 속도 향상 (엣지 로컬 KV)
- 자동 만료 (expirationTtl)

#### 2. **세금계산서 로그를 배치 처리**
```typescript
// Before: 실시간 로그 기록 (D1 쓰기)
await env.DB.prepare(`INSERT INTO tax_invoice_auto_issue_log (...)`).run();

// After: 큐에 추가 후 배치 처리
await c.env.QUEUE.send({
  type: 'tax_invoice_log',
  data: { orderId, status, timestamp }
});

// 5분마다 배치로 DB에 저장 (Cron Trigger)
```

**장점**:
- D1 쓰기 횟수 대폭 감소
- 장애 격리 (로그 실패해도 주문 정상 처리)

#### 3. **읽기 캐싱 (상품 목록, 통계)**
```typescript
// Before: 매번 D1 조회
const products = await DB.prepare(`SELECT * FROM products`).all();

// After: KV 캐싱 (5분)
let products = await c.env.KV.get('cache:products', 'json');
if (!products) {
  products = await DB.prepare(`SELECT * FROM products`).all();
  await c.env.KV.put('cache:products', JSON.stringify(products), {
    expirationTtl: 300 // 5분
  });
}
```

#### 4. **Paid Plan 업그레이드**
| 항목 | Free | Paid ($20/월) | 개선율 |
|------|------|---------------|--------|
| Workers 요청 | 100,000/일 | 10,000,000/월 | 300배 |
| D1 쓰기 | 100,000/일 | 50,000,000/일 | 500배 |
| CPU 시간 | 10ms | 30ms | 3배 |

---

## 📈 트래픽 시나리오 분석

### 시나리오 1: **일반적인 사용 (하루 1,000 주문)**
| 작업 | 쓰기 횟수 | Free Plan | Paid Plan |
|------|----------|-----------|-----------|
| 주문 생성 | 1,000 | ✅ OK | ✅ OK |
| 상태 변경 | 3,000 | ✅ OK | ✅ OK |
| 세금계산서 | 1,000 | ✅ OK | ✅ OK |
| 로그 기록 | 3,000 | ✅ OK | ✅ OK |
| **총합** | **8,000** | ✅ OK | ✅ OK |

### 시나리오 2: **급증 (하루 10,000 주문)**
| 작업 | 쓰기 횟수 | Free Plan | Paid Plan |
|------|----------|-----------|-----------|
| 주문 생성 | 10,000 | ✅ OK | ✅ OK |
| 상태 변경 | 30,000 | ✅ OK | ✅ OK |
| 세금계산서 | 10,000 | ✅ OK | ✅ OK |
| 로그 기록 | 30,000 | ✅ OK | ✅ OK |
| **총합** | **80,000** | ⚠️ 80% | ✅ OK |

### 시나리오 3: **바이럴 (하루 50,000 주문)**
| 작업 | 쓰기 횟수 | Free Plan | Paid Plan |
|------|----------|-----------|-----------|
| 주문 생성 | 50,000 | ❌ 초과 | ✅ OK |
| 상태 변경 | 150,000 | ❌ 초과 | ✅ OK |
| 세금계산서 | 50,000 | ❌ 초과 | ✅ OK |
| 로그 기록 | 150,000 | ❌ 초과 | ✅ OK |
| **총합** | **400,000** | ❌ 400% | ✅ OK |

---

## 🎯 권장 조치

### 🚨 **즉시 필요한 조치 (High Priority)**

1. **세션 관리를 KV로 이동** (30분)
   - D1 쓰기 부담 감소
   - 성능 향상

2. **Paid Plan 업그레이드** ($20/월)
   - 50,000,000 쓰기/일 확보
   - 하루 50,000+ 주문 처리 가능

### 📊 **중기 최적화 (Medium Priority)**

3. **읽기 캐싱 (KV)** (1시간)
   - 상품 목록, 통계 캐싱
   - D1 읽기 부담 감소

4. **배치 처리 (Queues + Cron)** (2시간)
   - 로그 기록 배치 처리
   - 5분마다 일괄 저장

### 🔮 **장기 확장성 (Long-term)**

5. **Database Sharding** (필요 시)
   - 주문 수가 100만+ 넘어가면
   - 판매자별로 DB 분리

6. **Read Replica** (필요 시)
   - D1이 읽기 부담 감당 못하면
   - 읽기 전용 복제본 추가

---

## 💰 비용 예측

### 현재 (Free Plan)
- **비용**: $0
- **제한**: 하루 12,500 주문

### Paid Plan
- **비용**: $20/월 (Workers) + $5/월 (D1) = **$25/월**
- **제한**: 하루 6,250,000 주문

### 최적화 후 (Paid + KV + Queues)
- **비용**: $25/월 + $5/월 (KV) + $2/월 (Queues) = **$32/월**
- **제한**: 사실상 무제한 (KV 10,000,000 쓰기/일)

---

## ✅ 결론

### 현재 상태
- ⚠️ **Free Plan**: 하루 10,000 주문까지 안정적
- ⚠️ **급증 시**: 하루 50,000 주문 시 D1 쓰기 제한 초과

### 권장 조치
1. **즉시**: Paid Plan 업그레이드 ($25/월)
2. **30분 내**: 세션 관리 KV 이동
3. **1시간 내**: 읽기 캐싱 추가

### 최종 결과
- ✅ 하루 100,000+ 주문 처리 가능
- ✅ 월 비용 $32
- ✅ 트래픽 급증 대응 가능

---

**다음 단계**: 세션 관리 KV 이동 작업을 진행하시겠습니까?
