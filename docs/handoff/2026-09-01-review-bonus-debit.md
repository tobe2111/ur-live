# 후기 보너스 — 매장 원장 차감 배선 (게이트 OFF)

**날짜** 2026-09-01 · **서비스** 유어딜 · **머니 경로** 있음(게이트 OFF 라 라이브 금액 불변)

## 대표 지시

> "후기 보너스는 그러면 매장 사장님이 설정할 수 있도록 하자. 셀러 대시보드에서 말이야.
>  유어딜이 주는게 아니라 매장 사장님이 부담하게끔."

앞선 PR #1276 이 **금액 설정 UI + 재원 판정(`funded_by`)** 까지 했고, **실제 차감은 남겨 뒀다**
(머니 경로라 별도로 붙이기로). 이번이 그 나머지다.

## 무엇이 달라졌나

- 후기 승인 시, 그 건이 **매장 부담(`owner`)** 으로 판정되면 매장 원장에서 보너스만큼 뺀다.
  게이트 `review_bonus_owner_funded`(platform_settings, **기본 OFF**)가 꺼져 있으면 판정이 항상
  `platform` 이라 **차감 경로에 아무것도 안 들어온다** = 오늘과 완전히 동일.
- 매장이 금액을 설정하지 않았으면 게이트가 켜져 있어도 `platform` 이다(안전판 두 겹).

## 코드

| 파일 | 무엇 |
|---|---|
| `src/features/group-buy/api/review-bonus-funding.ts` | `debitStoreForReviewBonus()` 추가 — `funded_by==='owner'` + 금액>0 + sellerId 있을 때만, `reference_id='review:{submissionId}'` 로 **선조회 dedup 후** `recordLedger`(debit `seller:N` / credit `platform:revenue`). 실패는 전부 삼킨다(보너스 지급을 못 되돌리므로). |
| `src/features/group-buy/api/review-bonus.routes.ts` | `approveSubmission` 에서 **`payBonus` 가 성공한 뒤에** 호출. |
| `src/tests/unit/review-bonus-debit.test.ts` | 7건 — 동작 4 + 배선 불변식 2 + 멱등 1. |
| `docs/STAGING_CHECKLIST.md` | **S9** 신설. |
| `src/features/admin/api/admin-system-monitoring.routes.ts` | `OPS_GATES` 에 `review_bonus_owner_funded` 등재(`staging_ref: 'S9'`, 점등 조건 기재). |

## 🔑 순서가 안전장치다

차감은 **지급 성공 뒤에만** 부른다. 반대로 붙이면 지급이 실패한 건까지 매장에 물려서
**유저는 못 받았는데 매장만 내는** 상태가 된다. 테스트가 이 순서를 파일 오프셋으로 고정한다
(`payBonus` 호출 위치 < `debitStoreForReviewBonus` 호출 위치).

## ⚠️ 역전(환불)이 없는 이유 — 다음 세션이 확인할 것

원장 debit 은 넣었는데 **되돌리는 경로는 안 만들었다.** 근거: 지금 제출을 `'paid'` 에서
빼내는 경로가 **하나뿐**(승인 → paid 로 가는 그 경로)이라, 지급을 취소하는 흐름 자체가 없다.
테스트가 그 사실을 `offPaid.length === 1` 로 **고정**해 놨다 —
**나중에 "보너스 회수/취소" 경로가 생기면 그 테스트가 빨간불이 된다.** 그때 역전을 함께 붙여라.
(적립-역전 대칭은 CLAUDE.md 머니 룰 #2.)

## 다음 세션의 첫 액션

1. **S9 를 staging 에서 돌린다** — 게이트 ON → 매장 금액 설정 → 후기 승인 →
   `SELECT * FROM ledger_entries WHERE reference_id='review:{id}'` 가 **1행**인지,
   같은 건 재승인해도 **추가 0** 인지, 게이트 OFF 로 되돌리면 **차감 0** 인지.
2. 통과하면 `docs/STAGING_CHECKLIST.md` S9 상태를 ✅ + 날짜로.
   프로덕션 게이트 활성은 **대표가 어드민에서** 한다(세션은 플랫폼 쓰기 안 함).

## 이번에 틀렸던 판단

없음 — 다만 **게이트 OFF 를 "안 만든 것"으로 읽지 말 것**. 코드는 라이브에 나가 있고,
`platform_settings` 에 `review_bonus_owner_funded='true'` 를 저장하는 순간부터 실제로 돈이 움직인다.
