# 전자세금계산서 자동발행 시스템 구현 완료 리포트

**날짜**: 2026-02-04  
**프로젝트**: Your Live (인플루언서 라이브 커머스)  
**버전**: 2.2.0 - 전자세금계산서 시스템  
**배포 URL**: https://2250c4ce.toss-live-commerce.pages.dev  
**라이브 URL**: https://live.ur-team.com

---

## 📊 완료 현황

### ✅ 완료된 작업 (7/10)

1. ✅ **DB 마이그레이션 실행**
   - 로컬 DB: ✅ 완료
   - 프로덕션 DB: ✅ 완료
   - 마이그레이션 파일:
     - `0012_add_tax_invoice.sql` - 세금계산서 테이블 (seller_business_info, tax_invoices, tax_invoice_items)
     - `0013_add_order_business_info.sql` - 주문 사업자 정보 컬럼

2. ✅ **사업자 정보 관리 API**
   - `POST /api/seller/business-info` - 사업자 정보 등록/수정
   - `GET /api/seller/business-info` - 사업자 정보 조회
   - `PUT /api/admin/seller-business/:id/verify` - 관리자 승인
   - `GET /api/admin/seller-business` - 전체 사업자 정보 목록

3. ✅ **주문 API 수정**
   - 주문 생성 시 사업자 정보 입력 지원
   - 필드 추가: `issueTaxInvoice`, `buyerBusinessNumber`, `buyerBusinessName`, `buyerCeoName`

4. ✅ **세금계산서 발행 API**
   - `POST /api/seller/tax-invoices/issue` - 세금계산서 발행
   - 공급가액 자동 계산 (VAT 10% 별도)
   - Mock 구현 (실제 바로빌 API 연동 대기)

5. ✅ **세금계산서 조회 API**
   - `GET /api/seller/tax-invoices` - 목록 조회 (날짜/상태 필터)
   - `GET /api/seller/tax-invoices/:id` - 상세 조회 (품목 포함)
   - `POST /api/seller/tax-invoices/:id/cancel` - 취소 (발행일 익일까지)

6. ✅ **테스트 스크립트**
   - `test_tax_invoice.sh` - API 테스트 자동화

7. ✅ **프로덕션 배포**
   - Cloudflare Pages 배포 완료
   - 로컬 서버 PM2 재시작 완료

---

### ⏳ 남은 작업 (3/10)

#### High Priority

**6. 바로빌 REST API 연동** (2일 예상)
- **현재 상태**: Mock 구현 완료
- **필요 작업**:
  1. 바로빌 계정 생성 (https://www.barobill.co.kr)
  2. API 키 발급
  3. 샌드박스 테스트
  4. 실제 API 호출 코드 작성
  5. 에러 핸들링 및 재시도 로직

**7. 배송완료시 자동 발행 로직** (1일 예상)
- **필요 작업**:
  1. 주문 상태 변경 감지 (SHIPPED → DELIVERED)
  2. `issue_tax_invoice = 1`인 주문 필터
  3. 자동 발행 트리거
  4. 발행 실패 시 재시도 로직
  5. 알림 시스템 연동

#### Medium Priority

**8. 정산서와 세금계산서 연동** (1일 예상)
- **필요 작업**:
  1. 정산서 테이블에 세금계산서 연결
  2. `GET /api/seller/settlements/:id/tax-invoices` API 추가
  3. CSV 다운로드 시 세금계산서 정보 포함

**9. 프론트엔드 UI 구현** (2일 예상)
- **필요 화면**:
  1. 판매자 대시보드: 사업자 정보 등록 페이지
  2. 판매자 대시보드: 세금계산서 목록/상세
  3. 주문 생성 페이지: 사업자 정보 입력 폼 (선택)
  4. 관리자 대시보드: 사업자 승인 화면

---

## 🎯 구현된 기능 상세

### 1. 사업자 정보 관리

**등록 플로우:**
```
인플루언서 → 사업자 정보 등록 → 관리자 승인 대기 → 승인 완료 → 세금계산서 발행 가능
```

**필수 정보:**
- 사업자등록번호
- 상호명
- 대표자명
- 업태/업종
- 사업장 주소
- 연락처/이메일

### 2. 주문 시 사업자 정보 입력

**주문 생성 API 수정:**
```typescript
POST /api/orders/create
Body: {
  ...
  issueTaxInvoice: true,      // 세금계산서 발행 요청
  buyerBusinessNumber: "987-65-43210",
  buyerBusinessName: "구매자 회사",
  buyerCeoName: "이구매"
}
```

### 3. 세금계산서 발행

**발행 플로우:**
```
주문 완료 → 배송 완료 → 세금계산서 발행 → 국세청 전송 → 고객 이메일 발송
```

**공급가액 계산:**
- 상품 금액: 129,000원
- 공급가액: 117,273원 (VAT 별도)
- 부가세: 11,727원 (10%)

**Mock 응답 예시:**
```json
{
  "success": true,
  "data": {
    "invoice_id": 1,
    "invoice_number": "2026-02-04-A1B2C3",
    "issue_date": "2026-02-04",
    "total_amount": 129000,
    "supply_price": 117273,
    "tax_amount": 11727,
    "status": "issued",
    "nts_confirm_number": "MOCK-1738647600000",
    "message": "세금계산서가 발행되었습니다. (Mock - 실제 바로빌 연동 필요)"
  }
}
```

### 4. 세금계산서 조회

**목록 API:**
```bash
GET /api/seller/tax-invoices?start_date=2026-02-01&end_date=2026-02-28&status=issued
```

**상세 API:**
```bash
GET /api/seller/tax-invoices/1
```

**응답 포함 항목:**
- 공급자 정보 (인플루언서)
- 공급받는자 정보 (고객)
- 품목 목록
- 금액 정보 (공급가액, 세액, 합계)
- 국세청 승인번호

### 5. 세금계산서 취소

**취소 조건:**
- 발행일 익일까지만 가능 (법적 요구사항)
- 발행 상태인 경우에만 취소 가능

```bash
POST /api/seller/tax-invoices/1/cancel
Body: {
  "reason": "주문 취소로 인한 세금계산서 취소"
}
```

---

## 🗂️ DB 스키마

### seller_business_info 테이블
```sql
- id: PK
- seller_id: FK (sellers)
- business_number: 사업자등록번호 (UNIQUE)
- business_name: 상호명
- ceo_name: 대표자명
- business_type: 업태
- business_category: 업종
- address: 사업장 주소
- phone: 전화번호
- email: 이메일
- is_verified: 승인 여부
- verified_at: 승인 일시
```

### tax_invoices 테이블
```sql
- id: PK
- seller_id: FK (sellers)
- order_no: 주문번호
- invoice_number: 세금계산서 번호
- issue_date: 발행일
- supplier_*: 공급자 정보 (인플루언서)
- buyer_*: 공급받는자 정보 (고객)
- supply_price: 공급가액
- tax_amount: 부가세
- total_amount: 합계
- status: 상태 (pending, issued, sent, failed, cancelled)
- nts_confirm_number: 국세청 승인번호
```

### tax_invoice_items 테이블
```sql
- id: PK
- tax_invoice_id: FK (tax_invoices)
- order_item_id: FK (order_items)
- product_name: 상품명
- quantity: 수량
- unit_price: 단가
- supply_price: 공급가액
- tax_amount: 세액
```

---

## 📝 API 엔드포인트 요약

### 사업자 정보 관리
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| POST | `/api/seller/business-info` | 사업자 정보 등록/수정 | Seller |
| GET | `/api/seller/business-info` | 사업자 정보 조회 | Seller |
| PUT | `/api/admin/seller-business/:id/verify` | 사업자 승인 | Admin |
| GET | `/api/admin/seller-business` | 전체 사업자 목록 | Admin |

### 세금계산서
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| POST | `/api/seller/tax-invoices/issue` | 세금계산서 발행 | Seller |
| GET | `/api/seller/tax-invoices` | 세금계산서 목록 | Seller |
| GET | `/api/seller/tax-invoices/:id` | 세금계산서 상세 | Seller |
| POST | `/api/seller/tax-invoices/:id/cancel` | 세금계산서 취소 | Seller |

---

## 🚀 다음 단계

### Immediate (즉시)
1. **바로빌 계정 생성**
   - 회원가입: https://www.barobill.co.kr
   - API 키 발급
   - 샌드박스 테스트

2. **바로빌 API 연동**
   - Mock 코드를 실제 API 호출로 교체
   - 에러 핸들링
   - 재시도 로직

### Short-term (1주일 내)
3. **배송완료시 자동 발행**
   - 주문 상태 변경 감지
   - 자동 발행 트리거
   - 알림 시스템

4. **정산서 연동**
   - 정산서에 세금계산서 포함
   - CSV 다운로드 개선

### Medium-term (2주일 내)
5. **프론트엔드 UI**
   - 사업자 정보 등록 화면
   - 세금계산서 조회 화면
   - 관리자 승인 화면

---

## 💰 예상 비용

### 바로빌 API 요금
- 월 기본료: 33,000원 (VAT 별도)
- 건당 발행비: 55원
- **월 100건**: 약 39,000원
- **월 1,000건**: 약 88,000원

---

## ✅ 체크리스트

- [x] DB 스키마 설계
- [x] DB 마이그레이션 실행
- [x] 사업자 정보 관리 API
- [x] 주문 API 수정
- [x] 세금계산서 발행 API (Mock)
- [x] 세금계산서 조회 API
- [x] 테스트 스크립트 작성
- [x] 프로덕션 배포
- [ ] 바로빌 계정 생성
- [ ] 바로빌 API 연동
- [ ] 배송완료시 자동 발행
- [ ] 정산서 연동
- [ ] 프론트엔드 UI

---

## 🎉 결론

### 완료 사항
- ✅ **전자세금계산서 시스템 기본 구조 완성**
- ✅ **Mock 구현으로 즉시 테스트 가능**
- ✅ **프로덕션 배포 완료**

### 다음 작업
1. **바로빌 계정 생성** (사용자 액션 필요)
2. **API 연동** (2일)
3. **자동 발행** (1일)
4. **UI 구현** (2일)

**총 예상 완료 시간**: 바로빌 계정 생성 후 약 5일

---

**작성자**: GenSpark AI Assistant  
**검증**: 완료  
**문서**: TAX_INVOICE_COMPLETE.md
