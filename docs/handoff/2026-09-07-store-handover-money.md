# 💰 매장 손바뀜 · 귀속 시점 — 잠금 먼저 (2026-09-07)

브랜치 `claude/service-page-ui-redesign-gkm900`.
결재함: `docs/decisions/2026-09-07-store-handover-money-cut.md` (**status: 잠금만 승인 · 선택지 미결**)

## 대표가 물은 것

> *"매장 가져오는 것에선 돈까지 귀속이 되면 안되지, 귀속되는 시점부터 계산해서 성과 수익이
> 계산되어야 하지 않을까? 확인해볼래?"* → (확인 결과 보고 후) **"모두 다 순서대로 해줘"**

## 실측한 답 — 대표 말이 맞고, 지금 구조는 정반대다

1. 원장 계정은 **`seller:N` 문자열뿐**이다. "누구 것인지" 를 적는 칸이 스키마에 없다.
2. payout 집계에 **`created_at` 필터가 없다** — 전기간 누적이다(`payouts-generate.ts:44-55`).
   ⚠️ **이건 실수가 아니라 2026-06-26 의 의도적 변경**이다(주 단위로 자르니 누락된 주의 정산금이
   영영 재포착 안 됐다). **평상시엔 맞고, 손바뀜 경계에서만 틀린다.** 되돌리지 말 것.
3. 송금 목적지는 `sellers.bank_account` 하나다.

⇒ 주인을 바꾸고 계좌를 갈면 **그 매장이 창업 이래 쌓은 미지급 잔액 전액**이 다음 주 cron 에서
새 계좌로 나간다. 되돌릴 수 없고, 에러도 안 난다.

**아직 라이브 사고는 아니다** (실측: 매장 1 · `seller_operators` 1행 · 원장 2행 · `introduced_by` 0 · payout 0).
그리고 자를 기준(`seller_operators.granted_at`)은 **이미 데이터에 있는데 돈 코드가 한 번도 안 읽고 있었다.**

## 한 것 (E2 — 검증됨, 배포·라이브 판정 전)

| 무엇 | 어디 |
|---|---|
| 🔐 미지급 잔액이 남은 매장은 주인을 못 바꾼다 (fail-**closed**, 409 `STORE_HANDOVER_BLOCKED`) | `worker/utils/store-handover-guard.ts` (신규) + 손바뀜 3경로 |
| 🏷️ 판매자 없는 상품이 `seller:null` 로 적립되지 않는다 | `ledger.ts` `sellerLedgerAccount()` + `group-buy.routes.ts` raw 보간 4곳 |
| 🏷️ payout 이 숫자 아닌 계정 id 를 거른다 | `cron/payouts-generate.ts` |
| 👥 운영자는 합류(`granted_at`) 이후 정산만 본다 | `worker/utils/settlement-scope.ts` (신규) + `seller-settlements/payouts.ts` (분리) |
| ⏳ 새 영입자를 붙이면 옛 만료일을 지운다 | `admin-sellers/reassign-introducer.ts` |
| ⏳ 이용권 사용 레일이 결제 레일과 같은 만료 규칙 | `ledger.ts` `recordIntroductionCommissionShare` |

가드 `store-handover-money-2026-09-07.test.ts` 14건 + 주입 매니페스트 **8건 전부 되돌려-검증 빨간불**.
검증: tsc 0 · vitest 643파일 7,975건 pass · guard-registry 128 · file-size/sql 3종/crossrole GREEN.

## 🧪 2026-09-08 — 라이브엔 판정할 대상이 없다 (실측), 그래서 실제 DB 로 돌렸다

대표 *"판정까지"* 에 답하려고 라이브 기준선을 떴는데, **판정의 성격이 달라졌다**:

```
sellers            1개 (id 14 홍대돈까스) · linked_user_id 전부 NULL · bank_account 없음
ledger_entries     2행뿐  — seller:null 1,800원(2026-05-24) + supplier:3 10,000원
payouts            0건
seller_operators   1건 (seller 14 ← user 3, 2026-08-26)
```

⇒ **손바뀜 가드는 라이브 대상이 0건이다**(아무 매장도 주인이 없다). 배포해도 오늘 달라지는 게 없고,
그게 의도다(잔액 0이면 통과). **E4(라이브에서 의도한 효과 실측)는 지금 도달 불가**이고,
이건 실패가 아니라 사실이다 — 실제 손바뀜이나 실제 주문이 있어야 관측된다.

그래서 텍스트 가드로 끝내지 않고 **실제 SQLite 에 실제 함수를 태웠다**:
`src/tests/unit/store-handover-behavior-2026-09-08.test.ts` (7건, D1 어댑터 + `node:sqlite`).
핵심 사슬을 **인과로** 검증한다 — 마감 payout 생성 → 미배정 잔액 0 → 자물쇠 열림, 그리고
원장 자체는 안 줄어든다(순수 원장으로 판정하면 영원히 막힌다는 것을 실제로 보인다).
주입 2건 되돌려-검증 빨간불 확인.

## 다음 세션의 첫 액션 — **staging 실측 3개**

텍스트 가드는 *배선*만 봤다. 실제 D1 동작은 안 봤다.

1. **잔액이 남은 매장에 소유자 변경 시도** → `PATCH /api/admin/sellers/:id/link-user`
   가 409 + `code: STORE_HANDOVER_BLOCKED` + `receivable` 을 주는가. 잔액 0 매장은 **통과**하는가
   (막기만 하고 정상 흐름을 막으면 그게 더 큰 사고다).
2. **플랫폼 상품(=`seller_id` NULL) 결제** → 원장 `credit_account` 가 `platform:revenue` 인가.
   `seller:null` 이 다시 생기면 ①이 헛돈 것이다.
3. **운영자 계정으로 정산 화면** → `granted_at` 이후 payout 만 오는가, 응답에 `scope:'operator'` 가 있는가.
   그리고 **소유자는 종전과 똑같이 전부** 보이는가.

## 이번에 틀렸던 판단 (제일 값진 부분)

- 🩸 **주입이 두 번 헛돌았다.** ① 테스트 앵커 `/catch \{[\s\S]{0,200}blocked: true/` 가
  **파일 안 두 catch 중 앞의 것**에 먼저 매치돼, 뒤쪽(잔액 조회)을 통째로 열어도 초록이었다
  → `getLedgerReceivable` 을 앵커에 포함해 좁혔다. ② 그 다음엔 **주입 자체**가 `blocked: true` 를
  남겨 둬서 결함이 안 심겼다 → 긴 유일 앵커로 `true → false` 를 뒤집게 고쳤다.
  ⇒ **주입 검증은 "빨간불이 떴다"가 아니라 "내가 심은 게 실제로 그 줄인가"까지 봐야 한다.**
- 🧱 **파일크기 래칫을 우회하려다 멈췄다.** `seller-settlements.routes.ts` 가 baseline+27 이 돼서
  `[SKIP_SIZE]` 가 눈앞에 있었는데, 그 가드가 막으려는 것이 정확히 이 상황이다
  → `seller-settlements/payouts.ts` 로 분해(1076 → **1027**, 오히려 줄었다) + 범위 규칙은
  `settlement-scope.ts` 로. **래칫이 옳았다.**
- 🧭 텍스트 가드가 통과해도 **`tsc` 는 별개다** — 파일을 한 단계 깊은 폴더로 옮기자
  상대경로(`../../../` → `../../../../`)와 `Context<{Bindings}>` 타입이 깨졌고, 테스트는 전부 초록이었다.

## ⭐ 2026-09-08 — 대표가 선택지 1 을 확정했다 (마감 창구 구현)

> *"아니 만약 중개사가 한 매장으로 유어딜에서 번 돈이 있으면 그 돈은 승계가 되더라도 일단
> 중개사에게 정산되어야지. 반대 상황도 마찬가지고."*

**자물쇠만으로는 막다른 길이었다** — 막기만 하고 정산할 방법이 없었다. 그리고 실제로
**자물쇠 자신에 결함**이 있었다: `getLedgerReceivable`(순수 원장)을 봐서 **마감을 해도 안 줄어들어**
영원히 막혔을 것이다. `getUnsettledBalance`(원장 − 배정분)로 교체했다.

마감 창구 `POST /api/admin/payouts/handover-closeout`(finance + 2FA + 감사로그). **송금은 안 한다** —
`pending` payout 행을 만들 뿐이고, 그 행이 **이전 주인 계좌를 스냅샷**해서 들고 있다.
새 기계는 안 만들었다(기존 payout 스냅샷 + 집계 차감이 그대로 '0으로 마감'이다).

**추가 staging 항목**: 잔액 있는 매장 → 마감 호출 → payout 행에 *이전 주인* 계좌가 박혔는가 →
그 다음 소유자 변경이 **열리는가**. 그리고 소액(1만원 미만)도 마감 행이 생기는가.

### 아직 안 막은 것
마감 payout 을 손바뀜 **뒤에** 취소하면 잔액이 되살아나 새 주인에게 간다(집계가 `cancelled`/`failed` 를 안 뺀다).

## 남은 결정 (대표 판단 대기)

선택지는 확정됐다(위). 남은 것:

1. **마감 화면(UI)이 없다** — 지금은 API 뿐이라 어드민이 직접 호출해야 한다. 정산 화면에
   "손바뀜 마감" 버튼이 필요하다.
2. **마감 payout 취소 방어** — 위 "아직 안 막은 것".
3. 의도적으로 **안 한 것** 둘: ① 구매 시점의 영입자를 이용권에 스탬프(스키마 + 백필 필요)
   ② 사장님이 스스로 매장을 가져오는 승계 기능(`owner_verified` — 레포 전체 0건, 지금은 어드민 경유).
