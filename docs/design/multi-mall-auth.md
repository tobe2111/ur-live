# 멀티-몰 인증/테넌시 설계 — "몰 = 도메인 = 계정" (2026-06-18 대표 확정)

## 배경 (왜 이 문서가 생겼나)

도매몰 카탈로그에서 **상품이 안 보이거나, 로그인 상태에 따라 들쭉날쭉(flip-flop)** 하는 증상이 반복.
원인 추적 끝에 뿌리가 **멀티-몰 테넌시 모델의 애매함**으로 확인됨:

- 2026-06-09 최초 구현은 **모델 B (계정 우선)** — "식품 유통사는 어느 호스트로 와도 식품 몰을 본다".
  즉 `resolveMallId` 가 **로그인 계정의 `mall_id` 를 host 보다 우선** 적용.
- 부작용: **[계정이 속한 몰] ≠ [지금 보는 도메인의 몰]** 이 갈리면
  - 게스트(비로그인) → host 의 몰
  - 로그인 → 계정의 몰
  - → 로그인/로그아웃에 따라 카탈로그가 왔다갔다. 계정 몰에 상품이 없으면 **"상품 0개"**.

## 결정 (대표, 2026-06-18)

> **유통사/제조사는 몰별로 별도 로그인.** 한 사람이 여러 몰에서 활동하면 몰마다 계정이 따로다.

이를 한 문장으로: **`1 몰 = 1 도메인 = 그 도메인의 계정·카탈로그`**

- **몰은 도메인(host)이 결정** — 게스트든 로그인이든 같은 도메인이면 같은 몰 → flip-flop 구조적으로 불가능.
- 표준 멀티테넌트 방식(스마트스토어/카페24와 동일). 데이터 완전 격리, 단순, 안전.
- 트레이드오프: 여러 몰 운영자는 몰마다 로그인 별개. B2B 에선 일반적이라 수용.

## 구현 단계

### ✅ Step 1 (2026-06-18 완료) — `resolveMallId` host-first 전환

`src/features/supply/api/wholesale-malls.ts`

**Before (account-first):** `계정 mall_id > ?mall=slug > host > 1`
**After (host-first):** `?mall=slug > host > 1` — 계정 토큰은 mall 결정에서 제외.

- 게스트/로그인 카탈로그 **일관성 확보**.
- **단일 몰(id=1) + 단일 호스트 환경에선 byte-identical** (모두 1 반환) — INVARIANT 유지.
- ⚠️ **계정 머니 작업(예치금/주문/정산)은 영향 없음** — `seller_id`/`supplier_id` 에 직접 매달려
  몰-격리되므로 `resolveMallId` 와 무관. `resolveMallId` 는 **카탈로그/배너/게시판/제안 + 주문·미리보기
  mall 스코프**(노출/격리)에만 사용.
- `accountMallId()` 함수는 호출처가 없어져 제거(필요 시 git history).
- 신규 유닛 테스트(`src/tests/unit/wholesale-malls.test.ts`): "토큰(다른 몰)이 있어도 host 우선",
  "게스트=로그인 동일 몰", supplier 토큰 동일.

### ⏳ Step 2 (몰 2개째 만들 때) — 계정/로그인의 몰 스코핑

현재는 활성 몰 1개라 **불필요**. 실제로 두 번째 몰을 열 때:

1. **로그인을 도메인 몰로 스코핑** — 도메인 X 에서는 그 몰 소속 계정만 로그인 허용
   (또는 다른 몰 계정 로그인 시 명확한 안내).
2. **전역 UNIQUE → (몰, email/kakao_id) 단위로 재설계** — 같은 사람이 몰마다 계정을 가질 수 있도록.
   현재 글로벌 UNIQUE(`users.email`, `users.kakao_id`, `idx_sellers_linked_user_unique`) 는
   "한 사람 = 한 계정" 전제라 멀티-몰 계정 분리와 충돌. 이 재설계는 **데이터 마이그레이션 동반** →
   별도 PR + 사용자 승인 필요.
3. `registrationMallId` 는 이미 host 기반(계정 토큰 무시)이라 이 모델과 정합 — 변경 불필요.

## 불변식 (회귀 방지)

- **기본 몰(id=1) + 단일 호스트 → 모든 resolver 가 1 반환 (byte-identical).** 유닛 테스트로 고정.
- `resolveMallId` 우선순위 변경 시 본 문서 + `wholesale-malls.test.ts` 동시 갱신.
- 머니/예치금/정산 코드에 `mall_id` 결합 금지 — 계정 id 격리 유지.

## 관련 파일

| 파일 | 역할 |
|---|---|
| `src/features/supply/api/wholesale-malls.ts` | `resolveMallId` / `loadMallByHost` / `registrationMallId` SSOT |
| `src/tests/unit/wholesale-malls.test.ts` | 우선순위 + INVARIANT 계약 |
| `src/features/supply/api/wholesale.routes.ts` | 카탈로그/주문/미리보기 mall 스코프 소비처 |
| `src/features/supply/api/wholesale-main.routes.ts` | 배너/제안 mall 스코프 |
| `src/features/supply/api/wholesale-board.routes.ts` | 게시판/위시리스트 mall 스코프 |
| `src/features/supply/api/distributor-admin.routes.ts` | `/catalog-diagnostic` · `/catalog-repair` (몰별 상품 분포 진단) |

## 미해결 — 현재 "상품 0개" 의 실제 원인 확인 (별개)

host-first 는 **몰 불일치 종류**의 버그를 제거한다. 만약 현재 0개가 `is_active`/`supply_visibility`/
`supply_price` 같은 **데이터** 때문이면 그건 별도 — `/api/.../catalog-diagnostic`(어드민 🩺 패널) 1회
실행 또는 prod egress 로 `summary`/`by_mall`/`hidden_sample` 을 보면 즉시 판별된다.
