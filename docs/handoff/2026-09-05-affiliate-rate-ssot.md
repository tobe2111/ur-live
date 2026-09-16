# 담아 팔면 몇 % — 화면 네 곳이 서로 다른 숫자를 말하고 있었다 (2026-09-05)

## 다음 세션의 첫 액션

1. **PR #1358 CI 확인 후 머지** (`claude/affiliate-rate-ssot`, head `686f0d9` — 커밋 4개).
   함께 **#1357**(`claude/retire-store-intro`, head `a12a78a` — 영입 2% 폐지)도.
   #1357 1차 실패는 `check-guard-mutations` 의 **낡은 지도**(에이전시 1% 축 주입이 옛
   `CommissionAxis` 문자열을 앵커로 썼는데 2% 폐지로 `'influencer_intro'` 가 빠져 대상을 못 찾음)
   → `bc9526e` 로 갱신 + origin/main 머지(`a12a78a`).
2. 그 다음은 **②-a — "소개비는 가게가 낸다" 스위치**(`promo_funding_source='owner'`).
   이게 남은 것 중 알맹이고, **안 켜면 매장이 건 소개비를 유어딜이 대신 문다.**
   런북: `docs/design/commission-funding-restructure.md` §1. **머니 경로라 단독 세션 + 실결제 확인.**
   ⚠️ 순서를 뒤집지 말 것 — ②-b(`SELLER_PROMO_FIELD_ENABLED=true`)를 먼저 켜면 그 누수가 열린다.

## 이번에 한 것 (commit `2f7162a`)

라이브 D1 을 직접 재 보다가 나온 것이다. 찾으러 간 게 아니라 **핀 화면 코드를 읽다 단위가
안 맞아서** 확인했다.

같은 컬럼 `products.referral_commission_rate` 를 네 자리가 **다른 단위·다른 기본값**으로 읽고 있었다.

| 자리 | 읽던 방식 | 결과 |
|---|---|---|
| 유어샵 담기 picker | `Math.round(rate)` = 퍼센트로 오해 | 0.05 → 0 → 배지가 **한 번도 안 뜸** |
| 유어샵 핀 관리 | `price * rate / 100` | 실제의 **1/100** (₩5,000 → ₩50) |
| 상품 상세 공유 문구 | 기본값 `0.05` 하드코딩 | **5%** 라고 약속(실제 2%) |
| 어드민 정책 표 · 운영 핸드북 | `AFFILIATE_COMMISSION_PCT: 5` | 같은 이유로 **5%** 표시 |

**라이브 실측**: 활성 상품 **2,606개 전부** `referral_enabled=1` · rate **전부 NULL** ·
`affiliate_commission_rate` 설정 없음 ⇒ 지금 모든 상품이 **2%** 인데, 사람을 모으라고 만든
유어샵 두 화면이 그걸 **한 글자도 안 보여주고 있었다**(배지 조건 `> 0` 이 영원히 거짓).

**적립 자체는 내내 2% 로 맞게 나갔다 — 틀린 건 표시다.** 뿌리는 2026-06-17 대표 결정(5%→2%)이
적립 경로(`affiliate-credit.ts`)에만 반영되고 표시 상수들이 안 따라온 것.

수리: 신규 SSOT `src/shared/affiliate-rate.ts`(`DEFAULT_AFFILIATE_RATE` + `effectiveAffiliateRate`
`affiliateRatePct`) 하나로 통일. 서버는 NULL 을 0 으로 뭉개지 않고 `referral_enabled` 를 함께
보낸다(적립이 **꺼진** 상품에 "쓰면 2%" 를 약속하지 않으려고). 적립 계산·지급 경로는 무접촉.

## 같은 PR 에 함께 담은 것 (commit `6b7c836` · `686f0d9`)

**② 소개비를 등록 후에는 못 바꿨다** — 레버가 `POST /products` 에만 있었다. 가격·재고·사진은
다 고칠 수 있는데 마케팅 예산만 못 고쳤다. `PUT /products/:id` 에 배선하고, 등록·수정이
**같은 헬퍼**(`worker/utils/seller-promo-rate.ts`)를 쓰게 했다(게이트·clamp 가 두 벌이 되면
반드시 갈린다 — ①이 정확히 그 사고다). **이중 게이트 그대로라 오늘은 no-op.**

**🪦 죽은 GET 라우트 제거 + 그 클래스의 가드 신설** — `GET /api/seller/products/:id` 가 두 번
정의돼 뒤엣것이 한 번도 안 돌고 있었다(하필 그쪽이 전 컬럼을 주는 '좋은' 구현). 전수 스캔
결과 레포 274개 라우트 파일 중 **그 한 건뿐**. `check-duplicate-hono-routes.mjs` 신설
(audit-gate + verify strict + AUDIT_INVARIANTS 표, 104개째 불변식).

## 이번에 틀렸던 판단 (제일 값진 것)

**내가 만든 가드 2개가 헛돌 뻔했다. 주입해 보고서야 알았다.**

1. `/100` 재발 판정을 `commission_rate\s*/\s*100` 으로 앵커했는데, 새 코드의 변수명은
   `estRate` 라 **결함을 심어도 초록불**이었다. → 계산식 자체(`pin.price * estRate)`)를 본다.
2. 기본값 검사를 전부 **파생**으로 짰다(`AFFILIATE_COMMISSION_PCT === DEFAULT_AFFILIATE_RATE*100`).
   둘 다 같은 상수에서 오므로 상수를 5 로 되돌려도 **전부 통과**한다. → 값 자체를 못박았다
   (`expect(DEFAULT_AFFILIATE_RATE).toBe(0.02)`).

**새 가드를 만들며 또 두 번 틀렸다.** (a) 첫 판이 `c.get('user')`·`formData.get('file')` 까지
잡아 **38개 파일을 위반이라 신고**했다 — 늘 빨간불인 가드는 꺼진 가드다. (b) 고친 뒤
"라우터명 필터를 빼면 소음이 돌아온다" 고 매니페스트에 등록했는데 **주입해도 초록**이었다.
방어 세 겹이 서로 겹쳐서 하나 빼도 안 무너진다(A/B/C 조합을 실제로 돌려 확인).
⇒ **겹친 방어는 좋은 설계지만 단일 주입점이 못 된다.** 진짜 단일 실패점인 판정 임계
(`at.length > 1`)로 교체. 오늘 사고가 정확히 2겹이라 임계를 하나만 올리면 그대로 통과한다.

그리고 **주입 지도가 한 번 낡았다**: 파일크기 래칫을 맞추려고 SQL 두 줄을 한 줄로 합쳤더니
`find` 문자열이 안 맞아 pre-commit 이 "낡은 지도"로 잡았다. 가드가 제 역할을 했다 — 후속 커밋에서 수정.

## 남은 결정 / 대기

- **②-a** `promo_funding_source='owner'` (+ `commission_budget_enabled` 평가) — 대표 판단 + 단독 세션.
- **②-b** `SELLER_PROMO_FIELD_ENABLED = true` (`src/shared/feature-flags.ts`) — ②-a **뒤에만**.
- ✅ **②-c 완료**(이 PR ②) — 관리 화면 소개비 레버 + 등록·수정 공용 헬퍼.
- ℹ️ `money-patterns` 의 `curator.routes.ts inline DDL` 경고는 **선재 + 오탐** — 실제로는
  `_curatorTablesReady` 로 메모이즈돼 있고 가드가 문자열 `WeakSet` 만 본다. 쫓아가지 말 것.
