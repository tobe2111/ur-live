# 도매몰(유통스타트) 개선 로드맵 — 정밀 감사 종합 (2026-06-07)

> 6개 영역(정산 무결성 · 가격/마진 · 주문/동시성 · 보안/IDOR · 스키마/운영 · 제품/비즈니스) 코드 정밀 감사 결과 종합.
> 두 축으로 정리: **개발 스펙(정확성/안전)** + **비즈니스 모델(사업 성숙도)**.
> 각 항목: 현재 상태 · 리스크/시나리오 · 이상적 방향 · 파일:라인 · 난이도(S/M/L).
>
> **총평**: 신뢰 인프라(가격 SSOT·서버 재계산·원가 마스킹·oversell CAS 가드·Toss SSOT·등급가 엔진·바로빌)는 동급 국내 도매몰 중 **탄탄한 편**. 약점은 (a) 정산 머니패스의 **환불 후 회수(clawback)·한도 원자성**, (b) 일부 **콜드스타트 스키마 500 리스크**, (c) **유통사(바이어) 경험**(클레임/여신/검색)이 비어 있음.

---

## 🔴 P0 — 정확성/머니/보안/사업신뢰 (우선 처리)

### [개발] SEC-1. 드랍쉽 송장 입력이 주문 전체를 덮어씀 (cross-supplier order hijack)
- **현재**: `supplier-dashboard.routes.ts` `PUT /orders/:orderId/shipping` — 소유권 검사(주문에 내 라인 ≥1)는 있으나, 이후 `UPDATE orders SET tracking_number/courier/status='SHIPPING' WHERE id=?` 가 **주문 전체**를 갱신.
- **시나리오**: 한 소비자 주문에 내 드랍쉽 상품 + 다른 셀러 상품이 섞이면, 공급사 1명이 주문 전체를 자기 송장으로 SHIPPING 처리 → 다른 셀러 배송흐름 오염. 승인된 공급사 누구나 가능.
- **이상적**: 라인 스코프로 한정 — `order_items`의 내 라인에만 송장 저장, 모든 라인 발송 완료 시에만 `orders.status` 전환(`wholesale-supplier`의 `NOT EXISTS` 패턴 차용). 다른 공급사 라인이 있으면 주문레벨 tracking 덮어쓰기 금지.
- **난이도**: M

### [개발/머니] PAY-1. 환불 clawback 갭 — 이미 지급된 정산은 역전 불가
- **현재**: `wholesale-settlement.ts:123` / `supply-settlement.ts:107` 의 역전이 `status IN ('pending','available') AND paid_at IS NULL` 만 처리. 브랜드제품 만기 **1일** + `payoutSupplier`가 available 전액 즉시 지급.
- **시나리오**: 브랜드 라인 1일 후 지급 완료 → 그 뒤 유통사 환불 → Toss 환불은 나가는데(`cancelTossPayment` 선실행) 공급사 회수 0 → **플랫폼이 공급가 손실**.
- **이상적**: 역전이 `paid` 정산을 만나면 **음수 clawback 원장 엔트리**(또는 `supplier_clawbacks`) 적립 → 다음 지급에서 상계, 잔액 부족 시 운영 알림. 절대 `paid`를 silent no-op 하지 말 것.
- **난이도**: M

### [개발/머니] PAY-2. 일일 지급 한도(1억) 비원자적
- **현재**: `supply-settlement.ts:212` — `SELECT SUM(...)` 읽고 JS 비교 후 `INSERT`(`:235`). 사이 갭에 락 없음.
- **시나리오**: 동시 지급 둘이 `todayPaid=5천만` 읽고 각 4천만 → 둘 다 통과 → 1.8억 지급, 한도 8천만 초과.
- **이상적**: 조건부 단일문 — `INSERT ... SELECT ... WHERE (SELECT COALESCE(SUM(amount),0) ... today) + ? <= ?` + `meta.changes` 확인(reserve-before-pay), 또는 한도검사를 settlement claim과 같은 `DB.batch`에.
- **난이도**: S~M

### [개발] SCHEMA-1. ensure 없이 supply 컬럼 참조 → 콜드스타트 500
- **현재**: `seller-orders.routes.ts:482` 가 `COALESCE(p.is_supply_product,0)=0` 참조하나 `ensureSupplyVisibilitySchema` 미호출. 컬럼 부재 시 `no such column` → 셀러 "내 상품" 전체 500(COALESCE로 못 막음).
- **이상적**: 핸들러 상단에 `await ensureSupplyVisibilitySchema(DB)` (최소 비용) 또는 supply 컬럼을 base `production-schema.ts`로 승격. 장기적으로 **실 migration runner** 또는 "supply 컬럼 SELECT 파일은 ensure 호출 필수" CI 체크.
- **난이도**: S

### [개발/머니] SCHEMA-2. `supplier_settlements` UNIQUE 부재 → 이중 적립 창
- **현재**: 멱등이 `SELECT 1 ... LIMIT 1` 후 `INSERT`(TOCTOU)로만 방어. DB-레벨 backstop 없음. (현재는 상위 `/confirm` CAS 덕에 *실제* 이중적립은 막혀 있으나, 정산 helper를 CAS 밖에서 호출하는 미래 경로(재조정 cron·웹훅 replay)는 즉시 이중적립.)
- **이상적**: `CREATE UNIQUE INDEX ON supplier_settlements(order_id, product_id, source)` + `INSERT ... ON CONFLICT DO NOTHING` → 멱등을 데이터 본질로. (기존 중복행 있으면 인덱스 생성 실패 → 정리 후 재시도, repair-schema best-effort 패턴.)
- **난이도**: S~M

### [비즈니스] BIZ-1. 유통사(구매자) 발의 클레임/RMA 부재 — 신뢰 최소요건
- **현재**: 제조사 발의(`/supplier/wholesale/orders/:id/refund`)·운영자 발의 환불만 존재. **유통사가 불량/오배송을 제기할 엔드포인트가 없음.** 분쟁 중에도 제조사 정산은 성숙·지급됨.
- **이상적**: `wholesale_claims`(order_item_id·사유코드·증빙·status open→reviewing→approved/rejected) + 유통사 `POST /wholesale/orders/:id/claim` + **클레임 open 시 해당 라인 정산 자동 hold** + 소비자용 `disputes-escalation` cron 재사용 SLA. (인프라 — 정산 역전·Toss 부분취소·dispute cron — 이미 있어 *배선*만.)
- **난이도**: M · **가성비 1위**

---

## 🟡 P1 — 정확성 하드닝 + 성장 (GMV/retention 직결)

### 개발 — 정확성/하드닝
- **ORD-1. 어드민 승인 핸들러 CAS 부재**: 가격변경 승인(`admin-products.routes.ts:712-722`) + 상품승인(`:654-658`)이 CAS 없이 `UPDATE ... WHERE id=?`. 동시 승인 시 중복 이력행·go-live 레이스. → `WHERE ... AND pending_supply_price IS NOT NULL` / `AND supply_approval_status='pending'` + `changes` 검사. **난이도 S**
- **PAY-3. credit+balance 비원자**: 정산 insert와 balance upsert가 별도 `.run()`(`supply-settlement.ts:65-73` 등). 중간 eviction 시 drift. `paid_amount`는 increment-only라 payout 중 사망 시 영구 drift. → 각 단위를 `DB.batch()`로, `paid_amount`도 SUM 재계산 self-heal. **M**
- **PAY-4. 역전 시 maturity 레이스**: 역전이 스냅샷 status로 bucket 차감(`supply-settlement.ts:111`) → 동시 maturity와 충돌 시 available 과대(자가치유 전까지 과지급 창). → 역전 후 bucket을 SUM에서 재계산. **S~M**
- **OPS-1. 등급변경 감사로그 없음**: `distributor-admin.routes.ts:143`(등급·special_until)·`:85`(margin_pct)·margin override 가 `writeAuditLog` 없음. 전 주문 마진을 좌우하는 최고 레버리지인데 감사 0. → audit 추가. **S**
- **OPS-2. WeakSet ensure(실패 재시도 안 함)**: `tax-documents.ts:18`·`wholesale-settlement.ts:22` 가 await 전에 `add(DB)` → 첫 실패 시 isolate 내내 500. → supply-visibility의 WeakMap-promise+삭제 패턴으로. **S**
- **IDX-1. 핫 쿼리 인덱스 누락**: `products.supply_source_id`(매 결제 confirm이 풀스캔), `wholesale_orders(status, paid_at)`(월 세금집계). → 부분 인덱스 추가. **S**
- **PRC-1. tier floor가 마진 0까지 허용**: `max(supply_price, discounted)` — PG 수수료(~2-3%) 고려 시 순손실 가능. → floor를 `supply_price × (1+최소마진%)`(platform_settings, PG+운영 커버). 호출부 1줄. **S**
- **GATE-1. 최저가검수·withholding은 의도 확정 필요(아래 결정사항)**.

### 비즈니스 — 성장
- **BIZ-2. 여신/외상 결제조건**: 현재 100% 선결제 → "사입 0원" 메시지와 모순(현금 선투입). → `distributor_credit_limit`/`outstanding_balance`, `ON_CREDIT` 주문 + 월마감 청구, 등급 연동 한도, 연체 자동동결, 승인+GMV 임계 유통사 한정. **L · 사업 임팩트 최대**
- **BIZ-3. PO/견적 워크플로**: OEM 신청만 있음 → `wholesale_quotes`(요청→단가회신→주문전환)로 일반화. 대량/재판매 진입점. **M**
- **BIZ-4. 검색/필터/정렬**: 카탈로그 검색이 `name LIKE` 1줄(`wholesale.routes.ts:451`), 정렬 고정, 필터 category 1종, 재입고 알림 없음. → 소비자몰 `products_fts` 도매 인덱싱 재사용 + 정렬 화이트리스트 + 필터 확장 + `wholesale_restock_subscriptions`. **S~M**
- **BIZ-5. 최저가 반자동화**: 현재 수동·등록 1회. → 네이버쇼핑 검색 API `lprice`를 어드민 검수화면에 **참고값 병기**(자동승인 X — 동명이품 오탐) + 주기 재검수 cron(`wholesale-price-monitor`, 바코드 우선·판매량 우선·일일한도 캐시) + 이탈 시 `price_drift_alert`. **M**
- **BIZ-6. 공급사 분석**: 카운트만 → `GET /supplier/analytics`(매출 시계열·객단가·베스트·재고회전율) + 재고 동기화 import(바코드 키) + 가격 일괄변경(승인 큐 batch). **M**
- **BIZ-7. 등급 자동화**: 전부 수동 → `wholesale-grade-eval` cron(GMV 자동승급, `seller-tier-eval` 패턴) + 사업자번호 국세청 진위 API 1차검증. **M**
- **BIZ-8. MOQ/단가 고도화**: `pack_size`/`order_multiple`(박스 배수 강제), 등급별 MOQ, 유통사용 단가표(PDF/엑셀) 다운로드(`catalog-export` 노출만). **S~M**

---

## 🟢 P2 — 고도화

- **PAY-5. 원천징수 모델 확정 + 문서화**: 공급사 지급에 withholding 미적용. B2B 세금계산서(바로빌 wiring 있음) 모델이면 **gross 정상** → 명시 문서화. 소득형이면 `withholdAndLog` 배선. **결정 필요** (S)
- **PAY-6. margin_total 환불 미반영**: 주문시 gross 마진으로 문서화하거나 환불 비례 차감. ledger 역전 엔트리 대칭성(`recordLedger` 역전 미기록 → Σ불변식 깨짐) 보강. **S~M**
- **TAX-1. 매입 역발행(제조사→유통스타트) 미구현** + 정산 성숙 전용 cron(`wholesale-settle-tick`) + 미수/미지급 aging 리포트. **M**
- **NOTI-1. 품절 알림 + 주문별 메모 스레드 + 알림톡 연결**(소비자 `retry-alimtalk` 재사용). 가격변경 *예고* 통지. **S~M**
- **DATA-1. FK/orphan sweep**: supply 모델 전반 FK 없음 → 일일 orphan 점검(공급사/상품 삭제 후 dangling 정산·access 행 flag). **S**
- **SCALE-1. 다통화/세율 추상화 + 카테고리 트리 + 공급사 API 인입** — **현 단계 과투자, 보류**. **L**

---

## 결정 필요 (product intent — 코드 바꾸기 전 확인)
1. **최저가 검수 게이트**: `lowest_price_checked`가 현재 *advisory*(체크 안 해도 승인·게시 가능). 스펙 주석은 게이트 의도. → "검수 미완 상품은 게시 불가"로 강제할지? (강제 시 approve에서 `!checked` 거부 또는 catalog `visibilityWhere`에 조건 추가)
2. **공급사 지급 원천징수**: 세금계산서 기반 B2B(gross) vs 소득형(원천징수)? 바로빌 wiring상 전자로 보이나 명시 필요.
3. **여신 도입 여부/범위**: 사업적으로 가장 큰 결정. 도입 시 등급/한도/연체 정책.

---

## 우선순위 권고 (opinionated)
- **즉시(저위험·고가치)**: SCHEMA-1(콜드스타트 500, 1줄), OPS-1(등급 감사로그), OPS-2(WeakSet), IDX-1(인덱스), ORD-1(승인 CAS). — 전부 안전한 하드닝, staging 부담 적음.
- **머니패스(staging E2E 필수)**: PAY-1(clawback), PAY-2(한도 원자성), SCHEMA-2(정산 UNIQUE), PAY-3/4(원자성·레이스). — 1 commit 1 원인, 실결제 검증.
- **보안**: SEC-1(주문 hijack) — 실재 버그, 라인 스코핑.
- **사업 신뢰 가성비 1위**: BIZ-1(유통사 클레임/RMA, M) — 인프라 재사용, 배선만.
- **사업 임팩트 최대**: BIZ-2(여신, L) — "사입 0원" 완성.
- **하지 말 것(현 단계)**: SCALE-1 다국가/통화 과투자.

> 핵심 근거 파일: `wholesale.routes.ts`(주문/카탈로그/검색), `wholesale-supplier.routes.ts`(제조사 환불), `supply-settlement.ts`/`wholesale-settlement.ts`(정산), `distributor-pricing.ts`(등급가/tier), `supply-visibility.ts`(MOQ/스키마), `admin-products.routes.ts`(승인/최저가검수), `distributor-admin.routes.ts`(등급/세금), `seller-orders.routes.ts`(콜드스타트), `src/worker/cron/`(도매 전용 cron 0개).
