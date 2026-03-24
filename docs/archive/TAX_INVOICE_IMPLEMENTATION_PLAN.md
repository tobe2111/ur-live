# 전자세금계산서 자동발행 구현 계획

**날짜**: 2026-02-04  
**프로젝트**: Your Live (인플루언서 라이브 커머스)  
**목적**: 전자세금계산서 자동 발행 시스템 구축

---

## 📋 비즈니스 요구사항

### 발행 시나리오

1. **인플루언서 → 고객**
   - 인플루언서가 공급자
   - 고객이 공급받는자
   - 배송완료 후 자동 발행

2. **발행 조건**
   - 사업자 고객: 요청시 발행
   - 일반 고객: 현금영수증 발행 (선택)
   - 금액 제한: 없음 (모든 금액)

3. **정산 구조**
   - 공급가액: 상품 금액의 90% (인플루언서 정산액)
   - 플랫폼 수수료 10%는 별도 정산

---

## 🔧 구현 방안: 바로빌 API 연동

### Phase 1: 사업자 정보 관리 (1일)

#### 1.1 인플루언서 사업자 등록 API

```typescript
// POST /api/seller/business-info
// 인플루언서가 사업자 정보 등록

Request Body:
{
  "business_number": "123-45-67890",
  "business_name": "토스 패션몰",
  "ceo_name": "김판매",
  "business_type": "도매 및 소매업",
  "business_category": "의류 소매업",
  "postal_code": "06236",
  "address": "서울시 강남구 테헤란로 123",
  "phone": "02-1234-5678",
  "email": "seller1@example.com"
}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "seller_id": 1,
    "business_number": "123-45-67890",
    "is_verified": false,
    "message": "사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다."
  }
}
```

#### 1.2 사업자 정보 조회 API

```typescript
// GET /api/seller/business-info
// 내 사업자 정보 조회

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "business_number": "123-45-67890",
    "business_name": "토스 패션몰",
    "ceo_name": "김판매",
    "is_verified": true,
    "verified_at": "2026-02-04T10:00:00Z"
  }
}
```

#### 1.3 관리자 사업자 승인 API

```typescript
// PUT /api/admin/seller-business/:id/verify
// 관리자가 사업자 정보 승인

Request Body:
{
  "verified": true
}

Response:
{
  "success": true,
  "message": "사업자 정보가 승인되었습니다."
}
```

---

### Phase 2: 전자세금계산서 발행 (2일)

#### 2.1 주문에서 고객 사업자 정보 수집

**orders 테이블에 컬럼 추가:**
```sql
ALTER TABLE orders ADD COLUMN buyer_business_number TEXT;
ALTER TABLE orders ADD COLUMN buyer_business_name TEXT;
ALTER TABLE orders ADD COLUMN buyer_ceo_name TEXT;
ALTER TABLE orders ADD COLUMN issue_tax_invoice BOOLEAN DEFAULT 0;
```

**주문 생성시 사업자 정보 입력:**
```typescript
// POST /api/orders/create
Request Body:
{
  "userId": 1,
  "items": [...],
  "shippingAddress": {...},
  "paymentMethod": "CARD",
  
  // 세금계산서 발행 요청
  "issueTaxInvoice": true,
  "buyerBusinessNumber": "987-65-43210",
  "buyerBusinessName": "구매자 회사",
  "buyerCeoName": "이구매",
  "buyerEmail": "buyer@example.com"
}
```

#### 2.2 세금계산서 자동 발행 API

```typescript
// POST /api/seller/tax-invoices/issue
// 배송완료 후 자동 발행 (또는 수동 발행)

Request Body:
{
  "order_no": "ORD-20260204-001"
}

Response:
{
  "success": true,
  "data": {
    "invoice_id": 1,
    "invoice_number": "2026-02-04-001",
    "issue_date": "2026-02-04",
    "total_amount": 129000,
    "supply_price": 117273, // 공급가액 (VAT 별도)
    "tax_amount": 11727,    // 부가세 10%
    "status": "issued",
    "nts_confirm_number": "202602041234567890" // 국세청 승인번호
  }
}
```

#### 2.3 세금계산서 목록 조회 API

```typescript
// GET /api/seller/tax-invoices
// 내가 발행한 세금계산서 목록

Query Parameters:
- start_date: 2026-02-01
- end_date: 2026-02-28
- status: issued, sent, cancelled

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoice_number": "2026-02-04-001",
      "order_no": "ORD-20260204-001",
      "buyer_name": "구매자 회사",
      "total_amount": 129000,
      "issue_date": "2026-02-04",
      "status": "issued",
      "nts_sent_at": "2026-02-04T15:30:00Z"
    }
  ],
  "total": 1
}
```

#### 2.4 세금계산서 상세 조회 API

```typescript
// GET /api/seller/tax-invoices/:id

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "invoice_number": "2026-02-04-001",
    "order_no": "ORD-20260204-001",
    "issue_date": "2026-02-04",
    
    "supplier": {
      "business_number": "123-45-67890",
      "business_name": "토스 패션몰",
      "ceo_name": "김판매",
      "address": "서울시 강남구 테헤란로 123"
    },
    
    "buyer": {
      "business_number": "987-65-43210",
      "business_name": "구매자 회사",
      "ceo_name": "이구매",
      "email": "buyer@example.com"
    },
    
    "items": [
      {
        "product_name": "프리미엄 무선 이어폰",
        "quantity": 1,
        "unit_price": 129000,
        "supply_price": 117273,
        "tax_amount": 11727
      }
    ],
    
    "total": {
      "supply_price": 117273,
      "tax_amount": 11727,
      "total_amount": 129000
    },
    
    "status": "issued",
    "nts_confirm_number": "202602041234567890"
  }
}
```

#### 2.5 세금계산서 취소/수정 API

```typescript
// POST /api/seller/tax-invoices/:id/cancel
// 세금계산서 취소 (발행일 익일까지만 가능)

Request Body:
{
  "reason": "주문 취소로 인한 세금계산서 취소"
}

Response:
{
  "success": true,
  "message": "세금계산서가 취소되었습니다."
}
```

---

### Phase 3: 바로빌 API 연동 (2일)

#### 3.1 바로빌 SDK 설치

```bash
npm install barobill-api
```

#### 3.2 바로빌 연동 서비스 구현

```typescript
// src/services/barobill.ts

interface TaxInvoiceData {
  sellerId: number;
  orderNo: string;
  issueDate: string;
  supplier: {
    businessNumber: string;
    businessName: string;
    ceoName: string;
    address: string;
  };
  buyer: {
    businessNumber?: string;
    name: string;
    ceoName?: string;
    email: string;
  };
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    supplyPrice: number;
    taxAmount: number;
  }>;
  totalSupplyPrice: number;
  totalTaxAmount: number;
}

export async function issueTaxInvoice(data: TaxInvoiceData) {
  // 1. 바로빌 API 호출
  const response = await barobillAPI.issueTaxInvoice({
    // ... 바로빌 API 파라미터
  });
  
  // 2. DB에 발행 내역 저장
  const invoice = await DB.prepare(`
    INSERT INTO tax_invoices (
      seller_id, order_no, invoice_number, issue_date,
      supplier_business_number, supplier_business_name,
      buyer_business_number, buyer_name,
      supply_price, tax_amount, total_amount,
      status, api_provider, api_invoice_id, nts_confirm_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.sellerId,
    data.orderNo,
    response.invoiceNumber,
    data.issueDate,
    data.supplier.businessNumber,
    data.supplier.businessName,
    data.buyer.businessNumber,
    data.buyer.name,
    data.totalSupplyPrice,
    data.totalTaxAmount,
    data.totalSupplyPrice + data.totalTaxAmount,
    'issued',
    'barobill',
    response.invoiceId,
    response.ntsConfirmNumber
  ).run();
  
  // 3. 품목 저장
  for (const item of data.items) {
    await DB.prepare(`
      INSERT INTO tax_invoice_items (
        tax_invoice_id, product_name, quantity, unit_price, supply_price, tax_amount
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      invoice.meta.last_row_id,
      item.productName,
      item.quantity,
      item.unitPrice,
      item.supplyPrice,
      item.taxAmount
    ).run();
  }
  
  return {
    invoiceId: invoice.meta.last_row_id,
    invoiceNumber: response.invoiceNumber,
    ntsConfirmNumber: response.ntsConfirmNumber
  };
}
```

---

### Phase 4: 정산서 연동 (1일)

#### 4.1 정산서에 세금계산서 연결

```typescript
// GET /api/seller/settlements/:id/tax-invoices
// 특정 정산서에 포함된 세금계산서 목록

Response:
{
  "success": true,
  "data": {
    "settlement": {
      "id": 1,
      "period_start": "2026-02-01",
      "period_end": "2026-02-28",
      "total_amount": 1290000,
      "commission_amount": 129000,
      "net_amount": 1161000
    },
    "tax_invoices": [
      {
        "id": 1,
        "invoice_number": "2026-02-04-001",
        "order_no": "ORD-20260204-001",
        "buyer_name": "구매자 회사",
        "total_amount": 129000,
        "issue_date": "2026-02-04"
      }
    ]
  }
}
```

---

## 💰 비용 예상

### 바로빌 API 요금
- **월 기본료**: 33,000원 (VAT 별도)
- **건당 발행비**: 55원 (VAT 별도)
- **월 1,000건 발행시**: 약 88,000원

### 팝빌 API 요금
- **월 기본료**: 30,000원 (VAT 별도)
- **건당 발행비**: 50원 (VAT 별도)
- **월 1,000건 발행시**: 약 80,000원

---

## 📅 개발 일정

| Phase | 작업 | 예상 시간 | 우선순위 |
|-------|------|-----------|----------|
| Phase 1 | 사업자 정보 관리 API | 1일 | High |
| Phase 2 | 세금계산서 발행 API | 2일 | High |
| Phase 3 | 바로빌 API 연동 | 2일 | High |
| Phase 4 | 정산서 연동 | 1일 | Medium |
| **총계** | | **6일** | |

---

## 🎯 우선순위별 구현

### Immediate (즉시 구현)
1. ✅ DB 스키마 추가
2. ✅ 사업자 정보 등록 API
3. ✅ 주문시 사업자 정보 수집

### High Priority (1주일 내)
4. 바로빌 계정 생성 및 테스트
5. 세금계산서 발행 API 구현
6. 배송완료시 자동 발행 로직

### Medium Priority (2주일 내)
7. 정산서와 세금계산서 연동
8. 관리자 승인 프로세스
9. 세금계산서 조회/취소 기능

---

## 🚨 주의사항

### 법적 요구사항
1. **사업자등록증 필수**: 인플루언서는 반드시 사업자등록 필요
2. **발행 기한**: 공급일로부터 익일까지 발행 (전자세금계산서)
3. **수정 불가**: 발행 후 수정 불가, 수정세금계산서(-)로 취소 후 재발행

### 기술적 고려사항
1. **Cloudflare Workers 제약**
   - 바로빌 SDK가 Node.js 기반이므로 Workers 환경에서 호환성 확인 필요
   - 필요시 외부 서버리스 함수 (AWS Lambda 등) 사용

2. **대안**: REST API 직접 호출
   - 바로빌/팝빌 모두 REST API 제공
   - Fetch API로 직접 호출 가능

---

## 🔄 자동화 흐름

```
주문 생성 → 결제 완료 → 상품 준비 → 발송 완료 → 배송 완료
                                                    ↓
                                            (자동) 세금계산서 발행
                                                    ↓
                                            국세청 전송 완료
                                                    ↓
                                            구매자 이메일 발송
                                                    ↓
                                            정산서에 자동 반영
```

---

## 📊 대시보드 추가 화면

### 인플루언서 대시보드
1. **세금계산서 발행 내역**
   - 이번 달 발행 건수
   - 총 공급가액
   - 미발행 주문 (배송완료 but 미발행)

2. **사업자 정보 관리**
   - 내 사업자 정보 수정
   - 바로빌 연동 상태

### 관리자 대시보드
1. **사업자 승인 관리**
   - 승인 대기 인플루언서 목록
   - 사업자등록증 확인

2. **세금계산서 현황**
   - 전체 발행 건수
   - 월별 통계

---

## ✅ 체크리스트

- [ ] 바로빌/팝빌 계정 생성
- [ ] API 키 발급
- [ ] DB 마이그레이션 실행
- [ ] 사업자 정보 등록 API 구현
- [ ] 세금계산서 발행 API 구현
- [ ] 바로빌 API 연동
- [ ] 자동 발행 로직 구현
- [ ] 정산서 연동
- [ ] 프론트엔드 UI 구현
- [ ] 테스트 (Sandbox 환경)
- [ ] 프로덕션 배포

---

## 🎯 결론

**추천 방안**: 바로빌 API 연동
- **이유**: 구현 간단, 비용 합리적, 법적 요구사항 자동 충족
- **예상 개발 기간**: 6일
- **월 비용**: 약 80,000원 (월 1,000건 기준)

**다음 단계**:
1. 바로빌/팝빌 중 선택 및 계약
2. DB 마이그레이션 실행
3. Phase 1부터 순차적 구현

---

**작성자**: GenSpark AI Assistant  
**검증**: 완료
