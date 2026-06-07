/**
 * 도매몰(유통스타트 B2B) 전용 운영 가이드 — 기본 시드
 *
 * 🏭 2026-06-07: 어드민 가이드의 'wholesale-utongstart' 섹션(요약 1개)을
 *   전용 가이드(`guide_type='wholesale'`)로 분리·확장. 단일 진실원천(SSOT).
 *
 *   - 노출/편집: 어드민 전용 (`/admin/wholesale-guide`, GuideViewer editable)
 *   - 자동 참조: 끝에 `auto-reference` 섹션이 코드 스캔 결과로 자동 추가됨
 *     (페이지 + API 엔드포인트). 업데이트: `npm run generate:guide-refs`
 *
 *   출처(정합): docs/design/wholesale-utongstart.md / wholesale-b2b-spec.md /
 *   wholesale-supply.md + src/features/supply/api/* + admin-products.routes.ts.
 *   잠긴 Toss SSOT helper(toss-gateway) 호출만, 결제 로직 변경 없음.
 */
import type { SeedSection } from './guide-seed-types'

export const WHOLESALE_SEED: SeedSection[] = [
  {
    key: 'overview', icon: '🏭', title: '개요 — 유통스타트 3자 중개 구조', order: 10,
    content: `### 유통스타트(UtongStart) = 제조사 ↔ 유통사를 잇는 B2B 도매 중개 플랫폼
별도 도메인 \`utongstart.com\` 으로 운영되지만 **같은 코드/DB** 입니다(live.ur-team.com 과 동일 앱, host 인식 라우팅).

**❌ 단순 오픈 도매몰이 아님** — 선별(vetted)된 제조사·유통사만 참여. **제조사 ↔ 유통사 직거래 금지**(서로 신원·연락처 비노출). 모든 거래·정산·세금계산서는 유통스타트(=플랫폼=어드민)를 경유합니다.

### 3 주체
- **제조사 (Manufacturer / 공급자)** — \`suppliers\` 테이블. 상품 등록·재고·송장·반품·세금계산서(→유통스타트) 담당.
- **유통스타트 (Platform / 어드민)** — 가격등급·마진·정산·세금·상품제안을 가운데서 관리. 곧 운영자(여러분).
- **유통사 (Distributor)** — 기존 '셀러' 계정에 \`distributor_grade\` 를 부여한 도매 소매업체. 등급가로 선결제 주문 후 유통(재판매).

\`\`\`
제조사 ──공급(원가)──▶ 유통스타트 ──공급(등급가)──▶ 유통사 ──판매──▶ 최종소비자
 ▲ 정산 수령          (마진=플랫폼 수익)        ▲ 선결제(Toss)
\`\`\`

### 진입점 (도메인/경로)
- 공개 소개: \`/wholesale/intro\` · 유통사 가입: \`/wholesale/join\` · 도매 카탈로그(쇼핑): \`/wholesale\`
- 제조사(공급자) 대시보드: \`/supplier\` · 제조사 가입: \`/supplier/register\`
- 어드민 도매 메뉴: \`/admin/suppliers\`(공급자) · \`/admin/distributor-grades\`(유통사 등급/마진) · \`/admin/wholesale-orders\`(도매 주문)
- 도메인 게이팅: \`utongstart.com\` 에서는 도매 surface(\`/wholesale\`·\`/supplier\` 등) 밖의 모든 경로가 \`/wholesale/intro\` 로 302. live.ur-team.com 은 영향 없음.

> 📌 이 가이드는 도매몰 운영의 **단일 진실원천**입니다. 어드민 일반 가이드의 도매 섹션은 이 페이지로 이동되었습니다.`,
  },
  {
    key: 'onboarding', icon: '✅', title: '회원 가입 · 승인 (제조사 / 유통사)', order: 20,
    content: `### 제조사(공급자) 온보딩
1. 제조사가 \`/supplier/register\` 에서 가입 (아이디: 영문+숫자 8자 이상).
2. 어드민이 \`/admin/suppliers\` 에서 **승인** → 승인된 제조사만 도매 상품 등록 가능.
3. 승인 후 \`/supplier\` 대시보드에서 공급가·공급범위·바코드와 함께 상품 등록.

### 유통사(도매회원) 온보딩
1. 유통사는 **기존 셀러 계정 = 도매 소매업체** 역할. 별도 계정 타입 신설 X — 셀러 계정에 \`distributor_grade\` 부여.
2. \`/wholesale/join\` 가입 또는 기존 셀러가 도매 신청 → 어드민이 \`/admin/distributor-grades\` 에서 등급 배정.
3. ⚠️ **가입 시 자동 C등급** — 미배정도 C로 동작(D 아님). 관리자가 A/B 상향 또는 D 하향.

### 카카오 same-email 자동연결
- 사전등록(관리자 시드)된 제조사/유통사 행과 카카오 로그인 계정을 same-email 로 자동 연결.
- 🔒 **\`email_verified === 1\` (카카오 \`is_email_verified\`) 일 때만** 연결 — 미verified email 로 사전등록 계정 takeover 차단(보안 게이트, COUNT=1 1:1 매핑).

### 신원 비노출 (직거래 차단)
- 유통사 카탈로그에 **제조사 신원·원가 비노출**(서버 차단). 제조사도 유통사 명단을 보지 못함.
- 모든 컨택/정산/세금은 유통스타트 경유.`,
  },
  {
    key: 'product-approval', icon: '📦', title: '상품 등록 · 검수 (최저가 검수 + 가격변경 승인)', order: 30,
    content: `### 제조사 self-serve 상품 등록
- 제조사가 \`POST /api/supplier/products\` (또는 \`/supplier/products/bulk\` CSV 양식)로 직접 등록.
- 등록 직후 **\`is_active=0\` (카탈로그 비노출) + \`supply_approval_status='pending'\`** — 어드민 승인 전에는 절대 노출/주문 불가.
- 어드민 승인 큐: \`/admin/products\` → **\`공급자 상품\`** 탭 (\`GET /api/admin/supplier-products\`).

### 🔍 온라인 최저가 검수 (신규 등록 상품)
1. 제조사가 등록 시 **온라인 최저가 참고 링크**(\`lowest_price_url\`, 네이버쇼핑 등)를 제출.
2. 어드민이 탭에서 링크를 열어 실제 시세 확인 → **\`온라인 최저가 확인함\`** 체크(\`lowest_price_checked=1\`) 후 \`승인\`.
3. 검수 완료 상품에는 **\`최저가 검수됨\`** 뱃지가 표시됩니다.
- 승인 처리: \`PATCH /api/admin/supplier-products/:id\` (approve → \`supply_approval_status='approved'\`, \`is_active=1\`).

### 💲 공급가 변경 승인 워크플로 (이미 판매 중인 상품)
이미 승인되어 노출 중인 상품의 가격은 **제조사가 직접 못 바꿉니다.** 갑작스러운 가격 변동/잘못된 가격 결제를 막는 핵심 가드입니다.
1. 제조사가 \`POST /api/supplier/products/:id/price-change-request\` 로 **변경 요청**만 전송 → \`pending_supply_price\` / \`pending_retail_price\` / \`pending_price_url\` / \`pending_price_reason\` 에 **적재만** 됩니다(라이브 \`supply_price\`/\`price\` 는 그대로 유지).
2. 어드민이 \`공급자 상품\` 탭의 **\`가격변경 요청\`** 필터에서 **현재가 → 요청가** + 참고 링크를 검토.
3. \`PATCH /api/admin/supplier-products/:id/price-change\` 로 **\`approve\`**(라이브 가격 반영 + pending 클리어 + 이력 기록) 또는 **\`reject\`**(요청만 폐기).
4. **승인 전까지 기존 노출 가격이 유지** → 결제가 안정.
- 이력: \`supply_price_history\` 에 변경 전/후 기록(관리자만 확인). 제조사에게 승인/거부 알림 발송.

### 카탈로그 노출 제어 (\`supply_visibility\`)
- **ALL** — 모든 유통회원에게 노출(기본).
- **APPROVED_CHANNEL** — '승인한 유통채널' 만. \`product_distributor_access\` 에 선정된 유통사만 노출.
- **UTONGSTART_ONLY** — 유통스타트가 직접 선정한 채널만.
- 어드민/제조사가 상품ID 조회 후 **선정 유통회원**을 추가/해제(\`POST/DELETE /api/supplier/products/:id/distributor-access\`).`,
  },
  {
    key: 'pricing-grades', icon: '🏷️', title: '가격 · 등급 · 마진 (등급가 / override / 수량할인)', order: 40,
    content: `### 등급가 산출 공식
**유통사 공급가 = 제조사 공급가 × (1 + 등급 마진율)**. 마진 = 유통스타트(플랫폼)의 수익.
- 제조사 원가·신원은 유통사에 **비노출**(서버 차단).
- 표시가 = 결제가 (서버 재계산 SSOT — 7곳: home/catalog/detail/order-create/proposals/catalog-export/admin-export 일괄 반영).

### 등급 마진율 (\`/admin/distributor-grades\`)
- A/B/C/D/OEM/SPECIAL 마진율 편집. **고등급(A)일수록 저마진(저렴)**, 저등급일수록 고마진.
- 기본: A 10% / B 15% / **C 20%(기본 배정)** / D 25% / OEM 8% / 특별 0%.
- **유통사 등급 배정**: 셀러 검색 → 등급 + 특별할인 종료일(\`special_discount_until\`) 설정. ⚠️ 미배정도 C로 동작.

### 특별할인 등급 (SPECIAL)
- 기간 한정(\`special_discount_until\` 까지). **덤핑/유통기한 임박 제품** 위주. 기간 내 최저 마진가 적용.

### 상품별 마진 override (특가/전략상품)
- \`products.supply_margin_override_pct\` 설정 시 **등급(A/B/C/D) 무관 모든 유통사가 동일 공급가** — 전략·특가·임박품용.
- 설정: \`PATCH /api/admin/distributor/products/:id/margin-override\`, \`/admin/distributor-grades\` "상품별 마진(특가)" 섹션. NULL 이면 기존 등급마진으로 복귀.
- 상품ID는 \`상품정보 엑셀\`(product_id 컬럼)에서 확인.

### 수량 구간 할인 (volume tier)
- 상품별 \`수량:할인%\` 쌍(예 \`100:5, 500:10\` = 100개↑ 5%, 500개↑ 10%). 등급가 위에 **구매 수량별 추가 할인**.
- ⚠️ 단가는 **공급원가 이하로 안 내려감** — 할인이 마진을 초과하면 원가로 floor(역마진 차단). 표시가=결제가 동일(서버 재계산).`,
  },
  {
    key: 'orders-shipping', icon: '🚚', title: '주문 · 배송 (선결제 / 합배송 / 송장)', order: 50,
    content: `### 유통사 도매 주문 (선결제)
1. 유통사가 \`/wholesale\` 카탈로그에서 등급가로 담아 **선결제(Toss)** — \`POST /api/wholesale/orders\` → \`/orders/confirm\`.
2. confirm 단계에서 **Toss SSOT helper(\`confirmTossPayment\`)** + 동시주문 CAS + 재고 원자 차감 + **서버 금액 재계산**(클라 금액 불신뢰).
3. oversell 가드: 재고 부족 시 롤백 + 자동 전액환불(stays 패턴). \`/orders\`·\`/orders/confirm\` rate limit 30회/60s.
4. 배송지 스냅샷 저장. \`?order=<id>\` 로 새로고침 시 주문 재조회.

### 제조사 주문 처리 · 송장 (\`/supplier/wholesale-orders\`)
- 제조사는 \`/api/supplier/wholesale\` 에서 **본인 라인 + 배송지**만 조회(다른 제조사 비노출).
- **개별 송장**: \`POST .../items/:id/ship\` (라인별). 전 라인 발송 시 주문 SHIPPED.
- **합배송**: 한 주문에 같은 제조사 상품이 여러 개(미발송 2건 이상)면 \`POST .../orders/:id/ship-all\` 로 **송장 1개 일괄 발송**(원자, 멱등). UI 에 "합배송 — N개 한 송장으로 발송" 패널 노출.
- ⚠️ 다중 제조사 박스 물리적 합치기는 물류허브 필요라 범위 외(라인 단위 발송).
- **CSV 일괄 송장 업로드** 지원.

### 반품 (제조사 라인 단위 부분환불)
- 제조사가 본인 라인만 부분환불: \`POST .../orders/:id/refund\` → Toss 부분취소(\`cancelTossPayment\`) + 정산 역전 + 해당 라인 재고복원.
- 전부 환불 시 REFUNDED, 일부면 PARTIAL_REFUNDED.`,
  },
  {
    key: 'settlement', icon: '💰', title: '정산 (성숙 · 환불창 · 1일 한도)', order: 60,
    content: `### 제조사 정산 흐름 (\`supplier_settlements\`)
1. 유통사가 등급가로 선결제 완료 시, 제조사 공급가(원가 × 수량)를 \`supplier_settlements(source='wholesale')\` 에 적립.
2. 성숙(지급 가능) 시점:
   - **브랜드 제품(\`is_brand_product=1\`)**: 익일(1일 보호창) 성숙.
   - **일반 제품**: 7일 환불창(\`SUPPLIER_REFUND_WINDOW_DAYS=7\`) 후 성숙.
3. 성숙분은 정산 cron 이 지급. \`supplier_balances\`(pending/available/paid)에 반영.

### 1일 정산 한도
- **플랫폼 1일 정산 한도 = 기본 1억원** (\`platform_settings.supplier_daily_payout_cap\` 으로 조정). 초과 시 지급 차단.

### 환불 역전
- 반품/환불 발생 시 해당 정산 적립을 역전(reverse) — 정산 파이프라인이 자동 처리. 미성숙 분은 차감, 이미 성숙·지급분은 차기 정산에서 조정.`,
  },
  {
    key: 'tax', icon: '🧾', title: '세금 (거래명세서 / 세금계산서 / 바로빌)', order: 70,
    content: `### 거래명세서 · 세금계산서 발행
- 매출 방향: 유통스타트 → 유통사 / 매입 방향: 제조사 → 유통스타트.
- **부가세 10% 분리**: 공급가 = 총액 ÷ 1.1.
- 어드민: \`/admin/distributor-grades\` 세금 섹션에서 월 선택 → \`발행\` (\`GET /api/admin/distributor/tax-summary\` 월별 유통사 매출/제조사 매입 집계) → \`인쇄\`(PDF).
- 유통사: 본인 발행 자료를 \`/wholesale/documents\`(거래명세서/세금계산서 탭)에서 조회·인쇄. 거래내역서 \`/wholesale/statement\`.

### 국세청 전자 발행 (바로빌 연동)
- 매출 방향(유통스타트→유통사) 국세청 전자세금계산서 자동 발행은 **바로빌 연동**.
- 활성 조건: \`BAROBILL_*\` 환경변수 + \`platform_settings\` 사업자정보(상호/사업자번호/대표/주소/업태/종목/이메일/전화) 설정.
- 1차는 수동 집계·발행, 환경변수 설정 시 자동 발행 전환.

### 플랫폼 사업자정보
- \`/admin/distributor-grades\` 세금 섹션 폼에서 저장 → 전자세금계산서 발행 전제 정보.`,
  },
  {
    key: 'oem-odm', icon: '🔧', title: 'OEM / ODM 매칭', order: 80,
    content: `### OEM/ODM 신청 관리
- 유통사가 OEM/ODM(주문자/제조자 개발 생산) 제품 생산을 신청 → 어드민이 신청 목록을 관리.
- 상태: 접수 / 매칭중 / 매칭완료 / 종료 / 반려 + 매칭 제조사 ID + 메모.
- 유통스타트가 적합 제조사를 찾아 연결·생산 지원. (\`oem-requests.ts\`)
- OEM 등급은 별도 마진율(기본 8%) 적용.`,
  },
  {
    key: 'csv-bulk', icon: '📑', title: '엑셀(CSV) 대량처리', order: 90,
    content: `### 역할별 CSV 기능
- **제조사**: 대량 상품등록(\`/supplier/products/bulk\` + 양식 다운로드), 주문확인 export, 송장 일괄 업로드.
- **유통사**: 카탈로그 등급가 다운로드, 주문 양식.
- **어드민**: \`상품정보 엑셀\`(A/B/C 등급가 + override 컬럼) export — 유통채널 제안용.
- 표시가=결제가 정합을 위해 서버가 재계산하므로, CSV 가격은 참고용(주문 시 서버 재산정).`,
  },
  {
    key: 'checklist-troubleshooting', icon: '🛠️', title: '운영 체크리스트 · 트러블슈팅', order: 100,
    content: `### 신규 온보딩 체크리스트
- [ ] **신규 제조사**: \`/supplier/register\` → \`/admin/suppliers\` 승인 → 도매 상품 등록(공급가·공급범위·바코드·최저가 링크).
- [ ] **신규 유통사**: \`/wholesale/join\` → 자동 C등급 → 필요 시 \`/admin/distributor-grades\` 에서 등급 상향.
- [ ] 상품 승인 시 **온라인 최저가 확인** 체크 후 승인.
- [ ] 가격 변경 요청은 \`가격변경 요청\` 필터에서만 반영(직접 수정 X).
- [ ] 도메인 연결: Cloudflare Pages \`ur-live\` → Custom domains → \`utongstart.com\` (운영 1회) → 루트 자동 \`/wholesale/intro\`.

### 자주 묻는 문제
- **Q. 제조사가 등록한 상품이 카탈로그에 안 보여요** → 정상. \`is_active=0\`+\`pending\` 상태로 어드민 승인 전입니다. \`공급자 상품\` 탭에서 승인하세요.
- **Q. 제조사가 가격을 바꿨는데 반영이 안 돼요** → 의도된 동작. 가격변경은 요청만 적재되고 어드민이 \`가격변경 요청\` 에서 \`approve\` 해야 라이브 반영됩니다.
- **Q. 유통사마다 가격이 달라요** → 등급별 마진 차이입니다. 모두 같게 하려면 상품별 마진 override 를 설정하세요.
- **Q. 정산이 바로 안 떨어져요** → 일반제품 7일 환불창 후 성숙. 브랜드제품은 익일. 1일 한도(기본 1억) 초과 시 차기로 이월.

### 안전장치 (변경 금지)
- 도매 결제는 **잠긴 Toss SSOT helper**(\`confirmTossPayment\`/\`cancelTossPayment\`)만 호출. 직접 fetch 금지(CLAUDE.md 잠금).
- 동시주문 oversell 자동 가드 + 실패 시 자동환불. 금액은 항상 서버 재계산(클라 값 불신뢰).
- 제조사↔유통사 신원/원가 양방향 마스킹.`,
  },
]
