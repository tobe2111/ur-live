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

## 다음 세션의 첫 액션

1. 이 수리가 머지되면 **main 의 `Deploy to Cloudflare Pages` 가 초록인지** 먼저 본다
   (초록이어야 소개서 PDF 가 라이브에 올라간다).
2. 그 뒤 E4:

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
for f in urdeal-store-owner-deck urdeal-store-owner-detail-deck urdeal-merchant-association-deck \
         urdeal-influencer-deck urdeal-agency-deck; do
  curl -sS -o /tmp/x.pdf -w "$f %{http_code} %{content_type} %{size_download}\n" -A "$UA" \
    "https://urdeal.kr/static/proposals/$f.pdf"
done
```

기대: 다섯 전부 `200 application/pdf`, 페이지 수 15 / 17 / 20 / 20 / 30.
그리고 구판 `influencer-proposal.html` 은 **더 이상 9장 덱을 주지 않아야** 한다
(지금 라이브는 308 → 452,984B 로 **옛 덱을 그대로** 주고 있다 — 배포가 안 됐기 때문이다).

## 남은 결정

없음. 이 수리는 머니 경로를 안 지나간다(시험 단언 + 주석).
