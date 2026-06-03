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

## 2차 마감 — 잔여 항목 처리 (commit 후속)
- ✅ **#4 브랜드 정산 보호창** — `available_at=now` → **익일(1일 보호창)**. 환불 클로백 안전창 확보하며 '거의 당일' 유지.
- ✅ **1일 정산 한도** — `payoutSupplier` 에 플랫폼 일일 캡(기본 1억, `platform_settings.supplier_daily_payout_cap` 조정). 초과 시 `daily_cap_exceeded` 반려 + 어드민 메시지.
- ✅ **진짜 .xlsx** — 의존성 0 OOXML stored-zip 생성기(`xlsx.ts`, CRC32). 다운로드 전용 export 3종(유통사 카탈로그/제조사 주문/어드민 상품정보)을 .xlsx 로 전환. 재업로드용 양식은 CSV 유지(왕복 파싱). 단위테스트 lock.
- ✅ **전자세금계산서(바로빌) 연동** — `barobill.ts` env 주입 리팩토링 + `POST /tax-documents/:id/issue-nts`(매출 방향만, 발행자=유통스타트). 자격증명/플랫폼 사업자정보 미설정 시 actionable 503(fail-soft). `tax_documents.nts_confirm_num/invoice_key/external_status` + 어드민 '국세청발행' 버튼.
  - **활성화 조건(운영 TODO)**: Cloudflare 환경변수 `BAROBILL_PROD_API_KEY`(+`BAROBILL_ENV=production`) + `platform_settings`(company_business_number/company_name/company_ceo/company_address) 등록.

## 3차 — 시중 노출/유입 레이어 (사용자 지적 "도매몰은 시중에 노출되어야 함")
이전 작업은 전부 로그인 뒤 기능(엔진)이었고, 발견→유입→가입 퍼널이 부재했음. 보강:
- ✅ **공개 소개 랜딩** `WholesaleIntroPage`(`/wholesale/intro`) — 인덱싱 대상(SEO + Service JSON-LD), 가치제안 + 작동방식 + 제조사/유통사 듀얼 CTA.
- ✅ **유통사 전용 가입** `WholesaleJoinPage`(`/wholesale/join`) — 셀러 온보딩으로 funnel(returnUrl=/wholesale), 가입 즉시 C등급. 제조사는 `/supplier/register`.
- ✅ **도메인 진입 변경** — `utongstart.com` 루트 302 → `/wholesale/intro`(로그인 월 대신). App `isUtongstart()` `/` redirect도 intro로.
- ✅ **로그아웃 카탈로그** — `/wholesale` 미로그인 시 `/wholesale/intro` 로 redirect(노출/가입 유도). 로그인+에러는 재시도 UI.
- ✅ **sitemap/SEO** — `/wholesale/intro`·`/wholesale/join` sitemap 등록(검색 유입).
- ✅ **B2B 도메인 정리** — `/wholesale*`·`/supplier*` 에서 소비자 BottomNav/DesktopTopNav 미표시.

## 미구현 / 의도적 보류 (엔지니어링 판단)
- **매입(제조사→유통스타트) 전자세금계산서**: 제조사가 발행 주체 → 플랫폼 계정 발행 불가(역발행 요청 별도 플로우 필요).
- **교환(exchange) 플로우**: 환불(refund)만 구현.
- **products 테이블 플래그 과적재 → supply 전용 테이블 분리**: 잠긴 perf 경로(LIST_COLUMNS/SSR/인덱스) 광범위 수정 + 회귀 위험 큰 대규모 리팩토링. 기능 이득 0 → **CLAUDE.md '대규모 리팩토링 금지' 룰에 따라 의도적 보류**(별도 계획된 마이그레이션으로 진행 권장).
- 재업로드 양식의 .xlsx 파싱(현재 CSV 업로드 — 왕복에 적합).
- 제품 카테고리 선별·제조사 컨택 = 운영 프로세스(코드 무관).

## ✅ 구현 완료
- Phase A: commit `f0a949f` (등급 C + 유통채널 선별 + 공급가 이력 + 바코드)
- Phase B+C: commit `4d34a58` (OEM/ODM + 엑셀 CSV)
- Phase D+E: commit `d710382` (세금계산서/거래명세서 + 정산 분기)
- Phase F: commits `e2c61e2`/`6d7fe2d`/`4753d08` (공급자/유통사/어드민 UI)
