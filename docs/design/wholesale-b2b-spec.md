# 유통스타트 B2B 도매몰 — 스펙 + 구현 상태

> 출처: 사용자 공유 mind-map PDF `유통스타트B2B몰.mmap` (2026-06-03).
> 3역할: **제조회원**(제조사/supplier) · **유통회원**(유통사/distributor) · **관리자**.

## 스펙 요약
- 제조회원: 상품 등록(개별/대량 엑셀), 등급별 공급가 4단계(A/B/C/특별), 공급가는 관리자만 관리(유통사엔 등급가만 노출), 바코드, OEM/ODM 지원, **공급범위 3종(전체/승인한 유통채널/유통스타트 유통채널)**, 주문·송장 엑셀, 정산(브랜드=당일/일반=월마감·7·15일).
- 유통회원: 가입 시 **자동 C등급**, 공급범위 따라 제품 확인, 주문/송장 엑셀, OEM/ODM 신청.
- 관리자: 등급/마진 관리, 유통채널 선정(선정/삭제), 특별가 관리, 공급가 자동계산, **세금계산서(→유통회원)·거래명세서**, 상품정보 엑셀(A/B/C), OEM/ODM 제조사 매칭, 1일 1억 정산.

## 구현 상태 (2026-06-03)

| 스펙 항목 | 상태 | 구현 위치 |
|---|---|---|
| 3역할·인증·등급가·신원보호·결제·배송·정산엔진 | ✅ 기존 | wholesale.routes / supplier-* / wholesale-settlement |
| **등급 기본 C** (스펙: 가입 시 자동 C) | ✅ Phase A | `distributor-pricing.ts` DEFAULT_UNGRADED='C' |
| **유통채널 선별 공급** (전체/승인채널/유통스타트) | ✅ Phase A | `supply-visibility.ts` + product_distributor_access + 카탈로그/주문 가시성 가드 + 어드민 product-access |
| **공급가 수정 이력** (관리자만) | ✅ Phase A | supply_price_history + GET /price-history |
| **바코드** (오프라인 판로) | ✅ Phase A | products.barcode + 등록/수정/대량 |
| **OEM/ODM 신청·매칭** | ✅ Phase B | oem_requests + 유통회원 신청(/wholesale/oem-requests) + 어드민 매칭 + WholesaleOemPage |
| **엑셀(CSV) 대량처리** | ✅ Phase C | supply-csv.ts: 제조사 대량등록/주문export/송장bulk, 유통사 카탈로그export/주문양식, 어드민 상품export |
| **세금계산서/거래명세서 발행** (내부 발행+문서) | ✅ Phase D | tax-documents.ts + issue/list/html/patch + 어드민 UI(발행·인쇄) |
| **정산기준 브랜드/일반 분기** | ✅ Phase E | products.is_brand_product → 당일 vs 7일 성숙 |
| 공급자/유통사/어드민 UI | ✅ Phase F | SupplierDashboardPage(필드+대량) / WholesaleOemPage / AdminDistributorGradesPage(선정·OEM·세금·export) |

## 자가 비판 감사 → 수정 완료 (commit `17c8f79`)
- ✅ **#1 대량 CSV subrequest 한도** — 행별 순차 `.run()` → `DB.batch` 청크(100). tracking 은 IN 청크 1회 조회 + batch.
- ✅ **#2 세금계산서 VAT 방향** — `subtotal`=유통사 실결제액(VAT 포함)이므로 가산이 아닌 **추출(÷1.1)**. 단위테스트 lock.
- ✅ **#3 부분환불 과대계상** — 매출=`SUM(subtotal−refunded_amount)`, 매입=환불 라인 제외.
- ✅ **#5 '승인한 유통채널' 제조사 자가관리** — supplier `/products/:id/channel-access` (소유+APPROVED_CHANNEL 한정). UTONGSTART_ONLY 는 관리자 전용 유지.

## 미구현 / 후속 (의도적 보류)
- **#4 브랜드제품 즉시정산 리스크** (사용자 결정 보류): 현재 `available_at=now` → 환불 클로백 안전창 없음. 옵션: 1~2일 짧은 보호창. **결정 대기.**
- **외부 전자세금계산서 연동**(팝빌 등): 내부 발행 기록 + 인쇄용 HTML까지. 정식 e-세금계산서는 별도 연동 자리만.
- **1일 1억 정산 한도 가드**: payout 실행 단계 캡 미적용(후속).
- **교환(exchange) 플로우**: 환불(refund)만 구현.
- **products 테이블 플래그 과적재**: 장기적으로 supply 전용 테이블 분리 검토(현재는 실용적 유지).
- 진짜 `.xlsx` (현재 UTF-8 BOM CSV — 의존성 0 trade-off).
- 제품 카테고리 선별·제조사 컨택 = 운영 프로세스(코드 무관).

## ✅ 구현 완료
- Phase A: commit `f0a949f` (등급 C + 유통채널 선별 + 공급가 이력 + 바코드)
- Phase B+C: commit `4d34a58` (OEM/ODM + 엑셀 CSV)
- Phase D+E: commit `d710382` (세금계산서/거래명세서 + 정산 분기)
- Phase F: commits `e2c61e2`/`6d7fe2d`/`4753d08` (공급자/유통사/어드민 UI)
