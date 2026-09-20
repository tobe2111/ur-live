# 🪙 결제 화면에서 딜 사용액 조절 — 대표 확정 "C안" (2026-09-19)

**[E2 검증됨]** — 코드·가드·되돌려-검증 완료. **E3(배포)·E4(라이브)는 아직.**
⚠️ **잠금 파일 접촉 + 머니 경로** → `STAGING_CHECKLIST.md` **S13** 이 선행 조건이다.

## 대표 지시
> *"나는 여기 페이지에서 딜 결제 내용 변경을 할 수 있으면 좋겠어. 지금은 이용권 상세페이지에다가
> 해뒀더만, 원래는 여기서 포인트 사용을 하듯이 원래 하잖아 다른 사이트들도."*

시안 3안(A 요약 안 / B 한 줄+펼침 / C 독립 카드) 중 **C안 확정**,
잠금 범위는 `AskUserQuestion` 으로 **"허가 — 최소 범위"** 승인.

## 무엇을 했나

| 파일 | 변경 |
|---|---|
| `src/pages/pay/DealUseCard.tsx` (신규) | C안 카드 — 입력 + 전액 사용. 순수 계산 `dealUseCap`·`clampDealUse` 를 export 해 시험 가능하게 |
| `src/pages/TossWidgetPayPage.tsx` 🔒 | import 1 + 상태/파생 3줄 + `setAmount` 재호출 effect 1 + 렌더 1블록 + 라벨 3곳 |
| `src/shared/pay-summary.ts` | `dealMax`(표시용 파라미터) + **`MIN_CARD_AMOUNT` SSOT** |
| `src/features/group-buy/api/partial-deal.ts` | `MIN_CARD_AMOUNT` 를 shared 에서 **재수출**(값 불변) |
| `src/pages/GroupBuyDetailPage.tsx` | `dealMax: dealPlan.max_deal_usable` 를 쿼리에 실음 |

### 설계의 핵심 두 가지

1. **항등식이 서버와 맞물린다.** 화면: `청구액 = 총액 − 딜`. 서버(`derivePartialDeal`): `딜 = 총액 − 청구액`.
   그래서 서버 코드를 **한 줄도 안 고쳤다** — 이미 청구액에서 역산해 게이트·최소카드액·잔액을
   재검증하고 원자 CAS 로 뺀다. 위조해도 **자기 잔액 안에서만** 움직인다.
2. **전부-딜은 이 화면의 일이 아니다.** `MIN_CARD_AMOUNT = 100` 이라 상한이 `총액 − 100` 이다
   ⇒ productId 도 별도 엔드포인트도 필요 없어 변경이 최소로 끝났다. 전부-딜은 상세의 `DealPayButton`.

## 🕳️ 기존 가드 둘이 내 변경을 잡았다 — 둘 다 **풀지 않고 재조준**했다

1. **"딜 사용 블록의 렌더 조건"** — `summary.dealUsed`(URL 초기값)를 앵커했는데, 그건
   **이 화면에서 새로 고른 딜을 못 본다.** 0 에서 시작해 여기서 딜을 고른 사람에게 그 줄이
   안 뜨는 **실제 결함**이었다(가드가 없었으면 그대로 나갔다) → `goodsAmount > chargeAmount` 로 교정.
2. **"요약 값이 금액 판단에 새어들지 않는다"** — 규약(`display*` 이름)의 전제가
   *"요약은 표시 전용"* 이었고 C안이 그 전제를 바꿨다 → 이름 규약 대신 **지키려던 것**으로 재작성:
   화면이 **잔액을 조회하지 않는다** · `setAmount` **모든 줄**에 요약 값 금지 · 청구액 재대입 금지.

### 🩸 그 과정에서 가드 자신의 눈먼 자리 둘
- `setAmount` 를 **첫 줄 하나만** 검사하고 있었다 — 호출이 둘이 되면 새 줄이 샌다 → 전부 검사.
- 요약 파생값 탐지 정규식이 산술 기호가 `summary.x` **뒤**일 때만 매치했다.
  `amount + (summary.dealUsed ?? 0)` 에서 0건이 됐고, 그 검사 자신의 *"0건이면 헛도는 가드"*
  단언이 잡았다 → 한 줄 안에 요약과 산술이 **함께** 있으면 보도록 고치고,
  합성 누수(`summary.origAmount * 2`)로 **되돌려-검증**해 빨간불 확인.

## 검증
- 신규 `pay-deal-use-card-2026-09-19.test.tsx` **20건**(실제 렌더해 눌러 본다) + 주입 **5건 전부 빨간불**
- 잠긴 계약 grep 카운트 **전부 동일**(`requestPayment`·`widgets()`·마운트 id·`safePaymentReturnPath`·타임아웃·키 분기)
- 초기화 `setAmount` 줄 **글자 그대로** 잔존 · `setAmount` 호출 1 → 2
- tsc 0 · theme/design-slop/light-input/modal-zindex/mobile-viewport GREEN

## ⚠️ 다음 세션의 첫 액션
**`docs/STAGING_CHECKLIST.md` S13 을 처음부터 끝까지.** 특히 **S13-3**(딜 조절 후 실제 승인):
화면이 말한 금액과 토스가 승인한 금액이 갈리면 사용자는 결제가 끝난 뒤에야 안다 —
유닛은 "호출이 두 곳이고 가드가 있다"까지만 본다.

## 남은 것
- **결제 로딩** — 발급 후 회계 블록(수수료율·귀속·원장·정산기록)이 응답 전에 돈다(실측 ~0.2–0.4초).
  레포에 `waitUntil` 이관 선례가 있으나 **머니 경로라 단독 세션 + staging** 이 붙는다.
- 이용권 상세의 `DealUseChooser` 와 이 카드가 **둘 다** 산다(상세=미리 고르기, 결제=최종).
  한쪽으로 합칠지는 대표 판단.
