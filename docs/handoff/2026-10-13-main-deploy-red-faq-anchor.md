# main 배포 빨간불 수리 — FAQ 환불 시험의 거리 앵커 (2026-10-13)

## 한 줄
`#1744`(소개서 다섯 벌 최신화) 머지 뒤 **main 의 배포가 실패**했다. 원인은 그 PR 이 아니라
**다른 두 PR 이 main 에서 처음 만난 것**이고, 깨진 것은 거리(距離) 앵커 하나다.

## 무엇이 깨졌나

    Deploy to Cloudflare Pages   d50a59492   failure  (step 5 "Run unit tests")
    Guard mutations (full)       d50a59492   failure  (shard 2/12)

둘의 뿌리가 같다 — `src/tests/unit/faq-voucher-refund-2026-10-12.test.ts` 가 **main 에서 빨갛다**.
그래서 guard-mutations 는 *"주입 전에도 빨갛다 — 이 주입은 아무것도 증명하지 못한다"* 로 8건을 함께
신고했다(가드가 **지키는 척만** 하는 상태).

문제의 단언:

```ts
expect(c).toMatch(/payment_method === 'deal_points'[\s\S]{0,400}adjustUserPoints/)
```

- `#1750`(딜 현금 출구 정리)이 그 분기를 `adjustUserPoints` → **`refundDealPoints`** 로 바꿨다.
  무상(리워드) 딜로 산 이용권이 만료되면 그 딜이 **현금 환급 가능한 딜로 되살아나던**(무상→유상 세탁)
  것을 막는 수정이라 **더 정확한 쪽**이다.
- 같은 날 올라간 FAQ 시험은 그 분기를 **헬퍼 이름 + 400자 거리**로 잡고 있었다.

⇒ 각자의 PR 에서는 **둘 다 초록**이고, 합쳐진 main 에서만 빨갛다. 게다가 `#1750` 의 배포는 내
머지에 **취소**돼 아무도 그 빨간불을 못 봤다.

## 수리

1. **앵커를 지우지 않고 재조준** — 거리를 재지 않고 **분기 블록을 떼어** 그 안에서 딜 환불 SSOT
   (`refundDealPoints` 또는 `adjustUserPoints`)를 부르는지 본다. 경계는 바로 뒤 카드 분기의
   `payment_method === 'toss'` 다(거리 상수 0개). 불변식은 그대로 — **딜로 산 이용권이 만료되면
   딜로 되돌아간다.**
2. **낡은 주석 정정** — `auto-settlement.ts` 가 *"(adjustUserPoints SSOT)"* 를 계속 가리키고 있었다.
   다음 세션이 **옛 동작**(유상 버킷으로 되돌린다)을 읽게 돼 있던 자리다.

검증: 그 시험 12건 pass · `--only '🎟️↩️'` **주입 8건 전부 빨간불 확인**.

## 🩸 이번에 내가 틀린 것

**E4 측정기를 잘못 짰다.** 라이브 PDF 를 폴링하는데 조건을 `http_code = 200` 으로만 둬서, 배포 전
SPA 셸(`text/html` 59,958B)을 **PDF 로 착각해 첫 시도에 빠져나왔다.** `/static/` 밑 없는 파일은
Pages 가 **SPA 셸을 200 으로** 주므로 200 은 아무것도 말해 주지 않는다 — 판정은
`content-type: application/pdf` + `%PDF` 매직 + 페이지 수로 할 것.

**그리고 파일 이름을 두 개 지어 썼다.** 첫 E4 목록에 `urdeal-store-owner-detail-deck` ·
`urdeal-agency-deck` 을 적었는데 실제 이름은 `urdeal-store-owner-deck-detail` ·
`urdeal-agency-proposal` 이다. 둘이 SPA 셸을 돌려주니 **"배포가 두 건 빠졌다"** 로 오진할 뻔했다
(없는 파일도 200 이라 구분이 안 된다 — 위 오류와 같은 함정의 두 번째 얼굴).
⇒ **URL 목록을 기억에서 적지 말고 `AdminProposalsPage.tsx` 의 `url:` 다섯 줄에서 뽑을 것**
(`git show origin/main:src/pages/admin/AdminProposalsPage.tsx | grep "url: '/static"`).

## ✅ E4 판정 통과 (배포 후 라이브, 2026-10-13)

**main 은 내 PR 이 아니라 `#1752`(같은 줄을 따로 고친 다른 세션)가 머지되며 초록이 됐다**
(`e3bcf58dc` → `Deploy to Cloudflare Pages` success). 그 배포로 소개서 다섯이 라이브에 올라갔다 —
실제로 받아 **`%PDF` 매직과 페이지 수를 파싱해서** 쟀다:

```
urdeal-store-owner-deck            200 application/pdf 1,778,957  15장
urdeal-store-owner-deck-detail     200 application/pdf 1,458,110  17장
urdeal-merchant-association-deck   200 application/pdf 1,637,854  20장
urdeal-influencer-deck             200 application/pdf 1,423,837  20장
urdeal-agency-proposal             200 application/pdf 2,290,999  30장
```

바이트가 레포 blob 과 **정확히 일치**하고, 페이지 수도 기대값 15 / 17 / 20 / 20 / 30 과 같다.
구판 `influencer-proposal.html` 은 **452,984B 옛 9장 덱을 더는 주지 않는다** — 지금은 SPA 셸
(59,958B)이라 그 자리에 파일이 없다(시험 `admin-proposals-asset` 이 부재를 단언한다).

## 다음 세션의 첫 액션

소개서 쪽은 끝났다. 남은 것은 **PR #1754 의 머지 여부(대표 판단)** 뿐이고, 그 PR 은
main 이 이미 초록이라 **아무것도 막고 있지 않다**(앵커를 거리 상수 없이 더 튼튼하게 바꾸는 refinement).

## 남은 결정

없음. 이 수리는 머니 경로를 안 지나간다(시험 단언 + 주석).

## 🔀 후속 — 같은 줄을 두 세션이 따로 고쳤다 (머지 충돌)

이 수리를 올린 직후 `#1752`(유어쇼츠 표면 SEO)가 main 에 들어왔는데, **그 PR 도 같은 단언을
고쳤다.** 그래서 GitHub 쪽 머지가 `dirty` 가 되고 — 문서에 적힌 그 함정대로 — `Verify` 가
**실패가 아니라 부재**였다(`actions/runs?head_sha=…` 가 0건).

둘의 처방이 달랐고 **각자 한 가지를 더 알고 있었다**:

| | 이 PR | #1752 |
|---|---|---|
| 거리 상수 | **안 쓴다**(분기 블록을 떼어 낸다) | 400자 창 유지 |
| 앵커 | 이름(`refundDealPoints\|adjustUserPoints`) | **호출**(`…\(` — 이름만 보면 바로 위 구조분해 import 에 걸려 호출을 딴 함수로 바꿔도 초록) |
| 어느 헬퍼인지 | 안 잠근다 | 안 잠근다(`deal-cash-out` 이 이미 잠근다) |

⇒ 합쳐서 해소했다: **블록 슬라이스 + `\(` 호출 앵커.** 거리 상수 0개이면서 import 에도 안 걸린다.

🧭 **교훈**: 세션이 여러 개 동시에 도는 레포에서 *"main 이 빨간불"* 을 보면 **다른 세션도 같은 것을
보고 있을 수 있다.** 머지 충돌이 그걸 알려 주는 유일한 신호였다(둘 다 자기 PR 에서는 초록이다).
