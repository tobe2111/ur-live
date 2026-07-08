# 벤더 커미션 Pass-through 분할 (설계 — 구현 파킹)

> 상태: **설계만 / 구현 파킹.** 실제 벤더사 1곳이 유어딜로 옮겨올 의사를 보이면, **그 벤더의 실제 분배 방식에 맞춰** 착수한다. 머니 경로 신설이라 착수 시 **단독 세션 + staging 실결제 검증** 필수(잠금 파일 규칙 준수).
>
> 관련 SSOT: `docs/design/commission-funding-restructure.md`([INV-CB] 예산 아비터), 코드 `src/worker/utils/order-commissions.ts`(오케스트레이터), `src/worker/utils/commission-budget.ts`(아비터).

---

## 1. 배경 / 목적

기존 인플루언서 공동구매를 운영하는 **벤더**(여러 인플루언서에게 상품을 뿌리고 각각 정산해 주는 중간 조직)를 유어딜 파트너로 데려오려 한다. 벤더의 비즈니스 모델 핵심은 **"내가 받은 커미션에서 인플에게 몫을 떼 주고 나머지를 보유"** 하는 pass-through 구조다(예: 벤더가 20% 받아 인플에게 15% 주고 5% 보유).

**현재 유어딜(A):** 인플루언서 커미션은 인플에게 **직접** 지급된다(핀 어필리에이트·`seller_influencer_deals` 관계 요율·`influencer_intro`). 벤더가 자기 몫에서 인플에게 떼 주는 경제가 표현되지 않는다 — 에이전시 커미션과 인플 커미션이 **서로 무관한 별도 재원**으로 병렬 적립될 뿐이다.

**이 설계(B):** 인플루언서가 벤더에 **소속됐는지**에 따라 자동 분기한다.
- **무소속** → promo 커미션이 인플루언서에게 **직접**(= 현행 A, byte-불변).
- **벤더 소속** → promo 커미션이 **벤더 풀**로 가고, **벤더 설정대로** 인플루언서에게 분배(= B). 벤더는 자기 몫을 보유.

**A를 폐지하지 않는다.** B를 A 위에 얹어, **하나의 경로에서 소속 여부로만 갈리게** 한다.

---

## 2. 핵심 설계 원리

### 2.1 예산 중립 (가장 중요)

아비터([INV-CB], `order-commissions.ts` `budgetedCreditForOrder`)가 인플루언서 축에 배정한 금액 **C**는 이미 "이 주문에서 인플이 받을 커미션 총액"이다. **B는 C의 크기를 바꾸지 않는다** — C를 **풀**로 삼아 수령자만 나눈다:

```
소속 아님:  인플에게 C            (현행 A)
소속 있음:  인플에게 round(C × p) + 벤더에게 (C − round(C × p))   (B, 합 = C)
```

→ Σ커미션이 불변이므로 **예산(플랫폼 수수료 − PG준비금)·[INV-CB] 불변식·`commission_budget_logs`가 전혀 영향받지 않는다.** B는 새 **예산 축이 아니라**, 이미 배정된 축의 **재라우팅**이다. (이 점이 아비터 가드 `check-commission-budget.mjs`와의 충돌을 원천 차단한다 — §7.)

### 2.2 얹는 지점 (single choke point)

`order-commissions.ts`의 인플루언서 커미션 적립 직전/직후에 **라우팅 함수 1개**를 삽입한다. 인플 축이 실제로 사용하는 두 경로 모두에서:

- 게이트 OFF 경로 `legacyCredit()` — 현행 인플 적립 헬퍼 호출부.
- 게이트 ON 경로 `budgetedCreditForOrder()` — `granted('...')` 배정액을 넘기는 호출부.

두 곳 모두 "인플에게 금액 X를 적립" 하는 지점에서 `routeInfluencerCommission()`을 경유하게 한다. 이 함수가 소속 판정 후 A(직접) 또는 B(분할)로 갈린다.

---

## 3. 소속 신호 — "인플루언서가 벤더에 소속됐는가"

### 3.1 판정 소스 (resolver)

신규 순수함수 `resolveInfluencerVendor(DB, influencerRef) → { vendorId } | null`:

| 소속 케이스 | 소스 | 비고 |
|---|---|---|
| 인플이 셀러(사업자 유저)이고 에이전시 소속 | `agency_sellers(agency_id, seller_id)` | 기존 테이블 재사용 |
| 인플이 순수 큐레이터(user만, 셀러 행 없음) | **신규** `agency_influencers(agency_id, influencer_user_id, status, joined_at, terms)` | 어필리에이트 축이 `user_id`로 적립하므로 이 identity로 매핑 필요 |

- **활성 게이트:** `status='active'` + (선택) 계약기간 내인 소속만 인정. 소속 해지·만료 후 주문은 A로 폴백.
- **다중 소속 방지:** `agency_influencers`는 `UNIQUE(influencer_user_id)` 부분 유니크(활성 1건). 이미 있는 `idx_sellers_linked_user_unique` 패턴 준용.
- **우선순위(둘 다 매칭 시):** 명시적 `agency_influencers` > `agency_sellers`. (결정 포인트 — §11.)

> ⚠️ **열린 결정:** 큐레이터-only 인플의 소속을 어떻게 승인/관리할지(벤더가 초대→인플 수락? 어드민 등록?)는 실벤더의 실제 온보딩 방식에 맞춰 확정. 이미 있는 `agency-invites.routes.ts`/`agency-members.routes.ts`(내부 팀 멤버)와는 **다른 축**임에 주의 — 멤버=벤더 조직 스태프, 인플=벤더가 상품을 뿌리는 판매 파트너.

---

## 4. 분배 설정 — per-vendor 기본 + per-promo(딜 단위) 오버라이드

### 4.1 테이블 (신규) `vendor_commission_splits`

```
vendor_commission_splits(
  id INTEGER PK,
  vendor_id INTEGER NOT NULL,           -- agencies.id
  product_id INTEGER,                    -- NULL = 벤더 기본 / 값 = 그 딜(promo) 전용 오버라이드
  influencer_ref TEXT,                   -- NULL = 소속 인플 공통 / 값 = 특정 인플 전용
  influencer_pct REAL NOT NULL,          -- 풀 C 중 인플루언서 몫 % (나머지 = 벤더 보유)
  status TEXT NOT NULL DEFAULT 'active',
  starts_at DATETIME, ends_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now'))
)
```

### 4.2 요율 해석 우선순위 (specific → general)

```
1. (vendor, product_id, influencer_ref)   -- 이 벤더·이 딜·이 인플 전용
2. (vendor, product_id, NULL)             -- 이 벤더·이 딜 공통
3. (vendor, NULL, influencer_ref)         -- 이 벤더·이 인플 공통(관계 단위)
4. (vendor, NULL, NULL)                    -- 벤더 기본
5. platform_settings.vendor_default_influencer_pct  -- 전역 폴백
```

- 순수함수 `resolveVendorSplitPct(DB, vendorId, productId, influencerRef) → pct`. 유닛테스트 대상.
- **캡:** `influencer_pct ∈ [0,100]`. 기존 `max_influencer_commission_pct`(`platform_settings`) 재사용해 벤더가 과도 배분 못 하게(또는 벤더 보유 최소 보장) 가드.
- **per-promo가 딜 단위 오버라이드의 실체** — 벤더가 특정 공구는 인플에게 더/덜 주도록 딜별 설정.

> ⚠️ **열린 결정:** 분배 단위를 "%"로만 할지, "정액 + %" 혼합·계층(벤더→서브벤더→인플)까지 갈지는 실벤더 방식에 맞춰 확정. MVP는 **단일 계층 %** 권장.

---

## 5. 적립 흐름 (라우팅 함수)

신규 `routeInfluencerCommission(DB, order, influencerRef, poolKrw, ctx)`:

```
1. poolKrw ≤ 0 → return (no-op)
2. vendor = resolveInfluencerVendor(DB, influencerRef)
3. vendor 없음(A):
     creditInfluencerDirect(order, influencerRef, poolKrw)      // 현행 헬퍼 그대로
     return
4. vendor 있음(B):
     pct  = resolveVendorSplitPct(DB, vendor.id, order.product_id, influencerRef)
     infl = round(poolKrw × pct / 100)
     keep = poolKrw − infl                                       // 합 = poolKrw (예산 중립)
     [CAS 선점] vendor_commission_splits_ledger claim (order, influencerRef, vendor) — 멱등
     creditInfluencerDirect(order, influencerRef, infl)          // 인플 몫 (기존 원장/헬퍼 재사용)
     creditVendorMargin(order, vendor.id, keep, influencerRef)   // 벤더 보유분 (신규 원장 크레딧)
```

- **인플 몫은 기존 적립 헬퍼/원장을 그대로 재사용** — 인플 입장에선 "덜 받는" 것 외 동일(조회 UI 무변경).
- **벤더 보유분은 신규 크레딧** — `ledger_entries`에 `credit_account='agency:{vendorId}'`, `event_type='vendor_passthrough_keep'`, `order_id` 멱등. 기존 에이전시 payout 파이프(`payouts-generate`)가 자동 픽업 → 별도 지급 로직 불필요.

---

## 6. 멱등 · 역전(환불) 대칭 (머니 룰 필수)

CLAUDE.md 💸 머니 룰 4종 전부 적용:

1. **Claim-before-credit:** 분할 side-effect 앞에 `UPDATE ... status CAS` 또는 `INSERT OR IGNORE` 선점.
2. **적립-역전 대칭 (같은 커밋에):** 신규 크레딧(벤더 보유분·인플 축소분) 각각에 역전 함수를 만들고 **`order-refund.ts`(전액) + `returns.routes.ts`(부분 비례)** 양쪽에 배선. 환불 시 **인플 몫 debit + 벤더 보유분 debit** 대칭 역전.
3. **멱등 = UNIQUE + INSERT OR IGNORE:** `UNIQUE(order_id, influencer_ref, vendor_id)` — /confirm·webhook 양경로 이중 도달에도 1회. (오케스트레이터가 이미 확정경로 단일화했으므로 자연 정합.)
4. **부분환불 비례:** 풀 C가 비례 축소되면 인플·벤더 몫도 같은 비율로 역전(현행 커미션 clawback 패턴 준용 — `helpers.ts clawbackVoucherCommission` 계열).

---

## 7. 예산 아비터 [INV-CB] · 가드와의 관계

- **새 예산 축이 아니다.** B는 이미 아비터가 배정한 인플 축 금액(C)을 재라우팅할 뿐 → `computeCommissionBudget`/`allocateCommissions`/`assertCommissionBudgetInvariants` **무변경**. Σ지출 불변.
- **가드 `check-commission-budget.mjs`:** 벤더 보유분 크레딧이 "아비터 우회 신규 적립"으로 오탐되지 않도록, 벤더 크레딧을 **오케스트레이터 내부(`routeInfluencerCommission`)에서만** 발생시키고 새 축 INSERT로 만들지 않는다. 필요 시 가드에 "pass-through 재라우팅은 예산 중립" 화이트리스트 주석/규칙 추가.
- **`only` 필터·`priorityKeys`·게이트 OFF 경로** 전부 그대로 동작. B는 인플 적립 호출부에만 얹힌다.

---

## 8. A 보존 + 게이트

- **신규 게이트 `platform_settings.vendor_passthrough_enabled`(기본 OFF).** OFF면 `routeInfluencerCommission`이 무조건 A(직접) — **현행과 byte-동일.**
- **무소속 인플은 게이트 ON이어도 A.** 소속 인플만 B. → 점진 롤아웃(벤더 1곳부터).
- 롤백: 게이트 OFF → 즉시 현행. 코드 보존(가역).

---

## 9. 세무 정합 (놓치면 안 됨)

Pass-through는 **수령자**를 바꾸므로 앞선 세무 자동화(원천징수/세금계산서)가 **양쪽 다리 모두**에 적용돼야 한다:

- **인플 몫** = 인플 소득 → 개인이면 원천징수(`withholdAndLog`), 사업자면 세금계산서 대상. (현행 그대로, 금액만 축소.)
- **벤더 보유분** = 벤더(에이전시, 대개 사업자) 매출 → 세금계산서 대상. 신규 크레딧이 `agency:{id}` 원장 → 기존 에이전시 정산/세무 파이프가 픽업.
- **세무사 월별 export**(PR #477)에 벤더 보유분·인플 몫이 각 payee 유형으로 자연 집계됨(별도 작업 최소).

---

## 10. 규모 산정 (이게 얼마나 큰 개발인가)

**총 ≈ 10~14 개발일 (약 2~3주)** — 머니 경로 신설이라 신중/검증 비중이 큼. 단계 분리 권장:

| 구성요소 | 작업 | 규모 | 리스크 |
|---|---|---|---|
| 데이터 모델 | `agency_influencers` + `vendor_commission_splits` + repair-schema + baseline/가드 | ~1일 | 낮음 |
| 순수함수 | `resolveInfluencerVendor` + `resolveVendorSplitPct` + 유닛테스트 | ~1일 | 낮음 |
| **오케스트레이터 통합** | `routeInfluencerCommission` + `order-commissions.ts` 2경로(legacy/budgeted) 삽입, **게이트 OFF 시 A byte-불변** 보장 | ~2일 | **높음**(머니 경로·아비터 상호작용) |
| 원장/적립 | 벤더 보유분 크레딧 + 멱등(UNIQUE) + payout 픽업 확인 | ~1일 | 중 |
| **역전 대칭** | `order-refund.ts` + `returns.routes.ts` 전액/부분 비례 역전 | ~1~1.5일 | **높음**(비대칭 시 미수/과지급) |
| 세무 정합 | 양 다리 원천징수/세금계산서 배선 확인 | ~0.5~1일 | 중 |
| 벤더 대시보드 UI | 분할 설정 CRUD(기본+딜별) + 풀→분배 조회 | ~2~3일 | 낮음(기존 Agency* 페이지에 additive) |
| 인플 조회 UI | 자기 몫 표시(벤더 경유 표기) | ~0.5~1일 | 낮음 |
| 가드/테스트/롤아웃 | `check-commission-budget.mjs` 정합 + 통합테스트 + **staging 실결제** | ~1~1.5일 | 중 |

**단계화:**
- **Phase 1 (MVP, ~5~6일):** per-vendor 기본 % 1종 + 어필리에이트(핀) 축만 + 게이트 OFF 기본 + 역전 + staging. "벤더 1곳 실증"에 충분.
- **Phase 2 (~4~5일):** per-promo(딜별) 오버라이드 + per-관계 요율 + 세무 양다리 + 다축(influencer_intro 등).
- **Phase 3 (~2~3일):** 대시보드 설정/조회 폴리시 + 인플 투명성 UI.

---

## 11. 열린 결정 (착수 전 실벤더 확인 항목)

1. **소속 identity:** 실벤더의 인플이 사업자 유저(셀러 행 보유)인지 순수 큐레이터인지 — `agency_sellers` 재사용 vs 신규 `agency_influencers`. → 실벤더 온보딩 방식에 맞춰 확정.
2. **분배 모델:** % 단일 계층인지, 정액/혼합/다계층(벤더→서브벤더→인플)인지.
3. **분배 단위:** 딜별(product) / 관계별(influencer) / 벤더 기본 중 실제로 쓰는 조합.
4. **소속 승인 흐름:** 벤더 초대→인플 수락 / 어드민 등록 / 자동.
5. **캡 정책:** 인플 최소 보장? 벤더 보유 상한? (`max_influencer_commission_pct` 재사용 범위)
6. **커버 축:** 어필리에이트(핀)만인지 `influencer_intro`·`seller_influencer_deals`까지인지.

> **원칙:** 위는 실벤더의 실제 분배 방식이 정해지기 전까지 **확정하지 않는다.** 스키마는 유연하게(NULL=공통 오버라이드) 설계했으므로, 실벤더 방식에 맞춰 값/우선순위만 채우면 된다.

---

## 12. 구현 체크리스트 (파킹 — 착수 시 단독 세션)

- [ ] `agency_influencers` / `vendor_commission_splits` + repair-schema + 컬럼 baseline
- [ ] `resolveInfluencerVendor` / `resolveVendorSplitPct` 순수함수 + 유닛테스트
- [ ] `routeInfluencerCommission` + `order-commissions.ts` 2경로 삽입(게이트 OFF=A byte-불변)
- [ ] 벤더 보유분 `ledger_entries` 크레딧 + `UNIQUE(order,influencer,vendor)` 멱등
- [ ] 역전: `order-refund.ts`(전액) + `returns.routes.ts`(부분 비례)
- [ ] 세무 양다리(원천징수/세금계산서) 배선 확인
- [ ] 게이트 `vendor_passthrough_enabled`(기본 OFF)
- [ ] `check-commission-budget.mjs` 정합(예산 중립 재라우팅 인식)
- [ ] 벤더/인플 대시보드 additive UI
- [ ] **staging 실결제 검증**: 소속 인플 주문 → 풀 분할(인플 몫 + 벤더 보유) Σ=C, 환불 시 양다리 역전, 무소속 인플 = 현행 A 동일

---

## 구현 로그

- 2026-07-08 설계 초안 작성(파킹). 구현 미착수 — 실벤더 확정 대기.
