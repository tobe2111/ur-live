# 유통스타트(UtongStart) 도매몰 소개서 — 디자인 AI용 콘텐츠 브리프 (SSOT)

> **이 문서의 성격**: 디자인 AI가 "도매몰(B2B 유통 플랫폼) 소개서/세일즈 덱"을 레이아웃하기 위한 **원본 콘텐츠 소스**입니다.
> 비주얼 디자인이 아니라 **그 안에 들어갈 모든 텍스트·수치·구조**를 담았습니다.
> **모든 수치는 실제 코드/설정에서 추출**했으며, 출처 파일을 명시합니다. 불확실하거나 운영 정책으로만 정해지는 값은 `[확인 필요]` / `[가정]` 으로 표기.
>
> **출처 코드/문서**:
> - `docs/design/wholesale-utongstart.md`, `wholesale-b2b-spec.md`, `wholesale-supply.md`, `wholesale-b2b-mindmap.md`
> - `src/lib/distributor-pricing.ts` (등급가 산출 엔진)
> - `src/features/supply/api/*.routes.ts` (wholesale / supplier / distributor-admin / supplier-dashboard)
> - `src/features/supply/api/supply-visibility.ts`, `supply-settlement.ts`, `wholesale-settlement.ts`
> - `src/features/admin/api/admin-products.routes.ts` (최저가 검수 + 가격변경 승인)
> - `src/features/supply/api/distributor-admin.routes.ts` (등급 시드)
> - `src/features/guides/api/guide-seed-wholesale.ts` (운영 SSOT 가이드)
> - `src/worker/utils/tax-withholding.ts`, `CLAUDE.md`

---

## 0. 핵심 사실 요약 (디자인이 절대 틀리면 안 되는 수치)

| 항목 | 값 | 출처 |
|---|---|---|
| 등급 마진율 기본값 | A 10% / B 15% / **C 20%(기본)** / D 25% / OEM 8% / 특별 0% | `distributor-pricing.ts` `DEFAULT_GRADE_MARGINS`, `distributor-admin.routes.ts` 시드 |
| 유통사 가입 시 자동 등급 | **C등급** (미배정도 C로 동작) | `distributor-pricing.ts` `DEFAULT_UNGRADED='C'` |
| 등급가 공식 | 유통사 공급가 = 제조사 공급가 × (1 + 등급마진율) | `distributor-pricing.ts` `distributorPrice()` |
| 정산 — 브랜드 제품 | **익일**(1일 보호창) 성숙 | `wholesale-settlement.ts` `BRAND_REFUND_WINDOW_DAYS=1` |
| 정산 — 일반 제품 | **7일** 환불창 후 성숙 | `wholesale-settlement.ts` `REFUND_WINDOW_DAYS=7` |
| 플랫폼 1일 정산 한도 | **기본 1억원** (조정 가능) | `supply-settlement.ts` `DEFAULT_DAILY_CAP=100,000,000` |
| 원천징수 — 사업소득 | **3.3%** (default) | `tax-withholding.ts` `WITHHOLDING_RATES.business_income=0.033` |
| 원천징수 — 기타소득 | **8.8%** (단발성) | `tax-withholding.ts` `WITHHOLDING_RATES.other_income=0.088` |
| 부가세 처리 | 공급가 = 총액 ÷ 1.1 (10% 분리) | `guide-seed-wholesale.ts` tax 섹션 |
| MOQ(최소주문수량) | 상품별 설정, 기본 1(낱개), 1~100,000 | `supply-visibility.ts` `min_order_qty`, `supplier-dashboard.routes.ts` |
| 공급 범위 모드 | ALL / APPROVED_CHANNEL / UTONGSTART_ONLY (3종, self-serve는 UTONGSTART_ONLY→APPROVED 강등) | `supply-visibility.ts` `SUPPLY_VISIBILITY_VALUES`, `normalizeVisibility` |
| 신규 상품 게이트 | 등록=pending(미노출) → 최저가 검수 후 승인 시 노출 | `supplier-dashboard.routes.ts`, `admin-products.routes.ts` |
| 가입 심사 | 제조사·유통사 모두 **사업자등록번호 + 사업자등록증 이미지 필수 + 관리자 승인**(status='pending', 승인 전 로그인/이용 불가) | `supplier-auth.routes.ts`, `wholesale.routes.ts` `/register` |
| 카카오 입점 | 카카오 일반 유저가 제조회원(`/supplier/become`)·유통회원(`/become-distributor`)으로 전환 — same-email 자동연결은 `email_verified===1` 일 때만(takeover 차단) | `supplier-auth.routes.ts` `/become`, `wholesale.routes.ts` `/become-distributor` |
| 계정 상태 | pending / approved / suspended / rejected (정지·거부 시 대시보드 알림) | `admin-suppliers.routes.ts` PATCH `/suppliers/:id` |
| 도매 주문 상태 | PENDING → PAID → SHIPPED, 그 외 EXPIRED(미결제 1시간)/FAILED/PARTIAL_REFUNDED/REFUNDED | `wholesale.routes.ts`, `distributor-admin.routes.ts` |
| 판매 중 가격 변경 | 제조사 즉시변경 불가 → `pending_*` 적재(라이브 불변) → 운영 승인 시 반영 + 이력 | `supplier-dashboard.routes.ts` price-change-request, `admin-products.routes.ts` price-change |
| OEM/ODM | 신청 `open→matching→matched`, OEM 등급 8% | `oem-requests.ts`, `/wholesale/oem` |
| 전자세금계산서 | 바로빌 키 설정 시 자동 발행, 미설정 시 내부(인쇄용) 발행 | `services/barobill.ts`, `distributor-admin.routes.ts` |
| 결제 방식 | 선결제(Toss) **또는 여신/외상**(`payment_method:'credit'`) — 여신은 `여신한도 − 미수금 ≥ 주문액` & 동결(`credit_frozen=0`) 충족 시 Toss 미경유 `ON_CREDIT` 주문 생성(v1) | `wholesale.routes.ts` `/orders`(payment_method), `distributor-admin.routes.ts` `/distributors/:id/credit` |
| 여신/외상 (BIZ-2) | 유통사별 여신한도(`distributor_credit_limit`) 내 외상 발주 — 원자적 미수금 청구(`outstanding_balance` + `wholesale_credit_ledger`), 공급사는 즉시 정산(플랫폼이 채권 보유), 어드민이 한도·동결·상환 관리 | `wholesale.routes.ts` 여신 게이트, `distributor-admin.routes.ts` `/credit`·`/credit-repayment` |
| 유통사 클레임/RMA (BIZ-1) | 유통사 `POST /claims`(불량/오배송/파손/수량부족/기타 + 증빙) → 어드민 검토(open→reviewing→approved/rejected/resolved). **클레임 open 시 해당 공급사 정산 보류**(`held_at`, 성숙 스킵), 승인 시 기존 어드민 환불로 처리 | `wholesale-claims.routes.ts` |
| 견적/발주(Quote/PO) (BIZ-3) | 유통사 `POST /quotes`(견적요청) → 어드민 `respond`(단가/MOQ/유효기간) → 유통사 accept/reject. 상태 requested→quoted→accepted/rejected/expired/converted (v1 단일 라인, 주문 자동전환은 향후) | `wholesale-quotes.routes.ts` |
| 카탈로그 검색/필터/정렬 (BIZ-4) | FTS5 검색(상품명/설명, LIKE 폴백) + 정렬 화이트리스트(인기/가격↓/가격↑/할인율/신상) + 필터(카테고리/가격대/재고있음). 파라미터 없는 기본 요청은 기존 동작 불변 | `wholesale.routes.ts` GET `/catalog` 검색 |
| 최소 플랫폼 마진 floor (PRC-1) | 수량할인 하한 = `min(등급가, 공급원가×(1+wholesale_min_platform_margin_pct))`. 기본 0(기존과 동일), 어드민이 PG 수수료 등을 덮도록 설정 가능 → 수량할인이 플랫폼 마진을 0으로 무너뜨릴 수 없음 | `distributor-pricing.ts` `effectiveTierFloor`, `platform_settings.wholesale_min_platform_margin_pct` |
| 도매몰 홈 큐레이션 | 베스트(판매순)·신상품·맞춤 제안·카테고리 큐레이션을 등급가로 묶어 반환 | `wholesale.routes.ts` GET `/home` |
| 빠른 재주문 | 유통사 본인 최근 사입 상품 + 마지막 주문 수량으로 원클릭 재발주 | `wholesale.routes.ts` GET `/recent-items` |
| 상품 제안(추천) | 운영자가 특정 유통사에게 상품을 직접 추천(`wholesale_proposals`) → 유통사 홈/목록 노출, 철회(`withdrawn`) 가능 | `distributor-admin.routes.ts` `/proposals`, `wholesale.routes.ts` GET `/proposals` |
| 비로그인 카탈로그 둘러보기 | 몰-first — 미로그인도 카탈로그·상세 열람 가능, 등급 공급가는 로그인 시에만 노출 | `wholesale.routes.ts` GET `/catalog`(guest) |
| 제조사 반품 승인(C/S) | 다중 제조사 주문에서 **본인 라인만** 부분환불 → Toss 부분취소 + 정산 역전 + 재고복원, 주문 PARTIAL_REFUNDED | `wholesale-supplier.routes.ts` POST `/orders/:id/refund` |
| 플랫폼 사업자정보 | 전자세금계산서 발행에 필요한 유통스타트 사업자정보(`platform_settings`) 관리 | `distributor-admin.routes.ts` `/company-info` |
| SPECIAL 등급 = 기간 한정 | 유통사별 `special_discount_until` 기간 안에서만 SPECIAL(0%) 유효, 만료 시 배정 등급으로 자동 복귀 | `distributor-pricing.ts` `effectiveGrade`, `distributor-admin.routes.ts` PATCH `/distributors/:id` |
| 도메인 | **utongstart.com** (live.ur-team.com 과 같은 코드/DB, 호스트 인식 라우팅) | `wholesale-utongstart.md` Phase 5/6 |
| 셀러 정산 기본 수수료(소비자 라이브커머스) | 5% (`platform_settings.commission_rate_default`) | `CLAUDE.md` |

---

## 1. 문서 목적 & 타깃 독자

### 1-1. 문서 목적
유통스타트 B2B 도매몰을 **두 종류의 잠재 파트너에게 동시에** 설명·설득하는 세일즈/소개 자료. 발견→이해→가입 퍼널의 상단을 담당.

### 1-2. 두 타깃 (분리해서 메시징)

| 타깃 | 정체 | 코드상 주체 | 이 소개서에서 그들이 원하는 답 |
|---|---|---|---|
| **(A) 제조사 / 브랜드사** | 상품을 만들지만 판로·영업·미수금이 고민 | `suppliers` 테이블 (제조회원) | "재고·영업 없이 새 판로가 생기나? 정산은 안전·빠른가? 내 원가/거래처가 노출되나?" |
| **(B) 유통사 / 셀러(도매회원)** | 좋은 상품을 사입 없이 떼다 팔고 싶은 소매·판매업체 | 기존 `sellers` 계정 + `distributor_grade` | "사입 자금 0원, 무재고로 팔 수 있나? 마진은? 가격 질서는 지켜지나?" |

> **[디자인 지시]** 표지 직후 또는 목차에서 **"제조사를 위한 페이지 / 유통사를 위한 페이지"** 두 트랙을 시각적으로 분기(좌/우 컬럼 또는 탭형 아이콘). 독자가 자기 트랙을 즉시 찾게.

### 1-3. 타깃별 핵심 메시지 (한 줄)
- **제조사**: "만들기만 하세요. 판로·영업·정산은 유통스타트가." (무재고 드랍쉽 + 검증된 유통망 + 빠른 정산)
- **유통사**: "사입 0원, 재고 0개로 도매 유통을 시작하세요." (등급 공급가 + 무재고 + 자동 정산)

---

## 1-A. 📌 이 소개서의 범위 & 경계 (다른 소개서와 헷갈리지 않게 — 필독)

> **이 소개서 = 유어딜의 B2B(도매·유통) 사업 전부의 단일 소유 문서(SSOT).** 아래 D1~D6(도매 카탈로그·주문, 제조사 대시보드, 유통사 등급제, OEM/ODM, 명세서/세금계산서, B2B 정산)을 **빠짐없이** 다룬다. B2C(소비자 대면) 사업은 별도 소개서가 소유하므로 여기서는 다루지 않는다. (출처: `00-service-overview-and-coverage.md` 카테고리 D + §4-1)
>
> **📌 정책 결정 (2026-06-07)**: 4대 소개서 체계는 유지하고, **B2B 도매(유통스타트)의 모든 sub-line(D1~D6)은 본 문서가 흡수·소유**한다. 다른 소개서(온라인 입점·오프라인 공구·링크샵)는 B2B를 다루지 않으며, B2B 관련 질문이 나오면 본 문서로 라우팅한다. 본 문서가 다루는 전면 영역(반드시 포함): **① 도매 카탈로그/주문(§7, §9-B), ② 제조사 대시보드(§5, §7-1), ③ 유통사 등급제(A/B/C/D/OEM/SPECIAL + 상품별 override + volume tier — §6-1, §8-1), ④ OEM/ODM 매칭(§6-A), ⑤ 거래명세서/세금계산서·바로빌·부가세 분리(§8-5), ⑥ B2B 정산(성숙·환불창·1일 한도·환불 역전 — §8-2~8-4), ⑦ 온라인 최저가 검수 + 공급가 변경 승인(§9-A), ⑧ 합배송/드랍쉽/송장 CSV(§9-B), ⑨ 공급 범위 3종 + 유통채널 선정(§9-C), ⑩ 전용 운영 가이드 인계(§11), ⑪ 여신/외상 결제(§9-D), ⑫ 유통사 클레임/RMA(§9-E), ⑬ 견적/발주 Quote/PO(§9-F), ⑭ 카탈로그 검색·필터·정렬 고도화(§9-G).**

### 1-A-1. B2B(이 소개서) vs B2C(온라인 입점·기타 소개서) 대비표

| 축 | **이 소개서 = B2B 도매몰 (유통스타트)** | 온라인 입점 / 오프라인 공구 / 링크샵 = B2C |
|---|---|---|
| **거래 당사자** | 제조사 ↔ (플랫폼) ↔ **유통사** (사업자 간 사입) | 셀러 → **최종 소비자** |
| **도메인** | **utongstart.com** (루트 진입 시 `/wholesale/intro` 302) | live.ur-team.com |
| **"주문"의 의미** | **B2B 사입** — 유통사가 도매 공급가로 떼는 도매 발주(`wholesale_orders`) | 소비자 개별 구매·공동구매(`orders`) |
| **가격** | **등급별 차등 공급가**(원가 비노출) | 단일 소비자 판매가(공개) |
| **결제 주체** | 유통사(사업자)가 선결제(Toss) 또는 여신/외상(`ON_CREDIT`) 발주 | 소비자가 결제 |
| **정산 대상** | 제조사(supplier) — `supplier_settlements` source=`wholesale` | 셀러/매장 — `settlements` |
| **테마/UI** | **라이트 테마 고정**(B2B 신뢰), 소비자 BottomNav 미표시 | 다크/라이트 토글 등 소비자 UX |
| **코드 주체** | `suppliers`(제조) + `sellers`+`distributor_grade`(유통) | `sellers`, `users` |
| **소유 소개서** | **wholesale-mall-brief (본 문서)** | online-listing / offline-groupbuy / linkshop |

### 1-A-2. ⚠️ "공동구매"·"드랍쉽" 용어 충돌 주의 (혼동 차단)

- **도매몰의 "주문/사입" ≠ 소비자 "공동구매".** 소비자 공동구매(A6, 온라인 입점 소유)는 *즉시판매형 단일가* 모델로 최종 소비자가 산다. 도매몰의 주문은 *유통사(사업자)가 재판매 목적으로 떼는* B2B 발주다. **같은 단어라도 경제·당사자·테이블이 다르다.**
- **드랍쉽도 2종 존재**: (1) **B2B 드랍쉽**(이 소개서) = 유통사가 무재고로 도매 등록, 제조사가 소비자에게 직배송(`wholesale_orders` → 제조사 송장). (2) **소비자 드랍쉽/위탁**(온라인 입점) = 셀러가 공급상품(`products.supply_source_id`)을 복제 등록, 판매 시 원본 제조사에게 즉시 split 적립(`supply-settlement.ts` source=`consumer`, 7일 환불창). **둘은 정산 소스(`wholesale` vs `consumer`)로 코드상 완전 분리**된다.

### 1-A-3. B2B↔B2C 연결 — "판로 2배" 메시지 (제조사 어필)

> 같은 코드베이스/DB이므로, 도매몰에 올린 제조사 공급상품은 **(1) utongstart.com 도매 카탈로그(유통사 사입)** 와 **(2) live.ur-team.com 셀러가 위탁/드랍쉽으로 복제 판매(소비자向)** 두 판로에 동시 노출될 수 있다(`supply_source_id` 연결). 즉 **"한 번 등록 → B2B·B2C 양쪽 판로"**. 단, 본 소개서의 핵심 메시지는 **B2B 도매**이며 B2C 연결은 보조 가치로만 1줄 언급한다. (출처: `00-service-overview` §4-1 "판로 2배", `supply-settlement.ts`)

> **[디자인 지시: 그라데이션]** 1-A-1 대비표의 **헤더행은 시그니처 그라데이션**(흰 글자), B2B 컬럼 셀에 시그니처 포인트·B2C 컬럼은 뉴트럴 회색(`#F4F5F7`). 표 본문 데이터는 흰/뉴트럴 위(가독). 상단 섹션 라벨 칩만 시그니처 띠. 별도 슬라이드로 뽑을 경우 "**B2B vs B2C — 우리가 어느 쪽을 말하나**" 헤드라인.

---

## 2. 한 줄 요약 & 엘리베이터 피치

### 2-1. 한 줄 요약 (전체)
> **유통스타트는 선별된 제조사와 선별된 유통사를 잇는 B2B 도매 중개 플랫폼입니다. 양측은 서로 만나지 않고, 모든 거래·정산·세금계산서는 유통스타트를 경유합니다.**

### 2-2. 엘리베이터 피치 (타깃별 1문장)
- **제조사용**: "재고·영업 인력 없이, 검증된 유통사들이 당신의 상품을 떼다 팔고, 유통스타트가 거래처 노출 없이 정산까지 책임지는 무재고 드랍쉽 도매 채널."
- **유통사용**: "사입 자금과 재고 리스크 없이, 등급별 도매 공급가로 검증된 제조사 상품을 골라 팔고, 합배송·세금계산서·정산을 자동으로 받는 B2B 소싱 플랫폼."

> **[디자인 지시]** 표지 슬라이드 헤드라인 후보로 2-1을 사용. 폰트 크게, 한 화면 1문장.

---

## 3. 시장 / 문제 정의 (페인포인트)

> **[디자인 지시]** "Before(기존 도매 유통)" 의 고통을 제조사·유통사 두 컬럼으로 나란히 그리고, 다음 슬라이드 "After(유통스타트)" 로 해소.

### 3-1. 제조사(브랜드사)의 페인
- **판로 확보가 어렵다** — 좋은 상품을 만들어도 떼다 팔 유통망·영업 인력이 없다.
- **재고/물류 부담** — 위탁 판매처마다 재고를 밀어넣어야 하고 안 팔리면 반품 리스크.
- **미수금/정산 불안** — 여러 거래처에 깔린 외상 회수, 부도 리스크.
- **가격 질서 붕괴** — 거래처마다 제멋대로 최저가 경쟁 → 브랜드 가치 훼손.
- **거래처 직접 노출** — 내 원가·거래선이 경쟁사/타 유통사에 새는 위험.

### 3-2. 유통사(소매/판매업체)의 페인
- **사입 자금 부담** — 도매로 떼려면 목돈을 선투자해야 한다.
- **재고 리스크** — 안 팔리면 떠안는다(악성 재고).
- **최저가 출혈 경쟁** — 같은 상품을 누구나 떼서 가격이 무너진다.
- **공급처 신뢰 부족** — 검증 안 된 도매처, 들쭉날쭉한 품질·가격.
- **세금/정산 잡무** — 거래명세서·세금계산서·정산 대사를 직접 처리.

> **[디자인 지시]** 각 페인을 아이콘 + 한 줄로. 6개 이하로 압축. 색조는 어둡게(문제) → 다음 슬라이드에서 밝게(해결) 대비.

---

## 4. 솔루션 = 3자 구조 다이어그램 (핵심 1장)

> **❌ 단순 오픈 도매몰이 아님.** 선별된(vetted) 제조사·유통사만 참여. **제조사 ↔ 유통사 직거래 금지** — 서로 신원·연락처·원가 비노출. 모든 흐름은 유통스타트 경유. (출처: `wholesale-utongstart.md` §1)

### 4-1. 텍스트 다이어그램 (디자인이 그릴 골격)

```
   제조사            유통스타트(플랫폼)            유통사            최종 소비자
(Manufacturer)        (UtongStart)            (Distributor)        (Consumer)
     │                     │                       │                   │
     │── ① 공급(원가) ────▶│                       │                   │
     │                     │── ② 공급(등급가) ────▶│                   │
     │                     │                       │── ③ 판매 ────────▶│
     │◀── ④ 정산(원가) ────│◀── ⑤ 선결제(Toss) ───│                   │
     │── ⑥ 세금계산서 ────▶│── ⑦ 세금계산서 ──────▶│                   │
     │── ⑧ 송장/배송 ───────────(드랍쉽 직배송)──────────────────────▶│
```

### 4-2. 각 화살표의 의미 (디자인 라벨용)

| # | 흐름 | 방향 | 내용 |
|---|---|---|---|
| ① | 공급(원가) | 제조사 → 플랫폼 | 제조사가 정한 **공급가(원가, `supply_price`)** 로 상품 등록 |
| ② | 공급(등급가) | 플랫폼 → 유통사 | 원가 × (1+등급마진) = **유통사 등급 공급가**. 마진 = 플랫폼 수익 |
| ③ | 판매 | 유통사 → 소비자 | 유통사가 자기 판매가로 재판매 |
| ④ | 정산(원가) | 플랫폼 → 제조사 | 제조사에는 **원가만** 지급(마진 비노출) |
| ⑤ | 결제 | 유통사 → 플랫폼 | 주문 시 **Toss 선결제** 또는 **여신/외상 발주**(`ON_CREDIT` — 여신한도 내). 어느 쪽이든 제조사 정산은 즉시 발생(외상은 플랫폼이 채권 보유) |
| ⑥ | 세금계산서 | 제조사 → 플랫폼 | 매입 방향(제조사가 유통스타트 앞 발행) |
| ⑦ | 세금계산서·거래명세서 | 플랫폼 → 유통사 | 매출 방향(유통스타트가 유통사 앞 발행) |
| ⑧ | 송장/배송 | 제조사 → 소비자 | **드랍쉽 직배송**(유통사 무재고). 유통사·제조사 신원 상호 비노출 |

> **[디자인 지시]** 이 3자 구조도가 소개서의 **시그니처 비주얼**. 가운데 "유통스타트" 를 허브로 크게, 좌(제조사)·우(유통사)·우상단(소비자) 배치. **"제조사 ↔ 유통사 직거래 금지(신원 비노출)"** 를 둘 사이 점선 + 자물쇠 아이콘으로 명확히 표현.

---

## 5. 제조사(브랜드사) 가치 제안

> 코드상 제조사 = `suppliers` 테이블(제조회원). 가입 `/supplier/register`, 대시보드 `/supplier`.

| 가치 | 구체 기능 / 근거 | 출처 |
|---|---|---|
| **무재고 드랍쉽 판로** | 위탁/드랍쉽 모델 — 유통사는 재고 없이 등록, 팔리면 제조사가 직배송 | `wholesale-supply.md` D4 확정 |
| **검증된 새 유통망** | 선별된 유통사에게만 노출. 직접 영업 불필요 | `wholesale-utongstart.md` §1 |
| **빠른 정산** | 브랜드 제품 **익일**, 일반 제품 7일 환불창 후 성숙 → 자동 지급 | `wholesale-settlement.ts` |
| **원가·거래처 비노출** | 유통사에는 **등급가만** 노출, 제조사 원가·신원 서버 차단. 제조사도 유통사 명단 못 봄 | `guide-seed-wholesale.ts` onboarding §, `wholesale.routes.ts` |
| **가격 질서 보호 — 온라인 최저가 게이트** | 신규 상품은 **온라인 최저가 확인(`lowest_price_checked`) + 참고 링크(`lowest_price_url`) 가 있어야만** 승인·노출 가능(권고가 아닌 **하드 게이트**). 누락 시 어드민이 승인 자체 불가 | `admin-products.routes.ts` PATCH `/supplier-products/:id` |
| **가격변경 운영 승인 (동시성 안전)** | 판매 중 상품 가격은 제조사가 임의 변경 불가 → 요청 적재 후 운영 승인 시에만 라이브 반영. 승인/반려는 **CAS 동시성 가드**로 이력 중복·노출 레이스 차단 | `supplier-dashboard.routes.ts` price-change-request, `admin-products.routes.ts` price-change |
| **공급 범위 선택** | 전체/승인 채널/유통스타트 채널 3종으로 노출 대상 통제. **승인 채널은 제조사가 직접 유통사 지정/해제**(self-serve) | `supply-visibility.ts`, `supplier-dashboard.routes.ts` `/products/:id/channel-access` |
| **간편 운영 도구** | CSV 대량 상품등록, 주문확인 export, 송장 일괄 업로드, 합배송, 바코드, OEM/ODM | `supply-csv.ts`, `wholesale.routes.ts` |
| **반품·C/S 직접 처리** | 다중 제조사 주문에서 **본인 라인만** 반품 승인 → Toss 부분취소 + 정산 역전 + 재고복원 (타 제조사 라인 무영향) | `wholesale-supplier.routes.ts` POST `/orders/:id/refund` |
| **안전한 결제·정산** | Toss 선결제 SSOT, oversell 자동 가드, 1억/일 정산 한도, 환불 자동 역전 | `wholesale.routes.ts`, `supply-settlement.ts` |

> **정산 지급 파이프라인 (코드 정밀)**: 결제완료 시 라인별 공급가가 제조사 `supplier_balances.pending_amount` 에 적립 → 환불창(브랜드 1일/일반 7일) 경과분이 cron·어드민 조회 시 `matureSupplierSettlements()` 로 `available` 성숙 → 어드민이 `/admin/suppliers` 에서 **available 잔고 전액 지급**(`payoutSupplier()`, 1일 1억 한도 검사 + `supplier_payouts` 기록 + 원장 기입). 잔고는 pending/available/paid 3단으로 대시보드(`/supplier`)에 표시. (출처: `supply-settlement.ts`, `admin-suppliers.routes.ts`, `supplier-dashboard.routes.ts` `/me`)

> **[디자인 지시]** 제조사 혜택 슬라이드는 "만들기만 하세요" 카피 아래 **무재고 / 빠른 정산 / 비노출 / 가격질서** 4대 혜택을 카드로.

---

## 6. 유통사(셀러/도매회원) 가치 제안

> 코드상 유통사 = 기존 `sellers` 계정 + `distributor_grade`. 가입 `/wholesale/join`, 카탈로그 `/wholesale`.

| 가치 | 구체 기능 / 근거 | 출처 |
|---|---|---|
| **사입 0원 · 무재고** | 재고 없이 등록, 팔리면 제조사가 직배송(드랍쉽) | `wholesale-supply.md` D4 |
| **등급별 도매 공급가** | 가입 시 자동 C등급, 운영 승인으로 A/B 상향 가능 → 더 낮은 마진(저렴) | `distributor-pricing.ts` |
| **수량 구간 할인** | 많이 살수록 추가 % 할인(상품별 `100:5, 500:10` 등). 단, 원가 이하로는 안 내려감 | `distributor-pricing.ts` `tierUnitPrice()` |
| **합배송** | 한 주문의 같은 제조사 상품을 송장 1개로 일괄 발송 | `wholesale.routes.ts` ship-all |
| **자동 정산·세금** | 거래명세서/세금계산서/거래내역서 자동, 바로빌 전자세금계산서 | `tax-documents.ts`, `guide-seed-wholesale.ts` |
| **검증된 상품만** | 선별 제조사 + 최저가 검수 통과 상품 → 출혈 경쟁 완화 | `admin-products.routes.ts` |
| **선결제 안전** | Toss 즉시결제, 재고 부족 시 자동 전액환불 | `wholesale.routes.ts` confirm |
| **여신/외상 발주 (BIZ-2, 신규 v1)** | 선결제만 가능하던 제약 해소 — 여신한도 내에서 무현금 외상 발주(`ON_CREDIT`). 사입 자금이 매출보다 늦게 들어와도 발주 가능 | `wholesale.routes.ts` `/orders` `payment_method:'credit'` |
| **클레임/RMA (BIZ-1, 신규 v1)** | 불량·오배송·파손·수량부족을 증빙과 함께 정식 접수(`/claims`) → 운영 검토·환불. 접수 즉시 해당 공급사 정산 보류로 구매 보호 | `wholesale-claims.routes.ts` |
| **견적/발주 Quote/PO (BIZ-3, 신규 v1)** | 카탈로그 단가가 아닌 **견적 협의** 가능 — 견적요청 → 운영자 단가/MOQ/유효기간 회신 → 수락/거절 | `wholesale-quotes.routes.ts` |
| **검색·필터·정렬 (BIZ-4, 신규)** | 상품명/설명 검색(FTS5) + 인기/가격/할인율/신상 정렬 + 카테고리·가격대·재고 필터로 빠른 소싱 | `wholesale.routes.ts` GET `/catalog` |
| **소싱 큐레이션 홈** | 베스트(판매순)·신상품·맞춤 제안·카테고리를 내 등급가로 한 화면에 | `wholesale.routes.ts` GET `/home` |
| **빠른 재주문** | 최근 사입 상품 + 마지막 수량을 자동 채워 원클릭 재발주 | `wholesale.routes.ts` GET `/recent-items` |
| **맞춤 상품 제안** | 운영자가 내 계정에 직접 추천한 상품을 홈/목록에서 확인 | `wholesale.routes.ts` GET `/proposals` |
| **로그인 전 둘러보기** | 가입 전에도 카탈로그·상세 열람 가능(가격은 로그인 후) | `wholesale.routes.ts` GET `/catalog`(guest) |

### 6-1. 등급 / 마진 수치표 (실제 기본값)

| 등급 | 라벨 | 기본 마진율 | 의미(유통사 입장) |
|---|---|---|---|
| **A** | A등급 | **10%** | 최우대(가장 저렴한 공급가) |
| **B** | B등급 | **15%** | 우대 |
| **C** | C등급(기본) | **20%** | 가입 시 자동 배정 |
| **D** | D등급 | **25%** | 일반 |
| **OEM** | OEM | **8%** | OEM/ODM 생산 거래 |
| **SPECIAL** | 특별할인(기간한정) | **0%** | 덤핑/유통기한 임박품, 기간 한정 |

> **SPECIAL = 유통사별 기간 한정 (코드 정밀)**: 관리자가 유통사에 `special_discount_until`(만료일시)을 설정하면 그 기간 안에만 유효 등급이 SPECIAL(0% 마진)로 승격되고, 만료되면 배정 등급(없으면 C)으로 자동 복귀한다. 상품이 아니라 **유통사 계정에 거는 한시 프로모션**. (출처: `distributor-pricing.ts` `effectiveGrade`, `distributor-admin.routes.ts` PATCH `/distributors/:id` `special_discount_until`)

> 출처: `distributor-admin.routes.ts` 시드 `('A',...,10),('B',...,15),('C',...,20),('D',...,25),('OEM',...,8),('SPECIAL',...,0)` + `distributor-pricing.ts` `DEFAULT_GRADE_MARGINS`.
> ⚠️ 이 값은 **운영자가 `/admin/distributor-grades` 에서 조정 가능한 기본값**. 소개서에 "예시 기본 마진율" 로 표기 권장.

### 6-2. 마진 계산 예시 (디자인 표현용 — 1만원 원가 기준)

| 등급 | 공식 | 유통사 공급가 | 플랫폼 마진 |
|---|---|---|---|
| A (10%) | 10,000 × 1.10 | **11,000원** | 1,000원 |
| C (20%, 기본) | 10,000 × 1.20 | **12,000원** | 2,000원 |
| D (25%) | 10,000 × 1.25 | **12,500원** | 2,500원 |

> **[디자인 지시]** 6-1/6-2 를 깔끔한 표 또는 막대그래프로. "고등급일수록 저렴" 을 화살표로.
> ⚠️ 위 예시 금액은 공식 기반 산출(코드 공식 정확). 실제 마케팅용 예시 금액은 운영팀이 확정 — `[확인 필요]` 표기 가능.

---

## 6-A. 🏭 OEM/ODM 매칭 (제조 위탁 — 전용 타깃)

> 단순 사입을 넘어 **"내 브랜드로 만들고 싶다"** 는 유통사를 위한 제조 위탁 매칭. 일반 등급제와 별개 흐름·전용 등급(OEM 8%). (출처: `oem-requests.ts`, `distributor-admin.routes.ts` OEM 관리, `distributor-pricing.ts` `DEFAULT_GRADE_MARGINS.OEM=8`)

### 6-A-1. 흐름 (상태 머신)
- 유통사 신청(`open`) → 유통스타트 검토/제조사 찾기(`matching`) → 제조사 매칭 완료(`matched`) → 종료(`closed`) / 반려(`rejected`). (`oem-requests.ts` `OEM_STATUSES`)
- 신청 항목: 종류(OEM/ODM), 상품명, 카테고리, 목표 수량(`target_qty`), 목표 단가(`target_price`), 메모. 매칭 시 `matched_supplier_id` + `admin_memo` 기록. (`oem_requests` 테이블)

### 6-A-2. 가치
- **유통사**: 좋은 제조사를 직접 못 찾아도 유통스타트가 **제조사 찾기·연결·생산까지 지원**. 제조 위탁 거래는 **OEM 등급(8% — 최저 마진대)** 로 공급.
- **제조사**: 새 OEM/ODM 생산 물량 수주 채널(자기 브랜드 외 추가 매출).

> **[디자인 지시: 그라데이션]** "**내 브랜드로 만들고 싶다면**" 헤드라인. 신청→매칭→생산 4단계 타임라인(단계 배지 = 시그니처 그라데이션 원, "매칭" 노드 = warm 그라데이션). OEM 8% 배지는 시그니처 그라데이션. 진입: `/wholesale/oem`.

---

## 7. 작동 방식 (스텝 바이 스텝)

> **[디자인 지시]** 제조사 흐름과 유통사 흐름을 **별도 타임라인**으로. 번호 원형 스텝 + 화살표.

### 7-1. 제조사 흐름
1. **가입** — `/supplier/register` (아이디 영문+숫자 8자 이상).
2. **승인** — 어드민이 `/admin/suppliers` 에서 제조회원 승인.
3. **상품 등록** — `/supplier` 대시보드에서 공급가·공급범위·바코드·**온라인 최저가 링크** 입력 (개별 또는 CSV 대량).
4. **검수** — 어드민이 최저가 시세 확인 → `온라인 최저가 확인함` 체크 후 승인(`is_active=1`).
5. **노출** — 승인 즉시 선별 유통사 카탈로그에 등급가로 노출.
6. **주문 접수** — 유통사 선결제 완료 시 대시보드에 주문 + 배송지(본인 라인만).
7. **드랍쉽 배송** — 송장 입력(개별/합배송/CSV). 전 라인 발송 시 SHIPPED.
8. **정산** — 브랜드 익일 / 일반 7일 후 성숙 → 자동 지급. 세금계산서는 유통스타트 앞.

### 7-2. 유통사 흐름
1. **가입** — `/wholesale/join` (기존 셀러 온보딩으로 funnel). 가입 즉시 **자동 C등급**.
2. **등급 배정(선택)** — 운영자가 `/admin/distributor-grades` 에서 A/B 상향.
3. **카탈로그 탐색** — `/wholesale` 에서 내 등급 공급가·MOQ·수량할인 확인(원가·제조사 비노출).
4. **주문 + 선결제** — 장바구니 → **Toss 선결제**(`/orders` → `/orders/confirm`). 서버 금액 재계산.
5. **드랍쉽 배송** — 제조사가 소비자에게 직배송. 송장 흐름 제조사→(유통사 노출)→구매자.
6. **정산·세금** — 거래명세서/세금계산서/거래내역서 자동(`/wholesale/documents`, `/wholesale/statement`).

---

## 8. 가격 / 수수료 / 정산 구조

### 8-1. 등급 마진율 (= 플랫폼 수익) — §6-1 참조
유통사 공급가 = 제조사 공급가 × (1 + 등급마진율). **마진 = 유통스타트 수익.** 제조사에는 원가만 정산.
- 상품별 마진 override(`supply_margin_override_pct`): 설정 시 **등급 무관 모든 유통사 동일가**(전략/특가/임박품). NULL = 등급마진.
- 수량 구간 할인(volume tier): 등급가 위에 구매 수량별 추가 %. **원가 이하로는 floor**(역마진 차단).
  - **최소 플랫폼 마진 floor (PRC-1)**: 수량할인 하한이 `min(등급가, 공급원가 × (1 + wholesale_min_platform_margin_pct))` 로 강화됨. 기본값 0이면 기존(공급원가 하한)과 동일하지만, 운영자가 이 값을 올리면 PG 수수료 등을 덮을 수 있어 **수량할인이 누적돼도 플랫폼 마진이 0으로 무너지지 않는다.** (`distributor-pricing.ts` `effectiveTierFloor`, `platform_settings.wholesale_min_platform_margin_pct`)

### 8-2. 정산 타이밍

| 제품 유형 | 성숙(지급 가능) 시점 | 출처 |
|---|---|---|
| **브랜드 제품** (`is_brand_product=1`) | **익일** (1일 환불 보호창) | `wholesale-settlement.ts` `BRAND_REFUND_WINDOW_DAYS=1` |
| **일반 제품** | **7일** 환불창 후 | `wholesale-settlement.ts` `REFUND_WINDOW_DAYS=7` |

### 8-3. 1일 정산 한도

| 항목 | 값 | 출처 |
|---|---|---|
| 플랫폼 1일 정산 한도 | **기본 1억원** (`platform_settings.supplier_daily_payout_cap` 으로 조정, 초과 시 차기 이월) | `supply-settlement.ts` `DEFAULT_DAILY_CAP=100,000,000` |

### 8-3-A. 정산 머니패스 강화 (돈이 새지 않게 — 코드 정밀)

> 정산은 "지급이 빠르다"만큼 **"잘못 지급되지 않는다"** 가 중요하다. 환불·동시지급·한도 경계에서 금액이 어긋나지 않도록 정산 파이프라인을 보강했다. (출처: 정산 관련 파일 — `supply-settlement.ts`, `wholesale-settlement.ts`)

- **환불 후 clawback(이미 지급된 정산 회수)**: 정산이 이미 지급된 뒤 해당 주문이 환불되면, **음수 원장으로 상계**해 다음 정산에서 차감한다. 차감할 잔고가 부족하면 **어드민에게 알림**을 보내 수동 회수를 유도 → 환불됐는데 대금이 그대로 나가는 누수 차단.
- **일일 지급한도 원자적 enforcement**: 1일 1억(기본) 한도를 **원자적으로** 검사·차감 → 동시 지급 요청이 겹쳐도 한도가 초과 지급되지 않는다(경계 레이스 차단).
- **정산 원자성(`DB.batch`)**: 잔고 변동·원장 기입·지급 기록을 **하나의 batch 트랜잭션**으로 묶어, 중간 실패로 "잔고는 줄었는데 지급 기록은 없는"(또는 그 반대) 부분 상태가 남지 않게 한다.

> **가치(카피용)**: 제조사에게는 "정산이 빠를 뿐 아니라 **정확**하다", 플랫폼에게는 "환불·동시성·한도 경계에서도 장부가 어긋나지 않는다" 는 신뢰 메시지. `[확인 필요]` — clawback 부족분의 운영 회수 절차(상계 vs 직접 청구)는 운영 정책으로 확정.

### 8-4. 원천징수 (개인 정산 대상자)

| 소득 유형 | 원천징수율 | 적용 | 출처 |
|---|---|---|---|
| **사업소득** (반복적 활동, default) | **3.3%** (소득세 3% + 지방세 0.3%) | 대부분 정산 대상 | `tax-withholding.ts` |
| **기타소득** (단발성) | **8.8%** (소득세 8% + 지방세 0.8%) | 일시적 협업 | `tax-withholding.ts` |

> ⚠️ 원천징수는 개인(비사업자) 정산에 적용. 사업자(세금계산서 발행) 거래는 원천징수 없이 세금계산서로 처리. 도매몰 제조사·유통사가 사업자인지/개인인지에 따라 분기 — 소개서에는 "사업자: 세금계산서 / 개인: 원천징수 3.3%" 로 표기 권장.

### 8-5. 세금계산서 / 거래명세서 (바로빌)
- **2종 문서**: 세금계산서(`tax_invoice`) + 거래명세서(`transaction_statement`). (`tax-documents.ts` `TAX_DOC_TYPES`)
- **방향**: **매출(sales)** = 유통스타트 → 유통사(`distributor_seller_id` 기준), **매입(purchase)** = 제조사 → 유통스타트(`supplier_id` 기준). (`tax-documents.ts`)
- 부가세 10% 분리: 공급가 = 총액 ÷ 1.1.
- **2단 발행 구조 (코드 정밀)**:
  - **(기본/폴백) 내부 발행** — 외부 의존 0으로 발행 기록(`draft→issued/void`) + **인쇄용 HTML**(브라우저 인쇄/PDF 저장) 생성. 단, 이 문서엔 *"정식 전자세금계산서는 별도 발행"* 명시. (`tax-documents.ts`)
  - **(활성 시) 바로빌 전자세금계산서 자동 발행** — `src/services/barobill.ts` 연동이 이미 구현. `isBarobillConfigured()`(= `BAROBILL_TEST_API_KEY`/`BAROBILL_PROD_API_KEY` 설정 여부)가 true면 `issueBarobillTaxInvoice()` 로 실제 전자세금계산서 발행. 미설정이면 위 내부 발행만. (`distributor-admin.routes.ts` 가 `isBarobillConfigured` 게이트 후 `issueBarobillTaxInvoice` 호출)
  - 운영서버/테스트서버는 `BAROBILL_ENV` 로 분기. **소개서 표기 권장**: "전자세금계산서 자동발행은 바로빌 키 설정 시 활성 — `[확인 필요]` 현재 운영 활성 여부".
- **플랫폼 사업자정보 관리**: 전자세금계산서 발행에는 발행자(유통스타트)의 사업자정보가 필요 → 관리자가 사업자등록번호·상호·대표·주소·업태/종목·이메일·전화를 `platform_settings` 에 저장·검증. 미설정이면 NTS 발행이 actionable 에러로 fail-soft. (`distributor-admin.routes.ts` GET/PUT `/company-info`)
- **월별 세금계산서 집계 (수동 발행 참고)**: 운영자가 `GET /tax-summary?month=YYYY-MM` 으로 유통사별 매출(매입합) + 제조사별 매입(정산합)을 한 번에 집계 → 수기/일괄 발행 기준표. (`distributor-admin.routes.ts` GET `/tax-summary`)
- **국세청(NTS) 전자세금계산서 발행**: 매출(유통스타트→유통사) 방향만 `POST /tax-documents/:id/issue-nts` 로 바로빌 통해 발행(발행자=유통스타트, 공급받는자=유통사, 30회/60초 rate limit). 매입(제조사→유통스타트)은 제조사가 발행 주체라 플랫폼 계정으로 발행 불가(역발행 별도 — 부록 A). (`distributor-admin.routes.ts` POST `/tax-documents/:id/issue-nts`, PATCH `/tax-documents/:id` 상태 issued/void)
- 출처: `tax-documents.ts`, `src/services/barobill.ts`, `distributor-admin.routes.ts`, `guide-seed-wholesale.ts` tax §.

> **[디자인 지시]** 정산 타임라인을 가로 타임라인으로: "결제 → (브랜드 익일 / 일반 7일) → 정산 지급". 1억/일 한도와 원천징수율은 작은 각주 표로.

---

## 9. 신뢰 / 안전 요소

> **[디자인 지시]** "안심하고 거래" 슬라이드. 방패/자물쇠 아이콘 + 5~6개 불릿.

- **온라인 최저가 검수** — 신규 상품 등록 시 최저가 링크 제출 → 운영 검수 후 승인. 가격 질서 보호. (`admin-products.routes.ts`)
- **가격변경 승인 워크플로** — 판매 중 가격은 제조사 임의 변경 불가. 요청 적재(`pending_*`) 후 운영 승인 시에만 라이브 반영. 승인 전까지 기존 가격 유지 → **결제가 안정**. (`supplier-dashboard.routes.ts`, `admin-products.routes.ts`)
- **oversell/오버부킹 자동 가드** — 주문 confirm 시 재고 원자 차감, 부족 시 롤백 + **자동 전액환불**(stays 패턴). (`wholesale.routes.ts`)
- **잠긴 Toss 결제 SSOT** — 모든 도매 결제는 검증된 `confirmTossPayment`/`cancelTossPayment` helper만 호출(직접 fetch 금지). 동시주문 CAS + 서버 금액 재계산(클라 값 불신뢰). (`CLAUDE.md` Toss 잠금)
- **신원·원가 양방향 마스킹** — 제조사 원가/신원 ↔ 유통사 명단 서로 비노출. 직거래 차단.
- **정산 머니패스 강화** — 환불 후 이미 지급된 정산 clawback(음수 원장 상계, 부족 시 어드민 알림), 1일 한도 원자적 enforcement, 정산 `DB.batch` 원자성 → 환불·동시성·한도 경계에서 장부가 어긋나지 않음. (§8-3-A)
- **클레임 시 정산 보류** — 유통사 클레임 접수(open) 즉시 해당 공급사 정산 보류(`held_at`) → 분쟁 동안 대금 누수 차단. (§9-E)
- **여신 한도 서버 강제** — 외상 발주는 `여신한도 − 미수금 ≥ 주문액` & 미동결일 때만 원자적으로 허용. 제조사는 외상이어도 즉시 정산(플랫폼이 채권 보유). (§9-D)
- **사업자/이메일 검증** — 카카오 same-email 자동연결은 `email_verified===1` 일 때만(계정 takeover 차단). (`guide-seed-wholesale.ts`)
- **rate limit** — `/orders`·`/orders/confirm` 30회/60초. (`wholesale-utongstart.md` 견고화)

---

---

## 9-A. 🔍 온라인 최저가 검수 + 공급가 변경 승인 워크플로 (신뢰 축 — 최근 구현, 정밀 상세)

> **이 절은 "가격 질서를 시스템이 지킨다"의 코드 정밀판.** 신규 상품 등록 시 **온라인 최저가 검수**, 판매 중 가격은 **운영 승인 없이는 못 바꾸는** 2단 게이트. (출처: `supply-visibility.ts`(스키마), `supplier-dashboard.routes.ts`(제조사 요청), `admin-products.routes.ts`(운영 승인))

### 9-A-1. 신규 상품 — 온라인 최저가 검수 (등록 시 1회)
- 제조사가 상품 등록 시 **온라인 최저가 참고 링크(`lowest_price_url`)** 제출. `http(s)` 만 허용, 500자 제한, 비정상 입력은 NULL 처리. (`supplier-dashboard.routes.ts` POST `/products`)
- 등록 직후 상태 = `supply_approval_status='pending'` + `is_active=0` → **유통사 카탈로그에 아직 안 보임**.
- 어드민이 `/admin` 상품 검수에서 최저가 링크로 시세 확인 → 승인 시 `action=approve` + **`lowest_price_checked` 체크(1)** → `supply_approval_status='approved'`, `is_active=1` 로 라이브 노출. 반려 시 `rejected` + `is_active=0`. (`admin-products.routes.ts` PATCH `/supplier-products/:id`)
- 즉 **검수 안 된 상품은 카탈로그에 못 올라온다** → 최저가 출혈/허위 시세 차단.

### 9-A-2. 판매 중 상품 — 공급가 변경 승인 (2단 게이트, 라이브가 불변)
- **승인된(판매 중) 상품의 가격은 제조사가 즉시 못 바꾼다.** 변경은 **요청만** 적재되고 라이브 `supply_price`/`price`는 **그대로 유지**. (`supplier-dashboard.routes.ts` POST `/products/:id/price-change-request`)
  - 요청 시 `pending_supply_price`, `pending_retail_price`, `pending_price_url`(근거 링크), `pending_price_reason`(사유), `pending_price_requested_at`(요청 시각)에 적재.
  - 응답 메시지: **"가격 수정 요청이 접수되었습니다. 운영진 승인 후 반영됩니다. (승인 전까지 기존 가격 유지)"**.
- 어드민 큐: `status=price_change` 필터 = `pending_supply_price IS NOT NULL` 인 상품만, **요청 시각순(`pending_price_requested_at DESC`)** 정렬. (`admin-products.routes.ts` 목록)
- 운영 승인 `action=approve` → `pending_*` 를 라이브 `supply_price`/`price` 로 반영 + **공급가 변경 이력 기록**(`supply_price_history`, `changed_by='admin:price-change'`) + `pending_*` 클리어. 거부 `action=reject` → `pending_*` 만 폐기, **라이브 가격 불변**. (`admin-products.routes.ts` PATCH `/supplier-products/:id/price-change`)
- 결과 알림: 제조사 대시보드에 `supply_price_change_approved` / `_rejected` 발송 + `writeAuditLog`(`supplier_price_change_approve/reject`). 감사 추적 보장.

### 9-A-3. 왜 이게 신뢰인가 (소개서 카피용 요지)
- **결제 안정** — 승인 전까지 노출가가 안 흔들려, 유통사가 본 가격이 결제 시점과 항상 일치.
- **시세 보호** — 신규는 최저가 검수, 변경은 운영 승인 → **누구도 임의로 가격을 흔들 수 없다.**
- **이력 보존** — 모든 공급가 변경은 `supply_price_history` 에 old→new 로 적재(관리자만 열람).

> **[디자인 지시: 그라데이션]** 9-A를 별도 슬라이드로 뽑을 경우 "**가격은 시스템이 지킵니다**" 헤드라인. **2단 게이트 플로우**(신규: 등록→최저가검수→승인노출 / 변경: 요청적재(가격불변)→운영승인→반영)를 좌우 2트랙으로. 단계 번호 배지는 **시그니처 그라데이션 원**, "운영 승인/검수" 게이트 노드만 **warm 그라데이션** + 자물쇠 글리프. "승인 전까지 기존 가격 유지" 문구는 뉴트럴 카드 위 굵게.

---

## 9-B. 📦 합배송 · 드랍쉽 · 송장(CSV 일괄) — 물류 흐름 정밀 상세

> **무재고 드랍쉽의 실제 송장/발송 코드.** 제조사가 소비자에게 직배송하되, 송장은 유통사·구매자 화면에 노출되고 제조사↔유통사 신원은 상호 비노출. (출처: `wholesale-supplier.routes.ts`, `supplier-dashboard.routes.ts` PUT `/orders/:orderId/shipping`)

| 기능 | 동작 | 출처 |
|---|---|---|
| **개별 송장 입력** | 라인별 택배사+운송장 입력 → `line_status='SHIPPED'`. 택배사 키 정규화(`normalizeCourierKey`) + `shipping_tracking_events` 기록(기존 셀러 배송 인프라 재사용) | `wholesale-supplier.routes.ts` POST `/items/:id/ship`, `supplier-dashboard.routes.ts` PUT `/orders/:orderId/shipping` |
| **합배송(ship-all)** | 한 주문 안의 **내(제조사) 미발송(PENDING) 라인 전체를 송장 1개로 일괄 발송** — 소유권+상태 가드를 한 문장으로 원자 처리 | `wholesale-supplier.routes.ts` POST `/orders/:id/ship-all` |
| **송장 CSV 일괄 업로드** | `item_id, courier, tracking_number` CSV(최대 5,000행) 업로드 → 내 라인만 일괄 `SHIPPED`. 중복 item_id 는 마지막 우선, 누락 행은 skip 사유 반환. SQLite 변수 999 한도 회피(IN 청크) | `wholesale-supplier.routes.ts` POST `/tracking/bulk` |
| **발송대기 주문 CSV export** | `item_id/주문/상품명/수량/공급가/정산금액/상태/받는분/연락처/주소/우편번호/결제일/courier/tracking_number` 양식 다운 → 외부 처리 후 재업로드 | `wholesale-supplier.routes.ts` GET `/orders/export` |
| **전 라인 발송 시 주문 SHIPPED** | 한 주문의 모든 라인 발송 완료 시 주문 상태 자동 SHIPPED 승격(한 문장, 청크) | `wholesale-supplier.routes.ts` |
| **드랍쉽 직배송** | 유통사는 무재고 — 제조사가 받는분(소비자) 주소로 직배송. 받는분/연락처/주소는 **본인(제조사) 라인만** 노출 | `supplier-dashboard.routes.ts` GET `/orders` |

> **[디자인 지시: 그라데이션]** 별도 슬라이드 시 "**송장 한 번에, 발송도 한 번에**" 헤드라인. 개별/합배송/CSV 3개 카드는 **subtle 라이트 그라데이션** + 아이콘 원(시그니처). "합배송 = 송장 1개" 핵심 스탯은 시그니처 그라데이션 텍스트.

---

## 9-C. 🎯 공급 범위(supply_visibility) 3종 + 유통채널 선정 — 거래처 보호 정밀 상세

> 제조사가 **누구에게 공급할지** 통제하는 3단 모드. 가격 질서·거래선 보호의 핵심. (출처: `supply-visibility.ts` `SUPPLY_VISIBILITY_VALUES`, `normalizeVisibility`)

| 모드 | 의미 | 노출 대상 |
|---|---|---|
| **ALL** (기본) | 전체공급 | 모든 선별 유통사 |
| **APPROVED_CHANNEL** | 승인한 유통채널 공급 | 허용목록(`product_distributor_access`)에 등록된 유통사만 |
| **UTONGSTART_ONLY** | 유통스타트 유통채널 공급 | **관리자가 선정한** 유통사만 (허용목록 동일 사용) |

- **selfServe 강등 가드**: 제조사 self-serve 입력에서는 `UTONGSTART_ONLY`(= 관리자 선정 전용)를 직접 설정 못 함 → 자동으로 `APPROVED_CHANNEL`(본인 승인 채널)로 강등. 관리자(distributor-admin) 경로만 3종 모두 허용. (`normalizeVisibility(v, selfServe)`)
- **가시성 SQL**: `supply_visibility='ALL'` 이거나 `product_distributor_access` 에 (상품, 유통사) row 존재 시에만 카탈로그 노출(`visibilityWhere`). → 거래처 비공개 공급이 서버 레벨에서 보장.
- **제조사 self-serve 채널 관리**: `APPROVED_CHANNEL` 상품에 한해 제조사가 대시보드에서 **직접 유통사를 허용목록에 추가/조회/해제**(자기 상품의 access 행만). `UTONGSTART_ONLY` 는 관리자 선정 전용이라 제조사가 직접 못 만짐 → 시도 시 409. (`supplier-dashboard.routes.ts` GET/POST/DELETE `/products/:id/channel-access`)
- **관리자 채널 관리**: 운영자는 3종 모드 전부 + 허용목록 직접 편집 가능(상품별 visibility 변경, 유통사 access 추가/삭제). (`distributor-admin.routes.ts` PATCH `/products/:id/visibility`, `/product-access`)

> ⚠️ MOQ(`min_order_qty`)는 상품별 1~100,000(기본 1, 박스 단위). CSV/개별 등록 모두 클램프, 주문 시 서버가 `qty >= MOQ` 검증. 카탈로그 카드/상세/카트에 박스·개당 단가 병기. (`supply-visibility.ts`, `supplier-dashboard.routes.ts`, `supply.routes.ts`)

---

## 9-D. 💳 여신 / 외상 결제 (BIZ-2) — "사입 0원"의 마지막 퍼즐 (신규, v1)

> **이전까지 도매 주문은 100% Toss 선결제만 가능했다.** 유통사가 "사입 0원·무재고"라 해도 **주문 시점의 현금**은 필요했던 모순이 있었는데, 여신/외상 결제로 이 마지막 현금 장벽까지 제거했다. (출처: `wholesale.routes.ts` `/orders` `payment_method`, `distributor-admin.routes.ts` `/distributors/:id/credit`·`/credit-repayment`)

### 9-D-1. 동작 (코드 정밀)

- 주문 생성 시 `payment_method:'credit'` 를 선택하면 **Toss 결제를 건너뛰고** 상태 `ON_CREDIT` 의 외상 주문이 생성된다. (기존 선결제는 그대로 — `payment_method` 미지정/`toss` 면 종전과 동일하게 Toss 선결제.)
- **여신 게이트(서버 강제)**: `유통사 여신한도(distributor_credit_limit) − 미수금(outstanding_balance) ≥ 주문 소계(subtotal)` 이고 `credit_frozen=0`(동결 아님) 일 때만 외상 발주를 허용. 한도 초과·동결이면 거부.
- **원자적 미수금 청구**: 외상 발주 확정 시 `outstanding_balance` 가산 + `wholesale_credit_ledger`(여신 원장) 기입을 원자적으로 처리 → 한도 초과 이중 발주를 차단.
- **공급사는 즉시 정산**: 유통사가 외상이어도 **제조사 정산은 선결제와 동일하게 즉시 발생**한다. 즉 **플랫폼이 채권(받을 미수금)을 떠안는** 구조 — 제조사는 외상 리스크를 지지 않는다.
- **어드민 운영**: 운영자가 유통사별 여신한도 설정, 동결/해제, 상환(repayment) 기록을 관리한다(`/credit`, `/credit-repayment`). 상환 시 `outstanding_balance` 차감 + 원장 기입.

### 9-D-2. 가치 (카피용 요지)

- **유통사**: 매출이 들어오기 전에도 발주 가능 → **운전자금 0원**으로 회전. "사입 0원·재고 0원·현금 0원" 완성.
- **제조사**: 유통사가 외상이든 선결제든 **정산은 즉시** — 외상 떼임 걱정 없음(플랫폼이 채권 보유).
- **플랫폼**: 신뢰 유통사에 여신을 열어 거래량을 키우되, 한도·동결·상환을 시스템이 강제.

> **[확인 필요]** (1) 여신 공급사 정산 시점 — 현재 코드는 외상이어도 공급사 즉시 정산이나, **운영 정책상 외상 주문의 공급사 정산을 상환 후로 미룰지 여부는 결정 대기**. (2) ON_CREDIT 주문의 환불 역전(반품 시 미수금/원장 되돌림)은 **v2** 예정 — 현재 v1 은 미구현. (3) 월 자동청구·연체 시 자동 동결(overdue-freeze) cron 도 **향후**. (4) ON_CREDIT 거래의 세금계산서·세무 집계 포함 방식 `[확인 필요]`.
> ⚠️ **운영 반영 전 staging 실결제/외상 E2E 1회 검증 권장** (v1).

> **[디자인 지시: 그라데이션]** 별도 슬라이드 시 "**현금 없이도 발주하세요**" 헤드라인. "선결제 vs 여신" 2트랙 — 여신 트랙 노드(여신한도→발주→미수금→상환)는 **시그니처 그라데이션 원**, "공급사 즉시 정산" 배지만 **warm 그라데이션**(플랫폼이 채권 보유 = 안심). "운전자금 0원" 스탯 숫자는 시그니처 그라데이션 텍스트.

---

## 9-E. 🛟 유통사 클레임 / RMA (BIZ-1) — 바이어 구매 보호 (신규, v1)

> 도매 거래는 받아본 뒤 불량·오배송이 드러나는 경우가 잦다. **유통사(바이어)가 정식으로 클레임을 접수**하고, **접수 즉시 해당 공급사 정산이 보류**되어 분쟁 동안 돈이 새지 않도록 보호한다. (출처: `wholesale-claims.routes.ts`, 어드민 `/api/wholesale/admin/claims`)

### 9-E-1. 흐름 (상태 머신)

- 유통사가 `POST /api/wholesale/claims` 로 클레임 제기 — **사유 코드**: 불량(`defective`)·오배송(`wrong_item`)·파손(`damaged`)·수량부족(`shortage`)·기타(`other`) + **증빙(evidence)** 첨부.
- 운영 검토 흐름: `open → reviewing → approved / rejected / resolved`. (`PATCH /api/wholesale/admin/claims/:id`)
- **정산 보류(핵심 안전장치)**: 클레임이 `open` 되면 해당 **공급사 정산이 보류**된다(`held_at` 기록, 정산 성숙 로직이 보류 건을 스킵). 분쟁이 `resolved`/`rejected` 로 닫힐 때까지 그 라인 대금은 지급되지 않는다.
- **승인 시 환불**: `approved` 면 **기존 어드민 도매 환불 경로**로 처리(Toss 부분취소 + 정산 역전 + 재고복원 — §5/§9-B 반품 인프라 재사용).

### 9-E-2. 가치

- **유통사(바이어)**: 불량/오배송을 증빙과 함께 정식 채널로 접수 → 추적·해결. 접수 즉시 대금이 묶여 **떼일 위험 없이** 보호받는다.
- **제조사**: 정상 거래는 그대로 정산, 분쟁 라인만 한시 보류 → 분쟁 결과에 따라 공정 처리(타 라인 무영향).
- **플랫폼**: 클레임을 시스템화해 CS·환불·정산 보류를 한 흐름으로 일원화.

> UI: 유통사 '클레임 제기' 화면 + 어드민 '도매 클레임' 검토 페이지. v1 — 단일 클레임 단위 처리.

> **[디자인 지시: 그라데이션]** "**받아보고 문제가 있으면, 시스템이 잡아 둡니다**" 헤드라인. 사유 코드 5종(불량/오배송/파손/수량부족/기타) 칩은 subtle 라이트 카드, "정산 보류(held)" 게이트 노드만 **warm 그라데이션** + 자물쇠. open→reviewing→resolved 진행선은 시그니처 그라데이션 stroke.

---

## 9-F. 📝 견적 / 발주 Quote·PO (BIZ-3) — 카탈로그 단가를 넘어선 협의 (신규, v1)

> 대량·특수 거래는 고정 카탈로그 단가가 아니라 **협의 단가**가 필요하다. 유통사가 견적을 요청하고 운영자가 회신하는 정식 견적/발주 흐름을 제공한다. (출처: `wholesale-quotes.routes.ts`)

### 9-F-1. 흐름 (상태 머신)

- 유통사 `POST /api/wholesale/quotes`(견적 요청) → 운영자 `PATCH /quotes/:id/respond`(**단가 / MOQ / 유효기간** 회신) → 유통사 `POST /quotes/:id/accept` 또는 `/reject`.
- 상태: `requested → quoted → accepted / rejected / expired / converted`. (유효기간 경과 시 `expired`.)
- v1 은 **단일 라인 견적**. 견적 수락 시 주문으로의 **자동 전환(`converted`)은 향후** — 현재는 상태값만 예약.

### 9-F-2. 가치

- **유통사**: 카탈로그 단가가 안 맞는 대량/특수 건도 **공식 견적 협의**로 진행. 유효기간·MOQ가 문서로 남아 분쟁 방지.
- **제조사/운영**: 영업 협의를 시스템 안으로 — 구두 견적의 누락·번복을 막고 상태로 추적.

> UI: 유통사 견적 페이지(`/wholesale/quotes`) + 어드민 견적 페이지.

> **[디자인 지시: 그라데이션]** "**단가가 안 맞으면, 견적부터**" 헤드라인. 요청→회신(단가/MOQ/유효기간)→수락 3단 타임라인, "회신" 노드만 **warm 그라데이션**. 상태 배지(requested/quoted/accepted)는 시그니처 그라데이션 원.

---

## 9-G. 🔎 카탈로그 검색 · 필터 · 정렬 고도화 (BIZ-4) — 빠른 소싱 (신규)

> 상품 수가 늘수록 "원하는 걸 빨리 찾는" 소싱 경험이 중요하다. FTS 검색·정렬·필터를 더해 카탈로그 탐색을 고도화했다. (출처: `wholesale.routes.ts` GET `/catalog`)

### 9-G-1. 동작 (코드 정밀)

- **검색**: 상품명/설명 대상 **FTS5 전문검색**, FTS 불가 환경은 **LIKE 폴백** → 검색어 입력은 디바운스 처리(불필요 호출 억제).
- **정렬(화이트리스트)**: 인기 / 가격↓ / 가격↑ / 할인율 / 신상 — 허용된 정렬키만 서버가 수용(임의 ORDER BY 주입 차단).
- **필터**: 카테고리 / 가격대 / 재고있음.
- **기본 동작 불변(중요)**: **파라미터 없는 기본 카탈로그 요청은 기존과 동일** → SSR/캐시 0-RTT 경로·기본 노출 순서가 회귀하지 않는다(파라미터가 붙은 요청만 라이브 검색 경로).

### 9-G-2. 가치

- **유통사**: 수천 SKU 중에서도 키워드·가격대·정렬로 **원하는 상품을 즉시** 찾아 소싱 속도를 높인다.
- **플랫폼**: 카탈로그 확장성 확보 — 상품이 늘어도 탐색 경험이 무너지지 않음.

> **[디자인 지시]** 검색바 + 정렬 토글(인기/가격/할인율/신상) + 필터 칩(카테고리/가격대/재고)을 카탈로그 상단 sticky 바로. 강조는 시그니처 포인트만, 결과 그리드는 뉴트럴.

---

## 10. 차별점 (경쟁사 대비)

> ⚠️ 경쟁사(도매꾹/오너클랜/도매토피아 등)의 구체 정책은 본 코드베이스에 없음 → **아래 경쟁사 측 항목은 전부 `[가정]`**. 유통스타트 측은 코드 근거.

| 비교 축 | 일반 오픈 도매몰 `[가정]` | 유통스타트 (근거 있음) |
|---|---|---|
| 참여 | 누구나 입점 | **선별(vetted) 제조사·유통사만** |
| 직거래 | 거래처 노출·이탈 흔함 `[가정]` | **직거래 금지 + 신원 비노출**(서버 차단) |
| 가격 질서 | 최저가 출혈 경쟁 `[가정]` | **최저가 검수 + 가격변경 운영 승인** |
| 사입 | 선사입 필요 `[가정]` | **무재고 드랍쉽(사입 0원)** |
| 결제 | 선결제 현금 필요 `[가정]` | **선결제 또는 여신/외상(`ON_CREDIT`) — 운전자금 0원 발주** |
| 가격 | 단일 도매가 `[가정]` | **등급별 차등 공급가 + 수량 할인 + 상품별 override + 최소 마진 floor** |
| 정산 | 수동·지연 `[가정]` | **브랜드 익일/일반 7일 자동 성숙 + 환불 자동 역전 + clawback·한도·원자성 보강** |
| C/S·분쟁 | 개별 협의 `[가정]` | **클레임/RMA 정식 접수 + 분쟁 중 정산 보류** |
| 협의 거래 | 구두 견적 `[가정]` | **견적/발주(Quote·PO) 상태 추적** |
| 세금 | 수기 `[가정]` | **거래명세서/세금계산서/바로빌 전자발행** |

> **[디자인 지시]** 좌(일반 도매몰)–우(유통스타트) 비교표 또는 체크리스트(✗/✓). 경쟁사 칸은 회색, 유통스타트 칸은 브랜드 컬러.

---

## 11. 온보딩 & 지원

| 동선 | 경로 | 비고 |
|---|---|---|
| 공개 소개 랜딩 | `/wholesale/intro` | SEO 인덱싱 + Service JSON-LD, 제조사/유통사 듀얼 CTA |
| 유통사 가입 | `/wholesale/join` | 셀러 온보딩 funnel, 가입 즉시 C등급 |
| 제조사 가입 | `/supplier/register` | 어드민 승인 필요 |
| 도매 카탈로그 | `/wholesale` | 미로그인 시 `/wholesale/intro` 로 유도 |
| 제조사 대시보드 | `/supplier` | 상품·송장·정산·발송 |
| 제조사 도매주문 | `/supplier/wholesale-orders` | 도매 주문 접수·발송(개별/합배송/CSV) |
| OEM/ODM 신청 | `/wholesale/oem` | 유통사 제조 위탁 신청 → 어드민 매칭 |
| 거래명세서/세금계산서 | `/wholesale/statement`, `/wholesale/documents` | 유통사 문서 조회·인쇄 |
| 등급 관리(어드민) | `/admin/distributor-grades` | 등급별 마진율 조정·유통사 등급 배정·특별할인 기간 |
| 제조회원 관리(어드민) | `/admin/suppliers` | 가입 승인/정지/거부, available 정산 지급(`/payout`), 지급 이력(`/payouts`) |
| 도매주문 관리(어드민) | `/admin/wholesale-orders` | 전체 도매 주문 조회·상세·운영 환불(`/orders/:id/refund`) |
| 전용 운영 가이드 | `/admin/wholesale-guide` | 운영 SSOT |
| **도메인** | **utongstart.com** | 같은 코드/DB, 루트 진입 시 `/wholesale/intro` 로 302 |

- **CSV 대량등록**: 제조사 대량 상품등록/주문 export/송장 일괄, 유통사 카탈로그·주문 양식(`/order-template`), 어드민 상품정보 엑셀(A/B/C 등급가 — `distributor-admin.routes.ts` GET `.xlsx`).
- **OEM/ODM 신청·매칭**: 유통사 `/wholesale/oem` 신청 → 어드민 OEM 관리에서 제조사 매칭(§6-A).
- **상품 제안(추천) 운영**: 운영자가 특정 유통사 계정에 상품을 직접 추천해 그 유통사 홈/목록에 노출(`wholesale_proposals`, 철회 가능) → 소싱 큐레이션·영업 보조. (`distributor-admin.routes.ts` `/proposals`)
- **상품별 등급마진 override · 수량구간(qty-tiers) 관리(어드민)**: 운영자가 상품별로 등급마진 override 설정/해제, 수량 구간 할인표 조회·일괄 설정. (`distributor-admin.routes.ts` PATCH `/products/:id/margin-override`, GET/PUT `/products/:id/qty-tiers`)
- **데모 상품 시드(운영 tooling)**: 데모/테스트 카탈로그 일괄 생성·삭제(슬러그 프리픽스 기준, rate limit). (`distributor-admin.routes.ts` POST/DELETE `/seed-demo-products`)
- **공급가 변경 이력 조회(어드민)**: 모든 공급가 변경 old→new 이력 열람(`supply_price_history`). (`distributor-admin.routes.ts` GET `/price-history`)

> **🛠 운영 인계 — 전용 운영 가이드**: 도매몰(B2B) 전 영역 운영 SSOT 가이드가 **`/admin/wholesale-guide`** 에 존재(라우트 `admin.routes.tsx`, 시드 `guide-seed-wholesale.ts`). 가입 승인·등급 배정·최저가 검수·가격변경 승인·정산·세금계산서·OEM 매칭 등 운영 절차가 여기에 정리됨. 소개서 배포 시 운영팀은 이 가이드를 함께 인계받는다.

---

## 12. 섹션별 슬라이드 카피 초안 (실제 카피)

> 각 슬라이드: **헤드라인 / 부제 / 불릿**. 디자인 AI가 그대로 배치 가능.

### S1. 표지
- **헤드라인**: "제조사와 유통사를 잇다 — 유통스타트"
- **부제**: 선별된 제조사 × 선별된 유통사, 무재고 B2B 도매 중개 플랫폼
- **불릿**: utongstart.com
- **[디자인 지시: 그라데이션]** 풀폭 배경 = **deep 그라데이션** `linear-gradient(160deg, #C9184A 0%, #FF0033 60%, #FF4D6D 100%)` 위에 **mesh** 텍스처 옅게 오버레이. 헤드라인은 **흰색**(딥 면 위). 로고/`utongstart.com` 칩은 흰 글자 + 반투명 라운드 박스. 표지는 이 덱에서 가장 진한 그라데이션 면.

### S2. 문제
- **헤드라인**: "도매 유통, 왜 이렇게 어렵죠?"
- **부제**: 제조사도 유통사도 각자의 벽에 막혀 있습니다
- **불릿**: 제조사 — 판로·재고·미수금·가격붕괴 / 유통사 — 사입자금·재고리스크·최저가 출혈
- **[디자인 지시: 그라데이션]** 배경은 차분한 **neutral depth** `linear-gradient(180deg, #FFFFFF 0%, #F4F5F7 100%)`(문제 = 어두운 톤). 페인 아이콘은 회색조로 두되, 상단 라벨 "Before(기존 도매 유통)" 칩만 **시그니처 그라데이션 띠**로 강조. 다음 S3 솔루션과의 명도 대비를 위해 의도적으로 채도 낮게.

### S3. 솔루션(3자 구조)
- **헤드라인**: "가운데서 다 해결합니다"
- **부제**: 제조사 ↔ 유통스타트 ↔ 유통사. 서로 만나지 않고, 모든 거래는 플랫폼 경유
- **불릿**: 직거래 금지(신원 비노출) · 등급가 중개 · 정산/세금 일괄
- **[디자인 지시: 그라데이션]** S2(문제)→S3(솔루션) **전환 시그니처 띠** = 상단 풀폭 `linear-gradient(135deg, #FF0033 0%, #FF3D6E 100%)` 밴드(흰 헤드라인). 가운데 **"유통스타트" 허브 노드는 deep 그라데이션 원/라운드 박스**(흰 글자), 좌(제조사)·우(유통사)·우상단(소비자) 노드는 subtle 라이트 카드. **연결 화살표(①~⑧)는 시그니처 그라데이션 stroke**. 제조사↔유통사 직거래 금지 점선은 회색 + 자물쇠.

### S4. 제조사 혜택
- **헤드라인**: "만들기만 하세요"
- **부제**: 판로·영업·물류·정산은 유통스타트가
- **불릿**: 무재고 드랍쉽 / 검증된 유통망 / 빠른 정산(브랜드 익일) / 원가·거래처 비노출 / 최저가 검수로 가격 질서 보호
- **[디자인 지시: 그라데이션]** 4대 혜택 카드는 **subtle 라이트 그라데이션** `linear-gradient(180deg, #FFFFFF 0%, #FFF1F3 100%)` + border `#FFE4E9`(본문 텍스트 `#374151`). 각 카드 **아이콘은 시그니처 그라데이션 원형 배경 위 흰 글리프**. "만들기만 하세요" 헤드라인의 키워드 1개에 **warm 그라데이션**(레드→오렌지, 판로 확대 = 성장) 텍스트 하이라이트. 제조사 트랙 표식(상단 칩)은 warm 톤.

### S5. 유통사 혜택
- **헤드라인**: "사입 0원, 재고 0개로 시작"
- **부제**: 등급 공급가로 검증된 상품만 골라 파세요
- **불릿**: 무재고 / 등급별 마진(A 10%부터) / 수량 할인 / **여신·외상 발주(운전자금 0원)** / **클레임·RMA 구매 보호** / **견적·발주 협의** / **카탈로그 검색·필터** / 합배송·송장 일괄 / 자동 정산·세금계산서 / OEM·ODM 제조 위탁 매칭
- **[디자인 지시: 그라데이션]** 혜택 카드는 S4와 동일 **subtle 라이트 그라데이션** 카드 + **시그니처 그라데이션 아이콘 원**. "**사입 0원**" "**재고 0개**" "**현금 0원**(여신)" 핵심 스탯 숫자는 **시그니처 그라데이션 텍스트**(굵은 탭형 숫자)로 시선 집중. 수익/마진·여신 카드 아이콘은 **warm 그라데이션**(기회·수익). 유통사 트랙 표식 칩은 레드 포인트.

### S6. 작동 방식
- **헤드라인**: "가입부터 정산까지, 한 흐름"
- **부제**: 제조사·유통사 각자 6~8단계로 끝
- **불릿**: 가입 → 승인 → 등록/검수 → 노출 → 선결제 → 드랍쉽 배송 → 자동 정산
- **[디자인 지시: 그라데이션]** 듀얼 타임라인의 **단계 번호 배지(①②③…)는 시그니처 그라데이션 원**(흰 숫자). 두 트랙(제조사/유통사)을 잇는 **진행선은 시그니처 그라데이션 stroke**(왼쪽 옅음→오른쪽 진함으로 진행감). 단계 설명 박스는 subtle 라이트 카드(본문 가독). 마지막 "자동 정산" 단계 배지만 **warm 그라데이션**으로 골인 강조.

### S7. 가격·수수료·정산
- **헤드라인**: "투명한 등급가, 빠른 정산"
- **부제**: 마진은 등급으로, 정산은 자동으로
- **불릿**: 등급 A 10%~D 25%(예시 기본값) / 브랜드 익일·일반 7일 정산 / 1일 한도 1억 / 사업자 세금계산서·개인 원천징수 3.3%
- **[디자인 지시: 그라데이션]** 등급 마진표(§6-1)의 **헤더행은 시그니처 그라데이션** `linear-gradient(135deg, #FF0033 0%, #FF3D6E 100%)`(흰 글자), 데이터 행은 **흰/뉴트럴 배경**(`#FFFFFF`/`#F4F5F7`)에 검정 숫자 — 마진율·정산일 같은 정확한 데이터는 그라데이션 면 위에 직접 올리지 않는다(접근성 16-5-3). **정산 타임라인 진행선(결제→익일/7일→지급)은 시그니처 그라데이션 stroke**, 각 마일스톤 점(노드)은 시그니처 그라데이션 원. "익일" 마일스톤은 **warm 그라데이션**으로 빠름 강조. 1억/일 한도·원천징수 3.3%는 작은 뉴트럴 각주 카드.

### S8. 신뢰·안전
- **헤드라인**: "안심하고 거래하세요"
- **부제**: 가격 질서와 결제 안전을 시스템이 지킵니다
- **불릿**: 최저가 검수 / 가격변경 운영 승인 / oversell 자동 가드 / Toss 안전결제 / 신원 양방향 마스킹 / 정산 머니패스 강화(clawback·한도·원자성) / 클레임 시 정산 보류
- **[디자인 지시: 그라데이션]** 풀폭 배경 = **deep 그라데이션** `linear-gradient(160deg, #C9184A 0%, #FF0033 60%, #FF4D6D 100%)` + **mesh** 옅게(신뢰 = 묵직한 강조 면). 헤드라인·불릿은 **흰 텍스트**. 각 안전 항목 앞 **방패/자물쇠 아이콘은 흰 글리프 또는 시그니처 그라데이션 원**. 불릿 텍스트는 가독을 위해 **반투명 스크림**(`rgba(0,0,0,.35)`) 또는 옅은 딥 카드 위에. 표지(S1) 다음으로 진한 그라데이션 면 — 양 끝(표지/신뢰)을 딥으로 묶어 무게중심을 준다.

### S9. 차별점
- **헤드라인**: "오픈 도매몰과 다릅니다"
- **부제**: 아무나가 아니라, 선별된 파트너만
- **불릿**: 직거래 금지 / 가격 질서 보호 / 무재고 / 등급 차등가 / 자동 정산·세금
- **[디자인 지시: 그라데이션]** 좌(일반 도매몰)–우(유통스타트) 비교표에서 **유통스타트 컬럼 헤더는 시그니처 그라데이션**(흰 글자) + ✓ 셀에 시그니처 그라데이션 포인트, **경쟁사 컬럼은 회색 솔리드**(`#F4F5F7`)로 대비. 표 본문 셀은 흰/뉴트럴(숫자·텍스트 가독). 상단 섹션 라벨 칩만 **시그니처 그라데이션 띠**.

### S10. 온보딩 & CTA
- **헤드라인**: "지금 시작하세요"
- **부제**: utongstart.com 에서 5분이면 가입
- **불릿**: 제조사 → /supplier/register / 유통사 → /wholesale/join
- **[디자인 지시: 그라데이션]** 풀폭 배경 = **deep 그라데이션 + mesh**(표지와 수미상관, 흰 텍스트). **듀얼 CTA 버튼 2개 모두 시그니처 그라데이션** `linear-gradient(135deg, #FF0033 0%, #FF3D6E 100%)`(흰 글자, hover 시 약간 진하게) — 단, 두 버튼을 명도로 구분: 제조사 버튼은 **warm 그라데이션**(판로·성장), 유통사 버튼은 **시그니처**(레드). `utongstart.com` 칩은 흰 글자 반투명 박스.

> **[디자인 지시]** 각 슬라이드 1개 = 1 메시지. 불릿은 슬라이드당 3~5개 이하로 압축.

---

## 13. 추천 비주얼 & 다이어그램 리스트 (디자인 AI 지시)

1. **[디자인 지시] 3자 구조도** (§4) — 소개서 시그니처. 유통스타트 허브 + 좌/우/상단 + 직거래 금지 점선·자물쇠.
   - **[그라데이션]** 허브("유통스타트") 노드 = **deep 그라데이션 원/라운드 박스**(흰 글자). 좌(제조사)·우(유통사)·우상단(소비자) 노드 = **subtle 라이트 카드**(`linear-gradient(180deg,#FFFFFF,#FFF1F3)`). 흐름 화살표 ①~⑧ = **시그니처 그라데이션 stroke**(방향감 위해 시작 옅음→끝 진함). 직거래 금지 점선만 회색 + 자물쇠.
2. **[디자인 지시] 정산 타임라인** — 가로축: 결제 → (브랜드 익일 / 일반 7일) → 지급. 1억/일 한도 각주.
   - **[그라데이션]** 진행선 = **시그니처 그라데이션 stroke**, 마일스톤 노드 = 시그니처 그라데이션 원, "익일"만 **warm 그라데이션**. 한도·원천징수 각주는 뉴트럴.
3. **[디자인 지시] 등급 마진표/그래프** (§6-1) — A 10%~D 25% 막대 또는 표. "고등급=저렴" 화살표.
   - **[그라데이션]** 표 **헤더행 = 시그니처 그라데이션**(흰 글자). 막대그래프 막대는 **warm→시그니처 그라데이션 fill**(고등급일수록 진하게). 마진율 숫자는 흰/뉴트럴 위.
4. **[디자인 지시] Before/After** (§3↔§4) — 페인(어둡게) → 해소(밝게) 대비.
   - **[그라데이션]** Before = neutral depth(`#FFFFFF→#F4F5F7`) 회색조. After 헤드라인 띠 = **시그니처 그라데이션 밴드**(흰 글자)로 전환 강조.
5. **[디자인 지시] 가격변경 승인 플로우** — 제조사 요청 → pending 적재(가격 불변) → 운영 승인 → 라이브 반영. 자물쇠 강조.
   - **[그라데이션]** 단계 번호 배지 = **시그니처 그라데이션 원**, "운영 승인" 게이트 노드만 **warm 그라데이션**. 연결선은 시그니처 그라데이션 stroke.
6. **[디자인 지시] 작동방식 듀얼 타임라인** (§7) — 제조사/유통사 2트랙.
   - **[그라데이션]** 양 트랙 단계 번호 배지 = **시그니처 그라데이션 원**, 진행선 = 옅음→진함 시그니처 그라데이션, 마지막 "자동 정산" 배지 = **warm 그라데이션**(골인).
7. **[디자인 지시] 화면 스크린샷 자리** — `/wholesale`(카탈로그), `/supplier`(대시보드), `/admin/distributor-grades`(등급 관리) 캡처 placeholder. *실제 캡처는 운영팀 제공 — `[확인 필요]`*.
   - **[그라데이션]** 스크린샷 프레임은 **neutral depth 그라데이션** 카드 테두리(`#FFFFFF→#F4F5F7`)로 감싸고, 캡션 라벨 칩만 시그니처 그라데이션.
8. **[디자인 지시] 마진 계산 예시 카드** (§6-2) — 원가 1만원 → 등급별 공급가 비교.
   - **[그라데이션]** 카드 = **subtle 라이트 그라데이션**, 결과 공급가 숫자(11,000/12,000원)는 **시그니처 그라데이션 텍스트**로 강조, 본문은 흰 카드 위.
9. **[디자인 지시] 2단 가격 게이트 다이어그램** (§9-A) — 신규(등록→최저가검수→노출) / 변경(요청적재·가격불변→운영승인→반영) 2트랙. "승인 전까지 기존 가격 유지" 강조.
   - **[그라데이션]** 단계 배지 = 시그니처 그라데이션 원, 검수/승인 게이트 노드만 **warm 그라데이션** + 자물쇠. 진행선 = 옅음→진함.
10. **[디자인 지시] 물류 흐름(합배송/드랍쉽/송장 CSV)** (§9-B) — 개별/합배송/CSV 3카드 + 제조사→소비자 직배송 화살표.
   - **[그라데이션]** 3카드 = subtle 라이트, 아이콘 원(시그니처), "합배송=송장 1개" 스탯은 시그니처 그라데이션 텍스트.
11. **[디자인 지시] OEM/ODM 매칭 타임라인** (§6-A) — 신청→매칭→생산. "매칭" 노드만 warm 그라데이션, OEM 8% 배지 시그니처.
12. **[디자인 지시] 공급 범위 3종 모드** (§9-C) — ALL/APPROVED_CHANNEL/UTONGSTART_ONLY 노출 범위 비교. 자물쇠로 배타 공급 표현.

---

## 14. FAQ

### 14-1. 제조사 FAQ
1. **Q. 내 원가나 거래처가 유통사에 노출되나요?**
   A. 아니요. 유통사에는 **등급 공급가만** 노출되고 원가·신원은 서버에서 차단됩니다. 제조사도 유통사 명단을 볼 수 없습니다.
2. **Q. 재고를 미리 밀어넣어야 하나요?**
   A. 아니요. **무재고 드랍쉽** — 팔리면 제조사가 소비자에게 직배송합니다.
3. **Q. 정산은 얼마나 빨리 받나요?**
   A. **브랜드 제품은 익일**(1일 보호창), **일반 제품은 7일** 환불창 후 자동 성숙·지급됩니다.
4. **Q. 가격을 바꾸고 싶으면?**
   A. 판매 중 상품은 **변경 요청**만 보내고 운영 승인 시 반영됩니다(가격 질서·결제 안정 보호). 신규 등록 시 온라인 최저가 링크를 제출하면 검수합니다.
5. **Q. 특정 유통사에게만 공급하고 싶어요.**
   A. 공급 범위를 **승인한 유통채널(APPROVED_CHANNEL)** 로 설정하면 선정된 유통사만 노출됩니다.
6. **Q. 세금계산서는 누구에게 발행하나요?**
   A. **유통스타트 앞**으로 발행합니다(매입 방향). 유통사 대상 발행은 유통스타트가 합니다. 전자세금계산서는 바로빌 키 설정 시 자동 발행, 미설정 시 내부 발행(인쇄용)으로 갈음됩니다.
7. **Q. 가격을 올렸는데 왜 바로 안 바뀌나요?**
   A. 판매 중 상품 가격은 **운영 승인 전까지 기존 가격이 유지**됩니다(가격 질서·결제 안정 보호). 요청은 접수되어 운영진 검토 후 반영되며, 모든 변경은 이력으로 남습니다.
8. **Q. 특정 유통사에게만 배타 공급할 수 있나요?**
   A. **승인한 유통채널(APPROVED_CHANNEL)** 로 설정하면 허용목록의 유통사만, 관리자 선정 전용 **유통스타트 채널(UTONGSTART_ONLY)** 모드도 있습니다(관리자 경로 전용).

### 14-2. 유통사 FAQ
1. **Q. 사입 자금이 필요한가요?**
   A. 아니요. **사입 0원·무재고** — 주문이 들어오면 제조사가 직배송합니다. 결제는 도매 공급가 **선결제(Toss)** 또는 **여신/외상(`ON_CREDIT`)** 중 선택할 수 있어, 여신을 쓰면 **주문 시점 현금도 0원**으로 발주할 수 있습니다(아래 Q9).
2. **Q. 내 등급은 어떻게 정해지나요?**
   A. 가입 시 **자동 C등급**(마진 20%, 예시 기본값). 운영자가 A(10%)·B(15%)로 상향할 수 있습니다.
3. **Q. 같은 상품을 모두가 같은 가격에 떼나요?**
   A. 등급별로 다릅니다. 다만 전략·특가 상품은 **상품별 마진 override** 로 모두 동일가가 적용될 수 있습니다.
4. **Q. 많이 사면 더 싸지나요?**
   A. 네. **수량 구간 할인**(예: 100개↑ 5%, 500개↑ 10%). 단 공급원가 이하로는 내려가지 않습니다.
5. **Q. 세금계산서·거래명세서는요?**
   A. **유통스타트가 유통사 앞으로** 발행합니다. `/wholesale/documents`·`/wholesale/statement` 에서 조회·인쇄.
6. **Q. 결제 후 재고가 없으면?**
   A. oversell 가드가 작동해 **자동 전액 환불**됩니다(안전결제).
7. **Q. 내 브랜드로 직접 만들고 싶어요(OEM/ODM).**
   A. `/wholesale/oem` 에서 상품명·목표 수량·목표 단가로 신청하면, 유통스타트가 **제조사 찾기·연결·생산까지** 지원합니다(OEM 등급 8% 공급).
8. **Q. 박스 단위로만 떼야 하나요?**
   A. 상품별 **최소 주문 수량(MOQ)** 이 설정될 수 있습니다(기본 1, 박스 단위). 카탈로그에 박스·개당 단가가 함께 표시되고, 주문 시 MOQ 미만이면 서버가 차단합니다.
9. **Q. 매출이 들어오기 전엔 발주를 못 하나요? (여신/외상)**
   A. **여신/외상 발주**가 가능합니다. 운영진이 부여한 **여신한도** 안에서 `여신한도 − 미수금 ≥ 주문액` 이면 Toss 결제 없이 외상으로 발주됩니다(미동결 계정 한정). 미수금은 추후 상환하며, 제조사 정산은 즉시 이뤄지므로 배송엔 영향이 없습니다. *(v1 — 한도/상환은 운영 관리, ON_CREDIT 환불 역전은 v2 예정)*
10. **Q. 받아보니 불량·오배송이면요? (클레임/RMA)**
    A. **클레임을 정식 접수**(불량/오배송/파손/수량부족/기타 + 증빙)하면 운영진이 검토합니다. 접수 즉시 **해당 공급사 정산이 보류**되어 분쟁 동안 대금이 묶이고, 승인 시 환불 처리됩니다.
11. **Q. 카탈로그 단가가 안 맞는 대량 거래는요? (견적/발주)**
    A. **견적을 요청**하면 운영진이 단가·MOQ·유효기간으로 회신하고, 수락 시 협의 단가로 진행합니다(Quote/PO, v1 단일 라인).
12. **Q. 상품이 많은데 원하는 걸 빨리 찾으려면?**
    A. 카탈로그 **검색(상품명·설명)·정렬(인기/가격/할인율/신상)·필터(카테고리/가격대/재고)** 로 빠르게 소싱할 수 있습니다.

> ⚠️ FAQ 의 마진율(C 20% 등)은 운영자 조정 가능한 기본값. 소개서에는 "예시 기본 마진율" 단서 권장.

---

## 15. CTA & 연락 동선

> **[디자인 지시]** 마지막 슬라이드 + 각 트랙 끝에 듀얼 CTA 버튼 2개를 명확히 분리.

- **제조사 CTA**: "제조사로 입점하기" → `/supplier/register` (또는 utongstart.com → 소개 페이지 제조사 버튼)
- **유통사 CTA**: "유통사로 시작하기" → `/wholesale/join`
- **공통 진입**: **utongstart.com** (루트 진입 시 소개 페이지로 자동 안내)
- **상담/문의**: `[확인 필요]` — 대표 연락처/이메일/카카오 채널은 운영팀이 확정해 삽입.

---

## 16. 디자인 톤 & 브랜드 가이드

### 16-1. 컬러
- **브랜드 포인트**: 유어딜 레드 `#FF0033` 계열(강조·CTA·헤드라인 포인트).
- **도매몰 표면 = 라이트 테마** — 배경 `#FFFFFF` / `#F4F5F7`(대시보드 톤), 본문 `text-gray-900`/`#374151`, 보조 `text-gray-500`.
  - ⚠️ 도매몰(`/wholesale`·`/supplier`)은 소비자 다크 홈과 달리 **라이트 테마 고정**(B2B 신뢰감). 출처: `CLAUDE.md` 라이트 테마 규칙, `wholesale-b2b-spec.md` "소비자 BottomNav 미표시".
- **신뢰 보조색**: 차분한 네이비/그레이 + 포인트 레드. 정산·세금 영역은 안정적 톤.

### 16-2. 톤 & 보이스
- **B2B 신뢰감** — 과장 없는, 수치 기반, 명료한 문장. "보장/책임/안전" 키워드.
- 제조사 트랙은 "성장·판로·효율", 유통사 트랙은 "기회·간편·수익".
- 전문 용어(MOQ, 드랍쉽, 등급가)는 1회 풀어 설명 후 사용.

### 16-3. 폰트 느낌
- 한글: 굵은 산세리프(예: Pretendard 계열)로 헤드라인 강조, 본문은 가독 우선 레귤러.
- 숫자(마진율·정산일·금액)는 **탭형 숫자/볼드**로 강조 — 표·그래프 가독성.

### 16-4. 레이아웃 원칙
- 슬라이드당 1메시지, 여백 충분히. 3자 구조도·정산 타임라인은 풀폭.
- 제조사/유통사 트랙은 색·아이콘으로 일관 구분(예: 제조사=블루, 유통사=레드 포인트).

---

## 🎨 16-5. 그라데이션 디자인 시스템 (이 덱의 핵심 비주얼 규칙 — 대부분 슬라이드에 그라데이션 적용)

> **사용자 요청**: "대부분 그라데이션이 들어갔으면 좋겠어." → 표지·섹션 구분·CTA·핵심 스탯·다이어그램 강조에 그라데이션을 **기본값**으로 적용.
> **이 덱은 B2B 라이트 테마**(배경 `#FFFFFF`/`#F4F5F7`)가 베이스. 따라서 그라데이션은 **강조 요소에 집중**하고, 본문 텍스트가 올라가는 큰 면은 흰/옅은 카드 위에 둬서 가독성을 지킨다. (a) 표지/섹션 헤더/CTA/스탯 강조 → **시그니처·딥 그라데이션**, (b) 카드/패널 → **subtle 라이트 그라데이션**, (c) 큰 배경 → **아주 옅은 mesh**.

### 16-5-1. 그라데이션 토큰 (copy-paste 가능 — 4개 덱 패밀리 공통, verbatim 유지)

| 토큰명 | CSS 값 | 용도 |
|---|---|---|
| **Primary brand gradient (시그니처)** | `linear-gradient(135deg, #FF0033 0%, #FF3D6E 100%)` | CTA 버튼, 강조 헤드라인 배경, 핵심 스탯 숫자/배지, 번호 배지 |
| **Brand warm gradient** | `linear-gradient(135deg, #FF0033 0%, #FF7A00 100%)` | 에너지/성장 표현(매출·성장·판로 확대 슬라이드), 제조사 트랙 강조 |
| **Brand deep gradient** | `linear-gradient(160deg, #C9184A 0%, #FF0033 60%, #FF4D6D 100%)` | 표지, 섹션 전환 인트로, 신뢰 섹션 등 풀폭 다크 강조 면 |
| **Mesh / auroral 배경 (대형 면)** | `radial-gradient(at 20% 20%, rgba(255,0,51,.18), transparent 40%), radial-gradient(at 80% 0%, rgba(255,122,0,.14), transparent 45%), radial-gradient(at 60% 90%, rgba(201,24,74,.12), transparent 50%)` over base `#FFFFFF` (또는 딥 면 위 base `#1A0810`) | 표지·구분 슬라이드의 **아주 옅은** 전면 배경 텍스처 |
| **Subtle card gradient (라이트)** | `linear-gradient(180deg, #FFFFFF 0%, #FFF1F3 100%)` + border `#FFE4E9` | 혜택 카드, 패널, FAQ 카드 (본문 텍스트 올라가는 면) |
| **Neutral depth gradient** | `linear-gradient(180deg, #FFFFFF 0%, #F4F5F7 100%)` | 중립 카드/표/대시보드 스크린샷 프레임 (레드가 과한 곳) |

### 16-5-2. 그라데이션별 용도 규칙

- **시그니처(Primary)**: 행동을 유도하거나 시선을 꽂아야 하는 작은 면 — CTA, 핵심 수치 배지, 단계 번호 원, 표 헤더행, 활성 탭. 절대 본문 단락 전체 배경으로 쓰지 말 것.
- **warm(레드→오렌지)**: "성장·판로·기회" 의미가 있는 곳에만. 제조사 트랙(판로 확대)·유통사 매출/수익 카드 아이콘.
- **deep(딥 마젠타→레드)**: 풀폭 강조 면(표지, 섹션 전환, 신뢰 섹션). 이 위 텍스트는 **반드시 흰색**.
- **mesh**: 항상 **아주 옅게**(opacity 0.1~0.2 stop). 텍스트 가독을 위해 콘텐츠 영역엔 흰/딥 솔리드 카드를 덧댄다.
- **subtle / neutral 카드**: 본문이 올라가는 대부분의 카드. 거의 흰색에 가깝게 — 그라데이션은 "느껴질 듯 말 듯".

### 16-5-3. 접근성 규칙 (가독성 — 반드시 준수)

- 그라데이션 위 텍스트는 **충분한 대비**(WCAG AA, 본문 4.5:1 / 큰 글자 3:1) 확보.
- **어두운 stop(딥/시그니처 진한 쪽) 위에는 흰 텍스트만.** 밝은 부분(오렌지·핑크 라이트 stop) 위에 흰/연한 텍스트 **금지**.
- 그라데이션이 밝은→어두운으로 변해 텍스트 대비가 흔들리는 면에는 **텍스트 뒤 반투명 스크림**(예: `rgba(0,0,0,.35)` 오버레이 또는 흰 카드)을 깐다.
- 숫자·표·정산 수치 등 **정확히 읽혀야 하는 데이터**는 그라데이션 면 위에 직접 올리지 말고 흰/뉴트럴 카드 위에 둔다(그라데이션은 카드 테두리·헤더·아이콘에만).
- 본문 단락(긴 텍스트)은 항상 솔리드 또는 subtle(거의 흰색) 위에.

### 16-5-4. Do / Don't

**Do**
- ✅ 표지·섹션 전환·CTA·핵심 스탯·다이어그램 노드/화살표·번호 배지·표 헤더행에 그라데이션 우선 적용.
- ✅ 아이콘은 그라데이션 fill 또는 그라데이션 원형 배경 위 흰 글리프.
- ✅ 4개 덱 공통 토큰(16-5-1)을 그대로 사용 → 패밀리 일관성.
- ✅ deep/시그니처 위 텍스트는 흰색, subtle 카드 위 텍스트는 `#374151`/`text-gray-900`.

**Don't**
- ❌ 긴 본문 단락 전체를 진한 그라데이션 위에 올리기.
- ❌ 밝은 그라데이션 stop 위에 흰/연회색 텍스트(대비 부족).
- ❌ 정산 수치·등급 마진표 숫자를 그라데이션 면 위에 직접(스크림/흰 카드 없이).
- ❌ 한 슬라이드에 3종 이상 다른 그라데이션 혼용(시각적 소음). 슬라이드당 강조 1~2종.
- ❌ B2B 신뢰 톤을 깨는 과채도 무지개·다색 그라데이션.

### 16-5-5. 적용 빈도 가이드

- **무조건 그라데이션**: 표지(S1), 섹션 전환/인트로 면, 모든 CTA 버튼, 핵심 스탯/배지, 3자 구조도 허브 노드·화살표, 작동방식 번호 배지, 표 헤더행, 정산 타임라인 진행선, 신뢰 섹션 풀폭 면.
- **subtle 그라데이션(거의 흰색)**: 혜택 카드, FAQ 카드, 비교표 셀, 마진 계산 카드 — 본문 가독 유지.
- **그라데이션 지양(솔리드/뉴트럴)**: 긴 본문 단락, 정확한 숫자 데이터 표 본문, 작은 각주.
- 목표 체감: "대부분의 슬라이드에 최소 1개 그라데이션 강조 요소"가 보이되, 텍스트는 항상 또렷하게.

### 16-5-6. 그라데이션 적용 체크리스트 (슬라이드별 한눈 표)

> 디자인 AI가 슬라이드를 레이아웃할 때 "이 슬라이드 어디에 어떤 그라데이션?" 을 한눈에 확인. 토큰명은 16-5-1 표 기준.

| 슬라이드 | 주 그라데이션 | 적용 위치 | 본문/데이터 면 |
|---|---|---|---|
| **S1 표지** | **deep + mesh** | 풀폭 배경(흰 텍스트), 로고/도메인 칩 반투명 박스 | — |
| **S2 문제** | neutral depth | 차분한 배경 | "Before" 라벨 칩만 **시그니처 띠** / 페인 아이콘 회색조 |
| **S3 솔루션(3자 구조)** | **시그니처 띠 + deep(허브)** | 상단 전환 밴드(시그니처), 허브 노드(deep), 화살표(시그니처 stroke) | 좌/우/상단 노드 = subtle 카드 |
| **S4 제조사 혜택** | **subtle 카드 + 시그니처 아이콘** | 혜택 카드(subtle), 아이콘 원(시그니처), 키워드(warm 텍스트) | 본문 `#374151` |
| **S5 유통사 혜택** | **subtle 카드 + 시그니처 스탯** | 카드(subtle), 아이콘 원(시그니처), "사입 0원/재고 0개" 숫자(시그니처 텍스트), 수익 아이콘(warm) | 본문 흰 카드 |
| **S6 작동 방식** | **시그니처 배지 + 진행선** | 단계 번호 배지(시그니처 원), 진행선(옅음→진함), 마지막 단계(warm) | 단계 설명 = subtle 카드 |
| **S7 가격·정산** | **시그니처 헤더행 + 진행선** | 마진표 헤더행(시그니처), 정산 진행선(시그니처 stroke·"익일" warm) | 마진율/정산일 = 뉴트럴 데이터 행 |
| **S8 신뢰·안전** | **deep + mesh(풀폭)** | 풀폭 배경(흰 텍스트), 방패/자물쇠 아이콘 원(시그니처) | 불릿은 스크림/딥 카드 위 |
| **S9 차별점** | **시그니처 컬럼 헤더** | 유통스타트 컬럼 헤더(시그니처)·✓ 셀, 경쟁사 컬럼 회색 | 표 본문 셀 = 흰/뉴트럴 |
| **S10 온보딩·CTA** | **deep + mesh + 듀얼 CTA** | 풀폭 배경(deep, 흰 텍스트), 제조사 CTA(warm)·유통사 CTA(시그니처) | 도메인 칩 반투명 박스 |

> 핵심: **표지·솔루션·신뢰·CTA(S1/S3/S8/S10)는 풀폭 강조 그라데이션 면**, **혜택·작동방식(S4~S6)은 subtle 카드 + 시그니처 포인트**, **데이터 슬라이드(S7/S9)는 헤더·진행선에만 그라데이션·본문은 뉴트럴**. 모든 슬라이드에 최소 1개 그라데이션 강조 요소.

---

## 부록 A. 불확실/운영 확정 필요 항목 (`[확인 필요]`)

- 대표 연락처/이메일/상담 채널 (§15).
- 실제 화면 스크린샷 캡처 (§13-7).
- 마케팅용 마진 예시 금액의 대외 표기 방식 (§6-2) — 코드 공식은 정확하나 "예시" 단서 필요.
- 경쟁사 비교의 경쟁사 측 주장 (§10) — 전부 `[가정]`, 법적 검토 권장.
- 바로빌 전자세금계산서 자동발행 활성 여부(환경변수·사업자정보 설정 상태) — 운영 시점 확인.
- 제조사↔유통스타트 매입 세금계산서는 제조사가 발행 주체(플랫폼 자동발행 불가, 별도 역발행 플로우) — `wholesale-b2b-spec.md` 보류 항목.
- **여신/외상(§9-D) 공급사 정산 시점** — 현재 코드는 외상이어도 공급사 즉시 정산(플랫폼이 채권 보유). 운영 정책상 상환 후로 미룰지 여부 **결정 대기**.
- **ON_CREDIT 거래의 세무·세금계산서 집계 포함 방식**(§9-D) — 외상 매출의 세금계산서/부가세 집계 시점·방식 확정 필요.
- **여신/외상 결제 v1 운영 검증** — staging 실결제/외상 발주 E2E 1회 검증 권장. ON_CREDIT 환불 역전·월 자동청구·연체 자동동결은 v2/향후.
- **정산 머니패스 clawback 부족분**(§8-3-A) — 음수 상계 후에도 부족한 회수액의 운영 절차(상계 vs 직접 청구) 확정 필요.

---

<!-- AUTO-GENERATED:proposal-refs START -->

## 🤖 코드 자동 동기화 (수치 SSOT + 기능 인벤토리) — 자동 생성, 수동 수정 금지

> 도메인: **도매몰 (유통스타트)**. 이 블록은 `scripts/generate-proposal-refs.mjs` 가 코드에서 추출해 자동 채웁니다.
> 값이 코드와 다르면 코드를 수정하고 `npm run generate:proposal-refs` 실행. (수동 편집 금지 — 다음 커밋에 덮어써짐.)

### 핵심 수치 (자동 추출)

| 항목 | 값 | 출처 (파일:심볼) |
|---|---|---|
| 유통사 등급 마진율 — A등급 | 10% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — B등급 | 15% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — C등급 | 20% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — D등급 | 25% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — OEM등급 | 8% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — SPECIAL등급 | 0% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통회원 가입 시 기본 등급 | C등급 | `src/lib/distributor-pricing.ts:DEFAULT_UNGRADED` |
| 공급자 정산 1일 한도 (default) | 100,000,000원 | `src/features/supply/api/supply-settlement.ts:DEFAULT_DAILY_CAP` |
| 공급자 환불창 (성숙 기간) | 7일 | `src/features/supply/api/supply-settlement.ts:SUPPLIER_REFUND_WINDOW_DAYS` |
| 원천징수 — 사업소득 (반복 활동, default) | 3.3% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.business_income` |
| 원천징수 — 기타소득 (단발성 협업) | 8.8% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.other_income` |
| 기타소득 분리과세 연 한도 | 3,000,000원 | `src/worker/utils/tax-withholding.ts:ANNUAL_THRESHOLD` |

### 도메인 코드 인벤토리 (자동) — 페이지 (24개)

- `/admin/distributor-grades`
- `/admin/suppliers`
- `/admin/wholesale-guide`
- `/admin/wholesale-orders`
- `/seller/register/supplier`
- `/seller/supply`
- `/supplier`
- `/supplier/login`
- `/supplier/register`
- `/supplier/wholesale-orders`
- `/wholesale`
- `/wholesale/cart`
- `/wholesale/checkout`
- `/wholesale/dashboard`
- `/wholesale/documents`
- `/wholesale/intro`
- `/wholesale/join`
- `/wholesale/login`
- `/wholesale/oem`
- `/wholesale/orders`
- `/wholesale/product/:id`
- `/wholesale/quotes`
- `/wholesale/statement`
- `/wholesale/success`

### 도메인 코드 인벤토리 (자동) — API 엔드포인트 (101개)


**/api/admin/distributor**
- `POST /api/admin/distributor/auto-grade/run`
- `GET /api/admin/distributor/auto-grade/settings`
- `PATCH /api/admin/distributor/auto-grade/settings`
- `GET /api/admin/distributor/company-info`
- `PUT /api/admin/distributor/company-info`
- `GET /api/admin/distributor/distributors`
- `PATCH /api/admin/distributor/distributors/:id`
- `GET /api/admin/distributor/distributors/:id/credit`
- `PATCH /api/admin/distributor/distributors/:id/credit`
- `POST /api/admin/distributor/distributors/:id/credit-repayment`
- `GET /api/admin/distributor/grades`
- `PUT /api/admin/distributor/grades/:grade`
- `GET /api/admin/distributor/oem-requests`
- `PATCH /api/admin/distributor/oem-requests/:id`
- `GET /api/admin/distributor/orders`
- `GET /api/admin/distributor/orders/:id`
- `POST /api/admin/distributor/orders/:id/refund`
- `GET /api/admin/distributor/price-history`
- `GET /api/admin/distributor/product-access`
- `POST /api/admin/distributor/product-access`
- `DELETE /api/admin/distributor/product-access/:id`
- `PATCH /api/admin/distributor/products/:id/margin-override`
- `GET /api/admin/distributor/products/:id/qty-tiers`
- `PUT /api/admin/distributor/products/:id/qty-tiers`
- `PATCH /api/admin/distributor/products/:id/visibility`
- `GET /api/admin/distributor/products/export`
- `GET /api/admin/distributor/proposals`
- `POST /api/admin/distributor/proposals`
- `DELETE /api/admin/distributor/proposals/:id`
- `DELETE /api/admin/distributor/seed-demo-products`
- `POST /api/admin/distributor/seed-demo-products`
- `GET /api/admin/distributor/tax-documents`
- `PATCH /api/admin/distributor/tax-documents/:id`
- `GET /api/admin/distributor/tax-documents/:id/html`
- `POST /api/admin/distributor/tax-documents/:id/issue-nts`
- `POST /api/admin/distributor/tax-documents/issue`
- `GET /api/admin/distributor/tax-summary`

**/api/admin/supplier-products**
- `GET /api/admin/supplier-products`
- `PATCH /api/admin/supplier-products/:id`
- `PATCH /api/admin/supplier-products/:id/price-change`

**/api/admin/suppliers**
- `GET /api/admin/suppliers`
- `PATCH /api/admin/suppliers/:id`
- `POST /api/admin/suppliers/:id/payout`
- `GET /api/admin/suppliers/:id/payouts`

**/api/supplier/analytics**
- `GET /api/supplier/analytics`

**/api/supplier/become**
- `POST /api/supplier/become`

**/api/supplier/login**
- `POST /api/supplier/login`

**/api/supplier/me**
- `GET /api/supplier/me`

**/api/supplier/orders**
- `GET /api/supplier/orders`
- `PUT /api/supplier/orders/:orderId/shipping`

**/api/supplier/products**
- `GET /api/supplier/products`
- `POST /api/supplier/products`
- `PATCH /api/supplier/products/:id`
- `GET /api/supplier/products/:id/channel-access`
- `POST /api/supplier/products/:id/channel-access`
- `DELETE /api/supplier/products/:id/channel-access/:accessId`
- `POST /api/supplier/products/:id/price-change-request`
- `POST /api/supplier/products/bulk`
- `POST /api/supplier/products/bulk-price-change`
- `GET /api/supplier/products/bulk-template`
- `POST /api/supplier/products/stock-import`

**/api/supplier/register**
- `POST /api/supplier/register`

**/api/supplier/settlements**
- `GET /api/supplier/settlements`

**/api/supplier/wholesale**
- `POST /api/supplier/wholesale/items/:id/ship`
- `GET /api/supplier/wholesale/orders`
- `POST /api/supplier/wholesale/orders/:id/refund`
- `POST /api/supplier/wholesale/orders/:id/ship-all`
- `GET /api/supplier/wholesale/orders/export`
- `POST /api/supplier/wholesale/tracking/bulk`

**/api/supply/products**
- `GET /api/supply/products`

**/api/supply/register**
- `POST /api/supply/register`

**/api/supply/sample-requests**
- `GET /api/supply/sample-requests`
- `POST /api/supply/sample-requests`

**/api/wholesale/admin**
- `GET /api/wholesale/admin/claims`
- `PATCH /api/wholesale/admin/claims/:id`

**/api/wholesale/become-distributor**
- `POST /api/wholesale/become-distributor`

**/api/wholesale/catalog**
- `GET /api/wholesale/catalog`
- `GET /api/wholesale/catalog/:id`

**/api/wholesale/catalog-export**
- `GET /api/wholesale/catalog-export`

**/api/wholesale/claims**
- `GET /api/wholesale/claims`
- `POST /api/wholesale/claims`

**/api/wholesale/documents**
- `GET /api/wholesale/documents`
- `GET /api/wholesale/documents/:id/html`

**/api/wholesale/home**
- `GET /api/wholesale/home`

**/api/wholesale/me**
- `GET /api/wholesale/me`

**/api/wholesale/oem-requests**
- `GET /api/wholesale/oem-requests`
- `POST /api/wholesale/oem-requests`

**/api/wholesale/order-template**
- `GET /api/wholesale/order-template`

**/api/wholesale/orders**
- `GET /api/wholesale/orders`
- `POST /api/wholesale/orders`
- `GET /api/wholesale/orders/:id`
- `POST /api/wholesale/orders/confirm`

**/api/wholesale/proposals**
- `GET /api/wholesale/proposals`

**/api/wholesale/quotes**
- `GET /api/wholesale/quotes`
- `POST /api/wholesale/quotes`
- `POST /api/wholesale/quotes/:id/accept`
- `POST /api/wholesale/quotes/:id/reject`
- `PATCH /api/wholesale/quotes/:id/respond`

**/api/wholesale/recent-items**
- `GET /api/wholesale/recent-items`

**/api/wholesale/register**
- `POST /api/wholesale/register`

**/api/wholesale/statement**
- `GET /api/wholesale/statement`


> 마지막 생성: 2026-06-08T02:01:43.542Z
> 생성기: `scripts/generate-proposal-refs.mjs`

<!-- AUTO-GENERATED:proposal-refs END -->
