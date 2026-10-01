## 🔴 2026-10-01 — 같은 머니 결함을 두 세션이 각자 고쳤다 (#1591 머지 · #1593 폐기) + 다섯 번째 읽기 자리 발견

대표 *"모두 머지해줘"* → *"지금 머지해"* → *"가장 이상적으로 해 머지하자"*.

열려 있던 PR 셋 중 둘은 머지했고(아래), 셋째(**#1593**, 머니)는 **머지하지 않고 닫았다**.
머지하려고 병합을 떠 보니 **이미 고쳐져 있었다.**

| PR | 결과 |
|---|---|
| [#1602](https://github.com/tobe2111/ur-live/pull/1602) 셀러 chrome 40px + 폰 측정 완결 | ✅ `9890cb4fa` |
| [#1606](https://github.com/tobe2111/ur-live/pull/1606) #1604 E4 판정 인계 | ✅ `1f1098c52` |
| [#1593](https://github.com/tobe2111/ur-live/pull/1593) 이용권 적립 이중레일 | ❌ **닫음** — #1591 이 먼저 머지됨 |

## 어떻게 알아챘나 — **add/add 충돌**

`git merge origin/main` 이 파일 **이름이 같은데 내용이 다른** 충돌을 냈다:

```
CONFLICT (add/add): scripts/mutations/voucher-credit-single-rail.mjs
CONFLICT (add/add): src/tests/unit/voucher-credit-single-rail-2026-10-01.test.ts
```

main 에 [#1591](https://github.com/tobe2111/ur-live/pull/1591) `aed1694ca` 가 있었다 —
**같은 문제 · 같은 실측(1,000원 → 1,850원 = 185%) · 같은 처방**(구매 적립을 `platform:escrow` 로).

> 🧭 **add/add 충돌은 "중복 개발" 의 가장 또렷한 신호다.** 같은 이름을 두 사람이 따로 지을 확률은
> 낮다. 충돌을 *해결*하기 전에 **왜 같은 이름이 둘인지**를 먼저 물을 것.
> (CLAUDE.md 2026-07-29 "같은 날 3건을 중복 개발하고 버렸다" 와 같은 클래스.)

## 왜 머지하면 안 됐나 — 둘 다 **에러 없이** 나빠진다

### ① SSOT 가 두 벌이 된다

```
main :  purchaseCreditFields()  in  worker/utils/payout-account.ts   ← 배선 완료
#1593:  voucherPurchaseCredit() in  worker/utils/ledger.ts           ← 같은 규칙, 두 번째 구현
```

**같은 머니 규칙에 구현이 둘.** 오늘 오전 검색에서 고친 것(규칙 하나 · 구현 둘 · 한쪽만 수리됨)과
정확히 같은 클래스다. 머니 경로에서는 그 갈림이 돈으로 나온다.

### ② #1591 이 **측정하고 기각한** 리네임을 되돌린다

#1593 의 후반부는 `merchant:N` → `seller:N` **리네임**이다. #1591 커밋 메시지:

> **리네임하지 않은 이유**: 결재문 §⑥ 은 수렴을 제안했는데, 실측하니 그 이름을 읽는 곳이
> 센 5곳보다 많았다 — 셀러 '매출' 카드 · 주간 이중레일 경보(`payee_type='store_owner'`) ·
> owner-promo 재원 계정 · payout-use-gate 의 의미. **넷 다 에러 없이 틀린 값을 내기 시작한다.**
> ⇒ 이름은 그대로 두고 **집계에서만** 접었다(`canonicalPayee`).

#1593 은 그중 둘(매출 카드 · owner-promo)만 대응했고 **주간 경보와 payout-use-gate 는 안 건드렸다.**

### ③ 문서를 되돌린다

#1593 의 `STAGING_CHECKLIST.md` 변경은 분기 시점이 더 이른 탓에, 같은 날 #1603 이 추가한
**판정 도구 수리 기록(§2026-10-01)을 통째로 지운다.**

## 🩸 내가 틀렸던 것 — 대표에게 **틀린 전제로** 승인을 받았다

대표에게 *"#1593 은 이용권 이중적립을 고치는 머니 PR"* 이라고 보고하고 머지 승인(*"지금 머지해"*)을
받았다. **그 전제가 거짓이었다** — 그 버그는 이미 고쳐져 있었다. 승인은 유효했지만 **내가 준 사실이
틀렸다.** 병합을 실제로 떠 보고서야 드러났다.

🧭 **교훈: 머지 직전에 `git merge origin/main` 을 실제로 떠 볼 것.** `mergeable: clean` 은
"충돌 없음" 만 말하고 **"중복 아님" 은 말하지 않는다.** #1593 은 한동안 `clean` 이었다.

## 🔴 그 과정에서 찾은 새 결함 — **다섯 번째 읽기 자리** (미수정)

#1591 이 센 네 곳 **밖에** 하나가 더 있다. `store-handover-guard.ts:117`:

```ts
receivable = await getUnsettledBalance(DB, `seller:${sellerId}`)
```

`getLedgerReceivable` 는 계정 **문자열 정확히 일치**로 집계하고 접기를 **하지 않는다**.
`canonicalPayee` 를 쓰는 곳은 `payouts-generate` 와 `admin-payouts` **둘뿐**(grep 실측).

⇒ 이용권 사용 적립은 `merchant:N` 에 쌓이는데 이 가드는 `seller:N` 만 본다 ⇒
**적립만 있고 차감이 없는 흔한 경우 `receivable === 0` 으로 읽혀 매장이 그냥 넘어간다.**
못 받은 돈을 남긴 채로. 이 가드는 조회 실패도 막는 **fail-closed 설계인데 여기서는 fail-open** 이다 —
돈이 **안 보여서** 0 이기 때문이다. 에러도 로그도 없다.

**상태**: `STAGING_CHECKLIST.md` **S-VC6** 에 결함으로 등록했다. **머니 경로(등급 C)라 고치지 않았다** —
단독 세션 + staging 실결제가 선행이다. 🍀 지금은 사용된 이용권 0장 · payouts 0건이라 피해자가 없다.

## 다음 세션의 첫 액션

1. **S-VC6 수리**(머니 · 단독 세션) — `getUnsettledBalance` 에 `canonicalPayee` 와 같은 접기를
   적용하거나 가드가 두 계정을 합산해 읽는다. **첫 실사용 전에 닫을 것.**
2. **대표 결제 테스트(P16/P17)** — orders 최신 id **89**. 늘면 id 90~ 의 `payment_status` 를 보고
   `STAGING_CHECKLIST.md` **S-VC1~5** 를 그대로 태운다(이 커밋에서 추가했다).
   ⚠️ **실제 결제는 대표가 한다.**
3. **2916 되돌리기**(테스트 종료 후): `PATCH /api/admin/products/2916 {is_active:0}` +
   `PATCH /api/admin/sellers/15/approve`. 둘 다 어드민 쓰기 → 대표 지시 필요.
4. **대표 미답 2건**: ① 2916 커버 이미지(사업자등록증 이미지 — 교체 필요)
   ② `popular_searches` 유령 제안(눌러서 0건 — 선재 구조, `2026-10-01-hide-from-main-not-from-search.md` §).
