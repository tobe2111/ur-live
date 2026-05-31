# 공동구매 = 즉시판매 모델 (이상적 구현 설계안)

**작성**: 2026-05-30 · **상태**: 🟡 설계 확정 대기 (구현 전)
**결정 출처**: 사용자 — "즉시판매 전환이 가장 이상적으로 구현되길 바래. 근데 나는 이걸 공동구매라고 꼭 부르고싶어."

---

## 0. 한 줄 요약

**경제 구조는 즉시판매**(결제 즉시 교환권 확정 발급, 환불 마찰 0, 목표 미달이어도 유효),
**이름·경험은 "공동구매"**. 사용자가 가격 모델로 **"그룹가 즉시 단일 적용"** 을 선택.

→ 핵심 작업: 지금의 **"인원 늘수록 깎이는 동적 tier"** 를 제거하고 **단일 고정 공구가** 로 전환.
   인원 카운터·목표·마감은 **가격 게이트가 아니라 소셜 증거·긴장감 연출**로 재정의.

---

## 1. 확정된 결정 (사용자 지시)

| # | 결정 | 근거 |
|---|---|---|
| D1 | 이름은 **"공동구매"** 유지 | 사용자 명시 |
| D2 | 경제 모델 = **즉시판매** (조건부 공구 아님) | `scheduled-cleanup.ts:796-800` 즉시판매 모델 확정 (2026-05-30) |
| D3 | 가격 = **그룹가 즉시 단일 적용** (모두 같은 가격, 동적 인하 X, 소급 X) | AskUserQuestion 응답 |

---

## 2. 현재 구현 (AS-IS) — 코드 근거

| 영역 | 현재 동작 | 위치 |
|---|---|---|
| 가격 | `unitPrice = price × (1 − appliedDiscountPct)`. `appliedDiscountPct` = tier(현재 인원 기준) ⊗ promo | `group-buy.routes.ts:221-279` |
| tier 계산 | `calcTierDiscount(tiers, current)` — current 이상 최고 tier %. **인원 늘면 다음 참여자부터 더 큰 할인** | `helpers.ts:148-166` |
| 결제 | 목표 무관 즉시 전액 (deal: wallet 차감 / Toss: confirm) | `group-buy.routes.ts:283-318`, `893-992` |
| 교환권 | 결제 직후 즉시 batch 발급 | `group-buy.routes.ts:484-507` |
| 목표 미달 | **자동환불 cron 제거됨** (즉시판매 확정) | `scheduled-cleanup.ts:796-800` |
| 마감 | `deadline < now()` 시 참여 거부 | `group-buy.routes.ts:195-197` |
| 정산 | voucher 사용 + T+7 cron → `restaurant_settlements` | `auto-settlement.ts:33-127` |
| 공개 응답 | `current_discount_pct`(현재 인원 기준) + `next_tier` + tiers array 반환 | `group-buy-public.routes.ts:241-260` 🔒 |
| 상세 UI | `unitPrice = price × (1 − current_discount_pct)` + tier 사다리 | `GroupBuyDetailPage.tsx:261-276` |

### AS-IS 의 문제 (즉시판매와의 모순)
- tier 가 `price` 에서 **인원 많을수록 깎임** → **먼저 산 사람이 더 비쌈**, 소급 환급 없음.
- 즉시판매라 "친구 모아야 딜 성사" 동기도 없음 → 초기 구매·추천 동기 사망.
- UI 가 "X명 더 모으면 Y% 할인" 을 표시하는데 실제로 **내 가격은 안 내려감** → 표시광고법상 기만 소지.

---

## 3. 목표 구현 (TO-BE)

### 3.1 가격 — 단일 고정 공구가
- 모든 참여자가 **동일한 공구가** 로 즉시 구매. 인원에 따른 가격 변동 **없음**.
- `original_price`(취소선) → `공구가` 의 1단계 할인만 표시. tier 사다리 제거.
- **promo 코드는 유지** (인원 기반 아님, per-user 별도 할인이라 즉시판매와 무모순).

#### ⚠️ 미확정 서브결정 (구현 착수 전 사용자 확인 필요)
**"단일 공구가" 를 무엇으로 둘 것인가** — 셀러 마진 vs 고객 매력 트레이드오프:

| 옵션 | 단일가 | 장점 | 단점 |
|---|---|---|---|
| **A1** | `product.price` 그대로 (현행 기준가) | 마진 보존, 마이그레이션 0 | 기존 후기 단계 구매자보다 비쌈 — "공구=싸다" 약함 |
| **A2 (권장)** | `price × (1 − 최대 tier 할인)` = 셀러가 설정한 **최저가를 처음부터 모두에게** | "그룹가=이미 최저가" 가장 정직·매력적, 초기 구매자 불이익 0 | 1명만 사도 최대 할인 → 셀러 마진 ↓ (셀러 동의 필요) |

> 권장: **A2**. "공동구매 = 우리가 이미 대량 단가를 떼와서 지금 바로 그 가격" 이라는 가장 정직한 프레이밍.
> 단 셀러 마진 영향이 있으므로, 셀러 입력 UI 를 "동적 tier" → "단일 공구가 직접 입력" 으로 바꾸고 기존 tier 데이터는 마이그레이션(§5)으로 흡수.

### 3.2 인원/목표/마감 → 연출 전용 (가격·환불 게이트 아님)
- `group_buy_current` = **"237명이 함께 구매중"** 소셜 증거.
- `group_buy_target` = 선택적 **"목표 달성 🎉"** 배지 (cosmetic). 미달 패널티 없음 (이미 자동환불 제거됨).
- `group_buy_deadline` = **"한정 공구 D-2"** 긴장감 + 마감 후 판매 종료 (현행 거부 로직 유지 가능).

### 3.3 교환권 / 정산 / 환불 — 변경 없음 (이미 즉시판매 정합)
- 교환권 즉시 발급, 사용 후 T+7 정산, 셀러/어드민 수동 환불 + Toss cancel + clawback 그대로.

---

## 4. 구현 계획 (파일별) — 🔒 잠금 주의 표기

| 파일 | 변경 | 잠금 |
|---|---|---|
| `src/features/group-buy/api/group-buy.routes.ts:221-279` | 인원 기반 tier 제거. `appliedDiscountPct = promo only`. `unitPrice = round(groupPrice × (1−promo/100))`. `groupPrice` = A1/A2 결정값 | ❌ 비잠금 (자유 수정) |
| `src/features/group-buy/api/helpers.ts:148-166` | `calcTierDiscount` 은 display 호환 위해 **존치**하되, 단일가 모델에선 max-tier 반환 헬퍼(`groupPriceFor()`) 추가 | ❌ 비잠금 |
| `src/features/group-buy/api/group-buy-public.routes.ts:241-260` | `current_discount_pct` = 고정 공구가 할인율, `next_tier = null`. **Cache-Control / tiers-array parse 정확히 보존** | 🔒 로딩최적화 — **[UNLOCK_LOADING] 사용자 허가 필요** (캐시 헤더·array parse 불변 조건) |
| `src/pages/GroupBuyDetailPage.tsx:261-276` + tier 사다리 UI | `unitPrice = detail.price`(또는 서버 단일가). "X명 더 모으면" 사다리 → 소셜 증거로 교체. **CountdownRing adaptive interval / below-fold lazy 보존** | 🔒 로딩 — perf 락만 보존하면 가격 텍스트는 수정 OK |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | `current_price ?? price` 그대로 OK(서버가 단일가 전송). "다음 tier" 문구만 정리. **memo / IntersectionObserver / fade 보존** | 🔒 로딩 — perf 락 보존 |
| `src/worker/openapi.ts` | tier 응답 스키마 문서 갱신 | ❌ |
| `src/tests/unit/group-buy-helpers.test.ts` | 단일가/promo 테스트로 갱신 | ❌ |
| 셀러 상품 등록/수정 UI (`Seller*` 공구 폼) | tier 입력 → 단일 공구가 입력으로 (i18n 6개 언어 + 가이드 동기화) | ❌ (단 i18n·guide-seed 규칙 적용) |

> ⚠️ `calcTierDiscount` 동명 grep 매칭된 `loyalty / seller-tiers / referral` 라우트는 **별개의 tier 개념**(등급/추천)이라 **영향 없음** — group-buy 가격 tier 와 무관.

---

## 5. 기존 진행중 공구 마이그레이션
- **이미 발급된 교환권**: 손대지 않음 (즉시판매라 이미 유효·확정).
- **진행중 공구의 표시가**: A2 채택 시 `price ← price × (1 − maxTier)` 로 1회 백필 → 신규 구매자도 최저가. 기존 구매자는 이미 더 싸게 샀으므로 불만 없음.
- **tier 컬럼**: `group_buy_tiers` 는 DROP 하지 않고 **deprecated** 로 남김(롤백 안전). 신규 등록은 NULL.

---

## 6. 범위 밖 / 후속 (별도 phase)
- 🔸 **사용자 셀프 취소 / 청약철회(전자상거래법 7일)** — 즉시 확정발급 모델일수록 셀프 처리 필요. 현재 셀러/어드민 수동만. 별도 PR 권장.
- 🔸 **breakage(미사용 만료 교환권) 귀속 정책** — 정산이 "사용 후 T+7" 이라 미사용분 매출인식/귀속 미정의.

---

## 7. 검증 계획
1. `bash scripts/check-schema-refs.sh` / `check-api-auth.sh` / `check-status-constraints.mjs`
2. `npx tsc --noEmit --skipLibCheck` (에러 0)
3. 단위 테스트: 단일가 + promo cascade, 인원 변화에도 가격 불변 assert
4. `npm run build` (vite 단독 금지)
5. smoke: `/api/group-buy/products` 응답에 `current_discount_pct` 고정·`next_tier=null` 확인
6. 표시광고: UI 가 "내 가격이 인원 따라 내려간다" 고 오인시키지 않는지 카피 검수

## 8. 법적 메모 (표시광고법)
"공동구매" 명칭 + 단일 고정가는 **"공동의 힘으로 확보한 단가를 모두에게 동일 적용"** 으로 정직하게 표현하면 문제 없음. 단, **"X명 모이면 추가 할인"** 같은 동적 인하 카피는 실제로 인하가 없으므로 **전면 제거** 필수.

---

## 다음 액션
- [x] 사용자: §3.1 서브결정 **A2 확정** (최대 tier 즉시 단일 적용)
- [x] 사용자: `group-buy-public.routes.ts` **[UNLOCK_LOADING]** 허가
- [x] 구현 완료 (아래)

---

## ✅ 구현 완료 (2026-05-30, commit `1281b8a` + 후속)

### 가격 코어 (commit `1281b8a`)
- `helpers.maxTierDiscount()` / `group-buy.routes.ts` join 가격 / `group-buy-public.routes.ts` 상세·리스트 / `GroupBuyDetailPage` UI — A2 단일가. 캐시 헤더·tiers array parse 불변.

### 후속 4종 (이 커밋)
- **① 셀러 폼**: `SellerMealVoucherNewPage.tsx` 동적 tier 입력 UI(toggle + 3단계 min/discount) + 거짓 카피("차액 환불 자동정산") 제거 → 단일 공구가 안내 박스. 제출 `group_buy_tiers: null`. i18n `seller.mealVoucher.singlePrice*` 6개 언어 추가. (수정 폼엔 원래 tier 없음)
- **② 기존 진행중 공구**: 런타임 `maxTierDiscount()` 가 legacy tiers 흡수 → **백필 불필요·무손실** (검증 완료). 기존 구매자 주문 불변, 신규 구매자는 최저가.
- **③ 사용자 셀프 취소/청약철회**: `POST /api/group-buy/voucher/:code/cancel` 신규. 본인 + status='unused' + 발급 7일 이내(CAS created_at 가드). deal→지갑 즉시 / toss→cancelTossPayment(idempotencyKey 공유). 재고/참여수 원복. ledger reverse. UI: `MyVouchersPage` QR 모달에 "구매 취소(7일 이내 환불)" 버튼 + `useInvalidateMyVouchers`. (인플 clawback 은 셀러 /refund 와 동일하게 미적용 — 후속)
- **④ breakage(낙전)**: `auto-settlement.ts:173` 이미 "만료 시 고객 환불(즉시판매 정합)" 구현됨 — 코드 변경 불필요, 문서화만.

### 잔여 후속 3종 — 완료 (2026-05-30)
- **셀러 가이드**: `guide-seed-seller.ts` 에 `groupbuy-single-price` 섹션 신설 + welcome 정산 문구 정정.
- **인플 clawback 통합**: `helpers.clawbackVoucherCommission()` 공유 헬퍼 신설 (admin force-refund / 만료 cron 인라인 로직 통합). 누수 지점 연결: 사용자 셀프취소(`self_cancel`) + 셀러 /refund(`seller_refund`). 만료 cron 은 이미 보유(`voucher_expired`).
- **환불 알림톡 통합**: `helpers.sendRefundAlimtalk()` 신설 → 셀프취소 + 부분환불(`partial-refund`) 에 연결. 셀러 환불은 기존 인라인 유지.

### 진짜 남은 것 (선택)
- 만료 cron / 셀프취소를 단일 `clawbackVoucherCommission` 로 리팩토링 (현재 cron 은 working 인라인 유지 — 무위험 우선).
- `paid` 상태(이미 송금) 커미션의 음수 정산 처리 (현재 회수 대상 아님 — 기록만).
