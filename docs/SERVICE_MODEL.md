# 유어딜 서비스 모델 (SSOT)

> 2026-05-28 정리. 역할·커미션·정산 구조의 단일 진실원천.
> 캐치프레이즈: **"동네 핫플, 친구랑 공동구매"**

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
| 기간 제한 | `sellers.referral_bonus_until` (매장별, 어드민 설정. NULL=무기한) | group-buy.routes.ts:375 |

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

### ⚠️ 미처리 (확인 필요)
- **과거 데이터**: 이미 `seller:{user.id}` 로 적립된 `introduction_commission` ledger
  엔트리 + 잘못 생성된 payouts 가 있을 수 있음. 프로덕션 D1 조회 후 idempotent
  backfill (해당 유저에게 딜 재적립) 필요 여부 판단. 자동 금전 변경은 위험하므로
  데이터 양 확인 후 어드민 트리거로 처리 권장.

---

## 6. 매장 입점 (영업의 신뢰성)

영업자(유저/에이전시)가 매장 섭외 → 가입 시 **누가 영업했는지 검증·기록**:
- `seller_prospects`: 영업자가 "영업 중" 미리 등록 → 매장 가입 시 전화/사업자번호 자동 매칭 (`matchProspectOnSignup`)
- 3중 진위확인 (전부 무료): 국세청 사업자 진위확인(10K/day) + 네이버 플레이스(25K/day) + 사업자등록증 OCR(Cloudflare AI Vision 10K Neurons/day)
- 매칭 시 `introduced_by_*_id` 기록 → 영입 commission 흐름 시작

### 공구 등록 2경로
1. 매장 직접 (store_owner)
2. 영업자 대행 — ⚠️ **충돌 주의**: `products.seller_id` 는 **항상 매장**이어야 함
   (정산·QR 기준). 대행 시 `registered_by_*` 별도 기록 (미구현).

---

## 7. 어드민 매장별 커미션 설정 (2026-05-28 구현)

- `GET/PATCH /api/admin/sellers/:id/commission-settings`
- `referral_bonus_until` 매장별 기간 (NULL=무기한 / 날짜=만료) + `commission_rate`
- 영입 에이전시/인플루언서 JOIN 표시 (`agency_name` / `influencer_handle`)
- ledger 양쪽(`recordAgencyCommissionShare` / `recordIntroductionCommissionShare`)에 기간 체크 반영

---

## 8. 미정/향후 (우선순위)

1. **(P0) 과거 ledger 데이터 backfill** — §5 미처리 참조
2. **(P1) 유저 사업자 등록** — `users` 에 business_number/status 추가 → 영입 commission 현금+원천징수 분기
3. **(P1) 어드민 UI** — commission-settings 엔드포인트용 화면 (매장별 기간 + 영입자 표시)
4. **(P2) 셀러 대시보드 "내가 영입한 매장" 화면** — 에이전시(`AgencyIntroducedStoresPage`) 대칭. 단 영입자=유저 모델이면 마이페이지에 둘지 재검토
5. **(P2) 가입 진입 분기** — "🏪 매장 / 🎤 방송·홍보" 2갈래
6. **(P3) 명칭 정리** — `seller-roles.ts` `인플루언서` → `크리에이터` (큐레이터와 구분)
7. **(P3) 대행 등록** — `products.registered_by_*` + 매장 승인

> 모든 항목은 무료($0) 제약 유지.
