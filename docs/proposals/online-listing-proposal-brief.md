# 유어딜 온라인 상품 입점 제안서 — 콘텐츠 브리프 (DESIGN AI 용 SOURCE MATERIAL)

> ⚠️ 이 문서는 **디자인 결과물이 아니라, 디자인 AI 가 슬라이드 덱(제안서)을 레이아웃할 때 사용할 "정확하고 상세한 원천 자료(content brief)"** 입니다.
> 모든 수치는 실제 코드/설정에서 추출했습니다. 불확실한 항목은 `[확인 필요]`, 추정/가정은 `[가정]` 으로 표기했습니다.
> `[디자인 지시]` 콜아웃은 디자인 AI 가 따라야 할 시각 지침입니다.
>
> **추출 출처 (Ground Truth):**
> - 수수료/세금 SSOT: `src/shared/constants/policy.ts`, `src/worker/utils/tax-withholding.ts`
> - 셀러 역할: `src/shared/seller-roles.ts`
> - 입점/등록: `src/features/seller/api/seller-registration.routes.ts`, `seller-onboarding.routes.ts`
> - 정산 게이팅: `src/features/seller/api/seller-settlements.routes.ts`
> - 대량등록(CSV): `src/components/BulkUploadModal.tsx`
> - 외부몰 연동: `src/features/cafe24/api/cafe24.routes.ts`, `cafe24-api.service.ts`
> - 라이브 송출: `src/features/youtube/api/youtube-live.routes.ts`, `src/features/multi-platform/api/multi-platform.routes.ts`
> - 상품 판매 채널: `src/features/products/api/products.routes.ts`, `src/pages/BrowsePage.tsx`, `ProductDetailPage.tsx`, `CartPage`, `CheckoutPage`
> - 정책 규칙: `CLAUDE.md`

---

## 1. 문서 목적 & 타깃

### 문서 목적
유어딜(live.ur-team.com)에 **상품을 온라인으로 입점·판매하려는 사업자**에게, 유어딜이 제공하는 3가지 판매 채널(쇼핑 / 라이브·쇼츠 커머스 / 링크샵)과 빠른 입점·자동 정산 구조를 설득력 있게 전달하는 **입점 제안서 덱**을 제작하기 위한 콘텐츠 브리프.

### 타깃 (Primary)
- **브랜드 / 제조사** — 자사 상품을 신규 판매 채널에 노출·판매하려는 곳
- **온라인 셀러 / 위탁판매 사업자** — 기존 오픈마켓 외 추가 채널을 찾는 사업자
- **오프라인 매장 사장님(store_owner)** — 매장 상품/교환권을 온라인으로 판매하려는 곳

### 부 타깃 (Secondary)
- **인플루언서 / 크리에이터(influencer)** — 라이브·쇼츠·링크샵으로 상품을 판매·홍보하고 성과 보상을 받으려는 셀러

> `[확인 필요]` 셀러 역할 값(`seller_type`)은 코드상 `influencer` / `store_owner` / `both` 3종 (출처: `src/shared/seller-roles.ts`). 사용자 대면 라벨은 각각 "🎤 크리에이터" / "🏪 매장 사장님" / "🎤🏪 크리에이터 + 매장".

`[디자인 지시]` 표지에 타깃 3종(브랜드/제조사 · 온라인 셀러 · 매장 사장님)을 아이콘 3개로 시각화. 부 타깃(크리에이터)은 별도 보조 배지로.

---

## 2. 한 줄 요약 & 엘리베이터 피치

**한 줄 요약**
> "상품 등록 한 번으로 — 쇼핑몰 · 라이브 방송 · 크리에이터 링크샵, 3개 채널에서 동시에 팔리는 커머스 플랫폼."

**엘리베이터 피치 (30초)**
> 유어딜은 단순 진열형 오픈마켓이 아닙니다. 상품을 한 번 등록하면 (1) 쇼핑 피드(`/browse`)에 노출되고, (2) 크리에이터가 라이브 방송·쇼츠(`/live`, `/shorts`)에서 직접 판매하며, (3) 크리에이터 개인 링크샵에 핀(추천)으로 걸려 추가 트래픽이 들어옵니다. CSV 한 번 또는 Cafe24 연동으로 빠르게 입점하고, 결제·정산·세금(원천징수)까지 자동 처리됩니다. 기본 플랫폼 수수료는 **5%** 입니다.

`[디자인 지시]` 표지 직후 "3채널 동시 판매" 한 줄을 큰 타이포 + 유어딜 포인트 컬러 #FF0033 로 강조.

---

## 3. 시장 기회 / 문제 정의

### 기존 오픈마켓의 한계 (문제)
| 문제 | 설명 |
|---|---|
| **노출 경쟁 심화** | 검색·랭킹 알고리즘 의존 → 신규/중소 셀러는 첫 페이지 노출이 어려움 |
| **낮은 전환율** | 진열형 상세페이지만으로는 구매 설득력 부족, 단순 스펙 비교 경쟁 |
| **광고비 부담** | 노출을 위해 키워드/디스플레이 광고비를 지속 지출해야 함 |
| **브랜드/스토리 전달 한계** | 정적 이미지·텍스트만으로 제품 가치·사용법을 충분히 전달 못 함 |
| **고객 관계 부재** | 1회성 거래 위주, 재구매·팬덤 형성 어려움 |

### 유어딜이 보는 기회
- **라이브커머스**: 실시간 방송으로 제품 시연·Q&A → 높은 전환·체류
- **크리에이터 커머스**: 인플루언서/크리에이터가 자기 팬에게 직접 추천·판매 → 신뢰 기반 구매 (성과형 보상으로 셀러가 자발적으로 밀어줌)
- **쇼츠(숏폼)**: 짧은 영상으로 상품을 바이럴 노출 (`/shorts`)
- **통합 채널**: 한 번 등록한 상품이 3채널에 동시 노출 → 채널별 중복 작업 제거

`[디자인 지시]` 좌(문제: 회색톤 오픈마켓 진열대) vs 우(기회: 라이브+크리에이터+숏폼) Before/After 대비 레이아웃.

---

## 4. 솔루션 = 유어딜 판매 채널 3종

상품 1건 등록 → 아래 3개 채널에서 동시에 판매·노출.

### 채널 ① 쇼핑 (`/browse`)
- 쇼핑 피드/그리드 형태로 상품 진열 (출처: `src/pages/BrowsePage.tsx`)
- 카테고리·검색·정렬 필터, 상품 상세(`/products/:id` — `ProductDetailPage.tsx`)
- 장바구니(`CartPage`) → 결제(`CheckoutPage`) → 주문(`orders.routes.ts`) 표준 e-commerce 플로우
- 이미지 자동 최적화(도미넌트 컬러 placeholder, lazy-load, CF 이미지 리사이즈)로 빠른 로딩
- `[디자인 지시]` 화이트 테마 쇼핑 그리드 목업 (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`)

### 채널 ② 라이브 / 쇼츠 커머스 (`/live/*`, `/shorts`)
- 크리에이터가 **라이브 방송**으로 상품을 실시간 판매 (출처: `youtube-live.routes.ts` — `/live/create`, `/live/:id/start`, 채팅 `/live/:id/chat`, 상품 오버레이)
- **멀티플랫폼 송출**: YouTube Live `available`, RTMP 인제스트 지원(OBS/Prism 호환). TikTok·네이버 치지직·SOOP(아프리카TV)는 `coming_soon` (출처: `multi-platform.routes.ts` DESTINATIONS — `eta: 2026 Q3~Q4`)
- **쇼츠(숏폼)**: 9:16 세로 영상으로 상품 노출 (`/shorts`, `SellerShortsPage`)
- 방송 중 상품 오버레이/핀으로 즉시 구매 유도
- `[디자인 지시]` 9:16 모바일 라이브 화면 + 상품 카드 오버레이 목업. 송출 플랫폼 로고 라인(YouTube=지원, TikTok/치지직/SOOP=Coming Soon 배지).

### 채널 ③ 링크샵 (크리에이터 공개샵)
- 크리에이터/셀러 개인 공개 페이지(`SellerPublicPage` — `/profile/:handle`, `/s/:id`)
- 크리에이터가 상품을 "핀(추천)" 으로 큐레이션 → 자기 팬·팔로워에게 노출 (링크샵)
- 핀 추천 클릭/구매 시 크리에이터에게 어필리에이트 보상 적립 (성과형)
- `[디자인 지시]` 크리에이터 프로필 + 추천 상품 그리드(링크샵) 목업. 다크 테마(유저 대면).

`[디자인 지시]` **3채널 퍼널 다이어그램** — 중앙 "상품 1건 등록" → 3갈래(쇼핑/라이브·쇼츠/링크샵) → "구매·정산". 이 슬라이드가 솔루션 섹션의 핵심.

---

## 5. 입점/판매자 가치 제안

| 가치 | 근거 |
|---|---|
| **크리에이터/인플루언서 연결** | 크리에이터가 라이브·쇼츠·링크샵에서 상품을 자발적으로 판매·홍보 (성과형 보상으로 동기 부여) |
| **라이브 방송 판매** | 실시간 시연·Q&A로 전환율↑ (YouTube Live 송출, RTMP/OBS 호환) |
| **성과형 수수료 구조** | 기본 플랫폼 수수료 5%, 크리에이터/링크샵 추천 보상은 매출 발생 시에만 적립 |
| **빠른 입점** | 개별 등록 + CSV 대량등록 + Cafe24 외부몰 연동 동기화 |
| **정산·세금 자동화** | 주문→정산→원천징수(3.3%/8.8%)→송금 자동 처리, 사업자 검증 시 원천징수 면제 |
| **이미지/운영 도구** | 대량등록, 재고/주문 관리, 통계 대시보드, 이미지 자동 최적화 |
| **결제 안전성** | 토스페이먼츠 V2 결제(SSOT 잠금), 금액 서버 재검증, 환불/CS 흐름 |

`[디자인 지시]` 7개 가치를 아이콘 카드 3-4열 그리드로. 상단 강조 = "크리에이터 연결" + "성과형 수수료".

---

## 6. 입점 절차 (스텝 바이 스텝)

> 출처: `seller-registration.routes.ts`(가입·사업자검증), `BulkUploadModal.tsx`(CSV), `cafe24.routes.ts`(연동), `seller-onboarding.routes.ts`(부트캠프), `seller-settlements.routes.ts`(정산)

1. **가입 / 셀러 등록** — 셀러 가입(`POST /api/seller/register`). 필수: username, email, password, name, business_name, business_number, phone, youtube_email. 역할(`seller_type`) 선택: 크리에이터 / 매장 사장님 / 겸업.
2. **사업자 등록번호 검증** — 사업자번호 형식 검증(`XXX-XX-XXXXX`). 등록 직후 status=`pending` → 국세청(NTS) 비동기 진위확인 → 일치 시 `approved` 자동 승급 (대표자명·개업일 제공 시). (출처: `seller-registration.routes.ts`)
3. **상품 등록** — 3가지 방법:
   - **개별 등록** (`POST /api/products`, `SellerProductNewPage`)
   - **CSV 대량등록** (`BulkUploadModal` → `POST /api/bulk-upload/upload`). 한글 헤더 매핑 지원: `상품명*`, `판매가격*`, `재고수량*`, `카테고리*`, `상품타입*`, `이미지URL`, `라이브특가`, `옵션타입/옵션값/옵션추가금액/옵션재고` 등.
   - **Cafe24 외부몰 연동** — OAuth 인증 후 상품 자동 동기화(`POST /api/.../cafe24/sync`). `cafe24_product_map` 으로 중복 방지, 가격/공급가/소비자가 매핑. `[확인 필요]` 현재 Cafe24 연동 트리거는 **어드민 권한(requireAdmin)** 으로 보호됨 — 셀러 셀프 연동인지 어드민 대행인지 운영 정책 확인 필요.
4. **채널 노출** — 등록 상품이 쇼핑(`/browse`) 노출 + 크리에이터 라이브/쇼츠/링크샵 판매 대상으로 편입.
5. **주문 / 배송** — 구매 발생 시 주문 생성(`orders.routes.ts`), 셀러 주문 관리(`SellerOrdersPage`), 배송 추적(tracker.delivery 연동, 6시간 주기 sync).
6. **정산** — 정산 신청(`POST /api/seller/settlements/request`) → 어드민 승인 → 송금. 원천징수 자동 처리.

`[디자인 지시]` **입점 타임라인** — 6스텝 가로 타임라인. "상품 등록" 스텝에서 3갈래(개별/CSV/Cafe24) 분기 시각화. 사업자 검증은 "자동 승인" 배지로 강조.

---

## 7. 수수료 / 정산 / 세금 구조

> 모든 수치 출처: `src/shared/constants/policy.ts` (`COMMISSION_DEFAULTS`, `TAX_POLICY`), `src/worker/utils/tax-withholding.ts` (`WITHHOLDING_RATES`), `CLAUDE.md`.

### 수수료 표
| 항목 | 기본값 | 비고 / 출처 |
|---|---|---|
| **플랫폼 기본 수수료** | **5%** | `COMMISSION_DEFAULTS.PLATFORM_FEE_PCT = 5`. 동적 설정 `platform_settings.commission_rate_default` / `platform_fee_pct` 우선 |
| **셀러별 수수료 조정** | 가능 | `sellers.commission_rate` 로 셀러별 개별 설정 (어드민 조정) |
| **위탁판매 셀러 commission** | 10% | `SELLER_COMMISSION_PCT = 10` (위탁 판매 케이스) |
| **후원(도네이션) 수수료** | 15% | `[확인 필요]` `CLAUDE.md` 명시 "후원 수수료 별도 15%" — `policy.ts` 상수에는 직접 노출 안 됨, 별도 후원 로직 확인 권장 |
| **셀러 등급별 보너스** | bronze 0 / silver +1 / gold +2 / platinum +3 (%) | `TIER_COMMISSION_BONUS` |
| **제휴(추천인) 보상** | 5% | `AFFILIATE_COMMISSION_PCT = 5` (`platform_settings.affiliate_commission_rate` 우선) |
| **공구 양쪽 추천 보너스** | 각 0.5% | `REFERRAL_BONUS_BOTHSIDES_PCT = 0.5` |
| **큐레이터(링크샵) 핀 어필리에이트** | 1.0% | `CURATOR_AFFILIATE_PCT = 1.0` (`products.referral_commission_rate` 우선) |
| **인플루언서 매장영입 commission** | 1.5% | `platform_settings.influencer_store_intro_pct` default 1.5% (`influencer-store-intro-commission.ts`) |

### 정산 타이밍 & 사업자 게이팅
- **정산 신청** (`POST /api/seller/settlements/request`): 전월 1일~말일 단위(NOT NULL period). 미완료(미래) 기간 신청 불가, 동일 기간 중복 신청 차단(원자적 INSERT). PIN 인증(최근 15분) 필수.
- **현금 정산 = 사업자 검증 필수**: `business_registration_status` 가 `verified`/`exempt` 가 아니면 현금 정산 차단(412, `BUSINESS_REGISTRATION_REQUIRED`). 미검증 셀러는 교환권/포인트(딜)로 수령 가능. (출처: `seller-settlements.routes.ts`)
- **최소 출금액**: 10,000원 (`COMMISSION_MIN_WITHDRAWAL` / `WITHDRAWAL_DEFAULTS.MIN_AMOUNT`).
- **정산 가능 잔액 검증**: 신청 금액은 서버 잔액(`seller_deal_balances.redeemable_deal_amount`) 상한 검증.

### 세금 (원천징수)
> 출처: `tax-withholding.ts` `WITHHOLDING_RATES`. **비율 hardcode 금지 — 이 상수가 SSOT.**

| 소득 유형 | 비율 | 적용 대상 | `sellers.tax_type` 값 |
|---|---|---|---|
| **사업소득** (default) | **3.3%** (소득세 3% + 지방세 0.3%) | 반복적 활동 — 대부분 크리에이터/셀러 | `business_income` |
| **기타소득** | **8.8%** (소득세 8% + 지방세 0.8%) | 단발성 협업 | `other_income` |

- **사업자 검증 시 원천징수 면제**: `business_registration_status` = `verified`/`exempt` → 셀러가 세금계산서 발행, 원천징수 0 (`withholdAndLog` reason=`business_registered`).
- **기타소득 분리과세 한도**: 연 누계 300만원(`OTHER_INCOME_THRESHOLD = 3,000,000`) 초과 시 종합소득 합산 + 지급조서 제출. 사업소득은 누계 무관 reportable.
- 원천징수 발생 시점: 정산 송금(settlement_cash) / 교환권 발송(voucher_order) / 딜 환급(deal_redeem).

### 딜(포인트) 시스템
- 충전: **1원 = 1딜** (수수료 없음, 출처 `CLAUDE.md`)
- 최소 후원: 500딜

`[디자인 지시]` **수수료 비교표** — 유어딜 기본 5% 를 큰 숫자로. 세금 표(3.3%/8.8%)는 별도 박스. "사업자 등록 시 원천징수 면제" 를 강조 콜아웃. 경쟁사 비교는 §11 참조.

---

## 8. 라이브커머스 / 크리에이터 차별화

- **크리에이터 attribution / 추천 보상**: 라이브·링크샵·핀 추천을 통한 구매가 크리에이터에게 귀속(attribution) → 어필리에이트 보상 적립(핀 1.0%, 공구 양쪽 0.5%, 매장영입 1.5% 등). 성과형이라 크리에이터가 자발적으로 상품을 밀어줌.
- **멀티플랫폼 송출**: YouTube Live 즉시 가능(`available`). RTMP 인제스트로 OBS/Prism 호환. TikTok Live / 네이버 치지직 / SOOP(아프리카TV)는 Coming Soon(`eta` 2026 Q3~Q4, 출처 `multi-platform.routes.ts`).
- **쇼츠(숏폼)**: 9:16 세로 영상으로 상품을 바이럴 노출(`/shorts`).
- **라이브 운영 도구**: 라이브 생성/시작/종료, 실시간 채팅, 상품 오버레이, 라이브 분석(`SellerLiveAnalyticsPage`), 좀비 세션 복구·진단 endpoint.
- **방송 권한 역할 분리**: `canBroadcast()` — 크리에이터/겸업만 송출 가능, 매장 사장님은 매장 상품 등록 중심(출처 `seller-roles.ts`).

`[디자인 지시]` 라이브 방송 스크린샷 자리(9:16) + 송출 플랫폼 로고 + "성과형 크리에이터 보상" 흐름도(추천→구매→적립).

---

## 9. 상품 운영 도구

| 도구 | 근거 |
|---|---|
| **대량등록(CSV)** | `BulkUploadModal` — 한글 헤더 매핑, 미리보기, 성공/실패 카운트 + 오류 리포트 |
| **외부몰 연동** | Cafe24 OAuth 동기화(`cafe24.routes.ts`), `cafe24_product_map` 중복 방지 |
| **재고 관리** | `SellerInventoryPage`, 옵션별 재고(`옵션재고`), 결제 시 원자적 재고 차감 |
| **주문 관리** | `SellerOrdersPage`, 배송 추적(tracker.delivery 6시간 sync) |
| **통계 대시보드** | `SellerAnalyticsPage`, `SellerLiveAnalyticsPage`, `SellerRealtimeDashboardPage`, 정산 통계(`/settlements/stats`) |
| **이미지 최적화** | 도미넌트 컬러 placeholder, lazy-load, CF 이미지 리사이즈/Save-Data quality 조절 (출처 `cf-image.ts`) |
| **온보딩 부트캠프** | 7단계 가이드(프로필/첫상품/첫라이브/첫후원/첫결제/첫알림톡) 완료 시 보상 1만 딜 (출처 `seller-onboarding.routes.ts`) |
| **셀러 가이드** | `/seller/guide` (DB `operation_guides`) |

`[디자인 지시]` 셀러 대시보드 목업(라이트 테마 `#F4F5F7`) — 매출/주문/정산 카드 + 차트. CSV 업로드 모달 미리보기.

---

## 10. 신뢰 / 안전

- **결제 안전성**: 토스페이먼츠 V2 결제 — 5개 결제 흐름(충전/주문/공구/숙소/교환권)이 단일 SSOT(`toss-gateway.ts confirmTossPayment`)를 통해 처리. circuit breaker / idempotency-key / 금액 서버 재검증 자동. 결제 금액은 클라이언트 값 절대 신뢰 안 함.
- **사업자 검증**: 가입 시 국세청(NTS) 사업자번호 진위확인 비동기 검증(`seller-registration.routes.ts`). 현금 정산은 검증된 사업자만(412 게이팅).
- **환불 / CS 흐름**: 토스 환불 자동(최대 5회 재시도, 지수 backoff), 환불 시 커미션/공급정산 역전 처리(`returns.routes.ts` reverse 로직). 분쟁 24시간 미처리 시 어드민 escalation, 재발 매장/유저 임계값 모니터링(`REFUND_POLICY`).
- **보안 규칙**: 권한 검증(IDOR 방지), rate limit, Turnstile bot 방어, 에러 메시지 generic 처리(계정 enumeration 방지).

`[디자인 지시]` "토스페이먼츠 안전결제" + "국세청 사업자 검증" + "자동 환불/CS" 3개 신뢰 배지. 자물쇠/방패 아이콘.

---

## 11. 차별점 (경쟁사 대비)

> ⚠️ 경쟁사 수치는 모두 `[가정]` — 제안서에 넣을 경우 최신 공식 자료로 검증 필요.

| 항목 | 유어딜 | 네이버 스마트스토어 `[가정]` | 쿠팡 `[가정]` | 그립(GRIP) `[가정]` |
|---|---|---|---|---|
| 기본 판매 모델 | 쇼핑+라이브+링크샵 3채널 통합 | 진열형 오픈마켓 | 진열형 + 로켓배송 | 라이브 전용 |
| 플랫폼 수수료 | **5%** (기본) | 결제·연동 수수료 별도 `[가정]` | 카테고리별 상이 `[가정]` | 라이브 수수료 `[가정]` |
| 크리에이터 성과 보상 | 내장(핀/추천/영입 어필리에이트) | 제한적 `[가정]` | 제한적 `[가정]` | 라이브 호스트 중심 `[가정]` |
| 라이브 송출 | YouTube 즉시 + RTMP/OBS, 멀티플랫폼 로드맵 | 별도 `[가정]` | 별도 `[가정]` | 자체 앱 `[가정]` |
| 빠른 입점 | CSV + Cafe24 연동 | 자체 등록 `[가정]` | 자체 등록 `[가정]` | 자체 등록 `[가정]` |
| 정산/세금 | 자동 정산 + 원천징수(3.3%/8.8%) 자동 | 정산 시스템 `[가정]` | 정산 시스템 `[가정]` | 정산 시스템 `[가정]` |

**유어딜만의 한 줄 차별점:** "한 번 등록 → 3채널 동시 판매 + 크리에이터가 성과형으로 직접 팔아주는 구조."

`[디자인 지시]` 비교표는 유어딜 컬럼을 #FF0033 헤더로 강조. 경쟁사 셀은 회색. 표 하단에 `[가정] 표기 = 공식 자료 검증 필요` 주석 작게.

---

## 12. 온보딩 & 지원

- **가입 경로**: 셀러 등록(`/seller/register`, `SellerRegisterPage`), 카카오 로그인 연동(same-email 자동연결, verified 게이트), `/host/new` 호스팅 시작.
- **사업자 등록**: `SellerRegisterBusinessPage` / `SellerBusinessInfoPage` 에서 사업자정보 입력 → NTS 검증.
- **입점 문의**: `[확인 필요]` 전용 입점 문의 채널(이메일/카카오 채널) — 운영 연락처 확정 필요. 현재 코드상 명시된 일반 연락은 없음.
- **가이드**: 셀러 가이드 `/seller/guide` (DB `operation_guides`, 자동 코드참조 섹션 포함). 스트리밍 셋업 가이드(`SellerStreamingGuidePage`), 카카오 플친 가이드.
- **지원 채널**: `[확인 필요]` 고객지원/CS 채널 명시 필요.

`[디자인 지시]` "1. 가입 → 2. 사업자등록 → 3. 상품등록 → 4. 첫 판매" 4스텝 온보딩 + QR/링크 CTA.

---

## 13. 섹션별 슬라이드 카피 초안 (실제 카피)

| # | 슬라이드 | 헤드라인 | 서브카피 |
|---|---|---|---|
| 1 | 표지 | **상품 하나로, 3개 채널에서 팝니다** | 유어딜 온라인 상품 입점 제안서 |
| 2 | 문제 | **진열만으로는 안 팔리는 시대** | 노출 경쟁·광고비·낮은 전환 — 오픈마켓의 한계 |
| 3 | 솔루션(3채널) | **쇼핑 · 라이브 · 링크샵, 한 번에** | 상품 1건 등록 → 3채널 동시 노출·판매 |
| 4 | 판매자 혜택 | **크리에이터가 대신 팔아줍니다** | 성과형 보상으로 크리에이터가 자발적으로 추천·방송 판매 |
| 5 | 입점 절차 | **CSV 한 번, 또는 Cafe24 연동으로 끝** | 가입 → 사업자 자동검증 → 상품등록 → 판매 |
| 6 | 수수료 | **기본 수수료 5%, 그게 전부** | 매출 발생 시에만 — 셀러별 조정 가능, 사업자 등록 시 원천징수 면제 |
| 7 | 라이브 차별화 | **방송으로 팔고, 숏폼으로 퍼뜨립니다** | YouTube Live + RTMP/OBS, 쇼츠 바이럴 |
| 8 | 신뢰 | **결제·정산·세금, 자동으로 안전하게** | 토스페이먼츠 안전결제 · 국세청 사업자 검증 · 자동 환불 |
| 9 | 온보딩 | **오늘 가입하면, 오늘 등록합니다** | 셀러 가이드 + 7단계 부트캠프 지원 |
| 10 | CTA | **지금 입점하세요** | 유어딜과 함께 새 판매 채널을 여세요 |

`[디자인 지시]` 각 슬라이드 헤드라인은 18~28자 이내 한글. 숫자(5%, 3채널, 3.3%)는 별도 대형 타이포 처리.

---

## 14. 추천 비주얼 & 다이어그램

1. **3채널 퍼널 다이어그램** (§4) — 중앙 "상품 1건 등록" → 쇼핑/라이브·쇼츠/링크샵 3갈래 → 구매·정산. **덱의 핵심 비주얼.**
2. **입점 타임라인** (§6) — 6스텝 가로 타임라인, 상품등록에서 3갈래(개별/CSV/Cafe24) 분기.
3. **수수료 비교표** (§7, §11) — 유어딜 5% 강조 + 세금 표 + 경쟁사 비교(가정 표기).
4. **라이브 판매 스크린샷 위치** (§8) — 9:16 모바일 라이브 화면 + 상품 오버레이 + 송출 플랫폼 로고 라인.
5. **셀러 대시보드 목업** (§9) — 라이트 테마(`#F4F5F7`) 매출/주문/정산 카드 + 차트 + CSV 업로드 모달.
6. **링크샵 목업** (§4 채널③) — 다크 테마 크리에이터 프로필 + 추천 상품 그리드.
7. **신뢰 배지 라인** (§10) — 토스 / NTS 사업자검증 / 자동환불.

`[디자인 지시]` 비주얼은 실제 스크린샷 자리표시(placeholder)로 위치만 잡고, 캡션에 출처 페이지 경로(`/browse`, `/live`, `/seller/dashboard` 등) 명기.

---

## 15. FAQ (판매자) — 실제 정책 근거

1. **Q. 입점 수수료가 어떻게 되나요?**
   A. 기본 플랫폼 수수료는 매출의 **5%** 입니다(`COMMISSION_DEFAULTS.PLATFORM_FEE_PCT=5`). 셀러별로 어드민이 `sellers.commission_rate` 로 조정할 수 있습니다. 위탁판매는 별도(10%) 케이스가 있습니다.

2. **Q. 상품을 빠르게 많이 등록할 수 있나요?**
   A. CSV 대량등록(한글 헤더 매핑)과 Cafe24 외부몰 연동 동기화를 지원합니다(`BulkUploadModal`, `cafe24.routes.ts`).

3. **Q. 정산은 언제, 어떻게 받나요?**
   A. 전월 1일~말일 단위로 정산 신청(`/api/seller/settlements/request`) → 어드민 승인 후 송금됩니다. 최소 출금액은 10,000원입니다. 신청 시 PIN 인증이 필요합니다.

4. **Q. 사업자등록 없이도 정산받을 수 있나요?**
   A. **현금 정산은 사업자 검증(`verified`/`exempt`)이 필요**합니다. 미검증 시 교환권/포인트(딜)로 수령할 수 있습니다(412 `BUSINESS_REGISTRATION_REQUIRED`).

5. **Q. 세금(원천징수)은 어떻게 처리되나요?**
   A. 사업자 미검증 셀러는 사업소득 **3.3%**(default) 또는 기타소득 **8.8%**(단발성)가 원천징수됩니다. **사업자 검증 시 원천징수 면제**(세금계산서 발행). 기타소득은 연 300만원 초과 시 종합소득 합산 대상입니다.

6. **Q. 라이브 방송으로 팔 수 있나요?**
   A. 네. YouTube Live가 즉시 지원되며 RTMP/OBS로 송출합니다. TikTok·치지직·SOOP은 준비 중(2026 Q3~Q4 예정)입니다. 방송 권한은 크리에이터/겸업 역할에 부여됩니다.

7. **Q. 크리에이터가 내 상품을 어떻게 팔아주나요?**
   A. 크리에이터가 링크샵에 상품을 "핀(추천)" 하거나 라이브에서 판매하면, 발생한 구매가 크리에이터에게 귀속되어 성과형 보상이 적립됩니다(핀 1.0%, 공구 양쪽 0.5%, 매장영입 1.5% 등).

8. **Q. 결제는 안전한가요?**
   A. 토스페이먼츠 V2 결제를 단일 SSOT로 처리하며, 결제 금액은 서버에서 재검증합니다. 환불은 자동(최대 5회 재시도) 처리됩니다.

9. **Q. 배송/주문 관리는 어떻게 하나요?**
   A. 셀러 주문 관리 페이지(`SellerOrdersPage`)에서 주문을 처리하고, tracker.delivery 연동으로 배송이 6시간 주기로 자동 추적됩니다.

10. **Q. 사업자번호는 어떻게 검증되나요?**
    A. 가입 시 형식(`XXX-XX-XXXXX`) 검증 후, 대표자명·개업일을 제공하면 국세청(NTS) 진위확인을 비동기로 거쳐 자동 승인(`approved`)됩니다.

`[디자인 지시]` FAQ는 아코디언/Q&A 2열 카드. 4·5번(정산·세금)은 강조 박스.

---

## 16. CTA & 동선

- **주 CTA**: "지금 입점 신청하기" → 셀러 가입(`/seller/register`)
- **보조 CTA**: "셀러 가이드 보기" → `/seller/guide`, "상품 등록 데모" → `SellerProductNewPage`
- **동선**: 표지 → 문제 → 3채널 솔루션 → 혜택 → 입점절차 → 수수료/세금 → 라이브 차별화 → 신뢰 → 온보딩 → **CTA**
- `[확인 필요]` 입점 문의 연락처(이메일/카카오 채널/전화) — 운영 확정 후 CTA에 삽입.

`[디자인 지시]` 마지막 슬라이드 전면 CTA + QR코드(가입 링크) + 입점 문의 연락처 자리.

---

## 17. 디자인 톤

- **테마**: 화이트 쇼핑/셀러 라이트 테마 기반. 배경 `bg-white` / `bg-gray-50` / 대시보드 `#F4F5F7`.
- **포인트 컬러**: 유어딜 **#FF0033** (강조/CTA/핵심 숫자).
- **타이포**: 전문적 + 성장 지향. 헤드라인 굵게, 숫자(5%, 3채널, 3.3%) 대형 강조.
- **다크 활용**: 유저 대면 채널(라이브/링크샵) 목업은 다크 테마(`#020202`/`#121212`)로 실제 화면감 전달.
- **무드**: 신뢰감(결제·세금·검증) + 성장(매출·채널 확장). 과한 이모지/장식 지양, 데이터 기반 신뢰.

`[디자인 지시]` 전체 덱: 화이트 베이스 + #FF0033 포인트. 채널 목업만 다크로 대비. 숫자·통계는 항상 포인트 컬러 강조.

---

### 부록 — 핵심 수치 빠른 참조 (디자인 검증용)
| 수치 | 값 | 출처 |
|---|---|---|
| 플랫폼 기본 수수료 | 5% | `policy.ts PLATFORM_FEE_PCT` |
| 위탁 셀러 commission | 10% | `policy.ts SELLER_COMMISSION_PCT` |
| 후원 수수료 | 15% `[확인 필요]` | `CLAUDE.md` |
| 원천징수 (사업소득) | 3.3% | `tax-withholding.ts` |
| 원천징수 (기타소득) | 8.8% | `tax-withholding.ts` |
| 기타소득 분리과세 한도 | 300만원/년 | `policy.ts OTHER_INCOME_THRESHOLD` |
| 제휴 추천 보상 | 5% | `policy.ts AFFILIATE_COMMISSION_PCT` |
| 링크샵 핀 어필리에이트 | 1.0% | `policy.ts CURATOR_AFFILIATE_PCT` |
| 매장영입 commission | 1.5% | `influencer_store_intro_pct` |
| 최소 출금액 | 10,000원 | `policy.ts WITHDRAWAL_DEFAULTS.MIN_AMOUNT` |
| 딜 충전 비율 | 1원 = 1딜 | `CLAUDE.md` |
| 부트캠프 완료 보상 | 1만 딜 | `seller-onboarding.routes.ts` |
