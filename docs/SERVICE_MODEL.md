# 유어딜 서비스 모델 (SSOT) — v2

> 2026-05-28 정리 (v2: 외부 리뷰 반영 — Creator 명칭 / 기간 차등 / backfill 안전절차).
> 역할·커미션·정산 구조의 단일 진실원천.
> 캐치프레이즈: **"동네 핫플, 친구랑 공동구매"**

## 🎯 주력 = 공동구매 (2026-05-28 전략 결정)
- **공동구매(group-buy)가 주력 서비스.** 라이브커머스(방송)는 보조 수단(크리에이터 홍보 채널).
- 모든 설계·우선순위는 공동구매 플로우(매장 공구 등록 → 추천/영입 → 구매 → QR 사용 → 정산)를 1순위로.
- 방송 관련 기능은 유지하되 신규 투자/복잡도는 공동구매에 집중.

## 역할 정의 (용어 SSOT)

### 🏷️ 사용자-가시 명칭 (2026-06-17 사용자 확정 — 무조건 이걸로)
- **유저**: 회원가입한 누구나. 링크샵(`/u/{handle}`) 자동 생성. 추천(핀)·구매.
- **사업자 유저**: 유저 + 사업자등록 → 판매 승인. 자기 상품·공구권 판매 + 현금 정산. (능력이 *추가*된 것 — 신분 교체 아님)
- **셀러 대시보드**: 사업자 유저가 쓰는 판매 관리 도구(`/seller/*`). "셀러"는 도구 이름으로만 유지.
- ❌ 사람 지칭에 "큐레이터/크리에이터/인플루언서/셀러/판매자" 사용 금지(신규 문구).

### 내부 코드 매핑 (식별자는 유지 — 리네임 X)
- **Store Owner**: `seller_type='store_owner'`. 사업자 유저(판매)의 주력 실체. 셀러 대시보드. 현금 정산.
- **influencer (레거시)**: `seller_type='influencer'` (값 유지). 과거 방송/홍보 셀러 → 라이브 영구중단으로 휴면. 추천은 이제 모든 **유저**(핀)가 함.
- **Agency (에이전시)**: 조직 단위 관리자. `agencies`. 여러 매장/사람 관리. (B2B 별도 축)
- **도매 공급자(제조사)**: 도매몰 공급 B2B. (별도 축)
- 코드 식별자(`CuratorPage`/`curator.routes`/`sellers`)는 그대로 — 사용자-가시 라벨만 위 명칭 적용.

이 문서는 여러 세션에 걸친 역할 모델 논의의 결론을 고정한다. 역할/커미션 관련
변경 전 반드시 이 문서를 먼저 읽고, 변경 시 함께 갱신한다.

---

## 1. 핵심 원칙: "신분"이 아니라 "능력"

역할을 상호배타적 신분으로 모델링하지 않는다. 한 계정이 여러 능력을 쌓을 수 있다.

| 능력 | 누가 | 데이터 | 보상 |
|---|---|---|---|
| **공급 (매장 운영)** | 매장 사장님 | `sellers` (`seller_type='store_owner'`) | 매출 현금 정산 (수수료 5% 차감) |
| **방송 (라이브 송출)** | 셀러 | `sellers` (`canBroadcast`) | — (홍보 수단) |
| **영입 (매장 섭외)** | 유저 **또는** 에이전시 | `introduced_by_influencer_id`(=users.id) / `introduced_by_agency_id`(=agencies.id) | 플랫폼 수수료의 일정 % |
| **추천 (공구 홍보)** | 모든 유저(큐레이터) | `product_pins`, `?ref=` | affiliate commission |
| **관리 (남의 셀러 운영)** | 에이전시 | `agencies` + `agency_members` | override |

→ **영입은 유저·에이전시 둘 다 가능한 공유 능력.** 인플루언서가 영입을 해도
에이전시와 충돌하지 않는다 (컬럼이 분리돼 있음).

---

## 2. 액터 3개 (공동구매 기준 — 방송 제외하고 보면 단순)

```
① 매장        → 셀러 대시보드 (/seller/*)   공구 등록 · QR 사용확인 · 현금 정산   [매장 전용]
② 유저(큐레이터) → 마이페이지 + /u/{handle}    공구 추천(추천 commission) · 매장 영입(영입 commission)
③ 에이전시     → 에이전시 대시보드 (/agency/*) 여러 매장·사람을 "조직으로 관리"할 때만
```

### "인플루언서"의 정체
- 방송을 빼고 보면 **인플루언서 = 영입·추천을 활발히 하는 유저(큐레이터)** 일 뿐이다.
- 별도 신분/대시보드가 본질적으로 필요 없다. 마이페이지 + 공개페이지로 충분.
- `introduced_by_influencer_id` 가 **users.id** 를 가리키는 것이 이 모델의 증거.
- 라이브 방송 기능 때문에 현재 `seller_type='influencer'` 가 존재하지만, 공동구매
  관점에선 vestigial. 신규 흐름은 영입자를 유저로 취급한다.

### "셀러 = 매장" 지향
- 사용자 결정: 셀러 대시보드는 매장 업주 중심으로 의미를 좁힌다.
- 단, 라이브 방송이 `seller_id` 에 묶여 있어 물리적 분리/마이그레이션은 **위험 높음**.
- → 신규 가입 진입 분기 + 명칭 정리(표면)로 사용자 체감 달성. 내부 구조는 그대로.

---

## 3. 커미션 2종 (헷갈리기 쉬움 — 명확히 구분)

| | 영입 commission | 추천 commission |
|---|---|---|
| 누가 받나 | 매장을 데려온 유저/에이전시 | 공구 링크 공유한 유저 |
| 트리거 | 그 매장의 **모든** 공구권 사용 | `?ref=` / 핀 클릭으로 산 **그 건** |
| 분배율 | `platform_settings.influencer_intro_share_pct`(20%) / `agency_share_pct`(30%) | affiliate 설정 |
| 저장 (유저) | `user:N` ledger + **딜 즉시 적립** | `influencer_attributions` / `product_pins` |
| 저장 (에이전시) | `agency:N` ledger + `agency_store_intro_commissions` | — |
| 기간 제한 | `sellers.referral_bonus_until` (매장별, 어드민 설정) | group-buy.routes.ts:375 |
| 기본 기간 (영입) | **에이전시 12개월 / 크리에이터(유저) 6개월** (가입 매칭 시 자동, 어드민 재설정 가능) | seller-registration.routes.ts:188 |

---

## 4. 정산: 사업자 = 현금, 비사업자 = 상품권/딜

| 수령자 | 사업자 여부 | 지급 방식 |
|---|---|---|
| 매장 (`sellers`) | 사업자등록 필수 | 현금 + 원천징수 (`tax_type`: business 3.3% / other 8.8%) |
| 에이전시 (`agencies`) | 조직 | 현금 (`agency:N` → payouts cron) |
| 유저 (`users`) — **현 상태** | 사업자 플래그 **없음** | **전원 딜/상품권** (`user_points` 즉시 적립) |
| 유저 — **향후** | 사업자 등록 추가 시 | 사업자 → 현금+원천징수 / 비사업자 → 딜 |

### 딜 적립 패턴 (`signup-bonus.ts` 와 동일)
```
user_points UPSERT (balance += amount) + point_transactions INSERT (type, amount, description)
```

---

## 5. ✅ 해결된 ledger 불일치 (2026-05-28)

**버그**: `recordIntroductionCommissionShare` 가 영입 commission 을
`credit_account = seller:${introduced_by_influencer_id}` 로 적립했는데,
`introduced_by_influencer_id` 는 **users.id**. `payouts-generate.ts` 는
`seller:%` 를 `sellers WHERE id=?` 로 조회 → users.id ≠ sellers.id 라서
**commission 증발 또는 우연히 같은 번호의 다른 seller 에게 오송금.**

**증거 체인**:
- `seller-prospects.routes.ts:66` — `introducer_id = String(user.id)`
- `seller-registration.routes.ts:188` — `introduced_by_influencer_id = users.id`
- `seller-profile.routes.ts:473` — `FROM users WHERE id = ?` (user 맞음)
- `ledger.ts:315` (이전) — `credit_account: seller:${userId}` ❌
- `payouts-generate.ts:62` — `FROM sellers WHERE id = {userId}` ❌

**fix** (`ledger.ts` `recordIntroductionCommissionShare`):
1. `credit_account` → `user:${influencerUserId}` (namespace 정정, payouts cron 이 더 이상 오조회 안 함)
2. 영입 commission 을 **딜로 즉시 적립** (user_points + point_transactions, 비사업자 정책)
3. 매장별 기간 체크(`referral_bonus_until`) 유지

### 과거 데이터 보정 (✅ 안전 절차 구현)
- **GET `/api/admin/intro-commission-audit`** — 읽기 전용. 영향받은 유저 목록 +
  금액 합계 + 오송금(seller payout) 여부 조회. **자동 변경 없음.**
- **POST `/api/admin/intro-commission-backfill`** — `confirm=true` 필수. 선택적
  `user_id`. idempotent (멱등 마커 `{ref}:reconciled`). 유저 없으면 skip.
- 절차: 먼저 audit 조회 → 금액 확인 → 필요 시 user_id 별로 backfill 트리거.

---

## 6. 매장 입점 (영업의 신뢰성)

영업자(유저/에이전시)가 매장 섭외 → 가입 시 **누가 영업했는지 검증·기록**:
- `seller_prospects`: 영업자가 "영업 중" 미리 등록 → 매장 가입 시 전화/사업자번호 자동 매칭 (`matchProspectOnSignup`)
- 3중 진위확인 (전부 무료): 국세청 사업자 진위확인(10K/day) + 네이버 플레이스(25K/day) + 사업자등록증 OCR(Cloudflare AI Vision 10K Neurons/day)
- 매칭 시 `introduced_by_*_id` 기록 → 영입 commission 흐름 시작

### 공구 등록 2경로
1. 매장 직접 (store_owner)
2. 영업자 대행 — `products.seller_id` 는 **항상 매장** (정산·QR 기준). 등록자만 별도 기록.

**대행 등록 설계** (컬럼 ✅ 추가, 플로우 UI 미구현):
- `products.registered_by_user_id` / `registered_by_agency_id` — 누가 대신 올렸나
- `products.registration_approved` — 0(대행, 매장 승인 대기) / 1(매장 직접 or 승인됨)
- 규칙: 대행 등록 시 `seller_id`=대상 매장 강제, `registered_by_*`=호출자,
  `registration_approved=0`. 매장이 승인하면 1 → 노출. 승인 전 비노출.
- 권한: 호출자가 그 매장의 introducer(`introduced_by_*`)여야 대행 가능 (IDOR 방지).

---

## 7. 어드민 매장별 커미션 설정 (2026-05-28 구현)

- `GET/PATCH /api/admin/sellers/:id/commission-settings`
- `referral_bonus_until` 매장별 기간 (NULL=무기한 / 날짜=만료) + `commission_rate`
- 영입 에이전시/인플루언서 JOIN 표시 (`agency_name` / `influencer_handle`)
- ledger 양쪽(`recordAgencyCommissionShare` / `recordIntroductionCommissionShare`)에 기간 체크 반영

---

## 8. 진행 상태 (2026-05-28)

### ✅ 완료
- 과거 ledger backfill **안전 절차** (audit GET + 수동 backfill POST) — §5
- 유저 사업자 등록 (스키마 + ledger 분기 + curator `/me/business` + CuratorEarningsPage UI) — §4
- 영입 commission 기간 차등 기본값 (에이전시 12개월 / 크리에이터 6개월) — §3
- 명칭 정리 (`seller-roles.ts` 라벨 `인플루언서` → `크리에이터`)
- 어드민 commission-settings 엔드포인트 (GET/PATCH) — §7
- 어드민 매장별 커미션 관리 + audit UI (`/admin/merchant-commissions`)
- 크리에이터 "내가 영입한 매장" 화면 (CuratorEarningsPage)
- 가입 진입 분기 랜딩 (`/join`)
- 대행 등록 end-to-end (스키마 + Creator 등록 폼 + 매장 승인 `/seller/proxy-products`) — §6

### ✅ 완료 (P3)
- 유저 사업자 수동 승인 — `/admin/merchant-commissions` 하단 섹션 +
  `GET /api/admin/pending-business-users`, `POST /api/admin/users/:id/business-approve|reject`
- 정산 rail 통합 **검토 → 분리 유지 결정** (아래)

### 정산 rail 결정 (P3-2 검토 결과: 분리 유지)
두 rail 은 경제적 의미가 달라 **의도적으로 분리** 유지한다:
| rail | 대상 | 저장 | 정산 |
|---|---|---|---|
| 영입 commission | 매장 영입 (장기, 매장 매출 share) | ledger `user:`/`userdeal:` | 사업자 현금(주간 push) / 비사업자 딜 즉시 |
| 추천 commission | 공구 링크 추천 (건별) | `affiliate_earnings` | `/me/withdrawal` (pull) |
- 단일화는 마이그레이션 위험 大 + 1인 운영 부담. 대신 **CuratorEarningsPage 가 양쪽을 함께 노출** (추천 잔액 + 영입 매장/커미션) → 사용자 체감 통합.
- 향후 진짜 필요 시점(거래량 증가)에 재검토.

---

## 9. 정산 통합 (forward-only) — 목표 + 진행

### 목표 (가장 심플한 모델)
> **"누가 매출을 만들었나 → 그 사람 잔액에 +. 사업자면 현금, 아니면 딜."**

장부 1개(`ledger_entries`) + 잔액 1개 + 지급방식 1플래그(`payout_method` = cash|deal).
운영자가 신경 쓸 건 하나: 각 payee 의 잔액, 사업자 여부.

### 현재 산재한 시스템 (통합 대상)
| 시스템 | 상태 |
|---|---|
| `ledger_entries` (user:/userdeal:/seller:/agency:/merchant:) | ✅ 통합 목표 장부 |
| `affiliate_earnings` → `user_withdrawals` (추천) | 🔒 payment.routes.ts(Toss 잠금)에서 적립 — 통합 시 잠금 해제 필요 |
| `influencer_balances` / `influencer_attributions` | 레거시 (group-buy.routes.ts) |
| `agency_store_intro_commissions` | 레거시 (월배치) |
| `user_points` (딜) | 비사업자 지급 수단 (유지) |

### 진행 (forward-only — 위험 0)
- ✅ **통합 크레딧 SSOT `creditUserCommission()`** (ledger.ts) — 현금/딜 분기를 단 한 함수로.
  영입 commission 이 이를 통해 적립. 신규 유저 commission 은 전부 이 helper 경유.
- ⬜ 추천(affiliate) 통합 → `creditUserCommission` 호출로 전환. **단 payment.routes.ts 잠금**
  이라 사용자 명시 승인(`[UNLOCK]`) 후 진행. 그때까지 affiliate_earnings 는 레거시로 read 유지.
- ⬜ 레거시 잔액 소진 후 `influencer_balances` / `agency_store_intro_commissions` 코드 제거.
- 원칙: **기존 데이터 마이그레이션 금지. 신규만 통합 경로. 레거시는 자연 소진.**

> 모든 항목은 무료($0) 제약 유지.
