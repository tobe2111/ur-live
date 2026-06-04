# 유통스타트(UtongStart) 도매몰 — 비즈니스 모델 스펙

> 출처: 2026-06-01 사용자 미팅 내용. 도메인: **www.utongstart.com** (기존).
> ⚠️ 이건 단순 오픈 도매몰이 아니라 **선별된 제조사 ↔ 유통스타트(중개 플랫폼) ↔ 선별된 유통사** 3자 중개 모델.
> **제조사와 유통사는 서로 직거래 불가.** 모든 거래·정산·세금계산서는 유통스타트를 경유.

---

## 1. 핵심 개념

- **누구나 이용 X** — 선별된(vetted) 제조사와 유통사만 지원.
- 소싱스타트(소싱) + 이미 알고 있는 공급사·유통사 양쪽을 도매몰로 지원하는 모델.
- 3 주체:
  1. **제조사 (Manufacturer)** — 상품을 만들어 유통스타트에 공급.
  2. **유통스타트 (Platform / 중개자)** — 가운데서 정산·세금·가격등급·제안을 관리.
  3. **유통사 (Distributor)** — 유통스타트에서 주문해 판매(유통).

```
제조사 ──공급──▶ 유통스타트 ──공급(등급가)──▶ 유통사 ──판매──▶ 최종소비자
   ▲ 정산        (마진/등급 분배)        ▲ 정산
   └── 세금계산서(to 유통스타트)   유통스타트 ── 세금계산서(to 유통사) + 거래내역서
```

**❌ 제조사 ↔ 유통사 직거래 금지** (서로 컨택/거래 불가, 신원 비노출).

---

## 2. 주체별 역할

### 2-1. 선별된 제조사 (Manufacturer)
- 상품 등록
- 재고 관리
- 주문 처리 (송장번호 입력)
- C/S 지원 (반품 처리)
- 세금계산서 발행 → **유통스타트 앞**

### 2-2. 유통스타트 (Platform / 운영 = 관리자)
- C/S 지원
- 제조사에게 **정산**
- 유통사에게 **세금계산서 발행**
- **거래내역서** 발행
- 유통사에게 **상품 제안**
- 제조사 컨택 → 제품 등록 요청

### 2-3. 선별된 유통사 (Distributor)
- 상품 유통(판매)
- 주문
- **정산** → 유통스타트 앞
- 제품 제안 받기

---

## 3. 공급가격 & 등급 모델 (핵심 신규 로직)

1. **제조사 공급가** 수령 (제조사가 유통스타트에 주는 가격).
2. 유통스타트가 **유통사 등급별 공급가격**으로 가공해 제공.
3. 등급: **A / B / C / D / OEM** — 제조사 공급가에서 **유통스타트가 정한 비율**로 각 등급 공급가 산출.
4. **특별할인 등급** (별도):
   - 유통스타트 관리자가 (기본)유통회원 등급 외에 **'특별할인 등급' 체크**를 하면,
   - 해당 유통사는 **정해진 기간 동안만** 특별할인 공급가로 판매 가능.
   - 용도: **덤핑 / 임박(유통기한 임박) 제품 위주**.

### 등급 부여 워크플로
- 유통사 가입 → 유통스타트가 **수동으로 등급 부여** → 해당 등급 공급가로 공급받음 → 유통 후 정산.

---

## 4. 거래/정산 흐름 (단방향 — 직거래 금지)

- **제조사**: 유통스타트에 *공급* + *주문처리(송장)* + *정산 수령* 만. (유통사 안 봄)
- **유통사**: 유통스타트에 *주문* + *정산 지급* 만. (제조사 안 봄)
- 유통스타트가 양쪽 사이 모든 가격·세금·정산 중개.

---

## 5. 현재 코드(2026-06-01) vs 이 스펙 — 갭 분석

| 스펙 항목 | 현재 구현 | 갭/필요 작업 |
|---|---|---|
| 제조사 = `suppliers` 테이블 | ✅ 있음 (business_name, 승인 status, 정산/payout) | 라벨 '제조사'로 정합. 거의 재사용 가능 |
| 제조사 상품등록/재고/송장/반품/세금계산서 | 상품등록·승인·정산 ✅ / 송장·반품·세금계산서 ⚠️ 부분 | 송장입력·반품처리·세금계산서(to 유통스타트) 추가 |
| 유통사 = 별도 등록 주체 | ⚠️ 현재 '셀러'가 supply 상품 소싱(`is_supply_product`) | **결정 필요**: 유통사 = 기존 셀러인가 / 신규 계정 타입인가 |
| **등급별 공급가 (A/B/C/D/OEM)** | ❌ 단일 `supply_price` 1개만 | **신규**: 등급 테이블 + 등급별 가격 산출(비율) + 유통사별 등급 배정 |
| **특별할인 등급 (기간한정)** | ❌ 없음 | **신규**: 유통사별 특별등급 토글 + 기간 + 특별공급가 |
| 유통사 수동 등급 배정 (관리자) | ❌ 없음 | **신규**: 어드민 유통사 관리 화면에 등급 select |
| 유통스타트→유통사 세금계산서 | ❌ 없음 | **신규**: 세금계산서 발행 (팝빌/바로빌 연동 검토) |
| **거래내역서** 발행 | ❌ 없음 | **신규**: 유통사 거래내역 PDF/조회 |
| 유통스타트→유통사 **상품 제안** | ❌ 없음 | **신규**: 제안 테이블 + 유통사 '제안 받기' 화면 |
| 제조사 컨택→제품등록 요청 | ❌ 없음 | **신규**: 관리자 제품등록 요청 워크플로 |
| **제조사↔유통사 직거래 금지(신원 비노출)** | ⚠️ 셀러 카탈로그에 supplier 신원 비노출 여부 확인 필요 | 양방향 신원 마스킹 검증/강화 |
| 도메인 utongstart.com | ❌ 현재 live.ur-team.com 내부 | **결정 필요**: 별도 도메인/별도 앱 vs 서브경로 |

### 매핑 요약
- **제조사 (Manufacturer)** ≈ 현재 `suppliers` (공급자) → 대부분 재사용 + 송장/반품/세금계산서 보강
- **유통사 (Distributor)** ≈ 현재 supply 소싱 '셀러' → **별도 '유통회원' 개념 + 등급제** 신규
- **유통스타트 (Platform)** ≈ 현재 admin

---

## 6. 결정 사항 (2026-06-01 사용자 확정)

- **D-A. 유통사 정체성** → **유통사 = 셀러(소매업체) 역할**. 우리 서비스의 '셀러'는 라이브방송 셀러 / 도매에서 공급받는 소매업체 / 매장 업주를 **모두 포괄**. 유통사(distributor)는 그중 *도매몰에서 공급받아 파는 소매업체* 역할 → **별도 계정 타입 신설 X, 기존 셀러 계정에 '유통(소싱) 등급'을 부여**하는 방식.
- **D-B. 등급 가격 산출** → **제조사 공급가 = 기준(base)**. 유통사 공급가 = `제조사공급가 × (1 + 등급별 마진율)`. 마진 = 유통스타트 수익. 고등급(A)일수록 마진율 ↓(저렴), 저등급 ↑. OEM 별도율.
- **D-F. 결제** → **선결제 (Toss)**. 유통사가 주문 시 즉시 결제. (외상/여신 X, 초기)
- **D-E. 도메인** → **utongstart.com 간판 달기** (같은 코드/DB, 별도 도메인 연결). host 가 `utongstart.com` 이면 도매몰 진입 화면을 보여주는 도메인 인식 라우팅. ⚠️ DNS/커스텀도메인 등록은 사용자 측 Cloudflare 작업 1회 필요.

### 6-1. 도메인 결정 — 쉬운 재설명 (사용자 답변 대기)
유통사가 이미 '셀러'라서 도매몰은 **사실상 지금 앱 안에 이미 들어있음**. 그래서 도메인은 "기능" 문제가 아니라 **"간판(주소)"** 문제일 뿐:
- (1) **지금 앱 그대로, 주소만 따로** — `utongstart.com` 치면 같은 서비스의 도매몰 화면이 뜨게 연결. 코드 1벌. **가장 쉬움/추천**.
- (2) **주소 없이 메뉴로만** — `live.ur-team.com/utong` 같은 경로로. 가장 간단하나 'utongstart' 간판 약함.
- (3) **완전 별도 사이트** — 코드/DB 따로. 브랜드 완전 분리되나 개발·운영 2배. (지금은 비추천)

### 6-2. 아직 안 정한 것 (구현 중 정해도 됨)
- **D-C. 마진율 설정 단위**: 등급 마진을 (a) 플랫폼 전역 1벌(예: A+10/B+15…)로 하고 상품별 예외 허용? 아니면 (b) 상품마다 등급가 따로? → *기본은 (a) 전역 + 상품별 override 권장*.
- **D-D. 세금계산서**: 팝빌/바로빌 자동발행 vs 수동(1차 수동→추후 자동). → *기본은 1차 수동, 추후 자동 권장*.

---

## 7. 구현 로드맵 (단계별)

- [x] **Phase 1 — 등급 가격 엔진 + 스키마** (commit, 2026-06-01)
  - `src/lib/distributor-pricing.ts` (유통사공급가 = 제조사공급가×(1+등급마진), 특별할인 기간 우선) + 유닛테스트 8
  - `distributor_grades` 테이블 + 시드(A/B/C/D/OEM/SPECIAL) · `sellers.distributor_grade` / `special_discount_until`
- [x] **Phase 1b — 어드민 설정 UI** (commit, 2026-06-01)
  - `distributor-admin.routes.ts` (`/api/admin/distributor`): 등급 마진율 편집 + 유통사 검색/등급배정 + 특별할인 종료일
  - `AdminDistributorGradesPage` (`/admin/distributor-grades`) + AdminLayout '유통사 등급' 메뉴
- [x] **Phase 2 — 유통사 도매 카탈로그 + B2B 주문(선결제)** (commit, 2026-06-01)
  - `wholesale.routes.ts`: /me /catalog /catalog/:id /orders(생성) /orders/confirm(Toss SSOT+CAS+재고+서버금액검증) /orders 목록·상세. 제조사가·신원 비노출.
  - 페이지 5종 (카탈로그/상세/체크아웃/성공/내역). 배송지 스냅샷.
- [x] **Phase 3 — 제조사 운영** (commit, 2026-06-01)
  - `wholesale-supplier.routes.ts` (`/api/supplier/wholesale`): /orders(내 라인+배송지) /items/:id/ship(송장) /orders/:id/refund(반품→cancelTossPayment+재고복원). 라인별 발송, 전 라인 발송 시 주문 SHIPPED.
  - `SupplierWholesaleOrdersPage` + 대시보드 '도매 주문' 링크.
- [x] **Phase 4 — 세금/거래내역/제안** (commit, 2026-06-01)
  - 상품제안(어드민→유통사): `wholesale_proposals` + admin CRUD + 유통사 카탈로그 '추천 상품 제안'.
  - 거래내역서: `/api/wholesale/statement` + `WholesaleStatementPage`(인쇄).
  - 세금계산서 집계(1차 수동): `/api/admin/distributor/tax-summary` 월별 유통사 매출/제조사 매입 — admin 섹션.
  - (남은 항목: 제조사 컨택/제품등록요청 워크플로우 — 기존 supplier self-serve 카탈로그로 대체 가능, 필요 시 후속)
- [x] **Phase 5 — utongstart.com 도메인 인식 라우팅** (commit, 2026-06-01 — DNS 등록은 사용자 1회)
- [x] **Phase 6 — utongstart.com 도매몰 전용 게이팅** (commit, 2026-06-04)
  - worker 진입 302(주 방어): `WHOLESALE_HOSTS` + `isWholesaleAllowedPath()` — utongstart.com 에서 도매몰 surface(`/wholesale`·`/supplier`·`/seller/login|register`·`/auth/`·`/login`·`/api/`·`/assets/`·정적파일) 밖의 모든 페이지 경로 → `/wholesale/intro` 302. (직접 URL·새로고침·SEO 차단)
  - SPA 가드(보강): `App.tsx` 에서 `isUtongstart() && !isWholesaleAllowedPath(location.pathname)` → `<Navigate to="/wholesale/intro" replace />`. (앱 내부 navigate() 차단)
  - allowlist 는 worker(`src/worker/index.ts`)·클라(`src/utils/domain.ts`) 양쪽 동기화 — 한쪽 변경 시 같이 갱신.
  - ⚠️ live.ur-team.com 등 다른 호스트는 no-op(영향 0). 세션은 도메인별 origin 분리(유통사 utongstart.com 에서 별도 로그인).

---

### 견고화 (2026-06-01, 검증 후 수정)
`wrangler dev --local` 실 토큰 검증으로 발견한 갭 4종 수정 (commit):
- **부분환불**: 다중 제조사 주문에서 제조사가 본인 라인만 부분환불(Toss cancelAmount + supplier-scoped 정산역전 + 해당 라인 재고복원). 전부 환불 시 REFUNDED, 일부면 PARTIAL_REFUNDED.
- **oversell 가드**: confirm 재고차감 원자화(`stock IS NULL OR stock>=qty`) + 실패 시 롤백 + 자동 전액환불(stays 패턴).
- **rate limit**: `/orders`·`/orders/confirm` 30회/60s.
- **체크아웃 복구**: `?order=<id>` 로 새로고침 시 주문 재조회.

판단 보류/유지:
- **정산 7일 보류창 유지** — 기존 공급자 정산 파이프라인(`SUPPLIER_REFUND_WINDOW_DAYS=7`)과 일관. 반품 가능 기간 동안 지급 보류가 합리적.
- **도메인 분기 client-side** — 첫 진입 시 소비자 SSR 깜빡임 후 redirect(경미). worker host 라우팅은 잠긴 SSR inject 영역이라 후속.
- **PENDING 만료 cron 없음** — 미결제 주문은 방치돼도 무해(unique toss_order_id). 후속 가능.

_상태: **Phase 1 ~ 5 전체 완료 + 견고화** (2026-06-01). 도매몰 코어 = 등급가 카탈로그 → B2B 선결제 → 제조사 송장/반품 → 거래내역·제안·세금집계 + utongstart.com 도메인 분기. 남은 운영 작업: (1) Cloudflare 커스텀도메인 등록(사용자), (2) 제조사→유통스타트 정산 자동 지급 배선(현재는 wholesale_order_items 에 매입액 스냅샷 + admin 집계까지)._

### 부록: utongstart.com 도메인을 "도매몰 페이지만" 연결하는 방법
단일 Cloudflare Pages 배포(같은 코드/DB)에서 도메인별로 다른 진입 화면을 주는 구성:
1. **(사용자 1회) Cloudflare 커스텀 도메인 추가** — Pages `ur-live` 프로젝트 → Custom domains → `utongstart.com` 추가(DNS CNAME). 같은 앱이 그대로 뜸.
2. **호스트 인식 라우팅(코드, Phase 5)**:
   - `isUtongstart()` = `location.hostname` 이 `utongstart.com` 인지 검사하는 헬퍼.
   - 루트 `/` 진입 시: utongstart 면 도매 카탈로그(유통사 로그인/카탈로그)로, live.ur-team.com 이면 기존 소비자 홈으로 분기.
   - 소비자 전용 라우트는 utongstart 에서 `/wholesale` 등으로 redirect(또는 숨김) — 도매 UX 만 노출.
   - (선택) `worker/index.ts` 에서 `host` 검사해 SSR 기본 경로/메타를 도매용으로. 단 SSR inject 블록은 잠금 영역이라 새 slot 패턴으로 추가.
3. 두 도메인이 같은 D1·세션을 쓰므로 데이터/계정은 공유, **화면(진입·네비)만 분리**.
